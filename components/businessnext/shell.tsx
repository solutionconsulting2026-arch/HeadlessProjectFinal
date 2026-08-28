"use client";

import React from "react";
import Link from "next/link";
import { 
  Home, 
  Users, 
  FileText, 
  TrendingUp, 
  Calendar, 
  Headphones, 
  Lightbulb, 
  Settings, 
  Menu, 
  Search,
  ChevronDown,
  Bell,
  Grid,
  Network,
  HelpCircle,
  Columns,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface ShellProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  recentConversations: string[];
  onSelectRecent: (query: string) => void;
  onNewConversation: () => void;
  workspaceMode: "corporate" | "retail";
  onLogout: () => void;
}

export default function Shell({
  children,
  activeTab,
  setActiveTab,
  recentConversations,
  onSelectRecent,
  onNewConversation,
  workspaceMode,
  onLogout
}: ShellProps) {
  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "customers", label: "Customers", icon: Users },
    { id: "leads", label: "Leads", icon: FileText },
    { id: "opportunities", label: "Opportunities", icon: TrendingUp },
    { id: "activities", label: "Activities", icon: Calendar },
    { id: "service", label: "Service", icon: Headphones },
    { id: "insights", label: "Insights", icon: Lightbulb },
  ];

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F7F8FA] font-sans antialiased text-[#333333]">
      
      {/* 1. TOP NAVBAR SPANS FULL WIDTH - Styled in premium dark theme */}
      <header className="flex h-14 items-center justify-between bg-[#0B0F19] border-b border-[#1E293B]/60 px-6 shrink-0 text-white select-none z-10 font-poppins">
        {/* Left Side: Brand Logo & Hamburger */}
        <div className="flex items-center space-x-4">
          <Menu size={20} className="text-gray-400" />
          <img src="/logo-white.png" alt="BUSINESSNEXT Logo" className="h-6 w-auto object-contain" />
        </div>

        {/* Center: Accounts selector & Search pill */}
        <div className="hidden md:flex items-center space-x-4">
          {/* Search bar pill */}
          <div className="flex items-center space-x-2.5 bg-[#1A1F2E]/40 border border-gray-800/50 px-3.5 py-1.5 rounded-full w-80 font-poppins">
            <span className="text-[10px] font-bold text-gray-300 hover:text-white cursor-pointer tracking-wide uppercase">
              Accounts
            </span>
            <span className="text-gray-700">|</span>
            <input
              type="text"
              placeholder="Search Customer / CIF..."
              readOnly
              className="bg-transparent border-none text-xs text-gray-200 placeholder-gray-600 focus:outline-none w-full cursor-not-allowed"
            />
            <Search size={13} className="text-gray-500 shrink-0" />
          </div>
        </div>

        {/* Right Side: Active workspace controls, notification & user controls */}
        <div className="flex items-center space-x-4">
          {/* Active Workspace badge */}
          <span className="hidden sm:inline-block rounded bg-pink-900/40 text-[#E71A73] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border border-pink-800/50">
            {workspaceMode === "retail" ? "Retail Mode" : "Corporate Mode"}
          </span>

          {/* Action icon triggers */}
          <div className="flex items-center space-x-3 text-gray-400">
            <button type="button" className="relative p-1 hover:text-white transition-colors">
              <Bell size={18} />
              <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[#0B0F19]" />
            </button>
            <button type="button" className="p-1 hover:text-white transition-colors">
              <Grid size={18} />
            </button>
            <button type="button" className="p-1 hover:text-white transition-colors">
              <Network size={18} />
            </button>
            <button type="button" className="p-1 hover:text-white transition-colors">
              <HelpCircle size={18} />
            </button>
            <button type="button" className="p-1 hover:text-white transition-colors">
              <Columns size={18} />
            </button>
          </div>

          <span className="text-gray-800">|</span>

          {/* Sign Out Button */}
          <button
            onClick={onLogout}
            className="rounded border border-gray-800 bg-[#1A1F2E]/40 px-2.5 py-1 text-[11px] font-bold text-gray-300 hover:text-white hover:bg-[#1A1F2E] transition-all"
          >
            Sign Out
          </button>

          {/* User profile avatar circle */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-600 font-extrabold text-white text-xs ring-2 ring-pink-800/50 shadow-inner">
            AD
          </div>
        </div>
      </header>
      
      {/* 2. BODY SPLIT CONTAINER BELOW HEADER */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        
        {/* Thin icon-only Left Sidebar (no text labels, fixed width) */}
        <aside className="relative flex flex-col w-16 border-r border-[#E5E7EB] bg-white">
          <nav className="flex-1 space-y-1 px-2.5 py-6 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`flex w-full items-center justify-center rounded-lg py-2.5 transition-colors ${
                    isActive
                      ? "bg-pink-50 text-[#E71A73]"
                      : "text-[#595959] hover:bg-gray-50 hover:text-[#333333]"
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-[#E71A73]" : "text-gray-400"}`} />
                </button>
              );
            })}
          </nav>

          {/* Bottom Settings Link */}
          <div className="border-t border-[#E5E7EB] p-2.5">
            <Link
              href="/admin/integrations"
              title="Administration"
              aria-label="Administration"
              className="flex w-full items-center justify-center rounded-lg py-2 text-[#595959] hover:bg-gray-50 hover:text-[#333333] transition-colors"
            >
              <Settings className="h-5 w-5 text-gray-400 shrink-0" />
            </Link>
          </div>
        </aside>

        {/* Outer Workspace Content Canvas — scrolling is owned by the chat feed inside children */}
        <main className="flex-1 overflow-hidden p-8 relative flex flex-col min-h-0 bg-[#F7F8FA]">
          {children}
        </main>

      </div>
    </div>
  );
}
