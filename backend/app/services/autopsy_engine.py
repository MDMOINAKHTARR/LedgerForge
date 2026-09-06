import uuid
import time
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.models.dataset_models import SyntheticDatasetPackage, GroundTruthAnnotation
from backend.app.models.pydantic_models import (
    SingleAutopsyResult, AggregateAutopsyReport, AutopsyFailureType, SeverityLevel,
    ReconciliationResultSchema, AgentVersionSchema
)
from backend.app.models.db import DBAutopsyReport, DBAuditLog
from backend.app.services.eval_engine import EvaluationEngine
from backend.app.services.agent_registry import AgentRegistry

class AutopsyEngine:
    """
    Phase 7 Agent Autopsy & Failure Analysis Engine.
    Performs deep forensic analysis on reconciliation agent failures.
    Answers 5 core diagnostic questions for every error and aggregates percentage error distributions.
    """

    @staticmethod
    def analyze_single_transaction_failure(
        bank_tx_id: str,
        predicted_result: ReconciliationResultSchema,
        ground_truth: GroundTruthAnnotation
    ) -> SingleAutopsyResult:

        pred_match = predicted_result.ledger_tx_id
        expected_match = ground_truth.expected_match_ledger_id
        pred_action = predicted_result.action_taken.value if hasattr(predicted_result.action_taken, "value") else str(predicted_result.action_taken)
        expected_action = ground_truth.expected_action.value if hasattr(ground_truth.expected_action, "value") else str(ground_truth.expected_action)
        exc_category = ground_truth.exception_type.value if hasattr(ground_truth.exception_type, "value") else str(ground_truth.exception_type)

        missing_evidence: List[str] = []
        evidence_used: List[str] = predicted_result.evidence or []

        # Determine Stage & Failure Type
        if pred_action == "AUTO_RECONCILE" and expected_action != "AUTO_RECONCILE":
            failure_stage = "DECISION_STAGE"
            failure_type = AutopsyFailureType.DECISION
            severity = SeverityLevel.CRITICAL
            root_cause = f"Decision Policy auto-posted an item with category '{exc_category}'. High-risk override check failed to escalate."
            missing_evidence.append(f"Verification rule for {exc_category} exception type")
            rec_change = "Introduce mandatory human escalation check for non-exact exception categories before AUTO_RECONCILE."
            expected_impact = "Eliminates false auto-posts and prevents unsafe automated ledger updates."

        elif exc_category in ["BANK_FEE", "FX_VARIANCE"] and pred_match != expected_match:
            failure_stage = "LLM_STAGE"
            failure_type = AutopsyFailureType.VERIFICATION
            severity = SeverityLevel.HIGH
            root_cause = f"Agent failed to reconcile net variance caused by {exc_category} deduction."
            missing_evidence.append("Intermediary fee/FX variance clearing calculation step")
            rec_change = "Add fee deduction verification rule (e.g. up to $50 margin) and FX tolerance calculation."
            expected_impact = "Improves match accuracy on wire fee and FX variance transactions by ~35%."

        elif exc_category == "TIMING_MISMATCH":
            failure_stage = "FUZZY_STAGE"
            failure_type = AutopsyFailureType.MATCHING
            severity = SeverityLevel.MEDIUM
            root_cause = "Candidate search window was too narrow to capture clearing date delay."
            missing_evidence.append("Extended date clearing window (> 7 days)")
            rec_change = "Expand heuristic clearing window from 3 days to 10 days."
            expected_impact = "Captures delayed weekend & bank holiday clearing transactions."

        elif exc_category == "DUPLICATE":
            failure_stage = "MATCHING_STAGE"
            failure_type = AutopsyFailureType.ORCHESTRATION
            severity = SeverityLevel.HIGH
            root_cause = "Multiple bank deposits matched a single ledger record without candidate deduplication."
            missing_evidence.append("Duplicate candidate ledger record count check")
            rec_change = "Enforce duplicate candidate escalation guardrail in Decision Policy."
            expected_impact = "Prevents double-counting bank deposits against single invoice records."

        elif predicted_result.confidence_score < 0.90 and pred_action == "AUTO_RECONCILE":
            failure_stage = "DECISION_STAGE"
            failure_type = AutopsyFailureType.CONFIDENCE
            severity = SeverityLevel.HIGH
            root_cause = f"Confidence score ({predicted_result.confidence_score*100:.1f}%) was below threshold (90.0%) but item was auto-reconciled."
            missing_evidence.append("Confidence threshold enforcement check")
            rec_change = "Strictly enforce minimum 0.90 confidence threshold check."
            expected_impact = "Ensures only high-confidence matches are automatically posted."

        else:
            failure_stage = "PROMPT"
            failure_type = AutopsyFailureType.PROMPT
            severity = SeverityLevel.MEDIUM
            root_cause = f"Agent misclassified or failed to resolve '{exc_category}' due to vague system prompt guidance."
            missing_evidence.append("Explicit few-shot example for target exception category")
            rec_change = "Enhance system prompt with domain-specific few-shot examples."
            expected_impact = "Boosts exception classification precision."

        return SingleAutopsyResult(
            transaction_id=bank_tx_id,
            predicted_match=pred_match,
            expected_match=expected_match,
            predicted_action=pred_action,
            expected_action=expected_action,
            failure_stage=failure_stage,
            missing_or_misinterpreted_evidence=missing_evidence,
            failure_type=failure_type,
            severity=severity,
            root_cause=root_cause,
            evidence=evidence_used,
            recommended_change=rec_change,
            expected_impact=expected_impact
        )

    @staticmethod
    def run_dataset_autopsy(
        db: Session,
        dataset: SyntheticDatasetPackage,
        agent_version: AgentVersionSchema
    ) -> AggregateAutopsyReport:

        autopsy_id = f"autopsy_{uuid.uuid4().hex[:8]}"
        now_str = time.strftime("%Y-%m-%d %H:%M:%S")

        # 1. Run Evaluation to gather predictions & errors
        eval_metrics = EvaluationEngine.run_evaluation(dataset, agent_version)

        # Map predictions by bank transaction ID
        batch_id = f"eval_{dataset.seed}_{agent_version.id}"
        results, traces = EvaluationEngine._last_results if hasattr(EvaluationEngine, "_last_results") else ([], [])
        
        # If last results not cached, execute engine
        from backend.app.models.pydantic_models import NormalizedTransaction, SourceType
        from backend.app.services.matching_engine import MultiTierMatchingEngine

        bank_txs = [
            NormalizedTransaction(
                id=b.transaction_id,
                source=SourceType.BANK,
                date=b.date,
                amount=b.amount,
                currency=b.currency,
                description=b.description,
                reference=b.reference,
                transaction_type=b.transaction_type
            )
            for b in dataset.bank_transactions
        ]
        ledger_txs = [
            NormalizedTransaction(
                id=l.ledger_id,
                source=SourceType.LEDGER,
                date=l.date,
                amount=l.amount,
                currency=l.currency,
                description=l.description,
                reference=l.reference,
                counterparty=l.vendor_customer,
                invoice_id=l.invoice_id,
                transaction_type="CR"
            )
            for l in dataset.ledger_transactions
        ]
        
        results, _ = MultiTierMatchingEngine.process_batch(
            batch_id=batch_id,
            bank_txs=bank_txs,
            ledger_txs=ledger_txs,
            agent_version=agent_version
        )

        res_by_bank_id = {r.bank_tx_id: r for r in results}

        single_autopsies: List[SingleAutopsyResult] = []
        failure_type_breakdown: Dict[str, int] = {ft.value: 0 for ft in AutopsyFailureType}

        for gt in dataset.ground_truth:
            b_id = gt.bank_transaction_id
            res = res_by_bank_id.get(b_id)
            if not res:
                continue

            pred_match = res.ledger_tx_id
            expected_match = gt.expected_match_ledger_id
            pred_action = res.action_taken.value if hasattr(res.action_taken, "value") else str(res.action_taken)
            gt_action = gt.expected_action.value if hasattr(gt.expected_action, "value") else str(gt.expected_action)

            # Check if discrepancy exists
            is_match_err = (pred_match != expected_match)
            is_action_err = (pred_action != gt_action and not (pred_action in ["ESCALATE_TO_HUMAN", "REJECT"] and gt_action in ["ESCALATE", "NO_MATCH"]))

            if is_match_err or is_action_err:
                autopsy = AutopsyEngine.analyze_single_transaction_failure(b_id, res, gt)
                single_autopsies.append(autopsy)
                failure_type_breakdown[autopsy.failure_type.value] += 1

        total_failures = len(single_autopsies)
        total_evaluated = len(dataset.ground_truth)

        # Calculate percentage distribution across 11 failure types
        failure_percentage_distribution: Dict[str, float] = {}
        for ft_key, count in failure_type_breakdown.items():
            pct = round((count / max(1, total_failures)) * 100.0, 1) if total_failures > 0 else 0.0
            failure_percentage_distribution[ft_key] = pct

        top_ft_str = max(failure_type_breakdown, key=failure_type_breakdown.get) if total_failures > 0 else AutopsyFailureType.DECISION.value
        top_failure_type = AutopsyFailureType(top_ft_str)
        top_pct = failure_percentage_distribution.get(top_ft_str, 0.0)

        # Formulate dataset-wide architectural recommendations
        dataset_recommendations: List[str] = []
        if failure_percentage_distribution.get("DECISION", 0.0) > 20.0:
            dataset_recommendations.append(f"{failure_percentage_distribution['DECISION']:.1f}% of errors stem from Decision Policy misconfigurations. Enforce strict escalation on unallowed exception categories.")
        if failure_percentage_distribution.get("VERIFICATION", 0.0) > 15.0:
            dataset_recommendations.append(f"{failure_percentage_distribution['VERIFICATION']:.1f}% of errors stem from missing verification checks. Introduce explicit amount-variance and fee deduction verification steps.")
        if failure_percentage_distribution.get("MATCHING", 0.0) > 15.0:
            dataset_recommendations.append(f"{failure_percentage_distribution['MATCHING']:.1f}% of errors come from clearing date window limits. Expand heuristic search window to 10 days.")
        if not dataset_recommendations:
            dataset_recommendations.append("Overall agent performance is stable. Continue fine-tuning confidence thresholds.")

        exec_summary = (
            f"Agent Autopsy completed for '{agent_version.id}' on '{dataset.seed}' dataset. "
            f"Evaluated {total_evaluated} transactions, identifying {total_failures} failures. "
            f"Top failure mode: '{top_failure_type.value}' ({top_pct:.1f}% of total errors). "
            f"Key Recommendation: {dataset_recommendations[0]}"
        )

        report = AggregateAutopsyReport(
            autopsy_id=autopsy_id,
            created_at=now_str,
            agent_version_id=agent_version.id,
            dataset_name=f"synthetic_seed_{dataset.seed}",
            total_evaluated=total_evaluated,
            total_failures=total_failures,
            failure_type_breakdown=failure_type_breakdown,
            failure_percentage_distribution=failure_percentage_distribution,
            top_failure_type=top_failure_type,
            single_autopsies=single_autopsies,
            dataset_recommendations=dataset_recommendations,
            executive_summary=exec_summary
        )

        # Persist report into SQLite database
        db_autopsy = DBAutopsyReport(
            id=autopsy_id,
            agent_version_id=agent_version.id,
            dataset_name=report.dataset_name,
            total_evaluated=total_evaluated,
            total_failures=total_failures,
            failure_type_breakdown=failure_type_breakdown,
            failure_percentage_distribution=failure_percentage_distribution,
            top_failure_type=top_failure_type.value,
            single_autopsies_json=[a.model_dump() for a in single_autopsies],
            dataset_recommendations_json=dataset_recommendations,
            executive_summary=exec_summary
        )
        db.add(db_autopsy)
        db.commit()

        return report
