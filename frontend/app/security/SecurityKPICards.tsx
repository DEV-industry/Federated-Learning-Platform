import { ShieldCheck, ShieldAlert, Key, Lock } from "lucide-react";

interface VerdictStats {
  accepted: number;
  rejected: number;
  heBlind: number;
  fallback: number;
  total: number;
}

interface SecurityPosture {
  dpActive: boolean;
  nodesWithKey: number;
  totalNodes: number;
  totalRejections: number;
  keyBindingRate: number;
}

interface Props {
  verdictStats: VerdictStats;
  securityPosture: SecurityPosture;
}

export default function SecurityKPICards({ verdictStats, securityPosture }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {/* Aggregation Verdicts */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Aggregation Verdicts</span>
          <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">{verdictStats.total}</p>
        <p className="text-xs text-argon-muted mt-1">
          <span className="text-argon-success font-bold">{verdictStats.accepted + verdictStats.heBlind + verdictStats.fallback}</span> accepted · <span className="text-argon-danger font-bold">{verdictStats.rejected}</span> rejected
        </p>
      </div>

      {/* Rejection Rate */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Rejection Rate</span>
          <div className={`p-2 rounded-lg shadow-sm text-white ${verdictStats.rejected > 0 ? "bg-gradient-to-br from-red-400 to-rose-500" : "bg-gradient-to-br from-green-400 to-emerald-500"}`}>
            {verdictStats.rejected > 0 ? <ShieldAlert className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">
          {verdictStats.total > 0 ? ((verdictStats.rejected / verdictStats.total) * 100).toFixed(1) : "0.0"}%
        </p>
        <p className="text-xs text-argon-muted mt-1">{verdictStats.rejected} of {verdictStats.total} total verdicts</p>
      </div>

      {/* Key Binding */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Ed25519 Key Binding</span>
          <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm text-white">
            <Key className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">{securityPosture.keyBindingRate}%</p>
        <p className="text-xs text-argon-muted mt-1">{securityPosture.nodesWithKey} / {securityPosture.totalNodes} nodes have bound keys</p>
      </div>

      {/* DP Status */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Differential Privacy</span>
          <div className={`p-2 rounded-lg shadow-sm text-white ${securityPosture.dpActive ? "bg-gradient-to-br from-cyan-400 to-blue-500" : "bg-gradient-to-br from-gray-300 to-gray-400"}`}>
            <Lock className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">{securityPosture.dpActive ? "Active" : "Inactive"}</p>
        <p className="text-xs text-argon-muted mt-1">Gradient noise injection {securityPosture.dpActive ? "enabled" : "disabled"}</p>
      </div>
    </div>
  );
}
