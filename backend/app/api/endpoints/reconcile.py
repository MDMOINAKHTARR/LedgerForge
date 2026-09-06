import uuid
import time
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Response
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import (
    ReconciliationBatchSchema, NormalizedTransaction, ReconciliationResultSchema, SourceType, ActionTaken, HumanStatus
)
from backend.app.models.db import DBReconciliationBatch, DBTransaction, DBReconciliationResult, DBAgentTrace
from backend.app.services.ingestion import DataIngestionService
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.audit_service import AuditService
from backend.app.services.decision_engine import DecisionEngine
from backend.app.services.report_service import CanonicalReportService

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
        agent_policy = agent_version.get_decision_policy() if hasattr(agent_version, "get_decision_policy") else None
        
        # Execute Multi-Tier Matching Engine
        results, traces = MultiTierMatchingEngine.process_batch(
            batch_id=batch_id,
            bank_txs=bank_txs,
            ledger_txs=ledger_txs,
            agent_version=agent_version,
            policy=agent_policy
        )
        
        # Re-verify through DecisionEngine policy checks (Hard Safety Overrides & Historical Memory Context)
        for r in results:
            decision_out = DecisionEngine.evaluate_reconciliation_result(
                r,
                policy=agent_policy,
                agent_version=agent_version.id,
                db=db
            )
            r.action_taken = ActionTaken(decision_out.decision) if decision_out.decision in [a.value for a in ActionTaken] else r.action_taken
            r.confidence_score = decision_out.confidence
            r.reasoning = decision_out.reason
            r.evidence = decision_out.evidence
            r.policy_checks = decision_out.policy_checks
            r.stop_reason_details = decision_out.stop_reason_details
            r.memory_context = decision_out.memory_context
            r.llm_output = decision_out.llm_output
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
            valid_bank_ids = {f"{batch_id}_bank_{tx.id}" for tx in bank_txs}
            matches_batch = []
            decisions_batch = []
            audit_logs_batch = []

            for r in results:
                b_scoped_id = f"{batch_id}_bank_{r.bank_tx_id}"
                # Supabase table matches has a strict NOT NULL foreign key constraint on bank_transaction_id
                if b_scoped_id not in valid_bank_ids:
                    continue

                m_type = r.match_type.value if hasattr(r.match_type, 'value') else str(r.match_type)
                act_val = r.action_taken.value if hasattr(r.action_taken, 'value') else str(r.action_taken)
                l_scoped_id = f"{batch_id}_ledger_{r.ledger_tx_id}" if r.ledger_tx_id else None
                matches_batch.append({
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
                decisions_batch.append({
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
                audit_logs_batch.append({
                    "id": f"a_{r.id}",
                    "reconciliation_id": batch_id,
                    "bank_transaction_id": b_scoped_id,
                    "event_type": "DECISION_FINALIZED",
                    "stage": "DECISION_ENGINE",
                    "message": r.reasoning,
                    "evidence": r.evidence or [],
                    "agent_version_id": agent_version.id
                })

            if matches_batch:
                supabase_service.insert_matches(matches_batch)
            if decisions_batch:
                supabase_service.insert_decisions(decisions_batch)
            if audit_logs_batch:
                supabase_service.insert_audit_logs(audit_logs_batch)
        except Exception as s_err:
            import logging
            logging.warning(f"Supabase sync notice: {s_err}")
        
        # Generate authoritative canonical report summary
        report_summary = CanonicalReportService.generate_canonical_summary(
            batch_id=batch_id,
            bank_txs=bank_txs,
            ledger_txs=ledger_txs,
            results=results,
            agent_version_id=agent_version.id,
            created_at=time.strftime("%Y-%m-%d %H:%M:%S")
        )
        
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
            results=results,
            report_summary=report_summary
        )
        
    except Exception as e:
        db.rollback()
        import logging
        import traceback
        logging.error(f"Failed to process reconciliation upload: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Reconciliation processing error: {str(e)}")


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
            bank_dict["normalized_amount"] = abs(bank_tx.amount) if bank_tx.amount is not None else 0.0

        ledger_dict = None
        if ledger_tx:
            ledger_dict = {k: v for k, v in ledger_tx.__dict__.items() if not k.startswith("_")}
            ledger_dict["id"] = clean_ledger_id
            ledger_dict["normalized_amount"] = abs(ledger_tx.amount) if ledger_tx.amount is not None else 0.0

        # Canonical exception types taxonomy
        m_type_str = (r.match_type.value if hasattr(r.match_type, "value") else str(r.match_type or "")).upper()
        if m_type_str == "UNMATCHED":
            exc_types = ["MISSING_IN_LEDGER"]
        elif m_type_str == "MISSING_IN_BANK":
            exc_types = ["MISSING_IN_BANK"]
        elif m_type_str and m_type_str not in ["EXACT", "EXACT_MATCH"]:
            exc_types = [m_type_str]
        else:
            exc_types = []

        b_amt = abs(bank_tx.amount) if (bank_tx and bank_tx.amount is not None) else None
        b_curr = bank_tx.currency if bank_tx else None
        l_amt = abs(ledger_tx.amount) if (ledger_tx and ledger_tx.amount is not None) else None
        l_curr = ledger_tx.currency if ledger_tx else None

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
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            "bank_amount": b_amt,
            "bank_currency": b_curr,
            "ledger_amount": l_amt,
            "ledger_currency": l_curr,
            "exception_types": exc_types,
        })
        
    # Reconstruct NormalizedTransaction objects for report summary
    db_all_txs = db.query(DBTransaction).filter(DBTransaction.batch_id == batch_id).all()
    bank_norm = [
        NormalizedTransaction(
            id=tx.id.replace(f"{batch_id}_bank_", "").replace(f"{batch_id}_", ""),
            source=SourceType.BANK,
            date=tx.date,
            amount=tx.amount,
            normalized_amount=abs(tx.amount),
            currency=tx.currency,
            description=tx.description or "",
            reference=tx.reference_id,
            metadata=tx.raw_data or {}
        )
        for tx in db_all_txs if tx.source.upper() == "BANK"
    ]
    ledger_norm = [
        NormalizedTransaction(
            id=tx.id.replace(f"{batch_id}_ledger_", "").replace(f"{batch_id}_", ""),
            source=SourceType.LEDGER,
            date=tx.date,
            amount=tx.amount,
            normalized_amount=abs(tx.amount),
            currency=tx.currency,
            description=tx.description or "",
            reference=tx.reference_id,
            metadata=tx.raw_data or {}
        )
        for tx in db_all_txs if tx.source.upper() == "LEDGER"
    ]
    results_objs = [ReconciliationResultSchema(**r_dict).sync_canonical_fields() for r_dict in results_list]
    report_summary = CanonicalReportService.generate_canonical_summary(
        batch_id=db_batch.id,
        bank_txs=bank_norm,
        ledger_txs=ledger_norm,
        results=results_objs,
        agent_version_id=db_batch.agent_version_id,
        created_at=db_batch.created_at.strftime("%Y-%m-%d %H:%M:%S") if db_batch.created_at else ""
    )

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
        results=results_list,
        report_summary=report_summary
    )


@router.get("/batches/{batch_id}/csv")
def download_batch_csv_report(batch_id: str, db: Session = Depends(get_db)):
    batch = get_batch(batch_id, db)
    if not batch or not batch.report_summary:
        raise HTTPException(status_code=404, detail="Batch report not found")
    csv_content = CanonicalReportService.generate_csv_report(batch.report_summary)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="audit_report_{batch_id}.csv"'}
    )

