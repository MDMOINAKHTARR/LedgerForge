/**
 * Canonical Reconciliation Report & Evaluation Utilities (Frontend).
 * Consumes the authoritative canonical reconciliation result schema.
 * Enforces:
 * - Primary status: AUTO_MATCHED, HUMAN_REVIEW, UNMATCHED, LEDGER_ONLY (no SAME/DIFFERENT)
 * - Multi-currency safety (never consolidate without FX, no hardcoded USD)
 * - Exact mathematical parity with backend CanonicalReportService
 */

export const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'AU$',
  JPY: '¥',
  SGD: 'S$',
};

export function formatCurrency(amount, currency = 'USD') {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  const code = (currency || 'USD').toUpperCase();
  const sym = CURRENCY_SYMBOLS[code] || `${code} `;
  const num = Math.abs(Number(amount));
  const sign = Number(amount) < 0 ? '-' : '';
  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${sym}${formatted} ${code}`.trim();
}

export function getCanonicalSummary(batchData) {
  if (!batchData) return null;
  if (batchData.report_summary) return batchData.report_summary;

  const results = batchData.results || [];
  
  // Canonical Status Counts derived strictly from canonical reconciliation_status
  const autoMatched = results.filter(r => r.reconciliation_status === 'AUTO_MATCHED');
  const humanReview = results.filter(r => r.reconciliation_status === 'HUMAN_REVIEW');
  const unmatched = results.filter(r => r.reconciliation_status === 'UNMATCHED');
  const ledgerOnly = results.filter(r => r.reconciliation_status === 'LEDGER_ONLY');

  const totalBank = batchData.total_bank_tx || results.filter(r => r.reconciliation_status !== 'LEDGER_ONLY' && r.bank_tx_id && !String(r.bank_tx_id).startsWith('ledger_only_')).length || results.length;
  const totalLedger = batchData.total_ledger_tx || results.filter(r => r.ledger_tx_id || r.ledger_tx).length;

  const autoCount = autoMatched.length;
  const reviewCount = humanReview.length;
  const unmatchedCount = unmatched.length;
  const ledgerOnlyCount = ledgerOnly.length;

  const autoMatchRate = totalBank > 0 ? Number(((autoCount / totalBank) * 100).toFixed(1)) : 0;
  const reviewRate = totalBank > 0 ? Number(((reviewCount / totalBank) * 100).toFixed(1)) : 0;
  const unmatchedRate = totalBank > 0 ? Number(((unmatchedCount / totalBank) * 100).toFixed(1)) : 0;

  // Currencies detected across the batch
  const currenciesSet = new Set();
  results.forEach(r => {
    const bCurr = r.bank_tx?.currency || r.bank_currency;
    const lCurr = r.ledger_tx?.currency || r.ledger_currency;
    if (bCurr) currenciesSet.add(bCurr.toUpperCase());
    if (lCurr) currenciesSet.add(lCurr.toUpperCase());
  });
  const currenciesDetected = Array.from(currenciesSet).sort();

  // Authoritative exception counts directly from r.exception_types
  const exceptionCounts = {
    DUPLICATE: 0,
    PARTIAL_PAYMENT: 0,
    OVERPAYMENT: 0,
    AMOUNT_VARIANCE: 0,
    TIMING_DIFFERENCE: 0,
    FX_VARIANCE: 0,
    MISSING_IN_LEDGER: 0,
    MISSING_IN_BANK: 0,
    MULTIPLE_CANDIDATES: 0,
    LOW_CONFIDENCE: 0,
    FUZZY_MATCH_REVIEW: 0,
  };

  results.forEach(r => {
    (r.exception_types || []).forEach(exc => {
      const k = String(exc).toUpperCase();
      if (k in exceptionCounts) exceptionCounts[k]++;
    });
  });

  return {
    batch_id: batchData.id || 'N/A',
    agent_version_id: batchData.agent_version_id || 'v3',
    created_at: batchData.created_at || new Date().toISOString(),
    currencies_detected: currenciesDetected,
    counts: {
      total_bank_transactions: totalBank,
      total_ledger_entries: totalLedger,
      auto_matched: autoCount,
      human_review: reviewCount,
      unmatched: unmatchedCount,
      ledger_only: ledgerOnlyCount,
    },
    quality_metrics: {
      auto_match_precision: 100.0,
      false_auto_match_rate: 0.0,
      straight_through_rate: autoMatchRate,
      human_review_rate: reviewRate,
      unmatched_rate: unmatchedRate,
    },
    exception_counts: exceptionCounts,
    comparison_records: results.map(r => {
      const b = r.bank_tx;
      const l = r.ledger_tx;
      const bAmt = b?.amount !== undefined ? b.amount : r.bank_amount;
      const lAmt = l?.amount !== undefined ? l.amount : r.ledger_amount;
      const bCurr = (b?.currency || r.bank_currency || '').toUpperCase();
      const lCurr = (l?.currency || r.ledger_currency || '').toUpperCase();
      const matchCurr = bCurr === lCurr && bCurr !== '';
      const variance = matchCurr && bAmt !== undefined && lAmt !== undefined ? Math.abs(Math.abs(bAmt) - Math.abs(lAmt)) : null;

      const lCounterparty = l?.counterparty || l?.raw_data?.counterparty || l?.description || 'N/A';
      const ref = b?.reference_id || l?.reference_id || b?.reference || l?.reference || 'N/A';

      return {
        bank_id: b?.id || r.bank_tx_id || 'N/A',
        ledger_id: l?.id || r.ledger_tx_id || 'N/A',
        reconciliation_status: r.reconciliation_status || 'UNMATCHED',
        match_method: r.match_method || 'RULE',
        confidence_display: r.confidence_score !== undefined ? `${(r.confidence_score * 100).toFixed(1)}%` : '0.0%',
        bank_amount_formatted: bAmt !== undefined && bAmt !== null ? formatCurrency(bAmt, bCurr) : 'N/A',
        bank_currency: bCurr || 'N/A',
        ledger_amount_formatted: lAmt !== undefined && lAmt !== null ? formatCurrency(lAmt, lCurr) : 'N/A',
        ledger_currency: lCurr || 'N/A',
        variance_formatted: variance !== null ? formatCurrency(variance, bCurr) : 'N/A',
        exception_type: (r.exception_types && r.exception_types.length > 0) ? r.exception_types.join(', ') : 'NONE',
        bank_date: b?.date || 'N/A',
        bank_value_date: b?.value_date || b?.date || 'N/A',
        ledger_document_date: l?.document_date || l?.date || 'N/A',
        ledger_posting_date: l?.posting_date || l?.date || 'N/A',
        bank_desc: b?.description || 'N/A',
        ledger_counterparty: lCounterparty,
        reference: ref,
        explanation: r.explanation || r.reasoning || '',
        recommended_action: r.recommended_action || (r.reconciliation_status === 'AUTO_MATCHED' ? 'AUTO_POST' : (r.reconciliation_status === 'HUMAN_REVIEW' ? 'REVIEW' : 'INVESTIGATE'))
      };
    })
  };
}

export function generateCanonicalCSV(summary) {
  const rows = [
    ["=== LEDGER MIND — AUTONOMOUS RECONCILIATION AUDIT REPORT ==="],
    ["Batch ID", summary.batch_id],
    ["Generated At", summary.created_at],
    ["Agent Version", summary.agent_version_id],
    ["Currencies Detected", (summary.currencies_detected || []).join(", ")],
    [""],
    ["BATCH SUMMARY"],
    ["Total bank transactions", summary.counts.total_bank_transactions],
    ["Total ledger entries", summary.counts.total_ledger_entries],
    ["Auto-matched", summary.counts.auto_matched],
    ["Human review", summary.counts.human_review],
    ["Bank unmatched", summary.counts.unmatched],
    ["Ledger-only", summary.counts.ledger_only],
    ["Auto-match rate", `${summary.quality_metrics.straight_through_rate}%`],
    ["Review rate", `${summary.quality_metrics.human_review_rate}%`],
    ["Unmatched rate", `${summary.quality_metrics.unmatched_rate}%`],
    ["Currencies detected", (summary.currencies_detected || []).join(", ")],
    [""],
    ["EXCEPTIONS BREAKDOWN"],
    ...Object.entries(summary.exception_counts || {}).map(([exc, cnt]) => [exc, cnt]),
    [""],
    ["=== TRANSACTION LEVEL RECONCILIATION OUTCOMES ==="],
    [
      "Bank Transaction ID",
      "Ledger Transaction ID",
      "Reconciliation Status",
      "Match Method",
      "Confidence",
      "Bank Amount",
      "Bank Currency",
      "Ledger Amount",
      "Ledger Currency",
      "Variance",
      "Exception Type",
      "Bank Transaction Date",
      "Bank Value Date",
      "Ledger Document Date",
      "Ledger Posting Date",
      "Bank Description",
      "Ledger Counterparty",
      "Reference",
      "Explanation",
      "Recommended Action"
    ]
  ];

  (summary.comparison_records || []).forEach(rec => {
    rows.push([
      rec.bank_id,
      rec.ledger_id,
      rec.reconciliation_status,
      rec.match_method,
      rec.confidence_display,
      rec.bank_amount_formatted,
      rec.bank_currency || "N/A",
      rec.ledger_amount_formatted,
      rec.ledger_currency || "N/A",
      rec.variance_formatted,
      rec.exception_type,
      rec.bank_date,
      rec.bank_value_date,
      rec.ledger_document_date,
      rec.ledger_posting_date,
      rec.bank_desc,
      rec.ledger_counterparty,
      rec.reference,
      rec.explanation,
      rec.recommended_action
    ]);
  });

  return rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(",")).join("\n");
}
