import time
from typing import Dict, Any, List, Optional
from backend.app.models.pydantic_models import (
    NormalizedTransaction, CandidateMatchItem, DecisionPolicy, PolicyCheckItem,
    FinalDecisionOutput, ActionTaken, DecisionMemoryContext, MemoryTrustLevel,
    LLMReasoningOutput, SourceType
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
    Historical memory is advisory context only; it never inflates deterministic confidence or bypasses safety.
    """
    
    @staticmethod
    def evaluate_reconciliation_result(
        result: Any,
        policy: Optional[Any] = None,
        agent_version: Any = "v3",
        db: Optional[Any] = None,
        memory_context: Optional[DecisionMemoryContext] = None,
        llm_output: Optional[LLMReasoningOutput] = None,
        llm_agent: Optional[Any] = None
    ) -> FinalDecisionOutput:
        """
        Convenience wrapper evaluating an existing reconciliation result through decision policy checks.
        Wires the selected agent's configured DecisionPolicy, advisory historical memory, and controlled LLM reasoning into the decision evaluation.
        """
        actual_policy = None
        actual_version = agent_version if isinstance(agent_version, str) else getattr(agent_version, "id", "v3")

        if isinstance(policy, DecisionPolicy):
            actual_policy = policy
        elif hasattr(policy, "get_decision_policy"):
            actual_policy = policy.get_decision_policy()
            if hasattr(policy, "id"):
                actual_version = getattr(policy, "id", actual_version)
        elif isinstance(policy, str):
            actual_version = policy

        # If policy not explicitly provided, resolve from agent_version
        if actual_policy is None:
            if hasattr(agent_version, "get_decision_policy"):
                actual_policy = agent_version.get_decision_policy()
            elif isinstance(agent_version, str) and agent_version:
                try:
                    from backend.app.services.agent_registry import AgentRegistry
                    reg_agent = AgentRegistry.get_version_by_id(agent_version)
                    if reg_agent and hasattr(reg_agent, "get_decision_policy"):
                        actual_policy = reg_agent.get_decision_policy()
                except Exception:
                    actual_policy = None

        bank_tx = getattr(result, "bank_tx", None)
        ledger_tx = getattr(result, "ledger_tx", None)
        selected_ledger_id = getattr(result, "ledger_tx_id", None)
        confidence = getattr(result, "confidence_score", 0.0)
        evidence = getattr(result, "evidence", []) or []
        match_type = getattr(result, "match_type", "EXACT")
        exception_type = match_type.value if hasattr(match_type, "value") else str(match_type)
        norm_exc = exception_type.upper()

        # Step 5: Advisory Historical Memory Retrieval for Reconciliation Exceptions
        if memory_context is None and db is not None:
            MEMORY_ELIGIBLE_EXCEPTIONS = {
                "TIMING_DIFFERENCE", "TIMING_MISMATCH",
                "AMOUNT_VARIANCE", "AMOUNT_DISCREPANCY",
                "PARTIAL_PAYMENT", "OVERPAYMENT",
                "DUPLICATE", "DUPLICATE_TRANSACTION",
                "CURRENCY_ISSUE", "FX_VARIANCE",
                "BANK_FEE",
                "MISSING_IN_LEDGER", "MISSING_LEDGER",
                "MISSING_IN_BANK", "MISSING_BANK",
                "UNMATCHED", "LEDGER_ONLY",
                "FUZZY", "MEMO_MISMATCH",
                "MULTIPLE_CANDIDATES"
            }
            # Straightforward exact matches do not need memory lookup
            is_exact = norm_exc in ["EXACT", "EXACT_MATCH"]
            if not is_exact or norm_exc in MEMORY_ELIGIBLE_EXCEPTIONS:
                try:
                    from backend.app.services.memory_service import ReconciliationMemoryService
                    mem_ctx = ReconciliationMemoryService.build_context_from_transaction(
                        bank_tx=bank_tx,
                        ledger_tx=ledger_tx,
                        exception_type=exception_type
                    )
                    if mem_ctx and mem_ctx.currency:
                        mem_res = ReconciliationMemoryService.retrieve_relevant_feedback(
                            context=mem_ctx,
                            db=db,
                            exclude_result_id=getattr(result, "id", None)
                        )
                        if mem_res and mem_res.total_candidates_found > 0:
                            memory_context = ReconciliationMemoryService.to_decision_context(mem_res)
                except Exception:
                    # Memory retrieval failure must never crash reconciliation decision pipeline
                    memory_context = None

        # Step 6: Controlled LLM Specialist Reasoning for Ambiguous Cases
        cand_items = getattr(result, "candidate_matches", []) or []
        if llm_output is None:
            from backend.app.services.llm_agent import LLMReasoningAgent
            agent_cls = llm_agent or LLMReasoningAgent
            should_invoke, invoke_reason = agent_cls.should_invoke_llm(
                bank_tx=bank_tx,
                ledger_tx=ledger_tx,
                match_type=exception_type,
                confidence=confidence,
                candidate_matches=cand_items,
                memory_context=memory_context
            )
            if should_invoke:
                cand_pool: List[NormalizedTransaction] = []
                if ledger_tx:
                    cand_pool.append(ledger_tx)
                if db is not None and cand_items:
                    for ci in cand_items:
                        ci_id = getattr(ci, "ledger_id", None)
                        if ci_id and not any(c.id == ci_id for c in cand_pool):
                            from backend.app.models.db import DBTransaction
                            b_id = getattr(result, "batch_id", "")
                            db_t = db.query(DBTransaction).filter(
                                (DBTransaction.id == ci_id) |
                                ((DBTransaction.batch_id == b_id) & (DBTransaction.id == f"{b_id}_ledger_{ci_id}"))
                            ).first()
                            if db_t:
                                cand_pool.append(NormalizedTransaction(
                                    id=ci_id,
                                    source=SourceType.LEDGER,
                                    date=db_t.date,
                                    amount=db_t.amount,
                                    normalized_amount=abs(db_t.amount),
                                    currency=db_t.currency,
                                    description=db_t.description,
                                    reference=db_t.reference_id
                                ))
                reasoning_input = agent_cls.build_reasoning_input(
                    bank_tx=bank_tx,
                    ledger_candidates=cand_pool,
                    deterministic_evidence=evidence,
                    deterministic_confidence=confidence,
                    exception_category=exception_type,
                    memory_context=memory_context,
                    invocation_reason=invoke_reason or "AMBIGUITY"
                )
                llm_output = agent_cls.reason_exception(
                    reasoning_input=reasoning_input,
                    candidate_pool=cand_pool,
                    bank_tx=bank_tx
                )
        
        return DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            selected_ledger_id=selected_ledger_id,
            confidence=confidence,
            evidence=evidence,
            exception_type=exception_type,
            candidate_matches=cand_items,
            policy=actual_policy,
            agent_version_id=str(actual_version),
            memory_context=memory_context,
            llm_output=llm_output
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
        agent_version_id: str = "v3",
        memory_context: Optional[DecisionMemoryContext] = None,
        llm_output: Optional[LLMReasoningOutput] = None
    ) -> FinalDecisionOutput:
        
        evidence = list(evidence or [])
        candidate_matches = candidate_matches or []

        # Resolve policy: if not provided directly, attempt resolution via agent_version_id
        pol = policy
        if pol is None and agent_version_id:
            try:
                from backend.app.services.agent_registry import AgentRegistry
                reg_agent = AgentRegistry.get_version_by_id(agent_version_id)
                if reg_agent and hasattr(reg_agent, "get_decision_policy"):
                    pol = reg_agent.get_decision_policy()
            except Exception:
                pol = None

        if pol is None:
            pol = DecisionPolicy()
        policy_checks: List[PolicyCheckItem] = []
        high_risk_anomalies: List[str] = []
        conflicting_evidence: List[str] = []
        supporting_evidence: List[str] = list(evidence)
        
        # Incorporate advisory historical memory context (if present)
        if memory_context and memory_context.has_memory:
            for adv in memory_context.advisory_evidence:
                if adv not in evidence:
                    evidence.append(adv)
                if adv not in supporting_evidence:
                    supporting_evidence.append(adv)

        # Incorporate advisory LLM reasoning context (if present)
        if llm_output:
            if llm_output.reasoning:
                llm_reason_str = f"[LLM REASONING] ({llm_output.invocation_reason or 'AMBIGUITY'}): {llm_output.reasoning}"
                if llm_reason_str not in evidence:
                    evidence.append(llm_reason_str)
                if llm_reason_str not in supporting_evidence:
                    supporting_evidence.append(llm_reason_str)
            for fact in llm_output.evidence_used:
                fact_str = f"[LLM EVIDENCE] {fact}"
                if fact_str not in evidence:
                    evidence.append(fact_str)
            for cont in llm_output.contradictions:
                cont_str = f"[LLM CONTRADICTION] {cont}"
                if cont_str not in conflicting_evidence:
                    conflicting_evidence.append(cont_str)
            if not llm_output.validation_passed or llm_output.requires_human_review:
                flag_msg = f"LLM specialist requires human confirmation: {llm_output.recommendation}"
                if not any("LLM specialist" in a for a in high_risk_anomalies):
                    high_risk_anomalies.append(flag_msg)
        
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

        # Check 4G: Historical Memory Conflict Override
        if memory_context and (memory_context.has_conflict or memory_context.trust_level == MemoryTrustLevel.CONFLICTING):
            breakdown_str = ", ".join(f"{k}: {v}" for k, v in (memory_context.conflict_details or {}).items())
            conflict_msg = f"Historical memory conflict: precedent resolutions disagree ({breakdown_str})"
            if not any("Historical memory conflict" in a for a in high_risk_anomalies):
                high_risk_anomalies.append(conflict_msg)
                conflicting_evidence.append(conflict_msg)

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
            if memory_context and memory_context.has_memory:
                stop_details["historical_memory"] = memory_context.to_compact_audit_dict()
                if memory_context.predominant_resolution:
                    stop_details["historical_precedent_recommendation"] = memory_context.predominant_resolution
                    if not memory_context.has_conflict and rec_action:
                        rec_action = f"{rec_action} (Historical precedent suggests: {memory_context.predominant_resolution})"
                        stop_details["recommended_action"] = rec_action
            if llm_output:
                stop_details["llm_reasoning"] = llm_output.to_compact_audit_dict()
                stop_details["llm_recommendation"] = llm_output.recommendation

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
            exception_types=active_exceptions,
            memory_context=memory_context,
            llm_output=llm_output
        )
