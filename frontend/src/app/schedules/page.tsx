"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Save, CalendarClock, Hash, Clock, ChevronDown, Check, Zap, Globe } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function SchedulesPage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("youtube");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingMode, setApplyingMode] = useState(false);
  
  const [captionTemplate, setCaptionTemplate] = useState("Check out this video! {hashtags}");
  const [hashtags, setHashtags] = useState("");
  const [youtubeDescription, setYoutubeDescription] = useState("");
  const [maxVideos, setMaxVideos] = useState(1);
  
  // New State for UI
  const [isScheduled, setIsScheduled] = useState(false);
  const [timeSlots, setTimeSlots] = useState<{time: string}[]>([]);
  
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Generate 30-min intervals for a full day
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hours = Math.floor(i / 2).toString().padStart(2, "0");
    const mins = i % 2 === 0 ? "00" : "30";
    return `${hours}:${mins}`;
  });

  useEffect(() => {
    fetchProfiles();
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedProfileId && selectedPlatform) {
      fetchRule();
    }
  }, [selectedProfileId, selectedPlatform]);

  async function fetchProfiles() {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) setProfiles(data);
    if (data && data.length > 0) setSelectedProfileId(data[0].id);
    setLoading(false);
  }

  async function fetchRule() {
    const { data } = await supabase
      .from("publishing_rules")
      .select("*")
      .eq("profile_id", selectedProfileId)
      .eq("platform", selectedPlatform)
      .single();
      
    if (data) {
      setCaptionTemplate(data.caption_template || "");
      setHashtags(data.hashtags || "");
      setYoutubeDescription(data.youtube_description || "");
      setMaxVideos(data.max_videos_per_day || 1);
      
      let parsedTimes: {date: string, time: string}[] = [];
      try {
        if (Array.isArray(data.time_slots)) {
          if (data.time_slots.length > 0 && typeof data.time_slots[0] === 'string') {
              // Convert old string format to new object format
              const today = new Date().toISOString().split('T')[0];
              parsedTimes = data.time_slots.map((t: string) => ({ date: today, time: t }));
          } else {
              parsedTimes = data.time_slots;
          }
        }
      } catch (e) {}
      
      setTimeSlots(parsedTimes);
      setIsScheduled(parsedTimes.length > 0);
    } else {
      // Defaults
      setCaptionTemplate("");
      setHashtags("");
      setYoutubeDescription("");
      setMaxVideos(1);
      setTimeSlots([]);
      setIsScheduled(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProfileId) return;
    
    setSaving(true);
    // If not scheduled, we save an empty array to indicate "Post Immediately"
    const finalTimeSlots = isScheduled ? timeSlots : [];
    
    const { error } = await supabase
      .from("publishing_rules")
      .upsert({
        profile_id: selectedProfileId,
        platform: selectedPlatform,
        caption_template: captionTemplate,
        hashtags: hashtags,
        youtube_description: selectedPlatform === 'youtube' ? youtubeDescription : null,
        max_videos_per_day: maxVideos,
        time_slots: finalTimeSlots
      }, { onConflict: "profile_id,platform" });
      
    setSaving(false);
    if (!error) {
       alert("Saved successfully!");
    } else {
       alert("Error saving: " + error.message);
    }
  }

  async function handleApplyModeToAll() {
    if (!confirm(`Apply the current ${isScheduled ? 'Scheduled' : 'Immediate'} mode (and time slots) to ALL profiles for ${selectedPlatform}?`)) return;
    
    setApplyingMode(true);
    const finalTimeSlots = isScheduled ? timeSlots : [];
    
    const { data: existingRules } = await supabase
        .from('publishing_rules')
        .select('*')
        .eq('platform', selectedPlatform);
        
    const upserts = profiles.map(p => {
        const existing = existingRules?.find(r => r.profile_id === p.id);
        return {
            profile_id: p.id,
            platform: selectedPlatform,
            caption_template: existing?.caption_template || "",
            hashtags: existing?.hashtags || "",
            youtube_description: existing?.youtube_description || null,
            max_videos_per_day: existing?.max_videos_per_day || 1,
            time_slots: finalTimeSlots
        };
    });
    
    const { error } = await supabase.from('publishing_rules').upsert(upserts, { onConflict: 'profile_id,platform' });
    setApplyingMode(false);
    
    if (error) {
        alert("Error applying to all profiles: " + error.message);
    } else {
        alert(`Successfully applied publishing mode to all profiles for ${selectedPlatform}!`);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Publishing Rules</h1>
        <p className="text-gray-400 mt-1">Configure captions, hashtags, and drip schedules per platform.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-4">
           <div>
             <label className="text-sm text-gray-400 mb-1 block">Creator Profile</label>
             <select 
               value={selectedProfileId}
               onChange={(e) => setSelectedProfileId(e.target.value)}
               className="w-full bg-surface border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
             >
               <option value="" disabled>Select profile...</option>
               {profiles.map(p => (
                 <option key={p.id} value={p.id}>{p.name}</option>
               ))}
             </select>
           </div>
           
           <div>
             <label className="text-sm text-gray-400 mb-1 block">Platform</label>
             <div className="flex flex-col gap-2 mt-2">
               {["youtube", "tiktok", "instagram", "facebook"].map(plat => (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setSelectedPlatform(plat)}
                    className={`px-4 py-3 rounded-xl text-left capitalize font-medium transition-all ${
                      selectedPlatform === plat 
                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                        : "bg-surface border border-surface-border text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {plat}
                  </button>
               ))}
             </div>
           </div>
        </div>
        
        <div className="md:col-span-3">
           <form onSubmit={handleSave} className="border border-surface-border bg-surface backdrop-blur-md rounded-2xl p-6 flex flex-col gap-6">
             <div className="flex items-center gap-2 mb-2">
               <CalendarClock className="w-5 h-5 text-indigo-400" />
               <h2 className="text-xl font-semibold capitalize">{selectedPlatform} Settings</h2>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="text-sm text-gray-400 mb-1 block">
                     {selectedPlatform === 'youtube' ? 'Video Title Template' : 'Caption Template'}
                   </label>
                   <p className="text-xs text-gray-500 mb-2">Variables: {'{filename}'}, {'{hashtags}'}</p>
                   <textarea 
                     value={captionTemplate}
                     onChange={(e) => setCaptionTemplate(e.target.value)}
                     rows={4}
                     className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                   />
                </div>
                
                {selectedPlatform === 'youtube' && (
                 <div className="md:col-span-2">
                    <label className="text-sm text-gray-400 mb-1 block">Description Template</label>
                    <p className="text-xs text-gray-500 mb-2">Variables: {'{filename}'}, {'{hashtags}'}</p>
                    <textarea 
                      value={youtubeDescription}
                      onChange={(e) => setYoutubeDescription(e.target.value)}
                      rows={6}
                      className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                    />
                 </div>
                 )}

                <div>
                   <label className="text-sm text-gray-400 mb-1 flex items-center gap-1"><Hash className="w-4 h-4"/> Default Hashtags</label>
                   <p className="text-xs text-gray-500 mb-2">Appended via {'{hashtags}'} variable</p>
                   <textarea 
                     value={hashtags}
                     onChange={(e) => setHashtags(e.target.value)}
                     rows={4}
                     className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                   />
                </div>
             </div>
             
             <div className="border-t border-surface-border pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className="text-sm text-gray-400 mb-1 block">Max Videos Per Day</label>
                   <p className="text-xs text-gray-500 mb-2">Limits the bot from spamming uploads.</p>
                   <input 
                     type="number" 
                     min={1} max={10}
                     value={maxVideos}
                     onChange={(e) => setMaxVideos(parseInt(e.target.value))}
                     className="w-full bg-black/20 border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors"
                   />
                </div>
                
                 <div>
                   <div className="flex items-center justify-between mb-1">
                     <label className="text-sm text-gray-400 block">Publishing Mode</label>
                     <button 
                        type="button" 
                        onClick={handleApplyModeToAll} 
                        disabled={applyingMode}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded-md"
                     >
                        {applyingMode ? <Loader2 className="w-3 h-3 animate-spin"/> : <Globe className="w-3 h-3"/>}
                        Apply to All Profiles
                     </button>
                   </div>
                   <p className="text-xs text-gray-500 mb-2">Post immediately or schedule each video individually.</p>
                   
                   <div className="flex bg-black/20 p-1 rounded-xl mb-4 border border-surface-border">
                     <button
                       type="button"
                       onClick={() => setIsScheduled(false)}
                       className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${!isScheduled ? 'bg-indigo-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                     >
                       <Zap className="w-4 h-4" /> Immediate
                     </button>
                     <button
                       type="button"
                       onClick={() => setIsScheduled(true)}
                       className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-colors ${isScheduled ? 'bg-indigo-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                     >
                       <Clock className="w-4 h-4" /> Schedule
                     </button>
                   </div>
                   
                   {isScheduled && (
                     <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        {Array.from({ length: maxVideos }).map((_, i) => (
                           <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-black/20 border border-surface-border rounded-xl px-4 py-3">
                              <span className="text-sm font-medium text-indigo-300 w-16">Video {i + 1}</span>
                              <div className="flex flex-1 gap-2 w-full">
                                <input 
                                  type="time"
                                  value={timeSlots[i]?.time || ''}
                                  onChange={(e) => {
                                    const newSlots = [...timeSlots];
                                    if (!newSlots[i]) newSlots[i] = { time: '' };
                                    newSlots[i].time = e.target.value;
                                    setTimeSlots(newSlots);
                                  }}
                                  className="w-full bg-surface border border-surface-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors text-sm text-gray-200"
                                />
                              </div>
                           </div>
                        ))}
                     </div>
                   )}
                 </div>
              </div>

             <div className="flex justify-end pt-4">
                <button 
                  type="submit"
                  disabled={saving || !selectedProfileId}
                  className="bg-primary hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
                  Save Rules
                </button>
             </div>
           </form>
        </div>
      </div>
    </div>
  );
}
