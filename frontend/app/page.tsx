"use client";
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Server, Target, GitBranch, Cpu, Trophy } from "lucide-react";

export default function Home() {
  const [status, setStatus] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchStatus = () => {
      fetch("http://localhost:8080/api/status")
        .then((res) => res.json())
        .then((data) => setStatus(data))
        .catch((err) => console.error(err));
        
      fetch("http://localhost:8080/api/history")
        .then((res) => res.json())
        .then((data) => setHistory(data))
        .catch((err) => console.error(err));
    };

    fetchStatus();
    const intervalId = setInterval(fetchStatus, 2000);

    return () => clearInterval(intervalId);
  }, []);

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

  const TARGET_ROUNDS = 100;
  const currentRound = status?.currentRound || 0;
  const progressPercentage = Math.min((currentRound / TARGET_ROUNDS) * 100, 100);

  // Derive latest values securely
  const latestLoss = history.length > 0 ? history[history.length - 1].loss.toFixed(4) : "0.0000";
  const latestAccuracy = history.length > 0 ? (history[history.length - 1].accuracy * 100).toFixed(1) + "%" : "0.0%";

  return (
    <main className="min-h-screen bg-[#0B0F19] text-white selection:bg-blue-500 selection:text-white pb-20">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[40%] h-[40%] bg-blue-600/10 blur-[150px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-600/10 blur-[150px] rounded-full mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-16">
        {/* Header */}
        <header className="mb-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3 tracking-tight">
              <Cpu className="w-10 h-10 text-blue-400" />
              Federated Learning Ops
            </h1>
            <p className="text-gray-400 mt-2 text-lg drop-shadow-sm">Decentralized AI Training Dashboard</p>
          </div>
          <div className="flex gap-4 items-center">
            <button 
              onClick={resetTraining}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-400 rounded-lg text-sm font-semibold transition-colors"
            >
              Reset System
            </button>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-2.5 rounded-full backdrop-blur-md">
              <div className={`w-3 h-3 rounded-full animate-pulse ${status ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-red-500'}`} />
              <span className="text-sm font-medium text-gray-200">
                {status ? "System Online" : "Connecting to Aggregator..."}
              </span>
            </div>
          </div>
        </header>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Round Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden group hover:border-blue-500/50 transition-colors duration-300 md:col-span-2">
            <div className="flex justify-between items-start mb-4">
              <p className="text-gray-400 font-medium flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-400" /> Global Round
              </p>
            </div>
            <h3 className="text-5xl font-black text-white">{currentRound}</h3>
            
            {/* Round Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between text-xs text-gray-500 mb-2 font-medium">
                <span>Progress to Convergence Goal</span>
                <span>{currentRound} / {TARGET_ROUNDS}</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2.5 overflow-hidden border border-white/5">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-1000 ease-out relative"
                  style={{ width: `${progressPercentage}%` }}
                >
                  <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/30" />
                </div>
              </div>
            </div>
          </div>

          {/* Accuracy Card */}
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

          {/* Current Loss Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden hover:border-emerald-500/50 transition-colors duration-300">
             <div className="flex justify-between items-start mb-4">
              <p className="text-gray-400 font-medium flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Latest Avg Loss
              </p>
            </div>
            <h3 className="text-4xl font-black text-white overflow-hidden text-ellipsis">{latestLoss}</h3>
            <p className="mt-4 text-sm text-emerald-400 flex items-center gap-1">
              <Server className="w-4 h-4" /> {status?.totalNodes || 0} Nodes Synced
            </p>
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
                  
                  {/* Primary Y-Axis for Loss */}
                  <YAxis 
                    yAxisId="left"
                    stroke="#4b5563" 
                    tick={{fill: '#9ca3af'}} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => value.toFixed(3)}
                    dx={-10}
                  />
                  {/* Secondary Y-Axis for Accuracy */}
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

                  {/* Loss Line */}
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
                  
                  {/* Accuracy Line */}
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
                  <p className="text-sm text-gray-600 mt-2">The chart will automatically visualize Loss and Accuracy simultaneously.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
