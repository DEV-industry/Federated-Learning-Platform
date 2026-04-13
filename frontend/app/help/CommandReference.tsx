import { Terminal, Copy, CheckCircle2 } from "lucide-react";

const commands = [
  {
    label: "Start full platform",
    cmd: "docker-compose up -d --build",
    description: "Builds and launches all services (aggregator, frontend, nodes, DB, MinIO, RabbitMQ, Prometheus, Grafana, HE Sidecar).",
  },
  {
    label: "Rebuild frontend only",
    cmd: "docker-compose up -d --build frontend",
    description: "Rebuilds and restarts only the Next.js frontend container.",
  },
  {
    label: "View aggregator logs",
    cmd: "docker-compose logs -f aggregator",
    description: "Stream real-time logs from the Spring Boot aggregator to debug round aggregation and node submissions.",
  },
  {
    label: "View node logs",
    cmd: "docker-compose logs -f node_client_1",
    description: "Stream logs from a specific node client to monitor local training, weight uploads, and gRPC communication.",
  },
  {
    label: "Reset training data",
    cmd: "curl -X DELETE https://localhost:8443/api/training/reset -k",
    description: "Wipes all round history, model artifacts, and resets the aggregator to Round 0. Also available via Dashboard UI.",
  },
  {
    label: "Check system health",
    cmd: "curl https://localhost:8443/api/health -k",
    description: "Returns {\"status\":\"UP\"} when the aggregator is alive and connected to all dependencies.",
  },
];

export default function CommandReference() {
  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-slate-500 to-zinc-600 rounded-lg shadow-sm text-white">
          <Terminal className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-argon-default">Command Reference</h3>
          <p className="text-xs text-argon-muted mt-0.5">Essential CLI commands for platform management.</p>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {commands.map((c) => (
          <div key={c.label} className="border border-argon-lighter/60 rounded-xl p-4 hover:border-argon-primary/20 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">{c.label}</span>
            </div>
            <div className="bg-[#1e1e2e] rounded-lg px-4 py-3 mb-2 font-mono text-xs text-green-400 flex items-center justify-between gap-2 overflow-x-auto">
              <code className="whitespace-nowrap">{c.cmd}</code>
            </div>
            <p className="text-xs text-argon-muted leading-relaxed">{c.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
