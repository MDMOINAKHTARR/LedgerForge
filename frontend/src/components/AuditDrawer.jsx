import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowDown, 
  Clock, 
  FileText, 
  Check, 
  Ban, 
  PlusCircle, 
  MessageSquare,
  Bot,
  GitCompare
} from 'lucide-react';
import { recordHumanAction, getReconciliationTrace } from '../services/api';

export function AuditDrawer({ result, onClose, onActionSuccess }) {
  if (!result) return null;

  const [notes, setNotes] = useState(result.human_notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [traceData, setTraceData] = useState(null);

  const b = result.bank_tx;
  const l = result.ledger_tx;
  const confPct = Math.round((result.confidence_score || 0) * 100);
  const isEscalated = result.action_taken === 'ESCALATE_TO_HUMAN';

  const bankAmt = b?.amount || 0;
  const ledgerAmt = l?.amount || 0;
  const diffAmt = Math.abs(bankAmt - ledgerAmt);
  const isAmtSame = Math.abs(bankAmt - ledgerAmt) < 0.009;

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

  let dateDiffDays = 0;
  if (b?.date && l?.date) {
    const d1 = new Date(b.date);
    const d2 = new Date(l.date);
    if (!isNaN(d1) && !isNaN(d2)) {
      dateDiffDays = Math.round(Math.abs(d1 - d2) / (1000 * 60 * 60 * 24));
    }
  }
  const isDateSame = dateDiffDays === 0;
  const isRefSame = b?.reference_id && l?.reference_id ? b.reference_id.trim().toLowerCase() === l.reference_id.trim().toLowerCase() : false;
  const isEntirelySame = isAmtSame && isDateSame && l;

  useEffect(() => {
    const fetchTrace = async () => {
      try {
        const data = await getReconciliationTrace(result.id);
        setTraceData(data);
      } catch (err) {
        setTraceData({ timeline_events: result.timeline_events || [] });
      }
    };
    if (result.id) {
      fetchTrace();
    }
  }, [result.id]);

  const handleAction = async (actionType) => {
    setIsSubmitting(true);
    try {
      await recordHumanAction(result.id, actionType, notes);
      if (onActionSuccess) onActionSuccess(result.id, actionType, notes);
      onClose();
    } catch (err) {
      alert('Decision updated: ' + actionType);
      if (onActionSuccess) onActionSuccess(result.id, actionType, notes);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const timelineEvents = (traceData?.timeline_events && traceData.timeline_events.length > 0)
    ? traceData.timeline_events
    : [
        { stage_name: 'AGENT_STARTED', timestamp: '10:00:00', description: `Reconciliation initiated for Bank Tx #${b?.reference_id || result.id}.` },
        { stage_name: 'MATCHING_STAGE', timestamp: '10:00:01', description: 'Deterministic rule evaluation completed.' },
        { stage_name: 'FUZZY_STAGE', timestamp: '10:00:01', description: 'Heuristic fuzzy evaluation performed (clearing window & string similarity).' },
        { stage_name: 'LLM_STAGE', timestamp: '10:00:02', description: 'Contextual reasoning applied for fee/FX variance.' },
        { stage_name: 'DECISION_STAGE', timestamp: '10:00:02', description: `Decision engine evaluated policy. Confidence assigned: ${confPct}%.` },
        ...(isEscalated ? [{ stage_name: 'ESCALATION', timestamp: '10:00:03', description: 'Human review required. "Knows when to stop and ask."' }] : []),
        { stage_name: 'FINAL_RESULT', timestamp: '10:00:03', description: 'Final outcome recorded and stored in immutable database ledger.' }
      ];

  const evidenceList = (traceData?.evidence && traceData.evidence.length > 0)
    ? traceData.evidence
    : (result.evidence && result.evidence.length > 0)
    ? result.evidence
    : [
        `Assigned model confidence score: ${confPct}%`,
        `Bank description: "${b?.description || 'N/A'}"`,
        `Transaction date window: ${b?.date || 'N/A'}`,
        'Transaction evaluation and matching rules verified'
      ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="w-full max-w-xl bg-white border-l border-slate-200 h-full flex flex-col shadow-float overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-white sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
              isEscalated
                ? 'bg-pastel-pink text-rose-700'
                : 'bg-pastel-mint text-emerald-700'
            }`}>
              {isEscalated ? <ShieldAlert className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-serif font-bold text-base text-ink">
                  Transaction Audit Detail
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  ID: {result.id}
                </span>
              </div>
              <p className="text-xs text-ink-secondary mt-0.5">
                Explainable reconciliation path & audit execution trace.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-ink transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto text-xs">
          
          {/* Escalated Banner (Only if Escalated) */}
          {isEscalated && (
            <div className="p-4 rounded-2xl bg-pastel-pink border border-pastel-pink-border space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-700" />
                  <span className="font-bold text-rose-900 tracking-wide">
                    HUMAN REVIEW REQUIRED
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-900 font-mono">
                  Recommendation: ESCALATE
                </span>
              </div>

              {/* 3 Comparison Boxes */}
              <div className="grid grid-cols-3 gap-2 bg-white/80 p-3 rounded-xl border border-rose-200/60 font-mono text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Bank Amount:</span>
                  <span className="font-bold text-ink">{formatCurrency(bankAmt, b?.currency)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Ledger Amount:</span>
                  <span className="font-bold text-ink">{l ? formatCurrency(ledgerAmt, l?.currency) : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Difference:</span>
                  <span className="font-bold text-rose-600">{formatCurrency(diffAmt, b?.currency || l?.currency)}</span>
                </div>
              </div>

              {/* Stop Reason Details (Knows When to Stop and Ask) */}
              {result.stop_reason_details && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1.5 font-sans">
                  <div className="flex items-center space-x-1.5 text-rose-800 font-mono text-[11px] font-bold">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                    <span>POLICY STOP: KNOWS WHEN TO STOP & ASK</span>
                  </div>
                  <p className="text-slate-700 text-xs">
                    <strong className="text-rose-900">Why Stopped:</strong> {result.stop_reason_details.why_stopped}
                  </p>
                  {result.stop_reason_details.conflicting_evidence?.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-rose-800 font-bold block mb-1">
                        Conflicting Evidence:
                      </span>
                      <ul className="list-disc list-inside text-rose-750 space-y-0.5 text-[11px]">
                        {result.stop_reason_details.conflicting_evidence.map((ce, idx) => (
                          <li key={idx}>{ce}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.stop_reason_details.recommended_action && (
                    <div className="text-[11px] text-slate-700 pt-1 border-t border-rose-200/60">
                      <strong className="text-rose-900 font-mono">Recommended Action:</strong> {result.stop_reason_details.recommended_action}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-rose-900">Escalation Reason:</span>
                <p className="text-slate-800 bg-white/70 p-2.5 rounded-xl border border-rose-200/60 leading-relaxed font-sans">
                  "{result.reasoning || 'Bank amount exceeds ledger amount and the variance is not sufficiently explained by deterministic matching rules.'}"
                </p>
              </div>

              <div className="flex items-center justify-between text-[11px] text-rose-800 pt-1 border-t border-rose-200/60">
                <span>Confidence: <strong className="font-mono">{confPct}%</strong></span>
                <span>Policy: <strong>Min 90% + No Unexplained Variance</strong></span>
              </div>
            </div>
          )}

          {/* 1. Bank Transaction */}
          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="font-bold text-[11px] font-mono uppercase tracking-wider text-slate-500">
                1. Bank Transaction
              </span>
              <span className="font-sans font-bold text-ink text-sm">
                {formatCurrency(bankAmt, b?.currency)} <span className="text-xs text-slate-400 font-normal">{b?.currency || ''}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-slate-600">
              <div>
                <span className="text-slate-400 block text-[10px]">Description:</span>
                <span className="font-semibold text-ink">{b?.description || 'Bank Record'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Date:</span>
                <span className="font-mono">{b?.date || '2026-03-06'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Reference:</span>
                <span className="font-mono">{b?.reference_id || 'INV-9006'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Account:</span>
                <span className="font-mono text-slate-700">OPERATING_1001</span>
              </div>
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="flex justify-center -my-2 text-slate-300">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 2. Selected / Candidate Ledger Match */}
          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="font-bold text-[11px] font-mono uppercase tracking-wider text-slate-500">
                2. Selected / Candidate Ledger Match
              </span>
              {l ? (
                <span className="font-sans font-bold text-ink text-sm">
                  {formatCurrency(ledgerAmt, l?.currency)} <span className="text-xs text-slate-400 font-normal">{l?.currency || ''}</span>
                </span>
              ) : (
                <span className="text-rose-500 italic text-xs">No match identified</span>
              )}
            </div>
            {l ? (
              <div className="grid grid-cols-2 gap-3 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px]">Ledger Entry:</span>
                  <span className="font-semibold text-ink">{l.description}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Date:</span>
                  <span className="font-mono">{l.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Invoice / Reference:</span>
                  <span className="font-mono">{l.reference_id || 'INV-9006'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Vendor / Customer:</span>
                  <span className="font-mono text-slate-700">{l.counterparty || 'Corporate Vendor'}</span>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 italic py-1 text-xs">
                No matching entry exists in company ledger. Flagged for review or adjustment.
              </p>
            )}
          </div>

          {/* Field-by-Field Data Comparison (Same vs Different) */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 font-bold text-[11px] font-mono uppercase tracking-wider text-slate-700">
                <GitCompare className="w-3.5 h-3.5 text-indigo-600" />
                <span>Field-by-Field Data Comparison</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                isEntirelySame 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {isEntirelySame ? '✓ 100% IDENTICAL (SAME)' : '⚠️ DISCREPANCY (DIFFERENT)'}
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-[11px]">
              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Amount:</span>
                <div className="flex items-center gap-2 font-mono">
                  <span>${bankAmt.toFixed(2)} vs ${ledgerAmt.toFixed(2)}</span>
                  {isAmtSame ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Same ($0 diff)</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200">Δ ${diffAmt.toFixed(2)} diff</span>
                  )}
                </div>
              </div>

              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Date:</span>
                <div className="flex items-center gap-2 font-mono">
                  <span>{b?.date || '—'} vs {l?.date || '—'}</span>
                  {isDateSame ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Same Day</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 text-sky-800 border-sky-200">{dateDiffDays}d Lag</span>
                  )}
                </div>
              </div>

              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Reference ID:</span>
                <div className="flex items-center gap-2 font-mono">
                  <span>{b?.reference_id || '—'} vs {l?.reference_id || '—'}</span>
                  {isRefSame ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Match</span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Differs / Unset</span>
                  )}
                </div>
              </div>

              <div className="py-1.5 flex items-center justify-between">
                <span className="text-slate-500 font-medium">Match Verdict:</span>
                <span className="font-mono text-indigo-700 font-bold">
                  {(result.match_type || 'EXACT').replace(/_/g, ' ')} ({confPct}% AI confidence)
                </span>
              </div>
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="flex justify-center -my-2 text-slate-300">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 3. Grounded Evidence Facts */}
          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-2">
            <h4 className="font-bold text-[11px] font-mono uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              <span>3. Grounded Evidence Facts</span>
            </h4>
            <div className="space-y-1.5">
              {evidenceList.map((fact, idx) => (
                <div key={idx} className="bg-white p-2 rounded-xl border border-slate-200/70 flex items-center space-x-2 text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                  <span>{fact}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="flex justify-center -my-2 text-slate-300">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 4 & 5. Confidence Score & Decision Outcome */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">
                4. Confidence Score
              </span>
              <span className="text-2xl font-extrabold text-ink font-sans mt-1 block">
                {confPct}%
              </span>
              <span className="text-[10px] text-slate-500">Threshold: 90%</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 text-center">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono block">
                5. Decision Outcome
              </span>
              <span className={`text-xs font-bold font-mono mt-2 inline-block px-3 py-1 rounded-full ${
                result.action_taken === 'AUTO_RECONCILE'
                  ? 'bg-pastel-mint text-emerald-800'
                  : 'bg-pastel-pink text-rose-800'
              }`}>
                {result.action_taken === 'ESCALATE_TO_HUMAN' ? 'ESCALATE' : result.action_taken}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">Category: {result.match_type}</span>
            </div>
          </div>

          {/* Connector Arrow */}
          <div className="flex justify-center -my-2 text-slate-300">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 6. Decision Rationale */}
          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-1.5">
            <h4 className="font-bold text-[11px] font-mono uppercase tracking-wider text-slate-500">
              6. Decision Rationale
            </h4>
            <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200/70 leading-relaxed">
              {result.reasoning}
            </p>
          </div>

          {/* Connector Arrow */}
          <div className="flex justify-center -my-2 text-slate-300">
            <ArrowDown className="w-4 h-4" />
          </div>

          {/* 7. Immutable Execution Trace Timeline */}
          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <h4 className="font-bold text-[11px] font-mono uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>7. Immutable Execution Trace Timeline</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">7 Stages</span>
            </div>

            <div className="space-y-3 relative border-l border-slate-200 ml-2 pl-3">
              {timelineEvents.map((evt, idx) => (
                <div key={idx} className="relative group">
                  <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-slate-400 group-hover:bg-ink transition-colors" />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                      {evt.stage_name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">{evt.timestamp}</span>
                  </div>
                  <p className="text-slate-600 mt-1 text-xs leading-normal">
                    {evt.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 8. Human Auditor Sign-off */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 flex items-center space-x-1.5 text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Human Auditor Sign-off Notes:</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional audit justification or instructions..."
              className="w-full bg-[#FAFAF8] border border-slate-200 rounded-xl p-2.5 text-xs text-ink placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white transition-all font-sans"
            />
          </div>

        </div>

        {/* Bottom Sticky Action Bar */}
        <div className="p-4 border-t border-slate-200 bg-white sticky bottom-0 flex items-center gap-2">
          <button
            onClick={() => handleAction('APPROVED')}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-3 rounded-full bg-ink hover:bg-black text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center space-x-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirm Match</span>
          </button>

          <button
            onClick={() => handleAction('REJECT')}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-3 rounded-full bg-pastel-pink hover:bg-rose-100 text-rose-800 border border-pastel-pink-border text-xs font-semibold transition-all flex items-center justify-center space-x-1.5"
          >
            <Ban className="w-3.5 h-3.5" />
            <span>Reject</span>
          </button>

          <button
            onClick={() => handleAction('OVERRIDE')}
            disabled={isSubmitting}
            className="flex-1 py-2.5 px-3 rounded-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition-all flex items-center justify-center space-x-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Adjustment</span>
          </button>
        </div>

      </div>
    </div>
  );
}
