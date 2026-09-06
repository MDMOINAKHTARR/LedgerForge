import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Sparkles, 
  Scale, 
  Layers, 
  Cpu, 
  ArrowRight,
  Info,
  Sliders,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { getActivePolicy, getAgentVersions } from '../services/api';

export function ReconciliationPolicyView({ activeVersionId = '', onNavigateToEvolution }) {
  const [policyData, setPolicyData] = useState(null);
  const [allVersions, setAllVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(activeVersionId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPolicy = async (vId = '') => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getActivePolicy(vId);
      setPolicyData(data);
      if (!selectedVersion && data.active_agent_version) {
        setSelectedVersion(data.active_agent_version.id);
      }
    } catch (err) {
      setError(err.message || 'Failed to load reconciliation policy');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicy(selectedVersion);
  }, [selectedVersion]);

  useEffect(() => {
    getAgentVersions()
      .then(versions => setAllVersions(versions || []))
      .catch(() => {});
  }, []);

  if (isLoading && !policyData) {
    return (
      <div className="forge-card p-12 text-center space-y-3 animate-pulse">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-mono">Loading reconciliation policy & safety boundaries...</p>
      </div>
    );
  }

  if (error && !policyData) {
    return (
      <div className="forge-card p-8 text-center space-y-3 border-rose-200 bg-rose-50/50">
        <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
        <h3 className="font-bold text-sm text-rose-900">Failed to Load Reconciliation Policy</h3>
        <p className="text-xs text-rose-700">{error}</p>
        <button onClick={() => fetchPolicy(selectedVersion)} className="btn-secondary text-xs">
          Retry
        </button>
      </div>
    );
  }

  const agent = policyData?.active_agent_version || {};
  const policy = policyData?.decision_policy || {};
  const boundaries = policyData?.safety_boundaries || [];
  const governance = policyData?.governance || {};

  return (
    <div className="space-y-6 text-ink">
      
      {/* 1. Header Banner: Office of the CFO & Governance */}
      <div className="forge-card p-6 border-slate-200/90 bg-white space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-serif font-bold text-lg sm:text-xl text-ink">
                  Office of the CFO — Reconciliation Policy & Safety Governance
                </h2>
                <p className="text-xs text-slate-500">
                  Auditable straight-through processing thresholds, confidence floors, and non-negotiable financial guardrails.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3 self-start sm:self-auto">
            {/* Version Selector */}
            {allVersions.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-[11px] font-mono text-slate-400">Inspecting Version:</span>
                <select
                  value={selectedVersion || agent.id || ''}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-mono font-bold rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {allVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.id.toUpperCase()} {v.is_active ? '• Active' : ''} ({v.version_name})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Read-Only Governance Lock Badge */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono font-semibold" title="Policy is read-only to preserve internal accounting controls">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>READ-ONLY GOVERNANCE</span>
            </div>
          </div>
        </div>

        {/* Governance Notice */}
        <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-slate-200/80 flex items-start space-x-3 text-xs">
          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-slate-600 leading-relaxed">
            <span className="font-bold text-slate-800 font-mono text-[11px] uppercase tracking-wider block">
              Internal Controls & Regulatory Compliance
            </span>
            <p>
              {governance.description || 'Reconciliation policy is read-only to guarantee regulatory compliance and prevent unauthorized weakening of financial controls.'}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top Metric Row: Active Reconciler Profile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Agent Version */}
        <div className="forge-card p-4 space-y-1.5 border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Active Reconciler
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
              agent.is_active ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
            }`}>
              {agent.is_active ? '● IN PRODUCTION' : 'INACTIVE SPEC'}
            </span>
          </div>
          <div className="font-serif font-bold text-base text-ink line-clamp-1">
            {agent.version_name || agent.id}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">
            ID: <strong className="text-slate-800">{agent.id}</strong> • Effective: {agent.created_at ? agent.created_at.split(' ')[0] : '—'}
          </div>
        </div>

        {/* Card 2: Auto-Match Confidence Floor */}
        <div className="forge-card p-4 space-y-1.5 border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Auto-Reconcile Floor
            </span>
            <Scale className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">
            {policy.confidence_threshold_pct !== undefined ? `${policy.confidence_threshold_pct}%` : `${(policy.confidence_threshold || 0.9) * 100}%`}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Minimum model confidence required for straight-through posting.
          </p>
        </div>

        {/* Card 3: STP Rate & Accuracy */}
        <div className="forge-card p-4 space-y-1.5 border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              STP Rate & Accuracy
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">
            {agent.stp_rate !== undefined ? `${Math.round(agent.stp_rate * 100)}%` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Benchmark Accuracy: <strong>{agent.accuracy_score !== undefined ? `${Math.round(agent.accuracy_score * 100)}%` : '—'}</strong>
          </p>
        </div>

        {/* Card 4: Execution Latency */}
        <div className="forge-card p-4 space-y-1.5 border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
              Execution Latency
            </span>
            <Clock className="w-3.5 h-3.5 text-sky-600" />
          </div>
          <div className="text-2xl font-bold font-mono text-ink">
            {agent.avg_latency_ms !== undefined ? `${agent.avg_latency_ms} ms` : '—'}
          </div>
          <p className="text-[11px] text-slate-500 leading-tight">
            Reliability Score: <strong>{agent.reliability_score !== undefined ? `${Math.round(agent.reliability_score * 100)}%` : '100%'}</strong>
          </p>
        </div>
      </div>

      {/* 3. Operational Policy Parameters */}
      <div className="forge-card p-6 border-slate-200 bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-serif font-bold text-base text-ink flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>Configured Reconciliation Parameters</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Current operational boundaries evaluated by the Decision Engine before taking any automated action.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
            Source: DecisionPolicy
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Parameter 1 */}
          <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-slate-200 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Confidence Floor
            </span>
            <div className="font-mono font-bold text-base text-ink">
              {policy.confidence_threshold_pct !== undefined ? `${policy.confidence_threshold_pct}%` : `${(policy.confidence_threshold || 0.9) * 100}%`}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Discrepancies scoring below this floor are automatically escalated to human accountants.
            </p>
          </div>

          {/* Parameter 2 */}
          <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-slate-200 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Minimum Corroborated Evidence
            </span>
            <div className="font-mono font-bold text-base text-ink">
              {policy.min_evidence_count || 1} Evidence Signal{policy.min_evidence_count === 1 ? '' : 's'}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Number of verified data signals (reference, counterparty, date) required before matching.
            </p>
          </div>

          {/* Parameter 3 */}
          <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-slate-200 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Settlement Timing Tolerance
            </span>
            <div className="font-mono font-bold text-base text-ink">
              {policy.max_date_difference_days || 7} Days
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Allowable timing lag between bank value date and ledger posting date for timing differences.
            </p>
          </div>

          {/* Parameter 4 */}
          <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-slate-200 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Amount Variance / Fee Tolerance
            </span>
            <div className="font-mono font-bold text-base text-ink">
              {policy.max_amount_variance !== undefined ? `${Number(policy.max_amount_variance).toFixed(2)} units` : '50.00 units'}
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Maximum allowable monetary variance for intermediary wire/bank fee deductions in transaction currency.
            </p>
          </div>

          {/* Parameter 5 */}
          <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-slate-200 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Ambiguity Escalation Guard
            </span>
            <div className="font-mono font-bold text-base text-emerald-800 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>STRICT (0.05 Margin)</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Escalates to human review whenever the top two candidates score within 0.05 of each other.
            </p>
          </div>

          {/* Parameter 6 */}
          <div className="p-3.5 rounded-xl bg-[#FAFAF8] border border-slate-200 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Duplicate Candidate Guard
            </span>
            <div className="font-mono font-bold text-base text-emerald-800 flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>ENABLED</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Blocks auto-reconciliation if an equivalent ledger entry is already allocated to another bank transaction.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Allowed Automatic Reconciliation Categories */}
      <div className="forge-card p-6 border-slate-200 bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-serif font-bold text-base text-ink flex items-center space-x-2">
              <Layers className="w-4 h-4 text-sky-600" />
              <span>Allowed Automatic Reconciliation Categories</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Categories where straight-through automated clearing is permitted if all safety checks pass.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {policy.allowed_auto_exception_types?.length || 0} Categories Allowed
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {(policy.allowed_categories && policy.allowed_categories.length > 0 ? policy.allowed_categories : (policy.allowed_auto_exception_types || [])).map((cat, idx) => {
            const code = typeof cat === 'string' ? cat : cat.code;
            const desc = typeof cat === 'string' ? cat.replace(/_/g, ' ') : cat.description;
            return (
              <div key={idx} className="p-3 rounded-xl bg-[#FAFAF8] border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-800 block text-[11px]">{desc}</span>
                    <span className="font-mono text-[10px] text-slate-400 font-semibold">{code}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  AUTO-ELIGIBLE
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Non-Negotiable Safety Boundaries (DecisionEngine Source of Truth) */}
      <div className="forge-card p-6 border-2 border-amber-200/80 bg-amber-50/20 space-y-4">
        <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
          <div>
            <h3 className="font-serif font-bold text-base text-amber-950 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Non-Negotiable Safety Boundaries (Mandatory Human Review)</span>
            </h3>
            <p className="text-xs text-amber-900/80 mt-0.5">
              Hard financial rules enforced by the Decision Engine. A high model confidence can <strong>NEVER</strong> override these boundaries.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
            Hard Safety Overrides
          </span>
        </div>

        <div className="space-y-2.5 text-xs">
          {boundaries.map((bound) => (
            <div key={bound.id || bound.category} className="p-3.5 rounded-xl bg-white border border-amber-200/80 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-bold text-slate-900 text-xs">{bound.category}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                  {bound.action}
                </span>
              </div>
              <p className="text-slate-700 text-[11px] leading-relaxed">
                <strong>Trigger Condition:</strong> {bound.condition}
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1 border-t border-slate-100 text-[10px] text-slate-500 font-mono">
                <span>Rule: {bound.rule}</span>
                <span className="text-indigo-600">{bound.source}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Policy Governance & Promotion Workflow */}
      <div className="forge-card p-6 border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 max-w-xl text-xs">
          <div className="font-serif font-bold text-sm text-ink flex items-center space-x-1.5">
            <Cpu className="w-4 h-4 text-indigo-600" />
            <span>Need to Adjust Policy Thresholds?</span>
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            To comply with SOX & internal accounting auditability standards, threshold changes cannot be edited directly in production. Use the <strong>Agent Evolution</strong> pipeline to benchmark candidate policies and formally promote a validated version.
          </p>
        </div>

        {onNavigateToEvolution && (
          <button
            onClick={onNavigateToEvolution}
            className="btn-primary text-xs font-mono shrink-0 flex items-center space-x-2 self-start sm:self-auto"
          >
            <span>Open Agent Evolution</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

    </div>
  );
}

export default ReconciliationPolicyView;
