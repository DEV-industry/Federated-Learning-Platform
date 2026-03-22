"use client";
import { ShieldCheck } from "lucide-react";

export default function NodeClientsTable({ nodeDetails }: { nodeDetails: any[] }) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Accepted":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600">Connected</span>;
      case "Rejected":
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-500">Suspicious</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">Wait</span>;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-gray-800">Active Node Clients</h3>
        <button className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Node ID</th>
              <th className="text-left py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Rejected Rds</th>
              <th className="text-right py-3 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">DP Status</th>
            </tr>
          </thead>
          <tbody>
            {nodeDetails.length > 0 ? (
              nodeDetails.map((node: any, idx: number) => (
                <tr key={node.nodeId} className={`border-b border-gray-50 hover:bg-gray-50/70 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                  <td className="py-3 px-3 font-mono text-sm text-gray-700 font-medium truncate max-w-[160px]" title={node.nodeId}>{node.nodeId}</td>
                  <td className="py-3 px-3">{getStatusBadge(node.status)}</td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-mono font-bold ${node.rejectedRounds > 0 ? "text-red-500" : "text-gray-400"}`}>{node.rejectedRounds}</span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {node.dpEnabled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-600">
                        <ShieldCheck className="w-3 h-3" /> Secured
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Not applied</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400 text-sm italic">No active nodes connected.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
