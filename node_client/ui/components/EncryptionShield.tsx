"use client";
import { ShieldCheck, ShieldAlert, Lock, Fingerprint } from "lucide-react";

export default function EncryptionShield({ heEnabled, dpEnabled }: { heEnabled: boolean; dpEnabled: boolean }) {
  return (
    <div className="argon-card overflow-hidden relative border border-argon-lighter/50">
      {/* Subtle gradient overlay */}
      <div className={`absolute inset-0 opacity-[0.03] ${
        heEnabled ? "bg-gradient-to-br from-argon-success to-transparent" : "bg-gradient-to-br from-argon-danger to-transparent"
      }`} />

      <div className="argon-card-body relative">
        <div className="flex items-start gap-5">
          {/* Shield icon with glow */}
          <div className={`flex-shrink-0 p-3.5 rounded-2xl ${
            heEnabled
              ? "bg-argon-success/10 border border-argon-success/20"
              : "bg-argon-danger/10 border border-argon-danger/20"
          }`}>
            {heEnabled ? (
              <ShieldCheck className="w-8 h-8 text-argon-success animate-shield-glow" />
            ) : (
              <ShieldAlert className="w-8 h-8 text-argon-danger" />
            )}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-argon-default mb-1">
              {heEnabled ? "Homomorphic Encryption is ACTIVE" : "Homomorphic Encryption is OFF"}
            </h3>
            <p className="text-xs text-argon-muted leading-relaxed">
              {heEnabled
                ? "Your local data never leaves this device — only encrypted model weights are shared with the aggregator."
                : "Model weights are sent in plaintext. Enable HE_ENABLED=true for cryptographic protection."
              }
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.65rem] font-bold uppercase tracking-wider ${
                heEnabled
                  ? "bg-argon-success/10 text-argon-success border border-argon-success/20"
                  : "bg-argon-lighter text-argon-muted border border-argon-lighter"
              }`}>
                <Lock className="w-3 h-3" />
                CKKS Encryption
              </div>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.65rem] font-bold uppercase tracking-wider ${
                dpEnabled
                  ? "bg-argon-info/10 text-argon-info border border-argon-info/20"
                  : "bg-argon-lighter text-argon-muted border border-argon-lighter"
              }`}>
                <Fingerprint className="w-3 h-3" />
                Differential Privacy
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
