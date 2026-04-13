import { Shield, Lock, Key, Fingerprint, Eye, AlertTriangle } from "lucide-react";

interface SecurityFeature {
  title: string;
  icon: React.ElementType;
  gradient: string;
  description: string;
  details: string[];
}

const securityFeatures: SecurityFeature[] = [
  {
    title: "Mutual TLS (mTLS)",
    icon: Lock,
    gradient: "from-blue-400 to-indigo-500",
    description: "All gRPC communication between nodes and the aggregator is encrypted and mutually authenticated using X.509 certificates.",
    details: [
      "Server certificate: server.pem + server.key (aggregator)",
      "Client certificate: client.pem + client.key (each node)",
      "Trusted CA: ca.pem (shared root for certificate validation)",
      "gRPC channels enforce TLS 1.3 minimum",
      "Self-signed certs supported for development; use a proper CA for production",
    ],
  },
  {
    title: "Homomorphic Encryption (HE)",
    icon: Key,
    gradient: "from-orange-400 to-red-500",
    description: "Model weights are encrypted client-side using TenSEAL CKKS scheme. The aggregator never sees plaintext weights — aggregation happens in ciphertext space.",
    details: [
      "Scheme: CKKS (Cheon-Kim-Kim-Song) via TenSEAL library",
      "Key generation: he_context_public.b64 (all nodes) + he_context_secret.b64 (decryption sidecar)",
      "Encryption: Nodes encrypt weight tensors before gRPC transmission",
      "Aggregation: HE Sidecar sums CKKS ciphertexts (additive homomorphism)",
      "Decryption: Only the sidecar with the secret key can decrypt the final aggregated model",
      "Performance: ~3-5× overhead vs plaintext FedAvg; sidecar handles batch operations",
    ],
  },
  {
    title: "Byzantine-Robust Aggregation",
    icon: Shield,
    gradient: "from-red-400 to-rose-500",
    description: "Protection against model poisoning attacks from compromised or malicious nodes using statistical defense algorithms.",
    details: [
      "Multi-Krum: Scores updates by geometric distance to nearest neighbors, rejects outliers. k = n - f - 2, where f = maliciousFraction × n",
      "BULYAN: Applies Multi-Krum selection, then coordinate-wise trimmed mean on the surviving updates for additional robustness",
      "FedAvg: No defense — simple weighted average (for trusted environments only)",
      "Rejection tracking: Per-node rejection counts are maintained; consistently rejected nodes can be banned",
      "Dashboard visibility: Security Center shows per-round verdicts, threat levels, and rejection history",
    ],
  },
  {
    title: "Differential Privacy (DP)",
    icon: Eye,
    gradient: "from-purple-400 to-pink-500",
    description: "Calibrated Gaussian noise is injected into aggregated model updates to provide mathematical privacy guarantees against membership inference.",
    details: [
      "Mechanism: Gaussian noise with σ = noiseMultiplier × sensitivity / √n",
      "Gradient clipping: L2 norm bounded by dpClipNorm before noise injection",
      "Per-node privacy: Each node's contribution is bounded to limit information leakage",
      "Privacy budget: Tracked across rounds to ensure cumulative epsilon stays within bounds",
      "Toggle: DP can be enabled/disabled per node in the configuration panel",
    ],
  },
  {
    title: "Node Authentication",
    icon: Fingerprint,
    gradient: "from-emerald-400 to-green-500",
    description: "Nodes authenticate using Ed25519 digital signatures and receive JWT tokens for subsequent API calls.",
    details: [
      "Key generation: Each node generates an Ed25519 keypair at startup",
      "Registration: Node sends nodeId + publicKey + signature to RegisterNode RPC",
      "Verification: Aggregator validates signature against the provided public key",
      "JWT issuance: On successful auth, aggregator issues a JWT token for the session",
      "Ban enforcement: BANNED nodes are rejected at the authentication layer and cannot re-register",
    ],
  },
];

const threatMatrix = [
  { threat: "Model Poisoning", mitigation: "Multi-Krum / BULYAN filtering", severity: "Critical", status: "Active" },
  { threat: "Data Inference", mitigation: "Homomorphic Encryption + DP noise", severity: "High", status: "Active" },
  { threat: "Man-in-the-Middle", mitigation: "Mutual TLS on all channels", severity: "Critical", status: "Active" },
  { threat: "Sybil Attack", mitigation: "Ed25519 node identity + admin ban", severity: "High", status: "Active" },
  { threat: "Gradient Leakage", mitigation: "CKKS encryption + DP clipping", severity: "High", status: "Active" },
  { threat: "Free-Riding Nodes", mitigation: "Contribution tracking + quorum enforcement", severity: "Medium", status: "Active" },
];

const severityColors: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-green-100 text-green-700",
};

export default function SecurityDocs() {
  return (
    <div className="space-y-8">
      {/* Security Features */}
      <div className="space-y-4">
        {securityFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <div key={feature.title} className="border border-argon-lighter/60 rounded-xl p-5 hover:border-argon-primary/20 transition-all duration-200">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 bg-gradient-to-br ${feature.gradient} rounded-lg shadow-sm text-white`}>
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-argon-default">{feature.title}</h3>
              </div>
              <p className="text-xs text-argon-muted leading-relaxed mb-4">{feature.description}</p>
              <div className="space-y-2">
                {feature.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-argon-primary mt-1.5 flex-shrink-0" />
                    <p className="text-xs text-argon-muted leading-relaxed">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Threat Matrix */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-slate-500 to-zinc-600 rounded-lg shadow-sm text-white">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">Threat Mitigation Matrix</h3>
            <p className="text-xs text-argon-muted mt-0.5">Known threats and active countermeasures.</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-argon-lighter/60 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-argon-lighter/30 border-b border-argon-lighter">
                <th className="text-left py-3 px-4 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Threat</th>
                <th className="text-left py-3 px-4 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Mitigation</th>
                <th className="text-left py-3 px-4 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Severity</th>
                <th className="text-left py-3 px-4 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {threatMatrix.map((row) => (
                <tr key={row.threat} className="border-b border-argon-lighter/50 hover:bg-argon-bg/50 transition-colors">
                  <td className="py-3 px-4 text-xs font-semibold text-argon-default">{row.threat}</td>
                  <td className="py-3 px-4 text-xs text-argon-muted">{row.mitigation}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[0.625rem] font-bold uppercase px-2 py-0.5 rounded-full ${severityColors[row.severity]}`}>
                      {row.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
