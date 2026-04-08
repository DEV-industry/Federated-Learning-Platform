"use client";
import { useNodeData } from "@/lib/useNodeData";
import ConnectionIndicator from "@/components/ConnectionIndicator";
import StatusHeader from "@/components/StatusHeader";
import EncryptionShield from "@/components/EncryptionShield";
import LossChart from "@/components/LossChart";
import AccuracyChart from "@/components/AccuracyChart";
import HardwareGauges from "@/components/HardwareGauges";
import LogTerminal from "@/components/LogTerminal";
import Sidebar from "@/components/Sidebar";
import { Shield, Layers } from "lucide-react";

export default function Home() {
  const { status, hardware, metrics, logs, connected, wsConnected } = useNodeData();

  return (
    <div className="min-h-screen bg-argon-bg flex">
      <Sidebar activeItem="Dashboard" />

      <main className="flex-1 ml-[282px] p-8 pb-20 space-y-6">
        {/* Top Header Row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-argon-default mb-1">Node Dashboard</h1>
            <p className="text-sm text-argon-muted">Local Operator View</p>
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
        <div className="text-center pt-8">
          <div className="flex items-center justify-center gap-2 text-argon-muted">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-semibold">
              Federated Learning Node Client • Your data stays on this device
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
