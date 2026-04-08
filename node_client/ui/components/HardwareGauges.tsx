"use client";
import { Cpu, MemoryStick } from "lucide-react";
import { HardwareMetrics } from "@/lib/useNodeData";

function GaugeRing({ value, label, sublabel, icon: Icon, colorClass }: {
  value: number;
  label: string;
  sublabel: string;
  icon: any;
  colorClass: string;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const clampedValue = Math.min(Math.max(value, 0), 100);

  // Color transitions based on usage
  let strokeColor = "#2dce89"; // green
  let glowColor = "rgba(45, 206, 137, 0.3)";
  if (clampedValue > 80) {
    strokeColor = "#f5365c"; // red
    glowColor = "rgba(245, 54, 92, 0.3)";
  } else if (clampedValue > 60) {
    strokeColor = "#fb6340"; // orange
    glowColor = "rgba(251, 99, 64, 0.3)";
  } else if (clampedValue > 40) {
    strokeColor = "#fbb140"; // yellow
    glowColor = "rgba(251, 177, 64, 0.3)";
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="100" height="100" className="-rotate-90">
          {/* Background ring */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke="#e9ecef"
            strokeWidth="6"
          />
          {/* Value ring */}
          <circle
            cx="50" cy="50" r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 0.8s ease-out, stroke 0.5s ease",
              filter: `drop-shadow(0 0 6px ${glowColor})`,
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-argon-default">{clampedValue.toFixed(0)}%</span>
        </div>
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5 mb-0.5">
          <Icon className="w-3.5 h-3.5 text-argon-muted" />
          <span className="text-xs font-bold text-argon-default">{label}</span>
        </div>
        <span className="text-[0.65rem] text-argon-muted">{sublabel}</span>
      </div>
    </div>
  );
}

export default function HardwareGauges({ hardware }: { hardware: HardwareMetrics | null }) {
  return (
    <div className="argon-card">
      <div className="argon-card-header">
        <div className="flex items-center gap-3">
          <div className="argon-icon-badge bg-gradient-to-br from-argon-info to-[#1171ef]">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-argon-default">Hardware Resources</h3>
            <p className="text-[0.65rem] text-argon-muted mt-0.5">Local machine utilization</p>
          </div>
        </div>
      </div>
      <div className="argon-card-body">
        <div className="flex items-center justify-around">
          <GaugeRing
            value={hardware?.cpuPercent ?? 0}
            label="CPU"
            sublabel="Processor load"
            icon={Cpu}
            colorClass="text-argon-info"
          />
          <div className="w-px h-20 bg-argon-lighter" />
          <GaugeRing
            value={hardware?.ramPercent ?? 0}
            label="RAM"
            sublabel={hardware ? `${hardware.ramUsedMb.toFixed(0)} / ${hardware.ramTotalMb.toFixed(0)} MB` : "— / — MB"}
            icon={MemoryStick}
            colorClass="text-argon-primary"
          />
        </div>
      </div>
    </div>
  );
}
