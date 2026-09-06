from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import (
    OptimizeAgentRequest, AgentOptimizationRunSchema, LeaderboardItemSchema, AgentVersionSchema
)
from backend.app.models.db import DBAgentOptimizationRun, DBAgentVersion
from backend.app.services.agent_engineer import AgentEngineerService
from backend.app.services.agent_registry import AgentRegistry

router = APIRouter()

@router.post("/agent-engineer/optimize", response_model=AgentOptimizationRunSchema)
def trigger_agent_optimization(
    req: OptimizeAgentRequest,
    db: Session = Depends(get_db)
):
    """
    Executes Phase 6 Autonomous Agent Engineering Loop:
    Goal -> Run Base -> Benchmark -> Analyze Failures -> Synthesize Spec -> Benchmark Candidate -> Compare -> Decide -> Leaderboard.
    """
    try:
        run_res = AgentEngineerService.run_optimization_loop(
            db=db,
            goal=req.optimization_goal,
            base_version_id=req.base_version_id,
            dataset_seed=req.dataset_seed
        )
        return run_res
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/agent-engineer/leaderboard", response_model=List[LeaderboardItemSchema])
def get_agent_leaderboard(db: Session = Depends(get_db)):
    """
    Returns Agent Leaderboard sorted by accuracy and reliability score.
    """
    return AgentEngineerService.get_leaderboard(db)


@router.get("/agent-engineer/runs", response_model=List[AgentOptimizationRunSchema])
def list_optimization_runs(db: Session = Depends(get_db)):
    """
    Lists historical autonomous optimization runs.
    """
    runs = db.query(DBAgentOptimizationRun).order_by(DBAgentOptimizationRun.created_at.desc()).all()
    results = []
    for r in runs:
        results.append(AgentOptimizationRunSchema(
            run_id=r.id,
            created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            goal=r.goal,
            base_version_id=r.base_version_id,
            candidate_version_id=r.candidate_version_id,
            base_accuracy=r.base_accuracy,
            candidate_accuracy=r.candidate_accuracy,
            base_false_auto_post_rate=r.base_false_auto_post_rate,
            candidate_false_auto_post_rate=r.candidate_false_auto_post_rate,
            base_stp_rate=r.base_stp_rate,
            candidate_stp_rate=r.candidate_stp_rate,
            accepted=r.accepted,
            decision_rationale=r.decision_rationale,
            failure_diagnosis=r.failure_diagnosis_json or {},
            improvement_proposal=r.improvement_proposal_json or {}
        ))
    return results


@router.get("/agent-engineer/runs/{run_id}", response_model=AgentOptimizationRunSchema)
def get_optimization_run_details(run_id: str, db: Session = Depends(get_db)):
    """
    Retrieves detailed failure analysis and improvement proposal for a specific optimization run.
    """
    r = db.query(DBAgentOptimizationRun).filter(DBAgentOptimizationRun.id == run_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Optimization run not found")
        
    return AgentOptimizationRunSchema(
        run_id=r.id,
        created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
        goal=r.goal,
        base_version_id=r.base_version_id,
        candidate_version_id=r.candidate_version_id,
        base_accuracy=r.base_accuracy,
        candidate_accuracy=r.candidate_accuracy,
        base_false_auto_post_rate=r.base_false_auto_post_rate,
        candidate_false_auto_post_rate=r.candidate_false_auto_post_rate,
        base_stp_rate=r.base_stp_rate,
        candidate_stp_rate=r.candidate_stp_rate,
        accepted=r.accepted,
        decision_rationale=r.decision_rationale,
        failure_diagnosis=r.failure_diagnosis_json or {},
        improvement_proposal=r.improvement_proposal_json or {}
    )


@router.post("/agent-engineer/activate/{version_id}", response_model=AgentVersionSchema)
def set_active_agent_version(version_id: str, db: Session = Depends(get_db)):
    """
    Sets designated agent version as the active production agent for reconciliation.
    """
    version = AgentRegistry.get_version_by_id(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Agent version not found")
        
    AgentRegistry.set_active_version(version_id)
    return AgentRegistry.get_version_by_id(version_id)
