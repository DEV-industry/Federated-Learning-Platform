import { Lock, ShieldCheck, Fingerprint } from "lucide-react";

interface Props {
  maliciousFraction?: number;
}

export default function SecurityFeatureCards({ maliciousFraction }: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      {/* Transport Security */}
      <div className="argon-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-argon-default">Transport Security</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">REST API</span>
            <span className="argon-badge argon-badge-success">HTTPS / TLS 1.3</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">gRPC Channel</span>
            <span className="argon-badge argon-badge-success">mTLS Secured</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">WebSocket</span>
            <span className="argon-badge argon-badge-success">WSS / SockJS</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-argon-muted font-semibold">Node Auth</span>
            <span className="argon-badge argon-badge-primary">Ed25519 + JWT</span>
          </div>
        </div>
      </div>

      {/* Aggregation Defense */}
      <div className="argon-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-lg shadow-sm text-white">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-argon-default">Aggregation Defense</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Strategy</span>
            <span className="argon-badge argon-badge-primary">Bulyan (Multi-Krum)</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Malicious Fraction</span>
            <span className="text-sm font-bold text-argon-danger">
              {maliciousFraction !== undefined ? (maliciousFraction * 100).toFixed(0) + "%" : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Gradient Clipping</span>
            <span className="argon-badge argon-badge-success">L2 Norm ≤ 1.0</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-argon-muted font-semibold">Weight Validation</span>
            <span className="argon-badge argon-badge-success">NaN / Inf Guard</span>
          </div>
        </div>
      </div>

      {/* Privacy Stack */}
      <div className="argon-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
            <Fingerprint className="w-4 h-4" />
          </div>
          <h3 className="text-base font-bold text-argon-default">Privacy Stack</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Homomorphic Enc.</span>
            <span className="argon-badge argon-badge-primary">TenSEAL CKKS</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">HE Poly Degree</span>
            <span className="text-sm font-bold text-argon-default">8192</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-argon-lighter/50">
            <span className="text-sm text-argon-muted font-semibold">Security Level</span>
            <span className="text-sm font-bold text-argon-default">~128-bit</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-argon-muted font-semibold">DP Mechanism</span>
            <span className="argon-badge argon-badge-success">Gaussian Noise</span>
          </div>
        </div>
      </div>
    </div>
  );
}
