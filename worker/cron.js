require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const ws = require('ws');
const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: { transport: ws }
});

async function logActivity(profileId, platform, status, message) {
    console.log(`[${status.toUpperCase()}] ${platform || 'SYSTEM'}: ${message}`);
    try {
        await supabase.from('activity_logs').insert({
            profile_id: profileId,
            platform: platform || 'system',
            status,
            message
        });
    } catch (e) {}
}

async function upsertVideoStatus(profileId, fileId, fileName, platform, status, errorMessage = null) {
    try {
        await supabase.from('video_uploads').upsert({
            profile_id: profileId,
            file_id: fileId,
            file_name: fileName,
            platform: platform,
            status: status,
            error_message: errorMessage
        }, { onConflict: 'profile_id,file_id,platform' });
    } catch (e) {
        console.error('Failed to upsert video status', e);
    }
}

async function processProfile(browser, profileId, profileData) {
    if (profileData.is_active === false) {
        return;
    }

    try {
        // ==========================================
        // PHASE 1: FIND NEXT VIDEO IN DRIVE
        // ==========================================
        const { data: driveFolder } = await supabase
            .from('drive_folders')
            .select('folder_url')
            .eq('profile_id', profileId)
            .eq('folder_type', 'source')
            .single();
        
        let fileToProcess = null;
        let platformsToUpload = [];
        
        if (driveFolder && driveFolder.folder_url) {
            const driveContext = await browser.newContext({ acceptDownloads: true });
            const drivePage = await driveContext.newPage();
            
            try {
                await drivePage.goto(driveFolder.folder_url, { waitUntil: 'domcontentloaded' });
                await drivePage.waitForTimeout(5000); 

                const folderIdMatch = driveFolder.folder_url.match(/folders\/([a-zA-Z0-9_-]+)/);
                const folderId = folderIdMatch ? folderIdMatch[1] : null;

                const filesInDrive = await drivePage.evaluate((folderId) => {
                    const elements = document.querySelectorAll('div[data-id]');
                    let files = [];
                    for (const el of elements) {
                        const id = el.getAttribute('data-id');
                        const name = el.getAttribute('aria-label') || el.innerText || 'Unknown Video';
                        if (id && id.length > 25 && id !== folderId) {
                            files.push({ id, name });
                        }
                    }
                    return files;
                }, folderId);
                
                const { data: uploadHistory } = await supabase
                    .from('video_uploads')
                    .select('*')
                    .eq('profile_id', profileId);
                    
                const history = uploadHistory || [];

                for (const file of filesInDrive) {
                    let pendingPlatforms = [];
                    for (const rule of profileData.rules) {
                        const record = history.find(h => h.file_id === file.id && h.platform === rule.platform);
                        if (!record || record.status !== 'success') {
                            pendingPlatforms.push(rule);
                        }
                    }
                    
                    if (pendingPlatforms.length > 0) {
                        fileToProcess = file;
                        platformsToUpload = pendingPlatforms;
                        break; 
                    }
                }
                
                if (fileToProcess) {
                    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileToProcess.id}`;
                    const downloadPromise = drivePage.waitForEvent('download', { timeout: 120000 }).catch(() => null);
                    await drivePage.goto(downloadUrl).catch(e => {
                        if (!e.message.includes('ERR_ABORTED')) {}
                    });
                    
                    const confirmDownloadBtn = drivePage.locator('#uc-download-link');
                    if (await confirmDownloadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                        await confirmDownloadBtn.click();
                    }
                    
                    const download = await downloadPromise;
                    if (download) {
                        const downloadsDir = path.join(__dirname, 'downloads');
                        if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
                        
                        fileToProcess.localPath = path.join(downloadsDir, download.suggestedFilename());
                        await download.saveAs(fileToProcess.localPath);
                        await logActivity(profileId, 'drive', 'info', `Video downloaded: ${download.suggestedFilename()}`);
                    } else {
                        fileToProcess = null;
                    }
                }
            } catch (e) {
                await logActivity(profileId, 'drive', 'error', `Source folder error: ${e.message}`);
            }
            await driveContext.close();
        }

        if (!fileToProcess || !fileToProcess.localPath) {
            return;
        }

        // ==========================================
        // PHASE 2: UPLOAD TO PENDING PLATFORMS
        // ==========================================
        for (const rule of platformsToUpload) {
            const { data: account } = await supabase
                .from('social_accounts')
                .select('*')
                .eq('profile_id', profileId)
                .eq('platform', rule.platform)
                .single();

            if (!account || !account.is_active || !account.session_cookies || account.session_cookies.length === 0) {
                await logActivity(profileId, rule.platform, 'error', 'Account disabled or missing cookies.');
                await upsertVideoStatus(profileId, fileToProcess.id, fileToProcess.name, rule.platform, 'failed', 'Account disabled or missing cookies.');
                continue;
            }

            const { data: scriptData } = await supabase
                .from('automation_scripts')
                .select('script_code')
                .eq('platform', rule.platform)
                .single();
                
            if (!scriptData || !scriptData.script_code) {
                await logActivity(profileId, rule.platform, 'error', 'No automation script recorded for this platform.');
                await upsertVideoStatus(profileId, fileToProcess.id, fileToProcess.name, rule.platform, 'failed', 'No automation script recorded.');
                continue;
            }

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
            });
            
            let formattedCookies = account.session_cookies.map(cookie => {
                let sameSite = undefined;
                if (typeof cookie.sameSite === 'string') {
                    const s = cookie.sameSite.toLowerCase();
                    if (s === 'no_restriction' || s === 'none') sameSite = 'None';
                    else if (s === 'lax') sameSite = 'Lax';
                    else if (s === 'strict') sameSite = 'Strict';
                }
                return {
                    name: cookie.name,
                    value: cookie.value,
                    domain: cookie.domain,
                    path: cookie.path,
                    expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : cookie.expires,
                    httpOnly: cookie.httpOnly,
                    secure: cookie.secure,
                    sameSite: sameSite
                };
            });

            try {
                await context.addCookies(formattedCookies);
            } catch (cookieErr) {
                await logActivity(profileId, rule.platform, 'error', `Cookie injection issue: ${cookieErr.message}`);
            }

            const page = await context.newPage();
            page.setDefaultTimeout(1800000); 
            
            const baseFileName = path.basename(fileToProcess.localPath, path.extname(fileToProcess.localPath));
            const finalCaption = (rule.caption_template || '')
                .replace('{filename}', baseFileName)
                .replace('{hashtags}', rule.hashtags || '');

            try {
                let finalMacroCode = scriptData.script_code;
                if (fileToProcess.localPath) {
                    finalMacroCode = finalMacroCode.replace(/\.(setInputFiles|setFiles)\(\[?['`"].*?['`"]\]?\)/g, `.$1(${JSON.stringify(fileToProcess.localPath)})`);
                }
                finalMacroCode = finalMacroCode.replace(/OMNIPOST_CAPTION/g, finalCaption);
                
                finalMacroCode = finalMacroCode.replace(/OMNIPOST_PROFILE_NAME/g, profileData.profile_name);
                if (account.username) {
                    finalMacroCode = finalMacroCode.replace(/OMNIPOST_USERNAME/g, account.username);
                }

                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const dynamicMacro = new AsyncFunction('page', finalMacroCode);
                
                await dynamicMacro(page);
                
                let isUploading = true;
                let checks = 0;
                while (isUploading && checks < 120) {
                    const allText = await page.evaluate(() => {
                        function getShadowText(node) {
                            let text = '';
                            if (node.nodeType === Node.TEXT_NODE) text += node.textContent + ' ';
                            else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                                const children = node.shadowRoot ? node.shadowRoot.childNodes : node.childNodes;
                                for (let child of children) text += getShadowText(child);
                            }
                            return text;
                        }
                        return getShadowText(document.body).replace(/\s+/g, ' ');
                    }).catch(() => '');

                    const uploadMatch = allText.match(/Uploading \d+%/i);
                    const cancelUpload = allText.match(/Cancel upload/i);
                    
                    if (!uploadMatch && !cancelUpload) {
                        isUploading = false;
                    } else {
                        await page.waitForTimeout(5000);
                        checks++;
                    }
                }

                await logActivity(profileId, rule.platform, 'success', 'Video successfully uploaded and published!');
                await upsertVideoStatus(profileId, fileToProcess.id, fileToProcess.name, rule.platform, 'success');
                
                if (rule.matchedSlot) {
                    const newTimeSlots = rule.time_slots.filter(s => !(s.date === rule.matchedSlot.date && s.time === rule.matchedSlot.time));
                    await supabase.from('publishing_rules').update({ time_slots: newTimeSlots }).eq('id', rule.id);
                    await logActivity(profileId, rule.platform, 'info', `Removed processed schedule slot: ${rule.matchedSlot.date} ${rule.matchedSlot.time}`);
                }
            } catch (macroErr) {
                await logActivity(profileId, rule.platform, 'error', `Macro execution failed: ${macroErr.message}`);
                await upsertVideoStatus(profileId, fileToProcess.id, fileToProcess.name, rule.platform, 'failed', macroErr.message);
            }

            await context.close();
        }
        
        if (fileToProcess.localPath && fs.existsSync(fileToProcess.localPath)) {
            fs.unlinkSync(fileToProcess.localPath);
        }

    } catch (err) {
        await logActivity(profileId, 'system', 'error', `Profile crash: ${err.message}`);
    }
}

