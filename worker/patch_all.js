require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: require('ws') } });

const fbScript = `
  await page.goto('https://business.facebook.com/latest/home');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Create Reel' }).click({ force: true, timeout: 5000 }).catch(() => {});
  
  // Intercept the file upload
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Add video' }).click({ force: true });
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles('video.mp4');

  await page.locator('div').filter({ hasText: /^Let viewers know what your reel is about$/ }).first().click({ force: true, timeout: 5000 }).catch(() => {});
  
  const captionBox = page.getByRole('textbox', { name: 'Write in the dialogue box' });
  await captionBox.click({ force: true, timeout: 5000 }).catch(() => {});
  await captionBox.fill('OMNIPOST_CAPTION ');
  
  // The 'Next' button remains disabled until processing finishes, wait up to 3 mins
  await page.getByRole('button', { name: 'Next' }).nth(1).click({ force: true, timeout: 180000 });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Next' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Share', exact: true }).click({ force: true });
  
  await page.getByRole('button', { name: 'Done' }).click({ force: true, timeout: 180000 });
`;

const igScript = `
  await page.goto('https://www.instagram.com/');
  
  // Dismiss popups
  await page.getByRole('button', { name: 'Not Now' }).click({ force: true, timeout: 5000 }).catch(() => {});
  
  const createBtn = page.locator('svg[aria-label="New post"]').first();
  await createBtn.hover({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await createBtn.click({ force: true });

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Select from computer' }).click({ force: true });
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles('video.mp4');

  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: 'OK' }).click({ force: true, timeout: 5000 }).catch(() => {});
  
  await page.locator('button').filter({ hasText: 'Select crop' }).click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Original Photo outline icon' }).click({ force: true, timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  
  await page.getByRole('button', { name: 'Next' }).click({ force: true });
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: 'Next' }).click({ force: true });
  await page.waitForTimeout(1000);
  
  await page.getByRole('textbox', { name: 'Write a caption...' }).click({ force: true, timeout: 5000 }).catch(() => {});
  await page.getByRole('textbox', { name: 'Write a caption...' }).fill('OMNIPOST_CAPTION ');
  
  await page.getByRole('button', { name: 'Share' }).click({ force: true });
  
  await page.waitForFunction(() => {
      const text = document.body.innerText || '';
      return text.includes('has been shared') || text.includes('shared');
  }, { timeout: 180000 }).catch(() => {});
`;

async function patch() {
    console.log("Patching Facebook...");
    await supabase.from('automation_scripts').update({ script_code: fbScript }).eq('platform', 'facebook');
    console.log("Patching Instagram...");
    await supabase.from('automation_scripts').update({ script_code: igScript }).eq('platform', 'instagram');
    console.log("Done.");
}

patch();
