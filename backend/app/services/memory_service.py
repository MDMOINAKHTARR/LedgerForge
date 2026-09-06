"""
Controlled Reconciliation Memory Service for LedgerForge.
Retrieves historically resolved human reconciliation decisions as ADVISORY evidence.

Guiding Principles:
1. Advisory Only: Historical memory NEVER overrides existing safety policies or automatically triggers auto-reconciliation.
2. Strict Currency Boundary: Cases in different currencies (e.g. INR vs USD) are never mixed.
3. Deterministic & Explainable: No LLMs, embeddings, or black-box models.
4. Trust & Consistency Mechanism: Single examples provide weak evidence; repeated consistent decisions strengthen trust; conflicting decisions are surfaced explicitly.
"""

import re
from collections import Counter
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.models.pydantic_models import (
    MemoryContext,
    HistoricalMemoryEntry,
    MemoryRetrievalResult,
    MemoryTrustLevel,
    DecisionMemoryContext,
    ResolutionType,
)
from backend.app.models.db import (
    DBReconciliationFeedback,
    DBReconciliationResult,
    DBTransaction,
)


STOP_WORDS = {"THE", "AND", "FOR", "INC", "CORP", "LTD", "LLC", "CO", "TRANSFER", "PAYMENT", "WIRE", "TRF"}


def _tokenize(text: Optional[str]) -> set:
    if not text:
        return set()
    cleaned = re.sub(r"[^A-Za-z0-9\s]", " ", str(text).upper())
    tokens = {t for t in cleaned.split() if len(t) >= 3 and t not in STOP_WORDS}
    return tokens


