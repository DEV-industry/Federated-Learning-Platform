import { Sliders, Database, Shield, Cpu, Zap } from "lucide-react";

interface ConfigParam {
  name: string;
  type: string;
  default: string;
  description: string;
  category: string;
}

const configParams: ConfigParam[] = [
  // Training
  { category: "Training", name: "minQuorum", type: "int", default: "2", description: "Minimum number of node submissions required before aggregation can proceed. Aggregation waits until this threshold is met or the round timeout expires." },
  { category: "Training", name: "minCompletionPercentage", type: "double", default: "0.6", description: "Fraction of active nodes that must submit for the dynamic quorum calculation: effectiveQuorum = max(minQuorum, ceil(activeNodes × minCompletionPercentage))." },
  { category: "Training", name: "roundTimeoutSeconds", type: "int", default: "300", description: "Maximum seconds to wait for node submissions per round. If the timeout is reached and at least minQuorum nodes have submitted, aggregation proceeds with available weights." },
  { category: "Training", name: "totalRounds", type: "int", default: "50", description: "Total number of federated training rounds. Training stops automatically when this number is reached." },
  { category: "Training", name: "localEpochs", type: "int", default: "3", description: "Number of local training epochs each node performs per round before submitting weights." },
  { category: "Training", name: "learningRate", type: "double", default: "0.01", description: "Initial learning rate for local SGD optimizer on each node. May be adjusted by the Dynamic Hyperparameter Controller." },
  { category: "Training", name: "batchSize", type: "int", default: "32", description: "Mini-batch size for local training on nodes. Affects training speed and gradient noise." },
  // FedProx
  { category: "FedProx", name: "fedProxMu", type: "double", default: "0.01", description: "Proximal regularization strength. Adds mu × ||w - w_global||² to the local loss, penalizing large deviations from the global model. Critical for non-IID data convergence." },
  { category: "FedProx", name: "fedProxAutoTune", type: "boolean", default: "true", description: "When enabled, the Dynamic Hyperparameter Controller automatically adjusts fedProxMu each round based on convergence trends." },
  // Security
  { category: "Security", name: "aggregationStrategy", type: "enum", default: "BULYAN", description: "Byzantine-robust aggregation algorithm. Options: FEDAVG (no defense), MULTI_KRUM (geometric scoring), BULYAN (Krum + trimmed mean). BULYAN requires ≥ 4f+3 nodes." },
  { category: "Security", name: "maliciousFraction", type: "double", default: "0.3", description: "Assumed ratio of potentially Byzantine (malicious) nodes. Used by Multi-Krum to calculate k = n - f - 2 trusted selections. Higher values increase robustness but reduce aggregation pool." },
  // Differential Privacy
  { category: "Differential Privacy", name: "dpEnabled", type: "boolean", default: "true", description: "Enable differential privacy noise injection. When active, calibrated Gaussian noise is added to aggregated weights before distribution." },
  { category: "Differential Privacy", name: "dpNoiseMultiplier", type: "double", default: "1.0", description: "Controls the noise scale: σ = noiseMultiplier × sensitivity / sqrt(n). Higher values provide stronger privacy guarantees but slow convergence." },
  { category: "Differential Privacy", name: "dpClipNorm", type: "double", default: "1.0", description: "Maximum L2 norm for gradient clipping before noise injection. Bounds sensitivity across nodes." },
  // Infrastructure
  { category: "Infrastructure", name: "heEnabled", type: "boolean", default: "true", description: "Enable Homomorphic Encryption (TenSEAL CKKS). When active, nodes encrypt weights client-side and the aggregator sums in ciphertext space via the HE Sidecar." },
  { category: "Infrastructure", name: "minioEndpoint", type: "string", default: "minio:9000", description: "MinIO S3-compatible endpoint for model artifact storage. Each round's model is saved as models/round-{N}.bin." },
  { category: "Infrastructure", name: "rabbitmqHost", type: "string", default: "rabbitmq", description: "RabbitMQ broker host for async weight processing queue. Nodes submit via gRPC → RabbitMQ → Aggregator processes." },
  { category: "Infrastructure", name: "eventLogLimit", type: "int", default: "200", description: "Maximum number of event log entries retained in-memory for the dashboard live log stream." },
];

const categories = Array.from(new Set(configParams.map((p) => p.category)));

const categoryIcons: Record<string, { icon: React.ElementType; gradient: string }> = {
  Training: { icon: Cpu, gradient: "from-blue-400 to-indigo-500" },
  FedProx: { icon: Zap, gradient: "from-purple-400 to-pink-500" },
  Security: { icon: Shield, gradient: "from-red-400 to-rose-500" },
  "Differential Privacy": { icon: Shield, gradient: "from-orange-400 to-amber-500" },
  Infrastructure: { icon: Database, gradient: "from-green-400 to-emerald-500" },
};

const typeColors: Record<string, string> = {
  int: "bg-blue-100 text-blue-700",
  double: "bg-purple-100 text-purple-700",
  boolean: "bg-emerald-100 text-emerald-700",
  string: "bg-amber-100 text-amber-700",
  enum: "bg-rose-100 text-rose-700",
};

export default function ConfigReference() {
  return (
    <div className="space-y-8">
      {categories.map((cat) => {
        const catMeta = categoryIcons[cat] || { icon: Sliders, gradient: "from-gray-400 to-gray-500" };
        const Icon = catMeta.icon;
        const params = configParams.filter((p) => p.category === cat);

        return (
          <div key={cat}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 bg-gradient-to-br ${catMeta.gradient} rounded-lg shadow-sm text-white`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-argon-default">{cat}</h3>
                <p className="text-xs text-argon-muted mt-0.5">{params.length} parameter{params.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            <div className="overflow-x-auto border border-argon-lighter/60 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-argon-lighter/30 border-b border-argon-lighter">
                    <th className="text-left py-3 px-4 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Parameter</th>
                    <th className="text-left py-3 px-4 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Type</th>
                    <th className="text-left py-3 px-4 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Default</th>
                    <th className="text-left py-3 px-4 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {params.map((p) => (
                    <tr key={p.name} className="border-b border-argon-lighter/50 hover:bg-argon-bg/50 transition-colors">
                      <td className="py-3 px-4 font-mono text-[0.8125rem] font-semibold text-argon-default whitespace-nowrap">{p.name}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[0.625rem] font-bold uppercase px-2 py-0.5 rounded-full ${typeColors[p.type] ?? "bg-gray-100 text-gray-600"}`}>
                          {p.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-[0.75rem] bg-argon-bg px-2 py-0.5 rounded font-mono text-argon-default">{p.default}</code>
                      </td>
                      <td className="py-3 px-4 text-xs text-argon-muted leading-relaxed max-w-md">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {/* Note */}
      <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-xl">
        <Sliders className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-bold text-purple-700 mb-1">Runtime Configuration</p>
          <p className="text-xs text-purple-600 leading-relaxed">
            Most parameters can be changed at runtime via POST /api/config or the Config dashboard page.
            Changes take effect starting from the next training round. Infrastructure parameters (MinIO, RabbitMQ)
            require a container restart.
          </p>
        </div>
      </div>
    </div>
  );
}
