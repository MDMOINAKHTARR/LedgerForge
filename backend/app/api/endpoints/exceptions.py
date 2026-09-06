from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import (
    HumanActionRequest,
    ActionTaken,
    HumanStatus,
    ResolutionType,
    ReconciliationFeedbackSchema,
    MemoryContext,
    MemoryRetrievalResult,
)
from backend.app.models.db import (
    DBReconciliationResult,
    DBTransaction,
    DBReconciliationFeedback,
    DBAuditLog,
)
from backend.app.services.memory_service import ReconciliationMemoryService

router = APIRouter()


def infer_resolution_type(action: HumanStatus, match_type: Optional[str], corrected_ledger_id: Optional[str]) -> ResolutionType:
    mt = (match_type or "").upper()

    # 1. Clear exception domain categories based on match type
    if "TIMING" in mt or "DATE" in mt:
        return ResolutionType.TIMING_DIFFERENCE
    elif "PARTIAL" in mt:
        return ResolutionType.PARTIAL_PAYMENT
    elif "DUPLICATE" in mt:
        return ResolutionType.DUPLICATE_TRANSACTION
    elif "FX" in mt or "CURRENCY" in mt:
        return ResolutionType.CURRENCY_ISSUE
    elif "AMOUNT" in mt or "VARIANCE" in mt:
        return ResolutionType.AMOUNT_VARIANCE
    elif "FEE" in mt:
        return ResolutionType.BANK_FEE
    elif "MISSING_IN_LEDGER" in mt:
        return ResolutionType.MISSING_LEDGER_ENTRY
    elif "MISSING_IN_BANK" in mt:
        return ResolutionType.MISSING_BANK_ENTRY

    # 2. Re-matching or approval on exact candidates
    if corrected_ledger_id and action == HumanStatus.APPROVED:
        return ResolutionType.CORRECT_MATCH

    if mt in ["EXACT", "EXACT_MATCH"] and action == HumanStatus.APPROVED:
        return ResolutionType.CORRECT_MATCH

    # 3. Explicit rejection on proposed match candidates
    if action == HumanStatus.REJECTED and mt in ["EXACT", "EXACT_MATCH", "FUZZY", "FUZZY_MATCH_REVIEW", "MULTIPLE_CANDIDATES"]:
        return ResolutionType.WRONG_MATCH

    # 4. Conservative fallback: If evidence is generic or insufficient, return OTHER
    return ResolutionType.OTHER


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
            raw_b = bank_tx.raw_data or {}
            bank_dict["value_date"] = raw_b.get("value_date") or bank_dict.get("value_date") or bank_tx.date
            bank_dict["counterparty"] = raw_b.get("counterparty") or raw_b.get("vendor_customer") or bank_dict.get("counterparty") or bank_tx.description
            bank_dict["direction"] = raw_b.get("direction") or raw_b.get("transaction_type") or ("CREDIT" if (bank_tx.amount or 0) >= 0 else "DEBIT")
            bank_dict["reference"] = bank_tx.reference_id or clean_bank_id

        ledger_dict = None
        if ledger_tx:
            ledger_dict = {k: v for k, v in ledger_tx.__dict__.items() if not k.startswith("_")}
            ledger_dict["id"] = clean_ledger_id
            raw_l = ledger_tx.raw_data or {}
            ledger_dict["posting_date"] = raw_l.get("posting_date") or raw_l.get("document_date") or ledger_tx.date
            ledger_dict["reference"] = ledger_tx.reference_id or raw_l.get("invoice_id") or clean_ledger_id
            ledger_dict["invoice_id"] = raw_l.get("invoice_id") or ledger_tx.reference_id or clean_ledger_id
            ledger_dict["counterparty"] = raw_l.get("counterparty") or raw_l.get("vendor_customer") or ledger_dict.get("counterparty") or "Corporate Vendor"
            ledger_dict["status"] = raw_l.get("status") or "POSTED"

        # Lookup audit log for grounded evidence and policy checks
        audit_log = db.query(DBAuditLog).filter(
            (DBAuditLog.reconciliation_result_id == r.id) | (DBAuditLog.id == r.id)
        ).first()
        evidence_list = audit_log.evidence if (audit_log and audit_log.evidence) else []
        if not evidence_list:
            conf_display = round((r.confidence_score or 0) * 100)
            evidence_list = [
                f"Assigned model confidence score: {conf_display}%",
                f"Bank description: '{bank_tx.description if bank_tx else 'N/A'}'",
                f"Transaction date: {bank_tx.date if bank_tx else 'N/A'}"
            ]
            if ledger_tx:
                evidence_list.append(f"Candidate ledger record: {clean_ledger_id} ('{ledger_tx.description}')")

        # Determine explainable stop reason ("Why stopped")
        norm_type = (r.match_type or "").upper()
        if "AMOUNT" in norm_type or "DISCREPANCY" in norm_type:
            why_stopped = "Amount variance detected between bank statement and ledger entry"
        elif "DUPLICATE" in norm_type:
            why_stopped = "Duplicate candidate: multiple transactions claiming the same ledger record"
        elif "FX" in norm_type or "CURRENCY" in norm_type:
            why_stopped = "Currency mismatch across transaction boundaries"
        elif "PARTIAL" in norm_type:
            why_stopped = "Partial payment: invoice partially settled"
        elif "MISSING_LEDGER" in norm_type or "MISSING_IN_LEDGER" in norm_type:
            why_stopped = "Missing ledger entry: no corresponding record found in GL"
        elif "MISSING_BANK" in norm_type or "MISSING_IN_BANK" in norm_type:
            why_stopped = "Missing bank entry: ledger invoice recorded but bank clearing missing"
        elif "TIMING" in norm_type:
            why_stopped = "Timing difference: transaction cleared outside standard settlement window"
        elif (r.confidence_score or 0) < 0.90:
            why_stopped = f"Low model confidence ({round((r.confidence_score or 0) * 100)}%) below policy threshold (90%)"
        else:
            why_stopped = "Policy guardrail stop: human sign-off required for non-standard variance"

        stop_reason_details = {
            "why_stopped": why_stopped,
            "exception_type": r.match_type,
            "recommended_action": "Review candidate details and select appropriate accounting resolution."
        }

        # Retrieve historical advisory memory (if available)
        historical_memory = None
        try:
            mem_res = ReconciliationMemoryService.get_memory_for_result(r.id, db=db, limit=3)
            if mem_res and mem_res.has_memory:
                trust_str = mem_res.trust_level.value if hasattr(mem_res.trust_level, "value") else str(mem_res.trust_level)
                historical_memory = {
                    "has_memory": True,
                    "precedent_count": mem_res.precedent_count,
                    "predominant_resolution": mem_res.predominant_resolution,
                    "trust_level": trust_str,
                    "explanation": f"{mem_res.precedent_count} prior similar case(s) resolved by accountants. Predominant resolution: {mem_res.predominant_resolution} ({trust_str} trust)."
                }
        except Exception:
            historical_memory = None

        # Fetch candidate ledger entries from this batch for human re-assignment
        batch_ledger_candidates = []
        batch_ledger_txs = db.query(DBTransaction).filter(
            DBTransaction.batch_id == b_id,
            DBTransaction.source == "LEDGER"
        ).all()
        for ltx in batch_ledger_txs:
            c_lid = ltx.id
            if c_lid.startswith(f"{b_id}_ledger_"):
                c_lid = c_lid[len(f"{b_id}_ledger_"):]
            elif c_lid.startswith(f"{b_id}_"):
                c_lid = c_lid[len(f"{b_id}_"):]
            raw_c = ltx.raw_data or {}
            batch_ledger_candidates.append({
                "id": c_lid,
                "db_id": ltx.id,
                "amount": ltx.amount,
                "currency": ltx.currency,
                "date": ltx.date,
                "posting_date": raw_c.get("posting_date") or ltx.date,
                "reference": ltx.reference_id or c_lid,
                "invoice_id": raw_c.get("invoice_id") or ltx.reference_id or c_lid,
                "counterparty": raw_c.get("counterparty") or raw_c.get("vendor_customer") or ltx.description,
                "description": ltx.description,
                "status": raw_c.get("status") or "POSTED"
            })

        exceptions.append({
            "id": r.id,
            "batch_id": r.batch_id,
            "agent_version_id": r.agent_version_id,
            "bank_tx": bank_dict,
            "ledger_tx": ledger_dict,
            "match_type": r.match_type,
            "confidence_score": r.confidence_score,
            "action_taken": r.action_taken,
            "reasoning": r.reasoning,
            "discrepancy_details": r.discrepancy_details or [],
            "human_status": r.human_status,
            "human_notes": r.human_notes,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else "",
            "evidence": evidence_list,
            "stop_reason_details": stop_reason_details,
            "historical_memory": historical_memory,
            "available_ledger_candidates": batch_ledger_candidates
        })
        
    return exceptions