class ReconciliationMemoryService:
    """
    Deterministic memory retrieval service that surfaces validated historical
    human decisions to assist accountants with exception review.
    """

    @staticmethod
    def calculate_similarity(
        context: MemoryContext,
        feedback: DBReconciliationFeedback,
        historical_bank_tx: Optional[DBTransaction] = None
    ) -> Tuple[float, List[str]]:
        """
        Computes deterministic similarity score between the current exception context
        and a historical feedback record within the same currency.
        """
        score = 0.0
        signals = []

        # 1. Strict Currency Boundary Check
        ctx_curr = (context.currency or "").strip().upper()
        fb_curr = (feedback.currency or "").strip().upper()
        if not ctx_curr or not fb_curr or ctx_curr != fb_curr:
            return 0.0, []

        signals.append(f"matching_currency_{ctx_curr}")

        # 2. Exception Category Signal (Weight: up to 0.25)
        ctx_cat = (context.exception_category or "").strip().upper()
        fb_cat = (feedback.relevant_exception_category or "").strip().upper()
        if ctx_cat and fb_cat:
            if ctx_cat == fb_cat:
                score += 0.25
                signals.append(f"exact_exception_category_{ctx_cat}")
            else:
                # Check for category semantic overlap (e.g. TIMING, AMOUNT, FEE, PARTIAL, DUPLICATE)
                keywords = ["TIMING", "AMOUNT", "VARIANCE", "FEE", "PARTIAL", "DUPLICATE", "CURRENCY", "FX"]
                for kw in keywords:
                    if kw in ctx_cat and kw in fb_cat:
                        score += 0.15
                        signals.append(f"related_exception_category_{kw}")
                        break

        # 3. Reference, Counterparty, or Description Text Overlap (Weight: up to 0.40)
        ctx_tokens = _tokenize(context.description) | _tokenize(context.counterparty) | _tokenize(context.reference)
        
        hist_text_parts = [feedback.human_notes or ""]
        if historical_bank_tx:
            hist_text_parts.append(historical_bank_tx.description or "")
            hist_text_parts.append(historical_bank_tx.reference_id or "")

        hist_tokens = set()
        for part in hist_text_parts:
            hist_tokens |= _tokenize(part)

        # Check reference match first
        if context.reference and historical_bank_tx and historical_bank_tx.reference_id:
            ctx_ref_clean = re.sub(r"[^A-Za-z0-9]", "", context.reference.upper())
            hist_ref_clean = re.sub(r"[^A-Za-z0-9]", "", historical_bank_tx.reference_id.upper())
            if ctx_ref_clean and hist_ref_clean and (ctx_ref_clean == hist_ref_clean or ctx_ref_clean in hist_ref_clean or hist_ref_clean in ctx_ref_clean):
                score += 0.40
                signals.append("exact_or_substring_reference_match")
            elif ctx_tokens and hist_tokens:
                overlap = ctx_tokens & hist_tokens
                if overlap:
                    score += min(0.35, 0.15 * len(overlap))
                    signals.append(f"text_overlap_{list(overlap)[:3]}")
        elif ctx_tokens and hist_tokens:
            overlap = ctx_tokens & hist_tokens
            if overlap:
                score += min(0.35, 0.15 * len(overlap))
                signals.append(f"text_overlap_{list(overlap)[:3]}")

        # 4. Amount Proximity Signal (Weight: up to 0.25)
        if context.amount is not None and feedback.amount is not None and context.amount > 0:
            amt_diff_pct = abs(feedback.amount - context.amount) / context.amount
            if amt_diff_pct <= 0.05:
                score += 0.25
                signals.append("amount_within_5_percent")
            elif amt_diff_pct <= 0.20:
                score += 0.15
                signals.append("amount_within_20_percent")

        # 5. Direction Signal (Weight: up to 0.10)
        if context.direction and historical_bank_tx:
            hist_amt = historical_bank_tx.amount or 0.0
            hist_direction = "CREDIT" if hist_amt > 0 else "DEBIT"
            if context.direction.upper() == hist_direction:
                score += 0.10
                signals.append("matching_transaction_direction")

        return round(min(score, 1.0), 3), signals

    @classmethod
    def retrieve_relevant_feedback(
        cls,
        context: MemoryContext,
        db: Session,
        limit: int = 5,
        min_similarity: float = 0.40,
        exclude_result_id: Optional[str] = None
    ) -> MemoryRetrievalResult:
        """
        Retrieves top historically matching human feedback cases within the same currency.
        Aggregates results to determine trust level and surface any resolution conflicts.
        """
        req_curr = (context.currency or "").strip().upper()
        if not req_curr:
            return MemoryRetrievalResult(
                query_currency="",
                query_exception_category=context.exception_category,
                total_candidates_found=0,
                matches=[],
                predominant_resolution=None,
                consistency_score=0.0,
                trust_level=MemoryTrustLevel.NONE,
                has_conflict=False,
                conflict_details=None,
                advisory_evidence=["[HISTORICAL MEMORY] No currency specified; memory search bypassed."]
            )

        # 1. Query database feedback filtered strictly by currency
        query = db.query(DBReconciliationFeedback).filter(
            func.upper(DBReconciliationFeedback.currency) == req_curr
        )
        if exclude_result_id:
            query = query.filter(DBReconciliationFeedback.reconciliation_result_id != exclude_result_id)

        all_feedback = query.all()
        matched_entries: List[HistoricalMemoryEntry] = []

        # 2. Score similarity for each candidate
        for fb in all_feedback:
            # Lookup historical bank transaction if available
            hist_tx = None
            if fb.bank_transaction_id:
                hist_tx = db.query(DBTransaction).filter(
                    (DBTransaction.id == fb.bank_transaction_id) |
                    ((DBTransaction.batch_id == fb.reconciliation_batch_id) & (DBTransaction.id == f"{fb.reconciliation_batch_id}_bank_{fb.bank_transaction_id}"))
                ).first()

            sim_score, signals = cls.calculate_similarity(context, fb, hist_tx)
            if sim_score >= min_similarity:
                matched_entries.append(HistoricalMemoryEntry(
                    feedback_id=fb.id,
                    reconciliation_result_id=fb.reconciliation_result_id,
                    reconciliation_batch_id=fb.reconciliation_batch_id,
                    bank_transaction_id=fb.bank_transaction_id,
                    resolution_type=fb.resolution_type,
                    human_action=fb.human_action,
                    previous_decision=fb.previous_decision,
                    currency=fb.currency or req_curr,
                    amount=fb.amount,
                    similarity_score=sim_score,
                    matched_signals=signals,
                    human_notes=fb.human_notes,
                    reviewer_id=fb.reviewer_id,
                    created_at=fb.created_at.strftime("%Y-%m-%d %H:%M:%S") if fb.created_at else ""
                ))

        # 3. Sort by similarity score descending and apply limit
        matched_entries.sort(key=lambda m: m.similarity_score, reverse=True)
        top_matches = matched_entries[:limit]

        # 4. Deterministic Trust & Conflict Aggregation
        total_found = len(top_matches)
        if total_found == 0:
            return MemoryRetrievalResult(
                query_currency=req_curr,
                query_exception_category=context.exception_category,
                total_candidates_found=0,
                matches=[],
                predominant_resolution=None,
                consistency_score=0.0,
                trust_level=MemoryTrustLevel.NONE,
                has_conflict=False,
                conflict_details=None,
                advisory_evidence=[f"[HISTORICAL MEMORY] No prior human resolutions found matching pattern in {req_curr}."]
            )

        res_counts = Counter(m.resolution_type for m in top_matches)
        most_common = res_counts.most_common()
        predominant_res, pred_count = most_common[0]
        consistency = round(pred_count / total_found, 2)

        has_conflict = len(res_counts) > 1
        conflict_details = dict(res_counts) if has_conflict else None

        if has_conflict:
            trust_level = MemoryTrustLevel.CONFLICTING
        elif total_found == 1:
            trust_level = MemoryTrustLevel.WEAK
        elif total_found == 2:
            trust_level = MemoryTrustLevel.MODERATE
        else:
            trust_level = MemoryTrustLevel.STRONG

        # 5. Build Explainable Advisory Evidence Strings
        advisory_evidence = cls._build_advisory_evidence(
            matches=top_matches,
            currency=req_curr,
            trust_level=trust_level,
            predominant_res=predominant_res,
            consistency_score=consistency,
            has_conflict=has_conflict,
            res_counts=res_counts
        )

        return MemoryRetrievalResult(
            query_currency=req_curr,
            query_exception_category=context.exception_category,
            total_candidates_found=total_found,
            matches=top_matches,
            predominant_resolution=predominant_res,
            consistency_score=consistency,
            trust_level=trust_level,
            has_conflict=has_conflict,
            conflict_details=conflict_details,
            advisory_evidence=advisory_evidence
        )

    @classmethod
    def get_memory_for_result(
        cls,
        result_id: str,
        db: Session,
        limit: int = 5,
        min_similarity: float = 0.30
    ) -> MemoryRetrievalResult:
        """
        Convenience method to retrieve relevant historical memory for an existing DBReconciliationResult.
        """
        res = db.query(DBReconciliationResult).filter(DBReconciliationResult.id == result_id).first()
        if not res:
            return MemoryRetrievalResult(
                query_currency="UNKNOWN",
                query_exception_category=None,
                total_candidates_found=0,
                matches=[],
                trust_level=MemoryTrustLevel.NONE,
                advisory_evidence=["[HISTORICAL MEMORY] Reconciliation result not found."]
            )

        # Lookup bank transaction
        bank_tx = db.query(DBTransaction).filter(
            (DBTransaction.id == res.bank_tx_id) |
            ((DBTransaction.batch_id == res.batch_id) & (DBTransaction.id == f"{res.batch_id}_bank_{res.bank_tx_id}"))
        ).first()

        ledger_tx = None
        if res.ledger_tx_id:
            ledger_tx = db.query(DBTransaction).filter(
                (DBTransaction.id == res.ledger_tx_id) |
                ((DBTransaction.batch_id == res.batch_id) & (DBTransaction.id == f"{res.batch_id}_ledger_{res.ledger_tx_id}"))
            ).first()

        curr = (bank_tx.currency if bank_tx else (ledger_tx.currency if ledger_tx else "USD")) or "USD"
        amt = abs(bank_tx.amount) if bank_tx and bank_tx.amount is not None else (abs(ledger_tx.amount) if ledger_tx and ledger_tx.amount is not None else None)
        desc = bank_tx.description if bank_tx else (ledger_tx.description if ledger_tx else None)
        ref = bank_tx.reference_id if bank_tx else (ledger_tx.reference_id if ledger_tx else None)
        direction = "CREDIT" if (bank_tx and bank_tx.amount and bank_tx.amount > 0) else "DEBIT"

        context = MemoryContext(
            currency=curr,
            amount=amt,
            exception_category=res.match_type,
            counterparty=None,
            description=desc,
            reference=ref,
            direction=direction,
            bank_tx_id=res.bank_tx_id,
            ledger_tx_id=res.ledger_tx_id
        )

        return cls.retrieve_relevant_feedback(
            context=context,
            db=db,
            limit=limit,
            min_similarity=min_similarity,
            exclude_result_id=result_id
        )

    @staticmethod
    def _build_advisory_evidence(
        matches: List[HistoricalMemoryEntry],
        currency: str,
        trust_level: MemoryTrustLevel,
        predominant_res: str,
        consistency_score: float,
        has_conflict: bool,
        res_counts: Counter
    ) -> List[str]:
        evidence = []
        total = len(matches)

        if has_conflict:
            breakdown = ", ".join(f"{count}x {res}" for res, count in res_counts.items())
            evidence.append(
                f"[HISTORICAL MEMORY CONFLICT] {total} historical human resolutions in {currency} found with conflicting outcomes: {breakdown}"
            )
            evidence.append(
                "[MEMORY ADVISORY] Conflicting historical precedent detected; manual review recommended."
            )
        else:
            evidence.append(
                f"[HISTORICAL MEMORY] {total} historical human resolution(s) ({trust_level.value} trust) consistently resolved as {predominant_res} in {currency} (consistency: {int(consistency_score*100)}%)"
            )

        # Include top note if available
        for m in matches:
            if m.human_notes:
                evidence.append(f"[HISTORICAL ADVISORY NOTE] Prior human reviewer ({m.reviewer_id or 'accountant'}): '{m.human_notes}'")
                break

        return evidence

    @classmethod
    def build_context_from_transaction(
        cls,
        bank_tx: Optional[Any],
        ledger_tx: Optional[Any] = None,
        exception_type: Optional[str] = None
    ) -> Optional[MemoryContext]:
        """
        Builds a MemoryContext for historical retrieval from a bank/ledger transaction pair.
        Returns None if no currency is available (currency boundary cannot be enforced).
        """
        tx = bank_tx or ledger_tx
        if not tx:
            return None

        curr = getattr(tx, "currency", None)
        if not curr or not str(curr).strip():
            return None
        curr = str(curr).strip().upper()

        amt = getattr(tx, "normalized_amount", None)
        if amt is None:
            amt = getattr(tx, "amount", None)
        amt = abs(amt) if amt is not None else None

        desc = getattr(tx, "description", None)
        ref = getattr(tx, "reference_id", None) or getattr(tx, "reference", None)
        direction = getattr(tx, "direction", None)
        if hasattr(direction, "value"):
            direction = direction.value
        bank_id = getattr(bank_tx, "id", None) if bank_tx else None
        ledger_id = getattr(ledger_tx, "id", None) if ledger_tx else None

        return MemoryContext(
            currency=curr,
            amount=amt,
            exception_category=exception_type,
            counterparty=desc,
            description=desc,
            reference=ref,
            direction=direction,
            bank_tx_id=str(bank_id) if bank_id else None,
            ledger_tx_id=str(ledger_id) if ledger_id else None
        )

    @classmethod
    def to_decision_context(cls, mem_result: MemoryRetrievalResult) -> DecisionMemoryContext:
        """
        Converts a MemoryRetrievalResult into a compact DecisionMemoryContext for the DecisionEngine.
        """
        matched_signals_set = set()
        for m in mem_result.matches:
            for sig in m.matched_signals:
                matched_signals_set.add(sig)

        return DecisionMemoryContext(
            has_memory=mem_result.total_candidates_found > 0,
            precedent_count=mem_result.total_candidates_found,
            trust_level=mem_result.trust_level,
            predominant_resolution=mem_result.predominant_resolution,
            consistency_score=mem_result.consistency_score,
            has_conflict=mem_result.has_conflict,
            conflict_details=mem_result.conflict_details,
            feedback_ids=[m.feedback_id for m in mem_result.matches],
            matched_signals=sorted(list(matched_signals_set)),
            advisory_evidence=mem_result.advisory_evidence
        )
