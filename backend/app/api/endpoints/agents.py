from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import AgentVersionSchema, OptimizeAgentRequest
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.meta_agent_loop import AutonomousMetaAgentLoop

router = APIRouter()

@router.get("/versions", response_model=List[AgentVersionSchema])
def list_agent_versions():
    return AgentRegistry.get_all_versions()

@router.get("/versions/{version_id}", response_model=AgentVersionSchema)
def get_agent_version(version_id: str):
    version = AgentRegistry.get_version_by_id(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Agent version not found")
    return version

@router.post("/optimize")
def run_autonomous_agent_loop(req: OptimizeAgentRequest):
    """
    Triggers the Autonomous Agent Engineering Loop:
    GOAL -> GENERATE AGENT -> RUN AGENT -> EVALUATE RESULT -> ANALYZE FAILURES -> IMPROVE AGENT -> RUN AGAIN -> SELECT BETTER VERSION
    """
    try:
        optimization_result = AutonomousMetaAgentLoop.run_optimization_cycle(
            base_version_id=req.base_version_id,
            dataset_id=req.dataset_id
        )
        return optimization_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
