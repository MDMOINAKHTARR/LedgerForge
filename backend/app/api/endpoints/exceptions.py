from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import HumanActionRequest, ActionTaken
from backend.app.models.db import DBReconciliationResult, DBTransaction

router = APIRouter()

@router.get("/pending")
def list_pending_exceptions(batch_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(DBReconciliationResult).filter(
        DBReconciliationResult.action_taken == ActionTaken.ESCALATE_TO_HUMAN.value,
        DBReconciliationResult.human_status == "PENDING"
    )
    if batch_id:
        query = query.filter(DBReconciliationResult.batch_id == batch_id)
        
    results = query.all()
    exceptions = []
    
    for r in results:
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

        exceptions.append({
            "id": r.id,
            "batch_id": r.batch_id,
            "agent_version_id": r.agent_version_id,
            "bank_tx": bank_dict,
            "ledger_tx": ledger_dict,
            "match_type": r.match_type,
            "confidence_score": r.confidence_score,
            "reasoning": r.reasoning,
            "discrepancy_details": r.discrepancy_details or [],
            "human_status": r.human_status
        })
        
    return exceptions

@router.post("/{result_id}/human-action")
def record_human_decision(result_id: str, req: HumanActionRequest, db: Session = Depends(get_db)):
    res = db.query(DBReconciliationResult).filter(DBReconciliationResult.id == result_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Reconciliation result not found")
        
    res.human_status = req.action.value
    res.human_notes = req.notes
    
    if req.corrected_ledger_id:
        res.ledger_tx_id = req.corrected_ledger_id
        
    db.commit()
    
    return {
        "status": "updated",
        "result_id": result_id,
        "human_status": res.human_status,
        "notes": res.human_notes
    }
