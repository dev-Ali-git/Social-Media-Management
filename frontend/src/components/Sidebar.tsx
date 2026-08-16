"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderSync, CalendarDays, Settings, PlaySquare, Menu, X, Activity } from "lucide-react";
import clsx from "clsx";
import { supabase } from "@/lib/supabase";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Schedules", href: "/schedules", icon: CalendarDays },
  { name: "Drive Sync", href: "/drive", icon: FolderSync },
  { name: "Social Accounts", href: "/socials", icon: PlaySquare },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<"Idle / Ready" | "Running...">("Idle / Ready");

  useEffect(() => {
    checkWorkerStatus();
    const interval = setInterval(checkWorkerStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  async function checkWorkerStatus() {
    const { data } = await supabase
      .from('activity_logs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1);
      
    if (data && data.length > 0) {
      const lastActivity = new Date(data[0].created_at);
      const now = new Date();
      const diffMs = now.getTime() - lastActivity.getTime();
      // If activity within last 5 mins (300000 ms), consider it running
      if (diffMs < 300000) {
        setWorkerStatus("Running...");
        return;
      }
    }
    setWorkerStatus("Idle / Ready");
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-surface-border bg-black/40 backdrop-blur-xl shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <PlaySquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            OmniPost
          </span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-400 hover:text-white transition-colors">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Content (Desktop + Mobile Dropdown) */}
      <div className={clsx(
        "border-r border-surface-border bg-black/40 backdrop-blur-xl flex-col p-4 shrink-0 z-40",
        "md:flex md:w-64 md:h-screen", // Desktop layout
        mobileMenuOpen ? "flex absolute top-[73px] left-0 right-0 bottom-0 bg-surface md:static" : "hidden md:flex" // Mobile layout
      )}>
        <div className="hidden md:flex items-center gap-3 px-2 mb-10 mt-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <PlaySquare className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            OmniPost
          </span>
        </div>

        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                  isActive 
                    ? "bg-primary/10 text-indigo-400 font-medium" 
                    : "text-gray-400 hover:text-gray-100 hover:bg-surface"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto mb-4 md:block hidden">
           <div className="p-4 rounded-xl bg-surface border border-surface-border">
              <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Activity className="w-3 h-3"/> Worker Status</p>
              <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${workerStatus === 'Running...' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-green-500'}`}></div>
                  <span className={`text-sm font-medium ${workerStatus === 'Running...' ? 'text-amber-400' : 'text-gray-200'}`}>{workerStatus}</span>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
