"use client";

import { useState, useEffect } from "react";
import { Loader2, KeyRound, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SocialsPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [socialAccounts, setSocialAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [platform, setPlatform] = useState("youtube");
  const [username, setUsername] = useState("");
  const [sessionCookies, setSessionCookies] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedProfileId) {
      fetchSocialAccounts();
    }
  }, [selectedProfileId]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) setProfiles(data);
    if (data && data.length > 0) setSelectedProfileId(data[0].id);
    setLoading(false);
  }

  async function fetchSocialAccounts() {
    const { data } = await supabase.from("social_accounts").select("*").eq("profile_id", selectedProfileId);
    if (data) setSocialAccounts(data);
  }

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfileId || !sessionCookies) return;
    
    setSaving(true);
    let parsedCookies;
    try {
      parsedCookies = JSON.parse(sessionCookies);
    } catch (e) {
      alert("Invalid JSON format for cookies. Please paste the raw JSON array from your extension.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase.from("social_accounts").insert([{
      profile_id: selectedProfileId,
      platform,
      username,
      session_cookies: parsedCookies
    }]).select();

    setSaving(false);
    
    if (data) {
      setSocialAccounts([...socialAccounts, data[0]]);
      setUsername("");
      setSessionCookies("");
    } else {
      alert("Error adding account: " + error?.message);
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Are you sure you want to delete these cookies?")) return;
    
    const { error } = await supabase.from("social_accounts").delete().eq("id", id);
    if (!error) {
      setSocialAccounts(socialAccounts.filter(a => a.id !== id));
    } else {
      alert("Error deleting account: " + error.message);
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from("social_accounts")
      .update({ is_active: !currentStatus })
      .eq("id", id);
      
    if (!error) {
      setSocialAccounts(socialAccounts.map(a => a.id === id ? { ...a, is_active: !currentStatus } : a));
    } else {
      alert("Error updating account: " + error.message);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Social Accounts</h1>
        <p className="text-gray-400 mt-1">Connect your social media accounts securely using Session Cookies to bypass bot detection.</p>
      </header>

      <div className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6">
         <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
           <Plus className="w-5 h-5 text-indigo-400" /> Add Account
         </h2>
         <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-4">
             <div>
               <label className="text-sm text-gray-400 mb-1 block">Creator Profile</label>
               <select 
                 value={selectedProfileId}
                 onChange={(e) => setSelectedProfileId(e.target.value)}
                 className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
               >
                 <option value="" disabled>Select profile...</option>
                 {profiles.map(p => (
                   <option key={p.id} value={p.id}>{p.name}</option>
                 ))}
               </select>
             </div>
             
             <div>
               <label className="text-sm text-gray-400 mb-1 block">Platform</label>
               <select 
                 value={platform}
                 onChange={(e) => setPlatform(e.target.value)}
                 className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors appearance-none capitalize"
               >
                 <option value="youtube">YouTube</option>
                 <option value="tiktok">TikTok</option>
                 <option value="instagram">Instagram</option>
                 <option value="facebook">Facebook</option>
               </select>
             </div>
             
             <div>
               <label className="text-sm text-gray-400 mb-1 block">Account Username (Optional)</label>
               <input 
                 type="text" 
                 value={username}
                 onChange={(e) => setUsername(e.target.value)}
                 placeholder="e.g. @mrbeast"
                 className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
               />
             </div>
           </div>
           
           <div className="space-y-4 flex flex-col">
             <div className="flex-1 flex flex-col">
               <label className="text-sm text-gray-400 mb-1 flex items-center gap-2">
                 <KeyRound className="w-4 h-4"/> Session Cookies (JSON)
               </label>
               <p className="text-xs text-gray-500 mb-2">Paste the JSON array exported from EditThisCookie or similar extensions.</p>
               <textarea 
                 required
                 value={sessionCookies}
                 onChange={(e) => setSessionCookies(e.target.value)}
                 placeholder='[{"name": "sessionid", "value": "123..."}, ...]'
                 className="flex-1 w-full bg-black/20 font-mono text-xs border border-surface-border rounded-xl p-4 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
               />
             </div>
             
             <button 
                type="submit"
                disabled={saving || !selectedProfileId || !sessionCookies}
                className="bg-primary hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 mt-auto"
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Account"}
             </button>
           </div>
         </form>
      </div>

      <div className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6">
         <h2 className="text-xl font-semibold mb-6">Connected Accounts for Profile</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {socialAccounts.length === 0 ? (
             <p className="text-gray-500">No accounts connected yet.</p>
           ) : (
             socialAccounts.map(account => (
               <div key={account.id} className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-surface-border">
                 <div>
                   <p className="font-medium capitalize text-lg">{account.platform}</p>
                   <p className="text-sm text-gray-400">{account.username || 'No username provided'}</p>
                 </div>
                 <div className="flex items-center gap-3">
                   <button 
                     onClick={() => handleToggleActive(account.id, account.is_active)}
                     className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 ${account.is_active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'}`}
                     title={account.is_active ? "Click to disable" : "Click to enable"}
                   >
                     {account.is_active ? 'Enabled' : 'Disabled'}
                   </button>
                   <button 
                     onClick={() => handleDeleteAccount(account.id)}
                     className="text-red-500/70 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 p-2 rounded-lg transition-all"
                     title="Delete Cookies"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                 </div>
               </div>
             ))
           )}
         </div>
      </div>
    </div>
  );
}
