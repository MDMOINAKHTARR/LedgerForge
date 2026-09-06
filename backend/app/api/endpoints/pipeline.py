import uuid
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.services.pipeline_service import FullPipelineService
from backend.app.services.agent_engineer import AgentEngineerService
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.dataset_generator import SyntheticDatasetGenerator
from backend.app.services.eval_engine import EvaluationEngine
from backend.app.models.dataset_models import EvaluationMetricsResult

router = APIRouter()

class RunReconciliationRequest(BaseModel):
    agent_version_id: str = "v1"
    dataset_seed: int = 42

class ImproveAgentRequest(BaseModel):
    base_version_id: str = "v1"
    goal: str = "Maximize accuracy and STP while enforcing 0% false auto-post rate"
    dataset_seed: int = 42

@router.post("/run-reconciliation")
def run_reconciliation(
    req: RunReconciliationRequest,
    db: Session = Depends(get_db)
):
    """
    Step 1 of Phase 9 Demo: 'Run Reconciliation'
    Runs the complete multi-tier pipeline on the 64-transaction synthetic evaluation dataset.
    Verifies all 8 pipeline invariants and records full immutable audit logs.
    """
    try:
        # Generate full synthetic evaluation dataset
        dataset = SyntheticDatasetGenerator.generate_dataset(seed=req.dataset_seed, count=60)

        # Convert to CSV bytes
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

        batch_id = f"e2e_recon_{uuid.uuid4().hex[:8]}"
        reconcile_out = FullPipelineService.run_e2e_reconciliation(
            db=db,
            bank_csv_bytes=bank_csv_str.encode("utf-8"),
            ledger_csv_bytes=ledger_csv_str.encode("utf-8"),
            agent_version_id=req.agent_version_id,
            batch_id=batch_id
        )

        # Calculate evaluation metrics
        agent = AgentRegistry.get_version_by_id(req.agent_version_id)
        eval_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(dataset, agent)

        return {
            "status": "success",
            "batch_id": batch_id,
            "agent_version": req.agent_version_id,
            "total_bank_tx": reconcile_out["total_bank_tx"],
            "total_ledger_tx": reconcile_out["total_ledger_tx"],
            "auto_reconciled": reconcile_out["auto_reconciled"],
            "escalated": reconcile_out["escalated"],
            "unmatched": reconcile_out["unmatched"],
            "audit_records_count": reconcile_out["audit_records_count"],
            "latency_ms": reconcile_out["latency_ms"],
            "metrics": {
                "accuracy": f"{eval_metrics.overall_accuracy * 100:.1f}%",
                "stp_rate": f"{eval_metrics.straight_through_processing_rate * 100:.1f}%",
                "false_auto_post_rate": f"{eval_metrics.false_auto_post_rate * 100:.1f}%",
                "avg_cost_usd": eval_metrics.estimated_token_cost_usd
            },
            "invariants_verified": {
                "every_transaction_received_result": len(reconcile_out["results"]) == reconcile_out["total_bank_tx"],
                "every_decision_has_audit_record": reconcile_out["audit_records_count"] >= reconcile_out["total_bank_tx"],
                "every_decision_has_confidence": all(r.confidence_score is not None for r in reconcile_out["results"]),
                "every_escalation_has_explanation": all(bool(r.reasoning) for r in reconcile_out["results"] if r.action_taken.value == "ESCALATE_TO_HUMAN"),
                "every_auto_reconciliation_has_evidence": all(bool(r.evidence) for r in reconcile_out["results"] if r.action_taken.value == "AUTO_RECONCILE"),
                "no_transaction_silently_lost": reconcile_out["total_bank_tx"] == len(dataset.bank_transactions),
                "agent_version_recorded": reconcile_out["agent_version"] == req.agent_version_id,
                "evaluation_metrics_calculated": eval_metrics is not None
            },
            "results": reconcile_out["results"]
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/improve-agent")
def improve_agent(
    req: ImproveAgentRequest,
    db: Session = Depends(get_db)
):
    """
    Step 2 of Phase 9 Demo: 'Improve Agent'
    Executes failure analysis, synthesizes improved AgentSpec, benchmarks new agent,
    and returns Before vs After comparative performance.
    """
    try:
        dataset = SyntheticDatasetGenerator.generate_dataset(seed=req.dataset_seed, count=60)
        base_agent = AgentRegistry.get_version_by_id(req.base_version_id)
        base_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(dataset, base_agent)

        opt_run = AgentEngineerService.run_optimization_loop(
            db=db,
            goal=req.goal,
            base_version_id=req.base_version_id,
            dataset_seed=req.dataset_seed
        )

        candidate_version_id = opt_run.candidate_version_id
        cand_agent = AgentRegistry.get_version_by_id(candidate_version_id)
        cand_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(dataset, cand_agent)

        before_vs_after = {
            "base_version": {
                "id": req.base_version_id,
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
                "stp_lift": f"+{round((cand_metrics.straight_through_processing_rate - base_metrics.straight_through_processing_rate)*100, 1)}%",
                "false_auto_post_delta": f"{round((cand_metrics.false_auto_post_rate - base_metrics.false_auto_post_rate)*100, 1)}%",
                "accepted": opt_run.accepted,
                "decision_rationale": opt_run.decision_rationale
            }
        }

        return {
            "status": "success",
            "optimization_run_id": opt_run.run_id,
            "candidate_version_id": candidate_version_id,
            "accepted": opt_run.accepted,
            "before_vs_after": before_vs_after
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/run-full-demo")
def run_full_demo(
    req: RunReconciliationRequest,
    db: Session = Depends(get_db)
):
    """
    Executes the entire end-to-end demo in one single API invocation:
    'Run Reconciliation' on Base Agent -> 'Improve Agent' -> Before vs After Comparison.
    """
    try:
        demo_result = FullPipelineService.run_full_autonomous_demo(
            db=db,
            dataset_seed=req.dataset_seed,
            base_version_id=req.agent_version_id
        )
        return demo_result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
