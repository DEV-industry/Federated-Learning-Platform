"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { Terminal, Search, ArrowDown, X, Filter } from "lucide-react";

interface Props {
  eventLogs: string[];
}

type LogCategory = "all" | "download" | "training" | "upload" | "idle" | "evaluate" | "other";

const categoryConfig: Record<LogCategory, { label: string; color: string; dotColor: string; match: (msg: string) => boolean }> = {
  all:      { label: "All",        color: "",                   dotColor: "bg-argon-primary",  match: () => true },
  download: { label: "Download",   color: "text-[#11cdef]",     dotColor: "bg-[#11cdef]",      match: (m) => /download/i.test(m) },
  training: { label: "Training",   color: "text-[#825ee4]",     dotColor: "bg-[#825ee4]",      match: (m) => /train/i.test(m) },
  upload:   { label: "Upload",     color: "text-[#2dce89]",     dotColor: "bg-[#2dce89]",      match: (m) => /upload/i.test(m) },
  idle:     { label: "Idle",       color: "text-argon-muted",   dotColor: "bg-argon-light",    match: (m) => /idle/i.test(m) },
  evaluate: { label: "Evaluation", color: "text-[#fb6340]",     dotColor: "bg-[#fb6340]",      match: (m) => /evaluat/i.test(m) },
  other:    { label: "Other",      color: "text-argon-default", dotColor: "bg-argon-muted",    match: () => true },
};

function classifyLog(message: string): LogCategory {
  const categories: LogCategory[] = ["download", "training", "upload", "idle", "evaluate"];
  for (const cat of categories) {
    if (categoryConfig[cat].match(message)) return cat;
  }
  return "other";
}

export default function LiveLogTerminal({ eventLogs }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<LogCategory>("all");
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Parse logs
  const parsedLogs = useMemo(() => {
    return eventLogs.map((log, idx) => {
      const match = log.match(/^\[([^\]]+)\]\s*(.*)/);
      const timestamp = match ? match[1] : "";
      const rawMessage = match ? match[2] : log;
      // Strip leading non-alphanumeric (emoji symbols)
      const message = rawMessage.replace(/^\s+/, "").replace(/^[^A-Za-z0-9]+/, "");
      const category = classifyLog(rawMessage);
      return { id: idx, timestamp, rawMessage, message, category, raw: log };
    });
  }, [eventLogs]);

  // Apply filters & search
  const filteredLogs = useMemo(() => {
    return parsedLogs.filter((log) => {
      if (activeFilter !== "all" && log.category !== activeFilter) return false;
      if (search && !log.message.toLowerCase().includes(search.toLowerCase()) && !log.timestamp.includes(search)) return false;
      return true;
    });
  }, [parsedLogs, activeFilter, search]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isAutoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, isAutoScroll]);

  // Detect scroll position
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    setIsAutoScroll(atBottom);
    setShowScrollBtn(!atBottom);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsAutoScroll(true);
      setShowScrollBtn(false);
    }
  };

  const filterCategories: LogCategory[] = ["all", "download", "training", "upload", "idle", "evaluate", "other"];

  return (
    <div className="argon-card overflow-hidden">
      {/* Header */}
      <div className="argon-card-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-argon bg-gradient-to-br from-argon-default to-[#344767] flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-argon-default">Live Event Stream</span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="w-2 h-2 rounded-full bg-argon-success animate-pulse" />
            <span className="text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Live</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-3 text-argon-light" />
          <input
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="argon-input pl-9 pr-8 py-1.5 w-full sm:w-64 text-[0.8125rem]"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 text-argon-light hover:text-argon-muted transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-6 py-3 border-b border-argon-lighter bg-argon-bg/30 flex items-center gap-2 overflow-x-auto">
        <Filter className="w-3.5 h-3.5 text-argon-light flex-shrink-0" />
        {filterCategories.map((cat) => {
          const cfg = categoryConfig[cat];
          const isActive = activeFilter === cat;
          const count = cat === "all"
            ? parsedLogs.length
            : parsedLogs.filter((l) => l.category === cat).length;

          return (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.6875rem] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                isActive
                  ? "bg-argon-primary text-white shadow-argon-primary"
                  : "bg-white text-argon-muted hover:bg-argon-lighter/50 shadow-argon-sm"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white/70" : cfg.dotColor}`} />
              <span>{cfg.label}</span>
              <span className={`ml-0.5 text-[0.5625rem] ${isActive ? "text-white/70" : "text-argon-light"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Terminal Body */}
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="custom-terminal-scroll p-4 min-h-[500px] max-h-[600px] overflow-y-auto font-mono text-[12px] leading-[1.9] bg-argon-bg/20"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[460px] text-argon-muted">
              <Terminal className="w-10 h-10 mb-3 opacity-20" />
              <span className="text-sm font-semibold">
                {search || activeFilter !== "all"
                  ? "No matching events found"
                  : "Waiting for events..."}
              </span>
              {(search || activeFilter !== "all") && (
                <button
                  onClick={() => { setSearch(""); setActiveFilter("all"); }}
                  className="mt-3 text-xs text-argon-primary font-semibold hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log, idx) => {
              const isLatest = idx === filteredLogs.length - 1;
              const cfg = categoryConfig[log.category];

              return (
                <div
                  key={log.id}
                  className={`flex gap-3 py-0.5 rounded-argon px-2 transition-all duration-300 group ${
                    isLatest ? "bg-argon-primary/5" : "hover:bg-argon-lighter/60"
                  }`}
                  style={{
                    animation: isLatest ? "terminal-line 0.3s ease-out" : "none",
                  }}
                >
                  {/* Line number */}
                  <span className="text-argon-lighter select-none tabular-nums w-8 text-right flex-shrink-0">
                    {log.id + 1}
                  </span>
                  {/* Timestamp */}
                  <span className="text-argon-light flex-shrink-0 select-none tabular-nums">
                    {log.timestamp}
                  </span>
                  {/* Category dot */}
                  <span className={`flex-shrink-0 mt-[7px] w-1.5 h-1.5 rounded-full ${
                    log.category === "download" ? "bg-[#11cdef]" :
                    log.category === "training" ? "bg-[#825ee4]" :
                    log.category === "upload" ? "bg-[#2dce89]" :
                    log.category === "idle" ? "bg-argon-light" :
                    log.category === "evaluate" ? "bg-[#fb6340]" :
                    "bg-argon-muted"
                  }`} />
                  {/* Message */}
                  <span className={`${isLatest ? "font-semibold" : ""} ${cfg.color || "text-argon-muted"}`}>
                    {log.message}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Scroll to bottom FAB */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-6 flex items-center gap-1.5 px-3 py-2 bg-argon-primary text-white text-xs font-bold rounded-full shadow-argon-primary hover:bg-argon-primary-dark transition-all animate-bounce"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            Latest
          </button>
        )}
      </div>

      {/* Footer status bar */}
      <div className="px-6 py-2.5 border-t border-argon-lighter bg-argon-bg/30 flex items-center justify-between">
        <span className="text-[0.6875rem] text-argon-muted font-semibold">
          Showing {filteredLogs.length} of {parsedLogs.length} events
        </span>
        <span className="text-[0.6875rem] text-argon-light">
          {parsedLogs.length > 0
            ? `Last event: ${parsedLogs[parsedLogs.length - 1].timestamp}`
            : "No events yet"}
        </span>
      </div>
    </div>
  );
}
