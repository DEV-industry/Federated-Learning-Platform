"use client";
import { Settings } from "lucide-react";

export default function ConfigPanel({
  expectedNodesInput,
  setExpectedNodesInput,
  safetyThresholdInput,
  setSafetyThresholdInput,
  onApply,
  status,
}: {
  expectedNodesInput: string;
  setExpectedNodesInput: (v: string) => void;
  safetyThresholdInput: string;
  setSafetyThresholdInput: (v: string) => void;
  onApply: () => void;
  status: any;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-2">
        <Settings className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-600">System Config</span>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Target Nodes</label>
          <input
            type="number"
            min="1"
            max="100"
            value={expectedNodesInput}
            onChange={(e) => setExpectedNodesInput(e.target.value)}
            className="w-16 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Safety Threshold</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="100.0"
            value={safetyThresholdInput}
            onChange={(e) => setSafetyThresholdInput(e.target.value)}
            className="w-16 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-center text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
          />
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400 border-l border-gray-200 pl-3">
          <span>Nodes: <strong className="text-gray-600">{status?.totalNodes || 0}/{status?.expectedNodes || "?"}</strong></span>
        </div>
        <button
          onClick={onApply}
          className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm shadow-blue-500/20"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
