"use client";
import { useEffect, useState } from "react";
import { Target, TrendingUp, TrendingDown, Users } from "lucide-react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

import Header from "./components/Header";
import MetricCard from "./components/MetricCard";
import NodeActivityHeatmap from "./components/NodeActivityHeatmap";
import AccuracyChart from "./components/AccuracyChart";
import NodeClientsTable from "./components/NodeClientsTable";
import NodeLocationsCard from "./components/NodeLocationsCard";
import ConfigPanel from "./components/ConfigPanel";
import RoundStepper from "./components/RoundStepper";
import EventTerminal from "./components/EventTerminal";
import NetworkGraph from "./components/NetworkGraph";

const normalizeHistory = (input: any): any[] => {
  if (!Array.isArray(input)) return [];
  return [...input]
    .filter((item: any) => typeof item?.round === "number")
    .sort((a: any, b: any) => a.round - b.round);
};

export default function Home() {
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [expectedNodesInput, setExpectedNodesInput] = useState<string>("");
  const [maliciousFractionInput, setMaliciousFractionInput] = useState<string>("");
  const [eventLogs, setEventLogs] = useState<string[]>([]);
  const [nodeActivity, setNodeActivity] = useState<Record<string, { status: string; detail: string }>>({});
  const [globalStage, setGlobalStage] = useState<string>("IDLE");

  useEffect(() => {
    const fetchStatus = () => {
      fetch(`${API_URL}/api/status`)
        .then((res) => res.json())
        .then((data) => {
          setStatus(data);
          if (!expectedNodesInput) setExpectedNodesInput(data.expectedNodes?.toString() || "2");
          if (!maliciousFractionInput) setMaliciousFractionInput(data.maliciousFraction?.toString() || "0.3");
          if (data.eventLogs) setEventLogs(data.eventLogs);
          if (data.nodeActivity) setNodeActivity(data.nodeActivity);
          if (data.globalStage) setGlobalStage(data.globalStage);
        })
        .catch((err) => console.error(err));

      fetch(`${API_URL}/api/history`)
        .then((res) => res.json())
        .then((data) => {
          setHistory(normalizeHistory(data));
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
            if (data.status) setStatus(data.status);
            if (Array.isArray(data.history)) {
              setHistory(normalizeHistory(data.history));
            }
            if (data.eventLogs) setEventLogs(data.eventLogs);
            if (data.nodeActivity) setNodeActivity(data.nodeActivity);
            if (data.globalStage) setGlobalStage(data.globalStage);
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
  }, [expectedNodesInput, maliciousFractionInput]);

  const resetTraining = async () => {
    if (!confirm("Are you sure you want to reset all federated training rounds? This permanently deletes the Postgres database records.")) return;
    try {
      await fetch(`${API_URL}/api/training/reset`, { method: "DELETE" });
      setStatus(null);
      setHistory([]);
      setEventLogs([]);
      setNodeActivity({});
      setGlobalStage("IDLE");
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
          maliciousFraction: parseFloat(maliciousFractionInput),
        }),
      });
      alert(`Config updated! Required Nodes: ${expectedNodesInput}, Malicious Fraction: ${maliciousFractionInput}`);
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

  const nodeDetails = status?.nodeDetails || [];
  const totalNodes = status?.totalNodes || 0;

  return (
    <div className="flex flex-col">
      <Header onReset={resetTraining} downloadUrl={`${API_URL}/api/model/download`} />

        {/* Online Status Pill */}
        <div className="flex items-center gap-6 mb-6">
          <div className="flex items-center gap-2 argon-card px-4 py-2 rounded-full">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${status ? "bg-argon-success shadow-[0_0_6px_rgba(45,206,137,0.5)]" : "bg-argon-danger"}`} />
            <span className="text-sm font-semibold text-argon-muted">{status ? "System Online" : "Connecting..."}</span>
          </div>
        </div>

        <ConfigPanel
          expectedNodesInput={expectedNodesInput}
          setExpectedNodesInput={setExpectedNodesInput}
          maliciousFractionInput={maliciousFractionInput}
          setMaliciousFractionInput={setMaliciousFractionInput}
          onApply={updateConfig}
          status={status}
        />

        {/* 4-Column KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          <MetricCard
            title="Training Round"
            value={String(currentRound)}
            subtitle={`${currentRound} / ${TARGET_ROUNDS} target`}
            icon={Target}
            iconColor="primary"
          >
            <div className="mt-3">
              <div className="w-full bg-argon-lighter rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-argon-primary to-[#825ee4] h-1.5 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </MetricCard>

          <MetricCard
            title="Model Accuracy"
            value={latestAccuracy}
            subtitle="since last round"
            trend={accuracyTrend as "up" | "down"}
            trendValue={`${accuracyDelta}%`}
            icon={TrendingUp}
            iconColor="success"
          />

          <MetricCard
            title="Training Loss"
            value={latestLoss}
            subtitle="latest average"
            trend={lossTrend as "up" | "down"}
            trendValue={lossDelta}
            icon={TrendingDown}
            iconColor="warning"
          />

          <MetricCard
            title="Active Nodes"
            value={String(totalNodes)}
            subtitle={`of ${status?.expectedNodes || "?"} expected`}
            icon={Users}
            iconColor="info"
          />
        </div>

        {/* Charts Row: Accuracy (left, larger) + Network Graph (right, hero) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-6">
          <div className="lg:col-span-3">
            <AccuracyChart history={history} />
          </div>
          <div className="lg:col-span-2">
            <NetworkGraph nodeActivity={nodeActivity} globalStage={globalStage} />
          </div>
        </div>

        {/* Heatmap + Event Terminal Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <NodeActivityHeatmap nodeDetails={nodeDetails} history={history} currentRound={currentRound} />
          <EventTerminal eventLogs={eventLogs} />
        </div>

        {/* Round Pipeline Stepper */}
        <RoundStepper globalStage={globalStage} currentRound={currentRound} />

        {/* Bottom Row: Table + Locations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <NodeClientsTable nodeDetails={nodeDetails} nodeActivity={nodeActivity} />
          </div>
          <NodeLocationsCard nodeDetails={nodeDetails} />
      </div>
    </div>
  );
}
