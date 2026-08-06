import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  
  // Note: We removed the strict Vercel CRON_SECRET check so that 3rd party free
  // cron services like cron-job.org can ping this endpoint easily.

  const GITHUB_PAT = process.env.GITHUB_PAT;
  if (!GITHUB_PAT) {
    return new Response('Missing GITHUB_PAT in Vercel Environment Variables', {
      status: 500,
    });
  }

  // dev-Ali-git/Social-Media-Management
  const owner = 'dev-Ali-git';
  const repo = 'Social-Media-Management';
  const workflow_id = 'worker.yml';

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Check master switch
    const { data: globalSettings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'global_automation_paused')
      .single();
      
    if (globalSettings && globalSettings.value === 'true') {
      return NextResponse.json({ success: true, message: 'Automation is globally paused.' });
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: 'main',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API Error:', errorText);
      return new Response(`GitHub API responded with ${response.status}: ${errorText}`, {
        status: response.status,
      });
    }

    return NextResponse.json({ success: true, message: 'GitHub Action successfully triggered by Vercel Cron.' });
  } catch (error: any) {
    console.error('Fetch error:', error);
    return new Response(`Error triggering GitHub Action: ${error.message}`, {
      status: 500,
    });
  }
}
