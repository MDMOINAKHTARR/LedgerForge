import time
from typing import Dict, Any, List
from backend.app.models.dataset_models import (
    SyntheticDatasetPackage, EvaluationMetricsResult, ExpectedAction, ExceptionCategory
)
from backend.app.models.pydantic_models import (
    TransactionSchema, AgentVersionSchema, ActionTaken, MatchType
)
from backend.app.services.matching_engine import MultiTierMatchingEngine

class EvaluationEngine:
    """
    Evaluates agent reconciliation output against ground-truth dataset.
    Calculates 12 objective metrics including safety metric FALSE_AUTO_POST_RATE.
    """
    
    @staticmethod
    def run_evaluation(
        dataset: SyntheticDatasetPackage,
        agent_version: AgentVersionSchema
    ) -> EvaluationMetricsResult:
        
        batch_id = f"eval_{dataset.seed}_{agent_version.id}"
        start_time = time.time()
        
        # Convert dataset Bank & Ledger items to standard TransactionSchema
        bank_txs = [
            TransactionSchema(
                id=b.transaction_id,
                batch_id=batch_id,
                source="BANK",
                date=b.date,
                amount=b.amount,
                currency=b.currency,
                description=b.description,
                reference_id=b.reference
            )
            for b in dataset.bank_transactions
        ]
        
        ledger_txs = [
            TransactionSchema(
                id=l.ledger_id,
                batch_id=batch_id,
                source="LEDGER",
                date=l.date,
                amount=l.amount,
                currency=l.currency,
                description=l.description,
                reference_id=l.reference,
                invoice_id=l.invoice_id
            )
            for l in dataset.ledger_transactions
        ]
        
        # Execute Matching Engine with agent version policy
        policy = agent_version.get_decision_policy()
        results, traces = MultiTierMatchingEngine.process_batch(
            batch_id=batch_id,
            bank_txs=bank_txs,
            ledger_txs=ledger_txs,
            agent_version=agent_version,
            policy=policy
        )
        
        total_time_ms = (time.time() - start_time) * 1000
        res_by_bank_id = {r.bank_tx_id: r for r in results}
        gt_by_bank_id = {gt.bank_transaction_id: gt for gt in dataset.ground_truth}
        bank_by_id = {b.transaction_id: b for b in dataset.bank_transactions}
        ledger_by_id = {l.ledger_id: l for l in dataset.ledger_transactions}
        
        total_cases = len(dataset.ground_truth)
        
        # Metric Counters
        correct_match_decisions = 0
        correct_action_decisions = 0
        correct_exception_types = 0
        
        true_matches = 0
        total_predicted_matches = 0
        total_gt_matches = sum(1 for gt in dataset.ground_truth if gt.expected_match_ledger_id is not None)
        
        correct_auto_reconcile = 0
        total_predicted_auto_reconcile = 0
        false_auto_posts = 0  # CRITICAL SAFETY VIOLATION
        
        # Granular safety metrics
        false_auto_match_count = 0
        currency_confusion_errors = 0
        high_risk_auto_match_count = 0
        duplicate_auto_match_count = 0
        direction_conflict_auto_match_count = 0
        amount_variance_auto_match_count = 0
        auto_matched_ledger_ids = set()

        correct_escalate = 0
        total_predicted_escalate = 0
        unnecessary_escalates = 0
        total_valid_auto_gt = sum(1 for gt in dataset.ground_truth if gt.expected_action == ExpectedAction.AUTO_RECONCILE)
        
        confidences: List[float] = []
        category_breakdown: Dict[str, Dict[str, Any]] = {}
        detailed_failures: List[Dict[str, Any]] = []
        
        for gt in dataset.ground_truth:
            b_id = gt.bank_transaction_id
            gt_ledger_id = gt.expected_match_ledger_id
            gt_action = gt.expected_action.value
            gt_exception = gt.exception_type.value
            
            b_item = bank_by_id.get(b_id)
            res = res_by_bank_id.get(b_id)
            if not res:
                detailed_failures.append({"bank_id": b_id, "error": "No result returned"})
                continue
                
            pred_ledger_id = res.ledger_tx_id
            pred_ledger = ledger_by_id.get(pred_ledger_id) if pred_ledger_id else None
            pred_action = res.action_taken.value
            pred_match_type = res.match_type.value
            confidence = res.confidence_score
            confidences.append(confidence)
            
            # Match decision correctness
            is_match_correct = (pred_ledger_id == gt_ledger_id)
            if is_match_correct:
                correct_match_decisions += 1
                if pred_ledger_id is not None:
                    true_matches += 1
                    
            if pred_ledger_id is not None:
                total_predicted_matches += 1
                
            # Map pred_action to expected action values for exact comparison
            pred_action_mapped = pred_action
            if pred_action in ["ESCALATE_TO_HUMAN", "REJECT"]:
                pred_action_mapped = "ESCALATE"
            elif pred_action == "AUTO_RECONCILE":
                pred_action_mapped = "AUTO_RECONCILE"
                
            gt_action_mapped = gt_action
            if gt_action in ["ESCALATE", "NO_MATCH"]:
                gt_action_mapped = "ESCALATE"
                
            # Action correctness
            is_action_correct = (pred_action_mapped == gt_action_mapped)
            if is_action_correct:
                correct_action_decisions += 1
                
            # Exception type classification correctness
            is_exception_correct = EvaluationEngine._check_exception_match(pred_match_type, gt_exception)
            if is_exception_correct:
                correct_exception_types += 1
                
            # Auto-Reconcile Counters & Granular Safety Gates
            if pred_action == ActionTaken.AUTO_RECONCILE.value:
                total_predicted_auto_reconcile += 1
                if is_match_correct and gt_action == ExpectedAction.AUTO_RECONCILE.value:
                    correct_auto_reconcile += 1
                else:
                    false_auto_posts += 1  # RISKY FALSE POSITIVE
                    false_auto_match_count += 1

                # Duplicate Safety Gate
                if gt_exception == ExceptionCategory.DUPLICATE.value:
                    duplicate_auto_match_count += 1
                elif pred_ledger_id and pred_ledger_id in auto_matched_ledger_ids:
                    duplicate_auto_match_count += 1
                if pred_ledger_id:
                    auto_matched_ledger_ids.add(pred_ledger_id)

                # Currency Safety Gate
                if pred_ledger and b_item:
                    if b_item.currency != pred_ledger.currency:
                        rules = agent_version.matching_rules or {}
                        fx_allowed = rules.get("enable_fx_tolerance_rule", False)
                        if gt_exception != ExceptionCategory.FX_VARIANCE.value or not fx_allowed:
                            currency_confusion_errors += 1
                        elif "INR" in [b_item.currency, pred_ledger.currency]:
                            # Hard invariant: Strict INR currency isolation
                            currency_confusion_errors += 1

                # Direction Conflict Safety Gate
                if pred_ledger and b_item:
                    if b_item.transaction_type == "DR" and pred_ledger.transaction_type == "DR":
                        direction_conflict_auto_match_count += 1

                # Material Variance Safety Gate
                if gt_exception in [ExceptionCategory.AMOUNT_DISCREPANCY.value, ExceptionCategory.PARTIAL_PAYMENT.value]:
                    amount_variance_auto_match_count += 1
                elif pred_ledger and b_item and gt_exception != ExceptionCategory.FX_VARIANCE.value:
                    diff = abs(b_item.amount - pred_ledger.amount)
                    rules = agent_version.matching_rules or {}
                    max_fee = rules.get("max_fee_amount", 50.0) if rules.get("enable_fee_deduction_rule", False) else 0.0
                    if diff > max_fee and diff > 0.01:
                        amount_variance_auto_match_count += 1

                # High-Risk Anomaly Auto-Match Gate
                if gt_exception in [
                    ExceptionCategory.DUPLICATE.value,
                    ExceptionCategory.AMOUNT_DISCREPANCY.value,
                    ExceptionCategory.PARTIAL_PAYMENT.value,
                    ExceptionCategory.MISSING_LEDGER.value,
                    ExceptionCategory.MISSING_BANK.value
                ]:
                    high_risk_auto_match_count += 1
                    
            # Escalate Counters
            if pred_action == ActionTaken.ESCALATE_TO_HUMAN.value or pred_action == ActionTaken.REJECT.value:
                total_predicted_escalate += 1
                if gt_action == ExpectedAction.ESCALATE.value or gt_action == ExpectedAction.NO_MATCH.value:
                    correct_escalate += 1
                elif gt_action == ExpectedAction.AUTO_RECONCILE.value:
                    unnecessary_escalates += 1
                    
            # Record detailed failure if incorrect
            if not is_match_correct or not is_action_correct:
                detailed_failures.append({
                    "bank_transaction_id": b_id,
                    "exception_category": gt_exception,
                    "expected_ledger_id": gt_ledger_id,
                    "predicted_ledger_id": pred_ledger_id,
                    "expected_action": gt_action,
                    "predicted_action": pred_action,
                    "confidence": confidence,
                    "reasoning": res.reasoning
                })
                
            # Category Breakdown
            if gt_exception not in category_breakdown:
                category_breakdown[gt_exception] = {"total": 0, "correct_matches": 0, "correct_actions": 0}
            category_breakdown[gt_exception]["total"] += 1
            if is_match_correct:
                category_breakdown[gt_exception]["correct_matches"] += 1
            if is_action_correct:
                category_breakdown[gt_exception]["correct_actions"] += 1

        # Calculate final metrics
        overall_acc = round((correct_match_decisions + correct_action_decisions) / (2 * max(1, total_cases)), 4)
        match_prec = round(true_matches / max(1, total_predicted_matches), 4) if total_predicted_matches > 0 else 1.0
        match_rec = round(true_matches / max(1, total_gt_matches), 4)
        exc_acc = round(correct_exception_types / max(1, total_cases), 4)
        
        auto_prec = round(correct_auto_reconcile / max(1, total_predicted_auto_reconcile), 4) if total_predicted_auto_reconcile > 0 else 1.0
        esc_prec = round(correct_escalate / max(1, total_predicted_escalate), 4) if total_predicted_escalate > 0 else 1.0
        
        # CRITICAL SAFETY METRIC
        false_auto_post_rate = round(false_auto_posts / max(1, total_cases), 4)
        false_escalation_rate = round(unnecessary_escalates / max(1, total_valid_auto_gt), 4)
        stp_rate = round(total_predicted_auto_reconcile / max(1, total_cases), 4)
        
        human_review_count = sum(
            1 for r in results
            if r.action_taken.value in [ActionTaken.ESCALATE_TO_HUMAN.value, ActionTaken.REJECT.value]
        )
        human_review_rate = round(human_review_count / max(1, total_cases), 4)

        unmatched_count = sum(
            1 for r in results
            if r.action_taken.value == ActionTaken.REJECT.value or r.ledger_tx_id is None or r.match_type.value == MatchType.UNMATCHED.value
        )
        unmatched_rate = round(unmatched_count / max(1, total_cases), 4)

        # Evaluate Hard Safety Gate Violations
        safety_violations: List[str] = []
        if false_auto_match_count > 0:
            safety_violations.append(f"{false_auto_match_count} false auto-match(es)")
        if currency_confusion_errors > 0:
            safety_violations.append(f"{currency_confusion_errors} currency confusion error(s)")
        if duplicate_auto_match_count > 0:
            safety_violations.append(f"{duplicate_auto_match_count} duplicate auto-match(es)")
        if direction_conflict_auto_match_count > 0:
            safety_violations.append(f"{direction_conflict_auto_match_count} direction conflict auto-match(es)")
        if amount_variance_auto_match_count > 0:
            safety_violations.append(f"{amount_variance_auto_match_count} material variance auto-match(es)")
        if high_risk_auto_match_count > 0:
            safety_violations.append(f"{high_risk_auto_match_count} high-risk auto-match(es)")

        safety_gates_passed = len(safety_violations) == 0

        avg_conf = round(sum(confidences) / max(1, len(confidences)), 4) if confidences else 0.0
        avg_latency = round(total_time_ms / max(1, total_cases), 2)
        total_cost = sum(t.cost_usd for t in traces)
        
        return EvaluationMetricsResult(
            agent_version=agent_version.id,
            dataset_name=f"synthetic_seed_{dataset.seed}",
            total_cases=total_cases,
            overall_accuracy=overall_acc,
            match_precision=match_prec,
            match_recall=match_rec,
            exception_classification_accuracy=exc_acc,
            auto_reconciliation_precision=auto_prec,
            escalation_precision=esc_prec,
            false_auto_post_rate=false_auto_post_rate,
            false_escalation_rate=false_escalation_rate,
            straight_through_processing_rate=stp_rate,
            average_confidence=avg_conf,
            avg_processing_latency_ms=avg_latency,
            estimated_token_cost_usd=round(total_cost, 6),
            false_auto_match_count=false_auto_match_count,
            human_review_rate=human_review_rate,
            unmatched_rate=unmatched_rate,
            currency_confusion_errors=currency_confusion_errors,
            high_risk_auto_match_count=high_risk_auto_match_count,
            duplicate_auto_match_count=duplicate_auto_match_count,
            direction_conflict_auto_match_count=direction_conflict_auto_match_count,
            amount_variance_auto_match_count=amount_variance_auto_match_count,
            safety_gates_passed=safety_gates_passed,
            safety_gate_violations=safety_violations,
            breakdown_by_category=category_breakdown,
            detailed_failures=detailed_failures
        )


    @staticmethod
    def _check_exception_match(pred_type: str, gt_type: str) -> bool:
        if pred_type == gt_type:
            return True
        # Equivalent map for semantic matches
        equiv = {
            "EXACT": "EXACT_MATCH",
            "TIMING_DIFFERENCE": "TIMING_MISMATCH",
            "FUZZY": "MEMO_MISMATCH",
            "BANK_FEE": "BANK_FEE",
            "FX_VARIANCE": "FX_VARIANCE",
            "DUPLICATE": "DUPLICATE",
            "PARTIAL_PAYMENT": "PARTIAL_PAYMENT",
            "MISSING_INVOICE": "MISSING_LEDGER",
            "UNMATCHED": "MISSING_LEDGER"
        }
        return equiv.get(pred_type) == gt_type
