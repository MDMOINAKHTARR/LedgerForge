import React, { useMemo, useState } from 'react';
import {
  X, CheckCircle2, AlertTriangle, XCircle, TrendingUp, FileText,
  BarChart2, Download, ShieldCheck, Zap, Clock, DollarSign,
  Activity, Target, ArrowUpRight, ArrowDownRight, Layers,
  ChevronDown, ChevronUp, Bot, Cpu, User, ListChecks, Star,
  Search, ArrowRight, Check, Equal, SlidersHorizontal, GitCompare,
} from 'lucide-react';

/**
 * ReconciliationReportModal — Premium CFO-Grade Executive Report
 * Auto-surfaces after every CSV upload. Full audit-quality detail.
 */
export function ReconciliationReportModal({ batchData, onClose }) {
  // ─── ALL HOOKS MUST BE CALLED UNCONDITIONALLY (Rules of Hooks) ────────────
  const [expandedExceptions, setExpandedExceptions] = useState(false);
  const [expandedTransactions, setExpandedTransactions] = useState(false);
  const [diffFilter, setDiffFilter] = useState('ALL'); // 'ALL' | 'SAME' | 'DIFFERENT'
  const [diffSearch, setDiffSearch] = useState('');
  const [visibleDiffCount, setVisibleDiffCount] = useState(10);

  // Safe destructure with defaults — works even when batchData is null
  const {
    id: batchId = '',
    bank_filename = '',
    ledger_filename = '',
    total_bank_tx = 0,
    total_ledger_tx = 0,
    auto_reconciled_count = 0,
    escalated_count = 0,
    rejected_count = 0,
    agent_version_id = 'v3',
    results = [],
    created_at = '',
  } = batchData || {};

  // ─── Derived Metrics ─────────────────────────────────────────────────────────
  const stpRate       = total_bank_tx > 0 ? (auto_reconciled_count / total_bank_tx) * 100 : 0;
  const exceptionRate = total_bank_tx > 0 ? (escalated_count / total_bank_tx) * 100 : 0;
  const unmatchedRate = total_bank_tx > 0 ? (rejected_count / total_bank_tx) * 100 : 0;

  // Health score (weighted composite)
  const healthScore = Math.round(
    stpRate * 0.5 +
    (100 - exceptionRate) * 0.3 +
    (100 - unmatchedRate) * 0.2
  );
  const healthGrade = healthScore >= 90 ? 'A' : healthScore >= 75 ? 'B' : healthScore >= 60 ? 'C' : 'D';
  const healthColor = healthScore >= 90 ? 'text-emerald-600' : healthScore >= 75 ? 'text-amber-600' : 'text-rose-600';
  const healthBg    = healthScore >= 90 ? 'bg-emerald-50 border-emerald-200' : healthScore >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
  const riskLabel   = exceptionRate < 5 && unmatchedRate < 3 ? 'LOW RISK' : exceptionRate < 15 ? 'MEDIUM RISK' : 'HIGH RISK';
  const riskColor   = riskLabel === 'LOW RISK' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : riskLabel === 'MEDIUM RISK' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-rose-700 bg-rose-50 border-rose-200';

  // Volume + variance (within same currency only; cross-currency not consolidated)
  const { totalBankVol, totalLedgerVol, variance, primaryCurrency } = useMemo(() => {
    // Group by currency and return the dominant currency's numbers
    const byC = {};
    results.forEach(r => {
      const curr = (r.bank_tx?.currency || r.ledger_tx?.currency || 'USD').toUpperCase();
      if (!byC[curr]) byC[curr] = { b: 0, l: 0, count: 0 };
      byC[curr].b += Math.abs(r.bank_tx?.amount || 0);
      byC[curr].l += Math.abs(r.ledger_tx?.amount || 0);
      byC[curr].count++;
    });
    // Primary currency = most transactions
    const primary = Object.entries(byC).sort((a, b) => b[1].count - a[1].count)[0];
    const primCurr = primary ? primary[0] : 'USD';
    const primData = primary ? primary[1] : { b: 0, l: 0 };
    return { totalBankVol: primData.b, totalLedgerVol: primData.l, variance: Math.abs(primData.b - primData.l), primaryCurrency: primCurr };
  }, [results]);

  // Confidence distribution (only evaluating matched/candidate transactions; unmatched entries are isolated)
  const confBuckets = useMemo(() => {
    let high = 0, med = 0, low = 0, unmatched = 0;
    results.forEach(r => {
      if (r.match_type === 'UNMATCHED' || r.action_taken === 'REJECT') {
        unmatched++;
        return;
      }
      const c = r.confidence_score || 0;
      if (c >= 0.9) high++; else if (c >= 0.7) med++; else low++;
    });
    return { high, med, low, unmatched };
  }, [results]);

  // Match type breakdown
  const matchBreakdown = useMemo(() => {
    const map = {};
    results.forEach(r => {
      const key = r.match_type || 'UNKNOWN';
      if (!map[key]) map[key] = {
        count: 0,
        label: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        color: key === 'EXACT' ? 'bg-emerald-400' : key === 'FUZZY' ? 'bg-indigo-400' : key === 'TIMING_DIFFERENCE' ? 'bg-amber-400' : key === 'BANK_FEE' ? 'bg-sky-400' : key === 'PARTIAL_PAYMENT' ? 'bg-violet-400' : 'bg-slate-400',
      };
      map[key].count++;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
  }, [results]);

  // Processing method split
  const methodBreakdown = useMemo(() => {
    let rule = 0, fuzzy = 0, llm = 0;
    results.forEach(r => {
      const m = (r.processing_method || '').toUpperCase();
      if (m === 'RULE') rule++; else if (m === 'FUZZY') fuzzy++; else llm++;
    });
    return { rule, fuzzy, llm };
  }, [results]);

  // Top escalated exceptions (largest discrepancy first)
  const topExceptions = useMemo(() => {
    return results
      .filter(r => r.action_taken === 'ESCALATE_TO_HUMAN')
      .sort((a, b) => {
        const da = Math.abs((a.bank_tx?.amount || 0) - (a.ledger_tx?.amount || 0));
        const db = Math.abs((b.bank_tx?.amount || 0) - (b.ledger_tx?.amount || 0));
        return db - da;
      })
      .slice(0, 5);
  }, [results]);

  // Top auto-reconciled sample
  const topAuto = useMemo(() => {
    return results
      .filter(r => r.action_taken === 'AUTO_RECONCILE')
      .sort((a, b) => (b.bank_tx?.amount || 0) - (a.bank_tx?.amount || 0))
      .slice(0, 5);
  }, [results]);

  // Date range
  const dateRange = useMemo(() => {
    const dates = results
      .map(r => r.bank_tx?.date)
      .filter(Boolean)
      .sort();
    if (dates.length === 0) return null;
    return { from: dates[0], to: dates[dates.length - 1] };
  }, [results]);

  // Avg confidence for matched transactions
  const avgConf = useMemo(() => {
    const matched = results.filter(r => r.match_type !== 'UNMATCHED' && r.action_taken !== 'REJECT');
    if (matched.length === 0) return 0;
    return matched.reduce((s, r) => s + (r.confidence_score || 0), 0) / matched.length;
  }, [results]);

  // ─── Formatters declared BEFORE any useMemo that calls them ─────────────────
  const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'AU$', JPY: '¥', SGD: 'S$' };
  const fmtAmt = (n, currency) => {
    const code = (currency || 'USD').toUpperCase();
    const sym = CURRENCY_SYMBOLS[code] || `${code} `;
    const abs = Math.abs(n || 0);
    const sign = (n || 0) < 0 ? '-' : '';
    return `${sign}${sym}${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`.trim();
  };
  // Fallback fmt using detected primaryCurrency instead of unconditional USD
  const fmt = (n, currency) => fmtAmt(n, currency || primaryCurrency);
  const fmtPct = (n) => `${n.toFixed(1)}%`;
  const pct = (n) => total_bank_tx > 0 ? Math.round((n / total_bank_tx) * 100) : 0;

  // Currency-aware volume breakdown
  const currencyBreakdown = useMemo(() => {
    const map = {};
    results.forEach(r => {
      const curr = (r.bank_tx?.currency || r.ledger_tx?.currency || 'USD').toUpperCase();
      if (!map[curr]) map[curr] = { bankVol: 0, ledgerVol: 0, count: 0 };
      map[curr].bankVol += Math.abs(r.bank_tx?.amount || 0);
      map[curr].ledgerVol += Math.abs(r.ledger_tx?.amount || 0);
      map[curr].count++;
    });
    return Object.entries(map);
  }, [results]);

  const hasMixedCurrencies = currencyBreakdown.length > 1;

  // ─── Precise Diff & Comparison Analysis (Same vs Different Data) ───────────
  const analyzeDiff = (r) => {
    const b = r.bank_tx;
    const l = r.ledger_tx;

    if (!b && !l) {
      return {
        isSame: false,
        diffType: 'EMPTY',
        badgeText: 'NO DATA',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        badgeDot: 'bg-slate-400',
        amountDiff: 0,
        rawDiff: 0,
        dateDiffDays: null,
        summary: 'No transaction data available',
        fieldDiffs: [],
      };
    }

    if (b && !l) {
      const amt = Math.abs(b.amount || 0);
      return {
        isSame: false,
        diffType: 'MISSING_IN_LEDGER',
        badgeText: 'DIFFERENT — MISSING IN LEDGER',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        badgeDot: 'bg-rose-500',
        amountDiff: amt,
        rawDiff: b.amount || 0,
        dateDiffDays: null,
        summary: 'Found on Bank Statement, but completely missing in company ledger',
        fieldDiffs: ['Missing ledger entry', `Unrecorded cash movement: ${fmtAmt(amt, b.currency)}`],
      };
    }

    if (!b && l) {
      const amt = Math.abs(l.amount || 0);
      return {
        isSame: false,
        diffType: 'MISSING_IN_BANK',
        badgeText: 'DIFFERENT — MISSING IN BANK',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
        badgeDot: 'bg-rose-500',
        amountDiff: amt,
        rawDiff: -(l.amount || 0),
        dateDiffDays: null,
        summary: 'Recorded in ledger, but has not cleared or appeared on bank statement',
        fieldDiffs: ['Missing bank clearing', `Unpresented ledger entry: ${fmtAmt(amt, l.currency)}`],
      };
    }

    const bAmt = Number(b.amount || 0);
    const lAmt = Number(l.amount || 0);
    const rawDiff = Math.round((bAmt - lAmt) * 100) / 100;
    const absDiff = Math.abs(rawDiff);
    const isAmountSame = absDiff < 0.009;

    let dateDiffDays = 0;
    if (b.date && l.date) {
      const d1 = new Date(b.date);
      const d2 = new Date(l.date);
      if (!isNaN(d1) && !isNaN(d2)) {
        dateDiffDays = Math.round(Math.abs(d1 - d2) / (1000 * 60 * 60 * 24));
      }
    }
    const isDateSame = dateDiffDays === 0;

    const status = r.reconciliation_status || (r.action_taken === 'AUTO_RECONCILE' ? 'AUTO_MATCHED' : r.action_taken === 'ESCALATE_TO_HUMAN' ? 'HUMAN_REVIEW' : 'UNMATCHED');

    // Strict identity: Must be AUTO_MATCHED / AUTO_RECONCILE AND amount + date match
    const isSame = (status === 'AUTO_MATCHED' || r.action_taken === 'AUTO_RECONCILE') && isAmountSame && isDateSame;

    const fieldDiffs = [];
    if (!isAmountSame) {
      fieldDiffs.push(`Amount variance: ${rawDiff > 0 ? '+' : ''}${fmtAmt(rawDiff, b?.currency || l?.currency)}`);
    }
    if (!isDateSame) {
      fieldDiffs.push(`Date gap: ${dateDiffDays} day${dateDiffDays > 1 ? 's' : ''}`);
    }
    if (r.match_type === 'BANK_FEE') {
      fieldDiffs.push('Bank fee / processing charge');
    }
    if (r.match_type === 'FUZZY') {
      fieldDiffs.push('Description string variation');
    }

    let badgeText = 'AUTO MATCH — IDENTICAL';
    let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    let badgeDot = 'bg-emerald-500';
    let diffType = 'SAME';

    if (status === 'HUMAN_REVIEW' || r.action_taken === 'ESCALATE_TO_HUMAN') {
      badgeText = `HUMAN REVIEW — ${r.match_type || 'ESCALATED'}`;
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
      badgeDot = 'bg-amber-500';
      diffType = 'HUMAN_REVIEW';
    } else if (status === 'LEDGER_ONLY' || (!b && l)) {
      badgeText = 'LEDGER ONLY — MISSING IN BANK';
      badgeColor = 'bg-purple-50 text-purple-800 border-purple-200';
      badgeDot = 'bg-purple-500';
      diffType = 'LEDGER_ONLY';
    } else if (status === 'UNMATCHED' || r.action_taken === 'REJECT' || !l) {
      badgeText = 'UNMATCHED — MISSING IN LEDGER';
      badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
      badgeDot = 'bg-rose-500';
      diffType = 'UNMATCHED';
    } else if (!isSame) {
      if (!isAmountSame && !isDateSame) {
        badgeText = 'AUTO MATCH — AMOUNT & DATE VARIANCE';
        badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
        badgeDot = 'bg-amber-500';
        diffType = 'AMOUNT_AND_DATE';
      } else if (!isAmountSame) {
        badgeText = r.match_type === 'BANK_FEE' ? 'AUTO MATCH — BANK FEE' : 'AUTO MATCH — AMOUNT VARIANCE';
        badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
        badgeDot = 'bg-amber-500';
        diffType = 'AMOUNT_VARIANCE';
      } else if (!isDateSame) {
        badgeText = 'AUTO MATCH — TIMING LAG';
        badgeColor = 'bg-sky-50 text-sky-800 border-sky-200';
        badgeDot = 'bg-sky-500';
        diffType = 'TIMING_LAG';
      } else {
        badgeText = 'AUTO MATCH — MEMO VARIANCE';
        badgeColor = 'bg-indigo-50 text-indigo-800 border-indigo-200';
        badgeDot = 'bg-indigo-500';
        diffType = 'MEMO_DIFFERENCE';
      }
    }

    return {
      isSame,
      diffType,
      isAmountSame,
      isDateSame,
      amountDiff: absDiff,
      rawDiff,
      dateDiffDays,
      fieldDiffs,
      badgeText,
      badgeColor,
      badgeDot,
      summary: r.explanation || r.reasoning || (isSame
        ? '100% agreement: Bank and Ledger match identically with 0.00 variance.'
        : fieldDiffs.join(' • ') || 'Discrepancy detected between records.'),
    };
  };

  // Group into Same vs Different
  const { sameList, diffList, sameVol, diffVarianceVol } = useMemo(() => {
    const s = [];
    const d = [];
    let sVol = 0;
    let dVar = 0;

    results.forEach(r => {
      const diff = analyzeDiff(r);
      const enhanced = { ...r, _diff: diff };
      if (diff.isSame) {
        s.push(enhanced);
        sVol += Math.abs(r.bank_tx?.amount || 0);
      } else {
        d.push(enhanced);
        dVar += diff.amountDiff || 0;
      }
    });

    return { sameList: s, diffList: d, sameVol: sVol, diffVarianceVol: dVar };
  }, [results]);

  // Filtered comparison records based on active filter tab & search query
  const filteredDiffResults = useMemo(() => {
    let list = results.map(r => ({ ...r, _diff: analyzeDiff(r) }));
    if (diffFilter === 'SAME') {
      list = list.filter(r => r._diff.isSame);
    } else if (diffFilter === 'DIFFERENT') {
      list = list.filter(r => !r._diff.isSame);
    }
    if (diffSearch.trim()) {
      const q = diffSearch.toLowerCase();
      list = list.filter(r => {
        const bDesc = (r.bank_tx?.description || '').toLowerCase();
        const lDesc = (r.ledger_tx?.description || '').toLowerCase();
        const bRef = (r.bank_tx?.reference_id || '').toLowerCase();
        const lRef = (r.ledger_tx?.reference_id || '').toLowerCase();
        const bAmt = String(r.bank_tx?.amount || '');
        const lAmt = String(r.ledger_tx?.amount || '');
        return bDesc.includes(q) || lDesc.includes(q) || bRef.includes(q) || lRef.includes(q) || bAmt.includes(q) || lAmt.includes(q);
      });
    }
    return list;
  }, [results, diffFilter, diffSearch]);

  // Recommendations — per-currency aware and isolated
  const recommendations = useMemo(() => {
    const recs = [];
    if (escalated_count > 0)
      recs.push({ icon: '🔍', text: `Review ${escalated_count} flagged exception${escalated_count > 1 ? 's' : ''} in the Exception Queue. System stopped per policy to prevent erroneous automated reconciliation.` });
    if (unmatchedRate > 5)
      recs.push({ icon: '🔗', text: `${rejected_count} bank entries have no ledger match. Verify if these are missing invoices or stale records.` });

    currencyBreakdown.forEach(([curr, data]) => {
      const v = Math.abs(data.bankVol - data.ledgerVol);
      if (v > 0.01) {
        recs.push({ icon: '⚖️', text: `Net book variance of ${fmtAmt(v, curr)} detected in ${curr}. Investigate discrepancies before period close.` });
      }
    });

    if (confBuckets.low > 0)
      recs.push({ icon: '📊', text: `${confBuckets.low} low-confidence matched item${confBuckets.low > 1 ? 's' : ''} (< 70%) — consider manual verification before posting.` });
    if (recs.length === 0)
      recs.push({ icon: '✅', text: 'All transactions processed successfully. Books are balanced. No action required.' });
    return recs;
  }, [escalated_count, unmatchedRate, rejected_count, currencyBreakdown, confBuckets]);

  // ─── NOW it's safe to guard against null batchData ───────────────────────────
  if (!batchData) return null;

  const handleExportCSV = () => {
    const rows = [
      ['=== LEDGER MIND — AUTONOMOUS RECONCILIATION REPORT ==='],
      [''],
      ['BATCH SUMMARY'],
      ['Batch ID', batchId],
      ['Run At', created_at || new Date().toLocaleString()],
      ['Agent Version', agent_version_id],
      ['Bank File', bank_filename],
      ['Ledger File', ledger_filename],
      ['Period From', dateRange?.from || 'N/A'],
      ['Period To', dateRange?.to || 'N/A'],
      [''],
      ['VOLUME ANALYSIS'],
      ['Total Bank Transactions', total_bank_tx],
      ['Total Ledger Entries', total_ledger_tx],
      ...currencyBreakdown.map(([curr, data]) => [
        `Total Bank Volume (${curr})`,
        data.bankVol.toFixed(2),
      ]),
      ...currencyBreakdown.map(([curr, data]) => [
        `Total Ledger Volume (${curr})`,
        data.ledgerVol.toFixed(2),
      ]),
      ...currencyBreakdown.map(([curr, data]) => [
        `Net Variance (${curr})`,
        Math.abs(data.bankVol - data.ledgerVol).toFixed(2),
      ]),
      ['Same Data (Identical Match) Count', sameList.length],
      ['Different Data (Discrepancies) Count', diffList.length],
      ['Same Data Total Volume', sameVol.toFixed(2)],
      ['Discrepancies Cumulative Variance', diffVarianceVol.toFixed(2)],
      [''],
      ['RECONCILIATION OUTCOMES'],
      ['Auto-Reconciled (STP)', auto_reconciled_count, fmtPct(stpRate)],
      ['Escalated for Review', escalated_count, fmtPct(exceptionRate)],
      ['Unmatched / Rejected', rejected_count, fmtPct(unmatchedRate)],
      [''],
      ['QUALITY METRICS'],
      ['Health Score', `${healthScore}/100 (Grade ${healthGrade})`],
      ['Risk Rating', riskLabel],
      ['Avg Confidence Score', fmtPct(avgConf * 100)],
      ['High Confidence (≥90%)', confBuckets.high],
      ['Medium Confidence (70-90%)', confBuckets.med],
      ['Low Confidence (<70%)', confBuckets.low],
      ['Unmatched Count', confBuckets.unmatched],
      [''],
      ['PROCESSING METHOD'],
      ['Rule-Based', methodBreakdown.rule],
      ['Fuzzy Matching', methodBreakdown.fuzzy],
      ['LLM-Assisted', methodBreakdown.llm],
      [''],
      ['TOP EXCEPTIONS (ID | Bank Desc | Currency | Bank Amt | Ledger Amt | Variance | Reason)'],
      ...topExceptions.map(r => [
        r.id?.slice(0, 12) || 'N/A',
        r.bank_tx?.description || '',
        r.bank_tx?.currency || r.ledger_tx?.currency || '',
        (r.bank_tx?.amount || 0).toFixed(2),
        (r.ledger_tx?.amount || 0).toFixed(2),
        Math.abs((r.bank_tx?.amount || 0) - (r.ledger_tx?.amount || 0)).toFixed(2),
        (r.reasoning || '').slice(0, 80),
      ]),
      [''],
      ['=== COMPLETE DATA COMPARISON (WHICH ARE SAME & WHICH ARE DIFFERENT) ==='],
      ['Comparison Status', 'Difference Subtype', 'Currency', 'Bank Date', 'Bank Description', 'Bank Amount', 'Ledger Date', 'Ledger Description', 'Ledger Amount', 'Variance Delta', 'Timing Lag (Days)', 'AI Explanation & Resolution'],
      ...results.map(r => {
        const d = analyzeDiff(r);
        return [
          d.isSame ? 'SAME (IDENTICAL)' : 'DIFFERENT (DISCREPANCY)',
          d.badgeText,
          r.bank_tx?.currency || r.ledger_tx?.currency || '',
          r.bank_tx?.date || '',
          r.bank_tx?.description || '',
          (r.bank_tx?.amount || 0).toFixed(2),
          r.ledger_tx?.date || 'N/A',
          r.ledger_tx?.description || 'N/A',
          (r.ledger_tx?.amount || 0).toFixed(2),
          d.amountDiff ? d.amountDiff.toFixed(2) : '0.00',
          d.dateDiffDays !== null ? d.dateDiffDays : 'N/A',
          d.summary,
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledgermind_audit_${batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Sub-components ───────────────────────────────────────────────────────────
  function SectionHeader({ icon: Icon, title, iconColor = 'text-slate-600' }) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">{title}</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
    );
  }

  function MiniBar({ pct: p, color = 'bg-indigo-400' }) {
    return (
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(p, 100)}%` }} />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto bg-[#FAFAF8] rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col">

        {/* Rainbow accent bar */}
        <div className="sticky top-0 z-10">
          <div className="h-1 rounded-t-3xl bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-400" />

          {/* ── Sticky Header ── */}
          <div className="flex items-start justify-between px-6 py-4 bg-[#FAFAF8]/95 backdrop-blur-md border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  RECONCILIATION COMPLETE
                </span>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${riskColor}`}>
                  {riskLabel}
                </span>
              </div>
              <h2 className="font-serif font-bold text-xl text-ink">Batch Reconciliation Report</h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                {bank_filename} ↔ {ledger_filename} &nbsp;·&nbsp; Agent {agent_version_id.toUpperCase()}
                {dateRange && <> &nbsp;·&nbsp; Period: {dateRange.from} → {dateRange.to}</>}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button onClick={handleExportCSV} className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all shadow-sm">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-6 space-y-6">

          {/* ── 0. PLAIN ENGLISH SUMMARY BANNER ── */}
          <div className={`p-4 rounded-2xl border-2 ${healthScore >= 90 ? 'bg-emerald-50 border-emerald-200' : healthScore >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">
                {healthScore >= 90 ? '🎉' : healthScore >= 75 ? '⚠️' : '🚨'}
              </span>
              <div>
                <div className="text-sm font-bold text-ink mb-1">
                  {healthScore >= 90
                    ? 'Great news — your books look clean!'
                    : healthScore >= 75
                    ? 'Almost there — a few items need your attention.'
                    : 'Action needed — several transactions could not be matched.'}
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">
                  Out of <strong>{total_bank_tx} bank transactions</strong> we processed,{' '}
                  <strong className="text-emerald-700">{auto_reconciled_count} were matched automatically</strong>{' '}
                  with no human input needed.{' '}
                  {escalated_count > 0 && (
                    <><strong className="text-amber-700">{escalated_count} need a quick human review</strong> because the system wasn't fully confident about them.{' '}</>
                  )}
                  {rejected_count > 0 && (
                    <><strong className="text-rose-700">{rejected_count} had no match at all</strong> in your ledger.{' '}</>
                  )}
                  {variance < 1
                    ? 'Your bank balance and ledger balance are in perfect agreement.'
                    : `Your bank and ledger differ by ${fmtAmt(variance, primaryCurrency)} — check the flagged items below.`}
                </p>
              </div>
            </div>
          </div>

          {/* ── 1. HEALTH SCORE + QUICK KPI ROW ── */}
          {/* Grade: A=excellent, B=good, C=some problems, D=needs urgent attention */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Health Score — large focal card */}
            <div className={`col-span-2 sm:col-span-1 p-4 rounded-2xl border flex flex-col items-center justify-center gap-1 ${healthBg}`}>
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Overall Grade</div>
              <div className={`text-5xl font-black font-mono ${healthColor}`}>{healthGrade}</div>
              <div className={`text-2xl font-bold font-mono ${healthColor}`}>{healthScore}<span className="text-sm font-normal text-slate-400">/100</span></div>
              <div className="text-[10px] text-slate-500 text-center mt-1 leading-snug">
                {healthScore >= 90 ? '✓ Excellent — books are clean' : healthScore >= 75 ? '⚠ Good — minor issues exist' : '✕ Needs attention — review required'}
              </div>
            </div>

            {/* STP */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-600 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> AUTO-MATCHED ✓
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-ink">{auto_reconciled_count.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">transactions matched with no human help</div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Auto-match rate</span><span className="font-mono font-bold text-emerald-600">{fmtPct(stpRate)}</span>
                </div>
                <MiniBar pct={stpRate} color="bg-emerald-400" />
                <div className="text-[9px] text-slate-400 mt-1">Higher is better — aim for &gt;80%</div>
              </div>
            </div>

            {/* Exceptions */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-600 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> NEEDS REVIEW ⚠
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-ink">{escalated_count.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">flagged — your team must check these</div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Flagged rate</span><span className="font-mono font-bold text-amber-600">{fmtPct(exceptionRate)}</span>
                </div>
                <MiniBar pct={exceptionRate} color="bg-amber-400" />
                <div className="text-[9px] text-slate-400 mt-1">Lower is better — aim for &lt;5%</div>
              </div>
            </div>

            {/* Unmatched */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-500 font-bold">
                <XCircle className="w-3.5 h-3.5" /> NOT FOUND ✕
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-ink">{rejected_count.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">bank entries with no ledger record</div>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Miss rate</span><span className="font-mono font-bold text-rose-500">{fmtPct(unmatchedRate)}</span>
                </div>
                <MiniBar pct={unmatchedRate} color="bg-rose-400" />
                <div className="text-[9px] text-slate-400 mt-1">These may be missing invoices</div>
              </div>
            </div>

            {/* Avg Confidence */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-indigo-600 font-bold">
                <Target className="w-3.5 h-3.5" /> AI CERTAINTY
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold font-mono text-ink">{fmtPct(avgConf * 100)}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">avg. AI confidence per match</div>
              </div>
              <div className="mt-2 space-y-0.5">
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Very sure (≥90%)</span><span className="font-mono text-emerald-600">{confBuckets.high}</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Fairly sure (70–90%)</span><span className="font-mono text-amber-600">{confBuckets.med}</span>
                </div>
                <div className="flex justify-between text-[9px] text-slate-400">
                  <span>Unsure (&lt;70%) ⚠</span><span className="font-mono text-rose-400">{confBuckets.low}</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionHeader icon={DollarSign} title="Money Summary — How Much Was Processed?" iconColor="text-emerald-600" />
            <p className="text-[11px] text-slate-500 mb-3 -mt-1 leading-relaxed">
              This compares the <strong>total money value</strong> in your bank statement against what’s recorded in your company ledger.
              Ideally they should be equal — any difference (variance) means something doesn’t match.
            </p>
            {hasMixedCurrencies && (
              <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700 flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <span><strong>Multi-currency batch detected:</strong> Volumes are shown per currency below. Cross-currency totals are <em>not</em> consolidated without FX rates.</span>
              </div>
            )}
            {hasMixedCurrencies ? (
              <div className="space-y-3">
                {currencyBreakdown.map(([curr, data]) => {
                  const sym = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[curr] || `${curr} `;
                  const v = Math.abs(data.bankVol - data.ledgerVol);
                  return (
                    <div key={curr} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">🏦 Bank ({curr})</div>
                        <div className="text-xl font-bold font-mono text-ink">{sym}{data.bankVol.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {curr}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{data.count} transactions</div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                        <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">📒 Ledger ({curr})</div>
                        <div className="text-xl font-bold font-mono text-ink">{sym}{data.ledgerVol.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {curr}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{curr} ledger entries</div>
                      </div>
                      <div className={`p-4 rounded-2xl border ${v < 1 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">⚖️ Gap ({curr})</div>
                        <div className={`text-xl font-bold font-mono ${v < 1 ? 'text-emerald-700' : 'text-amber-700'}`}>{sym}{v.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {curr}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{v < 1 ? 'Balanced' : 'Review flagged items'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">🏦 Bank Statement Total</div>
                <div className="text-2xl font-bold font-mono text-ink">{fmtAmt(totalBankVol, primaryCurrency)}</div>
                <div className="text-[11px] text-slate-500 mt-1">Money your bank says moved ({total_bank_tx} transactions)</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{bank_filename}</div>
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">📒 Company Ledger Total</div>
                <div className="text-2xl font-bold font-mono text-ink">{fmtAmt(totalLedgerVol, primaryCurrency)}</div>
                <div className="text-[11px] text-slate-500 mt-1">Money your accounts recorded ({total_ledger_tx} entries)</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{ledger_filename}</div>
              </div>
              <div className={`p-4 rounded-2xl border ${variance < 1 ? 'bg-emerald-50 border-emerald-200' : variance < 500 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">⚖️ Difference (Gap)</div>
                <div className={`text-2xl font-bold font-mono ${variance < 1 ? 'text-emerald-700' : variance < 500 ? 'text-amber-700' : 'text-rose-700'}`}>
                  {fmtAmt(variance, primaryCurrency)}
                </div>
                <div className="text-[11px] text-slate-600 mt-1 leading-snug">
                  {variance < 1
                    ? '✅ Perfect — bank and ledger agree completely.'
                    : variance < 500
                    ? '⚠️ Small gap — likely from flagged items. Check the exceptions below.'
                    : '🚨 Large gap — urgent review needed before period close.'}
                </div>
              </div>
            </div>
            )}
          </div>

          {/* ── 3. MATCH BREAKDOWN + PROCESSING METHOD (side-by-side) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Match Type */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
              <SectionHeader icon={Layers} title="How Were Transactions Matched?" iconColor="text-indigo-500" />
              <p className="text-[11px] text-slate-400 mb-3 -mt-1 leading-relaxed">
                Shows <em>why</em> the AI decided each bank transaction matched a ledger entry.
              </p>
              {matchBreakdown.length > 0 ? (
                <div className="space-y-2.5">
                  {matchBreakdown.map(([key, { count, label, color }]) => {
                    const p = pct(count);
                    const explain = key === 'EXACT' ? 'Amount & date matched perfectly' : key === 'FUZZY' ? 'Very similar but not identical' : key === 'TIMING_DIFFERENCE' ? 'Same amount, different date' : key === 'BANK_FEE' ? 'Small bank fee caused a tiny difference' : key === 'PARTIAL_PAYMENT' ? 'Amount partially paid' : key === 'MISSING_INVOICE' ? 'No matching invoice found' : key === 'AMOUNT_DISCREPANCY' ? 'Amount differs from ledger' : 'Other match type';
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                          <div>
                            <span className="font-semibold">{label}</span>
                            <span className="text-[10px] text-slate-400 ml-1.5">— {explain}</span>
                          </div>
                          <span className="font-mono text-slate-400 shrink-0 ml-2">{count} | {p}%</span>
                        </div>
                        <MiniBar pct={p} color={color} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">No match data available.</p>
              )}
            </div>

            {/* Processing Method + Confidence */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm space-y-4">
              <div>
                <SectionHeader icon={Cpu} title="How Did the AI Decide?" iconColor="text-violet-500" />
                <p className="text-[11px] text-slate-400 mb-3 -mt-1 leading-relaxed">
                  The AI uses 3 methods, from fastest to most thorough.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Simple Rules', sublabel: 'Instant, deterministic', count: methodBreakdown.rule, color: 'bg-sky-100 text-sky-700' },
                    { label: 'Smart Search', sublabel: 'Finds close matches', count: methodBreakdown.fuzzy, color: 'bg-violet-100 text-violet-700' },
                    { label: 'AI Reasoning', sublabel: 'Complex edge cases', count: methodBreakdown.llm, color: 'bg-amber-100 text-amber-700' },
                  ].map(m => (
                    <div key={m.label} className={`rounded-xl p-3 text-center ${m.color}`}>
                      <div className="text-lg font-bold font-mono">{m.count}</div>
                      <div className="text-[9px] font-bold uppercase tracking-wide mt-0.5">{m.label}</div>
                      <div className="text-[8px] opacity-70 mt-0.5">{m.sublabel}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <SectionHeader icon={Activity} title="How Confident Was the AI?" iconColor="text-emerald-500" />
                <p className="text-[11px] text-slate-400 mb-3 -mt-1">
                  Higher confidence = less likely to be wrong.
                </p>
                <div className="space-y-2">
                  {[
                    { label: '🟢 Very sure (≥ 90%)', count: confBuckets.high, color: 'bg-emerald-400', textColor: 'text-emerald-700', note: 'Auto-posted safely' },
                    { label: '🟡 Fairly sure (70–90%)', count: confBuckets.med, color: 'bg-amber-400', textColor: 'text-amber-700', note: 'May need a quick check' },
                    { label: '🔴 Unsure (< 70%)', count: confBuckets.low, color: 'bg-rose-400', textColor: 'text-rose-600', note: 'Recommend manual review' },
                  ].map(b => {
                    const p = total_bank_tx > 0 ? (b.count / total_bank_tx) * 100 : 0;
                    return (
                      <div key={b.label}>
                        <div className="flex justify-between text-[11px] mb-0.5">
                          <div>
                            <span className={`font-medium ${b.textColor}`}>{b.label}</span>
                            <span className="text-[9px] text-slate-400 ml-1">— {b.note}</span>
                          </div>
                          <span className="font-mono text-slate-400 shrink-0 ml-2">{b.count}</span>
                        </div>
                        <MiniBar pct={p} color={b.color} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. WHAT DATA IS SAME & WHAT DATA IS DIFFERENT (SIDE-BY-SIDE DATA COMPARISON) ── */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <SectionHeader icon={GitCompare} title="Data Comparison — Which Are Same & Which Are Different?" iconColor="text-indigo-600" />
                <p className="text-[11px] text-slate-500 -mt-1 leading-relaxed">
                  Direct side-by-side reconciliation between your <strong>Bank Statement</strong> and <strong>Company Ledger</strong>.
                  Quickly inspect which records match identically and which have variances, timing differences, or missing entries.
                </p>
              </div>
            </div>

            {/* 2 High-Contrast Focal Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: SAME DATA */}
              <div 
                onClick={() => setDiffFilter('SAME')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  diffFilter === 'SAME'
                    ? 'bg-emerald-50/90 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/70'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      ✓
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-900">Same Data (Identical Matches)</div>
                      <div className="text-[10px] text-emerald-700">Bank & Ledger agree 100% with $0 difference</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {total_bank_tx > 0 ? Math.round((sameList.length / total_bank_tx) * 100) : 0}% of Total
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-emerald-900">
                    {sameList.length} <span className="text-xs font-normal text-emerald-700">transactions</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-emerald-800">
                    {fmt(sameVol)} <span className="text-[10px] font-normal text-emerald-600 font-sans">matched volume</span>
                  </div>
                </div>
                <div className="text-[10px] text-emerald-700 mt-2 flex items-center gap-1.5 pt-2 border-t border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>No variances • Exact date & amount agreement • Auto-posted safely</span>
                </div>
              </div>

              {/* Card 2: DIFFERENT DATA */}
              <div 
                onClick={() => setDiffFilter('DIFFERENT')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  diffFilter === 'DIFFERENT'
                    ? 'bg-amber-50/90 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                    : 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      Δ
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-900">Different Data (Discrepancies)</div>
                      <div className="text-[10px] text-amber-700">Differences in amounts, dates, or missing entries</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                    {total_bank_tx > 0 ? Math.round((diffList.length / total_bank_tx) * 100) : 0}% of Total
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-amber-900">
                    {diffList.length} <span className="text-xs font-normal text-amber-700">transactions</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-amber-800">
                    {fmt(diffVarianceVol)} <span className="text-[10px] font-normal text-amber-600 font-sans">cumulative variance</span>
                  </div>
                </div>
                <div className="text-[10px] text-amber-700 mt-2 flex items-center gap-1.5 pt-2 border-t border-amber-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Includes amount variances, timing lags, bank fees & unmatched records</span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setDiffFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] ${
                    diffFilter === 'ALL'
                      ? 'bg-white text-ink shadow-xs font-bold'
                      : 'text-slate-500 hover:text-ink'
                  }`}
                >
                  All Records ({results.length})
                </button>
                <button
                  onClick={() => setDiffFilter('SAME')}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1.5 ${
                    diffFilter === 'SAME'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Same / Identical ({sameList.length})
                </button>
                <button
                  onClick={() => setDiffFilter('DIFFERENT')}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1.5 ${
                    diffFilter === 'DIFFERENT'
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Different / Discrepancies ({diffList.length})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search description, amount, ref..."
                  value={diffSearch}
                  onChange={e => setDiffSearch(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-ink placeholder-slate-400 focus:outline-none focus:border-slate-400 w-full sm:w-60 shadow-2xs"
                />
              </div>
            </div>

            {/* Comparison Table */}
            <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Bank Statement Data</th>
                      <th className="py-2.5 px-3">Company Ledger Data</th>
                      <th className="py-2.5 px-3">Specific Difference (Field by Field)</th>
                      <th className="py-2.5 px-3 text-right">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredDiffResults.slice(0, visibleDiffCount).map((r, idx) => {
                      const b = r.bank_tx;
                      const l = r.ledger_tx;
                      const d = r._diff;
                      const bAmt = b?.amount || 0;
                      const lAmt = l?.amount || 0;

                      return (
                        <tr key={r.id || idx} className={`transition-colors ${d.isSame ? 'hover:bg-emerald-50/20' : 'hover:bg-amber-50/30'}`}>
                          {/* Status Column */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${d.badgeColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${d.badgeDot}`} />
                              {d.badgeText}
                            </span>
                            <span className="block text-[9px] text-slate-400 font-mono mt-1">
                              {r.action_taken === 'AUTO_RECONCILE' ? '⚡ Auto-posted' : '👤 Needs human review'}
                            </span>
                          </td>

                          {/* Bank Statement Data */}
                          <td className="py-3 px-3 align-top max-w-[210px]">
                            <div className="font-semibold text-ink truncate" title={b?.description}>
                              {b?.description || '—'}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                              <span>{b?.date || '—'}</span>
                              {b?.reference_id && <span>• Ref: {b.reference_id}</span>}
                            </div>
                            <div className="text-xs font-bold font-mono text-ink mt-1">
                              {fmt(bAmt)}
                            </div>
                          </td>

                          {/* Company Ledger Data */}
                          <td className="py-3 px-3 align-top max-w-[210px]">
                            {l ? (
                              <>
                                <div className="font-semibold text-ink truncate" title={l.description}>
                                  {l.description}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
                                  <span>{l.date || '—'}</span>
                                  {l.reference_id && <span>• Ref: {l.reference_id}</span>}
                                </div>
                                <div className="text-xs font-bold font-mono text-ink mt-1">
                                  {fmt(lAmt)}
                                </div>
                              </>
                            ) : (
                              <div className="p-2 rounded-lg bg-rose-50 border border-rose-100 text-rose-700 text-[11px] italic">
                                ✕ No ledger record found
                              </div>
                            )}
                          </td>

                          {/* Field-by-Field Diff Summary */}
                          <td className="py-3 px-3 align-top">
                            {d.isSame ? (
                              <div className="space-y-1">
                                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <Check className="w-3 h-3 text-emerald-600" /> Exact match ($0.00 difference)
                                </div>
                                <p className="text-[10px] text-slate-500 leading-snug">
                                  Amount ({fmt(bAmt)}) and Date ({b?.date}) match identically.
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {!d.isAmountSame && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                      Amount Δ: {d.rawDiff > 0 ? '+' : ''}{fmt(d.rawDiff)}
                                    </span>
                                  )}
                                  {!d.isDateSame && d.dateDiffDays !== null && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-sky-100 text-sky-900 border border-sky-300">
                                      Date Δ: {d.dateDiffDays}d lag
                                    </span>
                                  )}
                                  {d.diffType === 'MISSING_IN_LEDGER' && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                      Missing in Ledger
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-600 leading-snug">
                                  {d.summary}
                                </p>
                              </div>
                            )}
                          </td>

                          {/* Confidence */}
                          <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                            <span className={`font-mono font-bold text-xs ${
                              (r.confidence_score || 0) >= 0.9 ? 'text-emerald-700' : (r.confidence_score || 0) >= 0.75 ? 'text-amber-700' : 'text-rose-600'
                            }`}>
                              {Math.round((r.confidence_score || 0) * 100)}%
                            </span>
                            <span className="block text-[9px] text-slate-400 font-mono mt-0.5">
                              {(r.match_type || '').replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer / Expansion */}
              <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {Math.min(visibleDiffCount, filteredDiffResults.length)} of {filteredDiffResults.length} records
                  {diffFilter !== 'ALL' && ` (filtered: ${diffFilter})`}
                </span>
                <div className="flex items-center gap-2">
                  {filteredDiffResults.length > visibleDiffCount ? (
                    <button
                      onClick={() => setVisibleDiffCount(x => Math.min(x + 20, filteredDiffResults.length))}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] shadow-2xs"
                    >
                      Show more (+20)
                    </button>
                  ) : filteredDiffResults.length > 10 ? (
                    <button
                      onClick={() => setVisibleDiffCount(10)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] shadow-2xs"
                    >
                      Show fewer
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* ── 5. TOP EXCEPTIONS TABLE ── */}
          {topExceptions.length > 0 && (
            <div>
              <SectionHeader icon={AlertTriangle} title={`Transactions That Need Your Attention (${escalated_count} total)`} iconColor="text-amber-500" />
              <p className="text-[11px] text-slate-500 mb-3 -mt-1 leading-relaxed">
                These are the transactions the AI wasn't sure about — sorted by the <strong>largest money difference</strong> first.
                Go to the <strong>Exception Queue</strong> tab to approve or reject each one. Once you do, the AI learns from your decision.
              </p>
              <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Description</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Bank Amt</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Ledger Amt</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Δ Variance</th>
                      <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] hidden sm:table-cell">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(expandedExceptions ? topExceptions : topExceptions.slice(0, 3)).map((r, i) => {
                      const bAmt = r.bank_tx?.amount || 0;
                      const lAmt = r.ledger_tx?.amount || 0;
                      const diff = Math.abs(bAmt - lAmt);
                      return (
                        <tr key={r.id || i} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-3 py-2.5 max-w-[140px]">
                            <span className="font-medium text-ink truncate block">{r.bank_tx?.description || '—'}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{r.bank_tx?.date || ''}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-ink">{fmt(bAmt)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-500">{lAmt ? fmt(lAmt) : <span className="text-slate-300">N/A</span>}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="font-mono font-bold text-amber-600">{fmt(diff)}</span>
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell max-w-[180px]">
                            <span className="text-slate-500 line-clamp-1">{r.reasoning || '—'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {topExceptions.length > 3 && (
                  <button
                    onClick={() => setExpandedExceptions(x => !x)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all border-t border-slate-100"
                  >
                    {expandedExceptions ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {topExceptions.length} exceptions</>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── 5. SAMPLE AUTO-RECONCILED TRANSACTIONS ── */}
          {topAuto.length > 0 && (
            <div>
              <SectionHeader icon={CheckCircle2} title="✅ Transactions Matched Automatically (Sample)" iconColor="text-emerald-500" />
              <p className="text-[11px] text-slate-500 mb-3 -mt-1">
                These were cleared with no human input. The AI matched them to your ledger and posted them automatically.
              </p>
              <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Description</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Amount</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Confidence</th>
                      <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px] hidden sm:table-cell">Match Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(expandedTransactions ? topAuto : topAuto.slice(0, 3)).map((r, i) => {
                      const confPct = Math.round((r.confidence_score || 0) * 100);
                      return (
                        <tr key={r.id || i} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="px-3 py-2.5 max-w-[160px]">
                            <span className="font-medium text-ink truncate block">{r.bank_tx?.description || '—'}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{r.bank_tx?.date || ''}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-ink">{fmt(r.bank_tx?.amount || 0)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-mono font-bold text-xs ${confPct >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>{confPct}%</span>
                          </td>
                          <td className="px-3 py-2.5 hidden sm:table-cell">
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700">
                              {(r.match_type || '').replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {topAuto.length > 3 && (
                  <button
                    onClick={() => setExpandedTransactions(x => !x)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all border-t border-slate-100"
                  >
                    {expandedTransactions ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show all {topAuto.length} auto-reconciled</>}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── 6. RECOMMENDATIONS ── */}
          <div>
            <SectionHeader icon={ListChecks} title="What Should You Do Next?" iconColor="text-indigo-500" />
            <div className="space-y-2">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-white border border-slate-100 shadow-sm">
                  <span className="text-lg shrink-0">{rec.icon}</span>
                  <div>
                    <span className="text-[12px] text-slate-700 leading-relaxed">{rec.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 7. AGENT PIPELINE STEPS ── */}
          <div>
            <SectionHeader icon={Bot} title="What the AI Did — Step by Step" iconColor="text-violet-500" />
            <p className="text-[11px] text-slate-400 mb-3 -mt-1">
              The AI ran through these 8 stages automatically to process your files:
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              {[
                { step: '1', label: 'CSV Ingestion', icon: '📥', done: true },
                { step: '2', label: 'Normalization', icon: '🔄', done: true },
                { step: '3', label: 'Rule Matching', icon: '📏', done: true },
                { step: '4', label: 'Fuzzy Matching', icon: '🔍', done: true },
                { step: '5', label: 'LLM Decision', icon: '🧠', done: methodBreakdown.llm > 0 },
                { step: '6', label: 'Policy Guardrails', icon: '🛡️', done: true },
                { step: '7', label: 'Audit Logging', icon: '📋', done: true },
                { step: '8', label: 'Human Queue', icon: '👤', done: escalated_count > 0 },
              ].map((s, i, arr) => (
                <React.Fragment key={s.step}>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-semibold border ${s.done ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                    <span>{s.icon}</span>
                    <span>{s.step}. {s.label}</span>
                    {s.done && <span className="text-emerald-500">✓</span>}
                  </div>
                  {i < arr.length - 1 && <span className="text-slate-300 text-xs">→</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ── 8. AUDIT CERTIFICATE ── */}
          <div className="rounded-2xl overflow-hidden border border-slate-700">
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Autonomous Audit Certificate</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Issued by LedgerMind Agent {agent_version_id.toUpperCase()} · GAAP & IFRS compliant trace</div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" /> {created_at || new Date().toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-800 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Batch ID', value: batchId?.slice(0, 18) || '—' },
                { label: 'Total Processed', value: `${total_bank_tx} transactions` },
                { label: 'STP Rate', value: fmtPct(stpRate) },
                { label: 'Net Variance', value: fmt(variance) },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">{item.label}</div>
                  <div className="text-[11px] font-mono font-bold text-slate-200 mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="bg-slate-800/50 border-t border-slate-700 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px] text-slate-500">Pending CFO sign-off for final close</span>
              </div>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${riskColor}`}>
                {riskLabel}
              </span>
            </div>
          </div>

          {/* Self-improvement notice */}
          {escalated_count > 0 && (
            <div className="flex items-start gap-3 p-4 rounded-2xl border border-indigo-100 bg-indigo-50">
              <Zap className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
              <div className="text-[12px] text-indigo-800 leading-relaxed">
                <span className="font-bold">🤖 The AI will keep getting smarter on its own.</span>{' '}
                You have {escalated_count} transaction{escalated_count > 1 ? 's' : ''} waiting for review.
                Every time you approve or reject one in the <strong>Exception Queue</strong>,
                the AI <strong>automatically updates its own rules</strong> to make better decisions next time —
                no extra button needed. Think of it like training a new employee: every correction makes it smarter.
              </div>
            </div>
          )}

        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-6 pt-3 flex flex-wrap justify-between items-center gap-3 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 font-mono">
            LedgerMind · Batch {batchId} · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download Audit Report
            </button>
            <button
              onClick={onClose}
              className="text-xs font-semibold px-5 py-2 rounded-xl bg-black hover:bg-zinc-800 text-white transition-all shadow-sm"
            >
              Go to Dashboard →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
