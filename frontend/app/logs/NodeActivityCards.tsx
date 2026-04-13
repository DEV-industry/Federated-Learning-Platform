import { Download, Cpu, Upload, Pause, BarChart3, HelpCircle } from "lucide-react";

interface Props {
  nodeActivity: Record<string, { status: string; detail: string }>;
}

const statusConfig: Record<string, {
  label: string;
  badgeClass: string;
  Icon: React.ElementType;
  gradient: string;
  animate: boolean;
}> = {
  DOWNLOADING: {
    label: "Downloading",
    badgeClass: "argon-badge-info",
    Icon: Download,
    gradient: "from-cyan-400 to-blue-500",
    animate: true,
  },
  TRAINING: {
    label: "Training",
    badgeClass: "argon-badge-primary",
    Icon: Cpu,
    gradient: "from-purple-400 to-indigo-500",
    animate: true,
  },
  UPLOADING: {
    label: "Uploading",
    badgeClass: "argon-badge-success",
    Icon: Upload,
    gradient: "from-green-400 to-emerald-500",
    animate: true,
  },
  IDLE: {
    label: "Idle",
    badgeClass: "argon-badge-warning",
    Icon: Pause,
    gradient: "from-gray-300 to-gray-400",
    animate: false,
  },
  EVALUATING: {
    label: "Evaluating",
    badgeClass: "argon-badge-warning",
    Icon: BarChart3,
    gradient: "from-orange-400 to-red-500",
    animate: true,
  },
};

const defaultStatus = {
  label: "Unknown",
  badgeClass: "argon-badge-warning",
  Icon: HelpCircle,
  gradient: "from-gray-300 to-gray-400",
  animate: false,
};

export default function NodeActivityCards({ nodeActivity }: Props) {
  const entries = Object.entries(nodeActivity);

  if (entries.length === 0) {
    return (
      <div className="argon-card overflow-hidden">
        <div className="argon-card-header flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-argon bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-argon-default">Node Activity</span>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-argon-muted">
          <Cpu className="w-10 h-10 mb-3 opacity-20" />
          <span className="text-sm font-semibold">No active nodes</span>
          <span className="text-xs text-argon-light mt-1">Nodes will appear here during training</span>
        </div>
      </div>
    );
  }

  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-argon bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-base font-bold text-argon-default">Node Activity</span>
        </div>
        <span className="text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">
          {entries.length} node{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {entries.map(([nodeId, activity]) => {
          const cfg = statusConfig[activity.status] || defaultStatus;
          const Icon = cfg.Icon;

          return (
            <div
              key={nodeId}
              className="relative bg-argon-bg/50 rounded-argon-lg p-4 border border-argon-lighter/60 hover:shadow-argon-sm transition-all duration-200 group"
            >
              {/* Active indicator */}
              {cfg.animate && (
                <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-argon-success animate-pulse shadow-[0_0_6px_rgba(45,206,137,0.5)]" />
              )}

              {/* Node name + icon */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 bg-gradient-to-br ${cfg.gradient} rounded-lg shadow-sm text-white transition-transform group-hover:scale-105`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-argon-default truncate">{nodeId}</p>
                  <span className={`argon-badge ${cfg.badgeClass} mt-0.5`}>{cfg.label}</span>
                </div>
              </div>

              {/* Detail */}
              {activity.detail && (
                <p className="text-xs text-argon-muted font-semibold mt-1 pl-[52px] truncate" title={activity.detail}>
                  {activity.detail}
                </p>
              )}

              {/* Activity bar animation for active states */}
              {cfg.animate && (
                <div className="mt-3 w-full h-1 bg-argon-lighter rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-argon-primary to-[#825ee4]"
                    style={{ animation: "stepper-fill 2s ease-in-out infinite" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