@router.get("/{result_id}/candidates")
def get_exception_candidates(result_id: str, db: Session = Depends(get_db)):
    """
    Returns available candidate ledger transactions from the same batch
    so the accountant can choose a corrected match.
    """
    res = db.query(DBReconciliationResult).filter(DBReconciliationResult.id == result_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Reconciliation result not found")
    b_id = res.batch_id
    batch_ledger_txs = db.query(DBTransaction).filter(
        DBTransaction.batch_id == b_id,
        DBTransaction.source == "LEDGER"
    ).all()
    candidates = []
    for ltx in batch_ledger_txs:
        c_lid = ltx.id
        if c_lid.startswith(f"{b_id}_ledger_"):
            c_lid = c_lid[len(f"{b_id}_ledger_"):]
        elif c_lid.startswith(f"{b_id}_"):
            c_lid = c_lid[len(f"{b_id}_"):]
        raw_c = ltx.raw_data or {}
        candidates.append({
            "id": c_lid,
            "db_id": ltx.id,
            "amount": ltx.amount,
            "currency": ltx.currency,
            "date": ltx.date,
            "posting_date": raw_c.get("posting_date") or ltx.date,
            "reference": ltx.reference_id or c_lid,
            "invoice_id": raw_c.get("invoice_id") or ltx.reference_id or c_lid,
            "counterparty": raw_c.get("counterparty") or raw_c.get("vendor_customer") or ltx.description,
            "description": ltx.description,
            "status": raw_c.get("status") or "POSTED"
        })
    return candidates


@router.get("/feedback/list", response_model=List[ReconciliationFeedbackSchema])
def list_reconciliation_feedback(
    batch_id: Optional[str] = None,
    resolution_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DBReconciliationFeedback)
    if batch_id:
        query = query.filter(DBReconciliationFeedback.reconciliation_batch_id == batch_id)
    if resolution_type:
        query = query.filter(DBReconciliationFeedback.resolution_type == resolution_type)
    
    records = query.all()
    results = []
    for fb in records:
        results.append(ReconciliationFeedbackSchema(
            id=fb.id,
            reconciliation_result_id=fb.reconciliation_result_id,
            reconciliation_batch_id=fb.reconciliation_batch_id,
            bank_transaction_id=fb.bank_transaction_id,
            previous_decision=fb.previous_decision,
            human_action=fb.human_action,
            resolution_type=fb.resolution_type,
            corrected_ledger_id=fb.corrected_ledger_id,
            human_notes=fb.human_notes,
            relevant_exception_category=fb.relevant_exception_category,
            currency=fb.currency,
            amount=fb.amount,
            reviewer_id=fb.reviewer_id,
            created_at=fb.created_at.strftime("%Y-%m-%d %H:%M:%S") if fb.created_at else "",
            updated_at=fb.updated_at.strftime("%Y-%m-%d %H:%M:%S") if fb.updated_at else None
        ))
    return results


@router.post("/memory/lookup", response_model=MemoryRetrievalResult)
def lookup_historical_memory(
    context: MemoryContext,
    limit: int = 5,
    min_similarity: float = 0.30,
    db: Session = Depends(get_db)
):
    """
    Direct endpoint to query historical reconciliation memory given a context.
    Strictly preserves currency boundaries and returns deterministic advisory evidence.
    """
    return ReconciliationMemoryService.retrieve_relevant_feedback(
        context=context,
        db=db,
        limit=limit,
        min_similarity=min_similarity
    )


@router.get("/{result_id}/feedback", response_model=ReconciliationFeedbackSchema)
def get_reconciliation_feedback(result_id: str, db: Session = Depends(get_db)):
    fb = db.query(DBReconciliationFeedback).filter(
        DBReconciliationFeedback.reconciliation_result_id == result_id
    ).first()
    if not fb:
        raise HTTPException(status_code=404, detail="Structured feedback not found for this reconciliation result")
    
    return ReconciliationFeedbackSchema(
        id=fb.id,
        reconciliation_result_id=fb.reconciliation_result_id,
        reconciliation_batch_id=fb.reconciliation_batch_id,
        bank_transaction_id=fb.bank_transaction_id,
        previous_decision=fb.previous_decision,
        human_action=fb.human_action,
        resolution_type=fb.resolution_type,
        corrected_ledger_id=fb.corrected_ledger_id,
        human_notes=fb.human_notes,
        relevant_exception_category=fb.relevant_exception_category,
        currency=fb.currency,
        amount=fb.amount,
        reviewer_id=fb.reviewer_id,
        created_at=fb.created_at.strftime("%Y-%m-%d %H:%M:%S") if fb.created_at else "",
        updated_at=fb.updated_at.strftime("%Y-%m-%d %H:%M:%S") if fb.updated_at else None
    )


@router.get("/{result_id}/memory", response_model=MemoryRetrievalResult)
def get_memory_for_reconciliation_result(
    result_id: str,
    limit: int = 5,
    min_similarity: float = 0.30,
    db: Session = Depends(get_db)
):
    """
    Retrieves historical memory relevant to an existing exception result.
    Returns explainable advisory evidence without modifying any decision state.
    """
    return ReconciliationMemoryService.get_memory_for_result(
        result_id=result_id,
        db=db,
        limit=limit,
        min_similarity=min_similarity
    )


@router.post("/{result_id}/human-action")
def record_human_decision(result_id: str, req: HumanActionRequest, db: Session = Depends(get_db)):
    res = db.query(DBReconciliationResult).filter(DBReconciliationResult.id == result_id).first()
    if not res:
        raise HTTPException(status_code=404, detail="Reconciliation result not found")

    # CRITICAL: Capture the machine/agent decision and candidate BEFORE any modifications
    machine_previous_decision = res.action_taken
    original_candidate_ledger_id = res.ledger_tx_id
    original_match_type = res.match_type
    original_confidence = res.confidence_score

    # 1. Determine resolution type
    if req.resolution_type:
        resolution_type = req.resolution_type
    else:
        resolution_type = infer_resolution_type(req.action, res.match_type, req.corrected_ledger_id)
    
    resolution_type_val = resolution_type.value if hasattr(resolution_type, "value") else str(resolution_type)

    # 2. Validate resolution semantics: 'OTHER' requires explanatory notes
    if resolution_type == ResolutionType.OTHER or resolution_type_val == "OTHER":
        if not req.notes or not req.notes.strip():
            raise HTTPException(
                status_code=400,
                detail="Resolution type 'OTHER' requires explanatory working-paper notes."
            )

    # 3. Validate corrected_ledger_id if supplied
    validated_corrected_ledger_id = None
    if req.corrected_ledger_id and req.corrected_ledger_id.strip():
        corrected_raw = req.corrected_ledger_id.strip()

        # Applicability check: Corrected ledger cannot be assigned on non-matching or missing resolutions
        if resolution_type in [
            ResolutionType.WRONG_MATCH,
            ResolutionType.MISSING_LEDGER_ENTRY,
            ResolutionType.MISSING_BANK_ENTRY,
            ResolutionType.DUPLICATE_TRANSACTION
        ]:
            raise HTTPException(
                status_code=400,
                detail=f"Corrected ledger entry cannot be specified for resolution type '{resolution_type_val}'."
            )

        # 3.1 Verify ledger transaction exists and has source LEDGER
        candidate_ledger = db.query(DBTransaction).filter(
            (DBTransaction.id == corrected_raw) |
            ((DBTransaction.batch_id == res.batch_id) & (DBTransaction.id == f"{res.batch_id}_ledger_{corrected_raw}")) |
            ((DBTransaction.batch_id == res.batch_id) & (DBTransaction.id == f"{res.batch_id}_{corrected_raw}"))
        ).first()

        if not candidate_ledger:
            raise HTTPException(
                status_code=400,
                detail=f"Corrected ledger transaction '{corrected_raw}' does not exist."
            )

        if candidate_ledger.source != "LEDGER":
            raise HTTPException(
                status_code=400,
                detail=f"Transaction '{corrected_raw}' is not a LEDGER transaction (source: {candidate_ledger.source})."
            )

        # 3.2 Verify same reconciliation batch
        if candidate_ledger.batch_id != res.batch_id:
            raise HTTPException(
                status_code=400,
                detail=f"Ledger transaction '{corrected_raw}' belongs to batch '{candidate_ledger.batch_id}', not exception batch '{res.batch_id}'."
            )

        # 3.3 Verify not already consumed / reconciled by another bank transaction
        candidate_ids = {candidate_ledger.id, corrected_raw}
        if candidate_ledger.id.startswith(f"{res.batch_id}_ledger_"):
            candidate_ids.add(candidate_ledger.id[len(f"{res.batch_id}_ledger_"):])
        elif candidate_ledger.id.startswith(f"{res.batch_id}_"):
            candidate_ids.add(candidate_ledger.id[len(f"{res.batch_id}_"):])

        consumed_result = db.query(DBReconciliationResult).filter(
            DBReconciliationResult.batch_id == res.batch_id,
            DBReconciliationResult.id != result_id,
            DBReconciliationResult.ledger_tx_id.in_(list(candidate_ids)),
            (
                ((DBReconciliationResult.action_taken == ActionTaken.AUTO_RECONCILE.value) & (DBReconciliationResult.human_status != "REJECTED")) |
                (DBReconciliationResult.human_status.in_(["APPROVED", "RESOLVED"]))
            )
        ).first()

        if consumed_result:
            raise HTTPException(
                status_code=400,
                detail=f"Ledger transaction '{corrected_raw}' is already reconciled with bank transaction '{consumed_result.bank_tx_id}' in result '{consumed_result.id}'."
            )

        # 3.4 Verify currency compatibility
        bank_tx_lookup = db.query(DBTransaction).filter(
            (DBTransaction.id == res.bank_tx_id) |
            ((DBTransaction.batch_id == res.batch_id) & (DBTransaction.id == f"{res.batch_id}_bank_{res.bank_tx_id}")) |
            ((DBTransaction.batch_id == res.batch_id) & (DBTransaction.id == f"{res.batch_id}_{res.bank_tx_id}"))
        ).first()

        if bank_tx_lookup and bank_tx_lookup.currency and candidate_ledger.currency:
            if bank_tx_lookup.currency.strip().upper() != candidate_ledger.currency.strip().upper():
                raise HTTPException(
                    status_code=400,
                    detail=f"Currency mismatch: Bank transaction currency '{bank_tx_lookup.currency}' does not match corrected ledger currency '{candidate_ledger.currency}'."
                )

        validated_corrected_ledger_id = candidate_ledger.id

    # 4. Update ReconciliationResult fields (preserving existing behavior)
    res.human_status = req.action.value
    res.human_notes = req.notes
    if validated_corrected_ledger_id:
        res.ledger_tx_id = validated_corrected_ledger_id

    # 5. Lookup transaction to capture amount and currency
    bank_tx = db.query(DBTransaction).filter(
        (DBTransaction.id == res.bank_tx_id) |
        ((DBTransaction.batch_id == res.batch_id) & (DBTransaction.id == f"{res.batch_id}_bank_{res.bank_tx_id}"))
    ).first()
    
    currency = None
    amount = None
    if bank_tx:
        currency = bank_tx.currency
        amount = abs(bank_tx.amount) if bank_tx.amount is not None else None
    elif res.ledger_tx_id:
        ledger_tx = db.query(DBTransaction).filter(
            (DBTransaction.id == res.ledger_tx_id) |
            ((DBTransaction.batch_id == res.batch_id) & (DBTransaction.id == f"{res.batch_id}_ledger_{res.ledger_tx_id}"))
        ).first()
        if ledger_tx:
            currency = ledger_tx.currency
            amount = abs(ledger_tx.amount) if ledger_tx.amount is not None else None

    # 6. Idempotently create or update structured feedback
    existing_feedback = db.query(DBReconciliationFeedback).filter(
        DBReconciliationFeedback.reconciliation_result_id == result_id
    ).first()
    
    now = datetime.utcnow()
    assigned_corrected_id = validated_corrected_ledger_id or res.ledger_tx_id
    if existing_feedback:
        # Preserve original previous_decision while updating the current structured resolution
        existing_feedback.previous_decision = existing_feedback.previous_decision or machine_previous_decision
        existing_feedback.human_action = req.action.value
        existing_feedback.resolution_type = resolution_type_val
        existing_feedback.corrected_ledger_id = assigned_corrected_id
        existing_feedback.human_notes = req.notes
        existing_feedback.currency = currency
        existing_feedback.amount = amount
        if req.reviewer_id:
            existing_feedback.reviewer_id = req.reviewer_id
        existing_feedback.updated_at = now
        feedback_record = existing_feedback
    else:
        feedback_id = f"fb_{result_id}"
        feedback_record = DBReconciliationFeedback(
            id=feedback_id,
            reconciliation_result_id=result_id,
            reconciliation_batch_id=res.batch_id,
            bank_transaction_id=res.bank_tx_id,
            previous_decision=machine_previous_decision,
            human_action=req.action.value,
            resolution_type=resolution_type_val,
            corrected_ledger_id=assigned_corrected_id,
            human_notes=req.notes,
            relevant_exception_category=res.match_type,
            currency=currency,
            amount=amount,
            reviewer_id=req.reviewer_id,
            created_at=now,
            updated_at=now
        )
        db.add(feedback_record)

    # 7. Audit log update / creation with full provenance preservation
    audit_record = db.query(DBAuditLog).filter(
        (DBAuditLog.reconciliation_result_id == result_id) |
        (DBAuditLog.id == result_id)
    ).first()
    
    resolution_event = {
        "stage_name": "HUMAN_RESOLUTION",
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
        "description": f"Human action: {req.action.value}, resolution_type: {resolution_type_val}, notes: {req.notes or 'None'}",
        "metadata": {
            "reconciliation_result_id": result_id,
            "action": req.action.value,
            "resolution_type": resolution_type_val,
            "previous_machine_decision": machine_previous_decision,
            "original_candidate_ledger_id": original_candidate_ledger_id,
            "corrected_ledger_id": validated_corrected_ledger_id,
            "reviewer_id": req.reviewer_id,
            "notes": req.notes,
            "ai_stop_reason": original_match_type,
            "ai_confidence": original_confidence,
            "timestamp": now.strftime("%Y-%m-%d %H:%M:%S")
        }
    }
    
    if audit_record:
        events = list(audit_record.timeline_events or [])
        events.append(resolution_event)
        audit_record.timeline_events = events
        if validated_corrected_ledger_id:
            audit_record.selected_match = validated_corrected_ledger_id
    else:
        audit_record = DBAuditLog(
            id=f"audit_hr_{result_id}",
            reconciliation_result_id=result_id,
            transaction_id=res.bank_tx_id or res.ledger_tx_id or "unknown",
            agent_version=res.agent_version_id or "v1",
            processing_method="HUMAN",
            candidate_matches=[{"ledger_id": original_candidate_ledger_id, "similarity": original_confidence}] if original_candidate_ledger_id else [],
            selected_match=validated_corrected_ledger_id or res.ledger_tx_id,
            confidence=1.0,
            reasoning=f"Human resolution: {req.action.value} - {req.notes or 'No notes provided'}",
            evidence=[f"Resolution Type: {resolution_type_val}"],
            exception_type=res.match_type or "UNKNOWN",
            decision=machine_previous_decision or req.action.value,
            policy_checks=[],
            timeline_events=[resolution_event],
            latency_ms=0.0,
            estimated_cost_usd=0.0
        )
        db.add(audit_record)

    # 8. Commit all changes transactionally
    db.commit()
    
    return {
        "status": "updated",
        "result_id": result_id,
        "human_status": res.human_status,
        "notes": res.human_notes,
        "feedback_id": feedback_record.id,
        "resolution_type": feedback_record.resolution_type,
        "corrected_ledger_id": res.ledger_tx_id
    }


