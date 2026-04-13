"use client";
import { Network, Server, Wifi, WifiOff, AlertTriangle } from "lucide-react";

interface NodeDetail {
  nodeId: string;
  status: string;
  hostname?: string;
  clientVersion?: string;
  dpEnabled?: boolean;
  hasPublicKey?: boolean;
  rejectedRounds?: number;
}

function inferNetwork(nodeId: string): { label: string; subnet: string; color: string; icon: React.ElementType } {
  const id = nodeId.toLowerCase();
  if (id.startsWith("node-") && /^node-\d+$/.test(id)) {
    return { label: "fl-network", subnet: "Docker Overlay", color: "indigo", icon: Network };
  }
  if (id.startsWith("physical-") || id.startsWith("laptop-") || id.startsWith("edge-") || id.startsWith("ext-")) {
    return { label: "External", subnet: "Physical LAN", color: "green", icon: Wifi };
  }
  return { label: "Unknown", subnet: "Unclassified", color: "slate", icon: Server };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-400",
  STALE: "bg-amber-400",
  DISCONNECTED: "bg-gray-400",
  LOCKED: "bg-orange-400",
  BANNED: "bg-red-500",
  Pending: "bg-blue-400",
};

const STATUS_TEXT: Record<string, string> = {
  ACTIVE: "text-emerald-600",
  STALE: "text-amber-600",
  DISCONNECTED: "text-gray-500",
  LOCKED: "text-orange-600",
  BANNED: "text-red-600",
  Pending: "text-blue-600",
  Accepted: "text-emerald-600",
  Rejected: "text-red-600",
};

const NETWORK_GRADIENT: Record<string, string> = {
  indigo: "from-indigo-400 to-purple-500",
  green: "from-green-400 to-emerald-500",
  slate: "from-slate-400 to-zinc-500",
};

const NETWORK_BADGE: Record<string, string> = {
  indigo: "bg-indigo-50 border-indigo-200 text-indigo-700",
  green: "bg-green-50 border-green-200 text-green-700",
  slate: "bg-slate-50 border-slate-200 text-slate-700",
};

export default function NodeLocationsCard({ nodeDetails }: { nodeDetails: NodeDetail[] }) {
  // Group by network
  const networkMap: Record<string, { meta: ReturnType<typeof inferNetwork>; nodes: NodeDetail[] }> = {};

  for (const node of nodeDetails) {
    const net = inferNetwork(node.nodeId);
    if (!networkMap[net.label]) {
      networkMap[net.label] = { meta: net, nodes: [] };
    }
    networkMap[net.label].nodes.push(node);
  }

  const networks = Object.values(networkMap);
  const totalNodes = nodeDetails.length;
  const activeNodes = nodeDetails.filter((n) => n.status === "ACTIVE" || n.status === "Accepted").length;

  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-argon-default mb-1">Node Networks</h3>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-argon-default">{totalNodes}</span>
            <span className="text-xs font-semibold text-argon-muted">
              nodes across <strong className="text-argon-default">{networks.length}</strong> network{networks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-argon-muted mt-1">Nodes grouped by network segment</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white shadow-sm flex-shrink-0">
          <Network className="w-4 h-4" />
        </div>
      </div>

      <div className="argon-card-body space-y-4">
        {networks.length === 0 && (
          <p className="text-xs text-argon-muted text-center py-4">No nodes registered yet.</p>
        )}

        {networks.map(({ meta, nodes }) => {
          const Icon = meta.icon;
          const active = nodes.filter((n) => n.status === "ACTIVE" || n.status === "Accepted").length;
          const stale = nodes.filter((n) => n.status === "STALE").length;
          const banned = nodes.filter((n) => n.status === "BANNED").length;
          const pct = totalNodes > 0 ? Math.round((nodes.length / totalNodes) * 100) : 0;

          return (
            <div key={meta.label} className="border border-argon-lighter/60 rounded-xl overflow-hidden">
              {/* Network header */}
              <div className={`flex items-center justify-between px-4 py-3 bg-gradient-to-r ${NETWORK_GRADIENT[meta.color]} text-white`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <div>
                    <p className="text-xs font-bold leading-none">{meta.label}</p>
                    <p className="text-[0.625rem] text-white/70 mt-0.5">{meta.subnet}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{nodes.length} nodes</span>
                  <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">{pct}%</span>
                </div>
              </div>

              {/* Node list */}
              <div className="divide-y divide-argon-lighter/40">
                {nodes.map((node) => {
                  const statusColor = STATUS_COLORS[node.status] || "bg-gray-400";
                  const statusText = STATUS_TEXT[node.status] || "text-gray-500";

                  return (
                    <div key={node.nodeId} className="flex items-center gap-3 px-4 py-2.5 hover:bg-argon-bg/50 transition-colors">
                      {/* Status dot */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />

                      {/* Node ID */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-argon-default truncate font-mono">{node.nodeId}</p>
                        {node.hostname && (
                          <p className="text-[0.625rem] text-argon-muted truncate">{node.hostname}</p>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[0.5625rem] font-bold uppercase ${statusText}`}>
                          {node.status}
                        </span>
                        {node.dpEnabled && (
                          <span className="text-[0.5rem] font-bold bg-purple-50 text-purple-600 border border-purple-200 px-1.5 py-0.5 rounded-full">
                            DP
                          </span>
                        )}
                        {node.hasPublicKey && (
                          <span className="text-[0.5rem] font-bold bg-blue-50 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-full">
                            KEY
                          </span>
                        )}
                        {(node.rejectedRounds ?? 0) > 0 && (
                          <span className="text-[0.5rem] font-bold bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <AlertTriangle className="w-2 h-2" />{node.rejectedRounds}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Network stats footer */}
              <div className="px-4 py-2 bg-argon-bg/40 flex gap-3 text-[0.625rem] font-semibold text-argon-muted border-t border-argon-lighter/40">
                {active > 0 && <span className="text-emerald-600">{active} Active</span>}
                {stale > 0 && <span className="text-amber-600">{stale} Stale</span>}
                {banned > 0 && <span className="text-red-600">{banned} Banned</span>}
                {active === 0 && stale === 0 && banned === 0 && <span>All Pending</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
