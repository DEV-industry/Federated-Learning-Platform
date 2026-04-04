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
    <div className="argon-card p-6 mb-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-argon-default">Round {currentRound} Pipeline</h3>
          {isIdle ? (
            <span className="argon-badge bg-argon-lighter text-argon-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-argon-light" />
              Waiting for nodes
            </span>
          ) : (
            <span className="argon-badge argon-badge-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-argon-primary animate-pulse" />
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
                    w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 relative
                    ${isActive
                      ? "bg-argon-primary text-white shadow-argon-primary scale-110"
                      : isCompleted
                        ? "bg-argon-success text-white shadow-argon-success"
                        : "bg-argon-lighter text-argon-light"
                    }
                  `}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`} />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    mt-2 text-[0.6875rem] font-bold transition-colors duration-300
                    ${isActive ? "text-argon-primary" : isCompleted ? "text-argon-success" : "text-argon-light"}
                  `}
                >
                  {stage.label}
                </span>

                {/* Description */}
                <span
                  className={`
                    mt-0.5 text-[10px] transition-colors duration-300 text-center max-w-[100px]
                    ${isActive ? "text-argon-primary/60" : "text-argon-light/60"}
                  `}
                >
                  {stage.description}
                </span>
              </div>

              {/* Connector line */}
              {idx < STAGES.length - 1 && (
                <div className="flex-shrink-0 w-16 h-[3px] relative -mt-6 rounded-full bg-argon-lighter overflow-hidden">
                  <div
                    className={`
                      absolute inset-y-0 left-0 rounded-full transition-all duration-700
                      ${isCompleted
                        ? "w-full bg-argon-success"
                        : isActive
                          ? "bg-argon-primary animate-[stepper-fill_2s_ease-in-out_infinite]"
                          : "w-0"
                      }
                    `}
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
