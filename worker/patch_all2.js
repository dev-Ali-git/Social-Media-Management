const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: ws } });

async function patchMacros() {
    const { data: scripts, error } = await supabase.from('automation_scripts').select('*');
    if (error) {
        console.error('Failed to fetch scripts:', error);
        return;
    }

    const fbScript = scripts.find(s => s.platform === 'facebook');
    if (fbScript) {
        console.log('Patching Facebook...');
        const newFbCode = `
  await page.goto('https://business.facebook.com/latest/home');
  await page.waitForTimeout(3000);
  
  // Fast fail on security checkpoints
  const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
  if (pageText.includes("Confirm you're human") || pageText.includes("Help us confirm it's you") || pageText.includes("suspicious activity") || pageText.includes("Account restricted")) {
      throw new Error("Meta blocked the upload with a security check. You must log into this account manually, complete the CAPTCHA, and grab fresh cookies for OmniPost.");
  }
  
  // Try clicking Create Reel using various selectors
  const createReel = page.locator('div[role="button"], button').filter({ hasText: 'Create Reel' }).first();
  await createReel.click({ force: true, timeout: 5000 }).catch(() => {});
  
  await page.keyboard.press('Escape'); // Dismiss any popups
  await page.waitForTimeout(1000);
  
  const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 30000 }),
      page.locator('div[role="button"], button').filter({ hasText: 'Add video' }).first().click({ force: true, timeout: 30000 })
  ]);
  await fileChooser.setFiles('video.mp4');

  await page.locator('div').filter({ hasText: /^Let viewers know what your reel is about$/ }).first().click({ force: true, timeout: 5000 }).catch(() => {});
  
  const captionBox = page.getByRole('textbox', { name: 'Write in the dialogue box' });
  await captionBox.click({ force: true, timeout: 5000 }).catch(() => {});
  await captionBox.fill('OMNIPOST_CAPTION ');
  
  // Facebook has multiple steps. We look for the last 'Next' button which is usually the active one in the modal footer.
  const nextBtn = page.locator('div[aria-label="Next"], button:has-text("Next"), div[role="button"]:has-text("Next")').last();
  await nextBtn.click({ force: true, timeout: 180000 }); // Wait for upload/processing
  await page.waitForTimeout(2000);
  
  await nextBtn.click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  const shareBtn = page.locator('div[aria-label="Share"], button:has-text("Share"), div[role="button"]:has-text("Share")').last();
  await shareBtn.click({ force: true, timeout: 10000 });
  
  await page.getByRole('button', { name: 'Done' }).click({ force: true, timeout: 180000 }).catch(() => {});
`;
        await supabase.from('automation_scripts').update({ script_code: newFbCode }).eq('platform', 'facebook');
    }

    const igScript = scripts.find(s => s.platform === 'instagram');
    if (igScript) {
        console.log('Patching Instagram...');
        const newIgCode = `
  await page.goto('https://www.instagram.com/');
  await page.waitForTimeout(3000);
  
  // Fast fail on security checkpoints
  const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
  if (pageText.includes("Confirm you're human") || pageText.includes("Help us confirm it's you") || pageText.includes("suspicious activity") || pageText.includes("Account restricted")) {
      throw new Error("Meta blocked the upload with a security check. You must log into this account manually, complete the CAPTCHA, and grab fresh cookies for OmniPost.");
  }
  
  // Aggressively dismiss any unexpected home-screen popups (Turn on notifications, Meta Verified, etc)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  
  await page.locator('button').filter({ hasText: 'Not Now' }).click({ force: true, timeout: 5000 }).catch(() => {});
  await page.locator('button').filter({ hasText: 'Dismiss' }).click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  // Look for the "Create" button in the sidebar OR the new post plus icon
  const createTextBtn = page.locator('a, div[role="link"]').filter({ hasText: 'Create' }).first();
  const createIconBtn = page.locator('svg[aria-label="New post"]').first();
  
  if (await createTextBtn.isVisible().catch(() => false)) {
      await createTextBtn.click({ force: true });
  } else {
      await createIconBtn.click({ force: true }).catch(() => {});
  }
  
  await page.waitForTimeout(2000);
  
  // Check if the new "Post" submenu appeared
  const postSubmenuBtn = page.locator('span, div').filter({ hasText: /^Post$/ }).first();
  if (await postSubmenuBtn.isVisible().catch(() => false)) {
      await postSubmenuBtn.click({ force: true });
      await page.waitForTimeout(2000);
  }
  
  const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 30000 }),
      page.getByText('Select from computer').last().click({ force: true, timeout: 30000 })
  ]);
  await fileChooser.setFiles('video.mp4');

  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'OK' }).click({ force: true, timeout: 5000 }).catch(() => {});
  
  await page.locator('[aria-label="Select crop"]').first().click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('text="Original"').first().click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  
  const nextIgBtn = page.getByText('Next', { exact: true }).last();
  await nextIgBtn.click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await nextIgBtn.click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);
  
  const captionIgBox = page.locator('div[aria-label="Write a caption..."], textarea[aria-label="Write a caption..."], div[role="textbox"]').first();
  await captionIgBox.click({ force: true, timeout: 5000 }).catch(() => {});
  await captionIgBox.fill('OMNIPOST_CAPTION ').catch(() => {});
  
  const shareIgBtn = page.getByText('Share', { exact: true }).last();
  await shareIgBtn.click({ force: true, timeout: 5000 }).catch(() => {});
  
  await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return text.includes('has been shared') || text.includes('shared');
  }, { timeout: 180000 }).catch(() => {});
`;
        await supabase.from('automation_scripts').update({ script_code: newIgCode }).eq('platform', 'instagram');
    }

    console.log('Done.');
}

patchMacros();
