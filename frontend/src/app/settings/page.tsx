"use client";

import { useState, useEffect } from "react";
import { Loader2, Video, Database } from "lucide-react";
import { supabase } from "@/lib/supabase";

const platforms = [
  { id: "youtube", name: "YouTube", url: "https://studio.youtube.com/" },
  { id: "tiktok", name: "TikTok", url: "https://www.tiktok.com/upload" },
  { id: "instagram", name: "Instagram", url: "https://www.instagram.com/" },
  { id: "facebook", name: "Facebook", url: "https://business.facebook.com/" },
  { id: "drive", name: "Google Drive", url: "https://drive.google.com/" }
];

export default function RecorderPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [scripts, setScripts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [recordingPlatform, setRecordingPlatform] = useState<string | null>(null);
  const [editingScriptPlatform, setEditingScriptPlatform] = useState<string | null>(null);
  const [editingScriptCode, setEditingScriptCode] = useState<string>("");
  const [savingScript, setSavingScript] = useState(false);
  
  const [isAutomationEnabled, setIsAutomationEnabled] = useState(true);
  const [togglingGlobal, setTogglingGlobal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [profilesRes, scriptsRes, settingsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("automation_scripts").select("*"),
      supabase.from("system_settings").select("*").eq('key', 'global_automation_paused').single()
    ]);
    
    if (profilesRes.data) {
      setProfiles(profilesRes.data);
      if (profilesRes.data.length > 0) setSelectedProfileId(profilesRes.data[0].id);
    }
    
    if (settingsRes.data) {
      // If it's paused, enabled is false
      setIsAutomationEnabled(settingsRes.data.value !== 'true');
    }
    
    if (scriptsRes.data) {
      const scriptMap: Record<string, string> = {};
      scriptsRes.data.forEach(s => {
        scriptMap[s.platform] = s.script_code;
      });
      setScripts(scriptMap);
    }
    setLoading(false);
  }

  async function handleToggleGlobalAutomation() {
    setTogglingGlobal(true);
    const newValue = !isAutomationEnabled; // The new value for ENABLED
    const isPaused = !newValue; // The new value for PAUSED
    
    const { error } = await supabase
      .from('system_settings')
      .update({ value: String(isPaused) })
      .eq('key', 'global_automation_paused');
      
    if (!error) {
      setIsAutomationEnabled(newValue);
    } else {
      alert("Error toggling global settings: " + error.message);
    }
    setTogglingGlobal(false);
  }

  async function handleSaveScript(platformId: string) {
    setSavingScript(true);
    const { error } = await supabase
      .from("automation_scripts")
      .update({ script_code: editingScriptCode })
      .eq("platform", platformId);
      
    if (error) {
      alert("Failed to save script: " + error.message);
    } else {
      setScripts({ ...scripts, [platformId]: editingScriptCode });
      setEditingScriptPlatform(null);
    }
    setSavingScript(false);
  }

  async function handleRecord(platformId: string, defaultUrl: string) {
    if (!selectedProfileId) return alert("Select a profile first so we can inject their cookies.");
    
    setRecordingPlatform(platformId);
    let targetUrl = defaultUrl;

    if (platformId === 'drive') {
      const { data: driveFolder } = await supabase
        .from('drive_folders')
        .select('folder_url')
        .eq('profile_id', selectedProfileId)
        .eq('folder_type', 'source')
        .single();
        
      if (driveFolder && driveFolder.folder_url) {
        targetUrl = driveFolder.folder_url;
      } else {
        setRecordingPlatform(null);
        return alert("No source Google Drive folder linked for this profile. Please add one in the Drive Sync tab first.");
      }
    }
    
    try {
      const res = await fetch("http://localhost:4000/api/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platformId,
          url: targetUrl,
          profileId: selectedProfileId
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
      } else {
        alert("Error: " + data.error);
      }
    } catch (err) {
      alert("Failed to connect to Local Worker API. Ensure `node server.js` is running in the worker folder.");
    }
    
    setRecordingPlatform(null);
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <div className={`border border-surface-border backdrop-blur-md rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 ${isAutomationEnabled ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
        <div>
          <h2 className="text-xl font-bold flex items-center gap-3">
            Master Automation Switch 
            {isAutomationEnabled ? (
              <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">Active</span>
            ) : (
              <span className="bg-red-500/20 text-red-400 text-xs px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">Paused</span>
            )}
          </h2>
          <p className="text-gray-400 text-sm mt-1 max-w-lg">When paused, GitHub Actions will completely ignore all incoming cron pings. Use this to save Actions minutes when you aren't posting.</p>
        </div>
        
        <button 
          onClick={handleToggleGlobalAutomation}
          disabled={togglingGlobal}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${isAutomationEnabled ? 'bg-indigo-500' : 'bg-gray-600'} disabled:opacity-50`}
        >
          <span 
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isAutomationEnabled ? 'translate-x-7' : 'translate-x-1'}`}
          />
        </button>
      </div>

      <header>
        <h1 className="text-3xl font-bold tracking-tight">Visual Automation Recorder</h1>
        <p className="text-gray-400 mt-1">Record your manual clicks to teach the bot how to upload for each platform.</p>
      </header>

      <div className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6 mb-2">
        <label className="text-sm font-semibold text-gray-200 mb-1 block">Borrow Cookies From Profile</label>
        <p className="text-xs text-yellow-500/90 mb-3 bg-yellow-500/10 p-2 rounded-lg border border-yellow-500/20">
          <strong>Note: Automation scripts are completely GLOBAL!</strong> You only need to record the steps ONCE per platform, and the engine will automatically use that exact same script for ALL your profiles.<br/>
          This dropdown simply tells the recorder whose cookies to "borrow" so that you are already logged in when the recorder opens.
        </p>
        <select 
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
        >
          <option value="" disabled>Select a profile to borrow cookies from...</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4">
         {platforms.map(plat => (
           <div key={plat.id} className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6 flex flex-col gap-4">
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                     <Video className="w-5 h-5 text-indigo-400" /> {plat.name}
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                     {scripts[plat.id] 
                       ? <span className="text-green-400 flex items-center gap-1"><Database className="w-3 h-3"/> Script saved in database.</span> 
                       : "No automation script recorded yet."}
                  </p>
               </div>
               
               <div className="flex items-center gap-3">
                 {scripts[plat.id] && (
                   <button 
                     onClick={() => {
                       if (editingScriptPlatform === plat.id) {
                         setEditingScriptPlatform(null);
                       } else {
                         setEditingScriptPlatform(plat.id);
                         setEditingScriptCode(scripts[plat.id] || "");
                       }
                     }}
                     className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20 px-5 py-2.5 rounded-xl font-medium transition-all"
                   >
                     {editingScriptPlatform === plat.id ? "Cancel Edit" : "Edit Code"}
                   </button>
                 )}
                 <button 
                   onClick={() => handleRecord(plat.id, plat.url)}
                   disabled={recordingPlatform === plat.id || !selectedProfileId}
                   className="bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500 hover:text-white px-5 py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                 >
                   {recordingPlatform === plat.id ? (
                     <><Loader2 className="w-5 h-5 animate-spin" /> Launching...</>
                   ) : (
                     <><span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span> Record Steps</>
                   )}
                 </button>
               </div>
             </div>
             
             {editingScriptPlatform === plat.id && (
               <div className="mt-4 border-t border-surface-border pt-4 animate-in slide-in-from-top-2 duration-300">
                 <label className="text-sm text-gray-400 mb-2 flex items-center justify-between">
                   <span>Edit Automation Script</span>
                   <span className="text-xs text-indigo-400">Available vars: OMNIPOST_CAPTION, OMNIPOST_PROFILE_NAME, OMNIPOST_USERNAME</span>
                 </label>
                 <textarea 
                   value={editingScriptCode}
                   onChange={(e) => setEditingScriptCode(e.target.value)}
                   className="w-full h-64 bg-black/40 font-mono text-xs border border-surface-border rounded-xl p-4 focus:outline-none focus:border-indigo-500 transition-colors"
                 />
                 <div className="flex justify-end mt-3">
                   <button 
                     onClick={() => handleSaveScript(plat.id)}
                     disabled={savingScript}
                     className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl font-medium transition-colors flex items-center gap-2"
                   >
                     {savingScript ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
                   </button>
                 </div>
               </div>
             )}
           </div>
         ))}
      </div>
    </div>
  );
}
