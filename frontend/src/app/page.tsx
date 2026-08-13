"use client";

import { useState, useEffect } from "react";
import { ArrowUpRight, CheckCircle2, Clock, XCircle, FileVideo, HardDrive, Loader2, Power, AlertCircle, Info, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, month: 0, errors: 0 });
  const [loading, setLoading] = useState(true);

  const [newProfileName, setNewProfileName] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const [showVideoHistory, setShowVideoHistory] = useState(false);
  const [videoHistory, setVideoHistory] = useState<[string, any][]>([]);

  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (selectedProfile) {
      fetchLogs(selectedProfile.id);
      fetchVideoHistory(selectedProfile.id);
    }
  }, [selectedProfile]);

  async function fetchProfiles() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setProfiles(data);
      if (!selectedProfile) setSelectedProfile(data[0]);
    }
    setLoading(false);
  }

  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!newProfileName) return;
    
    setIsCreatingProfile(true);
    const { data, error } = await supabase.from("profiles").insert([{ name: newProfileName }]).select();
    setIsCreatingProfile(false);
    
    if (data) {
      setNewProfileName("");
      setProfiles([data[0], ...profiles]);
      setSelectedProfile(data[0]);
    } else if (error) {
      alert("Error creating profile: " + error.message);
    }
  }

  async function fetchLogs(profileId: string) {
    const { data: allLogs } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false })
      .limit(50);
      
    if (allLogs) {
      setLogs(allLogs);
      const errors = allLogs.filter(l => l.status === 'error').length;
      
      setStats(prev => ({ ...prev, errors }));
    }
  }

  async function fetchVideoHistory(profileId: string) {
    const { data } = await supabase
      .from("video_uploads")
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    
    if (data) {
      const grouped = data.reduce((acc: any, curr: any) => {
        if (!acc[curr.file_name]) acc[curr.file_name] = {};
        acc[curr.file_name][curr.platform] = { status: curr.status, error: curr.error_message, date: curr.created_at };
        return acc;
      }, {});
      setVideoHistory(Object.entries(grouped));
      
      // Calculate Total and Month based on unique videos (must have at least one success)
      let uniqueTotal = 0;
      let uniqueMonth = 0;
      const now = new Date();
      
      Object.values(grouped).forEach((platforms: any) => {
          let isSuccess = false;
          let latestSuccessDate: Date | null = null;
          
          for (const p of Object.values(platforms) as any[]) {
              if (p.status === 'success') {
                  isSuccess = true;
                  const pd = new Date(p.date);
                  if (!latestSuccessDate || pd > latestSuccessDate) {
                      latestSuccessDate = pd;
                  }
              }
          }
          
          if (isSuccess && latestSuccessDate) {
              uniqueTotal++;
              if (latestSuccessDate.getMonth() === now.getMonth() && latestSuccessDate.getFullYear() === now.getFullYear()) {
                  uniqueMonth++;
              }
          }
      });
      
      setStats(prev => ({ ...prev, total: uniqueTotal, month: uniqueMonth }));
    }
  }

  async function deleteVideoHistoryRecord(fileName: string) {
    if (!selectedProfile) return;
    if (!confirm(`Are you sure you want to delete history for "${fileName}"?`)) return;
    
    const { error } = await supabase
      .from("video_uploads")
      .delete()
      .eq("profile_id", selectedProfile.id)
      .eq("file_name", fileName);
      
    if (!error) {
      setVideoHistory(videoHistory.filter(([name]) => name !== fileName));
    } else {
      alert("Error deleting record: " + error.message);
    }
  }

  async function toggleAutomation() {
    if (!selectedProfile) return;
    const newState = !selectedProfile.is_active;
    
    // Optimistic UI update
    setSelectedProfile({ ...selectedProfile, is_active: newState });
    setProfiles(profiles.map(p => p.id === selectedProfile.id ? { ...p, is_active: newState } : p));
    
    await supabase.from("profiles").update({ is_active: newState }).eq("id", selectedProfile.id);
  }

  async function saveProfileName() {
    if (!selectedProfile || !editNameValue.trim()) return;
    const newName = editNameValue.trim();
    
    // Optimistic UI update
    setSelectedProfile({ ...selectedProfile, name: newName });
    setProfiles(profiles.map(p => p.id === selectedProfile.id ? { ...p, name: newName } : p));
    setIsEditingName(false);
    
    const { error } = await supabase.from("profiles").update({ name: newName }).eq("id", selectedProfile.id);
    if (error) {
      alert("Error saving profile name: " + error.message);
      fetchProfiles();
    }
  }

  async function deleteProfile() {
    if (!selectedProfile) return;
    if (!confirm(`Are you sure you want to completely delete "${selectedProfile.name}"? All associated data (rules, logs) will be removed. This cannot be undone.`)) return;
    
    // Optimistic UI update
    const remaining = profiles.filter(p => p.id !== selectedProfile.id);
    setProfiles(remaining);
    setSelectedProfile(remaining.length > 0 ? remaining[0] : null);
    
    const { error } = await supabase.from("profiles").delete().eq("id", selectedProfile.id);
    if (error) {
       alert("Error deleting profile: " + error.message);
       // Revert on error
       fetchProfiles();
    }
  }

  async function clearLogs() {
    if (!selectedProfile) return;
    if (!confirm("Are you sure you want to clear all logs for this profile?")) return;
    await supabase.from("activity_logs").delete().eq("profile_id", selectedProfile.id);
    setLogs([]);
    setStats({ total: 0, month: 0, errors: 0 });
  }

  if (loading && profiles.length === 0) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Overview Dashboard</h1>
          <p className="text-gray-400 mt-1">Monitor real-time automated video uploads and logs.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Profile Sidebar */}
        <div className="lg:col-span-1 border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-4 flex flex-col gap-2">
          <h2 className="text-lg font-semibold px-2 mb-2 text-gray-200">Your Profiles</h2>
          <div className="flex-1 overflow-y-auto max-h-[300px] lg:max-h-[500px] flex flex-col gap-2">
            {profiles.length === 0 ? (
              <p className="text-sm text-gray-500 px-2">No profiles found.</p>
            ) : (
              profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfile(p)}
                  className={`text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group flex-shrink-0 ${
                    selectedProfile?.id === p.id 
                      ? 'bg-indigo-500/10 border-indigo-500/30 border text-white' 
                      : 'border-transparent border hover:bg-white/5 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="font-medium truncate pr-2">{p.name}</span>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.is_active !== false ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500/50'}`} />
                </button>
              ))
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-surface-border">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 px-2">Create New Profile</h3>
            <form onSubmit={handleCreateProfile} className="flex flex-col gap-2">
              <input 
                type="text" 
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                placeholder="Profile Name..."
                className="w-full bg-black/20 border border-surface-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button 
                disabled={isCreatingProfile || !newProfileName}
                className="bg-primary hover:bg-indigo-500 disabled:opacity-50 text-white w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
              >
                {isCreatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </button>
            </form>
          </div>
        </div>

        {/* Profile Data */}
        {selectedProfile && (
          <div className="lg:col-span-3 flex flex-col gap-6">
            
            <div className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/5 to-purple-500/10 blur-3xl rounded-full pointer-events-none"></div>
               <div className="relative z-10 w-full sm:w-auto">
                 {isEditingName ? (
                   <div className="flex items-center gap-2">
                     <input 
                       type="text" 
                       value={editNameValue}
                       onChange={(e) => setEditNameValue(e.target.value)}
                       className="bg-black/40 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-xl font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors"
                       autoFocus
                     />
                     <button 
                       onClick={saveProfileName}
                       className="text-green-400 bg-green-500/10 hover:bg-green-500/20 p-2 rounded-lg transition-colors"
                       title="Save Name"
                     >
                       <CheckCircle2 className="w-5 h-5" />
                     </button>
                     <button 
                       onClick={() => setIsEditingName(false)}
                       className="text-gray-400 bg-gray-500/10 hover:bg-gray-500/20 p-2 rounded-lg transition-colors"
                       title="Cancel"
                     >
                       <XCircle className="w-5 h-5" />
                     </button>
                   </div>
                 ) : (
                   <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                     {selectedProfile.name}
                     <button 
                       onClick={() => {
                         setEditNameValue(selectedProfile.name);
                         setIsEditingName(true);
                       }}
                       className="text-gray-500 hover:text-indigo-400 transition-colors"
                       title="Edit Profile Name"
                     >
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                     </button>
                   </h2>
                 )}
                 <p className="text-sm text-gray-400 mt-1">Profile Overview & Engine Status</p>
               </div>
               
               <div className="flex items-center gap-3 relative z-10">
                 <button 
                   onClick={() => setShowVideoHistory(true)}
                   className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20"
                   title="Video History"
                 >
                   <FileVideo className="w-4 h-4" />
                   <span className="hidden sm:inline">History</span>
                 </button>
                 
                 <button 
                   onClick={deleteProfile}
                   className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                   title="Delete Profile"
                 >
                   <Trash2 className="w-4 h-4" />
                   <span className="hidden sm:inline">Delete</span>
                 </button>
                 
                 <button 
                   onClick={toggleAutomation}
                   className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
                     selectedProfile.is_active !== false 
                       ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20' 
                       : 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'
                   }`}
                 >
                   <Power className="w-5 h-5" />
                   {selectedProfile.is_active !== false ? 'Pause Automation' : 'Resume Automation'}
                 </button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total Videos Uploaded" value={stats.total} trend="All time" icon={FileVideo} color="text-indigo-400" />
              <StatCard title="Uploaded This Month" value={stats.month} trend="Last 30 days" icon={ArrowUpRight} color="text-green-400" />
              <StatCard title="Failed / Errored Jobs" value={stats.errors} trend="Requires attention" icon={XCircle} color="text-red-400" />
            </div>

            <div className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6 flex flex-col flex-1 min-h-[400px]">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-semibold flex items-center gap-2">
                   <Clock className="w-5 h-5 text-indigo-400" /> Recent Engine Activity
                 </h2>
                 <button onClick={clearLogs} className="text-sm text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                    <Trash2 className="w-4 h-4"/> Clear Logs
                 </button>
              </div>
              
              <div className="space-y-3 flex-1 overflow-y-auto pr-2 max-h-[500px]">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                     <HardDrive className="w-8 h-8 mb-2 opacity-50" />
                     <p>No engine activity logged yet.</p>
                     <p className="text-xs mt-1">Start the worker (node index.js) to see live logs here.</p>
                  </div>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between p-4 rounded-xl bg-black/20 border border-surface-border group">
                      <div className="flex items-start gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                          log.status === 'success' ? 'bg-green-500/10 text-green-500' :
                          log.status === 'error' ? 'bg-red-500/10 text-red-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {log.status === 'success' && <CheckCircle2 className="w-4 h-4" />}
                          {log.status === 'error' && <XCircle className="w-4 h-4" />}
                          {log.status === 'info' && <Info className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-200">
                            {log.platform.toUpperCase()}
                          </p>
                          <p className={`text-sm mt-0.5 ${log.status === 'error' ? 'text-red-300/80' : 'text-gray-400'}`}>
                             {log.message}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 whitespace-nowrap mt-1">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}
      </div>

      {showVideoHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface border border-surface-border w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-surface-border flex justify-between items-center bg-black/20">
              <h2 className="text-2xl font-bold flex items-center gap-2"><FileVideo className="w-6 h-6 text-indigo-400" /> Video Tracking History</h2>
              <button onClick={() => setShowVideoHistory(false)} className="text-gray-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-black/10">
              {videoHistory.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No videos processed yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-surface-border">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/40 border-b border-surface-border">
                        <th className="p-4 font-semibold text-gray-300">File Name</th>
                        <th className="p-4 font-semibold text-gray-300">TikTok</th>
                        <th className="p-4 font-semibold text-gray-300">Instagram</th>
                        <th className="p-4 font-semibold text-gray-300">Facebook</th>
                        <th className="p-4 font-semibold text-gray-300">YouTube</th>
                        <th className="p-4 font-semibold text-gray-300 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border">
                      {videoHistory.map(([fileName, platforms]) => (
                        <tr key={fileName} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-medium text-gray-200">{fileName}</td>
                          {['tiktok', 'instagram', 'facebook', 'youtube'].map(plat => {
                            const info = platforms[plat];
                            if (!info) return <td key={plat} className="p-4 text-gray-600">—</td>;
                            if (info.status === 'success') return <td key={plat} className="p-4 text-green-400" title={`Uploaded at ${new Date(info.date).toLocaleString()}`}><CheckCircle2 className="w-5 h-5 inline mr-1"/> Success</td>;
                            if (info.status === 'failed') return <td key={plat} className="p-4 text-red-400 group relative cursor-help"><XCircle className="w-5 h-5 inline mr-1"/> Failed<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 p-2 bg-red-950/90 text-red-200 text-xs rounded border border-red-900 z-10 whitespace-normal">{info.error || 'Unknown error'}</div></td>;
                            return <td key={plat} className="p-4 text-gray-400">{info.status}</td>;
                          })}
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => deleteVideoHistoryRecord(fileName)}
                              className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, trend, icon: Icon, color = "text-indigo-400" }: any) {
  return (
    <div className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden group">
      <div className="flex items-center justify-between">
        <h3 className="text-gray-400 font-medium text-sm">{title}</h3>
        <div className={`p-2 rounded-lg bg-black/30 ${color}`}><Icon className="w-4 h-4" /></div>
      </div>
      <div>
        <p className="text-4xl font-bold">{value}</p>
        <p className="text-xs text-gray-500 mt-2 font-medium uppercase tracking-wider">{trend}</p>
      </div>
    </div>
  );
}
