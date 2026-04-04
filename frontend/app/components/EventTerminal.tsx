"use client";
import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";

export default function EventTerminal({ eventLogs }: { eventLogs: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const stripLeadingSymbols = (text: string) =>
    text
      .replace(/^\s+/, "")
      .replace(/^[^A-Za-z0-9]+/, "");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventLogs]);

  return (
    <div className="argon-card overflow-hidden">
      {/* Header */}
      <div className="argon-card-header flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-argon bg-gradient-to-br from-argon-default to-[#344767] flex items-center justify-center">
            <Terminal className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-argon-default">Event Stream</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-argon-success animate-pulse" />
          <span className="text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        className="custom-terminal-scroll p-4 h-[280px] overflow-y-auto font-mono text-[12px] leading-[1.9] bg-argon-bg/30"
      >
        {eventLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-argon-muted">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[0.6875rem] font-semibold">Waiting for events...</span>
          </div>
        ) : (
          eventLogs.map((log, idx) => {
            const isLatest = idx === eventLogs.length - 1;
            const match = log.match(/^\[([^\]]+)\]\s*(.*)/);
            const timestamp = match ? match[1] : "";
            const rawMessage = match ? match[2] : log;
            const message = stripLeadingSymbols(rawMessage);

            return (
              <div
                key={idx}
                className={`flex gap-3 py-0.5 rounded-argon px-2 transition-all duration-300 ${
                  isLatest ? "bg-argon-primary/5" : "hover:bg-argon-lighter/60"
                }`}
                style={{
                  animation: isLatest ? "terminal-line 0.3s ease-out" : "none",
                }}
              >
                <span className="text-argon-light flex-shrink-0 select-none tabular-nums">{timestamp}</span>
                <span className={isLatest ? "text-argon-default font-semibold" : "text-argon-muted"}>{message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
