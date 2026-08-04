require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: require('ws') } });

const resilientScript = `
  await page.goto('https://www.tiktok.com/tiktokstudio/upload');
  await page.getByRole('button', { name: 'Select video', exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles('video.mp4');
  
  // Wait for upload to initiate
  await page.waitForTimeout(3000);
  
  // Try to dismiss modals if they appear (catch errors if they don't)
  await page.getByRole('button', { name: 'Cancel' }).click().catch(() => {});
  await page.getByRole('button', { name: 'Got it' }).click().catch(() => {});
  
  // Focus caption and fill
  const captionBox = page.locator('.public-DraftEditor-content, .public-DraftStyleDefault-block').first();
  await captionBox.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await captionBox.fill('OMNIPOST_CAPTION');
  
  // Click Post
  await page.getByRole('button', { name: 'Post' }).click();
`;

supabase.from('automation_scripts').update({ script_code: resilientScript }).eq('platform', 'tiktok').then(({error}) => {
    if (error) console.error(error);
    else console.log('Successfully updated tiktok script to be resilient!');
    process.exit(0);
});
