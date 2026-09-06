import time
from typing import Dict, Any, List, Optional
from backend.app.models.pydantic_models import (
    NormalizedTransaction, CandidateMatchItem, DecisionPolicy, PolicyCheckItem,
    FinalDecisionOutput, ActionTaken
)
from backend.app.core.currency import format_currency

def Math_round_pct(val: float) -> str:
    return f"{round(val * 100, 1)}"

class DecisionEngine:
    """
    Phase 4 Decision and Escalation Engine.
    Enforces the core product principle: "KNOWS WHEN TO STOP AND ASK".
    Decoupled decision layer evaluating reconciliation proposals against configurable DecisionPolicy rules.
    High-risk financial contradictions strictly override high confidence scores.
    """
    
    @staticmethod
    def evaluate_reconciliation_result(
        result: Any,
        policy: Optional[DecisionPolicy] = None,
        agent_version: str = "v3"
    ) -> FinalDecisionOutput:
        """
        Convenience wrapper evaluating an existing reconciliation result through decision policy checks.
        """
        bank_tx = getattr(result, "bank_tx", None)
        ledger_tx = getattr(result, "ledger_tx", None)
        selected_ledger_id = getattr(result, "ledger_tx_id", None)
        confidence = getattr(result, "confidence_score", 0.0)
        evidence = getattr(result, "evidence", []) or []
        match_type = getattr(result, "match_type", "EXACT")
        exception_type = match_type.value if hasattr(match_type, "value") else str(match_type)
        
        return DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            selected_ledger_id=selected_ledger_id,
            confidence=confidence,
            evidence=evidence,
            exception_type=exception_type,
            candidate_matches=getattr(result, "candidate_matches", []) or [],
            policy=policy,
            agent_version_id=agent_version
        )

    @staticmethod
    def evaluate_decision(
        bank_tx: Optional[NormalizedTransaction],
        ledger_tx: Optional[NormalizedTransaction] = None,
        selected_ledger_id: Optional[str] = None,
        confidence: float = 0.0,
        evidence: Optional[List[str]] = None,
        exception_type: Optional[str] = None,
        candidate_matches: Optional[List[CandidateMatchItem]] = None,
        policy: Optional[DecisionPolicy] = None,
        agent_version_id: str = "v3"
    ) -> FinalDecisionOutput:
        
        evidence = evidence or []
        candidate_matches = candidate_matches or []
        pol = policy or DecisionPolicy()
        policy_checks: List[PolicyCheckItem] = []
        high_risk_anomalies: List[str] = []
        conflicting_evidence: List[str] = []
        supporting_evidence: List[str] = list(evidence)
        
        # -------------------------------------------------------------
        # Check 1: Minimum Evidence Requirement
        # -------------------------------------------------------------
        has_sufficient_evidence = len(evidence) >= pol.min_evidence_count
        policy_checks.append(PolicyCheckItem(
            check_name="min_evidence_count_check",
            passed=has_sufficient_evidence,
            details=f"{len(evidence)} evidence points provided (minimum required: {pol.min_evidence_count})"
        ))
        
        # -------------------------------------------------------------
        # Check 2: Configurable Confidence Threshold Check
        # -------------------------------------------------------------
        meets_threshold = confidence >= pol.confidence_threshold
        policy_checks.append(PolicyCheckItem(
            check_name="confidence_threshold_check",
            passed=meets_threshold,
            details=f"Assigned confidence {confidence*100:.1f}% vs threshold {pol.confidence_threshold*100:.1f}%"
        ))
        
        # -------------------------------------------------------------
        # Check 3: Allowed Exception Category Check
        # -------------------------------------------------------------
        norm_exception = (exception_type or "EXACT").upper()
        safe_auto_types = [e.upper() for e in pol.allowed_auto_exception_types]
        is_allowed_exception = norm_exception in safe_auto_types
        policy_checks.append(PolicyCheckItem(
            check_name="allowed_exception_category_check",
            passed=is_allowed_exception,
            details=f"Exception '{exception_type}' in allowed auto-reconcile categories: {is_allowed_exception}"
        ))
        
        # -------------------------------------------------------------
        # Check 4: Hard High-Risk Safety Overrides
        # Core Invariant: "A high model confidence must NEVER override a hard financial discrepancy."
        # -------------------------------------------------------------
        # Check 4A: Material Amount Mismatch Override
        # Even if confidence is 0.99, if amount variance exceeds 0.05, it CANNOT auto-reconcile!
        if bank_tx and ledger_tx:
            b_norm = bank_tx.normalized_amount
            l_norm = ledger_tx.normalized_amount
            amt_diff = abs(b_norm - l_norm)
            if amt_diff > 0.05:
                conflict_msg = (
                    f"Material amount variance: Bank {format_currency(bank_tx.amount, bank_tx.currency)} vs "
                    f"Ledger {format_currency(ledger_tx.amount, ledger_tx.currency)} (variance: {format_currency(amt_diff, bank_tx.currency)})"
                )
                high_risk_anomalies.append(conflict_msg)
                conflicting_evidence.append(conflict_msg)
                if norm_exception in ["EXACT", "EXACT_MATCH"]:
                    norm_exception = "AMOUNT_VARIANCE"

        # Check 4B: Duplicate Candidates
        if norm_exception in ["DUPLICATE", "DUPLICATE_TRANSACTION"]:
            conflict_msg = "Duplicate bank transaction claimed single already-consumed ledger entry"
            high_risk_anomalies.append(conflict_msg)
            conflicting_evidence.append(conflict_msg)
            
        # Check 4C: Ambiguity Index Check
        if pol.escalate_on_ambiguity and len(candidate_matches) >= 2:
            top_score = candidate_matches[0].similarity_score
            second_score = candidate_matches[1].similarity_score
            if abs(top_score - second_score) <= 0.05:
                ambig_msg = (
                    f"Ambiguity Risk: Top 2 candidates ({candidate_matches[0].ledger_id} score {top_score:.2f} vs "
                    f"{candidate_matches[1].ledger_id} score {second_score:.2f}) score within 0.05"
                )
                high_risk_anomalies.append(ambig_msg)
                conflicting_evidence.append(ambig_msg)
                
        # Check 4D: Specific Financial Discrepancies Requiring Review
        if norm_exception in [
            "PARTIAL_PAYMENT", "OVERPAYMENT", "AMOUNT_VARIANCE",
            "AMOUNT_DISCREPANCY", "MISSING_INVOICE",
            "MISSING_LEDGER", "MISSING_BANK"
        ]:
            if not any(norm_exception in a for a in high_risk_anomalies):
                disc_msg = f"Financial exception category '{norm_exception}' requires human confirmation"
                high_risk_anomalies.append(disc_msg)
                conflicting_evidence.append(disc_msg)

        no_high_risk = len(high_risk_anomalies) == 0
        policy_checks.append(PolicyCheckItem(
            check_name="high_risk_anomaly_override",
            passed=no_high_risk,
            details="No high-risk anomalies" if no_high_risk else f"Anomalies: {'; '.join(high_risk_anomalies)}"
        ))

        # -------------------------------------------------------------
        # Final Decision Synthesis & "Knows When to Stop" Explanation
        # -------------------------------------------------------------
        conf_pct = Math_round_pct(confidence)
        currency_code = bank_tx.currency if (bank_tx and bank_tx.currency) else (ledger_tx.currency if ledger_tx else None)
        bank_amt_str = format_currency(bank_tx.amount, currency_code) if bank_tx else "N/A"
        
        stop_details: Optional[Dict[str, Any]] = None
        
        if selected_ledger_id and meets_threshold and has_sufficient_evidence and is_allowed_exception and no_high_risk:
            final_decision = ActionTaken.AUTO_RECONCILE.value
            explanation = (
                f"Matched to {selected_ledger_id} because amount ({bank_amt_str}), reference, "
                f"currency ({currency_code or 'N/A'}), and transaction date align cleanly. Confidence: {conf_pct}%."
            )
        elif not selected_ledger_id or norm_exception == "UNMATCHED":
            final_decision = ActionTaken.REJECT.value
            confidence = 0.0  # Unmatched is not a low-confidence match; it has zero match confidence
            bank_desc = bank_tx.description if bank_tx else ""
            explanation = (
                f"No credible ledger candidate found for bank transaction {bank_tx.id if bank_tx else ''} "
                f"({bank_amt_str} - '{bank_desc}'). Classified as MISSING_IN_LEDGER."
            )
        else:
            final_decision = ActionTaken.ESCALATE_TO_HUMAN.value
            
            # Formulate clear "Knows When to Stop" explanation
            primary_reason = high_risk_anomalies[0] if high_risk_anomalies else (
                f"confidence ({conf_pct}%) is below policy threshold ({Math_round_pct(pol.confidence_threshold)}%)"
            )
            
            explanation = (
                f"The agent identified candidate {selected_ledger_id or 'ledger entry'}, but stopped because "
                f"{primary_reason}. Human confirmation is required."
            )
            
            # Determine recommended action
            if norm_exception == "PARTIAL_PAYMENT":
                rec_action = "Confirm partial settlement and apply remaining balance to open invoice."
            elif norm_exception == "OVERPAYMENT":
                rec_action = "Verify customer overpayment or credit note allocation with finance team."
            elif norm_exception == "AMOUNT_VARIANCE":
                rec_action = "Investigate bank fee deduction, discount difference, or currency conversion discrepancy."
            elif norm_exception == "DUPLICATE":
                rec_action = "Verify if bank statement contains duplicate charge/deposit or if a secondary invoice exists."
            else:
                rec_action = "Review candidate ledger details and accept or re-assign to correct document."
                
            stop_details = {
                "why_stopped": primary_reason,
                "candidate_found": f"{selected_ledger_id} ({ledger_tx.description if ledger_tx else ''})" if selected_ledger_id else "None",
                "supporting_evidence": supporting_evidence,
                "conflicting_evidence": conflicting_evidence,
                "exception_type": norm_exception,
                "confidence": f"{conf_pct}%",
                "recommended_action": rec_action
            }

        return FinalDecisionOutput(
            decision=final_decision,
            confidence=confidence,
            reason=explanation,
            evidence=evidence,
            policy_checks=policy_checks,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
            agent_version=agent_version_id,
            stop_reason_details=stop_details
        )
