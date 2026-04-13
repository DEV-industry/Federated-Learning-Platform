import { Info, Server, Target, Layers, Hash, Globe } from "lucide-react";

interface Props {
  currentRound: number;
  totalNodes: number;
  expectedNodes: number;
  aggregationStrategy: string;
}

export default function PlatformInfoCard({
  currentRound,
  totalNodes,
  expectedNodes,
  aggregationStrategy,
}: Props) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

  const infoRows = [
    { label: "Platform Version", value: "1.0.0", icon: Hash },
    { label: "API Endpoint", value: API_URL, icon: Globe },
    { label: "Aggregation Strategy", value: aggregationStrategy || "BULYAN", icon: Layers },
    { label: "Training Round", value: String(currentRound), icon: Target },
    { label: "Registered Nodes", value: `${totalNodes} / ${expectedNodes} expected`, icon: Server },
  ];

  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm text-white">
          <Info className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-argon-default">Platform Information</h3>
          <p className="text-xs text-argon-muted mt-0.5">Core system identifiers and runtime state.</p>
        </div>
      </div>

      <div className="p-6 space-y-0">
        {infoRows.map((row, idx) => {
          const Icon = row.icon;
          return (
            <div
              key={row.label}
              className={`flex items-center justify-between py-3.5 ${
                idx < infoRows.length - 1 ? "border-b border-argon-lighter/60" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-argon bg-argon-bg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-argon-muted" />
                </div>
                <span className="text-sm font-semibold text-argon-muted">{row.label}</span>
              </div>
              <span className="text-sm font-bold text-argon-default text-right max-w-[50%] truncate" title={row.value}>
                {row.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
