"use client";
import { useState } from "react";
import { AlertTriangle, Trash2, Loader2, CheckCircle2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://localhost:8443";

interface Props {
  onResetComplete: () => void;
}

export default function DangerZoneCard({ onResetComplete }: Props) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const handleReset = async () => {
    const confirmed = confirm(
      "Are you sure you want to reset all federated training data?\n\n" +
      "This will permanently delete:\n" +
      "• All training round history from the database\n" +
      "• All node weight submissions\n" +
      "• All event logs\n\n" +
      "This action cannot be undone."
    );

    if (!confirmed) return;

    setIsResetting(true);
    setResetDone(false);

    try {
      const res = await fetch(`${API_URL}/api/training/reset`, { method: "DELETE" });
      if (res.ok) {
        setResetDone(true);
        onResetComplete();
        setTimeout(() => setResetDone(false), 5000);
      } else {
        alert("Failed to reset training. Server returned an error.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error during training reset.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="argon-card overflow-hidden border border-argon-danger/20">
      <div className="argon-card-header flex items-center gap-3 bg-argon-danger/5">
        <div className="p-2 bg-gradient-to-br from-red-400 to-rose-500 rounded-lg shadow-sm text-white">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-argon-danger">Danger Zone</h3>
          <p className="text-xs text-argon-muted mt-0.5">Irreversible operations that affect the entire platform.</p>
        </div>
      </div>

      <div className="p-6">
        {/* Reset Training */}
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-argon-default mb-1">Reset Training Data</h4>
            <p className="text-xs text-argon-muted leading-relaxed">
              Permanently deletes all round history, node weight submissions, security verdicts, and event logs from the PostgreSQL database.
              The global model will be reset to its initial state. All connected nodes will restart their training cycle.
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={isResetting}
            className={`flex-shrink-0 px-5 py-2.5 font-bold text-sm rounded-argon transition-all duration-300 flex items-center gap-2 ${
              resetDone
                ? "bg-argon-success/10 text-argon-success border border-argon-success/30"
                : "bg-argon-danger text-white shadow-argon-danger hover:bg-argon-danger-dark hover:-translate-y-px"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {isResetting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Resetting...
              </>
            ) : resetDone ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Reset Complete
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Reset Training
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
