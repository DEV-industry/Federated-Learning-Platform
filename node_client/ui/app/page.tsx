"use client";
import { useNodeData } from "@/lib/useNodeData";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import StatusHeader from "@/components/StatusHeader";
import EncryptionShield from "@/components/EncryptionShield";
import LossChart from "@/components/LossChart";
import AccuracyChart from "@/components/AccuracyChart";
import HardwareGauges from "@/components/HardwareGauges";
import LogTerminal from "@/components/LogTerminal";
import { Shield, Layers } from "lucide-react";

export default function Home() {
  const { status, hardware, metrics, logs, connected, wsConnected } = useNodeData();

  return (
    <div className="min-h-screen pb-12">
      {/* Top gradient bar */}
      <div className="h-1 w-full bg-gradient-to-r from-argon-primary via-argon-info to-argon-success" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Connection indicators */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-argon-primary to-[#825ee4] flex items-center justify-center shadow-lg shadow-argon-primary/20">
                <Layers className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-node-text-primary tracking-tight">Node Dashboard</h2>
                <p className="text-[0.6rem] text-node-text-muted">Local Operator View</p>
              </div>
            </div>
          </div>
          <ConnectionIndicator connected={connected} wsConnected={wsConnected} />
        </div>

        {/* Status Header — Full Width */}
        <StatusHeader status={status} />

        {/* Encryption Shield + Hardware Gauges Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <EncryptionShield
            heEnabled={status?.heEnabled ?? false}
            dpEnabled={status?.dpEnabled ?? false}
          />
          <HardwareGauges hardware={hardware} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <LossChart data={metrics?.lossHistory ?? []} />
          <AccuracyChart data={metrics?.accuracyHistory ?? []} />
        </div>

        {/* Log Terminal — Full Width */}
        <LogTerminal logs={logs} />

        {/* Footer */}
        <div className="text-center pt-4">
          <div className="flex items-center justify-center gap-2 text-node-text-muted">
            <Shield className="w-3.5 h-3.5" />
            <span className="text-[0.65rem] font-medium">
              Federated Learning Node Client • Your data stays on this device
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
