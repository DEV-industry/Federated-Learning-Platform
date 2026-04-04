"use client";

export default function NodeActivityHeatmap({ nodeDetails, history, currentRound }: { nodeDetails: any[]; history: any[]; currentRound?: number }) {
  const days = nodeDetails.length > 0 ? nodeDetails.map((n: any) => n.nodeId.substring(0, 8)) : ["Node 1", "Node 2", "Node 3"];
  const recentHistory = (history || []).slice(-6);
  const historyOffset = Math.max(0, 6 - recentHistory.length);
  const timeSlots = Array.from({ length: 6 }, (_, idx) => {
    const historyIndex = idx - historyOffset;
    if (historyIndex >= 0 && historyIndex < recentHistory.length) {
      return `Round ${recentHistory[historyIndex].round}`;
    }
    return "—";
  });
  timeSlots.push(currentRound ? `Round ${currentRound}` : "Current");

  const getStatusColor = (status?: string) => {
    if (status === "Rejected") return "bg-argon-danger/60";
    if (status === "Accepted") return "bg-argon-primary";
    return "bg-argon-lighter";
  };

  const getColor = (row: number, col: number) => {
    if (nodeDetails.length === 0) return "bg-argon-lighter";
    const node = nodeDetails[row];
    if (!node) return "bg-argon-lighter";
    
    if (col === 6) {
      if (node.status === "Rejected") return "bg-argon-danger/60";
      if (node.status === "Accepted") return "bg-argon-primary";
      return "bg-argon-primary/40";
    }

    const historyIndex = col - historyOffset;
    if (historyIndex >= 0 && historyIndex < recentHistory.length) {
      const targetHistoryRecord = recentHistory[historyIndex];
      const pastStatus = targetHistoryRecord?.nodeStatuses?.[node.nodeId];
      return getStatusColor(pastStatus);
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
          <div className="min-w-[400px]">
            {/* Column labels */}
            <div className="flex mb-2 ml-20">
              {timeSlots.map((slot) => (
                <div key={slot} className="flex-1 text-center text-[10px] text-argon-muted font-semibold">{slot}</div>
              ))}
            </div>
            {/* Rows */}
            {days.map((day, rowIdx) => (
              <div key={day} className="flex items-center mb-1.5">
                <span className="w-20 text-xs text-argon-muted font-semibold truncate pr-2 text-right font-mono">{day}</span>
                <div className="flex flex-1 gap-1">
                  {timeSlots.map((_, colIdx) => (
                    <div
                      key={colIdx}
                      className={`flex-1 h-7 rounded-argon ${getColor(rowIdx, colIdx)} transition-colors`}
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
