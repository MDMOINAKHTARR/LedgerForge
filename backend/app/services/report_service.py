"""
Canonical Reconciliation Report & Evaluation Service.
Consumes the canonical reconciliation result object and produces data-driven reports,
multi-currency breakdowns, quality metrics, and CSV export.
Enforces Section 4, 5, 6, 7, 8, 13, 14, 18 of master specification:
- Never consolidate across different currencies without verified FX conversion rates.
- No global "$" or "USD" fallbacks.
- Unmatched transactions have 0.0 match confidence and are not labeled low-confidence matches.
- Clear semantic categorization: IDENTICAL_SOURCE_MATCH, RECONCILED_MATCH, REVIEW_REQUIRED, UNMATCHED, LEDGER_ONLY.
- Explainable quality metrics centered on False Auto-Match Rate (0.0%) and Auto-Match Precision (100.0%).
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.app.models.pydantic_models import (
    ReconciliationResultSchema, NormalizedTransaction, ActionTaken, MatchType, ReconciliationStatus
)
from backend.app.core.currency import format_currency, get_currency_symbol

class CanonicalReportService:

    @staticmethod
    def generate_canonical_summary(
        batch_id: str,
        bank_txs: List[NormalizedTransaction],
        ledger_txs: List[NormalizedTransaction],
        results: List[ReconciliationResultSchema],
        agent_version_id: str = "v3",
        created_at: Optional[str] = None
    ) -> Dict[str, Any]:
        
        # 1. Period dynamically derived from real transaction dates
        dates = [tx.date for tx in bank_txs if tx.date]
        period_from = min(dates) if dates else "N/A"
        period_to = max(dates) if dates else "N/A"
        
        # 2. Currencies detected across the batch
        currencies = sorted(list({tx.currency.upper() for tx in bank_txs + ledger_txs if tx.currency}))

        # Ensure all canonical fields are synced before computing any counts.
        # The matching engine sets status/exception_types directly; sync_canonical_fields
        # fills in any remaining fields (e.g. amounts, dates) and acts as a fallback
        # for results arriving from DB reconstruction.
        for r in results:
            r.sync_canonical_fields()
        
        # 3. Reconciliation outcomes — split by canonical reconciliation_status (not action_taken).
        # This correctly separates LEDGER_ONLY records from UNMATCHED bank transactions.
        auto_matched  = [r for r in results if r.reconciliation_status == ReconciliationStatus.AUTO_MATCHED]
        human_review  = [r for r in results if r.reconciliation_status == ReconciliationStatus.HUMAN_REVIEW]
        unmatched     = [r for r in results if r.reconciliation_status == ReconciliationStatus.UNMATCHED]
        ledger_only_r = [r for r in results if r.reconciliation_status == ReconciliationStatus.LEDGER_ONLY]
        
        total_bank = len(bank_txs)
        total_ledger = len(ledger_txs)
        auto_count = len(auto_matched)
        review_count = len(human_review)
        unmatched_count = len(unmatched)
        ledger_only_count = len(ledger_only_r)
        
        # 4. Confidence statistics: strictly separated by category
        matched_results = auto_matched + human_review
        avg_conf_matched = (sum(r.confidence_score for r in matched_results) / len(matched_results)) if matched_results else 0.0
        avg_conf_auto = (sum(r.confidence_score for r in auto_matched) / auto_count) if auto_count else 0.0
        avg_conf_review = (sum(r.confidence_score for r in human_review) / review_count) if review_count else 0.0
        
        # 5. Quality Metrics & False Auto-Match Rate (Critical Safety Metric)
        # Verify if any auto-matched item had material amount variance or duplicate or unallowed exception
        false_auto_matches = []
        for r in auto_matched:
            b_tx = r.bank_tx
            l_tx = r.ledger_tx
            b_amt = b_tx.normalized_amount if b_tx else 0.0
            l_amt = l_tx.normalized_amount if l_tx else 0.0
            b_curr = b_tx.currency.upper() if b_tx and b_tx.currency else None
            l_curr = l_tx.currency.upper() if l_tx and l_tx.currency else None
            # Compare amounts only when currencies match
            if b_curr and l_curr and b_curr == l_curr:
                if abs(b_amt - l_amt) > 0.05:
                    false_auto_matches.append(r)
            # Exception‑based false‑auto‑match detection
            if r.match_type in [MatchType.DUPLICATE, MatchType.PARTIAL_PAYMENT, MatchType.AMOUNT_VARIANCE]:
                false_auto_matches.append(r)
                
        false_auto_match_rate = len(false_auto_matches) / max(1, auto_count)
        auto_match_precision = 1.0 - false_auto_match_rate
        stp_rate = auto_count / max(1, total_bank)
        review_rate = review_count / max(1, total_bank)
        unmatched_rate = unmatched_count / max(1, total_bank)
        
        # Health rating calculation: Prioritizes accuracy and safety over brute STP percentage
        if false_auto_match_rate == 0.0 and auto_match_precision == 1.0:
            health_grade = "A+"
            health_assessment = "PERFECT SAFETY: 0.0% false auto-post rate with 100% precision on all automated entries."
        elif false_auto_match_rate < 0.02:
            health_grade = "A"
            health_assessment = "HIGH SAFETY: Minor edge cases flagged; false match risk well within regulatory threshold."
        elif false_auto_match_rate < 0.05:
            health_grade = "B"
            health_assessment = "MODERATE: Human review queue active, policy thresholds working as intended."
        else:
            health_grade = "D"
            health_assessment = "ELEVATED RISK: Elevated false auto-matches detected. Stricter threshold required."

        # 6. Currency-aware summaries (Never consolidate across different currencies without FX)
        currency_summaries: Dict[str, Dict[str, Any]] = {}
        for curr in currencies:
            curr_bank = [tx for tx in bank_txs if tx.currency.upper() == curr]
            curr_ledger = [tx for tx in ledger_txs if tx.currency.upper() == curr]
            
            b_vol = sum(tx.normalized_amount for tx in curr_bank)
            l_vol = sum(tx.normalized_amount for tx in curr_ledger)
            variance = abs(b_vol - l_vol)
            
            currency_summaries[curr] = {
                "currency": curr,
                "symbol": get_currency_symbol(curr),
                "bank_transaction_count": len(curr_bank),
                "ledger_transaction_count": len(curr_ledger),
                "bank_volume": round(b_vol, 2),
                "ledger_volume": round(l_vol, 2),
                "variance": round(variance, 2),
                "bank_volume_formatted": format_currency(b_vol, curr),
                "ledger_volume_formatted": format_currency(l_vol, curr),
                "variance_formatted": format_currency(variance, curr)
            }
            
        cross_currency_consolidated = len(currencies) == 1
        cross_currency_note = (
            "Single currency batch" if cross_currency_consolidated
            else "Cross-currency variance not consolidated because no FX rate was provided."
        )
        
        # 7. Exception Taxonomy counts — read directly from r.exception_types (authoritative).
        # Never re-map from r.match_type; the matching engine sets exception_types at the source.
        exception_counts: Dict[str, int] = {
            "DUPLICATE": 0,
            "PARTIAL_PAYMENT": 0,
            "OVERPAYMENT": 0,
            "AMOUNT_VARIANCE": 0,
            "TIMING_DIFFERENCE": 0,
            "FX_VARIANCE": 0,
            "MISSING_IN_LEDGER": 0,
            "MISSING_IN_BANK": 0,
            "MULTIPLE_CANDIDATES": 0,
            "LOW_CONFIDENCE": 0,
            "FUZZY_MATCH_REVIEW": 0,
        }
        
        for r in results:
            for exc in (r.exception_types or []):
                exc_key = exc.upper() if isinstance(exc, str) else str(exc)
                if exc_key in exception_counts:
                    exception_counts[exc_key] += 1
                
        # 8. Detailed Comparison Analysis: Identical Source vs Reconciled vs Review vs Unmatched vs Ledger-Only
        comparison_records = []
        for r in results:
            # sync_canonical_fields already called above — no second call needed
            b = r.bank_tx
            l = r.ledger_tx
            is_auto     = r.reconciliation_status == ReconciliationStatus.AUTO_MATCHED
            is_review   = r.reconciliation_status == ReconciliationStatus.HUMAN_REVIEW
            is_ledger_only = r.reconciliation_status == ReconciliationStatus.LEDGER_ONLY
            # is_unmatched: bank has no ledger match (NOT ledger-only records)
            is_unmatched = r.reconciliation_status in (ReconciliationStatus.UNMATCHED, ReconciliationStatus.LEDGER_ONLY)
            
            # Determine currencies safely and compute variance only when they match
            b_curr = b.currency.upper() if (b and b.currency) else None
            l_curr = l.currency.upper() if (l and l.currency) else None
            curr = b_curr if b_curr else l_curr
            b_amt = b.amount if b else 0.0
            l_amt = l.amount if l else 0.0
            if b_curr and l_curr and b_curr == l_curr:
                amt_diff = abs(b.normalized_amount - l.normalized_amount) if (b and l) else abs(b_amt - l_amt)
            else:
                amt_diff = None
            
            # Primary outcome category is the authoritative canonical reconciliation_status
            recon_status_str = r.reconciliation_status.value if hasattr(r.reconciliation_status, "value") else str(r.reconciliation_status)
            badge_map = {
                "AUTO_MATCHED": "emerald",
                "HUMAN_REVIEW": "amber",
                "UNMATCHED": "rose",
                "LEDGER_ONLY": "purple"
            }
            badge_color = badge_map.get(recon_status_str, "slate")
            cat = recon_status_str
            cat_label = recon_status_str

            # Extract counterparty and reference
            l_counterparty = "N/A"
            if l:
                l_counterparty = getattr(l, "counterparty", None) or (l.raw_data.get("counterparty") if (l.raw_data and "counterparty" in l.raw_data) else None) or (l.description if l.description else "N/A")
            
            ref = "N/A"
            if b and b.reference_id:
                ref = b.reference_id
            elif l and l.reference_id:
                ref = l.reference_id

            exc_type_str = ", ".join(r.exception_types) if r.exception_types else "NONE"
            rec_action = r.recommended_action or ("AUTO_POST" if recon_status_str == "AUTO_MATCHED" else ("REVIEW" if recon_status_str == "HUMAN_REVIEW" else "INVESTIGATE"))
                
            comparison_records.append({
                "result_id": r.id,
                "bank_id": b.id if b else "N/A",
                "bank_transaction_id": b.id if b else "N/A",
                "ledger_id": l.id if l else "N/A",
                "ledger_transaction_id": l.id if l else "N/A",
                "reconciliation_status": recon_status_str,
                "match_method": r.match_method or "RULE",
                "confidence": r.confidence if r.confidence is not None else r.confidence_score,
                "confidence_display": f"{round((r.confidence if r.confidence is not None else r.confidence_score) * 100, 1)}%" if recon_status_str in ["AUTO_MATCHED", "HUMAN_REVIEW"] else "0.0%",
                "exception_type": exc_type_str,
                "exception_types": r.exception_types or [],
                "recommended_action": rec_action,
                "category": cat,
                "category_label": cat_label,
                "badge_color": badge_color,
                "bank_date": b.date if b else "N/A",
                "bank_value_date": b.value_date if (b and b.value_date) else "N/A",
                "bank_desc": b.description if b else "N/A",
                "bank_amount": b_amt if b else None,
                "bank_currency": b.currency if b else None,
                "bank_amount_formatted": format_currency(b_amt, b.currency) if b else "N/A",
                "ledger_document_date": l.document_date if (l and l.document_date) else "N/A",
                "ledger_posting_date": l.posting_date if (l and l.posting_date) else "N/A",
                "ledger_date": l.effective_settlement_date if l else "N/A",
                "ledger_desc": l.description if l else "N/A",
                "ledger_counterparty": l_counterparty,
                "reference": ref,
                "ledger_amount": l_amt if l else None,
                "ledger_currency": l.currency if l else None,
                "ledger_amount_formatted": format_currency(l_amt, l.currency) if l else "N/A",
                "variance": amt_diff,
                "variance_formatted": format_currency(amt_diff, curr) if amt_diff is not None else "N/A",
                "reasoning": r.explanation or r.reasoning,
                "explanation": r.explanation or r.reasoning,
                "relevant_dates": r.relevant_dates,
                "stop_reason_details": getattr(r, "stop_reason_details", None),
                "evidence": r.evidence or []
            })

        return {
            "batch_id": batch_id,
            "agent_version_id": agent_version_id,
            "created_at": created_at or datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "period": {"from": period_from, "to": period_to},
            "currencies_detected": currencies,
            "counts": {
                "total_bank_transactions": total_bank,
                "total_ledger_entries": total_ledger,
                "auto_matched": auto_count,
                "human_review": review_count,
                "unmatched": unmatched_count,
                "ledger_only": ledger_only_count
            },
            "quality_metrics": {
                "auto_match_precision": round(auto_match_precision * 100, 2),
                "false_auto_match_rate": round(false_auto_match_rate * 100, 2),
                "straight_through_rate": round(stp_rate * 100, 2),
                "human_review_rate": round(review_rate * 100, 2),
                "unmatched_rate": round(unmatched_rate * 100, 2),
                "avg_confidence_matched": round(avg_conf_matched * 100, 1),
                "avg_confidence_auto_matched": round(avg_conf_auto * 100, 1),
                "avg_confidence_human_review": round(avg_conf_review * 100, 1),
                "health_grade": health_grade,
                "health_assessment": health_assessment
            },
            "currency_summaries": currency_summaries,
            "cross_currency_consolidated": cross_currency_consolidated,
            "cross_currency_note": cross_currency_note,
            "exception_counts": exception_counts,
            "comparison_records": comparison_records,
            "high_risk_auto_matches": false_auto_matches
        }

    @staticmethod
    def generate_csv_report(summary: Dict[str, Any]) -> str:
        """Generates machine and audit-ready CSV conforming strictly to Section 4, 13, 14 & 20."""
        rows = [
            ["=== LEDGER MIND — AUTONOMOUS RECONCILIATION AUDIT REPORT ==="],
            ["Batch ID", summary["batch_id"]],
            ["Generated At", summary["created_at"]],
            ["Agent Version", summary["agent_version_id"]],
            ["Period", f"{summary['period']['from']} to {summary['period']['to']}"],
            ["Currencies Detected", ", ".join(summary["currencies_detected"])],
            [""],
            ["BATCH SUMMARY"],
            ["Total bank transactions", summary["counts"]["total_bank_transactions"]],
            ["Total ledger entries", summary["counts"]["total_ledger_entries"]],
            ["Auto-matched", summary["counts"]["auto_matched"]],
            ["Human review", summary["counts"]["human_review"]],
            ["Bank unmatched", summary["counts"]["unmatched"]],
            ["Ledger-only", summary["counts"]["ledger_only"]],
            ["Auto-match rate", f"{summary['quality_metrics']['straight_through_rate']}%"],
            ["Review rate", f"{summary['quality_metrics']['human_review_rate']}%"],
            ["Unmatched rate", f"{summary['quality_metrics']['unmatched_rate']}%"],
            ["Currencies detected", ", ".join(summary["currencies_detected"])],
            [""],
            ["QUALITY & SAFETY METRICS"],
            ["Auto-Match Precision", f"{summary['quality_metrics']['auto_match_precision']}%"],
            ["False Auto-Match Rate", f"{summary['quality_metrics']['false_auto_match_rate']}%"],
            ["Straight-Through Rate (STP)", f"{summary['quality_metrics']['straight_through_rate']}%"],
            ["Human Review Escalation Rate", f"{summary['quality_metrics']['human_review_rate']}%"],
            ["Unmatched Rate", f"{summary['quality_metrics']['unmatched_rate']}%"],
            ["Average Confidence (Matched Items)", f"{summary['quality_metrics']['avg_confidence_matched']}%"],
            ["Average Confidence (Auto Matches)", f"{summary['quality_metrics']['avg_confidence_auto_matched']}%"],
            ["Average Confidence (Human Reviews)", f"{summary['quality_metrics']['avg_confidence_human_review']}%"],
            ["Safety Grade", f"{summary['quality_metrics']['health_grade']} ({summary['quality_metrics']['health_assessment']})"],
            [""],
            ["CURRENCY BREAKDOWN (Strictly Unconsolidated Without FX)"]
        ]
        
        for curr, data in summary["currency_summaries"].items():
            rows.append([f"--- Currency: {curr} ---"])
            rows.append(["Bank Volume", data["bank_volume_formatted"]])
            rows.append(["Ledger Volume", data["ledger_volume_formatted"]])
            rows.append(["Variance", data["variance_formatted"]])
            rows.append([])
            
        if not summary["cross_currency_consolidated"]:
            rows.append(["Cross-Currency Consolidation Status", summary["cross_currency_note"]])
            rows.append([])
            
        rows.append(["EXCEPTIONS BREAKDOWN"])
        for exc, cnt in summary["exception_counts"].items():
            rows.append([exc, cnt])
        rows.append([])
        
        rows.append(["=== TRANSACTION LEVEL RECONCILIATION OUTCOMES ==="])
        rows.append([
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
        ])
        
        for rec in summary["comparison_records"]:
            rows.append([
                rec["bank_id"],
                rec["ledger_id"],
                rec["reconciliation_status"],
                rec["match_method"],
                rec["confidence_display"],
                rec["bank_amount_formatted"] if rec["bank_id"] != "N/A" else "N/A",
                rec["bank_currency"] or "N/A",
                rec["ledger_amount_formatted"] if rec["ledger_id"] != "N/A" else "N/A",
                rec["ledger_currency"] or "N/A",
                rec["variance_formatted"],
                rec["exception_type"],
                rec["bank_date"],
                rec["bank_value_date"],
                rec["ledger_document_date"],
                rec["ledger_posting_date"],
                rec["bank_desc"],
                rec["ledger_counterparty"],
                rec["reference"],
                rec["explanation"],
                rec["recommended_action"]
            ])
            
        return "\n".join([",".join([f'"{str(c).replace(chr(34), chr(34)+chr(34))}"' for c in r]) for r in rows])
