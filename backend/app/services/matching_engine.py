import uuid
import time
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any, Set
import pandas as pd

from backend.app.models.pydantic_models import (
    NormalizedTransaction, ReconciliationResultSchema, MatchType, ActionTaken,
    DiscrepancyDetail, AgentVersionSchema, AgentTraceSchema, HumanStatus,
    ProcessingMethod, CandidateMatchItem, DecisionPolicy, LedgerCandidateState
)
from backend.app.services.decision_engine import DecisionEngine
from backend.app.services.llm_agent import LLMReasoningAgent
from backend.app.core.currency import format_currency

class MultiTierMatchingEngine:
    """
    Autonomous Bank Reconciliation Matching Engine.
    Implements the core product principle: "KNOWS WHEN TO STOP AND ASK".
    
    Multi-stage deterministic & corroborated reconciliation:
      - STAGE 1: Exact Deterministic Matching (Currency, Direction, Amount, Reference)
      - STAGE 2: Exact Reference + Date/Posting Tolerance (using posting_date, not document_date)
      - STAGE 3: Corroborated Fuzzy Matching (requires text + amount + direction + date corroboration)
      - STAGE 4: Safety & Escalation Rules:
          * Duplicate Detection & Ledger Entry Consumption Tracking
          * Partial Payment & Overpayment Detection
          * Configurable Material Amount Variance Escalation
          * Unmatched/Ledger-Only Reconciliation Records
    """

    @staticmethod
    def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(str(date_str).strip()[:10], fmt)
            except Exception:
                continue
        return None

    @staticmethod
    def _compute_date_diff_days(date_str_1: Optional[str], date_str_2: Optional[str]) -> int:
        d1 = MultiTierMatchingEngine._parse_date(date_str_1)
        d2 = MultiTierMatchingEngine._parse_date(date_str_2)
        if not d1 or not d2:
            return 999
        return abs((d1 - d2).days)

    @staticmethod
    def _normalize_ref(ref: Optional[str]) -> str:
        if not ref:
            return ""
        import re
        return re.sub(r"[^A-Za-z0-9\-]", "", str(ref)).strip().upper()

    @staticmethod
    def _compute_match_confidence(
        reference_match: bool,
        amount_match: bool,
        currency_match: bool,
        direction_match: bool,
        counterparty_similarity: float = 1.0,
        date_diff_days: int = 0
    ) -> float:
        """
        Computes match confidence based on observable evidence signals.
        Evaluates how strongly the available evidence suggests that a bank transaction
        corresponds to a particular ledger transaction (independent of auto-reconcile safety).
        """
        if not reference_match and counterparty_similarity == 0.0 and not amount_match:
            return 0.0

        score = 0.0
        # 1. Reference signal (strongest identifier): up to 0.50
        if reference_match:
            score += 0.50
        
        # 2. Counterparty / text alignment: up to 0.25
        score += min(0.25, counterparty_similarity * 0.25)
        
        # 3. Currency compatibility: +0.10
        if currency_match:
            score += 0.10
            
        # 4. Direction compatibility: +0.05
        if direction_match:
            score += 0.05
            
        # 5. Date proximity: up to +0.06
        if date_diff_days <= 2:
            score += 0.06
        elif date_diff_days <= 7:
            score += 0.03
            
        # 6. Exact amount signal: +0.04
        if amount_match:
            score += 0.04
            
        return round(min(1.0, score), 2)

    @staticmethod
    def process_batch(
        batch_id: str,
        bank_txs: List[NormalizedTransaction],
        ledger_txs: List[NormalizedTransaction],
        agent_version: AgentVersionSchema,
        policy: Optional[DecisionPolicy] = None
    ) -> Tuple[List[ReconciliationResultSchema], List[AgentTraceSchema]]:
        
        results: List[ReconciliationResultSchema] = []
        traces: List[AgentTraceSchema] = []
        
        pol = policy or DecisionPolicy(confidence_threshold=agent_version.confidence_threshold)
        
        # Track Ledger Candidate State Machine
        # States: AVAILABLE, MATCHED, PARTIALLY_MATCHED, CONSUMED, REVIEW_REQUIRED
        ledger_state: Dict[str, LedgerCandidateState] = {
            tx.id: LedgerCandidateState.AVAILABLE for tx in ledger_txs
        }
        ledger_by_id: Dict[str, NormalizedTransaction] = {tx.id: tx for tx in ledger_txs}
        
        # Track which bank transaction consumed each ledger transaction
        ledger_matched_by_bank_id: Dict[str, str] = {}
        
        # Pre-index ledger by reference, document_id, payment_reference, invoice_id
        ledger_by_ref: Dict[str, List[NormalizedTransaction]] = {}
        for l in ledger_txs:
            keys = {l.reference, l.document_id, l.payment_reference, l.invoice_id}
            for k in keys:
                if k and str(k).strip():
                    clean_k = str(k).strip().upper()
                    ledger_by_ref.setdefault(clean_k, []).append(l)

        # Count bank occurrences of references to identify potential bank-side duplicates
        bank_ref_counts: Dict[str, int] = {}
        for b in bank_txs:
            b_ref = (b.reference or b.payment_reference or b.document_id or b.invoice_id or "").strip().upper()
            if b_ref:
                bank_ref_counts[b_ref] = bank_ref_counts.get(b_ref, 0) + 1

        unmatched_bank_txs: List[NormalizedTransaction] = []

        # =========================================================================
        # STAGE 1: Exact Deterministic Match
        # =========================================================================
        for b_tx in bank_txs:
            b_ref = (b_tx.reference or b_tx.payment_reference or b_tx.document_id or b_tx.invoice_id or "").strip().upper()
            
            # Check if this bank transaction shares a reference that appears multiple times in bank statement
            # AND its matching ledger entry has already been consumed or is duplicated
            matching_ledger_candidates = ledger_by_ref.get(b_ref, []) if b_ref else []
            
            # Check for Duplicate bank deposit scenario
            if b_ref and bank_ref_counts.get(b_ref, 0) > 1 and matching_ledger_candidates:
                l_cand = matching_ledger_candidates[0]
                if ledger_state.get(l_cand.id) == LedgerCandidateState.CONSUMED:
                    # L_cand already consumed by an earlier bank transaction!
                    prior_b_id = ledger_matched_by_bank_id.get(l_cand.id, "prior bank transaction")
                    evidence_dict = {
                        "reference_match": True,
                        "amount_match": abs(b_tx.normalized_amount - l_cand.normalized_amount) < 0.01,
                        "currency_match": b_tx.currency == l_cand.currency,
                        "direction_match": b_tx.direction == l_cand.direction,
                        "counterparty_similarity": 1.0,
                        "date_difference_days": MultiTierMatchingEngine._compute_date_diff_days(b_tx.date, l_cand.effective_settlement_date),
                        "duplicate_detected": True,
                        "amount_variance": round(abs(b_tx.normalized_amount - l_cand.normalized_amount), 2),
                        "confidence": 0.50,
                        "decision": ActionTaken.ESCALATE_TO_HUMAN.value
                    }
                    
                    reasoning = (
                        f"Duplicate bank deposit detected. Reference '{b_ref}' matches ledger record {l_cand.id} "
                        f"({format_currency(l_cand.amount, l_cand.currency)}), but this ledger record was already "
                        f"consumed by bank transaction {prior_b_id}. Human confirmation required to verify if this is a "
                        f"duplicate deposit or separate unrecorded transaction."
                    )
                    
                    res_id = f"res_{uuid.uuid4().hex[:8]}"
                    res = ReconciliationResultSchema(
                        id=res_id,
                        batch_id=batch_id,
                        agent_version_id=agent_version.id,
                        bank_tx_id=b_tx.id,
                        bank_tx=b_tx,
                        ledger_tx_id=l_cand.id,
                        ledger_tx=l_cand,
                        match_type=MatchType.DUPLICATE,
                        confidence_score=0.50,
                        action_taken=ActionTaken.ESCALATE_TO_HUMAN,
                        reasoning=reasoning,
                        discrepancy_details=[DiscrepancyDetail(
                            field="reference",
                            bank_val=b_ref,
                            ledger_val=b_ref,
                            variance=0.0,
                            note=f"Duplicate deposit flag: {b_tx.id} and {prior_b_id} both claim {l_cand.id}"
                        )],
                        human_status=HumanStatus.PENDING,
                        processing_method=ProcessingMethod.RULE,
                        evidence=[
                            f"Reference '{b_ref}' appears {bank_ref_counts[b_ref]} times in bank statement",
                            f"Ledger record {l_cand.id} already allocated to {prior_b_id}",
                            "Safety Rule: Never double-consume single ledger invoice"
                        ],
                        candidate_matches=[CandidateMatchItem(
                            ledger_id=l_cand.id,
                            similarity_score=0.50,
                            reason=f"Claimed duplicate for {b_ref}"
                        )],
                        evidence_details=evidence_dict
                    )
                    results.append(res)
                    continue

            # Regular exact match search:
            # 1. Exact reference + exact amount + currency + direction
            exact_match_found = False
            for l_cand in matching_ledger_candidates:
                if ledger_state[l_cand.id] != LedgerCandidateState.AVAILABLE:
                    continue
                
                # Verify exact amount, currency, direction
                amt_diff = abs(b_tx.normalized_amount - l_cand.normalized_amount)
                currency_match = b_tx.currency.upper() == l_cand.currency.upper()
                direction_match = b_tx.direction == l_cand.direction
                
                if amt_diff < 0.01 and currency_match and direction_match:
                    # Found deterministic exact match
                    ledger_state[l_cand.id] = LedgerCandidateState.CONSUMED
                    ledger_matched_by_bank_id[l_cand.id] = b_tx.id
                    exact_match_found = True
                    
                    date_diff = MultiTierMatchingEngine._compute_date_diff_days(
                        b_tx.date, l_cand.effective_settlement_date
                    )
                    
                    evidence_dict = {
                        "reference_match": True,
                        "amount_match": True,
                        "currency_match": True,
                        "direction_match": True,
                        "counterparty_similarity": 1.0,
                        "date_difference_days": date_diff,
                        "duplicate_detected": False,
                        "amount_variance": 0.0,
                        "confidence": 1.0,
                        "decision": ActionTaken.AUTO_RECONCILE.value
                    }
                    
                    evidence_list = [
                        f"Exact reference match: {b_ref}",
                        f"Exact amount match: {format_currency(b_tx.amount, b_tx.currency)}",
                        f"Matching economic direction: {b_tx.direction}",
                        f"Date difference: {date_diff} day(s) against ledger posting date {l_cand.effective_settlement_date}"
                    ]
                    
                    reasoning = (
                        f"Clean automatic reconciliation with {l_cand.id}. Reference '{b_ref}', amount "
                        f"({format_currency(b_tx.amount, b_tx.currency)}), currency ({b_tx.currency}), and economic direction ({b_tx.direction}) match identically."
                    )
                    
                    res_id = f"res_{uuid.uuid4().hex[:8]}"
                    res = ReconciliationResultSchema(
                        id=res_id,
                        batch_id=batch_id,
                        agent_version_id=agent_version.id,
                        bank_tx_id=b_tx.id,
                        bank_tx=b_tx,
                        ledger_tx_id=l_cand.id,
                        ledger_tx=l_cand,
                        match_type=MatchType.EXACT,
                        confidence_score=1.0,
                        action_taken=ActionTaken.AUTO_RECONCILE,
                        reasoning=reasoning,
                        discrepancy_details=[],
                        human_status=HumanStatus.PENDING,
                        processing_method=ProcessingMethod.RULE,
                        evidence=evidence_list,
                        candidate_matches=[CandidateMatchItem(
                            ledger_id=l_cand.id,
                            similarity_score=1.0,
                            reason="Stage 1: Deterministic Exact Match"
                        )],
                        evidence_details=evidence_dict
                    )
                    results.append(res)
                    break
                    
            if not exact_match_found:
                unmatched_bank_txs.append(b_tx)

        # =========================================================================
        # STAGE 2: Exact Reference + Date/Posting Tolerance & Discrepancy Checks
        # =========================================================================
        remaining_unmatched_bank: List[NormalizedTransaction] = []

        for b_tx in unmatched_bank_txs:
            b_ref = (b_tx.reference or b_tx.payment_reference or b_tx.document_id or b_tx.invoice_id or "").strip().upper()
            matching_ledger_candidates = ledger_by_ref.get(b_ref, []) if b_ref else []
            
            matched_stage_2 = False
            
            for l_cand in matching_ledger_candidates:
                if ledger_state[l_cand.id] != LedgerCandidateState.AVAILABLE:
                    continue
                
                amt_diff = abs(b_tx.normalized_amount - l_cand.normalized_amount)
                currency_match = b_tx.currency.upper() == l_cand.currency.upper()
                direction_match = b_tx.direction == l_cand.direction
                date_diff = MultiTierMatchingEngine._compute_date_diff_days(
                    b_tx.date, l_cand.effective_settlement_date
                )
                
                # Check 2A: Reference matches, direction matches, currency matches, EXACT amount, but date difference within tolerance
                max_date_lag = agent_version.matching_rules.get("date_window_days", 7)
                if currency_match and direction_match and amt_diff < 0.01 and date_diff <= max_date_lag:
                    ledger_state[l_cand.id] = LedgerCandidateState.CONSUMED
                    ledger_matched_by_bank_id[l_cand.id] = b_tx.id
                    matched_stage_2 = True
                    
                    confidence = 0.99 if date_diff <= 2 else 0.96
                    evidence_dict = {
                        "reference_match": True,
                        "amount_match": True,
                        "currency_match": True,
                        "direction_match": True,
                        "counterparty_similarity": 1.0,
                        "date_difference_days": date_diff,
                        "duplicate_detected": False,
                        "amount_variance": 0.0,
                        "confidence": confidence,
                        "decision": ActionTaken.AUTO_RECONCILE.value
                    }
                    
                    reasoning = (
                        f"Reconciled to {l_cand.id}. Reference '{b_ref}' and amount ({format_currency(b_tx.amount, b_tx.currency)}) "
                        f"match with {date_diff}-day timing difference against posting date {l_cand.effective_settlement_date}."
                    )
                    
                    res_id = f"res_{uuid.uuid4().hex[:8]}"
                    res = ReconciliationResultSchema(
                        id=res_id,
                        batch_id=batch_id,
                        agent_version_id=agent_version.id,
                        bank_tx_id=b_tx.id,
                        bank_tx=b_tx,
                        ledger_tx_id=l_cand.id,
                        ledger_tx=l_cand,
                        match_type=MatchType.TIMING_DIFFERENCE if date_diff > 0 else MatchType.EXACT,
                        confidence_score=confidence,
                        action_taken=ActionTaken.AUTO_RECONCILE,
                        reasoning=reasoning,
                        discrepancy_details=[DiscrepancyDetail(
                            field="date",
                            bank_val=b_tx.date,
                            ledger_val=l_cand.effective_settlement_date,
                            variance=float(date_diff),
                            note=f"{date_diff} days difference between bank date and ledger posting date"
                        )] if date_diff > 0 else [],
                        human_status=HumanStatus.PENDING,
                        processing_method=ProcessingMethod.RULE,
                        evidence=[
                            f"Exact reference match: {b_ref}",
                            f"Exact amount match: {format_currency(b_tx.amount, b_tx.currency)}",
                            f"Settlement date lag: {date_diff} day(s) (within allowed {max_date_lag} days window)"
                        ],
                        candidate_matches=[CandidateMatchItem(
                            ledger_id=l_cand.id,
                            similarity_score=confidence,
                            reason=f"Stage 2: Timing alignment ({date_diff}d lag)"
                        )],
                        evidence_details=evidence_dict
                    )
                    results.append(res)
                    break
                
                # Check 2B: Reference matches, currency matches, direction matches, but AMOUNT DIFFERS
                # Must detect Partial Payment vs Amount Variance vs Overpayment!
                if currency_match and direction_match and amt_diff >= 0.01:
                    matched_stage_2 = True
                    ledger_state[l_cand.id] = LedgerCandidateState.REVIEW_REQUIRED
                    
                    is_partial = b_tx.normalized_amount < l_cand.normalized_amount
                    is_overpayment = b_tx.normalized_amount > l_cand.normalized_amount
                    
                    # Distinguish Partial Payment (e.g. Pixel Prints B018 ₹2,750 vs L017 ₹5,000)
                    # from Material Amount Variance (e.g. Lumen Labs B016 $540 vs L015 $550)
                    pct_diff = (amt_diff / l_cand.normalized_amount) if l_cand.normalized_amount > 0 else 1.0
                    
                    if is_partial and (pct_diff > 0.10 or "partially paid" in (l_cand.status or "").lower()):
                        match_type = MatchType.PARTIAL_PAYMENT
                        conf = 0.65
                        remaining = round(l_cand.normalized_amount - b_tx.normalized_amount, 2)
                        reasoning = (
                            f"Possible match found: {b_ref} ({l_cand.counterparty or l_cand.id}). Reference matches, "
                            f"but bank payment is {format_currency(b_tx.amount, b_tx.currency)} versus ledger amount "
                            f"{format_currency(l_cand.amount, l_cand.currency)} (unpaid balance: {format_currency(remaining, b_tx.currency)}). "
                            f"Classified as PARTIAL_PAYMENT. Human confirmation required."
                        )
                    elif is_overpayment and pct_diff > 0.10:
                        match_type = MatchType.OVERPAYMENT
                        conf = 0.60
                        reasoning = (
                            f"Possible match found: {b_ref}. Bank received {format_currency(b_tx.amount, b_tx.currency)}, "
                            f"exceeding ledger record of {format_currency(l_cand.amount, l_cand.currency)}. "
                            f"Classified as OVERPAYMENT. Human confirmation required."
                        )
                    else:
                        # Material amount variance (e.g. Lumen Labs $540 vs $550, diff = $10)
                        match_type = MatchType.AMOUNT_VARIANCE
                        conf = 0.58
                        reasoning = (
                            f"Possible match found: {b_ref} ({l_cand.counterparty or l_cand.id}). Reference matches, "
                            f"but bank deposit is {format_currency(b_tx.amount, b_tx.currency)} versus ledger amount "
                            f"{format_currency(l_cand.amount, l_cand.currency)} (material variance of {format_currency(amt_diff, b_tx.currency)}). "
                            f"Classified as AMOUNT_VARIANCE. Human confirmation required."
                        )
                        
                    evidence_dict = {
                        "reference_match": True,
                        "amount_match": False,
                        "currency_match": True,
                        "direction_match": True,
                        "counterparty_similarity": 1.0,
                        "date_difference_days": date_diff,
                        "duplicate_detected": False,
                        "amount_variance": round(amt_diff, 2),
                        "confidence": conf,
                        "decision": ActionTaken.ESCALATE_TO_HUMAN.value
                    }
                    
                    res_id = f"res_{uuid.uuid4().hex[:8]}"
                    res = ReconciliationResultSchema(
                        id=res_id,
                        batch_id=batch_id,
                        agent_version_id=agent_version.id,
                        bank_tx_id=b_tx.id,
                        bank_tx=b_tx,
                        ledger_tx_id=l_cand.id,
                        ledger_tx=l_cand,
                        match_type=match_type,
                        confidence_score=conf,
                        action_taken=ActionTaken.ESCALATE_TO_HUMAN,
                        reasoning=reasoning,
                        discrepancy_details=[DiscrepancyDetail(
                            field="amount",
                            bank_val=b_tx.amount,
                            ledger_val=l_cand.amount,
                            variance=round(amt_diff, 2),
                            note=f"Amount variance of {format_currency(amt_diff, b_tx.currency)}"
                        )],
                        human_status=HumanStatus.PENDING,
                        processing_method=ProcessingMethod.RULE,
                        evidence=[
                            f"Reference matches: {b_ref}",
                            f"Bank amount: {format_currency(b_tx.amount, b_tx.currency)}",
                            f"Ledger amount: {format_currency(l_cand.amount, l_cand.currency)}",
                            f"Delta: {format_currency(amt_diff, b_tx.currency)}",
                            "Safety Rule: Material amount discrepancy requires human confirmation"
                        ],
                        candidate_matches=[CandidateMatchItem(
                            ledger_id=l_cand.id,
                            similarity_score=conf,
                            reason=f"Reference match with amount variance ({format_currency(amt_diff, b_tx.currency)})"
                        )],
                        evidence_details=evidence_dict
                    )
                    results.append(res)
                    break
                    
            if not matched_stage_2:
                remaining_unmatched_bank.append(b_tx)

        # =========================================================================
        # STAGE 3: Corroborated Fuzzy Matching
        # =========================================================================
        available_ledger_candidates = [
            tx for tx in ledger_txs if ledger_state[tx.id] == LedgerCandidateState.AVAILABLE
        ]

        final_unmatched_bank: List[NormalizedTransaction] = []

        for b_tx in remaining_unmatched_bank:
            fuzzy_match_found = False
            best_candidate: Optional[NormalizedTransaction] = None
            best_score = 0.0
            best_evidence: List[str] = []
            
            b_norm_desc = (b_tx.normalized_description or b_tx.description).lower()
            b_norm_party = (b_tx.normalized_counterparty or "").lower()
            
            for l_cand in available_ledger_candidates:
                l_norm_desc = (l_cand.normalized_description or l_cand.description).lower()
                l_norm_party = (l_cand.normalized_counterparty or "").lower()
                
                # Check text alignment
                text_match = False
                if b_norm_party and l_norm_party and (b_norm_party in l_norm_party or l_norm_party in b_norm_party):
                    text_match = True
                elif b_norm_desc and l_norm_desc and (b_norm_desc in l_norm_desc or l_norm_desc in b_norm_desc):
                    text_match = True
                    
                # Corroborating financial signals
                amt_diff = abs(b_tx.normalized_amount - l_cand.normalized_amount)
                currency_match = b_tx.currency.upper() == l_cand.currency.upper()
                direction_match = b_tx.direction == l_cand.direction
                date_diff = MultiTierMatchingEngine._compute_date_diff_days(
                    b_tx.date, l_cand.effective_settlement_date
                )
                
                # CORROBORATION RULE: Fuzzy text ALONE never auto-matches.
                # Must have exact amount, exact currency, exact direction, and date within 7 days.
                if text_match and currency_match and direction_match and amt_diff < 0.01 and date_diff <= 7:
                    best_candidate = l_cand
                    best_score = 0.94 if date_diff <= 2 else 0.91
                    best_evidence = [
                        f"Counterparty alignment: '{b_tx.counterparty or b_tx.description}' ~ '{l_cand.counterparty or l_cand.description}'",
                        f"Exact corroborated amount: {format_currency(b_tx.amount, b_tx.currency)}",
                        f"Matching economic direction: {b_tx.direction}",
                        f"Settlement date proximity: {date_diff} day(s)"
                    ]
                    break

            if best_candidate and best_score >= 0.90:
                ledger_state[best_candidate.id] = LedgerCandidateState.CONSUMED
                ledger_matched_by_bank_id[best_candidate.id] = b_tx.id
                available_ledger_candidates = [
                    c for c in available_ledger_candidates if c.id != best_candidate.id
                ]
                
                date_diff = MultiTierMatchingEngine._compute_date_diff_days(
                    b_tx.date, best_candidate.effective_settlement_date
                )
                
                evidence_dict = {
                    "reference_match": False,
                    "amount_match": True,
                    "currency_match": True,
                    "direction_match": True,
                    "counterparty_similarity": 0.95,
                    "date_difference_days": date_diff,
                    "duplicate_detected": False,
                    "amount_variance": 0.0,
                    "confidence": best_score,
                    "decision": ActionTaken.AUTO_RECONCILE.value
                }
                
                reasoning = (
                    f"Corroborated reconciliation with {best_candidate.id}. Normalized counterparty "
                    f"('{best_candidate.counterparty or best_candidate.description}') and exact amount "
                    f"({format_currency(b_tx.amount, b_tx.currency)}) align cleanly."
                )
                
                res_id = f"res_{uuid.uuid4().hex[:8]}"
                res = ReconciliationResultSchema(
                    id=res_id,
                    batch_id=batch_id,
                    agent_version_id=agent_version.id,
                    bank_tx_id=b_tx.id,
                    bank_tx=b_tx,
                    ledger_tx_id=best_candidate.id,
                    ledger_tx=best_candidate,
                    match_type=MatchType.FUZZY,
                    confidence_score=best_score,
                    action_taken=ActionTaken.AUTO_RECONCILE,
                    reasoning=reasoning,
                    discrepancy_details=[],
                    human_status=HumanStatus.PENDING,
                    processing_method=ProcessingMethod.FUZZY,
                    evidence=best_evidence,
                    candidate_matches=[CandidateMatchItem(
                        ledger_id=best_candidate.id,
                        similarity_score=best_score,
                        reason="Stage 3: Corroborated Counterparty & Amount"
                    )],
                    evidence_details=evidence_dict
                )
                results.append(res)
            else:
                final_unmatched_bank.append(b_tx)

        # =========================================================================
        # STAGE 4: Genuine Unmatched Bank Transactions
        # =========================================================================
        for b_tx in final_unmatched_bank:
            evidence_dict = {
                "reference_match": False,
                "amount_match": False,
                "currency_match": False,
                "direction_match": False,
                "counterparty_similarity": 0.0,
                "date_difference_days": 999,
                "duplicate_detected": False,
                "amount_variance": round(b_tx.normalized_amount, 2),
                "confidence": 0.0,
                "decision": ActionTaken.REJECT.value
            }
            
            reasoning = (
                f"No credible ledger candidate found for bank transaction {b_tx.id} "
                f"({format_currency(b_tx.amount, b_tx.currency)} - '{b_tx.description}'). "
                f"No matching reference, counterparty, or amount in ledger pool. Classified as MISSING_IN_LEDGER (UNMATCHED)."
            )
            
            res_id = f"res_{uuid.uuid4().hex[:8]}"
            res = ReconciliationResultSchema(
                id=res_id,
                batch_id=batch_id,
                agent_version_id=agent_version.id,
                bank_tx_id=b_tx.id,
                bank_tx=b_tx,
                ledger_tx_id=None,
                ledger_tx=None,
                match_type=MatchType.UNMATCHED,
                confidence_score=0.0,
                action_taken=ActionTaken.REJECT,
                reasoning=reasoning,
                discrepancy_details=[DiscrepancyDetail(
                    field="ledger_record",
                    bank_val=b_tx.id,
                    ledger_val=None,
                    variance=round(b_tx.normalized_amount, 2),
                    note=f"Bank entry unrepresented in company books: {format_currency(b_tx.amount, b_tx.currency)}"
                )],
                human_status=HumanStatus.PENDING,
                processing_method=ProcessingMethod.RULE,
                evidence=[
                    f"Bank description: {b_tx.description}",
                    f"Amount: {format_currency(b_tx.amount, b_tx.currency)}",
                    "Deterministic and fuzzy candidate search yielded zero credible matches"
                ],
                candidate_matches=[],
                evidence_details=evidence_dict
            )
            results.append(res)

        # =========================================================================
        # STAGE 5: Ledger-Only Unconsumed Records
        # =========================================================================
        unconsumed_ledger = [tx for tx in ledger_txs if ledger_state[tx.id] == LedgerCandidateState.AVAILABLE]
        for l_tx in unconsumed_ledger:
            reasoning = (
                f"Ledger transaction {l_tx.id} ({format_currency(l_tx.amount, l_tx.currency)} - '{l_tx.description}') "
                f"remains unconsumed in bank statement. Classified as LEDGER_ONLY."
            )
            res_id = f"res_{uuid.uuid4().hex[:8]}"
            res = ReconciliationResultSchema(
                id=res_id,
                batch_id=batch_id,
                agent_version_id=agent_version.id,
                bank_tx_id=f"ledger_only_{l_tx.id}",
                bank_tx=None,
                ledger_tx_id=l_tx.id,
                ledger_tx=l_tx,
                match_type=MatchType.MISSING_IN_BANK,
                confidence_score=0.0,
                action_taken=ActionTaken.REJECT,
                reasoning=reasoning,
                discrepancy_details=[DiscrepancyDetail(
                    field="bank_record",
                    bank_val=None,
                    ledger_val=l_tx.id,
                    variance=round(l_tx.normalized_amount, 2),
                    note=f"Company ledger entry unrepresented in bank statement: {format_currency(l_tx.amount, l_tx.currency)}"
                )],
                human_status=HumanStatus.PENDING,
                processing_method=ProcessingMethod.RULE,
                evidence=[
                    f"Ledger description: {l_tx.description}",
                    f"Amount: {format_currency(l_tx.amount, l_tx.currency)}",
                    "Ledger transaction was not matched by any bank statement item"
                ],
                candidate_matches=[],
                evidence_details={
                    "reference_match": False,
                    "amount_match": False,
                    "confidence": 0.0,
                    "decision": ActionTaken.REJECT.value
                }
            )
            results.append(res)

        # Ensure all result objects sync their canonical fields
        for r in results:
            r.sync_canonical_fields()

        # Sort results cleanly to preserve bank transaction order (bank items first, then ledger-only)
        bank_id_order = {tx.id: idx for idx, tx in enumerate(bank_txs)}
        results.sort(key=lambda r: bank_id_order.get(r.bank_tx_id, 999))

        return results, traces
