"use client";
import { useState } from "react";
import { Wrench, ChevronDown, AlertTriangle, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

interface Issue {
  title: string;
  category: string;
  symptoms: string[];
  causes: string[];
  solutions: string[];
  commands?: string[];
}

const issues: Issue[] = [
  {
    category: "Connection",
    title: "Nodes cannot connect to the aggregator",
    symptoms: [
      "Node logs show: 'Connection refused' or 'TLS handshake failed'",
      "Dashboard shows 0 connected nodes",
    ],
    causes: [
      "Aggregator container is not running or hasn't finished starting",
      "TLS certificates are invalid, expired, or not shared correctly",
      "Firewall blocking port 9090 (gRPC) or 8443 (REST)",
      "Node is using wrong AGGREGATOR_URL or GRPC_TARGET",
    ],
    solutions: [
      "Verify aggregator is running: docker-compose ps aggregator",
      "Check aggregator startup logs: docker-compose logs -f aggregator",
      "Validate certs: openssl verify -CAfile ca.pem client.pem",
      "Ensure ports 8443 and 9090 are open on the host machine",
      "Verify environment variables in the node .env file",
    ],
    commands: [
      "docker-compose ps aggregator",
      "docker-compose logs --tail=50 aggregator",
      "openssl verify -CAfile ca.pem client.pem",
      "netstat -tlnp | grep -E '(8443|9090)'",
    ],
  },
  {
    category: "Training",
    title: "Training rounds are not progressing",
    symptoms: [
      "Dashboard shows the same round number for an extended period",
      "Logs show 'Waiting for quorum' repeatedly",
    ],
    causes: [
      "Not enough active nodes to meet the quorum requirement",
      "Nodes are stalled during local training (check node logs)",
      "Round timeout is too long and nodes have disconnected",
      "HE encryption/decryption failure in the sidecar",
    ],
    solutions: [
      "Lower minQuorum in configuration if fewer nodes are available",
      "Check node logs for training errors: docker-compose logs node_client_1",
      "Reduce roundTimeoutSeconds to fail faster",
      "Check HE sidecar logs: docker-compose logs he-sidecar",
      "Verify all nodes share the same he_context_public.b64",
    ],
    commands: [
      "docker-compose logs --tail=20 node_client_1",
      "docker-compose logs --tail=20 he-sidecar",
      "curl -k https://localhost:8443/api/status | jq '.currentRound'",
    ],
  },
  {
    category: "Training",
    title: "Accuracy is not improving or loss is diverging",
    symptoms: [
      "Accuracy stuck at random chance level (~10% for MNIST)",
      "Loss increasing or oscillating wildly after initial rounds",
    ],
    causes: [
      "Learning rate too high — weights oscillate and never converge",
      "FedProx mu too high — over-regularization prevents learning",
      "DP noise multiplier too high — noise dominates the signal",
      "Byzantine filter too aggressive — rejecting valid updates",
      "Non-IID data distribution across nodes without FedProx",
    ],
    solutions: [
      "Reduce learning rate (try 0.001 or 0.005)",
      "Lower fedProxMu (try 0.001)",
      "Reduce dpNoiseMultiplier or disable DP temporarily for debugging",
      "Lower maliciousFraction if all nodes are trusted",
      "Enable FedProx auto-tuning for adaptive regularization",
    ],
  },
  {
    category: "Infrastructure",
    title: "Database connection failures",
    symptoms: [
      "Aggregator logs: 'Connection to PostgreSQL refused'",
      "Dashboard shows no historical data",
    ],
    causes: [
      "PostgreSQL container not running or crashed",
      "Incorrect POSTGRES_PASSWORD environment variable",
      "Database volume corrupted after unclean shutdown",
    ],
    solutions: [
      "Restart the database: docker-compose restart postgres",
      "Check PostgreSQL logs: docker-compose logs postgres",
      "Verify connection string in aggregator's application.properties",
      "If volume is corrupted, remove and recreate: docker volume rm fl_postgres_data",
    ],
    commands: [
      "docker-compose restart postgres",
      "docker-compose logs --tail=20 postgres",
      "docker-compose exec postgres pg_isready",
    ],
  },
  {
    category: "Infrastructure",
    title: "MinIO storage errors",
    symptoms: [
      "Model export/download fails",
      "Aggregator logs: 'S3 connection refused' or 'bucket not found'",
    ],
    causes: [
      "MinIO container not running",
      "The 'models' bucket was not created on first startup",
      "Incorrect MINIO_ACCESS_KEY or MINIO_SECRET_KEY",
    ],
    solutions: [
      "Restart MinIO: docker-compose restart minio",
      "Create the bucket manually via MinIO console at http://localhost:9001",
      "Verify environment variables match between .env and docker-compose.yml",
    ],
    commands: [
      "docker-compose restart minio",
      "docker-compose logs --tail=20 minio",
    ],
  },
  {
    category: "Security",
    title: "All nodes are being rejected by Byzantine filter",
    symptoms: [
      "Security Center shows 100% rejection rate",
      "No aggregation occurs despite all nodes submitting",
    ],
    causes: [
      "maliciousFraction set too high for the number of connected nodes",
      "BULYAN requires at least 4f+3 nodes; insufficient nodes connected",
      "HE context mismatch causing weight decryption to produce garbage values",
    ],
    solutions: [
      "Lower maliciousFraction (try 0.1 for 2-3 trusted nodes)",
      "Switch to MULTI_KRUM which has lower node count requirements",
      "Verify all nodes and the sidecar share the same HE context files",
      "For testing, temporarily switch to FEDAVG (no defense)",
    ],
  },
];

const categories = Array.from(new Set(issues.map((i) => i.category)));

const categoryColors: Record<string, string> = {
  Connection: "from-blue-400 to-indigo-500",
  Training: "from-purple-400 to-pink-500",
  Infrastructure: "from-green-400 to-emerald-500",
  Security: "from-red-400 to-rose-500",
};

export default function TroubleshootingGuide() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState(categories[0]);

  const filtered = issues.filter((i) => i.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setOpenIndex(null); }}
            className={`px-4 py-2 text-xs font-bold rounded-full transition-all duration-200 ${
              activeCategory === cat
                ? "bg-argon-primary text-white shadow-argon-primary"
                : "bg-argon-bg text-argon-muted hover:bg-argon-lighter"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Issues */}
      <div className="space-y-3">
        {filtered.map((issue, idx) => {
          const globalIdx = issues.indexOf(issue);
          const isOpen = openIndex === globalIdx;

          return (
            <div key={globalIdx} className={`border rounded-xl transition-all duration-300 ${isOpen ? "border-argon-primary/30 shadow-sm" : "border-argon-lighter/60"}`}>
              <button
                onClick={() => setOpenIndex(isOpen ? null : globalIdx)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${categoryColors[issue.category]} flex items-center justify-center flex-shrink-0`}>
                    <Wrench className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className={`text-sm font-semibold transition-colors ${isOpen ? "text-argon-primary" : "text-argon-default"}`}>
                    {issue.title}
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 text-argon-light transition-transform duration-300 ${isOpen ? "rotate-180 text-argon-primary" : ""}`} />
              </button>

              <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[800px]" : "max-h-0"}`}>
                <div className="px-5 pb-5 pt-0 space-y-4">
                  {/* Symptoms */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-bold text-argon-default uppercase tracking-wider">Symptoms</span>
                    </div>
                    <div className="space-y-1.5 pl-5">
                      {issue.symptoms.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <XCircle className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-argon-muted leading-relaxed">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Causes */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-bold text-argon-default uppercase tracking-wider">Possible Causes</span>
                    </div>
                    <div className="space-y-1.5 pl-5">
                      {issue.causes.map((c, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                          <p className="text-xs text-argon-muted leading-relaxed">{c}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Solutions */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-xs font-bold text-argon-default uppercase tracking-wider">Solutions</span>
                    </div>
                    <div className="space-y-1.5 pl-5">
                      {issue.solutions.map((s, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-argon-muted leading-relaxed">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Debug commands */}
                  {issue.commands && (
                    <div>
                      <span className="text-[0.625rem] font-bold text-argon-light uppercase tracking-wider">Debug Commands</span>
                      <div className="bg-[#1e1e2e] rounded-lg px-4 py-3 mt-1.5 font-mono text-[0.6875rem] text-green-400 overflow-x-auto space-y-1">
                        {issue.commands.map((cmd, i) => (
                          <div key={i}><code>{cmd}</code></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