const processingProfiles = new Set();

async function startDaemon() {
    console.log('======================================================');
    console.log('OmniPost Playwright Cron Engine Started');
    console.log('Running a single upload pass...');
    console.log('======================================================\n');

    const browser = await chromium.launch({ headless: process.env.NODE_ENV !== 'development' }); 

    try {
        const now = new Date();
        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMin = now.getMinutes().toString().padStart(2, '0');
        const currentTimeStr = `${currentHour}:${currentMin}`; 

        const { data: rules, error } = await supabase.from('publishing_rules').select('*, profiles(name, is_active)');
        if (error || !rules) {
            console.error('Failed to fetch rules:', error);
            await browser.close();
            return;
        }

        const profilesMap = {};
        for (const rule of rules) {
            const isScheduled = Array.isArray(rule.time_slots) && rule.time_slots.length > 0;
            let matchedSlot = null;
            
            if (isScheduled) {
                const now = new Date();
                for (const slot of rule.time_slots) {
                    if (slot && slot.date && slot.time) {
                        const scheduledDate = new Date(`${slot.date}T${slot.time}:00`);
                        if (now >= scheduledDate) {
                            matchedSlot = slot;
                            break;
                        }
                    }
                }
                if (!matchedSlot) {
                    continue; 
                }
            }

            if (!profilesMap[rule.profile_id]) {
                profilesMap[rule.profile_id] = {
                    profile_name: rule.profiles?.name,
                    is_active: rule.profiles?.is_active,
                    rules: []
                };
            }
            profilesMap[rule.profile_id].rules.push({ ...rule, matchedSlot });
        }

        const allProfiles = Object.entries(profilesMap);
        const activeProfiles = allProfiles.filter(([_, data]) => data.is_active !== false);
        
        if (activeProfiles.length > 0) {
            const eligibleProfiles = activeProfiles.filter(([id]) => !processingProfiles.has(id));
            
            if (eligibleProfiles.length > 0) {
                console.log(`[${currentTimeStr}] Triggering concurrent upload for ${eligibleProfiles.length} profiles...`);
                
                eligibleProfiles.forEach(([id]) => processingProfiles.add(id));
                
                await Promise.all(eligibleProfiles.map(async ([profileId, profileData]) => {
                    try {
                        await processProfile(browser, profileId, profileData);
                    } finally {
                        processingProfiles.delete(profileId);
                    }
                }));
            } else {
                console.log('No eligible profiles to process in this run.');
            }
        } else {
            console.log('No profiles have active scheduling requirements at this time.');
        }

    } catch (e) {
        console.error('Cron run error:', e.message);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

startDaemon().catch(console.error);
