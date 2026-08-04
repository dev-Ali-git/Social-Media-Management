"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderSync, CalendarDays, Settings, PlaySquare, Menu, X } from "lucide-react";
import clsx from "clsx";

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
              <p className="text-xs text-gray-400 mb-2">Worker Status</p>
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-sm font-medium">Idle / Ready</span>
              </div>
           </div>
        </div>
      </div>
    </>
  );
}
