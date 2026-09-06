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
    ReconciliationResultSchema, NormalizedTransaction, ActionTaken, MatchType
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
        
        # 3. Reconciliation outcomes
        auto_matched = [r for r in results if r.action_taken == ActionTaken.AUTO_RECONCILE]
        human_review = [r for r in results if r.action_taken == ActionTaken.ESCALATE_TO_HUMAN]
        unmatched = [r for r in results if r.action_taken == ActionTaken.REJECT or r.match_type == MatchType.UNMATCHED]
        
        # Determine ledger-only entries (unconsumed by any auto-match)
        consumed_ledger_ids = {r.ledger_tx_id for r in auto_matched if r.ledger_tx_id}
        review_ledger_ids = {r.ledger_tx_id for r in human_review if r.ledger_tx_id}
        unconsumed_ledger_txs = [
            l for l in ledger_txs if l.id not in consumed_ledger_ids and l.id not in review_ledger_ids
        ]
        
        total_bank = len(bank_txs)
        total_ledger = len(ledger_txs)
        auto_count = len(auto_matched)
        review_count = len(human_review)
        unmatched_count = len(unmatched)
        ledger_only_count = len(unconsumed_ledger_txs)
        
        # 4. Confidence statistics: strictly separated by category
        matched_results = auto_matched + human_review
        avg_conf_matched = (sum(r.confidence_score for r in matched_results) / len(matched_results)) if matched_results else 0.0
        avg_conf_auto = (sum(r.confidence_score for r in auto_matched) / auto_count) if auto_count else 0.0
        avg_conf_review = (sum(r.confidence_score for r in human_review) / review_count) if review_count else 0.0
        
        # 5. Quality Metrics & False Auto-Match Rate (Critical Safety Metric)
        # Verify if any auto-matched item had material amount variance or duplicate or unallowed exception
        false_auto_matches = []
        for r in auto_matched:
            b_amt = r.bank_tx.normalized_amount if r.bank_tx else 0.0
            l_amt = r.ledger_tx.normalized_amount if r.ledger_tx else 0.0
            if abs(b_amt - l_amt) > 0.05:
                false_auto_matches.append(r)
            elif r.match_type in [MatchType.DUPLICATE, MatchType.PARTIAL_PAYMENT, MatchType.AMOUNT_VARIANCE]:
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
        
        # 7. Exception Taxonomy counts
        exception_counts: Dict[str, int] = {
            "DUPLICATE": 0,
            "PARTIAL_PAYMENT": 0,
            "OVERPAYMENT": 0,
            "AMOUNT_VARIANCE": 0,
            "TIMING_DIFFERENCE": 0,
            "FX_VARIANCE": 0,
            "MISSING_IN_LEDGER": 0,
            "MISSING_IN_BANK": ledger_only_count,
            "MULTIPLE_CANDIDATES": 0,
            "LOW_CONFIDENCE": 0
        }
        
        for r in results:
            m_val = r.match_type.value if hasattr(r.match_type, "value") else str(r.match_type)
            if m_val in exception_counts:
                exception_counts[m_val] += 1
            elif m_val == "UNMATCHED":
                exception_counts["MISSING_IN_LEDGER"] += 1
                
        # 8. Detailed Comparison Analysis: Identical Source vs Reconciled vs Review vs Unmatched
        comparison_records = []
        for r in results:
            b = r.bank_tx
            l = r.ledger_tx
            is_auto = r.action_taken == ActionTaken.AUTO_RECONCILE
            is_review = r.action_taken == ActionTaken.ESCALATE_TO_HUMAN
            is_unmatched = r.action_taken == ActionTaken.REJECT or not l
            
            curr = b.currency if (b and b.currency) else (l.currency if (l and l.currency) else None)
            b_amt = b.amount if b else 0.0
            l_amt = l.amount if l else 0.0
            amt_diff = abs(b.normalized_amount - l.normalized_amount) if (b and l) else abs(b_amt or l_amt)
            
            # Semantic Classification
            if is_auto and amt_diff < 0.01 and b.date == (l.effective_settlement_date if l else ""):
                cat = "IDENTICAL_SOURCE_MATCH"
                cat_label = "SAME (IDENTICAL MATCH)"
                badge_color = "emerald"
            elif is_auto:
                cat = "RECONCILED_MATCH"
                cat_label = "RECONCILED (AUTO MATCH)"
                badge_color = "teal"
            elif is_review:
                cat = "REVIEW_REQUIRED"
                cat_label = f"REVIEW ({r.match_type.value})"
                badge_color = "amber"
            else:
                cat = "UNMATCHED"
                cat_label = "UNMATCHED (MISSING IN LEDGER)"
                badge_color = "rose"
                
            comparison_records.append({
                "result_id": r.id,
                "bank_id": b.id if b else "N/A",
                "ledger_id": l.id if l else "N/A",
                "category": cat,
                "category_label": cat_label,
                "badge_color": badge_color,
                "bank_date": b.date if b else "N/A",
                "bank_desc": b.description if b else "N/A",
                "bank_amount": b_amt,
                "bank_currency": b.currency if b else None,
                "bank_amount_formatted": format_currency(b_amt, b.currency) if b else "N/A",
                "ledger_date": l.effective_settlement_date if l else "N/A",
                "ledger_desc": l.description if l else "N/A",
                "ledger_amount": l_amt,
                "ledger_currency": l.currency if l else None,
                "ledger_amount_formatted": format_currency(l_amt, l.currency) if l else "N/A",
                "variance": amt_diff,
                "variance_formatted": format_currency(amt_diff, curr),
                "confidence": r.confidence_score if not is_unmatched else 0.0,
                "confidence_display": f"{round(r.confidence_score * 100, 1)}%" if not is_unmatched else "N/A",
                "reasoning": r.reasoning,
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
            ["Bank Transactions", summary["counts"]["total_bank_transactions"]],
            ["Ledger Entries", summary["counts"]["total_ledger_entries"]],
            ["Auto-Reconciled", summary["counts"]["auto_matched"]],
            ["Human Review", summary["counts"]["human_review"]],
            ["Unmatched", summary["counts"]["unmatched"]],
            ["Ledger-Only Entries", summary["counts"]["ledger_only"]],
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
            rows.append(["Net Variance", data["variance_formatted"]])
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
            "Reconciliation Status", "Category", "Bank ID", "Bank Date", "Bank Description",
            "Bank Amount", "Ledger ID", "Ledger Date", "Ledger Description", "Ledger Amount",
            "Variance", "Confidence", "Reasoning"
        ])
        
        for rec in summary["comparison_records"]:
            rows.append([
                rec["category_label"],
                rec["category"],
                rec["bank_id"],
                rec["bank_date"],
                rec["bank_desc"],
                rec["bank_amount_formatted"],
                rec["ledger_id"],
                rec["ledger_date"],
                rec["ledger_desc"],
                rec["ledger_amount_formatted"],
                rec["variance_formatted"],
                rec["confidence_display"],
                rec["reasoning"]
            ])
            
        return "\n".join([",".join([f'"{str(c).replace(chr(34), chr(34)+chr(34))}"' for c in r]) for r in rows])
