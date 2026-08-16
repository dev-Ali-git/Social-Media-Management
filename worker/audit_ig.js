const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const ws = require('ws');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: ws } });

async function auditInstagramProfiles() {
    console.log('Fetching active Instagram accounts from database...');
    const { data: accounts, error } = await supabase
        .from('social_accounts')
        .select('id, username, profile_id, session_cookies')
        .eq('platform', 'instagram')
        .not('session_cookies', 'is', null);

    if (error) {
        console.error('Error fetching accounts:', error);
        return;
    }

    console.log(`Found ${accounts.length} Instagram accounts with cookies.`);
    
    const browser = await chromium.launch({ headless: true });
    
    const results = {
        healthy: [],
        blocked: [],
        failed: []
    };

    for (const account of accounts) {
        console.log(`\nTesting account: ${account.username || account.id}...`);
        const context = await browser.newContext({
            viewport: { width: 1280, height: 1024 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        });
        
        try {
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
            await context.addCookies(formattedCookies);

            const page = await context.newPage();
            await page.goto('https://www.instagram.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(4000); // Wait for bot detection redirects
            
            const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
            
            if (pageText.includes("Confirm you're human") || pageText.includes("Help us confirm it's you") || pageText.includes("suspicious activity") || pageText.includes("Account restricted")) {
                console.log(`❌ BLOCKED (Security Checkpoint)`);
                results.blocked.push(account.username || account.id);
            } else if (pageText.includes("Log in") && pageText.includes("Sign up") && !pageText.includes("Not Now")) {
                console.log(`⚠️ LOGGED OUT (Cookies invalid or expired)`);
                results.failed.push(account.username || account.id);
            } else {
                console.log(`✅ HEALTHY`);
                results.healthy.push(account.username || account.id);
            }
        } catch (err) {
            console.log(`⚠️ ERROR testing account: ${err.message}`);
            results.failed.push(account.username || account.id);
        } finally {
            await context.close();
        }
    }

    await browser.close();

    console.log('\n====================================');
    console.log('AUDIT COMPLETE');
    console.log('====================================');
    console.log(`Healthy Accounts (${results.healthy.length}):`);
    results.healthy.forEach(u => console.log(`  - ${u}`));
    console.log(`\nBlocked/Checkpoint Accounts (${results.blocked.length}):`);
    results.blocked.forEach(u => console.log(`  - ${u}`));
    console.log(`\nLogged Out / Invalid Cookies (${results.failed.length}):`);
    results.failed.forEach(u => console.log(`  - ${u}`));
}

auditInstagramProfiles();
