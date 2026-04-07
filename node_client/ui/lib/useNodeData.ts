"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// The API base changes depending on whether we're in dev mode or served by Python
const API_BASE = typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port}`
  : "";

export interface NodeStatus {
  nodeId: string;
  status: string;
  currentRound: number;
  heEnabled: boolean;
  dpEnabled: boolean;
  uptimeSeconds: number;
  lastRoundDuration: number;
  totalRoundsCompleted: number;
  fedproxMu: number;
  dpNoiseMultiplier: number;
  currentBatch: number;
  totalBatches: number;
}

export interface HardwareMetrics {
  cpuPercent: number;
  ramPercent: number;
  ramUsedMb: number;
  ramTotalMb: number;
}

export interface MetricsData {
  lossHistory: Array<{ round: number; loss: number }>;
  accuracyHistory: Array<{ round: number; accuracy: number }>;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export function useNodeData() {
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [hardware, setHardware] = useState<HardwareMetrics | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Fetch status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  // Fetch hardware
  const fetchHardware = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/hardware`);
      if (res.ok) {
        setHardware(await res.json());
      }
    } catch {
      // silent
    }
  }, []);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/metrics`);
      if (res.ok) {
        setMetrics(await res.json());
      }
    } catch {
      // silent
    }
  }, []);

  // WebSocket connection for logs
  const connectWs = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.hostname}:${window.location.port}/ws/logs`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const entry: LogEntry = JSON.parse(event.data);
          setLogs((prev) => {
            const next = [...prev, entry];
            return next.length > 500 ? next.slice(-500) : next;
          });
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
        // Exponential backoff reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connectWs, delay);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // Retry after delay
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(connectWs, delay);
    }
  }, []);

  // Polling intervals
  useEffect(() => {
    fetchStatus();
    fetchHardware();
    fetchMetrics();

    const statusInterval = setInterval(fetchStatus, 2000);
    const hwInterval = setInterval(fetchHardware, 2000);
    const metricsInterval = setInterval(fetchMetrics, 3000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(hwInterval);
      clearInterval(metricsInterval);
    };
  }, [fetchStatus, fetchHardware, fetchMetrics]);

  // WebSocket lifecycle
  useEffect(() => {
    // Fetch initial logs via REST, then switch to WebSocket
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/logs`);
        if (res.ok) {
          const initialLogs = await res.json();
          setLogs(initialLogs);
        }
      } catch {
        // silent
      }
      connectWs();
    })();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  return { status, hardware, metrics, logs, connected, wsConnected };
}
