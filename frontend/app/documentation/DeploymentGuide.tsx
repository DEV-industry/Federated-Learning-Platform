import { Rocket, CheckCircle2, FileText, Monitor, HardDrive, AlertTriangle } from "lucide-react";

interface DeployStep {
  step: number;
  title: string;
  description: string;
  commands: string[];
  note?: string;
}

const prerequisites = [
  { label: "Docker Engine", version: "≥ 20.10", icon: HardDrive },
  { label: "Docker Compose", version: "≥ 2.0", icon: FileText },
  { label: "Git", version: "≥ 2.30", icon: Monitor },
  { label: "Node.js (for local dev)", version: "≥ 18.0", icon: Monitor },
  { label: "JDK (for aggregator dev)", version: "≥ 17", icon: Monitor },
  { label: "Python (for node client dev)", version: "≥ 3.10", icon: Monitor },
];

const deploySteps: DeployStep[] = [
  {
    step: 1,
    title: "Clone the Repository",
    description: "Pull the complete monorepo containing the aggregator, frontend, node client, and infrastructure configs.",
    commands: ["git clone https://github.com/your-org/Federated-Learning-Platform.git", "cd Federated-Learning-Platform"],
  },
  {
    step: 2,
    title: "Generate TLS Certificates",
    description: "Create the CA root certificate, aggregator server cert, and client certificates for nodes. All gRPC communication uses mutual TLS.",
    commands: [
      "cd certs/",
      "# Generate CA",
      "openssl req -x509 -newkey rsa:4096 -keyout ca.key -out ca.pem -days 365 -nodes",
      "# Generate server cert signed by CA",
      "openssl req -newkey rsa:4096 -keyout server.key -out server.csr -nodes",
      "openssl x509 -req -in server.csr -CA ca.pem -CAkey ca.key -out server.pem -days 365",
    ],
    note: "Pre-generated certs are included in the repo for development. Replace with proper certs for production.",
  },
  {
    step: 3,
    title: "Generate HE Context",
    description: "Create the shared homomorphic encryption context. All nodes need the public context; the aggregator HE sidecar needs both public and secret keys.",
    commands: [
      "cd he-context/",
      "python generate_context.py",
      "# Outputs: he_context_public.b64, he_context_secret.b64",
    ],
    note: "The HE context must be shared across all nodes. Copy he_context_public.b64 to every node client.",
  },
  {
    step: 4,
    title: "Configure Environment",
    description: "Copy the environment template and set required variables. The defaults work for single-machine Docker deployment.",
    commands: [
      "cp .env.example .env",
      "",
      "# Key variables:",
      "AGGREGATOR_PORT=8443",
      "GRPC_PORT=9090",
      "POSTGRES_PASSWORD=your_secure_password",
      "MINIO_ACCESS_KEY=minioadmin",
      "MINIO_SECRET_KEY=your_secret_key",
    ],
  },
  {
    step: 5,
    title: "Launch the Platform",
    description: "Build and start all services. First launch pulls base images and builds containers (takes 3-5 minutes).",
    commands: [
      "docker-compose up -d --build",
      "",
      "# Verify everything is running:",
      "docker-compose ps",
      "",
      "# Check aggregator health:",
      "curl -k https://localhost:8443/api/health",
    ],
  },
  {
    step: 6,
    title: "Access the Dashboard",
    description: "Open the platform dashboard in your browser. All services should show as healthy.",
    commands: [
      "# Frontend:    https://localhost:3000",
      "# Aggregator:  https://localhost:8443",
      "# Grafana:     http://localhost:3001",
      "# MinIO:       http://localhost:9001",
      "# Prometheus:  http://localhost:9090",
    ],
  },
];

const externalNodeSteps = [
  "Copy TLS certificates (ca.pem, client.pem, client.key) to the external machine.",
  "Copy the HE public context (he_context_public.b64) to the external machine.",
  "Set AGGREGATOR_URL to the main machine's IP (e.g., https://192.168.1.100:8443).",
  "Set GRPC_TARGET to the main machine's gRPC endpoint (e.g., 192.168.1.100:9090).",
  "Set a unique NODE_ID for this client.",
  "Run: docker-compose -f docker-compose-laptop.yml up -d --build",
];

export default function DeploymentGuide() {
  return (
    <div className="space-y-8">
      {/* Prerequisites */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">Prerequisites</h3>
            <p className="text-xs text-argon-muted mt-0.5">Required software before deploying the platform.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {prerequisites.map((req) => {
            const Icon = req.icon;
            return (
              <div key={req.label} className="flex items-center gap-3 p-3 border border-argon-lighter/60 rounded-xl hover:border-argon-primary/20 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-argon-bg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-argon-muted" />
                </div>
                <div>
                  <p className="text-xs font-bold text-argon-default">{req.label}</p>
                  <p className="text-[0.625rem] text-argon-muted font-mono">{req.version}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deployment Steps */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
            <Rocket className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">Deployment Steps</h3>
            <p className="text-xs text-argon-muted mt-0.5">Step-by-step guide for Docker Compose deployment.</p>
          </div>
        </div>

        <div className="space-y-4">
          {deploySteps.map((s) => (
            <div key={s.step} className="border border-argon-lighter/60 rounded-xl p-5 hover:border-argon-primary/20 transition-all duration-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {s.step}
                </div>
                <h4 className="text-sm font-bold text-argon-default">{s.title}</h4>
              </div>
              <p className="text-xs text-argon-muted leading-relaxed mb-3">{s.description}</p>
              <div className="bg-[#1e1e2e] rounded-lg px-4 py-3 font-mono text-[0.6875rem] text-green-400 overflow-x-auto space-y-0.5">
                {s.commands.map((cmd, i) => (
                  <div key={i} className={cmd.startsWith("#") ? "text-gray-500" : cmd === "" ? "h-2" : ""}>
                    {cmd && <code>{cmd}</code>}
                  </div>
                ))}
              </div>
              {s.note && (
                <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[0.6875rem] text-amber-700 leading-relaxed">{s.note}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* External Node */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg shadow-sm text-white">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">Connecting External Nodes</h3>
            <p className="text-xs text-argon-muted mt-0.5">Add a node client from another machine to the training cluster.</p>
          </div>
        </div>

        <div className="border border-argon-lighter/60 rounded-xl p-5">
          <div className="space-y-3">
            {externalNodeSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[0.625rem] font-bold flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-xs text-argon-muted leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
