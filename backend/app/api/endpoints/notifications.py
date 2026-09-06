from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime

from backend.app.core.database import get_db
from backend.app.models.db import DBReconciliationBatch, DBReconciliationResult, DBAuditLog, DBTransaction

router = APIRouter()

@router.get("/notifications")
def get_system_notifications(db: Session = Depends(get_db)):
    """
    Returns real-time dynamic system notifications derived from live reconciliation batches,
    pending human exceptions, and audit trails.
    """
    notifications = []
    
    try:
        # 1. Real pending exceptions from database
        pending_excs = db.query(DBReconciliationResult).filter(
            DBReconciliationResult.human_status == "pending",
            DBReconciliationResult.action_taken == "ESCALATE_TO_HUMAN"
        ).order_by(DBReconciliationResult.created_at.desc()).limit(10).all()
        
        if pending_excs:
            notifications.append({
                "id": f"notif-exc-summary-{len(pending_excs)}",
                "title": f"{len(pending_excs)} Pending Human Review Exceptions",
                "message": f"{len(pending_excs)} transactions require human approval due to material variance, duplicate candidates, or ambiguity.",
                "time": "Action Required",
                "type": "alert",
                "unread": True,
                "actionLabel": "Review Exceptions",
                "targetTab": "exceptions"
            })
            
            for exc in pending_excs[:3]:
                bt = db.query(DBTransaction).filter(DBTransaction.id == exc.bank_tx_id).first()
                amount_str = f"${abs(bt.amount):,.2f} {bt.currency}" if bt else "Material amount"
                desc_str = f" ({bt.description[:25]})" if (bt and bt.description) else ""
                reason_clean = (exc.reasoning or "Requires review")[:85]
                notifications.append({
                    "id": f"exc-{exc.id}",
                    "title": f"Escalation: {exc.match_type.replace('_', ' ').title()}",
                    "message": f"{amount_str}{desc_str}: {reason_clean}...",
                    "time": exc.created_at.strftime("%H:%M") if exc.created_at else "Recent",
                    "type": "alert",
                    "unread": True,
                    "actionLabel": "Review Item",
                    "targetTab": "exceptions"
                })
        
        # 2. Real completed reconciliation batches
        latest_batches = db.query(DBReconciliationBatch).order_by(
            DBReconciliationBatch.created_at.desc()
        ).limit(3).all()
        
        for b in latest_batches:
            stp_pct = round((b.auto_reconciled_count / max(1, b.total_bank_tx)) * 100, 1)
            created_str = b.created_at.strftime("%b %d, %H:%M") if b.created_at else "Recent"
            notifications.append({
                "id": f"batch-{b.id}",
                "title": f"Reconciliation Complete: {b.bank_filename or 'Bank CSV'}",
                "message": f"{b.auto_reconciled_count}/{b.total_bank_tx} auto-reconciled (STP {stp_pct}%). {b.escalated_count} escalated to human review.",
                "time": created_str,
                "type": "success" if b.escalated_count == 0 else "info",
                "unread": False,
                "actionLabel": "View Report",
                "targetAction": "open_report",
                "batchId": b.id
            })
            
        # 3. Real audit trail logs
        recent_audits = db.query(DBAuditLog).order_by(
            DBAuditLog.timestamp.desc()
        ).limit(2).all()
        
        for a in recent_audits:
            time_str = a.timestamp.strftime("%H:%M") if a.timestamp else "Recent"
            reason_snip = (a.reasoning or "Immutable audit trail event logged")[:80]
            notifications.append({
                "id": f"audit-{a.id}",
                "title": f"Audit Trail: {a.decision}",
                "message": f"Agent {a.agent_version} decision finalized: {reason_snip}",
                "time": time_str,
                "type": "info",
                "unread": False,
                "actionLabel": "View Audit Log",
                "targetTab": "audit"
            })
    except Exception as err:
        import logging
        logging.warning(f"Could not load dynamic notifications from DB: {err}")

    # 4. Baseline agent status (ensures notification tray is informative even on brand new database)
    if not notifications:
        notifications.append({
            "id": "agent-live-status",
            "title": "Autonomous Agent V3 Active",
            "message": "Continuous multi-tier matching engine active with CFO multi-currency and variance isolation.",
            "time": "System",
            "type": "success",
            "unread": False,
            "actionLabel": "Inspect Policies",
            "targetTab": "engineer"
        })

    return notifications
