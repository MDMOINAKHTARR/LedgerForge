import uuid
import time
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import (
    ReconciliationBatchSchema, SourceType, ActionTaken, HumanStatus
)
from backend.app.models.db import DBReconciliationBatch, DBTransaction, DBReconciliationResult, DBAgentTrace
from backend.app.services.ingestion import DataIngestionService
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.audit_service import AuditService
from backend.app.services.decision_engine import DecisionEngine

router = APIRouter()

@router.post("/upload", response_model=ReconciliationBatchSchema)
async def upload_and_reconcile(
    bank_file: UploadFile = File(...),
    ledger_file: UploadFile = File(...),
    agent_version_id: Optional[str] = Form("v3"),
    db: Session = Depends(get_db)
):
    try:
        bank_bytes = await bank_file.read()
        ledger_bytes = await ledger_file.read()
        
        batch_id = f"batch_{uuid.uuid4().hex[:8]}"
        
        # Parse & Normalize Bank and Ledger CSVs
        bank_txs = DataIngestionService.parse_csv_content(bank_bytes, SourceType.BANK, batch_id)
        ledger_txs = DataIngestionService.parse_csv_content(ledger_bytes, SourceType.LEDGER, batch_id)
        
        # Get active or requested Agent Version
        agent_version = AgentRegistry.get_version_by_id(agent_version_id or "v3")
        
        # Execute Multi-Tier Matching Engine
        results, traces = MultiTierMatchingEngine.process_batch(
            batch_id=batch_id,
            bank_txs=bank_txs,
            ledger_txs=ledger_txs,
            agent_version=agent_version
        )
        
        # Re-verify through DecisionEngine policy checks (Hard Safety Overrides)
        for r in results:
            decision_out = DecisionEngine.evaluate_reconciliation_result(r, agent_version=agent_version.id)
            r.action_taken = ActionTaken(decision_out.decision) if decision_out.decision in [a.value for a in ActionTaken] else r.action_taken
            r.confidence_score = decision_out.confidence
            r.reasoning = decision_out.reason
            r.evidence = decision_out.evidence
            r.policy_checks = decision_out.policy_checks
            r.stop_reason_details = decision_out.stop_reason_details
            r.sync_canonical_fields()
        
        # Count stats
        auto_count = sum(1 for r in results if r.action_taken == ActionTaken.AUTO_RECONCILE)
        esc_count = sum(1 for r in results if r.action_taken == ActionTaken.ESCALATE_TO_HUMAN)
        rej_count = sum(1 for r in results if r.action_taken == ActionTaken.REJECT)
        
        # Persist to SQLite Database
        db_batch = DBReconciliationBatch(
            id=batch_id,
            agent_version_id=agent_version.id,
            bank_filename=bank_file.filename or "bank.csv",
            ledger_filename=ledger_file.filename or "ledger.csv",
            total_bank_tx=len(bank_txs),
            total_ledger_tx=len(ledger_txs),
            auto_reconciled_count=auto_count,
            escalated_count=esc_count,
            rejected_count=rej_count,
            status="completed"
        )
        db.add(db_batch)
        
        # Persist Transactions (scoped by batch and source to prevent primary key collisions across uploads)
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
                reference_id=tx.reference_id,
                raw_data=tx.raw_data
            )
            db.add(db_tx)
            
        # Persist Results & Audit Trail
        for r in results:
            bank_db_id = f"{batch_id}_bank_{r.bank_tx_id}"
            ledger_db_id = f"{batch_id}_ledger_{r.ledger_tx_id}" if r.ledger_tx_id else None
            db_res = DBReconciliationResult(
                id=r.id,
                batch_id=batch_id,
                agent_version_id=r.agent_version_id,
                bank_tx_id=bank_db_id,
                ledger_tx_id=ledger_db_id,
                match_type=r.match_type.value,
                confidence_score=r.confidence_score,
                action_taken=r.action_taken.value,
                reasoning=r.reasoning,
                discrepancy_details=[d.model_dump() for d in r.discrepancy_details],
                human_status=r.human_status.value
            )
            db.add(db_res)
            
            # Save Phase 5 Audit Trail Log
            audit_item = AuditService.create_audit_item(result=r, agent_version_id=agent_version.id)
            AuditService.save_audit_record(db, audit_item, commit=False)

            
        # Persist Traces
        for t in traces:
            db_trace = DBAgentTrace(
                id=t.id,
                reconciliation_result_id=t.reconciliation_result_id,
                agent_version_id=t.agent_version_id,
                step_name=t.step_name,
                prompt_tokens=t.prompt_tokens,
                completion_tokens=t.completion_tokens,
                cost_usd=t.cost_usd,
                latency_ms=t.latency_ms,
                thought_process=t.thought_process
            )
            db.add(db_trace)
            
        db.commit()

        # Synchronize real transactions and results to Supabase production database
        try:
            from backend.app.services.supabase_service import supabase_service
            supabase_service.create_reconciliation({
                "id": batch_id,
                "name": f"Reconciliation {bank_file.filename} vs {ledger_file.filename}",
                "status": "completed",
                "agent_version_id": agent_version.id,
                "total_transactions": len(bank_txs),
                "auto_reconciled_count": auto_count,
                "escalated_count": esc_count,
                "unmatched_count": rej_count,
                "straight_through_rate": round(auto_count / max(1, len(bank_txs)), 3)
            })
            supabase_service.insert_bank_transactions([
                {
                    "id": f"{batch_id}_bank_{tx.id}",
                    "reconciliation_id": batch_id,
                    "external_transaction_id": tx.id,
                    "transaction_date": tx.date,
                    "amount": tx.amount,
                    "currency": tx.currency,
                    "description": tx.description,
                    "reference": tx.reference_id,
                    "transaction_type": tx.transaction_type.value if hasattr(tx.transaction_type, 'value') else str(tx.transaction_type),
                    "metadata": tx.raw_data or {}
                }
                for tx in bank_txs
            ])
            supabase_service.insert_ledger_transactions([
                {
                    "id": f"{batch_id}_ledger_{tx.id}",
                    "reconciliation_id": batch_id,
                    "external_ledger_id": tx.id,
                    "invoice_id": tx.reference_id,
                    "transaction_date": tx.date,
                    "amount": tx.amount,
                    "currency": tx.currency,
                    "description": tx.description,
                    "reference": tx.reference_id,
                    "transaction_type": "LEDGER_ENTRY",
                    "metadata": tx.raw_data or {}
                }
                for tx in ledger_txs
            ])
            for r in results:
                m_type = r.match_type.value if hasattr(r.match_type, 'value') else str(r.match_type)
                act_val = r.action_taken.value if hasattr(r.action_taken, 'value') else str(r.action_taken)
                b_scoped_id = f"{batch_id}_bank_{r.bank_tx_id}"
                l_scoped_id = f"{batch_id}_ledger_{r.ledger_tx_id}" if r.ledger_tx_id else None
                supabase_service.create_match({
                    "id": f"m_{r.id}",
                    "reconciliation_id": batch_id,
                    "bank_transaction_id": b_scoped_id,
                    "ledger_transaction_id": l_scoped_id,
                    "match_type": m_type,
                    "match_score": r.confidence_score,
                    "confidence": r.confidence_score,
                    "evidence": r.evidence or [],
                    "is_selected": True if r.ledger_tx_id else False
                })
                supabase_service.create_decision({
                    "id": f"d_{r.id}",
                    "reconciliation_id": batch_id,
                    "bank_transaction_id": b_scoped_id,
                    "match_id": f"m_{r.id}" if r.ledger_tx_id else None,
                    "decision": "AUTO_RECONCILE" if act_val == "AUTO_RECONCILE" else ("ESCALATE" if "ESCALATE" in act_val else "REJECT"),
                    "confidence": r.confidence_score,
                    "reason": r.reasoning,
                    "evidence": r.evidence or [],
                    "agent_version_id": agent_version.id
                })
                supabase_service.create_audit_log({
                    "id": f"a_{r.id}",
                    "reconciliation_id": batch_id,
                    "bank_transaction_id": b_scoped_id,
                    "event_type": "DECISION_FINALIZED",
                    "stage": "DECISION_ENGINE",
                    "message": r.reasoning,
                    "evidence": r.evidence or [],
                    "agent_version_id": agent_version.id
                })
        except Exception as s_err:
            pass  # Fail gracefully if tables/credentials not configured yet
        
        return ReconciliationBatchSchema(
            id=batch_id,
            created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            agent_version_id=agent_version.id,
            bank_filename=bank_file.filename or "bank.csv",
            ledger_filename=ledger_file.filename or "ledger.csv",
            total_bank_tx=len(bank_txs),
            total_ledger_tx=len(ledger_txs),
            auto_reconciled_count=auto_count,
            escalated_count=esc_count,
            rejected_count=rej_count,
            status="completed",
            results=results
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest", response_model=Optional[ReconciliationBatchSchema])
def get_latest_batch(db: Session = Depends(get_db)):
    """
    Returns the most recent real reconciliation batch from the database.
    """
    db_batch = db.query(DBReconciliationBatch).order_by(DBReconciliationBatch.created_at.desc()).first()
    if not db_batch:
        return None
    return get_batch(db_batch.id, db)


@router.get("/batches/{batch_id}", response_model=ReconciliationBatchSchema)
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    db_batch = db.query(DBReconciliationBatch).filter(DBReconciliationBatch.id == batch_id).first()
    if not db_batch:
        raise HTTPException(status_code=404, detail="Batch not found")
        
    db_results = db.query(DBReconciliationResult).filter(DBReconciliationResult.batch_id == batch_id).all()
    results_list = []
    
    for r in db_results:
        bank_tx = db.query(DBTransaction).filter(
            (DBTransaction.id == r.bank_tx_id) |
            ((DBTransaction.batch_id == batch_id) & (DBTransaction.id == f"{batch_id}_bank_{r.bank_tx_id}"))
        ).first()
        ledger_tx = db.query(DBTransaction).filter(
            (DBTransaction.id == r.ledger_tx_id) |
            ((DBTransaction.batch_id == batch_id) & (DBTransaction.id == f"{batch_id}_ledger_{r.ledger_tx_id}"))
        ).first() if r.ledger_tx_id else None

        # Clean IDs so frontend receives human-readable transaction IDs (e.g. B001, L001)
        clean_bank_id = r.bank_tx_id
        if clean_bank_id.startswith(f"{batch_id}_bank_"):
            clean_bank_id = clean_bank_id[len(f"{batch_id}_bank_"):]
        elif clean_bank_id.startswith(f"{batch_id}_"):
            clean_bank_id = clean_bank_id[len(f"{batch_id}_"):]

        clean_ledger_id = None
        if r.ledger_tx_id:
            clean_ledger_id = r.ledger_tx_id
            if clean_ledger_id.startswith(f"{batch_id}_ledger_"):
                clean_ledger_id = clean_ledger_id[len(f"{batch_id}_ledger_"):]
            elif clean_ledger_id.startswith(f"{batch_id}_"):
                clean_ledger_id = clean_ledger_id[len(f"{batch_id}_"):]

        bank_dict = None
        if bank_tx:
            bank_dict = {k: v for k, v in bank_tx.__dict__.items() if not k.startswith("_")}
            bank_dict["id"] = clean_bank_id

        ledger_dict = None
        if ledger_tx:
            ledger_dict = {k: v for k, v in ledger_tx.__dict__.items() if not k.startswith("_")}
            ledger_dict["id"] = clean_ledger_id

        results_list.append({
            "id": r.id,
            "batch_id": r.batch_id,
            "agent_version_id": r.agent_version_id,
            "bank_tx_id": clean_bank_id,
            "bank_tx": bank_dict,
            "ledger_tx_id": clean_ledger_id,
            "ledger_tx": ledger_dict,
            "match_type": r.match_type,
            "confidence_score": r.confidence_score,
            "action_taken": r.action_taken,
            "reasoning": r.reasoning,
            "discrepancy_details": r.discrepancy_details or [],
            "human_status": r.human_status or "PENDING",
            "human_notes": r.human_notes,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else ""
        })
        
    return ReconciliationBatchSchema(
        id=db_batch.id,
        created_at=db_batch.created_at.strftime("%Y-%m-%d %H:%M:%S") if db_batch.created_at else "",
        agent_version_id=db_batch.agent_version_id,
        bank_filename=db_batch.bank_filename,
        ledger_filename=db_batch.ledger_filename,
        total_bank_tx=db_batch.total_bank_tx,
        total_ledger_tx=db_batch.total_ledger_tx,
        auto_reconciled_count=db_batch.auto_reconciled_count,
        escalated_count=db_batch.escalated_count,
        rejected_count=db_batch.rejected_count,
        status=db_batch.status,
        results=results_list
    )

