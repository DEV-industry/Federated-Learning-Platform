"use client";
import { ShieldCheck, Loader2, Download, Upload, BarChart3, Pause } from "lucide-react";

const ACTIVITY_BADGES: Record<string, { icon: any; label: string; className: string }> = {
  TRAINING: {
    icon: Loader2,
    label: "Training",
    className: "bg-blue-50 text-blue-600 border-blue-200",
  },
  DOWNLOADING: {
    icon: Download,
    label: "Downloading",
    className: "bg-violet-50 text-violet-600 border-violet-200",
  },
  UPLOADING: {
    icon: Upload,
    label: "Uploading",
    className: "bg-amber-50 text-amber-600 border-amber-200",
  },
  EVALUATING: {
    icon: BarChart3,
    label: "Evaluating",
    className: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  IDLE: {
    icon: Pause,
    label: "Idle",
    className: "bg-gray-50 text-gray-500 border-gray-200",
  },
};

export default function NodeClientsTable({
  nodeDetails,
  nodeActivity,
}: {
  nodeDetails: any[];
  nodeActivity?: Record<string, { status: string; detail: string }>;
}) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Accepted":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600">Connected</span>;
      case "Rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-500">Suspicious</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">Wait</span>;
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
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${badge.className}`}>
          <Icon className={`w-3 h-3 ${isAnimated ? "animate-spin" : ""}`} style={isAnimated ? { animationDuration: "1.5s" } : {}} />
          {badge.label}
        </span>
        {activity.detail && (
          <span className="text-[10px] text-gray-400 pl-1 truncate max-w-[160px]" title={activity.detail}>
            {activity.detail}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-gray-800">Active Node Clients</h3>
        <button className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Node ID</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Activity</th>
              <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Rejected Rds</th>
              <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">DP Status</th>
            </tr>
          </thead>
          <tbody>
            {nodeDetails.length > 0 ? (
              nodeDetails.map((node: any, idx: number) => {
                const activity = nodeActivity?.[node.nodeId];
                const isActive = activity && activity.status !== "IDLE";
                return (
                  <tr
                    key={node.nodeId}
                    className={`border-b border-gray-50 transition-all duration-500 ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                    } ${isActive ? "ring-1 ring-inset ring-blue-100 bg-blue-50/20" : "hover:bg-gray-50/70"}`}
                  >
                    <td className="py-3 px-3 font-mono text-sm text-gray-700 font-medium truncate max-w-[160px]" title={node.nodeId}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          isActive ? "bg-blue-500 animate-pulse" : "bg-gray-300"
                        }`} />
                        {node.nodeId}
                      </div>
                    </td>
                    <td className="py-3 px-3">{getStatusBadge(node.status)}</td>
                    <td className="py-3 px-3">{getActivityBadge(node.nodeId)}</td>
                    <td className="py-3 px-3 text-right">
                      <span className={`font-mono font-bold ${node.rejectedRounds > 0 ? "text-red-500" : "text-gray-400"}`}>{node.rejectedRounds}</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {node.dpEnabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-600">
                          <ShieldCheck className="w-3 h-3" /> Secured
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Not applied</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-400 text-sm italic">No active nodes connected.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
