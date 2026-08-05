import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const profileId = searchParams.get('state');
  
  if (!code || !profileId) {
    return NextResponse.json({ error: 'Missing code or state (profileId)' }, { status: 400 });
  }

  try {
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      `${baseUrl}/api/youtube/callback`
    );

    const { tokens } = await oauth2Client.getToken(code);
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: existing } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('profile_id', profileId)
      .eq('platform', 'youtube')
      .single();
      
    if (existing) {
        await supabase
          .from('social_accounts')
          .update({
              session_cookies: tokens,
              is_active: true,
          })
          .eq('id', existing.id);
    } else {
        await supabase
          .from('social_accounts')
          .insert({
              profile_id: profileId,
              platform: 'youtube',
              username: 'YouTube Channel API',
              session_cookies: tokens,
              is_active: true
          });
    }

    return NextResponse.redirect(`${baseUrl}/socials?success=youtube_connected`);
    
  } catch (error: any) {
    console.error('Error during YouTube OAuth callback:', error);
    return NextResponse.json({ error: 'Failed to authenticate with YouTube: ' + error.message }, { status: 500 });
  }
}
