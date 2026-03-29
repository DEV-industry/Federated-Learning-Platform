"use client";
import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";

export default function EventTerminal({ eventLogs }: { eventLogs: string[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventLogs]);

  return (
    <div className="bg-[#0d1117] border border-[#1c2333] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.3)] overflow-hidden">
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#1c2333]">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <Terminal className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-[11px] font-medium text-gray-500 font-mono">fl-aggregator — event stream</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-500/80 font-mono">LIVE</span>
        </div>
      </div>

      {/* Terminal Body */}
      <div
        ref={scrollRef}
        className="p-4 h-[260px] overflow-y-auto font-mono text-[12px] leading-[1.8] custom-terminal-scroll"
      >
        {eventLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[11px]">Waiting for events...</span>
            <span className="mt-1 w-2 h-4 bg-emerald-500/60 animate-[blink_1s_step-end_infinite] inline-block" />
          </div>
        ) : (
          eventLogs.map((log, idx) => {
            const isLatest = idx === eventLogs.length - 1;
            // Parse timestamp from log format: [HH:mm:ss] message
            const match = log.match(/^\[([^\]]+)\]\s*(.*)/);
            const timestamp = match ? match[1] : "";
            const message = match ? match[2] : log;

            return (
              <div
                key={idx}
                className={`flex gap-2 transition-all duration-300 ${
                  isLatest ? "text-emerald-400" : "text-gray-500"
                }`}
                style={{
                  animation: isLatest ? "terminal-line 0.3s ease-out" : "none",
                }}
              >
                <span className="text-gray-600 flex-shrink-0 select-none">{timestamp}</span>
                <span className={isLatest ? "text-gray-200" : "text-gray-500"}>{message}</span>
              </div>
            );
          })
        )}
        {/* Blinking cursor */}
        {eventLogs.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-emerald-500/80">
            <span className="text-gray-600">$</span>
            <span className="w-2 h-4 bg-emerald-500/60 animate-[blink_1s_step-end_infinite] inline-block" />
          </div>
        )}
      </div>
    </div>
  );
}
