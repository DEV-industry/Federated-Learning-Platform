"use client";
import { useEffect, useState, useMemo } from "react";
import Header from "@/app/components/Header";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";

import LogKPICards from "./LogKPICards";
import LiveLogTerminal from "./LiveLogTerminal";
import NodeActivityCards from "./NodeActivityCards";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

export default function LogsPage() {
  const [eventLogs, setEventLogs] = useState<string[]>([]);
  const [nodeActivity, setNodeActivity] = useState<Record<string, { status: string; detail: string }>>({});
  const [globalStage, setGlobalStage] = useState<string>("IDLE");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ── Data fetching + WebSocket ──────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/api/status`)
      .then((res) => res.json())
      .then((data) => {
        if (data.eventLogs) setEventLogs(data.eventLogs);
        if (data.nodeActivity) setNodeActivity(data.nodeActivity);
        if (data.globalStage) setGlobalStage(data.globalStage);
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
            if (data.eventLogs) setEventLogs(data.eventLogs);
            if (data.nodeActivity) setNodeActivity(data.nodeActivity);
            if (data.globalStage) setGlobalStage(data.globalStage);
          }
        });
      },
    });

    client.activate();
    return () => {
      client.deactivate();
    };
  }, []);

  // ── Computed stats ─────────────────────────────────────────────
  const totalEvents = eventLogs.length;
  const activeNodes = Object.keys(nodeActivity).length;
  const trainingEvents = useMemo(() => {
    return eventLogs.filter((log) => /train/i.test(log)).length;
  }, [eventLogs]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      <Header onReset={() => {}} downloadUrl="#" title="System Logs" />

      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-l-2 border-argon-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6 mt-2">
          <LogKPICards
            totalEvents={totalEvents}
            globalStage={globalStage}
            activeNodes={activeNodes}
            trainingEvents={trainingEvents}
          />

          <LiveLogTerminal eventLogs={eventLogs} />

          <NodeActivityCards nodeActivity={nodeActivity} />
        </div>
      )}
    </div>
  );
}
