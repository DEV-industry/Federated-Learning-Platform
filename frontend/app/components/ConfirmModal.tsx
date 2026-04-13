"use client";
import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  title: string;
  description: string;
  bullets?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  description,
  bullets,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onCancel();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onCancel]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onCancel();
  };

  if (!isOpen) return null;

  const isDanger = variant === "danger";
  const accentColor = isDanger ? "argon-danger" : "orange-500";

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in"
      style={{ animation: "fadeIn 0.2s ease-out" }}
    >
      <div
        className="bg-white w-full max-w-md mx-4 rounded-argon-lg shadow-2xl overflow-hidden"
        style={{ animation: "slideUp 0.25s ease-out" }}
      >
        {/* Header */}
        <div className={`px-6 py-5 ${isDanger ? "bg-argon-danger/5" : "bg-orange-50"} flex items-start justify-between`}>
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full flex-shrink-0 ${isDanger ? "bg-argon-danger/10" : "bg-orange-100"}`}>
              <AlertTriangle className={`w-5 h-5 ${isDanger ? "text-argon-danger" : "text-orange-500"}`} />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isDanger ? "text-argon-danger" : "text-orange-600"}`}>
                {title}
              </h3>
              <p className="text-xs text-argon-muted mt-1 leading-relaxed">{description}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 text-argon-light hover:text-argon-muted transition-colors rounded-full hover:bg-argon-lighter/50 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bullets */}
        {bullets && bullets.length > 0 && (
          <div className="px-6 py-4 border-b border-argon-lighter">
            <p className="text-xs font-bold text-argon-muted uppercase tracking-wider mb-2.5">
              This action will permanently delete:
            </p>
            <ul className="space-y-1.5">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-argon-default">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDanger ? "bg-argon-danger/60" : "bg-orange-400"}`} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warning notice */}
        <div className="px-6 py-3 bg-argon-bg/30">
          <p className="text-xs text-argon-muted font-semibold text-center">
            This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 text-sm font-bold text-argon-muted bg-argon-lighter/60 rounded-argon hover:bg-argon-lighter transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2.5 text-sm font-bold text-white rounded-argon transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-px ${
              isDanger
                ? "bg-argon-danger hover:bg-argon-danger-dark"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
