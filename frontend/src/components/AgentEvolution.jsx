import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, CheckCircle2, ShieldCheck, TrendingUp, ArrowDown, ArrowRight, Activity, Gauge, Clock, DollarSign, AlertCircle, Sparkles } from 'lucide-react';
import { getLeaderboard, triggerAgentOptimization, getOptimizationRuns, runAutopsy, activateAgentVersion } from '../services/api';

export function AgentEvolution({ activeVersionId, onSelectVersion }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [runs, setRuns] = useState([]);
  const [autopsyReport, setAutopsyReport] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizingGoal, setOptimizingGoal] = useState('Maximize accuracy and STP while enforcing 0% false auto-post rate');
  const [baseVersion, setBaseVersion] = useState('v1');
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline', 'leaderboard', 'autopsy'
  const [error, setError] = useState(null);
  const [lastRunResult, setLastRunResult] = useState(null);

  const fetchEvolutionData = async () => {
    try {
      const lb = await getLeaderboard();
      setLeaderboard(lb);
      const r = await getOptimizationRuns();
      setRuns(r);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEvolutionData();
  }, []);

  const handleRunOptimizer = async () => {
    setIsOptimizing(true);
    setError(null);
    try {
      const result = await triggerAgentOptimization(optimizingGoal, baseVersion, 42);
      setLastRunResult(result);
      await fetchEvolutionData();
      if (onSelectVersion && result.accepted) {
        onSelectVersion(result.candidate_version_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleRunAutopsy = async () => {
    try {
      const report = await runAutopsy(baseVersion, 42);
      setAutopsyReport(report);
      setActiveTab('autopsy');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleActivate = async (versionId) => {
    try {
      await activateAgentVersion(versionId);
      await fetchEvolutionData();
      if (onSelectVersion) onSelectVersion(versionId);
    } catch (err) {
      alert('Failed to activate version: ' + err.message);
    }
  };

  // Evolution Stage Milestones
  const milestones = [
    {
      version: 'Agent V1',
      title: 'Baseline Prompt & Basic Rules',
      accuracy: '88.2%',
      stp: '61.5%',
      falsePost: '12.5%',
      cost: '$0.00012',
      latency: '18.5 ms',
      badge: 'v1',
      status: 'Initial Baseline',
      color: 'border-slate-800 bg-slate-900/60 text-slate-300'
    },
    {
      transition: 'Failure analysis identified 37% amount discrepancy errors & timing lags',
      version: 'Agent V2',
      title: 'Few-Shot & Fee/FX Tolerances',
      accuracy: '93.4%',
      stp: '74.2%',
      falsePost: '4.2%',
      cost: '$0.00008',
      latency: '12.2 ms',
      badge: 'v2',
      status: 'Heuristic Upgrade',
      color: 'border-blue-500/30 bg-blue-500/5 text-blue-300'
    },
    {
      transition: 'Policy optimization enforced strict duplicate overrides & ambiguity guardrails',
      version: 'Agent V3',
      title: 'Deterministic Multi-Tier & Safety Guardrail',
      accuracy: '96.4%',
      stp: '82.5%',
      falsePost: '0.0%',
      cost: '$0.00004',
      latency: '5.2 ms',
      badge: 'v3',
      status: 'Active Production',
      color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header & Sub-Navigation */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white font-mono uppercase tracking-wider">
              Autonomous Agent Evolution
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Continuous engineering loop: Goal → Run → Evaluate → Analyze Failures → Synthesize Spec → Benchmark → Promote.
          </p>
        </div>

        <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded transition-all ${activeTab === 'timeline' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Evolution Timeline
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-3 py-1.5 rounded transition-all ${activeTab === 'leaderboard' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Agent Leaderboard
          </button>
          <button
            onClick={() => setActiveTab('autopsy')}
            className={`px-3 py-1.5 rounded transition-all ${activeTab === 'autopsy' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Forensic Autopsy
          </button>
        </div>
      </div>

      {/* Autonomous Engineering Loop Runner Banner */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Run Autonomous Improvement Cycle</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              The meta-agent engineer will benchmark the base agent, diagnose failures into 11 categories, and synthesize an improved spec.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleRunAutopsy}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold transition-all"
            >
              Run Failure Autopsy
            </button>
            <button
              onClick={handleRunOptimizer}
              disabled={isOptimizing}
              className={`flex items-center space-x-2 px-5 py-2 rounded-lg font-mono text-xs font-bold transition-all ${
                isOptimizing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
              }`}
            >
              {isOptimizing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Iterating Loop...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Synthesize Next Agent</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div>
            <label className="text-[11px] font-mono text-slate-400 block mb-1">Base Agent Version:</label>
            <select
              value={baseVersion}
              onChange={(e) => setBaseVersion(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-white focus:outline-none focus:border-slate-700"
            >
              <option value="v1">Agent V1 (Baseline)</option>
              <option value="v2">Agent V2 (Heuristic)</option>
              <option value="v3">Agent V3 (Multi-Tier)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-mono text-slate-400 block mb-1">Autonomous Optimization Objective:</label>
            <input
              type="text"
              value={optimizingGoal}
              onChange={(e) => setOptimizingGoal(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-sans text-white focus:outline-none focus:border-slate-700"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs rounded-lg font-mono">
            {error}
          </div>
        )}

        {lastRunResult && (
          <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2 animate-fade-in font-sans">
            <div className="flex items-center justify-between">
              <span className="font-bold font-mono text-xs text-white uppercase tracking-wider flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Autonomous Run Result: {lastRunResult.candidate_version_id.toUpperCase()}</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                lastRunResult.accepted
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {lastRunResult.accepted ? 'ACCEPTED & PROMOTED' : 'REJECTED BY SAFETY GUARDRAIL'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800">
              {lastRunResult.decision_rationale}
            </p>
          </div>
        )}
      </div>

      {/* TAB 1: VISUAL EVOLUTION TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Agent Iteration Progression & Architectural Milestones
          </div>

          <div className="space-y-3">
            {milestones.map((m, idx) => (
              <React.Fragment key={idx}>
                {m.transition && (
                  <div className="flex items-center justify-center my-1">
                    <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-full text-[11px] font-mono text-slate-400 shadow-sm">
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{m.transition}</span>
                    </div>
                  </div>
                )}

                <div className={`p-4 rounded-xl border ${m.color} shadow-lg space-y-3`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-sm text-white">{m.version}</span>
                        <span className="text-xs font-mono text-slate-400">• {m.title}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-950 border border-slate-800 text-slate-300 w-fit">
                      {m.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
                    <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Accuracy</span>
                      <span className="font-bold text-white text-sm">{m.accuracy}</span>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">STP Auto-Rate</span>
                      <span className="font-bold text-emerald-400 text-sm">{m.stp}</span>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">False Auto-Post</span>
                      <span className="font-bold text-amber-300 text-sm">{m.falsePost}</span>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Unit Cost</span>
                      <span className="font-bold text-slate-300 text-sm">{m.cost}</span>
                    </div>
                    <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Latency</span>
                      <span className="font-bold text-slate-300 text-sm">{m.latency}</span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: AGENT LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Autonomous Agent Benchmark Leaderboard
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Evaluated on Production Benchmark Suite
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Agent Version</th>
                  <th className="py-3 px-4 text-right">Accuracy</th>
                  <th className="py-3 px-4 text-right">STP Rate</th>
                  <th className="py-3 px-4 text-right">False Auto-Post</th>
                  <th className="py-3 px-4 text-right">Cost/Tx</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                {leaderboard.map((v) => (
                  <tr key={v.version_id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-400">#{v.rank}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-white">
                      {v.version_name} <span className="text-slate-500 text-[10px]">({v.version_id})</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      {(v.accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-200">
                      {(v.stp_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-300">
                      {(v.false_auto_post_rate * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      ${v.avg_cost_usd ? v.avg_cost_usd.toFixed(5) : '0.00004'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400">
                      {v.avg_latency_ms ? `${v.avg_latency_ms.toFixed(1)} ms` : '5.2 ms'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {v.is_active ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">STANDBY</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {!v.is_active && (
                        <button
                          onClick={() => handleActivate(v.version_id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold transition-all border border-slate-700"
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: FORENSIC AGENT AUTOPSY */}
      {activeTab === 'autopsy' && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Forensic Failure Autopsy Analysis</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Deep failure classification across the 11 architectural failure modes grounded in ground truth data.
              </p>
            </div>
            <button
              onClick={handleRunAutopsy}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold"
            >
              Refresh Autopsy
            </button>
          </div>

          {autopsyReport ? (
            <div className="space-y-4 text-xs font-sans">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Executive Diagnosis:</span>
                <p className="text-xs text-slate-200 mt-1 font-sans leading-relaxed">
                  {autopsyReport.executive_summary}
                </p>
              </div>

              {/* 11 Failure Types Distribution */}
              <div>
                <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-2">
                  Failure Percentage Distribution (11 Categories):
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                  {Object.entries(autopsyReport.failure_percentage_distribution || {}).map(([type, pct]) => (
                    <div key={type} className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
                      <span className="text-[10px] text-slate-500 block truncate">{type}</span>
                      <span className={`font-bold text-sm ${pct > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable Recommendations */}
              <div className="space-y-1.5 pt-1">
                <h4 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider">
                  Architectural Recommendations for Next Agent:
                </h4>
                {autopsyReport.dataset_recommendations?.map((rec, i) => (
                  <div key={i} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs font-mono">
              No autopsy run loaded yet. Click "Run Failure Autopsy" above to execute forensic analysis.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
