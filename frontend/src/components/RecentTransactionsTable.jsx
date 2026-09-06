import React, { useState, useMemo } from 'react';
import { Search, Filter, MoreHorizontal, ArrowUpRight, CheckCircle2, ShieldAlert, XCircle, Clock, Check, GitCompare } from 'lucide-react';

export function RecentTransactionsTable({
  results = [],
  onSelectTransaction,
  onViewAll,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Real transaction results only (no fake demo rows)
  const displayData = results && results.length > 0 ? results : [];

  const getStatus = (r) => {
    if (r.human_status && r.human_status !== 'PENDING' && r.human_status !== 'NONE') {
      return 'REVIEWED';
    }
    if (r.action_taken === 'AUTO_RECONCILE') return 'AUTO-RECONCILED';
    if (r.action_taken === 'ESCALATE_TO_HUMAN') return 'ESCALATED';
    return 'UNMATCHED';
  };

  const getRowDiff = (r) => {
    const b = r.bank_tx;
    const l = r.ledger_tx;
    if (!b && !l) return { isSame: false, type: 'EMPTY', text: 'No data', style: 'text-slate-500 bg-slate-100 border-slate-200' };
    if (b && !l) return { isSame: false, type: 'MISSING', text: '✕ Missing in Ledger', style: 'text-rose-700 bg-rose-50 border-rose-200' };
    if (!b && l) return { isSame: false, type: 'MISSING', text: '✕ Missing in Bank', style: 'text-rose-700 bg-rose-50 border-rose-200' };

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
    const isSame = isAmountSame && isDateSame && (r.match_type === 'EXACT' || absDiff === 0);

    if (isSame) {
      return {
        isSame: true,
        type: 'SAME',
        text: '✓ Identical ($0 diff)',
        style: 'text-emerald-700 bg-emerald-50 border-emerald-200'
      };
    }

    if (!isAmountSame && !isDateSame) {
      return {
        isSame: false,
        type: 'DIFF_BOTH',
        text: `Δ ${rawDiff > 0 ? '+' : ''}$${rawDiff.toFixed(2)} • ${dateDiffDays}d`,
        style: 'text-rose-700 bg-rose-50 border-rose-200'
      };
    }

    if (!isAmountSame) {
      return {
        isSame: false,
        type: 'DIFF_AMOUNT',
        text: `Δ ${rawDiff > 0 ? '+' : ''}$${rawDiff.toFixed(2)}`,
        style: 'text-amber-800 bg-amber-50 border-amber-200'
      };
    }

    if (!isDateSame) {
      return {
        isSame: false,
        type: 'DIFF_DATE',
        text: `⏱ ${dateDiffDays}d lag`,
        style: 'text-sky-800 bg-sky-50 border-sky-200'
      };
    }

    return {
      isSame: false,
      type: 'DIFF_MEMO',
      text: 'Memo diff',
      style: 'text-indigo-800 bg-indigo-50 border-indigo-200'
    };
  };

  const sameCount = useMemo(() => displayData.filter(r => getRowDiff(r).isSame).length, [displayData]);
  const diffCount = displayData.length - sameCount;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AUTO-RECONCILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pastel-mint text-emerald-800 border border-pastel-mint-border">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Auto-posted</span>
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pastel-pink text-rose-800 border border-pastel-pink-border">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            <span>Escalated</span>
          </span>
        );
      case 'REVIEWED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pastel-blue text-sky-800 border border-pastel-blue-border">
            <Clock className="w-3 h-3 text-sky-600" />
            <span>Reviewed</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <XCircle className="w-3 h-3 text-slate-500" />
            <span>Unmatched</span>
          </span>
        );
    }
  };

  const filtered = displayData.filter((r) => {
    const st = getStatus(r);
    const diff = getRowDiff(r);

    if (statusFilter === 'SAME' && !diff.isSame) return false;
    if (statusFilter === 'DIFFERENT' && diff.isSame) return false;
    if (statusFilter !== 'ALL' && statusFilter !== 'SAME' && statusFilter !== 'DIFFERENT' && st !== statusFilter) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const desc = r.bank_tx?.description?.toLowerCase() || '';
      const ref = r.bank_tx?.reference_id?.toLowerCase() || '';
      const lDesc = r.ledger_tx?.description?.toLowerCase() || '';
      const lRef = r.ledger_tx?.reference_id?.toLowerCase() || '';
      const bAmt = String(r.bank_tx?.amount || '');
      const lAmt = String(r.ledger_tx?.amount || '');
      if (!desc.includes(q) && !ref.includes(q) && !lDesc.includes(q) && !lRef.includes(q) && !bAmt.includes(q) && !lAmt.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="forge-card p-6 flex flex-col space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-serif font-bold text-lg text-ink">Recent Transactions & Discrepancies</h2>
            <button
              onClick={onViewAll}
              className="text-xs font-semibold text-ink-secondary hover:text-ink flex items-center space-x-0.5 transition-colors"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-ink-secondary mt-0.5">
            Side-by-side reconciliation of Bank Statement vs Company Ledger records with difference tracking.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search description, amount, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-full pl-8 pr-3 py-1.5 text-xs text-ink placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white w-48 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* Status & Same/Different Filter Tabs */}
      <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-2 text-xs overflow-x-auto">
        {[
          { key: 'ALL', label: `All (${displayData.length})` },
          { key: 'SAME', label: `🟢 Same Data (${sameCount})`, color: 'text-emerald-700' },
          { key: 'DIFFERENT', label: `⚠️ Different Data (${diffCount})`, color: 'text-amber-700' },
          { key: 'AUTO-RECONCILED', label: 'Auto-posted' },
          { key: 'ESCALATED', label: 'Escalated' },
          { key: 'UNMATCHED', label: 'Unmatched' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-3 py-1 rounded-full font-semibold transition-all whitespace-nowrap ${
              statusFilter === key
                ? 'bg-ink text-white shadow-2xs'
                : 'text-slate-500 hover:text-ink hover:bg-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="py-12 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-ink">No Reconciled Transactions Yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Upload your real Bank Statement and Company Ledger CSV files using the dual file uploader to see live matching and audit traces.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Bank Transaction</th>
                <th className="py-2.5 px-3 text-right">Bank Amt</th>
                <th className="py-2.5 px-3">Matched Ledger Entry</th>
                <th className="py-2.5 px-3 text-right">Ledger Amt</th>
                <th className="py-2.5 px-3">Comparison / Diff</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((row) => {
                const b = row.bank_tx;
                const l = row.ledger_tx;
                const diff = getRowDiff(row);
                const confPct = Math.round((row.confidence_score || 0) * 100);
                const status = getStatus(row);

                // Confidence bar color
                const barColor =
                  confPct >= 90
                    ? 'bg-emerald-500'
                    : confPct >= 75
                    ? 'bg-amber-400'
                    : 'bg-rose-400';

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectTransaction(row)}
                    className={`cursor-pointer transition-colors group ${
                      diff.isSame ? 'hover:bg-emerald-50/30' : 'hover:bg-amber-50/40'
                    }`}
                  >
                    {/* Bank Transaction */}
                    <td className="py-3 px-3 max-w-xs">
                      <span className="font-semibold text-ink group-hover:text-black block truncate">
                        {b?.description || 'Transaction Record'}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>{b?.date || '—'}</span>
                        {b?.reference_id && <span>• Ref: {b.reference_id}</span>}
                      </div>
                    </td>

                    {/* Bank Amount */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-sans font-bold text-ink">
                      ${b?.amount ? b.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </td>

                    {/* Matched Ledger Entry */}
                    <td className="py-3 px-3 max-w-xs">
                      {l ? (
                        <div>
                          <span className="font-medium text-slate-800 block truncate">
                            {l.description}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>{l.date || '—'}</span>
                            {l.reference_id && <span>• Ref: {l.reference_id}</span>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-rose-500 italic text-[11px] font-medium">✕ No ledger match</span>
                      )}
                    </td>

                    {/* Ledger Amount */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-sans font-semibold text-slate-600">
                      {l?.amount !== undefined ? (
                        `$${l.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Comparison / Diff Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${diff.style}`}>
                        {diff.isSame ? <Check className="w-3 h-3 text-emerald-600" /> : <GitCompare className="w-3 h-3" />}
                        <span>{diff.text}</span>
                      </span>
                    </td>

                    {/* Confidence with Progress Bar */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-xs text-ink w-8">
                          {confPct}%
                        </span>
                        <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${barColor}`}
                            style={{ width: `${confPct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(status)}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectTransaction(row)}
                        className="p-1.5 rounded-full hover:bg-slate-200/70 text-slate-400 hover:text-ink transition-colors"
                        title="Inspect Transaction"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>

  );
}
