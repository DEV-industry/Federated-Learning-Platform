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
    <div className="bg-white border border-gray-200 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">Event Stream</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-emerald-600">LIVE</span>
        </div>
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        className="p-4 h-[280px] overflow-y-auto font-mono text-[12px] leading-[1.9] bg-gray-50/50"
      >
        {eventLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Terminal className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-[11px]">Waiting for events...</span>
          </div>
        ) : (
          eventLogs.map((log, idx) => {
            const isLatest = idx === eventLogs.length - 1;
            const match = log.match(/^\[([^\]]+)\]\s*(.*)/);
            const timestamp = match ? match[1] : "";
            const message = match ? match[2] : log;

            return (
              <div
                key={idx}
                className={`flex gap-3 py-0.5 rounded-md px-2 transition-all duration-300 ${
                  isLatest ? "bg-blue-50/80" : "hover:bg-gray-100/60"
                }`}
                style={{
                  animation: isLatest ? "terminal-line 0.3s ease-out" : "none",
                }}
              >
                <span className="text-gray-400 flex-shrink-0 select-none tabular-nums">{timestamp}</span>
                <span className={isLatest ? "text-gray-900 font-medium" : "text-gray-600"}>{message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
