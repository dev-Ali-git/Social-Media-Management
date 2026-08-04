require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    realtime: { transport: ws }
});

app.post('/api/record', async (req, res) => {
    const { platform, url, profileId } = req.body;

    if (!platform || !url) {
        return res.status(400).json({ error: 'Platform and URL are required.' });
    }

    try {
        console.log(`Starting recording session for ${platform}...`);
        
        let account = null;
        if (profileId) {
            const { data } = await supabase
                .from('social_accounts')
                .select('session_cookies')
                .eq('profile_id', profileId)
                .eq('platform', platform)
                .single();
            account = data;
        }

        let storageStatePath = path.join(__dirname, `state_${platform}.json`);
        let codegenCommand = `npx playwright codegen "${url}" -o script_${platform}.js`;

        if (account && account.session_cookies) {
            // Format cookies
            const formattedCookies = account.session_cookies.map(cookie => {
                let sameSite = "Lax"; // Playwright STRICTLY requires this to be a string
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
                    expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : (typeof cookie.expires === 'number' ? cookie.expires : -1),
                    httpOnly: cookie.httpOnly || false,
                    secure: cookie.secure || false,
                    sameSite: sameSite
                };
            });

            const stateObj = { cookies: formattedCookies, origins: [] };
            fs.writeFileSync(storageStatePath, JSON.stringify(stateObj, null, 2));
            
            codegenCommand = `npx playwright codegen "${url}" --load-storage ${storageStatePath} -o script_${platform}.js`;
            console.log(`Injected cookies for ${platform}.`);
        } else {
            console.log(`No cookies found for ${platform}. Launching clean browser.`);
        }

        res.json({ message: 'Recording started! Please perform your actions in the newly opened browser window and close it when done.' });

        console.log(`Running: ${codegenCommand}`);
        exec(codegenCommand, async (error, stdout, stderr) => {
            if (error) console.error(`[EXEC ERROR] Playwright crash:`, error.message);
            if (stderr) console.error(`[PLAYWRIGHT ERROR]:`, stderr);
            
            console.log(`Recording closed for ${platform}. Processing script...`);
            
            if (fs.existsSync(storageStatePath)) fs.unlinkSync(storageStatePath);

            const scriptPath = path.join(__dirname, `script_${platform}.js`);
            if (fs.existsSync(scriptPath)) {
                const scriptContent = fs.readFileSync(scriptPath, 'utf8');
                
                // Extract only the actions
                const lines = scriptContent.split('\n');
                const actionLines = lines.filter(line => line.trim().startsWith('await page.'));
                const finalScript = actionLines.join('\n');

                console.log(`Extracted ${actionLines.length} action steps.`);

                if (finalScript) {
                    const { error: dbError } = await supabase
                        .from('automation_scripts')
                        .upsert({
                            platform: platform,
                            script_code: finalScript
                        }, { onConflict: 'platform' });
                        
                    if (dbError) console.error('Failed to save script to Supabase:', dbError);
                    else console.log(`Script for ${platform} saved successfully to database!`);
                }

                fs.unlinkSync(scriptPath);
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

const PORT = 4000;
app.listen(PORT, () => {
    console.log(`OmniPost Local Worker API listening on http://localhost:${PORT}`);
});
