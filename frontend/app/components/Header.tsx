"use client";
import { Search, Bell, Download, RotateCcw, User } from "lucide-react";

export default function Header({
  onReset,
  downloadUrl,
  title,
}: {
  onReset: () => void;
  downloadUrl: string;
  title?: string;
}) {
  const pageTitle = title || "Dashboard";
  return (
    <header className="flex items-center justify-between mb-6">
      {/* Left: Breadcrumb + Title */}
      <div>
        <div className="flex items-center gap-1.5 text-[0.8125rem] text-argon-muted mb-1">
          <span className="hover:text-argon-primary cursor-pointer transition-colors">Pages</span>
          <span>/</span>
          <span className="text-argon-default font-semibold">{pageTitle}</span>
        </div>
        <h1 className="text-lg font-bold text-argon-default">{pageTitle}</h1>
      </div>

      {/* Right: Search + Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden lg:flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-argon-light" />
          <input
            type="text"
            placeholder="Type here..."
            className="argon-input pl-9 pr-4 py-2 w-56 text-[0.8125rem]"
          />
        </div>

        {/* Action buttons */}
        <a
          href={downloadUrl}
          target="_blank"
          download
          className="hidden sm:flex items-center gap-2 argon-btn argon-btn-outline text-[0.8125rem]"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </a>

        <button
          onClick={onReset}
          className="hidden sm:flex items-center gap-2 argon-btn bg-argon-danger/10 text-argon-danger hover:bg-argon-danger hover:text-white text-[0.8125rem] border-0 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>

        {/* Sign In */}
        <button className="flex items-center gap-2 text-argon-muted hover:text-argon-default transition-colors text-[0.8125rem] font-semibold">
          <User className="w-4 h-4" />
          <span className="hidden md:inline">Sign In</span>
        </button>

        {/* Bell */}
        <button className="relative p-2 text-argon-muted hover:text-argon-default transition-colors">
          <Bell className="w-4.5 h-4.5" />
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-argon-danger rounded-full text-[9px] text-white font-bold flex items-center justify-center">2</span>
        </button>

        {/* Settings icon */}
        <button className="p-2 text-argon-muted hover:text-argon-default transition-colors">
          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
