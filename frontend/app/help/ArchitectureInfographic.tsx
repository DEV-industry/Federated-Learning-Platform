import { Layers, Server, Shield, Database, Lock, Cpu, Eye, Zap } from "lucide-react";

interface LayerItem {
  label: string;
  components: string[];
  color: string;
  bgColor: string;
  Icon: React.ElementType;
}

const layers: LayerItem[] = [
  {
    label: "Presentation Layer",
    components: ["Next.js 14 Dashboard", "Real-time WebSocket UI", "Argon Design System"],
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    Icon: Eye,
  },
  {
    label: "API Gateway",
    components: ["Spring Boot REST API", "gRPC Service (mTLS)", "SockJS / STOMP WebSocket"],
    color: "text-indigo-600",
    bgColor: "bg-indigo-50 border-indigo-200",
    Icon: Zap,
  },
  {
    label: "Orchestration Layer",
    components: ["Aggregator Coordinator", "Round Aggregation Service", "Dynamic Hyperparameter Controller"],
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
    Icon: Layers,
  },
  {
    label: "Security Layer",
    components: ["Multi-Krum / BULYAN Filter", "Node Credential Service (Ed25519)", "Differential Privacy Engine"],
    color: "text-red-600",
    bgColor: "bg-red-50 border-red-200",
    Icon: Shield,
  },
  {
    label: "Crypto Layer",
    components: ["TenSEAL CKKS HE Sidecar", "Shared HE Context (Public/Private)", "Encrypted Aggregation"],
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200",
    Icon: Lock,
  },
  {
    label: "Data & Storage Layer",
    components: ["PostgreSQL (Round History)", "MinIO (Model Artifacts)", "RabbitMQ (Message Queue)"],
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
    Icon: Database,
  },
  {
    label: "Compute Layer",
    components: ["Python Node Clients (PyTorch)", "MNIST / Custom Datasets", "FedProx Local Training"],
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 border-cyan-200",
    Icon: Cpu,
  },
  {
    label: "Monitoring Layer",
    components: ["Prometheus Metrics", "Grafana Dashboards", "Micrometer Instrumentation"],
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-200",
    Icon: Server,
  },
];

export default function ArchitectureInfographic() {
  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg shadow-sm text-white">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-argon-default">System Architecture</h3>
          <p className="text-xs text-argon-muted mt-0.5">Platform layer stack — from UI to compute nodes.</p>
        </div>
      </div>

      <div className="p-6 space-y-2">
        {layers.map((layer, idx) => {
          const Icon = layer.Icon;
          return (
            <div key={layer.label}>
              <div className={`flex items-center gap-4 p-4 rounded-xl border ${layer.bgColor} transition-all duration-200 hover:shadow-sm`}>
                {/* Icon + Label */}
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-white shadow-sm flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${layer.color}`} />
                  </div>
                  <span className={`text-sm font-bold ${layer.color} whitespace-nowrap`}>{layer.label}</span>
                </div>
                {/* Components */}
                <div className="flex flex-wrap gap-2">
                  {layer.components.map((comp) => (
                    <span key={comp} className="text-[0.6875rem] font-semibold text-argon-default bg-white px-3 py-1 rounded-full shadow-sm border border-argon-lighter/80">
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
              {/* Connector */}
              {idx < layers.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <div className="w-px h-2 bg-argon-lighter"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
