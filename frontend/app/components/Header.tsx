"use client";
import { Search, Bell, ChevronDown, Download, RotateCcw } from "lucide-react";

export default function Header({
  onReset,
  downloadUrl,
}: {
  onReset: () => void;
  downloadUrl: string;
}) {
  return (
    <header className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome Back Admin</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          You have <span className="text-blue-500 font-medium">live</span> training updates
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden lg:flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-9 pr-16 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 w-56 transition-all"
          />
          <div className="absolute right-2.5 flex items-center gap-0.5 bg-white border border-gray-200 rounded-md px-1.5 py-0.5 text-[10px] text-gray-400 font-medium">
            ⌘ K
          </div>
        </div>

        {/* Action buttons */}
        <a
          href={downloadUrl}
          target="_blank"
          download
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
        >
          <Download className="w-4 h-4" /> Export
        </a>

        <button
          onClick={onReset}
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
        >
          <RotateCcw className="w-4 h-4" /> Reset
        </button>

        {/* Bell */}
        <button className="relative p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all shadow-sm">
          <Bell className="w-4 h-4 text-gray-500" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">2</span>
        </button>

        {/* Profile */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-200 ml-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
            A
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-gray-700 leading-tight">Admin</p>
            <p className="text-[11px] text-gray-400">Operator</p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </header>
  );
}
