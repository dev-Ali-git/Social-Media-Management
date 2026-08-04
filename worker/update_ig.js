require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: require('ws') } });

const resilientScript = `
  await page.goto('https://www.instagram.com/');
  
  // Try to dismiss "Turn on Notifications" or "Save Password"
  await page.getByRole('button', { name: 'Not Now' }).click().catch(() => {});
  
  // Hover over the create button to force the sidebar to expand, then click it
  const createBtn = page.locator('svg[aria-label="New post"]').first();
  await createBtn.hover({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
  await createBtn.click({ force: true });
  
  // Some accounts require clicking "Post" in a sub-menu that appears
  await page.getByRole('button', { name: 'Post' }).click().catch(() => {});
  await page.getByRole('menuitem', { name: 'Post' }).click().catch(() => {});

  // Wait for the upload modal to fully appear
  await page.waitForTimeout(2000);

  // Use Playwright's FileChooser to safely intercept the OS dialog
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Select from computer' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles('video.mp4');
  
  // Wait a moment for processing
  await page.waitForTimeout(3000);
  
  // Handle "Video posts are now shared as reels" modal if it appears
  await page.getByRole('button', { name: 'OK' }).click().catch(() => {});
  
  // Aspect ratio adjustment (Instagram crops videos by default)
  await page.locator('button').filter({ hasText: 'Select crop' }).click().catch(() => {});
  await page.getByRole('button', { name: 'Original Photo outline icon' }).click().catch(() => {});
  
  // Next -> Next
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Next' }).click();
  await page.waitForTimeout(1000);
  
  // Focus caption and fill
  await page.getByRole('textbox', { name: 'Write a caption...' }).fill('OMNIPOST_CAPTION');
  
  // Share!
  await page.getByRole('button', { name: 'Share' }).click();
  
  // Force Playwright to wait until Instagram's upload success text appears!
  await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return text.includes('has been shared') || text.includes('shared');
  }, { timeout: 1800000 }).catch(() => {});
`;

supabase.from('automation_scripts').update({ script_code: resilientScript }).eq('platform', 'instagram').then(({error}) => {
    if (error) console.error(error);
    else console.log('Successfully updated instagram script with fileChooser!');
    process.exit(0);
});
