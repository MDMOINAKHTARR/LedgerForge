from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import AutopsyRequest, AggregateAutopsyReport
from backend.app.models.db import DBAutopsyReport
from backend.app.services.autopsy_engine import AutopsyEngine
from backend.app.services.dataset_generator import SyntheticDatasetGenerator
from backend.app.services.agent_registry import AgentRegistry

router = APIRouter()

@router.post("/autopsy/run", response_model=AggregateAutopsyReport)
def run_agent_autopsy(
    req: AutopsyRequest,
    db: Session = Depends(get_db)
):
    """
    Triggers Phase 7 Agent Autopsy analysis for specified agent version and dataset seed.
    Answers 5 core diagnostic questions and outputs percentage failure distribution across 11 failure types.
    """
    try:
        agent_version = AgentRegistry.get_version_by_id(req.agent_version_id)
        dataset = SyntheticDatasetGenerator.generate_dataset(seed=req.dataset_seed, count=60)
        
        report = AutopsyEngine.run_dataset_autopsy(
            db=db,
            dataset=dataset,
            agent_version=agent_version
        )
        return report
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/autopsy/reports", response_model=List[AggregateAutopsyReport])
def list_autopsy_reports(db: Session = Depends(get_db)):
    """
    Lists historical agent autopsy reports.
    """
    reports = db.query(DBAutopsyReport).order_by(DBAutopsyReport.created_at.desc()).all()
    results = []
    for r in reports:
        results.append(AggregateAutopsyReport(
            autopsy_id=r.id,
            created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            agent_version_id=r.agent_version_id,
            dataset_name=r.dataset_name,
            total_evaluated=r.total_evaluated,
            total_failures=r.total_failures,
            failure_type_breakdown=r.failure_type_breakdown or {},
            failure_percentage_distribution=r.failure_percentage_distribution or {},
            top_failure_type=r.top_failure_type,
            single_autopsies=r.single_autopsies_json or [],
            dataset_recommendations=r.dataset_recommendations_json or [],
            executive_summary=r.executive_summary
        ))
    return results


@router.get("/autopsy/reports/{autopsy_id}", response_model=AggregateAutopsyReport)
def get_autopsy_report_by_id(autopsy_id: str, db: Session = Depends(get_db)):
    """
    Retrieves detailed agent autopsy report by ID.
    """
    r = db.query(DBAutopsyReport).filter(DBAutopsyReport.id == autopsy_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Autopsy report not found")
        
    return AggregateAutopsyReport(
        autopsy_id=r.id,
        created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
        agent_version_id=r.agent_version_id,
        dataset_name=r.dataset_name,
        total_evaluated=r.total_evaluated,
        total_failures=r.total_failures,
        failure_type_breakdown=r.failure_type_breakdown or {},
        failure_percentage_distribution=r.failure_percentage_distribution or {},
        top_failure_type=r.top_failure_type,
        single_autopsies=r.single_autopsies_json or [],
        dataset_recommendations=r.dataset_recommendations_json or [],
        executive_summary=r.executive_summary
    )
