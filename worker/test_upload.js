require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: require('ws') } });

async function test() {
    const { data: driveAccount } = await supabase.from('social_accounts').select('session_cookies').eq('platform', 'drive').single();
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
            expires: typeof cookie.expirationDate === 'number' ? cookie.expirationDate : -1,
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite: sameSite
        };
    });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });
    await context.addCookies(formattedCookies);
    const page = await context.newPage();
    
    // Create a dummy file
    fs.writeFileSync('dummy.txt', 'Hello world');

    await page.goto('https://drive.google.com/drive/my-drive', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    
    try {
        await page.locator('input[type="file"]').first().setInputFiles('dummy.txt', { timeout: 15000 });
        console.log("SUCCESS: Input file injected!");
    } catch (e) {
        console.log("FAILED: input[type=file] injection failed:", e.message);
        try {
            await page.getByRole('button', { name: 'New' }).click();
            await page.getByRole('menuitem', { name: 'File upload' }).click();
            console.log("SUCCESS: UI clicks worked!");
        } catch(e2) {
            console.log("FAILED: UI clicks failed:", e2.message);
        }
    }

    await browser.close();
    process.exit(0);
}
test();
