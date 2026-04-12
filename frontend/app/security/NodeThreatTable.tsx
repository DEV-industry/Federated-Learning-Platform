import {
  ShieldCheck, ShieldAlert, ShieldOff, CheckCircle2, XCircle, Clock, AlertTriangle,
} from "lucide-react";

interface ThreatNode {
  nodeId: string;
  hostname?: string;
  deviceOs?: string;
  threatLevel: "none" | "low" | "medium" | "high";
  rejections: number;
  hasPublicKey?: boolean;
  authVersion?: number;
  dpEnabled?: boolean;
  clientVersion?: string;
  lastHeartbeat?: string;
}

interface Props {
  nodes: ThreatNode[];
}

function getThreatBadge(level: string) {
  switch (level) {
    case "high":
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-red-500/10 text-red-500"><ShieldAlert className="w-3 h-3" />High Risk</span>;
    case "medium":
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-orange-500/10 text-orange-500"><AlertTriangle className="w-3 h-3" />Medium</span>;
    case "low":
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-yellow-500/10 text-yellow-500"><ShieldOff className="w-3 h-3" />Low</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-green-500/10 text-green-500"><ShieldCheck className="w-3 h-3" />Clear</span>;
  }
}

export default function NodeThreatTable({ nodes }: Props) {
  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg shadow-sm text-white">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">Node Threat Assessment</h3>
            <p className="text-xs text-argon-muted mt-0.5">Threat level classification based on historical rejection count and credential status.</p>
          </div>
        </div>
        <span className="text-xs font-bold text-argon-muted uppercase tracking-wider bg-argon-bg px-3 py-1.5 rounded-full">
          {nodes.filter((n) => n.threatLevel !== "none").length} flagged
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-argon-lighter bg-argon-lighter/30">
              <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Node</th>
              <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Threat Level</th>
              <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Rejections</th>
              <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Key Bound</th>
              <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Auth Ver.</th>
              <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">DP</th>
              <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Client</th>
              <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Last Heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {nodes.length > 0 ? nodes.map((node) => (
              <tr
                key={node.nodeId}
                className={`border-b border-argon-lighter/50 transition-all duration-300 hover:bg-argon-bg/50 ${
                  node.threatLevel === "high" ? "bg-red-500/[0.03]" : node.threatLevel === "medium" ? "bg-orange-500/[0.03]" : ""
                }`}
              >
                <td className="py-5 px-6">
                  <div className="flex flex-col">
                    <span className="font-mono text-[0.8125rem] font-semibold text-argon-default truncate max-w-[180px]" title={node.nodeId}>{node.nodeId}</span>
                    <span className="text-[10px] text-argon-light mt-0.5">{node.hostname || "—"} · {node.deviceOs || "Unknown OS"}</span>
                  </div>
                </td>
                <td className="py-5 px-6">{getThreatBadge(node.threatLevel)}</td>
                <td className="py-5 px-6 text-center">
                  <span className={`font-bold text-sm ${node.rejections > 0 ? "text-argon-danger" : "text-argon-success"}`}>
                    {node.rejections}
                  </span>
                </td>
                <td className="py-5 px-6 text-center">
                  {node.hasPublicKey ? (
                    <CheckCircle2 className="w-4 h-4 text-argon-success mx-auto" />
                  ) : (
                    <XCircle className="w-4 h-4 text-argon-danger mx-auto" />
                  )}
                </td>
                <td className="py-5 px-6 text-center">
                  <span className="font-mono text-xs text-argon-muted font-bold">v{node.authVersion ?? 0}</span>
                </td>
                <td className="py-5 px-6 text-center">
                  {node.dpEnabled ? (
                    <span className="argon-badge argon-badge-primary"><ShieldCheck className="w-3 h-3" /></span>
                  ) : (
                    <span className="text-[0.6875rem] text-argon-light font-semibold">Off</span>
                  )}
                </td>
                <td className="py-5 px-6 text-xs text-argon-muted font-semibold">{node.clientVersion || "—"}</td>
                <td className="py-5 px-6">
                  <div className="flex items-center gap-1.5 text-xs text-argon-muted">
                    <Clock className="w-3 h-3" />
                    <span>{node.lastHeartbeat ? new Date(node.lastHeartbeat).toLocaleTimeString() : "—"}</span>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={8} className="py-12 text-center text-argon-muted text-sm font-semibold">No nodes registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
