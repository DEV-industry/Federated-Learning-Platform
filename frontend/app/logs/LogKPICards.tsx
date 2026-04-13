import { Activity, Cpu, Server, Zap } from "lucide-react";

interface Props {
  totalEvents: number;
  globalStage: string;
  activeNodes: number;
  trainingEvents: number;
}

const stageConfig: Record<string, { color: string; label: string }> = {
  IDLE: { color: "from-gray-400 to-gray-500", label: "Idle" },
  DISTRIBUTING: { color: "from-cyan-400 to-blue-500", label: "Distributing" },
  TRAINING: { color: "from-purple-400 to-indigo-500", label: "Training" },
  EVALUATING: { color: "from-amber-400 to-orange-500", label: "Evaluating" },
  AGGREGATING: { color: "from-green-400 to-emerald-500", label: "Aggregating" },
};

export default function LogKPICards({ totalEvents, globalStage, activeNodes, trainingEvents }: Props) {
  const stage = stageConfig[globalStage] || stageConfig.IDLE;
  const isActive = globalStage !== "IDLE";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {/* Total Events */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Total Events</span>
          <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm text-white">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">{totalEvents}</p>
        <p className="text-xs text-argon-muted mt-1">
          Logged this session
        </p>
      </div>

      {/* System Stage */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">System Stage</span>
          <div className={`p-2 bg-gradient-to-br ${stage.color} rounded-lg shadow-sm text-white`}>
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-2xl font-extrabold text-argon-default">{stage.label}</p>
          {isActive && (
            <span className="w-2.5 h-2.5 rounded-full bg-argon-success animate-pulse shadow-[0_0_6px_rgba(45,206,137,0.5)]" />
          )}
        </div>
        <p className="text-xs text-argon-muted mt-1">
          Pipeline {isActive ? "running" : "waiting"}
        </p>
      </div>

      {/* Active Nodes */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Active Nodes</span>
          <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
            <Server className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">{activeNodes}</p>
        <p className="text-xs text-argon-muted mt-1">
          Currently reporting activity
        </p>
      </div>

      {/* Training Events */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Training Events</span>
          <div className="p-2 bg-gradient-to-br from-orange-400 to-red-500 rounded-lg shadow-sm text-white">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">{trainingEvents}</p>
        <p className="text-xs text-argon-muted mt-1">
          Training-related log entries
        </p>
      </div>
    </div>
  );
}
