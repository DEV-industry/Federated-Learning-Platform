"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Server, Target, GitBranch, Cpu, Trophy, Download, Settings } from "lucide-react";

export default function Home() {
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [expectedNodesInput, setExpectedNodesInput] = useState<string>("");
  const [safetyThresholdInput, setSafetyThresholdInput] = useState<string>("");

  useEffect(() => {
    const fetchStatus = () => {
      fetch("http://localhost:8080/api/status")
        .then((res) => res.json())
        .then((data) => {
          setStatus(data);
          // Only sync the input if the user hasn't typed anything to prevent annoying overrides
          if (!expectedNodesInput) setExpectedNodesInput(data.expectedNodes?.toString() || "2");
          if (!safetyThresholdInput) setSafetyThresholdInput(data.safetyThreshold?.toString() || "5.0");
        })
        .catch((err) => console.error(err));
        
      fetch("http://localhost:8080/api/history")
        .then((res) => res.json())
        .then((data) => {
           const sortedData = data.sort((a: any, b: any) => a.round - b.round);
           setHistory(sortedData);
        })
        .catch((err) => console.error(err));
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 2000);

    return () => clearInterval(intervalId);
  }, [expectedNodesInput, safetyThresholdInput]);

  const resetTraining = async () => {
    if (!confirm("Are you sure you want to reset all federated training rounds? This permanently deletes the Postgres database records.")) return;
    try {
      await fetch("http://localhost:8080/api/training/reset", { method: "DELETE" });
      setStatus(null);
      setHistory([]);
    } catch (err) {
      console.error("Failed to reset training system.", err);
    }
  };

  const updateConfig = async () => {
    try {
      await fetch("http://localhost:8080/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          expectedNodes: parseInt(expectedNodesInput),
          safetyThreshold: parseFloat(safetyThresholdInput)
        })
      });
      alert(`Config updated! Required Nodes: ${expectedNodesInput}, Safety Threshold: ${safetyThresholdInput}`);
    } catch (err) {
      console.error(err);
    }
  };

  const TARGET_ROUNDS = 100;
  const currentRound = status?.currentRound || 0;
  const progressPercentage = Math.min((currentRound / TARGET_ROUNDS) * 100, 100);

  const latestLoss = history.length > 0 ? history[history.length - 1].loss.toFixed(4) : "0.0000";
  const latestAccuracy = history.length > 0 ? (history[history.length - 1].accuracy * 100).toFixed(1) + "%" : "0.0%";

  return (
    <main className="min-h-screen bg-[#0B0F19] text-white selection:bg-blue-500 selection:text-white pb-20">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-600/10 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16">
        <header className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3 tracking-tight">
              <Cpu className="w-10 h-10 text-blue-400" />
              Federated Learning Ops
            </h1>
            <p className="text-gray-400 mt-2 text-lg drop-shadow-sm">Decentralized AI Training Dashboard</p>
          </div>
          <div className="flex gap-4 items-center">
            <a 
              href="http://localhost:8080/api/model/download"
              target="_blank"
              download
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 border border-blue-400/50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              <Download className="w-4 h-4" /> Download .BIN
            </a>
            <button 
              onClick={resetTraining}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold transition-colors"
            >
              Reset System
            </button>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full backdrop-blur-md">
              <div className={`w-3 h-3 rounded-full animate-pulse ${status ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-gray-200">
                {status ? "System Online" : "Connecting..."}
              </span>
            </div>
          </div>
        </header>

        {/* Configuration Panel */}
        <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row items-center gap-6 text-gray-300 w-full justify-between">
             <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                   <Settings className="w-5 h-5 text-gray-400" /> 
                   <span className="font-semibold text-sm">Target Nodes:</span>
                   <input 
                     type="number" 
                     min="1"
                     max="100"
                     value={expectedNodesInput} 
                     onChange={(e) => setExpectedNodesInput(e.target.value)}
                     className="bg-black/40 border border-gray-600 rounded-lg px-3 py-1.5 w-20 text-center text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                   />
                </div>
                <div className="flex items-center gap-2">
                   <span className="font-semibold text-sm">Safety Threshold:</span>
                   <input 
                     type="number" 
                     step="0.1"
                     min="0.1"
                     max="100.0"
                     value={safetyThresholdInput} 
                     onChange={(e) => setSafetyThresholdInput(e.target.value)}
                     className="bg-black/40 border border-gray-600 rounded-lg px-3 py-1.5 w-20 text-center text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                   />
                </div>
             </div>
             <button 
               onClick={updateConfig}
               className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
             >
               Apply Config
             </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group hover:border-blue-500/50 transition-colors duration-300 md:col-span-2">
            <div className="flex justify-between items-start mb-4">
              <p className="text-gray-400 font-medium flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" /> Global Round
              </p>
            </div>
            <h3 className="text-5xl font-black text-white">{currentRound}</h3>
            <div className="mt-6">
              <div className="flex justify-between text-xs text-gray-500 mb-2 font-medium">
                <span>Progress to Convergence Goal</span>
                <span>{currentRound} / {TARGET_ROUNDS}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden hover:border-green-500/50 transition-colors duration-300">
             <div className="flex justify-between items-start mb-4">
              <p className="text-gray-400 font-medium flex items-center gap-2">
                <Trophy className="w-5 h-5 text-green-400" /> Accuracy Tracker
              </p>
            </div>
            <h3 className="text-5xl font-black text-white">{latestAccuracy}</h3>
            <p className="mt-4 text-sm text-green-400 flex items-center gap-1">
              <GitBranch className="w-4 h-4" /> Real-time Evaluation
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden hover:border-emerald-500/50 transition-colors duration-300">
             <div className="flex justify-between items-start mb-4">
              <p className="text-gray-400 font-medium flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Latest Avg Loss
              </p>
            </div>
            <h3 className="text-4xl font-black text-white overflow-hidden text-ellipsis">{latestLoss}</h3>
            <p className="mt-4 text-sm text-emerald-400 flex items-center gap-1">
              <Server className="w-4 h-4" /> Wait-State: <span className="font-bold ml-1 text-white">{status?.totalNodes || 0} / {status?.expectedNodes || '?'}</span>
            </p>
          </div>
        </div>

        {/* Security / Nodes Panel */}
        <div className="mb-8 p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
           <h2 className="text-xl font-bold flex items-center gap-2 text-white mb-4">
              <Server className="w-6 h-6 text-indigo-400"/> Connected Node Security Status
           </h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {(status?.nodeDetails && status.nodeDetails.length > 0) ? (
               status.nodeDetails.map((node: any) => {
                 const isRejected = node.status === "Rejected";
                 const isAccepted = node.status === "Accepted";
                 return (
                   <div key={node.nodeId} className={`p-4 rounded-xl border flex flex-col gap-2 transition-all ${isRejected ? 'bg-red-500/10 border-red-500/30' : isAccepted ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
                     <div className="flex justify-between items-start">
                       <span className="font-mono text-sm text-gray-300 font-bold max-w-[150px] truncate" title={node.nodeId}>{node.nodeId}</span>
                       <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wider ${isRejected ? 'bg-red-500/20 text-red-500' : isAccepted ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                         {isRejected ? 'FILTERED' : isAccepted ? 'TRUSTED' : 'PENDING'}
                       </span>
                     </div>
                     <div className="flex justify-between items-center mt-2 group relative">
                       <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold flex items-center gap-1">
                          <Activity className="w-3 h-3"/> Rejected Rounds
                       </span>
                       <span className={`font-black font-mono ${node.rejectedRounds > 0 ? 'text-red-400' : 'text-gray-400'}`}>{node.rejectedRounds}</span>
                     </div>
                   </div>
                 );
               })
             ) : (
                <div className="text-gray-500 text-sm italic col-span-full border-2 border-dashed border-white/10 rounded-xl p-4 text-center">No active nodes connected to the aggregator.</div>
             )}
           </div>
        </div>

        {/* Dual Chart Section */}
        <div className="bg-gradient-to-br from-white/5 to-white/5 border border-white/10 rounded-3xl p-6 md:p-8 backdrop-blur-xl hover:border-white/20 transition-all duration-500 mt-8 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
              Model Convergence (Loss vs Accuracy)
            </h2>
          </div>
          
          <div className="h-[430px] w-full mt-4">
            {history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  
                  <YAxis 
                    yAxisId="left"
                    stroke="#4b5563" 
                    tick={{fill: '#9ca3af'}} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value.toFixed(3)}
                    dx={-10}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    stroke="#4b5563" 
                    tick={{fill: '#9ca3af'}} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => (value * 100).toFixed(0) + '%'}
                    dx={10}
                  />
                  <XAxis 
                    dataKey="round" 
                    stroke="#4b5563" 
                    tick={{fill: '#9ca3af'}} 
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />

                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '0.75rem', color: '#fff', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                    labelFormatter={(label) => `Global Round: ${label}`}
                    formatter={(value: any, name: any) => [
                      name === 'Accuracy' ? `${(Number(value)*100).toFixed(2)}%` : Number(value).toFixed(5), 
                      String(name)
                    ]}
                  />

                  <Line 
                    yAxisId="left"
                    name="Loss"
                    type="monotone" 
                    dataKey="loss" 
                    stroke="#3b82f6" 
                    strokeWidth={4}
                    dot={{ r: 4, fill: '#1e3a8a', strokeWidth: 2, stroke: '#60a5fa' }}
                    activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={1500}
                  />
                  
                  <Line 
                    yAxisId="right"
                    name="Accuracy"
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#10b981" 
                    strokeWidth={4}
                    dot={{ r: 4, fill: '#064e3b', strokeWidth: 2, stroke: '#34d399' }}
                    activeDot={{ r: 8, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                    isAnimationActive={true}
                    animationDuration={1500}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                <div className="text-center">
                  <Activity className="w-12 h-12 text-gray-500 mx-auto mb-4 animate-pulse" />
                  <p className="text-gray-400 font-medium">Awaiting training cycles to generate full spectrum graph...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
