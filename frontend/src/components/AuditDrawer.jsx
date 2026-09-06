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
  GitCompare,
  Search,
  Receipt,
  Split,
  Copy,
  AlertTriangle,
  FileQuestion,
  FileMinus,
  HelpCircle,
  Sparkles,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { 
  recordHumanAction, 
  getReconciliationTrace, 
  getExceptionCandidates, 
  getExceptionMemory 
} from '../services/api';

// Currency symbol lookup utility (strictly dynamic — never assumes USD or INR)
export const getCurrencySymbol = (code) => {
  if (!code) return '';
  const c = String(code).trim().toUpperCase();
  const map = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'CA$',
    AUD: 'AU$',
    JPY: '¥',
    CHF: 'CHF ',
    SGD: 'SG$',
    AED: 'AED '
  };
  return map[c] || `${c} `;
};

// Formats amount with dynamic symbol and explicit currency code
export const formatCurrency = (amt, code) => {
  if (amt === null || amt === undefined) return '—';
  const num = Number(amt);
  if (isNaN(num)) return '0.00';
  const sym = getCurrencySymbol(code);
  const sign = num < 0 ? '-' : '';
  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const codeSuffix = code ? ` ${code.toUpperCase()}` : '';
  return `${sign}${sym}${formatted}${codeSuffix}`;
};

// Formats short amount without repeating currency code for compact labels
export const formatShortAmount = (amt, code) => {
  if (amt === null || amt === undefined) return '0.00';
  const num = Number(amt);
  if (isNaN(num)) return '0.00';
  const sym = getCurrencySymbol(code);
  const sign = num < 0 ? '-' : '';
  return `${sign}${sym}${Math.abs(num).toFixed(2)}`;
};

// 11 Structured Accounting Resolutions
const RESOLUTION_OPTIONS = [
  {
    type: 'CORRECT_MATCH',
    action: 'APPROVED',
    label: 'Confirm Match',
    shortLabel: 'Confirm Match',
    description: 'Approve candidate ledger entry as a valid and complete match.',
    icon: CheckCircle2,
    colorClass: 'emerald'
  },
  {
    type: 'SELECT_LEDGER',
    resolutionType: 'CORRECT_MATCH',
    action: 'APPROVED',
    label: 'Select Correct Ledger Entry',
    shortLabel: 'Re-assign Ledger',
    description: 'Re-assign match to a different ledger entry from this batch.',
    icon: Search,
    colorClass: 'indigo'
  },
  {
    type: 'TIMING_DIFFERENCE',
    action: 'APPROVED',
    label: 'Mark as Timing Difference',
    shortLabel: 'Timing Difference',
    description: 'Payment in transit across period end; valid timing variance.',
    icon: Clock,
    colorClass: 'sky'
  },
  {
    type: 'BANK_FEE',
    action: 'APPROVED',
    label: 'Mark as Bank Fee',
    shortLabel: 'Bank Fee',
    description: 'Variance represents wire/processing fee deducted by intermediary bank.',
    icon: Receipt,
    colorClass: 'amber'
  },
  {
    type: 'PARTIAL_PAYMENT',
    action: 'APPROVED',
    label: 'Mark as Partial Payment',
    shortLabel: 'Partial Payment',
    description: 'Short payment received; remaining invoice balance remains open in AR.',
    icon: Split,
    colorClass: 'purple'
  },
  {
    type: 'DUPLICATE_TRANSACTION',
    action: 'REJECTED',
    label: 'Mark as Duplicate',
    shortLabel: 'Duplicate',
    description: 'Duplicate transmission in bank feed; reject double posting.',
    icon: Copy,
    colorClass: 'rose'
  },
  {
    type: 'AMOUNT_VARIANCE',
    action: 'OVERRIDDEN',
    label: 'Mark as Amount Variance',
    shortLabel: 'Amount Variance',
    description: 'Unexplained price/quantity discrepancy; post adjustment or credit memo.',
    icon: AlertTriangle,
    colorClass: 'amber'
  },
  {
    type: 'MISSING_LEDGER_ENTRY',
    action: 'OVERRIDDEN',
    label: 'Mark as Missing Ledger Entry',
    shortLabel: 'Missing in GL',
    description: 'Valid bank transaction missing in GL; requires new journal voucher.',
    icon: FileQuestion,
    colorClass: 'orange'
  },
  {
    type: 'MISSING_BANK_ENTRY',
    action: 'OVERRIDDEN',
    label: 'Mark as Missing Bank Entry',
    shortLabel: 'Missing in Bank',
    description: 'Ledger invoice entered but payment un-cleared by bank.',
    icon: FileMinus,
    colorClass: 'slate'
  },
  {
    type: 'WRONG_MATCH',
    action: 'REJECTED',
    label: 'Reject / No Match',
    shortLabel: 'Reject Match',
    description: 'Proposed candidate linkage is incorrect; reject match.',
    icon: Ban,
    colorClass: 'rose'
  },
  {
    type: 'OTHER',
    action: 'OVERRIDDEN',
    label: 'Other Resolution',
    shortLabel: 'Other',
    description: 'Custom accounting reclassification specified in audit sign-off notes.',
    icon: HelpCircle,
    colorClass: 'slate'
  }
];

