"use client";
import { useEffect, useRef, useState } from "react";
import { Terminal, Pause, Play, ArrowDown } from "lucide-react";
import { LogEntry } from "@/lib/useNodeData";

const LEVEL_STYLES: Record<string, { text: string; badge: string; bg: string }> = {
  INFO:    { text: "text-argon-info",    badge: "bg-argon-info/15 text-argon-info border-argon-info/25",       bg: "" },
  WARN:    { text: "text-argon-warning", badge: "bg-argon-warning/15 text-argon-warning border-argon-warning/25", bg: "bg-argon-warning/[0.02]" },
  ERROR:   { text: "text-argon-danger",  badge: "bg-argon-danger/15 text-argon-danger border-argon-danger/25",   bg: "bg-argon-danger/[0.03]" },
  SUCCESS: { text: "text-argon-success", badge: "bg-argon-success/15 text-argon-success border-argon-success/25", bg: "" },
};

function formatTime(isoTimestamp: string): string {
  try {
    const d = new Date(isoTimestamp);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "--:--:--";
  }
}

export default function LogTerminal({ logs }: { logs: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Detect scroll position
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 30;
    setIsAtBottom(atBottom);
    if (atBottom && !autoScroll) setAutoScroll(true);
    if (!atBottom && autoScroll) setAutoScroll(false);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  };

  return (
    <div className="argon-card flex flex-col h-full">
      {/* Header */}
      <div className="argon-card-header flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-argon bg-gradient-to-br from-argon-default to-[#344767] flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-argon-default">Training Logs</h3>
            <p className="text-[0.65rem] text-argon-muted mt-0.5">
              {logs.length} entries • Real-time stream
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1.5 rounded-lg border transition-all duration-200 ${
              autoScroll
                ? "bg-argon-primary/10 border-argon-primary/25 text-argon-primary"
                : "bg-argon-lighter/50 border-argon-lighter text-argon-muted hover:text-argon-default"
            }`}
            title={autoScroll ? "Pause auto-scroll" : "Resume auto-scroll"}
          >
            {autoScroll ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          {!isAtBottom && (
            <button
              onClick={scrollToBottom}
              className="p-1.5 rounded-lg bg-argon-primary/10 border border-argon-primary/25 text-argon-primary animate-bounce"
              title="Scroll to bottom"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto custom-terminal-scroll bg-argon-bg/30 font-mono text-xs leading-[1.9] min-h-[300px] max-h-[400px]"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Terminal className="w-8 h-8 text-argon-muted/30 mx-auto mb-2" />
              <p className="text-argon-muted font-sans text-[0.6875rem] font-semibold">Waiting for log output...</p>
              <div className="mt-2 flex items-center justify-center gap-1">
                <div className="w-1 h-1 bg-argon-primary rounded-full animate-pulse" />
                <div className="w-1 h-1 bg-argon-primary rounded-full animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="w-1 h-1 bg-argon-primary rounded-full animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 space-y-0.5">
            {logs.map((entry, i) => {
              const style = LEVEL_STYLES[entry.level] || LEVEL_STYLES.INFO;
              return (
                <div key={i} className={`flex items-start gap-3 py-0.5 px-2 rounded-argon ${style.bg} hover:bg-argon-lighter/60 transition-colors`}>
                  <span className="text-argon-light flex-shrink-0 w-[60px] select-none tabular-nums">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className={`flex-shrink-0 w-[52px] text-center text-[0.6rem] font-bold py-0.5 rounded border ${style.badge}`}>
                    {entry.level}
                  </span>
                  <span className="text-argon-default font-semibold break-all">
                    {entry.message}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-2 border-t border-argon-lighter bg-argon-bg/30 rounded-b-argon-lg flex items-center gap-2 flex-shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full ${autoScroll ? "bg-argon-success animate-pulse" : "bg-argon-light"}`} />
        <span className="text-[0.6rem] text-argon-muted font-mono">
          {autoScroll ? "auto-scroll active" : "auto-scroll paused"} • {logs.length} lines
        </span>
      </div>
    </div>
  );
}
