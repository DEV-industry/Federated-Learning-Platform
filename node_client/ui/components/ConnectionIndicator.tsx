"use client";

export default function ConnectionIndicator({ connected, wsConnected }: { connected: boolean; wsConnected: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 node-glass px-4 py-2 rounded-full">
        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
          connected
            ? "bg-argon-success shadow-[0_0_8px_rgba(45,206,137,0.6)] animate-pulse-slow"
            : "bg-argon-danger shadow-[0_0_8px_rgba(245,54,92,0.6)]"
        }`} />
        <span className="text-xs font-semibold text-node-text-secondary">
          {connected ? "Backend Connected" : "Backend Disconnected"}
        </span>
      </div>
      <div className="flex items-center gap-2 node-glass px-4 py-2 rounded-full">
        <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
          wsConnected
            ? "bg-argon-info shadow-[0_0_6px_rgba(17,205,239,0.5)]"
            : "bg-node-text-muted"
        }`} />
        <span className="text-xs font-semibold text-node-text-secondary">
          {wsConnected ? "Live Stream" : "Stream Offline"}
        </span>
      </div>
    </div>
  );
}
