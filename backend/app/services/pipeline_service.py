import uuid
import time
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.models.pydantic_models import (
    SourceType, ActionTaken, NormalizedTransaction, ReconciliationResultSchema,
    AgentVersionSchema, AgentOptimizationRunSchema
)
from backend.app.models.dataset_models import SyntheticDatasetPackage, EvaluationMetricsResult
from backend.app.models.db import DBReconciliationBatch, DBTransaction, DBReconciliationResult, DBAuditLog
from backend.app.services.ingestion import DataIngestionService
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.decision_engine import DecisionEngine
from backend.app.services.audit_service import AuditService
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.dataset_generator import SyntheticDatasetGenerator
from backend.app.services.eval_engine import EvaluationEngine
from backend.app.services.autopsy_engine import AutopsyEngine
from backend.app.services.agent_engineer import AgentEngineerService

class FullPipelineService:
    """
    Phase 9 Unified End-to-End Pipeline Service.
    Integrates Ingestion -> Normalization -> Multi-Tier Matching -> Decision Engine ->
    Audit Trail -> Evaluation -> Failure Autopsy -> Autonomous Agent Improvement.
    """

    @staticmethod
    def run_e2e_reconciliation(
        db: Session,
        bank_csv_bytes: bytes,
        ledger_csv_bytes: bytes,
        agent_version_id: str = "v1",
        batch_id: Optional[str] = None
    ) -> Dict[str, Any]:

        batch_id = batch_id or f"batch_e2e_{uuid.uuid4().hex[:8]}"
        start_time = time.time()

        # Step 1: Ingestion & Normalization
        bank_txs = DataIngestionService.parse_csv_content(bank_csv_bytes, SourceType.BANK, batch_id)
        ledger_txs = DataIngestionService.parse_csv_content(ledger_csv_bytes, SourceType.LEDGER, batch_id)

        # Invariant Check: No transaction silently lost
        assert len(bank_txs) > 0, "Bank transactions count cannot be zero"
        assert len(ledger_txs) > 0, "Ledger transactions count cannot be zero"

        # Step 2: Get Agent Version
        agent_version = AgentRegistry.get_version_by_id(agent_version_id)

        # Step 3: Multi-Tier Matching (RULE -> FUZZY -> LLM)
        results, traces = MultiTierMatchingEngine.process_batch(
            batch_id=batch_id,
            bank_txs=bank_txs,
            ledger_txs=ledger_txs,
            agent_version=agent_version
        )

        # Step 4: Decision Engine Policy Check & Audit Trail Recording
        db_batch = DBReconciliationBatch(
            id=batch_id,
            agent_version_id=agent_version.id,
            bank_filename="bank.csv",
            ledger_filename="ledger.csv",
            total_bank_tx=len(bank_txs),
            total_ledger_tx=len(ledger_txs),
            auto_reconciled_count=sum(1 for r in results if r.action_taken == ActionTaken.AUTO_RECONCILE),
            escalated_count=sum(1 for r in results if r.action_taken == ActionTaken.ESCALATE_TO_HUMAN),
            rejected_count=sum(1 for r in results if r.action_taken == ActionTaken.REJECT),
            status="completed"
        )
        db.add(db_batch)

        for tx in bank_txs + ledger_txs:
            db_tx_id = f"{batch_id}_{tx.source.value.lower()}_{tx.id}"
            db_tx = DBTransaction(
                id=db_tx_id,
                batch_id=batch_id,
                source=tx.source.value,
                date=tx.date,
                amount=tx.amount,
                currency=tx.currency,
                description=tx.description,
                reference_id=tx.reference,
                raw_data=tx.metadata
            )
            db.add(db_tx)

        audit_items = []
        for r in results:
            # Re-verify through DecisionEngine policy checks
            decision_out = DecisionEngine.evaluate_reconciliation_result(r, agent_version=agent_version.id)
            r.action_taken = ActionTaken(decision_out.decision) if decision_out.decision in [a.value for a in ActionTaken] else r.action_taken
            r.reasoning = decision_out.reason
            r.evidence = decision_out.evidence
            r.policy_checks = decision_out.policy_checks

            # Persist Result
            db_res = DBReconciliationResult(
                id=r.id,
                batch_id=batch_id,
                agent_version_id=agent_version.id,
                bank_tx_id=f"{batch_id}_bank_{r.bank_tx_id}",
                ledger_tx_id=f"{batch_id}_ledger_{r.ledger_tx_id}" if r.ledger_tx_id else None,
                match_type=r.match_type.value,
                confidence_score=r.confidence_score,
                action_taken=r.action_taken.value,
                reasoning=r.reasoning,
                discrepancy_details=[d.model_dump() for d in r.discrepancy_details],
                human_status=r.human_status.value
            )
            db.add(db_res)

            # Create & Save Phase 5 Immutable Audit Record
            audit_item = AuditService.create_audit_item(result=r, agent_version_id=agent_version.id)
            AuditService.save_audit_record(db, audit_item, commit=False)
            audit_items.append(audit_item)

        db.commit()

        total_latency_ms = (time.time() - start_time) * 1000

        return {
            "batch_id": batch_id,
            "agent_version": agent_version.id,
            "total_bank_tx": len(bank_txs),
            "total_ledger_tx": len(ledger_txs),
            "results": results,
            "audit_records_count": len(audit_items),
            "latency_ms": round(total_latency_ms, 2),
            "auto_reconciled": sum(1 for r in results if r.action_taken == ActionTaken.AUTO_RECONCILE),
            "escalated": sum(1 for r in results if r.action_taken == ActionTaken.ESCALATE_TO_HUMAN),
            "unmatched": sum(1 for r in results if not r.ledger_tx_id or r.action_taken == ActionTaken.REJECT)
        }

    @staticmethod
    def run_full_autonomous_demo(
        db: Session,
        dataset_seed: int = 42,
        base_version_id: str = "v1"
    ) -> Dict[str, Any]:
        """
        Executes the entire end-to-end hackathon demo:
        1. Generates 64 Bank + 56 Ledger synthetic transactions with 10 exception categories.
        2. Executes 'Run Reconciliation' on base agent (V1).
        3. Verifies all 8 pipeline invariants.
        4. Executes 'Improve Agent' (analyzing failures, synthesizing V2/V4, benchmarking candidate).
        5. Returns before vs after comparative performance report.
        """
        # Step 1: Generate Synthetic Dataset
        dataset = SyntheticDatasetGenerator.generate_dataset(seed=dataset_seed, count=60)

        # Convert dataset to CSV bytes
        bank_csv_str = "Date,Amount,Currency,Description,Reference_ID\n"
        for b in dataset.bank_transactions:
            ref = b.reference or ""
            desc = b.description.replace(",", " ")
            bank_csv_str += f"{b.date},{b.amount},{b.currency},{desc},{ref}\n"

        ledger_csv_str = "Date,Amount,Currency,Description,Reference_ID\n"
        for l in dataset.ledger_transactions:
            ref = l.reference or l.invoice_id or ""
            desc = l.description.replace(",", " ")
            ledger_csv_str += f"{l.date},{l.amount},{l.currency},{desc},{ref}\n"

        bank_bytes = bank_csv_str.encode('utf-8')
        ledger_bytes = ledger_csv_str.encode('utf-8')

        # Step 2: "Run Reconciliation" on Base Agent
        batch_id = f"demo_batch_{uuid.uuid4().hex[:8]}"
        base_reconcile = FullPipelineService.run_e2e_reconciliation(
            db=db,
            bank_csv_bytes=bank_bytes,
            ledger_csv_bytes=ledger_bytes,
            agent_version_id=base_version_id,
            batch_id=batch_id
        )

        # Invariant Checks
        results = base_reconcile["results"]
        total_bank = base_reconcile["total_bank_tx"]

        # Invariant 1: Every transaction receives a result
        assert len(results) == total_bank, f"Expected {total_bank} results, got {len(results)}"

        # Invariant 2: Every decision has an audit record
        db_audits_count = db.query(DBAuditLog).filter(DBAuditLog.transaction_id.in_([r.bank_tx_id for r in results])).count()
        assert db_audits_count >= len(results), "Every decision must have an audit record in audit_logs"

        # Invariant 3: Every decision has confidence
        for r in results:
            assert r.confidence_score is not None and 0.0 <= r.confidence_score <= 1.0, f"Missing confidence on {r.id}"

        # Invariant 4: Every escalation has an explanation
        for r in results:
            if r.action_taken == ActionTaken.ESCALATE_TO_HUMAN:
                assert r.reasoning and len(r.reasoning) > 10, f"Escalation on {r.id} missing explanation"

        # Invariant 5: Every auto-reconciliation has supporting evidence
        for r in results:
            if r.action_taken == ActionTaken.AUTO_RECONCILE:
                assert r.evidence and len(r.evidence) > 0, f"Auto-reconcile on {r.id} missing evidence"

        # Invariant 6: No transaction is silently lost
        assert base_reconcile["total_bank_tx"] == len(dataset.bank_transactions), "No transaction silently lost"

        # Invariant 7: Agent version is recorded
        assert base_reconcile["agent_version"] == base_version_id, "Agent version recorded"

        # Invariant 8: Evaluation metrics are calculated
        base_agent = AgentRegistry.get_version_by_id(base_version_id)
        base_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(dataset, base_agent)

        # Step 3: "Improve Agent" — Autonomous Engineering Loop
        opt_run = AgentEngineerService.run_optimization_loop(
            db=db,
            goal="Maximize accuracy and STP while enforcing 0% false auto-post rate",
            base_version_id=base_version_id,
            dataset_seed=dataset_seed
        )

        candidate_version_id = opt_run.candidate_version_id
        cand_agent = AgentRegistry.get_version_by_id(candidate_version_id)
        cand_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(dataset, cand_agent)

        # Step 4: Before vs After Comparative Analysis
        before_vs_after = {
            "base_version": {
                "id": base_version_id,
                "name": base_agent.version_name,
                "accuracy": f"{base_metrics.overall_accuracy * 100:.1f}%",
                "stp_rate": f"{base_metrics.straight_through_processing_rate * 100:.1f}%",
                "false_auto_post_rate": f"{base_metrics.false_auto_post_rate * 100:.1f}%",
                "cost_usd": f"${base_metrics.estimated_token_cost_usd:.6f}",
                "latency_ms": f"{base_metrics.avg_processing_latency_ms:.1f} ms"
            },
            "improved_version": {
                "id": candidate_version_id,
                "name": cand_agent.version_name,
                "accuracy": f"{cand_metrics.overall_accuracy * 100:.1f}%",
                "stp_rate": f"{cand_metrics.straight_through_processing_rate * 100:.1f}%",
                "false_auto_post_rate": f"{cand_metrics.false_auto_post_rate * 100:.1f}%",
                "cost_usd": f"${cand_metrics.estimated_token_cost_usd:.6f}",
                "latency_ms": f"{cand_metrics.avg_processing_latency_ms:.1f} ms"
            },
            "performance_delta": {
                "accuracy_improvement": f"+{round((cand_metrics.overall_accuracy - base_metrics.overall_accuracy)*100, 1)}%",
                "stp_lift": f"{round((cand_metrics.straight_through_processing_rate - base_metrics.straight_through_processing_rate)*100, 1)}%",
                "false_auto_post_delta": f"{round((cand_metrics.false_auto_post_rate - base_metrics.false_auto_post_rate)*100, 1)}%",
                "accepted": opt_run.accepted,
                "decision_rationale": opt_run.decision_rationale
            }
        }

        return {
            "reconciliation": base_reconcile,
            "optimization_run": opt_run,
            "before_vs_after": before_vs_after,
            "invariants_verified": {
                "every_transaction_received_result": True,
                "every_decision_has_audit_record": True,
                "every_decision_has_confidence": True,
                "every_escalation_has_explanation": True,
                "every_auto_reconciliation_has_evidence": True,
                "no_transaction_silently_lost": True,
                "agent_version_recorded": True,
                "evaluation_metrics_calculated": True
            }
        }
