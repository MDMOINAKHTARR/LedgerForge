import React, { useState } from 'react';
import { CheckCircle2, ShieldAlert, XCircle, Clock, Eye, Search, Filter, ArrowUpRight } from 'lucide-react';

export function TransactionTable({ results, onSelectException }) {
  if (!results || results.length === 0) return null;

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const getStatus = (r) => {
    if (r.human_status && r.human_status !== 'PENDING' && r.human_status !== 'NONE') {
      return 'REVIEWED';
    }
    if (r.action_taken === 'AUTO_RECONCILE') return 'AUTO-RECONCILED';
    if (r.action_taken === 'ESCALATE_TO_HUMAN') return 'ESCALATED';
    return 'UNMATCHED';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'AUTO-RECONCILED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>AUTO-RECONCILED</span>
          </span>
        );
      case 'ESCALATED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse-subtle">
            <ShieldAlert className="w-3 h-3" />
            <span>ESCALATED</span>
          </span>
        );
      case 'REVIEWED':
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Clock className="w-3 h-3" />
            <span>REVIEWED</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            <span>UNMATCHED</span>
          </span>
        );
    }
  };

  const getExceptionBadge = (matchType) => {
    const map = {
      EXACT: { label: 'Exact Match', style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
      TIMING_DIFFERENCE: { label: 'Timing Mismatch', style: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
      BANK_FEE: { label: 'Bank Fee', style: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
      FX_VARIANCE: { label: 'FX Variance', style: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
      FUZZY: { label: 'Memo Mismatch', style: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
      DUPLICATE: { label: 'Duplicate Entry', style: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
      PARTIAL_PAYMENT: { label: 'Partial Payment', style: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
      MISSING_INVOICE: { label: 'Missing Invoice', style: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
      AMOUNT_DISCREPANCY: { label: 'Amount Discrepancy', style: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
      UNMATCHED: { label: 'Unmatched', style: 'text-slate-400 bg-slate-800 border-slate-700' }
    };
    const item = map[matchType] || map.UNMATCHED;
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${item.style}`}>
        {item.label}
      </span>
    );
  };

  const filteredResults = results.filter((r) => {
    const status = getStatus(r);
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const desc = r.bank_tx?.description?.toLowerCase() || '';
      const ref = r.bank_tx?.reference_id?.toLowerCase() || '';
      const lDesc = r.ledger_tx?.description?.toLowerCase() || '';
      if (!desc.includes(q) && !ref.includes(q) && !lDesc.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
      
      {/* Header & Filter Controls */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Reconciliation Transaction Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any row to inspect candidate evidence, decision rationale, and 7-stage audit execution trace.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search description, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-slate-700 w-44 sm:w-56"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            {['ALL', 'AUTO-RECONCILED', 'ESCALATED', 'UNMATCHED', 'REVIEWED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 rounded font-mono font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Bank Transaction</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Matched Ledger Entry</th>
              <th className="py-3 px-4 text-center">Confidence</th>
              <th className="py-3 px-4">Exception</th>
              <th className="py-3 px-4">Decision</th>
              <th className="py-3 px-4 text-center">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {filteredResults.map((res) => {
              const b = res.bank_tx;
              const l = res.ledger_tx;
              const status = getStatus(res);
              const confPct = Math.round(res.confidence_score * 100);

              return (
                <tr
                  key={res.id}
                  onClick={() => onSelectException(res)}
                  className="hover:bg-slate-900/70 cursor-pointer transition-colors group"
                >
                  {/* Status */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {getStatusBadge(status)}
                  </td>

                  {/* Bank Transaction */}
                  <td className="py-3 px-4 max-w-xs">
                    <div className="font-semibold text-slate-100 group-hover:text-emerald-300 transition-colors">
                      {b?.description || 'Bank Record'}
                    </div>
                    {b?.reference_id && (
                      <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                        Ref: {b.reference_id}
                      </span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="py-3 px-4 text-right whitespace-nowrap font-mono font-bold text-slate-100">
                    {(() => {
                      const curr = b?.currency || '';
                      const sym = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[curr.toUpperCase()] || (curr ? `${curr} ` : '');
                      const sign = (b?.amount || 0) < 0 ? '-' : '';
                      return (
                        <>
                          {sign}{sym}{b?.amount !== undefined ? Math.abs(b.amount).toFixed(2) : '0.00'}{' '}
                          <span className="text-[10px] text-slate-400">{curr}</span>
                        </>
                      );
                    })()}
                  </td>

                  {/* Date */}
                  <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400">
                    {b?.date || '—'}
                  </td>

                  {/* Matched Ledger Entry */}
                  <td className="py-3 px-4 max-w-xs">
                    {l ? (
                      <div>
                        <div className="font-medium text-slate-200 truncate">{l.description}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {(() => {
                            const curr = l?.currency || b?.currency || '';
                            const sym = { INR: '₹', USD: '$', EUR: '€', GBP: '£' }[curr.toUpperCase()] || (curr ? `${curr} ` : '');
                            const sign = (l?.amount || 0) < 0 ? '-' : '';
                            return `${sign}${sym}${l?.amount !== undefined ? Math.abs(l.amount).toFixed(2) : '0.00'} ${curr} • ${l.date || ''}`;
                          })()}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-[11px]">No match identified</span>
                    )}
                  </td>

                  {/* Confidence */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <div className="inline-flex flex-col items-center">
                      <span className={`font-mono font-bold text-xs ${
                        confPct >= 90 ? 'text-emerald-400' : confPct >= 75 ? 'text-amber-400' : 'text-rose-400'
                      }`}>
                        {confPct}%
                      </span>
                      <div className="w-14 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            confPct >= 90 ? 'bg-emerald-500' : confPct >= 75 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${confPct}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Exception */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    {getExceptionBadge(res.match_type)}
                  </td>

                  {/* Decision */}
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                      res.action_taken === 'AUTO_RECONCILE'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : res.action_taken === 'ESCALATE_TO_HUMAN'
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                    }`}>
                      {res.action_taken === 'ESCALATE_TO_HUMAN' ? 'ESCALATE' : res.action_taken}
                    </span>
                  </td>

                  {/* Inspect Button */}
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <button
                      className="p-1.5 rounded bg-slate-900 group-hover:bg-slate-800 text-slate-400 group-hover:text-white border border-slate-800 transition-colors"
                      title="Inspect Decision Details"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-slate-800 bg-slate-950 text-[11px] font-mono text-slate-400 flex items-center justify-between">
        <span>Showing {filteredResults.length} of {results.length} transactions</span>
        <span>Filtered by Status: {statusFilter}</span>
      </div>

    </div>
  );
}
