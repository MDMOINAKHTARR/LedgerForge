from fastapi import APIRouter, HTTPException
from typing import List
from backend.app.models.pydantic_models import EvalRunSchema
from backend.app.services.eval_framework import BenchmarkEvaluator
from backend.app.services.agent_registry import AgentRegistry

router = APIRouter()

@router.post("/run/{version_id}", response_model=EvalRunSchema)
def evaluate_agent_version(version_id: str):
    agent_version = AgentRegistry.get_version_by_id(version_id)
    if not agent_version:
        raise HTTPException(status_code=404, detail="Agent version not found")
        
    eval_run = BenchmarkEvaluator.evaluate_agent(agent_version)
    return eval_run

@router.get("/leaderboard")
def get_eval_leaderboard():
    versions = AgentRegistry.get_all_versions()
    leaderboard = []
    
    for v in versions:
        eval_run = BenchmarkEvaluator.evaluate_agent(v)
        leaderboard.append({
            "version_id": v.id,
            "version_name": v.version_name,
            "accuracy": eval_run.accuracy,
            "stp_rate": eval_run.stp_rate,
            "reliability_score": eval_run.reliability_score,
            "avg_cost_usd": round(eval_run.total_cost_usd / 6.0, 6),
            "avg_latency_ms": eval_run.avg_latency_ms,
            "is_active": v.is_active,
            "confidence_threshold": v.confidence_threshold
        })
        
    return leaderboard
