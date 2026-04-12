"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/app/components/Header";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import ExportKPICards from "./ExportKPICards";
import ModelVersionTable from "./ModelVersionTable";
import ModelInfoCards from "./ModelInfoCards";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

const normalizeHistory = (input: any): any[] => {
  if (!Array.isArray(input)) return [];
  return [...input]
    .filter((item: any) => typeof item?.round === "number")
    .sort((a: any, b: any) => a.round - b.round);
};

export default function ExportPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ── Data fetching + WebSocket ──────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/status`).then((r) => r.json()),
      fetch(`${API_URL}/api/history`).then((r) => r.json()),
    ])
      .then(([statusData, historyData]) => {
        setStatus(statusData);
        setHistory(normalizeHistory(historyData));
        setIsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setIsLoading(false);
      });

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_URL}/ws-sockjs`),
      onConnect: () => {
        client.subscribe("/topic/updates", (message) => {
          if (message.body) {
            const data = JSON.parse(message.body);
            if (data.status) setStatus(data.status);
            if (Array.isArray(data.history)) setHistory(normalizeHistory(data.history));
          }
        });
      },
    });

    client.activate();
    return () => { client.deactivate(); };
  }, []);

  // ── Computed data ──────────────────────────────────────────────
  const currentRound = status?.currentRound || 0;

  const modelVersions = useMemo(() => {
    return [...history].reverse().map((round) => ({
      round: round.round,
      loss: round.loss || 0,
      accuracy: round.accuracy || 0,
      timestamp: round.timestamp || null,
      nodesParticipated: round.nodeStatuses ? Object.keys(round.nodeStatuses).length : 0,
    }));
  }, [history]);

  const latestModel = modelVersions.length > 0 ? modelVersions[0] : null;

  const heEnabled = status?.dynamicHyperparameters?.dpEnabled !== undefined; // HE is always on if we're in this setup
  const dpEnabled = status?.dynamicHyperparameters?.dpEnabled || false;

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl={`${API_URL}/api/model/download`} title="Model Export" />

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-l-2 border-argon-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mt-2">
          <ExportKPICards
            currentRound={currentRound}
            latestAccuracy={latestModel?.accuracy || 0}
            latestLoss={latestModel?.loss || 0}
            totalParams={null}
            apiUrl={API_URL}
          />

          <ModelVersionTable
            models={modelVersions}
            currentRound={currentRound}
            apiUrl={API_URL}
          />

          <ModelInfoCards
            currentRound={currentRound}
            totalRounds={modelVersions.length}
            heEnabled={heEnabled}
            dpEnabled={dpEnabled}
          />
        </div>
      )}
    </div>
  );
}
