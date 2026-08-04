require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: require('ws') } });

async function testDriveCookies() {
    const { data: driveAccount } = await supabase
        .from('social_accounts')
        .select('session_cookies')
        .eq('platform', 'drive')
        .single();

    if (!driveAccount) return console.log("No drive account");

    let formattedCookies = driveAccount.session_cookies.map(cookie => {
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
            expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : (typeof cookie.expires === 'number' ? cookie.expires : -1),
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite: sameSite
        };
    });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    try {
        await context.addCookies(formattedCookies);
        console.log("Cookies injected successfully.");
    } catch (e) {
        console.log("Error injecting cookies:", e);
    }

    const page = await context.newPage();
    await page.goto('https://drive.google.com/drive/my-drive', { waitUntil: 'networkidle' });
    
    const text = await page.evaluate(() => document.body.innerText);
    if (text.includes('Sign in')) {
        console.log("TEST FAILED: Still asking to sign in!");
    } else {
        console.log("TEST SUCCESS: Logged in to Google Drive!");
    }
    
    await browser.close();
    process.exit(0);
}

testDriveCookies();
