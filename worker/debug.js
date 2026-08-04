require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: require('ws') } });

supabase.from('social_accounts').select('*').eq('platform', 'tiktok').then(({data}) => {
    fs.writeFileSync('tiktok_cookies.json', JSON.stringify(data, null, 2));
    console.log('Saved to tiktok_cookies.json');
    process.exit(0);
});
