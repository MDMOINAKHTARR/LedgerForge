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
        policy: Optional[Any] = None,
        agent_version: str = "v3"
    ) -> FinalDecisionOutput:
        """
        Convenience wrapper evaluating an existing reconciliation result through decision policy checks.
        """
        actual_policy = None
        actual_version = agent_version
        if isinstance(policy, str):
            actual_version = policy
        elif isinstance(policy, DecisionPolicy):
            actual_policy = policy

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
            policy=actual_policy,
            agent_version_id=actual_version
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
                disc_msg = f"Financial exception category '{norm_exception}' requires mandatory human auditor confirmation"
                high_risk_anomalies.append(disc_msg)
                conflicting_evidence.append(disc_msg)

        # Check 4E: Currency Conflict Override
        if bank_tx and ledger_tx and bank_tx.currency and ledger_tx.currency:
            if bank_tx.currency.upper() != ledger_tx.currency.upper():
                conflict_msg = f"Currency conflict: Bank {bank_tx.currency.upper()} vs Ledger {ledger_tx.currency.upper()}"
                if not any("Currency conflict" in a for a in high_risk_anomalies):
                    high_risk_anomalies.append(conflict_msg)
                    conflicting_evidence.append(conflict_msg)
                norm_exception = "FX_VARIANCE"

        # Check 4F: Direction Conflict Override
        if bank_tx and ledger_tx and bank_tx.direction and ledger_tx.direction:
            if bank_tx.direction.upper() != ledger_tx.direction.upper():
                conflict_msg = f"Direction conflict: Bank is {bank_tx.direction.upper()} vs Ledger is {ledger_tx.direction.upper()}"
                if not any("Direction conflict" in a for a in high_risk_anomalies):
                    high_risk_anomalies.append(conflict_msg)
                    conflicting_evidence.append(conflict_msg)
                norm_exception = "AMOUNT_DISCREPANCY"

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

        auto_match_eligible = bool(
            selected_ledger_id
            and meets_threshold
            and has_sufficient_evidence
            and is_allowed_exception
            and no_high_risk
        )
        
        if auto_match_eligible:
            final_decision = ActionTaken.AUTO_RECONCILE.value
            recon_status = "AUTO_MATCHED"
            explanation = (
                f"Matched to {selected_ledger_id} because amount ({bank_amt_str}), reference, "
                f"currency ({currency_code or 'N/A'}), and transaction date align cleanly. Confidence: {conf_pct}%."
            )
        elif not selected_ledger_id or norm_exception in ["UNMATCHED", "MISSING_IN_LEDGER"]:
            final_decision = ActionTaken.REJECT.value
            recon_status = "UNMATCHED"
            confidence = 0.0  # Unmatched is not a low-confidence match; it has zero match confidence
            explanation = "No credible ledger candidate was found."
        elif norm_exception in ["MISSING_IN_BANK", "LEDGER_ONLY"]:
            final_decision = ActionTaken.REJECT.value
            recon_status = "LEDGER_ONLY"
            confidence = 0.0
            explanation = "No corresponding bank transaction was found."
        else:
            final_decision = ActionTaken.ESCALATE_TO_HUMAN.value
            recon_status = "HUMAN_REVIEW"
            
            # Formulate structured explanation matching canonical audit requirements
            primary_reason = high_risk_anomalies[0] if high_risk_anomalies else (
                f"confidence ({conf_pct}%) is below configurable policy threshold ({Math_round_pct(pol.confidence_threshold)}%)"
            )

            if norm_exception == "DUPLICATE":
                explanation = "Equivalent ledger record has already been consumed by another bank transaction. Automatic reconciliation stopped to prevent duplicate posting."
                rec_action = "Verify if bank statement contains duplicate charge/deposit or if a secondary invoice exists."
            elif norm_exception == "PARTIAL_PAYMENT":
                explanation = "Candidate ledger record exists and reference matches, but bank payment is lower than ledger amount. Possible partial payment. Human review required."
                rec_action = "Confirm partial settlement and apply remaining balance to open invoice."
            elif norm_exception == "OVERPAYMENT":
                explanation = "Candidate ledger record exists and reference matches, but bank payment is higher than ledger amount. Possible overpayment. Human review required."
                rec_action = "Verify customer overpayment or credit note allocation with finance team."
            elif norm_exception == "AMOUNT_VARIANCE":
                if bank_tx and ledger_tx:
                    b_norm = bank_tx.normalized_amount
                    l_norm = ledger_tx.normalized_amount
                    diff = l_norm - b_norm
                    curr_str = bank_tx.currency or ledger_tx.currency or "USD"
                    diff_abs = abs(diff)
                    diff_formatted = f"${int(diff_abs)}" if curr_str == "USD" and diff_abs.is_integer() else format_currency(diff_abs, curr_str)
                    if diff > 0:
                        explanation = f"Candidate found and reference/currency evidence matches, but amount variance detected: bank amount is {diff_formatted} lower than ledger amount. Human review required."
                    elif diff < 0:
                        explanation = f"Candidate found and reference/currency evidence matches, but amount variance detected: bank amount is {diff_formatted} higher than ledger amount. Human review required."
                    else:
                        explanation = "Candidate found, but material amount variance detected. Human review required."
                else:
                    explanation = "Candidate found and reference/currency evidence matches, but amount variance detected. Human review required."
                rec_action = "Investigate bank fee deduction, discount difference, or currency conversion discrepancy."
            elif norm_exception == "FX_VARIANCE":
                explanation = f"Candidate found, but currency conflicts between bank ({bank_tx.currency if bank_tx else 'N/A'}) and ledger ({ledger_tx.currency if ledger_tx else 'N/A'}). Human review required."
                rec_action = "Verify multi-currency foreign exchange conversion rate and bank charges."
            elif norm_exception in ["TIMING_DIFFERENCE", "TIMING_MISMATCH"]:
                explanation = "Candidate found, but transaction timing exceeds acceptable settlement window. Human review required."
                rec_action = "Verify value date lag and posting date settlement."
            else:
                primary_reason = high_risk_anomalies[0] if high_risk_anomalies else (
                    f"confidence ({conf_pct}%) is below configurable policy threshold ({Math_round_pct(pol.confidence_threshold)}%)"
                )
                explanation = f"Candidate found, but stopped because {primary_reason}. Human review required."
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

        active_exceptions = []
        if norm_exception not in ["EXACT", "EXACT_MATCH"]:
            active_exceptions.append(norm_exception)
        for anomaly in high_risk_anomalies:
            if "amount variance" in anomaly.lower() and "AMOUNT_VARIANCE" not in active_exceptions:
                active_exceptions.append("AMOUNT_VARIANCE")
            elif "duplicate" in anomaly.lower() and "DUPLICATE" not in active_exceptions:
                active_exceptions.append("DUPLICATE")
            elif "ambiguity" in anomaly.lower() and "MULTIPLE_CANDIDATES" not in active_exceptions:
                active_exceptions.append("MULTIPLE_CANDIDATES")
            elif "currency" in anomaly.lower() and "FX_VARIANCE" not in active_exceptions:
                active_exceptions.append("FX_VARIANCE")

        return FinalDecisionOutput(
            decision=final_decision,
            confidence=confidence,
            reason=explanation,
            evidence=evidence,
            policy_checks=policy_checks,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S"),
            agent_version=agent_version_id,
            stop_reason_details=stop_details,
            match_confidence=confidence,
            auto_match_eligible=auto_match_eligible,
            reconciliation_status=recon_status,
            exception_types=active_exceptions
        )
