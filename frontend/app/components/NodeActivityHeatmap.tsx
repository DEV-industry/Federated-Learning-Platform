"use client";

export default function NodeActivityHeatmap({ nodeDetails, history, currentRound }: { nodeDetails: any[]; history: any[]; currentRound?: number }) {
  const sortedHistory = [...(history || [])]
    .filter((entry: any) => typeof entry?.round === "number")
    .sort((a: any, b: any) => a.round - b.round);

  const historyRounds = sortedHistory.map((entry: any) => entry.round);
  const maxHistoryRound = historyRounds.length > 0 ? historyRounds[historyRounds.length - 1] : 0;
  const shouldShowCurrent = typeof currentRound === "number" && currentRound > 0 && currentRound !== maxHistoryRound;

  const columnRounds: number[] = shouldShowCurrent
    ? [...historyRounds, currentRound as number]
    : [...historyRounds];

  const visibleColumns = columnRounds.length > 0 ? columnRounds : [0];

  const historyByRound = new Map<number, any>(sortedHistory.map((entry: any) => [entry.round, entry]));

  const knownNodes = nodeDetails.map((n: any) => n.nodeId);
  if (knownNodes.length === 0) {
    const historyNodes = new Set<string>();
    sortedHistory.forEach((entry: any) => {
      Object.keys(entry?.nodeStatuses || {}).forEach((nodeId) => historyNodes.add(nodeId));
    });
    knownNodes.push(...Array.from(historyNodes));
  }

  const days = knownNodes.length > 0 ? knownNodes : ["Node 1", "Node 2", "Node 3"];

  const getStatusColor = (status?: string) => {
    if (status === "Rejected") return "bg-argon-danger/60";
    if (status === "Accepted") return "bg-argon-primary";
    return "bg-argon-lighter";
  };

  const getColor = (row: number, col: number) => {
    const nodeId = days[row];
    const node = nodeDetails.find((n: any) => n.nodeId === nodeId);

    const round = visibleColumns[col];
    if (shouldShowCurrent && round === currentRound) {
      if (!node) return "bg-argon-primary/40";
      if (node.status === "Rejected") return "bg-argon-danger/60";
      if (node.status === "Accepted") return "bg-argon-primary";
      return "bg-argon-primary/40";
    }

    const targetHistoryRecord = historyByRound.get(round);
    if (!targetHistoryRecord) return "bg-argon-lighter";

    const statuses = targetHistoryRecord.nodeStatuses || {};
    const directStatus = statuses[nodeId];
    if (directStatus) return getStatusColor(directStatus);

    if (nodeId.length > 8) {
      const fallbackKey = Object.keys(statuses).find((key) => key.startsWith(nodeId) || nodeId.startsWith(key));
      if (fallbackKey) {
        return getStatusColor(statuses[fallbackKey]);
      }
    }

    return "bg-argon-lighter";
  };

  return (
    <div className="argon-card overflow-hidden">
      <div className="argon-card-header flex items-center justify-between">
        <h3 className="text-base font-bold text-argon-default">Node Activity</h3>
        <div className="flex items-center gap-3 text-[0.6875rem] text-argon-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-argon-lighter rounded-sm inline-block" /> None</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-argon-primary/40 rounded-sm inline-block" /></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-argon-primary/70 rounded-sm inline-block" /></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-argon-primary rounded-sm inline-block" /> High</span>
        </div>
      </div>
      <div className="argon-card-body">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Column labels */}
            <div className="flex mb-2 ml-20">
              {visibleColumns.map((round, idx) => (
                <div key={`${round}-${idx}`} className="w-16 shrink-0 text-center text-[10px] text-argon-muted font-semibold">
                  {round === 0 ? "-" : `R${round}`}
                </div>
              ))}
            </div>
            {/* Rows */}
            {days.map((day, rowIdx) => (
              <div key={`${day}-${rowIdx}`} className="flex items-center mb-1.5">
                <span className="w-20 text-xs text-argon-muted font-semibold truncate pr-2 text-right font-mono" title={day}>{day}</span>
                <div className="flex flex-1 gap-1 min-w-max">
                  {visibleColumns.map((_, colIdx) => (
                    <div
                      key={colIdx}
                      className={`w-16 h-7 rounded-argon ${getColor(rowIdx, colIdx)} transition-colors`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
