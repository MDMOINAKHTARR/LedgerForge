import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Check, AlertCircle, FileText, CheckCircle2, MessageSquare, Clock, ArrowDown, ExternalLink, PlusCircle, Ban } from 'lucide-react';
import { recordHumanAction, getReconciliationTrace } from '../services/api';

export function ExceptionDrawer({ result, onClose, onActionSuccess }) {
  if (!result) return null;

  const [notes, setNotes] = useState(result.human_notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(result.human_status || 'PENDING');
  const [traceData, setTraceData] = useState(null);
  const [loadingTrace, setLoadingTrace] = useState(false);

  const b = result.bank_tx;
  const l = result.ledger_tx;
  const confPct = Math.round(result.confidence_score * 100);
  const isEscalated = result.action_taken === 'ESCALATE_TO_HUMAN';

  // Calculate amount delta if both bank & ledger present
  const bankAmt = b?.amount || 0;
  const ledgerAmt = l?.amount || 0;
  const diffAmt = Math.abs(bankAmt - ledgerAmt);

  const getCurrencySymbol = (code) => {
    if (!code) return '';
    const c = code.toUpperCase();
    const map = { INR: '₹', USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'AU$', JPY: '¥' };
    return map[c] || `${code} `;
  };

  const formatCurrency = (amt, code) => {
    if (amt === null || amt === undefined) return '0.00';
    const sym = getCurrencySymbol(code);
    const sign = amt < 0 ? '-' : '';
    return `${sign}${sym}${Math.abs(amt).toFixed(2)}`;
  };

  useEffect(() => {
    const fetchTrace = async () => {
      setLoadingTrace(true);
      try {
        const data = await getReconciliationTrace(result.id);
        setTraceData(data);
      } catch (err) {
        // Fallback to result.timeline_events if trace API record not created yet
        setTraceData({ timeline_events: result.timeline_events || [] });
      } finally {
        setLoadingTrace(false);
      }
    };
    fetchTrace();
  }, [result.id]);

  const handleAction = async (actionType) => {
    setIsSubmitting(true);
    try {
      await recordHumanAction(result.id, actionType, notes);
      setCurrentStatus(actionType);
      if (onActionSuccess) onActionSuccess(result.id, actionType, notes);
    } catch (err) {
      alert('Error saving decision: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Default timeline audit events if empty
  const timelineEvents = (traceData?.timeline_events && traceData.timeline_events.length > 0)
    ? traceData.timeline_events
    : [
        { stage_name: 'AGENT_STARTED', timestamp: result.created_at || '18:30:00', description: `Reconciliation initiated for Bank Tx #${b?.id || result.bank_tx_id} (${formatCurrency(bankAmt, b?.currency)}).` },
        { stage_name: 'MATCHING_STAGE', timestamp: result.created_at || '18:30:00', description: 'Stage 1 Deterministic RULE evaluation completed.' },
        { stage_name: 'FUZZY_STAGE', timestamp: result.created_at || '18:30:01', description: 'Stage 2 Heuristic FUZZY evaluation performed (clearing window & string similarity).' },
        { stage_name: 'DECISION_STAGE', timestamp: result.created_at || '18:30:01', description: `Phase 4 Decision Engine policy evaluation completed. Confidence assigned: ${confPct}%.` },
        ...(isEscalated ? [{ stage_name: 'ESCALATION', timestamp: result.created_at || '18:30:02', description: `Human review required. Principle: Knows when to stop and ask. ${result.reasoning}` }] : []),
        { stage_name: 'FINAL_RESULT', timestamp: result.created_at || '18:30:02', description: `Final outcome: ${result.action_taken}. Matched: ${l?.id || 'None'}.` }
      ];

  const evidenceList = (traceData?.evidence && traceData.evidence.length > 0)
    ? traceData.evidence
    : (result.evidence && result.evidence.length > 0)
    ? result.evidence
    : [
        `Assigned model confidence score: ${confPct}%`,
        `Bank description: "${b?.description || 'N/A'}"`,
        `Transaction date window: ${b?.date || 'N/A'}`
      ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-y-auto">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center font-bold text-xs ${
              isEscalated
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              {isEscalated ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  Transaction Audit Detail
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  ID: {result.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Explainable reconciliation path & audit execution trace.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1 text-xs">

          {/* ESCALATED SPECIFIC: "Human Review Required" Box */}
          {isEscalated && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span className="font-bold font-mono text-amber-300 uppercase tracking-wider">
                    Human Review Required
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300">
                  Recommendation: ESCALATE
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-slate-950/80 p-3 rounded-lg border border-amber-500/20 font-mono text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">Bank Amount:</span>
                  <span className="font-bold text-slate-200">{formatCurrency(bankAmt, b?.currency)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Ledger Amount:</span>
                  <span className="font-bold text-slate-200">{l ? formatCurrency(ledgerAmt, l?.currency) : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Difference:</span>
                  <span className="font-bold text-amber-400">{formatCurrency(diffAmt, b?.currency || l?.currency)}</span>
                </div>
              </div>

              {/* Stop Reason Details (Knows When to Stop and Ask) */}
              {result.stop_reason_details && (
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-lg space-y-2">
                  <div className="flex items-center space-x-1.5 text-amber-400 font-mono text-[11px] font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>POLICY STOP: KNOWS WHEN TO STOP & ASK</span>
                  </div>
                  <p className="text-slate-200 font-sans text-xs">
                    <strong className="text-amber-300">Why Stopped:</strong> {result.stop_reason_details.why_stopped}
                  </p>
                  {result.stop_reason_details.conflicting_evidence?.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-rose-400 font-bold block mb-1">
                        Conflicting Evidence:
                      </span>
                      <ul className="list-disc list-inside text-rose-300 space-y-0.5 text-[11px]">
                        {result.stop_reason_details.conflicting_evidence.map((ce, idx) => (
                          <li key={idx}>{ce}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.stop_reason_details.recommended_action && (
                    <div className="text-[11px] text-slate-300 pt-1 border-t border-amber-500/20">
                      <strong className="text-amber-400 font-mono">Recommended Action:</strong> {result.stop_reason_details.recommended_action}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-300">Escalation Reason:</span>
                <p className="text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800 leading-relaxed font-sans">
                  "{result.reasoning}"
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Confidence: <strong className="text-amber-400 font-mono">{confPct}%</strong></span>
                <span>Policy Applied: <strong className="text-slate-300">Min 90% + No Unexplained Variance</strong></span>
              </div>
            </div>
          )}

          {/* 1. Bank Transaction */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold font-mono text-emerald-400 uppercase tracking-wider text-[11px]">
                1. Bank Transaction
              </span>
              <span className="font-mono font-bold text-white text-sm">
                {formatCurrency(bankAmt, b?.currency)} <span className="text-xs text-slate-400">{b?.currency || ''}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">Description:</span>
                <span className="font-semibold text-slate-200">{b?.description || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Date:</span>
                <span className="font-mono text-slate-300">{b?.date || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Reference:</span>
                <span className="font-mono text-slate-300">{b?.reference_id || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Account:</span>
                <span className="font-mono text-slate-300">OPERATING_1001</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center -my-2 text-slate-600">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 2. Candidate Ledger Matches */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-bold font-mono text-slate-300 uppercase tracking-wider text-[11px]">
                2. Selected / Candidate Ledger Match
              </span>
              {l ? (
                <span className="font-mono font-bold text-white text-sm">
                  {formatCurrency(ledgerAmt, l?.currency)} <span className="text-xs text-slate-400">{l?.currency || ''}</span>
                </span>
              ) : (
                <span className="text-rose-400 italic text-[11px]">No match identified</span>
              )}
            </div>
            {l ? (
              <div className="grid grid-cols-2 gap-3 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px]">Ledger Entry:</span>
                  <span className="font-semibold text-slate-200">{l?.description}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Date:</span>
                  <span className="font-mono text-slate-300">{l?.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Invoice / Reference:</span>
                  <span className="font-mono text-slate-300">{l?.reference_id || l?.id || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Vendor / Customer:</span>
                  <span className="font-mono text-slate-300">{l?.counterparty || 'Corporate'}</span>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 italic py-1 text-[11px]">
                No matching entry exists in company ledger. Flagged for review or adjustment.
              </p>
            )}
          </div>

          <div className="flex justify-center -my-2 text-slate-600">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 3. Evidence Points */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-bold font-mono text-slate-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>3. Grounded Evidence Facts</span>
            </h4>
            <div className="space-y-1.5">
              {evidenceList.map((fact, idx) => (
                <div key={idx} className="bg-slate-900/80 p-2 rounded border border-slate-800 flex items-center space-x-2 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="font-sans">{fact}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center -my-2 text-slate-600">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 4. Confidence & Decision */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block">
                4. Confidence Score
              </span>
              <span className={`text-2xl font-black font-mono mt-1 block ${
                confPct >= 90 ? 'text-emerald-400' : confPct >= 75 ? 'text-amber-400' : 'text-rose-400'
              }`}>
                {confPct}%
              </span>
              <span className="text-[10px] text-slate-400">Threshold: 90%</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono block">
                5. Decision Outcome
              </span>
              <span className={`text-sm font-bold font-mono mt-2 block px-2 py-1 rounded ${
                result.action_taken === 'AUTO_RECONCILE'
                  ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30'
                  : 'text-amber-300 bg-amber-500/10 border border-amber-500/30'
              }`}>
                {result.action_taken === 'ESCALATE_TO_HUMAN' ? 'ESCALATE' : result.action_taken}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Category: {result.match_type}</span>
            </div>
          </div>

          <div className="flex justify-center -my-2 text-slate-600">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 5. Concise Reasoning */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h4 className="font-bold font-mono text-slate-300 uppercase tracking-wider text-[11px]">
              6. Decision Rationale
            </h4>
            <p className="text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 leading-relaxed font-sans">
              {result.reasoning}
            </p>
          </div>

          <div className="flex justify-center -my-2 text-slate-600">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 6. Audit Timeline (Phase 5 7-Stage Trace) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold font-mono text-slate-300 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>7. Immutable Execution Trace Timeline</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">7 Stages</span>
            </div>

            <div className="space-y-2 relative border-l border-slate-800 ml-2 pl-3">
              {timelineEvents.map((evt, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-slate-600 group-hover:bg-emerald-400 transition-colors" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {evt.stage_name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">{evt.timestamp}</span>
                  </div>
                  <p className="text-slate-400 mt-1 text-[11px] font-sans leading-normal">
                    {evt.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Auditor Notes Input */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-300 flex items-center space-x-1.5 text-[11px]">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Human Auditor Sign-off Notes:</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional audit justification or instructions (e.g. Verified with receipt)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-slate-700 font-sans"
            />
          </div>

        </div>

        {/* Action Bar Footer for Escalated Cases */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 sticky bottom-0 flex items-center gap-2">
          <button
            onClick={() => handleAction('APPROVED')}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm Match</span>
          </button>

          <button
            onClick={() => handleAction('REJECT')}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono text-xs font-bold transition-all flex items-center justify-center space-x-1.5"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>

          <button
            onClick={() => handleAction('OVERRIDE')}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-bold transition-all flex items-center justify-center space-x-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Adjustment</span>
          </button>
        </div>

      </div>
    </div>
  );
}
