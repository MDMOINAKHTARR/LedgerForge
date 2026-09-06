from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import AuditTrailItem, ReconciliationResultSchema
from backend.app.models.db import DBAuditLog, DBReconciliationResult, DBTransaction

router = APIRouter()

@router.get("/audit", response_model=List[AuditTrailItem])
def list_audit_trail_logs(
    decision: Optional[str] = None,
    agent_version: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DBAuditLog)
    if decision:
        query = query.filter(DBAuditLog.decision == decision)
    if agent_version:
        query = query.filter(DBAuditLog.agent_version == agent_version)
        
    records = query.all()
    audit_items = []
    
    for r in records:
        audit_items.append(AuditTrailItem(
            audit_id=r.id,
            reconciliation_result_id=r.reconciliation_result_id,
            transaction_id=r.transaction_id,
            agent_version=r.agent_version,
            processing_method=r.processing_method,
            candidate_matches=r.candidate_matches or [],
            selected_match=r.selected_match,
            confidence=r.confidence,
            reasoning=r.reasoning,
            evidence=r.evidence or [],
            exception_type=r.exception_type,
            decision=r.decision,
            policy_checks=r.policy_checks or [],
            timeline_events=r.timeline_events or [],
            timestamp=r.timestamp.strftime("%Y-%m-%d %H:%M:%S") if r.timestamp else "",
            latency_ms=r.latency_ms or 0.0,
            estimated_cost_usd=r.estimated_cost_usd or 0.0
        ))
        
    return audit_items


@router.get("/audit/{audit_id}", response_model=AuditTrailItem)
def get_audit_log_by_id(audit_id: str, db: Session = Depends(get_db)):
    r = db.query(DBAuditLog).filter(DBAuditLog.id == audit_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Audit trail log not found")
        
    return AuditTrailItem(
        audit_id=r.id,
        reconciliation_result_id=r.reconciliation_result_id,
        transaction_id=r.transaction_id,
        agent_version=r.agent_version,
        processing_method=r.processing_method,
        candidate_matches=r.candidate_matches or [],
        selected_match=r.selected_match,
        confidence=r.confidence,
        reasoning=r.reasoning,
        evidence=r.evidence or [],
        exception_type=r.exception_type,
        decision=r.decision,
        policy_checks=r.policy_checks or [],
        timeline_events=r.timeline_events or [],
        timestamp=r.timestamp.strftime("%Y-%m-%d %H:%M:%S") if r.timestamp else "",
        latency_ms=r.latency_ms or 0.0,
        estimated_cost_usd=r.estimated_cost_usd or 0.0
    )


@router.get("/reconciliation/{reconciliation_id}", response_model=ReconciliationResultSchema)
def get_reconciliation_record(reconciliation_id: str, db: Session = Depends(get_db)):
    r = db.query(DBReconciliationResult).filter(DBReconciliationResult.id == reconciliation_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Reconciliation record not found")
        
    b_id = r.batch_id
    bank_tx = db.query(DBTransaction).filter(
        (DBTransaction.id == r.bank_tx_id) |
        ((DBTransaction.batch_id == b_id) & (DBTransaction.id == f"{b_id}_bank_{r.bank_tx_id}"))
    ).first()
    ledger_tx = db.query(DBTransaction).filter(
        (DBTransaction.id == r.ledger_tx_id) |
        ((DBTransaction.batch_id == b_id) & (DBTransaction.id == f"{b_id}_ledger_{r.ledger_tx_id}"))
    ).first() if r.ledger_tx_id else None

    clean_bank_id = r.bank_tx_id
    if clean_bank_id.startswith(f"{b_id}_bank_"):
        clean_bank_id = clean_bank_id[len(f"{b_id}_bank_"):]
    elif clean_bank_id.startswith(f"{b_id}_"):
        clean_bank_id = clean_bank_id[len(f"{b_id}_"):]

    clean_ledger_id = None
    if r.ledger_tx_id:
        clean_ledger_id = r.ledger_tx_id
        if clean_ledger_id.startswith(f"{b_id}_ledger_"):
            clean_ledger_id = clean_ledger_id[len(f"{b_id}_ledger_"):]
        elif clean_ledger_id.startswith(f"{b_id}_"):
            clean_ledger_id = clean_ledger_id[len(f"{b_id}_"):]

    bank_dict = None
    if bank_tx:
        bank_dict = {k: v for k, v in bank_tx.__dict__.items() if not k.startswith("_")}
        bank_dict["id"] = clean_bank_id

    ledger_dict = None
    if ledger_tx:
        ledger_dict = {k: v for k, v in ledger_tx.__dict__.items() if not k.startswith("_")}
        ledger_dict["id"] = clean_ledger_id
    
    return ReconciliationResultSchema(
        id=r.id,
        batch_id=r.batch_id,
        agent_version_id=r.agent_version_id,
        bank_tx_id=clean_bank_id,
        bank_tx=bank_dict,
        ledger_tx_id=clean_ledger_id,
        ledger_tx=ledger_dict,
        match_type=r.match_type,
        confidence_score=r.confidence_score,
        action_taken=r.action_taken,
        reasoning=r.reasoning,
        discrepancy_details=r.discrepancy_details or [],
        human_status=r.human_status or "PENDING",
        human_notes=r.human_notes,
        created_at=r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else ""
    )


@router.get("/reconciliation/{reconciliation_id}/trace")
def get_reconciliation_execution_trace(reconciliation_id: str, db: Session = Depends(get_db)):
    """
    Returns frontend timeline execution trace suitable for visual decision-trace timeline UI.
    """
    r = db.query(DBAuditLog).filter(DBAuditLog.reconciliation_result_id == reconciliation_id).first()
    if not r:
        # Fallback query by audit ID
        r = db.query(DBAuditLog).filter(DBAuditLog.id == reconciliation_id).first()
        
    if not r:
        raise HTTPException(status_code=404, detail="Reconciliation trace not found")
        
    return {
        "reconciliation_id": r.reconciliation_result_id,
        "bank_transaction_id": r.transaction_id,
        "agent_version": r.agent_version,
        "decision": r.decision,
        "confidence": r.confidence,
        "reasoning": r.reasoning,
        "evidence": r.evidence or [],
        "policy_checks": r.policy_checks or [],
        "timeline_events": r.timeline_events or []
    }
