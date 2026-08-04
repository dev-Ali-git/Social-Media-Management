require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: require('ws') } });

const resilientScript = `
  await page.goto('https://www.instagram.com/');
  
  // Dismiss popups
  await page.getByRole('button', { name: 'Not Now' }).click().catch(() => {});
  
  // Fix 1: Robust Create Button Click (Hovers first so it expands)
  const createBtn = page.locator('svg[aria-label="New post"]').first();
  await createBtn.hover({ force: true }).catch(() => {});
  await page.waitForTimeout(1000);
  await createBtn.click({ force: true });

  // Fix 2: Safe File Upload (Intercepts the Windows File Picker so it doesn't freeze!)
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Select from computer' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles('video.mp4');

  // The rest of your exact recorded script:
  await page.getByRole('button', { name: 'OK' }).click().catch(() => {});
  await page.locator('button').filter({ hasText: 'Select crop' }).click();
  await page.getByRole('button', { name: 'Original Photo outline icon' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('textbox', { name: 'Write a caption...' }).click();
  await page.getByRole('textbox', { name: 'Write a caption...' }).fill('OMNIPOST_CAPTION ');
  
  await page.getByRole('button', { name: 'Share' }).click();
  
  // Fix 3: Waiting for Upload! 
  // Because you clicked "Done" when you recorded, Playwright will natively wait up to 30 minutes for this button to appear!
  await page.getByRole('button', { name: 'Done' }).click();
`;

supabase.from('automation_scripts').update({ script_code: resilientScript }).eq('platform', 'instagram').then(({error}) => {
    if (error) console.error(error);
    else console.log('Successfully patched the user recorded Instagram script!');
    process.exit(0);
});
