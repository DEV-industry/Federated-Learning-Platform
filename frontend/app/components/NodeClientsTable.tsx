"use client";
import { ShieldCheck, Loader2, Download, Upload, BarChart3, Pause } from "lucide-react";

const ACTIVITY_BADGES: Record<string, { icon: any; label: string; className: string }> = {
  TRAINING: { icon: Loader2, label: "Training", className: "bg-argon-primary/10 text-argon-primary" },
  DOWNLOADING: { icon: Download, label: "Downloading", className: "bg-[#8b5cf6]/10 text-[#8b5cf6]" },
  UPLOADING: { icon: Upload, label: "Uploading", className: "bg-argon-warning/10 text-argon-warning" },
  EVALUATING: { icon: BarChart3, label: "Evaluating", className: "bg-argon-success/10 text-argon-success" },
  IDLE: { icon: Pause, label: "Idle", className: "bg-argon-lighter text-argon-muted" },
};

export default function NodeClientsTable({ nodeDetails, nodeActivity }: { nodeDetails: any[]; nodeActivity?: Record<string, { status: string; detail: string }> }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Accepted": return <span className="argon-badge argon-badge-success">Connected</span>;
      case "Rejected": return <span className="argon-badge argon-badge-danger">Suspicious</span>;
      default: return <span className="argon-badge argon-badge-warning">Wait</span>;
    }
  };

  const getActivityBadge = (nodeId: string) => {
    const activity = nodeActivity?.[nodeId];
    if (!activity) return null;
    const badge = ACTIVITY_BADGES[activity.status] || ACTIVITY_BADGES.IDLE;
    const Icon = badge.icon;
    const isAnimated = activity.status === "TRAINING" || activity.status === "DOWNLOADING" || activity.status === "UPLOADING";
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold ${badge.className}`}>
          <Icon className={`w-3 h-3 ${isAnimated ? "animate-spin" : ""}`} style={isAnimated ? { animationDuration: "1.5s" } : {}} />
          {badge.label}
        </span>
        {activity.detail && <span className="text-[10px] text-argon-muted pl-1 truncate max-w-[160px]" title={activity.detail}>{activity.detail}</span>}
      </div>
    );
  };

  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center justify-between">
        <h3 className="text-base font-bold text-argon-default">Active Node Clients</h3>
        <button className="text-argon-light hover:text-argon-muted transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-argon-lighter">
              <th className="text-left py-3 px-6 text-[0.625rem] font-bold text-argon-muted uppercase tracking-wider">Node ID</th>
              <th className="text-left py-3 px-6 text-[0.625rem] font-bold text-argon-muted uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-6 text-[0.625rem] font-bold text-argon-muted uppercase tracking-wider">Activity</th>
              <th className="text-right py-3 px-6 text-[0.625rem] font-bold text-argon-muted uppercase tracking-wider">Rejected Rds</th>
              <th className="text-right py-3 px-6 text-[0.625rem] font-bold text-argon-muted uppercase tracking-wider">DP Status</th>
            </tr>
          </thead>
          <tbody>
            {nodeDetails.length > 0 ? nodeDetails.map((node: any) => {
              const activity = nodeActivity?.[node.nodeId];
              const isActive = activity && activity.status !== "IDLE";
              return (
                <tr key={node.nodeId} className={`border-b border-argon-lighter/50 transition-all duration-500 hover:bg-argon-bg/50 ${isActive ? "bg-argon-primary/[0.02]" : ""}`}>
                  <td className="py-4 px-6 font-mono text-[0.8125rem] text-argon-default font-semibold truncate max-w-[160px]" title={node.nodeId}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-argon-primary animate-pulse" : "bg-argon-light"}`} />
                      {node.nodeId}
                    </div>
                  </td>
                  <td className="py-4 px-6">{getStatusBadge(node.status)}</td>
                  <td className="py-4 px-6">{getActivityBadge(node.nodeId)}</td>
                  <td className="py-4 px-6 text-right"><span className={`font-mono font-bold ${node.rejectedRounds > 0 ? "text-argon-danger" : "text-argon-light"}`}>{node.rejectedRounds}</span></td>
                  <td className="py-4 px-6 text-right">
                    {node.dpEnabled ? <span className="argon-badge argon-badge-primary"><ShieldCheck className="w-3 h-3" /> Secured</span> : <span className="text-xs text-argon-light">Not applied</span>}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="py-8 text-center text-argon-muted text-sm font-semibold">No active nodes connected.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
