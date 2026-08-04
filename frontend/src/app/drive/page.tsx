"use client";

import { useState, useEffect } from "react";
import { FolderPlus, HardDrive, Link as LinkIcon, Plus, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function DrivePage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [driveLinks, setDriveLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [newFolderUrl, setNewFolderUrl] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [profilesRes, drivesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("drive_folders").select("*, profiles(name)").order("created_at", { ascending: false })
    ]);
    
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (drivesRes.data) setDriveLinks(drivesRes.data);
    
    if (profilesRes.data && profilesRes.data.length > 0 && !selectedProfileId) {
      setSelectedProfileId(profilesRes.data[0].id);
    }
    setLoading(false);
  }

  async function handleAddDriveFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfileId || !newFolderUrl) return;

    const { data, error } = await supabase.from("drive_folders").insert([{
      profile_id: selectedProfileId,
      folder_url: newFolderUrl,
      folder_type: 'source'
    }]).select("*, profiles(name)");

    if (data) {
      setNewFolderUrl("");
      setDriveLinks([data[0], ...driveLinks]);
    }
  }

  async function handleRemoveDriveFolder(id: string) {
    if (!confirm("Are you sure you want to remove this folder link?")) return;
    
    const { error } = await supabase.from("drive_folders").delete().eq("id", id);
    if (!error) {
      setDriveLinks(driveLinks.filter(l => l.id !== id));
    } else {
      alert("Error removing folder: " + error.message);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Drive Sync</h1>
        <p className="text-gray-400 mt-1">Connect Google Drive folders to your creator profiles.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Link Folder */}
        <div className="md:col-span-2 border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 blur-2xl -mr-10 -mt-10"></div>
          
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 relative z-10">
            <LinkIcon className="w-5 h-5 text-purple-400" /> Link Drive Folder
          </h2>
          
          <form onSubmit={handleAddDriveFolder} className="flex flex-col gap-4 relative z-10">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Select Profile</label>
              <select 
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
              >
                <option value="" disabled>Select a profile...</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <div>
                <label className="text-sm text-gray-400 mb-1 block">Drive Link</label>
                <input 
                  type="url" 
                  required
                  value={newFolderUrl}
                  onChange={(e) => setNewFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <button 
              disabled={!selectedProfileId || !newFolderUrl}
              className="bg-white/10 hover:bg-white/20 border border-surface-border text-white px-4 py-2.5 rounded-xl font-medium transition-colors mt-2"
            >
              Add Folder Link
            </button>
          </form>
        </div>
      </div>

      <div className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6">
         <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-gray-400" /> Linked Folders
         </h2>
         
         <div className="space-y-3">
           {driveLinks.length === 0 ? (
             <p className="text-gray-500 text-center py-8">No folders linked yet.</p>
           ) : (
             driveLinks.map(link => (
               <div key={link.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-black/20 border border-surface-border gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-indigo-500/20">
                      <FolderPlus className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                      <p className="font-medium">{link.profiles?.name || 'Unknown Profile'}</p>
                      <p className="text-sm text-gray-400">
                        Source Folder: 
                        <a href={link.folder_url} target="_blank" className="text-indigo-400 hover:underline inline-block max-w-[200px] sm:max-w-xs truncate align-bottom ml-1">
                           {link.folder_url}
                        </a>
                      </p>
                    </div>
                 </div>
                 <button 
                   onClick={() => handleRemoveDriveFolder(link.id)}
                   className="text-sm text-red-400 hover:text-red-300 self-start sm:self-center px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                 >
                    Remove
                 </button>
               </div>
             ))
           )}
         </div>
      </div>
    </div>
  );
}
