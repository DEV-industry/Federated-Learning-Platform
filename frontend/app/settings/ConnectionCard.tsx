"use client";
import { useState } from "react";
import { Wifi, CheckCircle2, XCircle, Loader2, Globe, Radio, Shield } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

type TestState = "idle" | "testing" | "success" | "error";

export default function ConnectionCard() {
  const [testState, setTestState] = useState<TestState>("idle");
  const [latency, setLatency] = useState<number | null>(null);

  const testConnection = async () => {
    setTestState("testing");
    setLatency(null);
    const start = performance.now();

    try {
      const res = await fetch(`${API_URL}/api/health`, { signal: AbortSignal.timeout(8000) });
      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);

      if (res.ok) {
        setTestState("success");
      } else {
        setTestState("error");
      }
    } catch {
      setTestState("error");
      setLatency(null);
    }

    setTimeout(() => setTestState("idle"), 5000);
  };

  const protocols = [
    { label: "REST API", value: "HTTPS / TLS 1.3", badgeClass: "argon-badge-success" },
    { label: "gRPC Channel", value: "mTLS Secured", badgeClass: "argon-badge-success" },
    { label: "WebSocket", value: "WSS / SockJS", badgeClass: "argon-badge-info" },
    { label: "Authentication", value: "Ed25519 + JWT", badgeClass: "argon-badge-primary" },
  ];

  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
          <Wifi className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-argon-default">Connection & Transport</h3>
          <p className="text-xs text-argon-muted mt-0.5">Backend connectivity and security protocols.</p>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* API URL */}
        <div>
          <label className="text-xs font-bold text-argon-muted uppercase tracking-wider mb-2 block">
            API Endpoint
          </label>
          <div className="flex items-center gap-2 bg-argon-bg/50 border border-argon-lighter rounded-argon px-4 py-2.5">
            <Globe className="w-3.5 h-3.5 text-argon-light flex-shrink-0" />
            <span className="text-sm font-mono text-argon-default truncate">{API_URL}</span>
          </div>
        </div>

        {/* WebSocket URL */}
        <div>
          <label className="text-xs font-bold text-argon-muted uppercase tracking-wider mb-2 block">
            WebSocket Endpoint
          </label>
          <div className="flex items-center gap-2 bg-argon-bg/50 border border-argon-lighter rounded-argon px-4 py-2.5">
            <Radio className="w-3.5 h-3.5 text-argon-light flex-shrink-0" />
            <span className="text-sm font-mono text-argon-default truncate">{API_URL}/ws-sockjs</span>
          </div>
        </div>

        {/* Protocols */}
        <div>
          <label className="text-xs font-bold text-argon-muted uppercase tracking-wider mb-3 block">
            Security Protocols
          </label>
          <div className="space-y-2">
            {protocols.map((p) => (
              <div key={p.label} className="flex items-center justify-between py-2 border-b border-argon-lighter/50 last:border-0">
                <div className="flex items-center gap-2">
                  <Shield className="w-3 h-3 text-argon-light" />
                  <span className="text-sm text-argon-muted font-semibold">{p.label}</span>
                </div>
                <span className={`argon-badge ${p.badgeClass}`}>{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Test Connection */}
        <div className="pt-2">
          <button
            onClick={testConnection}
            disabled={testState === "testing"}
            className={`w-full py-3 px-4 font-bold text-sm rounded-argon transition-all duration-300 flex items-center justify-center gap-2 ${
              testState === "success"
                ? "bg-argon-success/10 text-argon-success border border-argon-success/30"
                : testState === "error"
                ? "bg-argon-danger/10 text-argon-danger border border-argon-danger/30"
                : "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-argon-sm hover:shadow-argon hover:-translate-y-px"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {testState === "testing" && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            )}
            {testState === "success" && (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Connected{latency !== null ? ` — ${latency}ms` : ""}
              </>
            )}
            {testState === "error" && (
              <>
                <XCircle className="w-4 h-4" />
                Connection Failed
              </>
            )}
            {testState === "idle" && (
              <>
                <Wifi className="w-4 h-4" />
                Test Connection
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
