import React, { useMemo, useState } from 'react';
import {
  X, CheckCircle2, AlertTriangle, XCircle, TrendingUp, FileText,
  BarChart2, Download, ShieldCheck, Zap, Clock, DollarSign,
  Activity, Target, ArrowUpRight, ArrowDownRight, Layers,
  ChevronDown, ChevronUp, Bot, Cpu, User, ListChecks, Star,
  Search, ArrowRight, Check, Equal, SlidersHorizontal, GitCompare,
  BookOpen, HelpCircle
} from 'lucide-react';
import {
  getCanonicalSummary,
  generateCanonicalCSV,
  formatCurrency,
  CURRENCY_SYMBOLS,
} from '../services/canonicalReport';

/**
 * ReconciliationReportModal — CFO-Grade Executive Audit Report
 * Authoritatively consumes the canonical reconciliation result.
 * Strictly follows the canonical outcome categories:
 * AUTO_MATCHED, HUMAN_REVIEW, UNMATCHED, LEDGER_ONLY
 */
export function ReconciliationReportModal({ batchData, onClose }) {
  const [expandedExceptions, setExpandedExceptions] = useState(false);
  const [expandedTransactions, setExpandedTransactions] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'AUTO_MATCHED' | 'HUMAN_REVIEW' | 'UNMATCHED' | 'LEDGER_ONLY'
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);

  const {
    id: batchId = '',
    bank_filename = '',
    ledger_filename = '',
    agent_version_id = 'v3',
    results = [],
    created_at = '',
  } = batchData || {};

  // Authoritative canonical summary — Single Source of Truth
  const canonicalSummary = useMemo(() => {
    return batchData ? getCanonicalSummary(batchData) : null;
  }, [batchData]);

  const counts = canonicalSummary?.counts || {
    total_bank_transactions: 0,
    total_ledger_entries: 0,
    auto_matched: 0,
    human_review: 0,
    unmatched: 0,
    ledger_only: 0,
  };

  const qualityMetrics = canonicalSummary?.quality_metrics || {
    straight_through_rate: 0,
    human_review_rate: 0,
    unmatched_rate: 0,
    auto_match_precision: 100.0,
    false_auto_match_rate: 0.0,
  };

  const stpRate = qualityMetrics.straight_through_rate;
  const exceptionRate = qualityMetrics.human_review_rate;
  const unmatchedRate = qualityMetrics.unmatched_rate;

  // Composite health score
  const healthScore = Math.round(
    stpRate * 0.5 +
    (100 - exceptionRate) * 0.3 +
    (100 - unmatchedRate) * 0.2
  );
  const healthGrade = healthScore >= 90 ? 'A' : healthScore >= 75 ? 'B' : healthScore >= 60 ? 'C' : 'D';
  const healthColor = healthScore >= 90 ? 'text-emerald-600' : healthScore >= 75 ? 'text-amber-600' : 'text-rose-600';
  const healthBg = healthScore >= 90 ? 'bg-emerald-50 border-emerald-200' : healthScore >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200';
  const riskLabel = exceptionRate < 5 && unmatchedRate < 3 ? 'LOW RISK' : exceptionRate < 15 ? 'MEDIUM RISK' : 'HIGH RISK';
  const riskColor = riskLabel === 'LOW RISK' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : riskLabel === 'MEDIUM RISK' ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-rose-700 bg-rose-50 border-rose-200';

  // Currency breakdown (without cross-currency blending)
  const currencyBreakdown = useMemo(() => {
    const map = {};
    results.forEach(r => {
      const bCurr = (r.bank_tx?.currency || r.bank_currency || '').toUpperCase();
      const lCurr = (r.ledger_tx?.currency || r.ledger_currency || '').toUpperCase();
      const curr = bCurr || lCurr || 'USD';
      if (!map[curr]) map[curr] = { bankVol: 0, ledgerVol: 0, count: 0 };
      if (r.bank_tx?.amount !== undefined) map[curr].bankVol += Math.abs(r.bank_tx.amount);
      else if (r.bank_amount !== undefined && r.bank_amount !== null) map[curr].bankVol += Math.abs(r.bank_amount);

      if (r.ledger_tx?.amount !== undefined) map[curr].ledgerVol += Math.abs(r.ledger_tx.amount);
      else if (r.ledger_amount !== undefined && r.ledger_amount !== null) map[curr].ledgerVol += Math.abs(r.ledger_amount);

      map[curr].count++;
    });
    return Object.entries(map);
  }, [results]);

  const hasMixedCurrencies = currencyBreakdown.length > 1;

  // Confidence buckets
  const confBuckets = useMemo(() => {
    let high = 0, med = 0, low = 0, unmatched = 0;
    results.forEach(r => {
      if (r.reconciliation_status === 'UNMATCHED' || r.reconciliation_status === 'LEDGER_ONLY') {
        unmatched++;
        return;
      }
      const c = r.confidence_score !== undefined ? r.confidence_score : 0;
      if (c >= 0.9) high++; else if (c >= 0.7) med++; else low++;
    });
    return { high, med, low, unmatched };
  }, [results]);

  // Method breakdown
  const methodBreakdown = useMemo(() => {
    let rule = 0, fuzzy = 0, llm = 0;
    results.forEach(r => {
      const m = (r.match_method || r.processing_method || '').toUpperCase();
      if (m.includes('RULE') || m === 'EXACT') rule++;
      else if (m.includes('FUZZY')) fuzzy++;
      else llm++;
    });
    return { rule, fuzzy, llm };
  }, [results]);

  // Top human review records
  const topExceptions = useMemo(() => {
    return results
      .filter(r => r.reconciliation_status === 'HUMAN_REVIEW')
      .sort((a, b) => {
        const da = Math.abs((a.bank_tx?.amount ?? a.bank_amount ?? 0) - (a.ledger_tx?.amount ?? a.ledger_amount ?? 0));
        const db = Math.abs((b.bank_tx?.amount ?? b.bank_amount ?? 0) - (b.ledger_tx?.amount ?? b.ledger_amount ?? 0));
        return db - da;
      })
      .slice(0, 5);
  }, [results]);

  // Top auto-matched records
  const topAuto = useMemo(() => {
    return results
      .filter(r => r.reconciliation_status === 'AUTO_MATCHED')
      .sort((a, b) => (b.bank_tx?.amount ?? b.bank_amount ?? 0) - (a.bank_tx?.amount ?? a.bank_amount ?? 0))
      .slice(0, 5);
  }, [results]);

  // Filtered comparison records based on canonical comparison_records
  const filteredComparisonRecords = useMemo(() => {
    if (!canonicalSummary) return [];
    let list = canonicalSummary.comparison_records || [];
    if (statusFilter !== 'ALL') {
      list = list.filter(r => r.reconciliation_status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => {
        return (
          r.bank_id.toLowerCase().includes(q) ||
          r.ledger_id.toLowerCase().includes(q) ||
          r.bank_desc.toLowerCase().includes(q) ||
          r.ledger_counterparty.toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q) ||
          r.explanation.toLowerCase().includes(q) ||
          r.bank_amount_formatted.toLowerCase().includes(q) ||
          r.ledger_amount_formatted.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [canonicalSummary, statusFilter, searchQuery]);

  // Recommendations
  const recommendations = useMemo(() => {
    const recs = [];
    if (counts.human_review > 0) {
      recs.push({
        icon: '🔍',
        text: `Review ${counts.human_review} flagged exception${counts.human_review > 1 ? 's' : ''} in the Human Review queue. Automatic reconciliation was stopped per safety policy.`,
      });
    }
    if (counts.unmatched > 0) {
      recs.push({
        icon: '🔗',
        text: `${counts.unmatched} bank transaction${counts.unmatched > 1 ? 's have' : ' has'} no credible ledger match. Verify if these represent unrecorded deposits or missing invoices.`,
      });
    }
    if (counts.ledger_only > 0) {
      recs.push({
        icon: '📒',
        text: `${counts.ledger_only} ledger entr${counts.ledger_only > 1 ? 'ies' : 'y'} appeared with no corresponding bank transaction. Verify unpresented checks or pending bank clearing.`,
      });
    }
    currencyBreakdown.forEach(([curr, data]) => {
      const v = Math.abs(data.bankVol - data.ledgerVol);
      if (v > 0.01) {
        recs.push({
          icon: '⚖️',
          text: `Net book variance of ${formatCurrency(v, curr)} detected in ${curr}. Investigate discrepancies before accounting period close.`,
        });
      }
    });
    if (recs.length === 0) {
      recs.push({ icon: '✅', text: 'All transactions reconciled canonically with zero outstanding variances. Books are in balance.' });
    }
    return recs;
  }, [counts, currencyBreakdown]);

  if (!batchData || !canonicalSummary) return null;

  // Handle Canonical CSV export
  const handleExportCSV = async () => {
    try {
      if (batchId) {
        const res = await fetch(`/api/v1/reconcile/batches/${batchId}/csv`);
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `reconciliation_audit_${batchId}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      }
    } catch (e) {
      console.warn('Backend CSV fetch notice, generating canonical CSV in frontend', e);
    }
    const csv = generateCanonicalCSV(canonicalSummary);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation_audit_${batchId || 'batch'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AUTO_MATCHED':
        return {
          label: 'AUTO MATCHED',
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          dot: 'bg-emerald-500',
        };
      case 'HUMAN_REVIEW':
        return {
          label: 'HUMAN REVIEW',
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          dot: 'bg-amber-500',
        };
      case 'UNMATCHED':
        return {
          label: 'BANK UNMATCHED',
          bg: 'bg-rose-50 text-rose-800 border-rose-200',
          dot: 'bg-rose-500',
        };
      case 'LEDGER_ONLY':
        return {
          label: 'LEDGER ONLY',
          bg: 'bg-purple-50 text-purple-800 border-purple-200',
          dot: 'bg-purple-500',
        };
      default:
        return {
          label: status,
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
        };
    }
  };

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-[#FAFAF8] rounded-3xl shadow-2xl border border-slate-200/80 flex flex-col">

        {/* Top Accent Gradient */}
        <div className="sticky top-0 z-10">
          <div className="h-1 rounded-t-3xl bg-gradient-to-r from-emerald-500 via-indigo-500 to-amber-400" />

          {/* Sticky Header */}
          <div className="flex items-start justify-between px-6 py-4 bg-[#FAFAF8]/95 backdrop-blur-md border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  CANONICAL RECONCILIATION RESULT
                </span>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${riskColor}`}>
                  {riskLabel}
                </span>
              </div>
              <h2 className="font-serif font-bold text-xl text-ink">Authoritative Audit & Reconciliation Report</h2>
              <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                {bank_filename || 'Bank Statement'} ↔ {ledger_filename || 'Company Ledger'} &nbsp;·&nbsp;
                Currencies: {canonicalSummary.currencies_detected.join(', ') || 'Auto-detected'} &nbsp;·&nbsp;
                Batch ID: {batchId || 'N/A'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all shadow-sm"
                title="Download GAAP/IFRS Audit CSV"
              >
                <Download className="w-3.5 h-3.5" /> Export Canonical CSV
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">

          {/* 0. Plain English Summary Banner */}
          <div className={`p-4 rounded-2xl border-2 ${healthScore >= 90 ? 'bg-emerald-50 border-emerald-200' : healthScore >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">
                {healthScore >= 90 ? '🎉' : healthScore >= 75 ? '⚠️' : '🚨'}
              </span>
              <div>
                <div className="text-sm font-bold text-ink mb-1">
                  {healthScore >= 90
                    ? 'Reconciliation complete — High STP rate achieved!'
                    : healthScore >= 75
                    ? 'Reconciliation finished with items requiring human review.'
                    : 'Action required — significant exceptions or unmatched records identified.'}
                </div>
                <p className="text-[12px] text-slate-600 leading-relaxed">
                  Processed <strong>{counts.total_bank_transactions} bank transactions</strong> and <strong>{counts.total_ledger_entries} ledger entries</strong> across {canonicalSummary.currencies_detected.join(' & ')}.{' '}
                  <strong className="text-emerald-700">{counts.auto_matched} were auto-matched ({stpRate}%)</strong> without human intervention.{' '}
                  {counts.human_review > 0 && (
                    <><strong className="text-amber-700">{counts.human_review} require human review ({exceptionRate}%)</strong> due to financial contradictions or policy guardrails.{' '}</>
                  )}
                  {counts.unmatched > 0 && (
                    <><strong className="text-rose-700">{counts.unmatched} bank transactions have no match</strong> in the ledger.{' '}</>
                  )}
                  {counts.ledger_only > 0 && (
                    <><strong className="text-purple-700">{counts.ledger_only} ledger entries have no bank record</strong> (ledger-only).</>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 1. Canonical KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {/* Grade & Health */}
            <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1 ${healthBg}`}>
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Quality Grade</div>
              <div className={`text-4xl font-black font-mono ${healthColor}`}>{healthGrade}</div>
              <div className={`text-lg font-bold font-mono ${healthColor}`}>{healthScore}<span className="text-xs font-normal text-slate-400">/100</span></div>
              <div className="text-[9px] text-slate-500 text-center leading-snug">
                {healthScore >= 90 ? '✓ High Integrity' : '⚠ Action Items'}
              </div>
            </div>

            {/* Total Bank */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Bank Transactions</div>
              <div className="text-2xl font-bold font-mono text-ink mt-1">{counts.total_bank_transactions}</div>
              <div className="text-[10px] text-slate-400 mt-2">Bank statement scope</div>
            </div>

            {/* Total Ledger */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="text-[10px] font-mono text-slate-500 uppercase">Ledger Entries</div>
              <div className="text-2xl font-bold font-mono text-ink mt-1">{counts.total_ledger_entries}</div>
              <div className="text-[10px] text-slate-400 mt-2">Company ledger scope</div>
            </div>

            {/* Auto-Matched */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-600 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" /> AUTO-MATCHED
              </div>
              <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{counts.auto_matched}</div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Rate</span><span className="font-mono font-bold text-emerald-600">{stpRate}%</span>
                </div>
                <MiniBar pct={stpRate} color="bg-emerald-500" />
              </div>
            </div>

            {/* Human Review */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1 text-[10px] font-mono text-amber-600 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" /> HUMAN REVIEW
              </div>
              <div className="text-2xl font-bold font-mono text-amber-700 mt-1">{counts.human_review}</div>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span>Rate</span><span className="font-mono font-bold text-amber-600">{exceptionRate}%</span>
                </div>
                <MiniBar pct={exceptionRate} color="bg-amber-500" />
              </div>
            </div>

            {/* Bank Unmatched + Ledger-only */}
            <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-1 text-[10px] font-mono text-rose-600 font-bold">
                <XCircle className="w-3.5 h-3.5" /> UNMATCHED
              </div>
              <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{counts.unmatched}</div>
              <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                <span>Ledger-only</span>
                <span className="font-mono font-bold text-purple-600">{counts.ledger_only}</span>
              </div>
            </div>
          </div>

          {/* 2. Currency Breakdown (Multi-Currency Safe, No Hardcoded USD) */}
          <div>
            <SectionHeader icon={DollarSign} title="Multi-Currency Volume & Net Variance" iconColor="text-emerald-600" />
            <div className="space-y-3">
              {currencyBreakdown.map(([curr, data]) => {
                const diff = Math.abs(data.bankVol - data.ledgerVol);
                const isBalanced = diff < 0.01;
                return (
                  <div key={curr} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">🏦 Bank Total ({curr})</div>
                      <div className="text-xl font-bold font-mono text-ink">{formatCurrency(data.bankVol, curr)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{data.count} items recorded</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                      <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">📒 Ledger Total ({curr})</div>
                      <div className="text-xl font-bold font-mono text-ink">{formatCurrency(data.ledgerVol, curr)}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{curr} general ledger balance</div>
                    </div>
                    <div className={`p-4 rounded-2xl border ${isBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">⚖️ Net Variance ({curr})</div>
                      <div className={`text-xl font-bold font-mono ${isBalanced ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {formatCurrency(diff, curr)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {isBalanced ? 'Books in exact balance' : 'Variance in period — check exceptions'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Canonical Exception Classification Breakdown */}
          <div>
            <SectionHeader icon={Layers} title="Structured Exception Classifications" iconColor="text-indigo-600" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Object.entries(canonicalSummary.exception_counts || {}).map(([exc, cnt]) => {
                const isZero = cnt === 0;
                return (
                  <div
                    key={exc}
                    className={`p-3 rounded-xl border transition-all ${
                      isZero
                        ? 'bg-slate-50/50 border-slate-100 opacity-60'
                        : 'bg-white border-slate-200 shadow-xs ring-1 ring-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase text-slate-500 truncate" title={exc}>
                        {exc.replace(/_/g, ' ')}
                      </span>
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        isZero ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-700 font-black'
                      }`}>
                        {cnt}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Canonical Reconciliation Results (Primary Categories: AUTO_MATCHED, HUMAN_REVIEW, UNMATCHED, LEDGER_ONLY) */}
          <div className="space-y-4">
            <div>
              <SectionHeader icon={GitCompare} title="Canonical Reconciliation Records" iconColor="text-indigo-600" />
              <p className="text-[11px] text-slate-500 -mt-1 leading-relaxed">
                Authoritative transaction-level decisions. Filter by primary outcome category or search by description, counterparty, reference, or amount.
              </p>
            </div>

            {/* 4 Primary Category Interactive Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Card 1: AUTO_MATCHED */}
              <div
                onClick={() => setStatusFilter('AUTO_MATCHED')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  statusFilter === 'AUTO_MATCHED'
                    ? 'bg-emerald-50/90 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20'
                    : 'bg-emerald-50/40 border-emerald-200/80 hover:bg-emerald-50/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                      ✓
                    </div>
                    <span className="text-xs font-bold text-emerald-950">AUTO_MATCHED</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {stpRate}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-emerald-900">{counts.auto_matched}</div>
                  <span className="text-[10px] text-emerald-700">Safe auto-post</span>
                </div>
              </div>

              {/* Card 2: HUMAN_REVIEW */}
              <div
                onClick={() => setStatusFilter('HUMAN_REVIEW')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  statusFilter === 'HUMAN_REVIEW'
                    ? 'bg-amber-50/90 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                    : 'bg-amber-50/40 border-amber-200/80 hover:bg-amber-50/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-xs">
                      ⚠
                    </div>
                    <span className="text-xs font-bold text-amber-950">HUMAN_REVIEW</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {exceptionRate}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-amber-900">{counts.human_review}</div>
                  <span className="text-[10px] text-amber-700">Review required</span>
                </div>
              </div>

              {/* Card 3: UNMATCHED */}
              <div
                onClick={() => setStatusFilter('UNMATCHED')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  statusFilter === 'UNMATCHED'
                    ? 'bg-rose-50/90 border-rose-500 shadow-sm ring-2 ring-rose-500/20'
                    : 'bg-rose-50/40 border-rose-200/80 hover:bg-rose-50/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
                      ✕
                    </div>
                    <span className="text-xs font-bold text-rose-950">UNMATCHED</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                    {unmatchedRate}%
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-rose-900">{counts.unmatched}</div>
                  <span className="text-[10px] text-rose-700">Missing in ledger</span>
                </div>
              </div>

              {/* Card 4: LEDGER_ONLY */}
              <div
                onClick={() => setStatusFilter('LEDGER_ONLY')}
                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                  statusFilter === 'LEDGER_ONLY'
                    ? 'bg-purple-50/90 border-purple-500 shadow-sm ring-2 ring-purple-500/20'
                    : 'bg-purple-50/40 border-purple-200/80 hover:bg-purple-50/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold text-xs">
                      📒
                    </div>
                    <span className="text-xs font-bold text-purple-950">LEDGER_ONLY</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                    {counts.ledger_only} items
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-2xl font-black font-mono text-purple-900">{counts.ledger_only}</div>
                  <span className="text-[10px] text-purple-700">Missing in bank</span>
                </div>
              </div>
            </div>

            {/* Filter Buttons & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] ${
                    statusFilter === 'ALL'
                      ? 'bg-white text-ink shadow-xs font-bold'
                      : 'text-slate-500 hover:text-ink'
                  }`}
                >
                  All ({canonicalSummary.comparison_records.length})
                </button>
                <button
                  onClick={() => setStatusFilter('AUTO_MATCHED')}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1.5 ${
                    statusFilter === 'AUTO_MATCHED'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-emerald-700 hover:bg-emerald-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Auto-Matched ({counts.auto_matched})
                </button>
                <button
                  onClick={() => setStatusFilter('HUMAN_REVIEW')}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1.5 ${
                    statusFilter === 'HUMAN_REVIEW'
                      ? 'bg-amber-600 text-white shadow-xs font-bold'
                      : 'text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Human Review ({counts.human_review})
                </button>
                <button
                  onClick={() => setStatusFilter('UNMATCHED')}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1.5 ${
                    statusFilter === 'UNMATCHED'
                      ? 'bg-rose-600 text-white shadow-xs font-bold'
                      : 'text-rose-700 hover:bg-rose-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Unmatched ({counts.unmatched})
                </button>
                <button
                  onClick={() => setStatusFilter('LEDGER_ONLY')}
                  className={`px-3 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1.5 ${
                    statusFilter === 'LEDGER_ONLY'
                      ? 'bg-purple-600 text-white shadow-xs font-bold'
                      : 'text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  Ledger Only ({counts.ledger_only})
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ID, counterparty, description..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-ink placeholder-slate-400 focus:outline-none focus:border-slate-400 w-full sm:w-64 shadow-2xs"
                />
              </div>
            </div>

            {/* Authoritative Table with Full Audit Fields */}
            <div className="rounded-2xl border border-slate-200/80 overflow-hidden bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 font-mono text-[9px] uppercase tracking-wider">
                      <th className="py-2.5 px-3">Canonical Status</th>
                      <th className="py-2.5 px-3">Bank Transaction</th>
                      <th className="py-2.5 px-3">Ledger Transaction</th>
                      <th className="py-2.5 px-3">Variance & Exception</th>
                      <th className="py-2.5 px-3">Audit Explanation & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredComparisonRecords.slice(0, visibleCount).map((rec, idx) => {
                      const badge = getStatusBadge(rec.reconciliation_status);
                      return (
                        <tr
                          key={rec.bank_id + '_' + rec.ledger_id + '_' + idx}
                          className={`transition-colors ${
                            rec.reconciliation_status === 'AUTO_MATCHED'
                              ? 'hover:bg-emerald-50/20'
                              : rec.reconciliation_status === 'HUMAN_REVIEW'
                              ? 'hover:bg-amber-50/30'
                              : 'hover:bg-slate-50/50'
                          }`}
                        >
                          {/* Column 1: Canonical Status & Confidence */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badge.bg}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                              {badge.label}
                            </span>
                            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
                              <span>{rec.match_method}</span>
                              <span>•</span>
                              <span className="font-bold text-slate-600">{rec.confidence_display}</span>
                            </div>
                          </td>

                          {/* Column 2: Bank Statement Data */}
                          <td className="py-3 px-3 align-top max-w-[210px]">
                            {rec.bank_id !== 'N/A' && !rec.bank_id.startsWith('ledger_only_') ? (
                              <>
                                <div className="font-semibold text-ink truncate" title={rec.bank_desc}>
                                  {rec.bank_desc}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex flex-wrap gap-1">
                                  <span>ID: {rec.bank_id}</span>
                                  {rec.reference !== 'N/A' && <span>• Ref: {rec.reference}</span>}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  <span>Tx: {rec.bank_date}</span>
                                  {rec.bank_value_date && rec.bank_value_date !== 'N/A' && rec.bank_value_date !== rec.bank_date && (
                                    <span> (Val: {rec.bank_value_date})</span>
                                  )}
                                </div>
                                <div className="text-xs font-bold font-mono text-ink mt-1">
                                  {rec.bank_amount_formatted}
                                </div>
                              </>
                            ) : (
                              <div className="p-2 rounded-lg bg-purple-50/60 border border-purple-100 text-purple-700 text-[11px] italic">
                                ✕ No corresponding bank transaction found
                              </div>
                            )}
                          </td>

                          {/* Column 3: Company Ledger Data */}
                          <td className="py-3 px-3 align-top max-w-[210px]">
                            {rec.ledger_id !== 'N/A' ? (
                              <>
                                <div className="font-semibold text-ink truncate" title={rec.ledger_counterparty}>
                                  {rec.ledger_counterparty}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex flex-wrap gap-1">
                                  <span>ID: {rec.ledger_id}</span>
                                  {rec.reference !== 'N/A' && <span>• Ref: {rec.reference}</span>}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  <span>Doc: {rec.ledger_document_date}</span>
                                  {rec.ledger_posting_date && rec.ledger_posting_date !== 'N/A' && (
                                    <span> (Post: {rec.ledger_posting_date})</span>
                                  )}
                                </div>
                                <div className="text-xs font-bold font-mono text-ink mt-1">
                                  {rec.ledger_amount_formatted}
                                </div>
                              </>
                            ) : (
                              <div className="p-2 rounded-lg bg-rose-50/60 border border-rose-100 text-rose-700 text-[11px] italic">
                                ✕ No credible ledger candidate found
                              </div>
                            )}
                          </td>

                          {/* Column 4: Variance & Exception */}
                          <td className="py-3 px-3 align-top whitespace-nowrap">
                            <div className="font-mono text-xs font-bold text-slate-800">
                              Variance: {rec.variance_formatted}
                            </div>
                            <div className="mt-1">
                              {rec.exception_type !== 'NONE' ? (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                  {rec.exception_type}
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-md text-[9px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  CLEARED
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Column 5: Explanation & Recommended Action */}
                          <td className="py-3 px-3 align-top max-w-[280px]">
                            <p className="text-[11px] text-slate-700 leading-snug">
                              {rec.explanation}
                            </p>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="text-[9px] font-mono uppercase text-slate-400">Action:</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                rec.recommended_action === 'AUTO_POST'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : rec.recommended_action === 'REVIEW'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {rec.recommended_action}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Showing {Math.min(visibleCount, filteredComparisonRecords.length)} of {filteredComparisonRecords.length} records
                  {statusFilter !== 'ALL' && ` (Category: ${statusFilter})`}
                </span>
                <div className="flex items-center gap-2">
                  {filteredComparisonRecords.length > visibleCount ? (
                    <button
                      onClick={() => setVisibleCount(x => Math.min(x + 15, filteredComparisonRecords.length))}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] shadow-2xs"
                    >
                      Show more (+15)
                    </button>
                  ) : filteredComparisonRecords.length > 15 ? (
                    <button
                      onClick={() => setVisibleCount(15)}
                      className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold text-[11px] shadow-2xs"
                    >
                      Show fewer
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* 5. Top Exceptions Requiring Human Attention */}
          {topExceptions.length > 0 && (
            <div>
              <SectionHeader icon={AlertTriangle} title={`Flagged Exceptions Requiring Human Review (${counts.human_review} total)`} iconColor="text-amber-500" />
              <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Description</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Bank Amt</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Ledger Amt</th>
                      <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Canonical Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(expandedExceptions ? topExceptions : topExceptions.slice(0, 3)).map((r, i) => {
                      const bAmt = r.bank_tx?.amount ?? r.bank_amount ?? 0;
                      const lAmt = r.ledger_tx?.amount ?? r.ledger_amount ?? 0;
                      const bCurr = r.bank_tx?.currency || r.bank_currency || 'USD';
                      const lCurr = r.ledger_tx?.currency || r.ledger_currency || 'USD';
                      return (
                        <tr key={r.id || i} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-3 py-2.5 max-w-[140px]">
                            <span className="font-medium text-ink truncate block">{r.bank_tx?.description || r.bank_tx_id || '—'}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{r.bank_tx?.date || ''}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-ink">{formatCurrency(bAmt, bCurr)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-500">{lAmt ? formatCurrency(lAmt, lCurr) : 'N/A'}</td>
                          <td className="px-3 py-2.5 text-slate-700">
                            {r.explanation || r.reasoning}
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

          {/* 6. Sample Auto-Reconciled Records */}
          {topAuto.length > 0 && (
            <div>
              <SectionHeader icon={CheckCircle2} title="Sample Auto-Reconciled Transactions" iconColor="text-emerald-500" />
              <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Description</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Amount</th>
                      <th className="text-right px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Confidence</th>
                      <th className="text-left px-3 py-2.5 font-bold text-slate-500 uppercase tracking-wider text-[9px]">Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(expandedTransactions ? topAuto : topAuto.slice(0, 3)).map((r, i) => {
                      const confPct = Math.round((r.confidence_score || 0) * 100);
                      const bAmt = r.bank_tx?.amount ?? r.bank_amount ?? 0;
                      const bCurr = r.bank_tx?.currency || r.bank_currency || 'USD';
                      return (
                        <tr key={r.id || i} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="px-3 py-2.5 max-w-[160px]">
                            <span className="font-medium text-ink truncate block">{r.bank_tx?.description || r.bank_tx_id || '—'}</span>
                            <span className="text-[9px] text-slate-400 font-mono">{r.bank_tx?.date || ''}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-ink">{formatCurrency(bAmt, bCurr)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-mono font-bold text-xs ${confPct >= 90 ? 'text-emerald-600' : 'text-amber-600'}`}>{confPct}%</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700">
                              {r.match_method || 'RULE'}
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

          {/* 7. Actionable Recommendations */}
          <div>
            <SectionHeader icon={ListChecks} title="Recommended Action Items" iconColor="text-indigo-500" />
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

          {/* 8. Audit Certificate */}
          <div className="rounded-2xl overflow-hidden border border-slate-700">
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-white">Authoritative Autonomous Audit Certificate</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">Consumes Canonical Schema · IFRS & GAAP Compliant · Agent {agent_version_id.toUpperCase()}</div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" /> {created_at || new Date().toLocaleString()}
              </div>
            </div>
            <div className="bg-slate-800 px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Batch ID', value: batchId?.slice(0, 18) || '—' },
                { label: 'Bank Transactions', value: counts.total_bank_transactions },
                { label: 'Auto-Matched (STP)', value: `${counts.auto_matched} (${stpRate}%)` },
                { label: 'Human Review', value: `${counts.human_review} (${exceptionRate}%)` },
              ].map(item => (
                <div key={item.label}>
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">{item.label}</div>
                  <div className="text-[11px] font-mono font-bold text-slate-200 mt-0.5">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Sticky Footer */}
        <div className="px-6 pb-6 pt-3 flex flex-wrap justify-between items-center gap-3 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 font-mono">
            LedgerMind Canonical Report · Batch {batchId} · Single Source of Truth
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export Canonical CSV
            </button>
            <button
              onClick={onClose}
              className="text-xs font-semibold px-5 py-2 rounded-xl bg-black hover:bg-zinc-800 text-white transition-all shadow-sm"
            >
              Close & View Dashboard →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
