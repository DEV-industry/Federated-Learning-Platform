import { Download, Box, Layers, Binary, HardDrive } from "lucide-react";

interface Props {
  currentRound: number;
  latestAccuracy: number;
  latestLoss: number;
  totalParams: number | null;
  apiUrl: string;
}

export default function ExportKPICards({ currentRound, latestAccuracy, latestLoss, totalParams, apiUrl }: Props) {
  const handleDownload = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/model/download`);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `global_model_r${currentRound}.bin`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Model download failed:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {/* Latest Version */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Latest Version</span>
          <div className="p-2 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg shadow-sm text-white">
            <Box className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">Round {currentRound}</p>
        <p className="text-xs text-argon-muted mt-1">Latest aggregated checkpoint</p>
      </div>

      {/* Model Accuracy */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Best Accuracy</span>
          <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg shadow-sm text-white">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">{(latestAccuracy * 100).toFixed(1)}%</p>
        <p className="text-xs text-argon-muted mt-1">Latest round accuracy</p>
      </div>

      {/* Latest Loss */}
      <div className="argon-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Latest Loss</span>
          <div className="p-2 bg-gradient-to-br from-orange-400 to-rose-500 rounded-lg shadow-sm text-white">
            <Binary className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-extrabold text-argon-default">{latestLoss.toFixed(4)}</p>
        <p className="text-xs text-argon-muted mt-1">Cross-entropy loss</p>
      </div>

      {/* Quick Download */}
      <div className="argon-card p-5 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-argon-muted uppercase tracking-wider">Quick Export</span>
          <div className="p-2 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg shadow-sm text-white">
            <HardDrive className="w-4 h-4" />
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={currentRound < 1}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <Download className="w-4 h-4" />
          Download .bin (R{currentRound})
        </button>
      </div>
    </div>
  );
}
