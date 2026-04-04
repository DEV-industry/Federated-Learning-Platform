"use client";
import { Settings } from "lucide-react";

export default function ConfigPanel({
  expectedNodesInput,
  setExpectedNodesInput,
  maliciousFractionInput,
  setMaliciousFractionInput,
  onApply,
  status,
}: {
  expectedNodesInput: string;
  setExpectedNodesInput: (v: string) => void;
  maliciousFractionInput: string;
  setMaliciousFractionInput: (v: string) => void;
  onApply: () => void;
  status: any;
}) {
  return (
    <div className="argon-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-argon-primary to-[#825ee4] flex items-center justify-center shadow-argon-primary">
          <Settings className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-sm font-bold text-argon-default">System Config</span>
          <p className="text-[0.6875rem] text-argon-muted">Federated parameters</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-argon-muted uppercase tracking-wider">Target Nodes</label>
          <input
            type="number"
            min="1"
            max="100"
            value={expectedNodesInput}
            onChange={(e) => setExpectedNodesInput(e.target.value)}
            className="argon-input w-16 text-center text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-argon-muted uppercase tracking-wider">Malicious %</label>
          <input
            type="number"
            step="0.05"
            min="0.0"
            max="0.9"
            value={maliciousFractionInput}
            onChange={(e) => setMaliciousFractionInput(e.target.value)}
            className="argon-input w-16 text-center text-sm"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-argon-muted border-l border-argon-lighter pl-3">
          <span>Nodes: <strong className="text-argon-default">{status?.totalNodes || 0}/{status?.expectedNodes || "?"}</strong></span>
        </div>
        <button
          onClick={onApply}
          className="argon-btn argon-btn-primary text-xs"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
