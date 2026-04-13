"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search, Bell, Download, RotateCcw, User,
  LayoutDashboard, BarChart3, Server, Settings, Shield,
  Activity, HelpCircle, ArrowRight,
} from "lucide-react";

// All searchable pages — same structure as sidebar routes
const searchablePages = [
  { label: "Dashboard",     href: "/",          icon: LayoutDashboard, section: "General",  keywords: ["home", "overview", "main", "kpi", "metrics", "accuracy", "loss", "round"] },
  { label: "Analytics",     href: "/analytics",  icon: BarChart3,       section: "General",  keywords: ["charts", "graphs", "accuracy", "loss", "convergence", "audit", "node reliability"] },
  { label: "Nodes",         href: "/nodes",      icon: Server,          section: "General",  keywords: ["clients", "node", "status", "connected", "banned", "disconnect"] },
  { label: "Config",        href: "/config",     icon: Settings,        section: "General",  keywords: ["configuration", "quorum", "malicious", "dp", "fedprox", "hyperparameters", "noise"] },
  { label: "Security",      href: "/security",   icon: Shield,          section: "General",  keywords: ["verdicts", "rejections", "threat", "encryption", "tls", "key binding", "privacy"] },
  { label: "Model Export",  href: "/export",     icon: Download,        section: "Tools",    keywords: ["download", "model", "weights", "export", "save"] },
  { label: "Logs",          href: "/logs",       icon: Activity,        section: "Tools",    keywords: ["events", "terminal", "stream", "training", "activity", "log"] },
  { label: "Settings",      href: "/settings",   icon: Settings,        section: "Support",  keywords: ["platform", "connection", "infrastructure", "danger", "reset", "docker"] },
  { label: "Help Center",   href: "/help",       icon: HelpCircle,      section: "Support",  keywords: ["help", "documentation", "support", "docs", "faq"] },
];

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter results
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    return searchablePages.filter((page) => {
      if (page.label.toLowerCase().includes(q)) return true;
      if (page.href.toLowerCase().includes(q)) return true;
      return page.keywords.some((kw) => kw.includes(q));
    });
  }, [query]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateTo = (href: string) => {
    router.push(href);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === "Enter" && results.length === 0 && query.trim()) {
        // No results — do nothing
        return;
      }
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
        break;
      case "Enter":
        e.preventDefault();
        if (results[selectedIndex]) {
          navigateTo(results[selectedIndex].href);
        }
        break;
      case "Escape":
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const showDropdown = isOpen && query.trim().length > 0;

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
        {/* Search with autocomplete */}
        <div ref={containerRef} className="relative hidden lg:flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-argon-light z-10" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search pages..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className="argon-input pl-9 pr-4 py-2 w-56 text-[0.8125rem] focus:w-72 transition-all duration-300"
          />

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-argon-lg shadow-argon-lg border border-argon-lighter overflow-hidden z-50 min-w-[280px]">
              {results.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <Search className="w-5 h-5 text-argon-lighter mx-auto mb-2" />
                  <p className="text-xs font-semibold text-argon-muted">No pages found for &quot;{query}&quot;</p>
                </div>
              ) : (
                <div className="py-1.5">
                  <p className="px-3 pt-1 pb-2 text-[0.5625rem] font-bold text-argon-light uppercase tracking-widest">
                    {results.length} result{results.length !== 1 ? "s" : ""}
                  </p>
                  {results.map((page, idx) => {
                    const Icon = page.icon;
                    const isSelected = idx === selectedIndex;

                    return (
                      <button
                        key={page.href}
                        onClick={() => navigateTo(page.href)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-argon-primary/5"
                            : "hover:bg-argon-bg/50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-argon flex items-center justify-center flex-shrink-0 ${
                          isSelected ? "bg-argon-primary/10" : "bg-argon-bg"
                        }`}>
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-argon-primary" : "text-argon-muted"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${
                            isSelected ? "text-argon-primary" : "text-argon-default"
                          }`}>
                            {page.label}
                          </p>
                          <p className="text-[0.625rem] text-argon-light truncate">{page.section} · {page.href}</p>
                        </div>
                        {isSelected && (
                          <ArrowRight className="w-3.5 h-3.5 text-argon-primary flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                  <div className="px-3 pt-2 pb-1.5 border-t border-argon-lighter/60 mt-1">
                    <p className="text-[0.5625rem] text-argon-light">
                      <kbd className="px-1 py-0.5 bg-argon-bg rounded text-[0.5rem] font-mono font-bold mr-0.5">↑↓</kbd> navigate
                      <span className="mx-1.5">·</span>
                      <kbd className="px-1 py-0.5 bg-argon-bg rounded text-[0.5rem] font-mono font-bold mr-0.5">↵</kbd> open
                      <span className="mx-1.5">·</span>
                      <kbd className="px-1 py-0.5 bg-argon-bg rounded text-[0.5rem] font-mono font-bold mr-0.5">Esc</kbd> close
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <button
          onClick={async () => {
            if (!downloadUrl || downloadUrl === "#") return;
            try {
              const res = await fetch(downloadUrl);
              if (!res.ok) throw new Error("Export failed");
              const blob = await res.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "global_model.bin";
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (err) {
              console.error("Export failed:", err);
            }
          }}
          className="hidden sm:flex items-center gap-2 argon-btn argon-btn-outline text-[0.8125rem]"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>

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
