require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: require('ws') } });

const resilientScript = `
  await page.goto('https://business.facebook.com/latest/home');
  await page.getByRole('button', { name: 'Create Reel' }).click();
  
  // Intercept the file upload
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add video' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles('video.mp4');

  await page.locator('div').filter({ hasText: /^Let viewers know what your reel is about$/ }).first().click().catch(() => {});
  
  const captionBox = page.getByRole('textbox', { name: 'Write in the dialogue box' });
  await captionBox.click();
  await captionBox.fill('OMNIPOST_CAPTION ');
  
  // Wait for the video to be fully uploaded and processed before clicking Next
  // The 'Next' button remains disabled until processing finishes.
  await page.getByRole('button', { name: 'Next' }).nth(1).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  
  // Wait for the final "Done" confirmation!
  await page.getByRole('button', { name: 'Done' }).click();
`;

supabase.from('automation_scripts').update({ script_code: resilientScript }).eq('platform', 'facebook').then(({error}) => {
    if (error) console.error(error);
    else console.log('Successfully patched the user recorded Facebook script!');
    process.exit(0);
});
