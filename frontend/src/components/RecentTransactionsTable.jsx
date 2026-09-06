import React, { useState } from 'react';
import { Search, ArrowUpRight, CheckCircle2, ShieldAlert, XCircle, AlertCircle, MoreHorizontal } from 'lucide-react';
import { formatCurrency } from '../services/canonicalReport';

export function RecentTransactionsTable({
  results = [],
  onSelectTransaction,
  onViewAll,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const displayData = results && results.length > 0 ? results : [];

  const getReconStatus = (r) => {
    return r.reconciliation_status || (
      r.action_taken === 'AUTO_RECONCILE' ? 'AUTO_MATCHED' :
      r.action_taken === 'ESCALATE_TO_HUMAN' ? 'HUMAN_REVIEW' :
      (r.bank_tx ? 'UNMATCHED' : 'LEDGER_ONLY')
    );
  };

  const statusCounts = {
    ALL: displayData.length,
    AUTO_MATCHED: displayData.filter(r => getReconStatus(r) === 'AUTO_MATCHED').length,
    HUMAN_REVIEW: displayData.filter(r => getReconStatus(r) === 'HUMAN_REVIEW').length,
    UNMATCHED: displayData.filter(r => getReconStatus(r) === 'UNMATCHED').length,
    LEDGER_ONLY: displayData.filter(r => getReconStatus(r) === 'LEDGER_ONLY').length,
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AUTO_MATCHED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-pastel-mint text-emerald-800 border border-pastel-mint-border">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Auto-Matched</span>
          </span>
        );
      case 'HUMAN_REVIEW':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            <span>Human Review</span>
          </span>
        );
      case 'LEDGER_ONLY':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <AlertCircle className="w-3 h-3 text-purple-600" />
            <span>Ledger Only</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Bank Unmatched</span>
          </span>
        );
    }
  };

  const filtered = displayData.filter((r) => {
    const st = getReconStatus(r);
    if (statusFilter !== 'ALL' && st !== statusFilter) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const bDesc = (r.bank_tx?.description || '').toLowerCase();
      const bRef = (r.bank_tx?.reference_id || r.bank_tx?.reference || '').toLowerCase();
      const lDesc = (r.ledger_tx?.description || '').toLowerCase();
      const lRef = (r.ledger_tx?.reference_id || r.ledger_tx?.reference || '').toLowerCase();
      const lParty = (r.ledger_tx?.counterparty || '').toLowerCase();
      const bId = (r.bank_tx_id || '').toLowerCase();
      const lId = (r.ledger_tx_id || '').toLowerCase();
      const bAmt = String(r.bank_tx?.amount || r.bank_amount || '');
      const lAmt = String(r.ledger_tx?.amount || r.ledger_amount || '');
      const exp = (r.explanation || r.reasoning || '').toLowerCase();

      if (
        !bDesc.includes(q) && !bRef.includes(q) &&
        !lDesc.includes(q) && !lRef.includes(q) &&
        !lParty.includes(q) && !bId.includes(q) &&
        !lId.includes(q) && !bAmt.includes(q) &&
        !lAmt.includes(q) && !exp.includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="forge-card p-6 flex flex-col space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="font-serif font-bold text-lg text-ink">Canonical Reconciliation Ledger</h2>
            <button
              onClick={onViewAll}
              className="text-xs font-semibold text-ink-secondary hover:text-ink flex items-center space-x-0.5 transition-colors"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-ink-secondary mt-0.5">
            Side-by-side reconciliation of Bank Statement vs Company Ledger records rendering authoritative canonical decisions.
          </p>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search description, ref, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-full pl-8 pr-3 py-1.5 text-xs text-ink placeholder-slate-400 focus:outline-none focus:border-slate-400 focus:bg-white w-48 sm:w-60"
            />
          </div>
        </div>
      </div>

      {/* Canonical Status Filter Tabs */}
      <div className="flex items-center space-x-1.5 border-b border-slate-100 pb-2 text-xs overflow-x-auto">
        {[
          { key: 'ALL', label: `All (${statusCounts.ALL})` },
          { key: 'AUTO_MATCHED', label: `Auto-Matched (${statusCounts.AUTO_MATCHED})` },
          { key: 'HUMAN_REVIEW', label: `Human Review (${statusCounts.HUMAN_REVIEW})` },
          { key: 'UNMATCHED', label: `Bank Unmatched (${statusCounts.UNMATCHED})` },
          { key: 'LEDGER_ONLY', label: `Ledger-Only (${statusCounts.LEDGER_ONLY})` },
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
          <h4 className="text-sm font-semibold text-ink">No Transactions Found</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No transactions match the selected filter criteria.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Bank Transaction</th>
                <th className="py-2.5 px-3 text-right">Bank Amt</th>
                <th className="py-2.5 px-3">Company Ledger Entry</th>
                <th className="py-2.5 px-3 text-right">Ledger Amt</th>
                <th className="py-2.5 px-3 text-right">Variance</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 max-w-xs">Explanation</th>
                <th className="py-2.5 px-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filtered.map((row) => {
                const b = row.bank_tx;
                const l = row.ledger_tx;
                const status = getReconStatus(row);
                const confPct = Math.round((row.confidence_score || row.confidence || 0) * 100);

                const bAmt = b?.amount !== undefined ? b.amount : row.bank_amount;
                const lAmt = l?.amount !== undefined ? l.amount : row.ledger_amount;
                const bCurr = (b?.currency || row.bank_currency || '').toUpperCase();
                const lCurr = (l?.currency || row.ledger_currency || '').toUpperCase();

                const currenciesMatch = bCurr && lCurr && bCurr === lCurr;
                const variance = currenciesMatch && bAmt !== undefined && lAmt !== undefined
                  ? Math.abs(Math.abs(bAmt) - Math.abs(lAmt))
                  : null;

                const lCounterparty = l?.counterparty || l?.raw_data?.counterparty || l?.description || 'N/A';
                const ref = b?.reference_id || l?.reference_id || b?.reference || l?.reference;

                const barColor =
                  confPct >= 90
                    ? 'bg-emerald-500'
                    : confPct >= 65
                    ? 'bg-amber-400'
                    : 'bg-rose-400';

                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelectTransaction(row)}
                    className="cursor-pointer transition-colors hover:bg-slate-50/70 group"
                  >
                    {/* Bank Transaction */}
                    <td className="py-3 px-3 max-w-xs">
                      {b ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[10px] text-slate-400">{b.id || row.bank_tx_id}</span>
                            <span className="font-semibold text-ink group-hover:text-black truncate">
                              {b.description}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>{b.date || '—'}</span>
                            {ref && <span>• Ref: {ref}</span>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">✕ No bank transaction</span>
                      )}
                    </td>

                    {/* Bank Amount */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-sans font-bold text-ink">
                      {bAmt !== undefined && bAmt !== null ? formatCurrency(bAmt, bCurr) : '—'}
                    </td>

                    {/* Matched Ledger Entry */}
                    <td className="py-3 px-3 max-w-xs">
                      {l ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[10px] text-slate-400">{l.id || row.ledger_tx_id}</span>
                            <span className="font-medium text-slate-800 truncate">
                              {lCounterparty}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                            <span>{l.posting_date || l.date || '—'}</span>
                            {l.document_id && <span>• Doc: {l.document_id}</span>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-rose-500 italic text-[11px] font-medium">✕ Missing in ledger</span>
                      )}
                    </td>

                    {/* Ledger Amount */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-sans font-semibold text-slate-600">
                      {lAmt !== undefined && lAmt !== null ? formatCurrency(lAmt, lCurr) : '—'}
                    </td>

                    {/* Variance */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-medium">
                      {variance !== null ? (
                        <span className={variance > 0 ? 'text-amber-700 font-bold' : 'text-slate-500'}>
                          {formatCurrency(variance, bCurr)}
                        </span>
                      ) : (
                        <span className="text-slate-300">N/A</span>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {status === 'UNMATCHED' || status === 'LEDGER_ONLY' ? (
                        <span className="font-mono text-slate-400 text-xs">0.0%</span>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-ink w-9">
                            {confPct}%
                          </span>
                          <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${barColor}`}
                              style={{ width: `${confPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getStatusBadge(status)}
                    </td>

                    {/* Explanation */}
                    <td className="py-3 px-3 max-w-xs truncate text-[11px] text-slate-500" title={row.explanation || row.reasoning}>
                      {row.explanation || row.reasoning || '—'}
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
