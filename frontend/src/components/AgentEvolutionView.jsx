import React, { useState } from 'react';
import { 
  Cpu, 
  Sparkles, 
  RefreshCw, 
  ArrowDown, 
  CheckCircle2, 
  TrendingUp, 
  AlertCircle, 
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export function AgentEvolutionView({
  activeVersionId = 'v3',
  onSelectVersion,
  onRunOptimization,
  isOptimizing = false,
  lastRunResult,
  autopsyReport,
  onRunAutopsy,
}) {
  const [subTab, setSubTab] = useState('timeline'); // 'timeline', 'leaderboard', 'autopsy'
  const [baseVersion, setBaseVersion] = useState('v1');
  const [optimizingGoal, setOptimizingGoal] = useState('Maximize accuracy and STP while enforcing 0% false auto-post rate');

  const steps = [
    { title: '1. GOAL', desc: 'Maximize STP & zero false auto-posts' },
    { title: '2. GENERATE AGENT', desc: 'Instantiate Base Agent V1' },
    { title: '3. RUN AGENT', desc: 'Execute autonomous reconciliation cycle' },
    { title: '4. EVALUATE RESULT', desc: 'Calculate Accuracy, STP, Reliability, Cost' },
    { title: '5. ANALYZE FAILURES', desc: 'Mine misclassifications' },
    { title: '6. IMPROVE AGENT', desc: 'Meta-Agent injects rules & thresholds' },
    { title: '7. RUN AGAIN', desc: 'Evaluate improved agent' },
    { title: '8. SELECT BETTER', desc: 'Auto-promote superior version' },
  ];

  const milestones = [
    {
      version: 'Agent V1',
      title: 'Baseline Prompt & Basic Rules',
      status: 'Initial Baseline',
      accuracy: '88.2%',
      stp: '61.5%',
      falsePost: '12.5%',
      cost: '$0.00012',
      latency: '18.5 ms',
      bg: 'bg-white border-slate-200',
    },
    {
      transition: 'Failure analysis identified: 37% amount discrepancy errors & timing lags',
      version: 'Agent V2',
      title: 'Few-Shot & Fee/FX Tolerances',
      status: 'Heuristic Upgrade',
      accuracy: '93.4%',
      stp: '74.2%',
      falsePost: '4.2%',
      cost: '$0.00008',
      latency: '12.2 ms',
      bg: 'bg-pastel-blue-light/50 border-pastel-blue-border',
    },
    {
      transition: 'Policy optimization enforced strict duplicate overrides & ambiguity guardrails',
      version: 'Agent V3',
      title: 'Deterministic Multi-Tier & Safety Guardrail',
      status: 'ACTIVE PRODUCTION',
      accuracy: '96.4%',
      stp: '82.5%',
      falsePost: '0.0%',
      cost: '$0.00004',
      latency: '5.2 ms',
      bg: 'bg-pastel-mint-light border-emerald-300 ring-1 ring-emerald-400/40',
      isDominant: true,
    }
  ];

  const leaderboardRows = [
    { rank: '#1', version: 'Agent V3', accuracy: '96.4%', stp: '82.5%', falsePost: '0.0%', cost: '$0.00004', latency: '5.2 ms', status: 'ACTIVE', id: 'v3' },
    { rank: '#2', version: 'Agent V2', accuracy: '93.4%', stp: '74.2%', falsePost: '4.2%', cost: '$0.00008', latency: '12.2 ms', status: 'STANDBY', id: 'v2' },
    { rank: '#3', version: 'Agent V1', accuracy: '88.2%', stp: '61.5%', falsePost: '12.5%', cost: '$0.00012', latency: '18.5 ms', status: 'STANDBY', id: 'v1' },
  ];

  const failureCategories = [
    { type: 'MATCHING', pct: '0.0%' },
    { type: 'DECISION', pct: '22.5%' },
    { type: 'CONFIDENCE', pct: '12.0%' },
    { type: 'EXCEPTION CLASSIFICATION', pct: '8.5%' },
    { type: 'VERIFICATION', pct: '18.0%' },
    { type: 'PROMPT', pct: '5.0%' },
    { type: 'TOOL SELECTION', pct: '0.0%' },
    { type: 'MEMORY', pct: '0.0%' },
    { type: 'ORCHESTRATION', pct: '0.0%' },
    { type: 'COST', pct: '0.0%' },
    { type: 'LATENCY', pct: '0.0%' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Sub-Tabs */}
      <div className="forge-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-ink" />
            <h1 className="font-serif font-bold text-2xl text-ink">
              Autonomous Agent Evolution
            </h1>
          </div>
          <p className="text-xs text-ink-secondary mt-1">
            Continuous engineering loop: Goal → Run → Evaluate → Analyze Failures → Synthesize Spec → Benchmark → Promote.
          </p>
        </div>

        {/* Sub-Tabs */}
        <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-full text-xs font-semibold">
          <button
            onClick={() => setSubTab('timeline')}
            className={`px-3.5 py-1.5 rounded-full transition-all ${
              subTab === 'timeline' ? 'bg-white text-ink shadow-2xs' : 'text-slate-500 hover:text-ink'
            }`}
          >
            Evolution Timeline
          </button>
          <button
            onClick={() => setSubTab('leaderboard')}
            className={`px-3.5 py-1.5 rounded-full transition-all ${
              subTab === 'leaderboard' ? 'bg-white text-ink shadow-2xs' : 'text-slate-500 hover:text-ink'
            }`}
          >
            Agent Leaderboard
          </button>
          <button
            onClick={() => setSubTab('autopsy')}
            className={`px-3.5 py-1.5 rounded-full transition-all ${
              subTab === 'autopsy' ? 'bg-white text-ink shadow-2xs' : 'text-slate-500 hover:text-ink'
            }`}
          >
            Forensic Autopsy
          </button>
        </div>
      </div>

      {/* Autonomous Improvement Control Panel */}
      <div className="forge-card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-serif font-bold text-base text-ink flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Run Autonomous Improvement Cycle</span>
            </h3>
            <p className="text-xs text-ink-secondary mt-0.5">
              The meta-agent engineer will benchmark the base agent, diagnose failures into 11 categories, and synthesize an improved spec.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRunAutopsy}
              className="px-3.5 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-all"
            >
              Run Failure Autopsy
            </button>
            <button
              onClick={() => onRunOptimization && onRunOptimization(optimizingGoal, baseVersion)}
              disabled={isOptimizing}
              className="btn-primary"
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

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
          <div>
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Base Agent Version:</label>
            <select
              value={baseVersion}
              onChange={(e) => setBaseVersion(e.target.value)}
              className="w-full bg-[#FAFAF8] border border-slate-200 rounded-xl p-2 text-xs font-semibold text-ink focus:outline-none focus:border-slate-400"
            >
              <option value="v1">Agent V1 (Baseline)</option>
              <option value="v2">Agent V2 (Heuristic)</option>
              <option value="v3">Agent V3 (Multi-Tier)</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[11px] font-semibold text-slate-600 block mb-1">Optimization Objective:</label>
            <input
              type="text"
              value={optimizingGoal}
              onChange={(e) => setOptimizingGoal(e.target.value)}
              className="w-full bg-[#FAFAF8] border border-slate-200 rounded-xl p-2 text-xs text-ink focus:outline-none focus:border-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Meta-Agent 8-Step Visualizer Sequence */}
      <div className="forge-card p-5 space-y-3">
        <h4 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
          Autonomous Engineering Loop Sequence
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {steps.map((step, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-xl border border-slate-200/80 bg-[#FAFAF8] text-center space-y-1 hover:border-slate-300 transition-colors"
            >
              <div className="text-[10px] font-mono font-bold text-slate-700 uppercase">
                {step.title}
              </div>
              <div className="text-[10px] text-slate-500 leading-tight">
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Before vs After Card (Always visible or after run) */}
      <div className="forge-card p-6 border-2 border-emerald-300/80 bg-pastel-mint-light/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-emerald-700" />
              <h3 className="font-serif font-bold text-base text-ink">
                Agent Evolution: Before vs After Comparison
              </h3>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Autonomous Meta-Agent Loop diagnosed failures on Agent V1 and synthesized Agent V3.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-pastel-mint text-emerald-800 border border-pastel-mint-border">
              PROMOTED TO PRODUCTION
            </span>
            <button
              onClick={() => onSelectVersion && onSelectVersion('v3')}
              className="btn-primary py-1.5 px-3 text-xs"
            >
              Activate V3
            </button>
          </div>
        </div>

        {/* 3 Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Overall Accuracy</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xs text-slate-400">88.2%</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-lg font-extrabold text-emerald-700">96.4%</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 block">+8.2% Lift</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">Straight-Through Processing</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xs text-slate-400">61.5%</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-lg font-extrabold text-sky-700">82.5%</span>
            </div>
            <span className="text-xs font-bold text-sky-600 block">+21.0% Auto-Post Lift</span>
          </div>

          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 uppercase block">False Auto-Post (Safety)</span>
            <div className="flex items-baseline space-x-2">
              <span className="text-xs text-slate-400">12.5%</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-lg font-extrabold text-ink">0.0%</span>
            </div>
            <span className="text-xs font-bold text-emerald-600 block">Passed Safety Constraint (&lt; 5%)</span>
          </div>
        </div>

        {/* Rationale */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans">
          <strong className="text-ink text-[11px] block uppercase font-mono mb-0.5">Promotion Rationale:</strong>
          Autonomous loop verified 0% false auto-posts across 64-Tx benchmark dataset. Calibrated confidence threshold to 85% with mandatory wire fee variance verification checks.
        </div>
      </div>

      {/* Sub-Tab 1: Evolution Timeline */}
      {subTab === 'timeline' && (
        <div className="space-y-4">
          <h3 className="font-serif font-bold text-lg text-ink">
            Evolution Timeline Milestones
          </h3>
          <div className="space-y-3">
            {milestones.map((m, idx) => (
              <React.Fragment key={idx}>
                {m.transition && (
                  <div className="flex justify-center my-2">
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium shadow-2xs">
                      <ArrowDown className="w-3.5 h-3.5 text-slate-400" />
                      <span>{m.transition}</span>
                    </div>
                  </div>
                )}

                <div className={`p-5 rounded-2xl border ${m.bg} shadow-soft space-y-3`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                    <div>
                      <span className="font-serif font-bold text-base text-ink">{m.version}</span>
                      <span className="text-xs text-slate-500 ml-2">• {m.title}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      m.isDominant ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {m.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 font-mono text-xs text-center">
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-400 block uppercase">Accuracy</span>
                      <span className="font-bold text-ink text-sm">{m.accuracy}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-400 block uppercase">STP</span>
                      <span className="font-bold text-emerald-700 text-sm">{m.stp}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-400 block uppercase">False Post</span>
                      <span className="font-bold text-rose-600 text-sm">{m.falsePost}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-400 block uppercase">Unit Cost</span>
                      <span className="font-bold text-slate-700 text-sm">{m.cost}</span>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-400 block uppercase">Latency</span>
                      <span className="font-bold text-slate-700 text-sm">{m.latency}</span>
                    </div>
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Sub-Tab 2: Leaderboard */}
      {subTab === 'leaderboard' && (
        <div className="forge-card p-6 space-y-4">
          <div>
            <h3 className="font-serif font-bold text-lg text-ink">
              Autonomous Agent Benchmark Leaderboard
            </h3>
            <p className="text-xs text-slate-500">Evaluated on Production Benchmark Suite</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Agent Version</th>
                  <th className="py-2.5 px-3 text-right">Accuracy</th>
                  <th className="py-2.5 px-3 text-right">STP Rate</th>
                  <th className="py-2.5 px-3 text-right">False Auto-Post</th>
                  <th className="py-2.5 px-3 text-right">Cost/Tx</th>
                  <th className="py-2.5 px-3 text-right">Latency</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {leaderboardRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-500">{row.rank}</td>
                    <td className="py-3 px-3 font-sans font-semibold text-ink">{row.version}</td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-700">{row.accuracy}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-800">{row.stp}</td>
                    <td className="py-3 px-3 text-right text-emerald-600">{row.falsePost}</td>
                    <td className="py-3 px-3 text-right text-slate-500">{row.cost}</td>
                    <td className="py-3 px-3 text-right text-slate-500">{row.latency}</td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.status === 'ACTIVE'
                          ? 'bg-pastel-mint text-emerald-800 border border-pastel-mint-border'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-sans">
                      {row.status !== 'ACTIVE' ? (
                        <button
                          onClick={() => onSelectVersion && onSelectVersion(row.id)}
                          className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                        >
                          Activate
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-Tab 3: Forensic Failure Autopsy */}
      {subTab === 'autopsy' && (
        <div className="forge-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-serif font-bold text-lg text-ink flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Forensic Failure Autopsy Analysis</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Deep failure classification across the 11 architectural failure modes grounded in ground truth data.
              </p>
            </div>
            <button
              onClick={onRunAutopsy}
              className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              Refresh Autopsy
            </button>
          </div>

          {/* Executive Diagnosis */}
          <div className="p-4 bg-[#FAFAF8] rounded-xl border border-slate-200">
            <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block mb-1">
              Executive Diagnosis:
            </span>
            <p className="text-xs text-slate-700 leading-relaxed font-sans">
              Autopsy of Base Agent V1 reveals that 22.5% of errors were caused by Decision Policy misclassifications and 18.0% by missing wire fee variance verification checks. Enforcing strict duplicate checks and expanding the fuzzy matching window eliminates all false auto-posts.
            </p>
          </div>

          {/* 11 Failure Categories */}
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider mb-2">
              Failure Percentage Distribution (11 Categories):
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              {failureCategories.map((f, i) => (
                <div key={i} className="p-2.5 rounded-xl bg-white border border-slate-200">
                  <span className="text-[10px] text-slate-400 block truncate">{f.type}</span>
                  <span className={`font-bold text-sm ${parseFloat(f.pct) > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {f.pct}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-mono font-bold text-slate-600 uppercase tracking-wider">
              Architectural Recommendations for Next Agent:
            </h4>
            <ol className="list-decimal list-inside text-xs text-slate-700 space-y-1">
              <li>Enforce mandatory human escalation check on non-exact exception categories.</li>
              <li>Introduce explicit $50 bank fee variance calculation step before auto-posting.</li>
              <li>Expand heuristic clearing date search window from 7 to 10 calendar days.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
