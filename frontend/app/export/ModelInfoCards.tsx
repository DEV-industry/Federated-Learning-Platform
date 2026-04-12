import { FileCode, Server, Shield, Cpu } from "lucide-react";

interface Props {
  currentRound: number;
  totalRounds: number;
  heEnabled: boolean;
  dpEnabled: boolean;
}

export default function ModelInfoCards({ currentRound, totalRounds, heEnabled, dpEnabled }: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Model Architecture */}
      <div className="argon-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm text-white">
            <Cpu className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-argon-default">Model Architecture</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Type</span>
            <span className="text-sm font-bold text-argon-default">Multi-Layer Perceptron</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Dataset</span>
            <span className="text-sm font-bold text-argon-default">CIFAR-10</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Input / Output</span>
            <span className="text-sm font-bold text-argon-default">3072 → 10</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-argon-muted font-semibold">Serialization</span>
            <span className="argon-badge argon-badge-primary">Float64 Binary</span>
          </div>
        </div>
      </div>

      {/* Training Summary */}
      <div className="argon-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
            <Server className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-argon-default">Training Summary</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Rounds Completed</span>
            <span className="text-sm font-bold text-argon-default">{totalRounds}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Current Round</span>
            <span className="text-sm font-bold text-argon-default">{currentRound}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Aggregation</span>
            <span className="argon-badge argon-badge-primary">Bulyan FedAvg</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-argon-muted font-semibold">Regularization</span>
            <span className="argon-badge argon-badge-success">FedProx</span>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="argon-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
            <Shield className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-argon-default">Privacy & Format</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">HE Training</span>
            <span className={`argon-badge ${heEnabled ? "argon-badge-success" : "argon-badge-warning"}`}>{heEnabled ? "Active" : "Disabled"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">DP Noise</span>
            <span className={`argon-badge ${dpEnabled ? "argon-badge-success" : "argon-badge-warning"}`}>{dpEnabled ? "Applied" : "Disabled"}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Export Format</span>
            <span className="text-sm font-bold text-argon-default">.bin (raw weights)</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-argon-muted font-semibold">File Name</span>
            <span className="font-mono text-xs text-argon-muted font-bold">global_model_r{currentRound}.bin</span>
          </div>
        </div>
      </div>
    </div>
  );
}
