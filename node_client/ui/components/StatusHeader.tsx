"use client";
import { Activity, Clock, Zap, Hash } from "lucide-react";
import { NodeStatus } from "@/lib/useNodeData";

const STATUS_CONFIG: Record<string, { label: string; class: string; dotClass: string }> = {
  connected:    { label: "Connected",              class: "node-badge-success", dotClass: "bg-argon-success" },
  training:     { label: "Training in Progress",   class: "node-badge-info",    dotClass: "bg-argon-info" },
  waiting:      { label: "Waiting for Aggregator",  class: "node-badge-warning", dotClass: "bg-argon-warning" },
  uploading:    { label: "Uploading Weights",       class: "node-badge-primary", dotClass: "bg-argon-primary" },
  encrypting:   { label: "Encrypting (HE)",         class: "node-badge-primary", dotClass: "bg-argon-primary" },
  idle:         { label: "Idle",                    class: "node-badge-success", dotClass: "bg-argon-success" },
  disconnected: { label: "Disconnected",            class: "node-badge-danger",  dotClass: "bg-argon-danger" },
  connecting:   { label: "Connecting...",           class: "node-badge-warning", dotClass: "bg-argon-warning" },
  initializing: { label: "Initializing",            class: "node-badge-warning", dotClass: "bg-argon-warning" },
};

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function StatusHeader({ status }: { status: NodeStatus | null }) {
  const cfg = STATUS_CONFIG[status?.status || "disconnected"] || STATUS_CONFIG.disconnected;

  return (
    <div className="node-card animate-fade-in">
      <div className="px-6 py-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left side — Node identity */}
          <div className="flex items-center gap-4">
            <div className="node-icon-badge bg-gradient-to-br from-argon-primary to-[#825ee4] shadow-lg shadow-argon-primary/20">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-node-text-primary tracking-tight">
                {status?.nodeId || "—"}
              </h1>
              <p className="text-xs text-node-text-muted font-medium mt-0.5">
                Federated Learning Node Client
              </p>
            </div>
          </div>

          {/* Right side — Status + metadata */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Status badge */}
            <div className={`node-badge ${cfg.class}`}>
              <div className={`w-2 h-2 rounded-full ${cfg.dotClass} ${
                ["training", "connecting", "uploading", "encrypting"].includes(status?.status || "")
                  ? "animate-pulse"
                  : ""
              }`} />
              {cfg.label}
            </div>

            {/* Round */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 node-glass rounded-lg">
              <Hash className="w-3.5 h-3.5 text-argon-primary" />
              <span className="text-xs font-bold text-node-text-primary">
                Round {status?.currentRound ?? 0}
              </span>
            </div>

            {/* Last round duration */}
            {(status?.lastRoundDuration ?? 0) > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 node-glass rounded-lg">
                <Zap className="w-3.5 h-3.5 text-argon-warning" />
                <span className="text-xs font-semibold text-node-text-secondary">
                  {status!.lastRoundDuration.toFixed(1)}s/round
                </span>
              </div>
            )}

            {/* Uptime */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 node-glass rounded-lg">
              <Clock className="w-3.5 h-3.5 text-node-text-muted" />
              <span className="text-xs font-semibold text-node-text-secondary">
                {formatUptime(status?.uptimeSeconds ?? 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Training progress bar */}
        {status?.status === "training" && status.totalBatches > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.65rem] font-semibold text-node-text-muted uppercase tracking-widest">
                Epoch Progress
              </span>
              <span className="text-xs font-bold text-argon-primary">
                {status.currentBatch}/{status.totalBatches} batches
              </span>
            </div>
            <div className="w-full bg-node-border rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-argon-primary to-argon-primary-light h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min((status.currentBatch / status.totalBatches) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