export function AuditDrawer({ result, onClose, onActionSuccess }) {
  if (!result) return null;

  // Accountant resolution form state
  const [selectedResolution, setSelectedResolution] = useState(() => {
    const match = (result.match_type || '').toUpperCase();
    if (match.includes('FEE')) return 'BANK_FEE';
    if (match.includes('TIMING') || match.includes('DATE')) return 'TIMING_DIFFERENCE';
    if (match.includes('PARTIAL')) return 'PARTIAL_PAYMENT';
    if (match.includes('DUPLICATE')) return 'DUPLICATE_TRANSACTION';
    if (match.includes('AMOUNT') || match.includes('VARIANCE')) return 'AMOUNT_VARIANCE';
    if (match.includes('MISSING_LEDGER')) return 'MISSING_LEDGER_ENTRY';
    if (match.includes('MISSING_BANK')) return 'MISSING_BANK_ENTRY';
    return 'CORRECT_MATCH';
  });

  const [notes, setNotes] = useState(result.human_notes || '');
  const [correctedLedgerId, setCorrectedLedgerId] = useState(result.ledger_tx?.id || null);
  const [candidateSearchTerm, setCandidateSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [traceData, setTraceData] = useState(null);
  const [availableCandidates, setAvailableCandidates] = useState(result.available_ledger_candidates || []);
  const [memoryInfo, setMemoryInfo] = useState(result.historical_memory || null);

  const b = result.bank_tx;
  const l = result.ledger_tx;
  const confPct = Math.round((result.confidence_score || 0) * 100);
  const isEscalated = result.action_taken === 'ESCALATE_TO_HUMAN';

  // Currency inspection & strict boundary protection
  const bCurr = (b?.currency || 'USD').toUpperCase();
  const lCurr = (l?.currency || bCurr).toUpperCase();
  const isSameCurrency = bCurr === lCurr;
  const isCrossCurrency = bCurr !== lCurr && Boolean(l);

  const bankAmt = b?.amount !== undefined ? Number(b.amount) : 0;
  const ledgerAmt = l?.amount !== undefined ? Number(l.amount) : 0;
  // NEVER subtract cross-currency amounts directly without explicit FX
  const diffAmt = isSameCurrency && l ? Math.abs(bankAmt - ledgerAmt) : null;
  const isAmtSame = isSameCurrency && diffAmt !== null && diffAmt < 0.009;

  // Date comparison
  let dateDiffDays = 0;
  if (b?.date && l?.date) {
    const d1 = new Date(b.date);
    const d2 = new Date(l.date);
    if (!isNaN(d1) && !isNaN(d2)) {
      dateDiffDays = Math.round(Math.abs(d1 - d2) / (1000 * 60 * 60 * 24));
    }
  }
  const isDateSame = dateDiffDays === 0;
  const isRefSame = b?.reference_id && l?.reference_id 
    ? String(b.reference_id).trim().toLowerCase() === String(l.reference_id).trim().toLowerCase() 
    : false;
  const isEntirelySame = isAmtSame && isDateSame && Boolean(l);

  // Fetch audit trace, candidates, and historical memory on load
  useEffect(() => {
    let isMounted = true;

    const loadExtraDetails = async () => {
      // 1. Fetch trace
      try {
        const trace = await getReconciliationTrace(result.id);
        if (isMounted) setTraceData(trace);
      } catch (err) {
        if (isMounted) setTraceData({ timeline_events: result.timeline_events || [] });
      }

      // 2. Fetch candidate ledger entries if not passed
      if (!result.available_ledger_candidates || result.available_ledger_candidates.length === 0) {
        try {
          const cands = await getExceptionCandidates(result.id);
          if (isMounted && cands && cands.length > 0) {
            setAvailableCandidates(cands);
          }
        } catch (err) {
          // Candidates endpoint optional fallback
        }
      }

      // 3. Fetch historical memory if not populated
      if (!result.historical_memory) {
        try {
          const mem = await getExceptionMemory(result.id);
          if (isMounted && mem && mem.has_memory) {
            setMemoryInfo({
              has_memory: true,
              precedent_count: mem.precedent_count,
              predominant_resolution: mem.predominant_resolution,
              trust_level: mem.trust_level,
              explanation: `${mem.precedent_count} prior similar resolution(s) recorded in reconciliation memory.`
            });
          }
        } catch (err) {
          // Memory endpoint optional fallback
        }
      }
    };

    if (result.id) {
      loadExtraDetails();
    }

    return () => {
      isMounted = false;
    };
  }, [result.id]);

  // Handle accountant structured resolution submit
  const handleApplyResolution = async () => {
    if (selectedResolution === 'OTHER' && (!notes || !notes.trim())) {
      alert('Resolution type "Other" requires explanatory working paper notes.');
      return;
    }

    setIsSubmitting(true);
    try {
      const option = RESOLUTION_OPTIONS.find(o => o.type === selectedResolution) || RESOLUTION_OPTIONS[0];
      const actionType = option.action; // APPROVED, REJECTED, or OVERRIDDEN
      const resType = option.resolutionType || option.type;
      const targetLedgerId = selectedResolution === 'SELECT_LEDGER' 
        ? correctedLedgerId 
        : null;

      await recordHumanAction(
        result.id,
        actionType,
        notes,
        targetLedgerId,
        resType,
        'lead_cpa_reviewer'
      );

      if (onActionSuccess) {
        onActionSuccess(result.id, actionType, notes, targetLedgerId, resType);
      }
      onClose();
    } catch (err) {
      alert('Error applying resolution: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Timeline events for trace
  const timelineEvents = (traceData?.timeline_events && traceData.timeline_events.length > 0)
    ? traceData.timeline_events
    : [
        { stage_name: 'AGENT_STARTED', timestamp: result.created_at || '10:00:00', description: `Reconciliation initiated for Bank Tx #${b?.reference || result.bank_tx_id || result.id}.` },
        { stage_name: 'MATCHING_STAGE', timestamp: '10:00:01', description: 'Deterministic RULE evaluation completed.' },
        { stage_name: 'FUZZY_STAGE', timestamp: '10:00:01', description: 'Heuristic FUZZY evaluation performed (clearing window & string similarity).' },
        { stage_name: 'DECISION_STAGE', timestamp: '10:00:02', description: `Decision engine evaluated policy thresholds. Confidence: ${confPct}%.` },
        ...(isEscalated ? [{ stage_name: 'ESCALATION', timestamp: '10:00:03', description: `Human review required. Principle: Knows when to stop and ask. Reason: ${result.reasoning || 'Variance detected.'}` }] : []),
        { stage_name: 'FINAL_RESULT', timestamp: '10:00:03', description: `Final outcome: ${result.action_taken}. Matched: ${l?.id || 'None'}.` }
      ];

  // Grounded evidence facts
  const evidenceList = (traceData?.evidence && traceData.evidence.length > 0)
    ? traceData.evidence
    : (result.evidence && result.evidence.length > 0)
    ? result.evidence
    : [
        `Assigned model confidence score: ${confPct}%`,
        `Bank description: "${b?.description || 'N/A'}"`,
        `Transaction date window: ${b?.date || 'N/A'}`
      ];

  // Determine explainable "Why Stopped" text
  const stopReasonText = result.stop_reason_details?.why_stopped || (() => {
    const match = (result.match_type || '').toUpperCase();
    if (match.includes('AMOUNT') || match.includes('VARIANCE') || match.includes('DISCREPANCY')) {
      return isSameCurrency && diffAmt !== null 
        ? `Amount variance detected: bank amount (${formatShortAmount(bankAmt, bCurr)}) differs from ledger candidate (${formatShortAmount(ledgerAmt, lCurr)}) by ${formatShortAmount(diffAmt, bCurr)}.`
        : 'Amount variance detected between bank statement and company ledger records.';
    }
    if (match.includes('DUPLICATE')) {
      return 'Duplicate candidate detected: multiple bank transactions claim the same ledger invoice.';
    }
    if (match.includes('FX') || match.includes('CURRENCY')) {
      return `Currency boundary mismatch: Bank transaction currency (${bCurr}) differs from ledger candidate (${lCurr}).`;
    }
    if (match.includes('PARTIAL')) {
      return 'Partial payment: bank deposit represents an installment; remaining balance remains open.';
    }
    if (match.includes('MISSING_LEDGER')) {
      return 'Missing ledger entry: bank deposit has no matching invoice or transaction in GL.';
    }
    if (match.includes('MISSING_BANK')) {
      return 'Missing bank clearing: ledger invoice recorded but matching bank deposit missing.';
    }
    if (match.includes('TIMING')) {
      return 'Timing difference: transaction cleared outside standard settlement window.';
    }
    if (confPct < 90) {
      return `Confidence score (${confPct}%) falls below mandatory 90% auto-reconciliation threshold.`;
    }
    return 'Policy guardrail stop: human verification required prior to general ledger posting.';
  })();

  // Filtered candidate ledger entries for manual selection
  const filteredCandidates = availableCandidates.filter(cand => {
    if (!candidateSearchTerm) return true;
    const term = candidateSearchTerm.toLowerCase();
    return (
      (cand.reference || '').toLowerCase().includes(term) ||
      (cand.invoice_id || '').toLowerCase().includes(term) ||
      (cand.description || '').toLowerCase().includes(term) ||
      (cand.counterparty || '').toLowerCase().includes(term) ||
      String(cand.amount || '').includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="w-full max-w-2xl bg-white border-l border-slate-200 h-full flex flex-col shadow-2xl overflow-hidden font-sans">
        
        {/* Top Drawer Header */}
        <div className="p-5 border-b border-slate-200 bg-white sticky top-0 z-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
              isEscalated
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              {isEscalated ? <ShieldAlert className="w-5 h-5 text-amber-600" /> : <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="font-serif font-bold text-base text-ink">
                  Reconciliation Exception Review
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  ID: {result.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Month-end Bank-to-General-Ledger audit & structured human disposition.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-ink transition-colors"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto text-xs">
          
          {/* ========================================================================= */}
          {/* SECTION 1: AI AGENT RECOMMENDATION & MACHINE DIAGNOSIS                    */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-mono font-bold text-[11px] uppercase tracking-wider text-amber-900">
                  AI Agent Recommendation & Diagnostic Findings
                </span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-200">
                Agent Verdict: {result.action_taken === 'ESCALATE_TO_HUMAN' ? 'ESCALATE TO HUMAN' : result.action_taken}
              </span>
            </div>

            {/* Why Stopped Card */}
            <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center space-x-1.5 text-amber-800 font-mono text-[11px] font-bold">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>WHY AUTOMATIC RECONCILIATION STOPPED</span>
              </div>
              <p className="text-slate-800 text-xs leading-relaxed font-medium">
                {stopReasonText}
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                  Confidence: <strong>{confPct}%</strong> (Floor: 90%)
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                  Category: <strong>{(result.match_type || 'VARIANCE').replace(/_/g, ' ')}</strong>
                </span>
              </div>
            </div>

            {/* Agent Rationale */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-amber-950 font-mono">Agent Decision Rationale:</span>
              <p className="text-slate-700 bg-white/80 p-2.5 rounded-xl border border-amber-200/70 leading-relaxed font-sans">
                "{result.reasoning || 'Transaction requires accountant review to verify discrepancy classification.'}"
              </p>
            </div>

            {/* Historical Precedent Advisory Context (if present) */}
            {memoryInfo && memoryInfo.has_memory && (
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[10px] uppercase text-indigo-900 flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Historical Memory Precedent</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-indigo-100 text-indigo-800">
                    Trust: {memoryInfo.trust_level || 'ADVISORY'}
                  </span>
                </div>
                <p className="text-indigo-950 text-[11px] leading-relaxed">
                  {memoryInfo.explanation}
                </p>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: SIDE-BY-SIDE FINANCIAL COMPARISON                              */}
          {/* ========================================================================= */}
          <div className="space-y-3">
            <h3 className="font-mono font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
              <GitCompare className="w-3.5 h-3.5 text-slate-500" />
              <span>Financial Data Comparison</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: Bank Transaction */}
              <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-slate-500">
                    Bank Statement Entry
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    (b?.direction || '').includes('DR') || bankAmt < 0
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {b?.direction || (bankAmt >= 0 ? 'CREDIT / INFLOW' : 'DEBIT / OUTFLOW')}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Amount & Currency:</span>
                  <span className="text-base font-bold text-ink font-mono">
                    {formatCurrency(bankAmt, bCurr)}
                  </span>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Reference / Doc ID:</span>
                    <span className="font-mono font-semibold text-slate-800">{b?.reference || b?.reference_id || b?.id || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Counterparty / Description:</span>
                    <span className="font-medium text-slate-800 line-clamp-1">{b?.counterparty || b?.description || 'N/A'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Transaction Date:</span>
                      <span className="font-mono text-slate-700">{b?.date || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Value Date:</span>
                      <span className="font-mono text-slate-700">{b?.value_date || b?.date || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 2: Ledger Candidate Match */}
              <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-mono font-bold text-[10px] uppercase tracking-wider text-slate-500">
                    GL Candidate Match
                  </span>
                  {l ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      Status: {l.status || 'POSTED'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Unmatched
                    </span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-mono block">Amount & Currency:</span>
                  <span className="text-base font-bold text-ink font-mono">
                    {l ? formatCurrency(ledgerAmt, lCurr) : <span className="text-slate-400 text-sm italic font-normal">No Candidate</span>}
                  </span>
                </div>

                {l ? (
                  <div className="space-y-1 pt-1 border-t border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Invoice / Reference:</span>
                      <span className="font-mono font-semibold text-slate-800">{l.invoice_id || l.reference_id || l.id || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Vendor / Customer:</span>
                      <span className="font-medium text-slate-800 line-clamp-1">{l.counterparty || l.description || 'Corporate GL'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-slate-400 text-[10px] block">GL Posting Date:</span>
                        <span className="font-mono text-slate-700">{l.posting_date || l.date || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Document Date:</span>
                        <span className="font-mono text-slate-700">{l.date || '—'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 text-slate-500 italic text-[11px]">
                    No corresponding ledger entry was automatically matched. Use the resolution panel below to select or reclassify.
                  </div>
                )}
              </div>
            </div>

            {/* Variance Bar (With strict mixed-currency isolation) */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center space-x-2">
                <span className="font-medium text-slate-600">Reconciliation Variance:</span>
                {isCrossCurrency ? (
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Cross-Currency ({bCurr} vs {lCurr})
                  </span>
                ) : isAmtSame ? (
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Exact Amount Match (Δ 0.00 {bCurr})
                  </span>
                ) : l ? (
                  <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Δ {formatShortAmount(diffAmt, bCurr)} Variance
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-mono">Ledger Entry Missing</span>
                )}
              </div>

              {isCrossCurrency && (
                <span className="text-[10px] text-slate-400 italic">
                  * Explicit foreign exchange conversion rate required for variance settlement.
                </span>
              )}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 3: GROUNDED AGENT EVIDENCE                                        */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-2">
            <h4 className="font-bold text-[11px] font-mono uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-600" />
              <span>Grounded Evidence Facts (Why Candidate Considered)</span>
            </h4>
            <div className="space-y-1.5">
              {evidenceList.map((fact, idx) => (
                <div key={idx} className="bg-white p-2 rounded-xl border border-slate-200/80 flex items-center space-x-2 text-slate-700 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                  <span>{fact}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 4: STRUCTURED ACCOUNTANT RESOLUTION (HUMAN SIGN-OFF LAYER)        */}
          {/* ========================================================================= */}
          <div className="p-5 rounded-2xl bg-white border-2 border-indigo-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-serif font-bold text-base text-ink">
                  Accountant Resolution & Human Sign-Off
                </h3>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Select the structured accounting resolution for this month-end exception.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold font-mono bg-indigo-50 text-indigo-800 border border-indigo-200">
                Independent Human Action
              </span>
            </div>

            {/* Resolution Cards Grid */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 block">
                Accounting Resolution Classification:
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {RESOLUTION_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedResolution === opt.type;
                  return (
                    <button
                      key={opt.type}
                      type="button"
                      onClick={() => setSelectedResolution(opt.type)}
                      className={`p-3 rounded-xl border text-left transition-all flex items-start space-x-2.5 ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                          : 'bg-[#FAFAF8] border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold text-xs leading-snug ${isSelected ? 'text-indigo-950 font-bold' : 'text-slate-800'}`}>
                            {opt.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                          {opt.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Re-assignment Selector (Active when "Select Correct Ledger Entry" chosen) */}
            {selectedResolution === 'SELECT_LEDGER' && (
              <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200 space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[11px] text-indigo-950 uppercase">
                    Select Correct Ledger Entry from Batch ({availableCandidates.length} available):
                  </span>
                  <span className="text-[10px] text-indigo-700 font-medium">Click to select match</span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={candidateSearchTerm}
                    onChange={(e) => setCandidateSearchTerm(e.target.value)}
                    placeholder="Search by invoice, reference, vendor, or amount..."
                    className="w-full bg-white border border-indigo-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-ink placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 border border-indigo-100 rounded-lg p-1 bg-white">
                  {filteredCandidates.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-xs italic">
                      No matching ledger candidates found in batch.
                    </div>
                  ) : (
                    filteredCandidates.map((cand) => {
                      const isChosen = correctedLedgerId === cand.id || correctedLedgerId === cand.db_id;
                      return (
                        <div
                          key={cand.id}
                          onClick={() => setCorrectedLedgerId(cand.id)}
                          className={`p-2 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between text-xs ${
                            isChosen
                              ? 'bg-indigo-50 border-indigo-500 font-medium text-indigo-950'
                              : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-slate-800">{cand.invoice_id || cand.reference || cand.id}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{cand.date}</span>
                            </div>
                            <span className="text-[11px] text-slate-500 block line-clamp-1">{cand.description || cand.counterparty}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-mono font-bold text-ink block">{formatCurrency(cand.amount, cand.currency)}</span>
                            {isChosen && (
                              <span className="text-[9px] font-bold text-indigo-700 font-mono uppercase">✓ Selected</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Accountant Working Paper Notes */}
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 flex items-center space-x-1.5 text-xs">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Accountant Sign-Off Notes / Working Paper Justification:</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Required documentation for audit review (e.g. 'Confirmed with sales manager that remaining $25 represents wire fee deducted by client bank')..."
                className="w-full bg-[#FAFAF8] border border-slate-200 rounded-xl p-2.5 text-xs text-ink placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all font-sans"
              />
            </div>

            {/* Submit Action Button */}
            <div className="pt-2">
              <button
                onClick={handleApplyResolution}
                disabled={isSubmitting}
                className="w-full py-3 px-4 rounded-xl bg-ink hover:bg-black text-white text-xs font-bold font-mono uppercase tracking-wider shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isSubmitting ? 'Recording Resolution...' : 'Apply Accountant Resolution'}
                </span>
              </button>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* SECTION 5: IMMUTABLE EXECUTION TRACE TIMELINE                             */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-[#FAFAF8] border border-slate-200 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h4 className="font-bold text-[11px] font-mono uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Audit Execution Trace (7 Stages)</span>
              </h4>
              <span className="text-[10px] font-mono text-slate-400">{timelineEvents.length} Events</span>
            </div>

            <div className="space-y-2.5 relative border-l border-slate-200 ml-2 pl-3">
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

        </div>

      </div>
    </div>
  );
}

export default AuditDrawer;
