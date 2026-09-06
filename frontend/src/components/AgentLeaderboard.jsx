import React, { useEffect, useState } from 'react';
import { Trophy, Cpu, Zap, DollarSign, ShieldCheck, ArrowUpRight, Sparkles } from 'lucide-react';
import { getLeaderboard } from '../services/api';

export function AgentLeaderboard({ activeVersionId, onSelectVersion }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Agent Version Performance Leaderboard</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Empirical benchmarks proving V1 → V2 → V3 improvements in Accuracy, STP %, Cost, & Speed.</p>
        </div>
        <button
          onClick={fetchLeaderboard}
          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-800"
        >
          Refresh Benchmarks
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-xs">Loading performance benchmarks...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {leaderboard.map((item) => {
            const isCurrentActive = item.version_id === activeVersionId;

            return (
              <div
                key={item.version_id}
                className={`p-5 rounded-2xl border transition-all relative ${
                  isCurrentActive
                    ? 'glass-panel-glow border-emerald-500/50 ring-1 ring-emerald-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Active Badge */}
                {isCurrentActive && (
                  <div className="absolute -top-3 right-4 bg-emerald-500 text-slate-950 font-black text-[10px] uppercase px-2.5 py-0.5 rounded-full shadow-lg shadow-emerald-500/30 flex items-center space-x-1">
                    <Sparkles className="w-3 h-3 inline" />
                    <span>Selected Engine</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">{item.version_id.toUpperCase()}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                    Threshold: {Math.round(item.confidence_threshold * 100)}%
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mt-2">{item.version_name}</h3>

                {/* Primary Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/80">
                  
                  {/* Accuracy */}
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Accuracy %</span>
                    <span className="text-lg font-black text-white">{Math.round(item.accuracy * 100)}%</span>
                  </div>

                  {/* STP Rate */}
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">STP Auto-Rate</span>
                    <span className="text-lg font-black text-emerald-400">{Math.round(item.stp_rate * 100)}%</span>
                  </div>

                  {/* Reliability / Safety */}
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Zero-False Safety</span>
                    <span className="text-sm font-black text-blue-400">{Math.round(item.reliability_score * 100)}%</span>
                  </div>

                  {/* Cost per run */}
                  <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Avg Latency</span>
                    <span className="text-sm font-black text-amber-400">{item.avg_latency_ms} ms</span>
                  </div>

                </div>

                {/* Footer Selection button */}
                <button
                  onClick={() => onSelectVersion(item.version_id)}
                  disabled={isCurrentActive}
                  className={`w-full mt-5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isCurrentActive
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  {isCurrentActive ? 'Active Version' : 'Activate Engine'}
                </button>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
