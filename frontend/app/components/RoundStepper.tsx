"use client";
import { Download, Cpu, GitMerge, BarChart3, Check } from "lucide-react";

const STAGES = [
  { key: "DISTRIBUTING", label: "Distributing", icon: Download, description: "Sending global model to nodes" },
  { key: "TRAINING", label: "Training", icon: Cpu, description: "Nodes training locally" },
  { key: "AGGREGATING", label: "Aggregating", icon: GitMerge, description: "FedAvg weight aggregation" },
  { key: "EVALUATING", label: "Evaluating", icon: BarChart3, description: "Model accuracy evaluation" },
];

const STAGE_ORDER: Record<string, number> = {
  IDLE: -1,
  DISTRIBUTING: 0,
  TRAINING: 1,
  AGGREGATING: 2,
  EVALUATING: 3,
};

export default function RoundStepper({ globalStage, currentRound }: { globalStage: string; currentRound: number }) {
  const activeIdx = STAGE_ORDER[globalStage] ?? -1;
  const isIdle = globalStage === "IDLE";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-800">Round {currentRound} Pipeline</h3>
          {isIdle ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
              Waiting for nodes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Processing
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0">
        {STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const isActive = idx === activeIdx;
          const isCompleted = idx < activeIdx;
          const isPending = idx > activeIdx || isIdle;

          return (
            <div key={stage.key} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1 relative group">
                {/* Circle */}
                <div
                  className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 relative
                    ${isActive
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-110"
                      : isCompleted
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                        : "bg-gray-100 text-gray-400"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`} />
                  )}
                  {isActive && (
                    <span className="absolute inset-0 rounded-xl bg-blue-400/30 animate-ping" />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    mt-2 text-[11px] font-semibold transition-colors duration-300
                    ${isActive ? "text-blue-600" : isCompleted ? "text-emerald-600" : "text-gray-400"}
                  `}
                >
                  {stage.label}
                </span>

                {/* Tooltip description */}
                <span
                  className={`
                    mt-0.5 text-[10px] transition-colors duration-300 text-center max-w-[100px]
                    ${isActive ? "text-blue-400" : "text-gray-300"}
                  `}
                >
                  {stage.description}
                </span>
              </div>

              {/* Connector line */}
              {idx < STAGES.length - 1 && (
                <div className="flex-shrink-0 w-12 h-[2px] relative -mt-6">
                  <div className="absolute inset-0 bg-gray-200 rounded-full" />
                  <div
                    className={`
                      absolute inset-y-0 left-0 rounded-full transition-all duration-700
                      ${isCompleted
                        ? "w-full bg-emerald-400"
                        : isActive
                          ? "w-1/2 bg-gradient-to-r from-blue-500 to-transparent"
                          : "w-0"
                      }
                    `}
                  />
                  {isActive && (
                    <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 animate-[stepper-dot_1.5s_ease-in-out_infinite] shadow-lg shadow-blue-500/50" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
