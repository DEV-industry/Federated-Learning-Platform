"use client";

export default function NodeActivityHeatmap({ nodeDetails, history }: { nodeDetails: any[]; history: any[] }) {
  const timeSlots = ["Round -6", "Round -5", "Round -4", "Round -3", "Round -2", "Round -1", "Current"];
  const days = nodeDetails.length > 0 ? nodeDetails.map((n: any) => n.nodeId.substring(0, 8)) : ["Node 1", "Node 2", "Node 3"];

  const getColor = (row: number, col: number) => {
    if (nodeDetails.length === 0) return "bg-gray-100";
    const node = nodeDetails[row];
    if (!node) return "bg-gray-100";
    if (col === 6) {
      if (node.status === "Rejected") return "bg-red-300";
      if (node.status === "Accepted") return "bg-blue-400";
      return "bg-blue-200";
    }
    const intensity = Math.random();
    if (intensity > 0.7) return "bg-blue-400";
    if (intensity > 0.4) return "bg-blue-300";
    if (intensity > 0.2) return "bg-blue-200";
    return "bg-blue-100";
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-gray-800">Node Activity</h3>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-100 rounded-sm inline-block" /> 0</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded-sm inline-block" /></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-300 rounded-sm inline-block" /></span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-400 rounded-sm inline-block" /> High</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          {/* Column labels */}
          <div className="flex mb-2 ml-20">
            {timeSlots.map((slot) => (
              <div key={slot} className="flex-1 text-center text-[10px] text-gray-400 font-medium">{slot}</div>
            ))}
          </div>
          {/* Rows */}
          {days.map((day, rowIdx) => (
            <div key={day} className="flex items-center mb-1.5">
              <span className="w-20 text-xs text-gray-500 font-medium truncate pr-2 text-right font-mono">{day}</span>
              <div className="flex flex-1 gap-1">
                {timeSlots.map((_, colIdx) => (
                  <div
                    key={colIdx}
                    className={`flex-1 h-7 rounded-md ${getColor(rowIdx, colIdx)} transition-colors`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
