import { Download, FileDown, Clock, TrendingUp, TrendingDown } from "lucide-react";

interface ModelVersion {
  round: number;
  loss: number;
  accuracy: number;
  timestamp: string | null;
  nodesParticipated: number;
}

interface Props {
  models: ModelVersion[];
  currentRound: number;
  apiUrl: string;
}

export default function ModelVersionTable({ models, currentRound, apiUrl }: Props) {
  const handleDownload = () => {
    window.open(`${apiUrl}/api/model/download`, "_blank");
  };

  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-sm text-white">
            <FileDown className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-argon-default">Model Version History</h3>
            <p className="text-xs text-argon-muted mt-0.5">All aggregated global model checkpoints from completed training rounds.</p>
          </div>
        </div>
        <span className="text-xs font-bold text-argon-muted uppercase tracking-wider bg-argon-bg px-3 py-1.5 rounded-full">
          {models.length} versions
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-argon-lighter bg-argon-lighter/30">
              <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Round</th>
              <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Loss</th>
              <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Accuracy</th>
              <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Nodes</th>
              <th className="text-left py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Trained At</th>
              <th className="text-center py-4 px-6 text-[0.6875rem] font-bold text-argon-muted uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {models.length > 0 ? models.map((model, idx) => {
              const isLatest = model.round === currentRound;
              const prevModel = idx < models.length - 1 ? models[idx + 1] : null;
              const lossImproved = prevModel ? model.loss < prevModel.loss : false;
              const accImproved = prevModel ? model.accuracy > prevModel.accuracy : false;

              return (
                <tr
                  key={model.round}
                  className={`border-b border-argon-lighter/50 transition-all duration-300 hover:bg-argon-bg/50 ${isLatest ? "bg-indigo-500/[0.03]" : ""}`}
                >
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.8125rem] font-bold text-argon-default">R{model.round}</span>
                      {isLatest && (
                        <span className="argon-badge argon-badge-primary text-[0.625rem]">Latest</span>
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-argon-default">{model.loss.toFixed(4)}</span>
                      {prevModel && (
                        lossImproved
                          ? <TrendingDown className="w-3.5 h-3.5 text-argon-success" />
                          : <TrendingUp className="w-3.5 h-3.5 text-argon-danger" />
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-argon-default">{(model.accuracy * 100).toFixed(1)}%</span>
                      {prevModel && (
                        accImproved
                          ? <TrendingUp className="w-3.5 h-3.5 text-argon-success" />
                          : <TrendingDown className="w-3.5 h-3.5 text-argon-danger" />
                      )}
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">
                    <span className="text-sm text-argon-muted font-semibold">{model.nodesParticipated}</span>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-1.5 text-xs text-argon-muted">
                      <Clock className="w-3 h-3" />
                      <span>{model.timestamp ? new Date(model.timestamp).toLocaleString() : "—"}</span>
                    </div>
                  </td>
                  <td className="py-5 px-6 text-center">
                    {isLatest ? (
                      <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold rounded-lg shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    ) : (
                      <span className="text-xs text-argon-light font-semibold">—</span>
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={6} className="py-12 text-center text-argon-muted text-sm font-semibold">No model versions available yet. Start training first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
