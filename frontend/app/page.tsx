"use client";
import { useEffect, useState } from "react";
import { Target, TrendingUp, TrendingDown } from "lucide-react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import MetricCard from "./components/MetricCard";
import NodeActivityHeatmap from "./components/NodeActivityHeatmap";
import AccuracyChart from "./components/AccuracyChart";
import NodeClientsTable from "./components/NodeClientsTable";
import NodeLocationsCard from "./components/NodeLocationsCard";
import ConfigPanel from "./components/ConfigPanel";

export default function Home() {
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [expectedNodesInput, setExpectedNodesInput] = useState<string>("");
  const [safetyThresholdInput, setSafetyThresholdInput] = useState<string>("");

  useEffect(() => {
    const fetchStatus = () => {
      fetch(`${API_URL}/api/status`)
        .then((res) => res.json())
        .then((data) => {
          setStatus(data);
          if (!expectedNodesInput) setExpectedNodesInput(data.expectedNodes?.toString() || "2");
          if (!safetyThresholdInput) setSafetyThresholdInput(data.safetyThreshold?.toString() || "5.0");
        })
        .catch((err) => console.error(err));

      fetch(`${API_URL}/api/history`)
        .then((res) => res.json())
        .then((data) => {
          const sortedData = data.sort((a: any, b: any) => a.round - b.round);
          setHistory(sortedData);
        })
        .catch((err) => console.error(err));
    };

    fetchStatus();

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws-sockjs`),
      onConnect: () => {
        console.log("Connected to STOMP via SockJS");
        client.subscribe("/topic/updates", (message) => {
          if (message.body) {
            const data = JSON.parse(message.body);
            setStatus(data.status);
            const sortedHistory = data.history.sort((a: any, b: any) => a.round - b.round);
            setHistory(sortedHistory);
          }
        });
      },
      onStompError: (frame) => {
        console.error("Broker connection error: " + frame.headers["message"]);
      },
      debug: (msg) => console.log(msg),
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [expectedNodesInput, safetyThresholdInput]);

  const resetTraining = async () => {
    if (!confirm("Are you sure you want to reset all federated training rounds? This permanently deletes the Postgres database records.")) return;
    try {
      await fetch(`${API_URL}/api/training/reset`, { method: "DELETE" });
      setStatus(null);
      setHistory([]);
    } catch (err) {
      console.error("Failed to reset training system.", err);
    }
  };

  const updateConfig = async () => {
    try {
      await fetch(`${API_URL}/api/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedNodes: parseInt(expectedNodesInput),
          safetyThreshold: parseFloat(safetyThresholdInput),
        }),
      });
      alert(`Config updated! Required Nodes: ${expectedNodesInput}, Safety Threshold: ${safetyThresholdInput}`);
    } catch (err) {
      console.error(err);
    }
  };

  const TARGET_ROUNDS = 100;
  const currentRound = status?.currentRound || 0;
  const progressPercentage = Math.min((currentRound / TARGET_ROUNDS) * 100, 100);

  const latestLoss = history.length > 0 ? history[history.length - 1].loss.toFixed(4) : "0.0000";
  const latestAccuracy = history.length > 0 ? (history[history.length - 1].accuracy * 100).toFixed(1) + "%" : "0.0%";

  const prevAccuracy = history.length > 1 ? (history[history.length - 2].accuracy * 100) : 0;
  const currAccuracy = history.length > 0 ? (history[history.length - 1].accuracy * 100) : 0;
  const accuracyDelta = (currAccuracy - prevAccuracy).toFixed(2);
  const accuracyTrend = Number(accuracyDelta) >= 0 ? "up" : "down";

  const prevLoss = history.length > 1 ? history[history.length - 2].loss : 0;
  const currLoss = history.length > 0 ? history[history.length - 1].loss : 0;
  const lossDelta = Math.abs(currLoss - prevLoss).toFixed(4);
  const lossTrend = currLoss <= prevLoss ? "down" : "up";

  const nodeDetails = (status?.nodeDetails || []).filter(
    (node: any) => !node.status?.includes("STALE") && !node.status?.includes("DISCONNECTED")
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex">
      <Sidebar activeItem="Dashboard" />

      <main className="flex-1 ml-[250px] p-8 pb-20">
        <Header onReset={resetTraining} downloadUrl={`${API_URL}/api/model/download`} />

        {/* Online Status Pill */}
        <div className="flex items-center gap-6 mb-6">
          <div className="flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-sm">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${status ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-red-400"}`} />
            <span className="text-sm font-medium text-gray-600">{status ? "System Online" : "Connecting..."}</span>
          </div>
        </div>

        <ConfigPanel
          expectedNodesInput={expectedNodesInput}
          setExpectedNodesInput={setExpectedNodesInput}
          safetyThresholdInput={safetyThresholdInput}
          setSafetyThresholdInput={setSafetyThresholdInput}
          onApply={updateConfig}
          status={status}
        />

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <MetricCard
            title="Current Training Round"
            value={String(currentRound)}
            subtitle={`${currentRound} / ${TARGET_ROUNDS} to convergence`}
            icon={Target}
          >
            <div className="mt-3">
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </MetricCard>

          <MetricCard
            title="Model Accuracy"
            value={latestAccuracy}
            subtitle="Real-time evaluation"
            trend={accuracyTrend as "up" | "down"}
            trendValue={`${accuracyDelta}%`}
            icon={TrendingUp}
          />

          <MetricCard
            title="Training Loss"
            value={latestLoss}
            subtitle="Latest average loss"
            trend={lossTrend as "up" | "down"}
            trendValue={lossDelta}
            icon={TrendingDown}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <NodeActivityHeatmap nodeDetails={nodeDetails} history={history} />
          <AccuracyChart history={history} />
        </div>

        {/* Bottom Row: Table + Locations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <NodeClientsTable nodeDetails={nodeDetails} />
          </div>
          <NodeLocationsCard nodeDetails={nodeDetails} />
        </div>
      </main>
    </div>
  );
}
