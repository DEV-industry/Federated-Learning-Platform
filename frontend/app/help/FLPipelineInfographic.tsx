import { Shield, Layers, Server, Cpu, ArrowRight, Database, Lock, Zap, GitBranch } from "lucide-react";

const steps = [
  {
    step: 1,
    title: "Node Registration",
    description: "Each node authenticates using Ed25519 keypair and registers with the aggregator via mTLS.",
    icon: Server,
    gradient: "from-blue-400 to-indigo-500",
    detail: "Ed25519 + JWT",
  },
  {
    step: 2,
    title: "Local Training",
    description: "Nodes train locally on private data using MNIST (or custom) datasets with FedProx regularization.",
    icon: Cpu,
    gradient: "from-purple-400 to-pink-500",
    detail: "PyTorch + FedProx",
  },
  {
    step: 3,
    title: "HE Encryption",
    description: "Model weights are encrypted with TenSEAL CKKS homomorphic encryption before transmission.",
    icon: Lock,
    gradient: "from-orange-400 to-red-500",
    detail: "TenSEAL CKKS",
  },
  {
    step: 4,
    title: "Secure Upload",
    description: "Encrypted weights are sent via gRPC over mTLS and stored in MinIO object storage.",
    icon: Database,
    gradient: "from-green-400 to-emerald-500",
    detail: "gRPC + MinIO",
  },
  {
    step: 5,
    title: "Byzantine Verification",
    description: "Aggregator applies Multi-Krum or BULYAN to filter poisoned model updates from malicious nodes.",
    icon: Shield,
    gradient: "from-red-400 to-rose-500",
    detail: "Multi-Krum / BULYAN",
  },
  {
    step: 6,
    title: "Global Aggregation",
    description: "Valid updates are aggregated into the new global model. Hyperparameters are auto-tuned per round.",
    icon: Layers,
    gradient: "from-cyan-400 to-blue-500",
    detail: "FedAvg + Auto-Tune",
  },
];

export default function FLPipelineInfographic() {
  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm text-white">
          <GitBranch className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-argon-default">Federated Learning Pipeline</h3>
          <p className="text-xs text-argon-muted mt-0.5">End-to-end flow of a single training round.</p>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div key={s.step} className="relative group">
                <div className="p-5 rounded-xl border border-argon-lighter/60 hover:border-argon-primary/30 transition-all duration-300 hover:shadow-md bg-white h-full">
                  {/* Step number + icon */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className="text-[0.625rem] font-bold text-argon-light uppercase tracking-widest">Step {s.step}</span>
                      <h4 className="text-sm font-bold text-argon-default leading-tight">{s.title}</h4>
                    </div>
                  </div>
                  {/* Description */}
                  <p className="text-xs text-argon-muted leading-relaxed mb-3">{s.description}</p>
                  {/* Tech badge */}
                  <span className="inline-block text-[0.625rem] font-bold bg-argon-bg text-argon-muted px-2.5 py-1 rounded-full">
                    {s.detail}
                  </span>
                </div>
                {/* Arrow connector */}
                {idx < steps.length - 1 && (
                  <>
                    {/* Show on XL screens (3 columns) */}
                    {idx % 3 !== 2 && (
                      <div className="hidden xl:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-white border border-argon-lighter flex items-center justify-center shadow-sm">
                          <ArrowRight className="w-4 h-4 text-argon-primary" />
                        </div>
                      </div>
                    )}
                    {/* Show on MD screens (2 columns) */}
                    {idx % 2 === 0 && (
                      <div className="hidden md:flex xl:hidden absolute -right-4 top-1/2 -translate-y-1/2 z-10 items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-white border border-argon-lighter flex items-center justify-center shadow-sm">
                          <ArrowRight className="w-4 h-4 text-argon-primary" />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
