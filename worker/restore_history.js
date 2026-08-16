const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const ws = require('ws');
require('dotenv').config({path: '.env'});
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { realtime: { transport: ws } });

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function restoreHistory() {
    console.log('Fetching successful uploads from activity logs...');
    // Look for success logs from today
    const { data: logs, error } = await supabase
        .from('activity_logs')
        .select('profile_id, message, created_at')
        .eq('platform', 'instagram')
        .eq('status', 'success')
        .order('created_at', { ascending: false })
        .limit(100);
        
    if (error) {
        console.error(error);
        return;
    }
    
    const uniqueProfileIds = [...new Set(logs.map(l => l.profile_id))];
    console.log('Found ' + uniqueProfileIds.length + ' profiles with successful uploads today.');
    
    for (const profileId of uniqueProfileIds) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single();
        if (!profile || !profile.drive_folder_id) continue;
        
        console.log('Restoring history for ' + profile.name + '...');
        try {
            const res = await drive.files.list({
                q: `'${profile.drive_folder_id}' in parents and mimeType contains 'video/' and trashed=false`,
                fields: 'files(id, name, mimeType, modifiedTime)',
                orderBy: 'modifiedTime desc',
                pageSize: 10
            });
            const files = res.data.files || [];
            
            for (const file of files) {
                // Insert into video_uploads
                await supabase.from('video_uploads').upsert({
                    profile_id: profile.id,
                    platform: 'instagram',
                    file_id: file.id,
                    file_name: file.name,
                    status: 'published',
                    upload_date: new Date().toISOString()
                }, { onConflict: 'profile_id,platform,file_id' });
                console.log(` Restored: ${file.name}`);
            }
        } catch(e) {
            console.error('Error fetching drive files for ' + profile.name + ':', e.message);
        }
    }
    console.log('Done restoring history!');
}
restoreHistory();
