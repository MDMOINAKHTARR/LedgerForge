from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.app.core.database import get_db
from backend.app.models.pydantic_models import AgentVersionSchema, OptimizeAgentRequest
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.meta_agent_loop import AutonomousMetaAgentLoop

router = APIRouter()

@router.get("/versions", response_model=List[AgentVersionSchema])
def list_agent_versions():
    return AgentRegistry.get_all_versions()

@router.get("/active-policy")
def get_active_reconciliation_policy(version_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Returns the currently active reconciliation policy, decision thresholds,
    and hard safety boundaries enforced by DecisionEngine.
    Designed for accounting and Office-of-the-CFO auditable transparency.
    """
    if version_id:
        agent = AgentRegistry.get_version_by_id(version_id)
    else:
        agent = AgentRegistry.get_active_version()

    policy = agent.get_decision_policy()
    rules = agent.matching_rules or {}

    # CFO-oriented categorization of allowed auto-reconciliation types
    allowed_categories = []
    category_labels = {
        "EXACT": "Exact Matching (Reference, Amount, Currency, Direction)",
        "EXACT_MATCH": "Exact Matching (Reference, Amount, Currency, Direction)",
        "TIMING_DIFFERENCE": "Settlement Timing Differences (Within configured window)",
        "TIMING_MISMATCH": "Settlement Timing Differences (Within configured window)",
        "BANK_FEE": "Intermediary Bank & Wire Fees (Within fee threshold)",
        "FX_VARIANCE": "Currency Conversion & Rounding Tolerances",
        "MEMO_MISMATCH": "Counterparty Alias / Memo Matches",
        "FUZZY": "Corroborated Heuristic Matches (Amount + Date Verified)"
    }
    for exc in policy.allowed_auto_exception_types:
        allowed_categories.append({
            "code": exc,
            "description": category_labels.get(exc.upper(), exc.replace("_", " ").title())
        })

    return {
        "active_agent_version": {
            "id": agent.id,
            "version_name": agent.version_name,
            "created_at": agent.created_at,
            "is_active": agent.is_active,
            "accuracy_score": agent.accuracy_score,
            "stp_rate": agent.stp_rate,
            "reliability_score": agent.reliability_score,
            "avg_latency_ms": agent.avg_latency_ms,
            "avg_cost_usd": agent.avg_cost_usd,
            "matching_rules": rules
        },
        "decision_policy": {
            "confidence_threshold": policy.confidence_threshold,
            "confidence_threshold_pct": round(policy.confidence_threshold * 100, 1),
            "min_evidence_count": policy.min_evidence_count,
            "max_amount_variance": policy.max_amount_variance,
            "max_date_difference_days": policy.max_date_difference_days,
            "allowed_auto_exception_types": policy.allowed_auto_exception_types,
            "allowed_categories": allowed_categories,
            "escalate_on_duplicate_candidates": policy.escalate_on_duplicate_candidates,
            "escalate_on_ambiguity": policy.escalate_on_ambiguity,
        },
        "safety_boundaries": [
            {
                "id": "CURRENCY_MISMATCH",
                "category": "Currency Mismatch",
                "condition": "Bank transaction currency does not match general ledger candidate currency",
                "action": "Mandatory Human Review",
                "rule": "Cross-currency automatic clearing is strictly prohibited without explicit foreign exchange conversion rate source.",
                "source": "DecisionEngine Check 4E (Zero cross-currency assumptions)",
                "status": "ENFORCED"
            },
            {
                "id": "DUPLICATE_CANDIDATE",
                "category": "Duplicate Candidate",
                "condition": "Equivalent ledger candidate already consumed or multiple transactions claim same invoice",
                "action": "Mandatory Human Review",
                "rule": "Double-consuming a single ledger invoice or posting duplicate deposits is permanently blocked.",
                "source": "DecisionEngine Check 4B (Duplicate Candidate Allocation Guard)",
                "status": "ENFORCED"
            },
            {
                "id": "MATERIAL_AMOUNT_VARIANCE",
                "category": "Material Amount Variance",
                "condition": f"Discrepancy delta exceeds policy threshold ({policy.max_amount_variance}) or tolerance limits",
                "action": "Mandatory Human Review",
                "rule": "High model confidence can never override material monetary discrepancies.",
                "source": "DecisionEngine Check 4A (Material Amount Mismatch Override)",
                "status": "ENFORCED"
            },
            {
                "id": "DIRECTION_CONFLICT",
                "category": "Economic Direction Conflict",
                "condition": "Bank cash flow direction (Credit/Debit) contradicts ledger transaction flow",
                "action": "Mandatory Human Review",
                "rule": "Opposite economic cash flows can never be automatically reconciled.",
                "source": "DecisionEngine Check 4F (Direction Conflict Override)",
                "status": "ENFORCED"
            },
            {
                "id": "INSUFFICIENT_EVIDENCE",
                "category": "Insufficient Evidence",
                "condition": f"Audit trail contains fewer than {policy.min_evidence_count} corroborated evidence points",
                "action": "Mandatory Human Review",
                "rule": "Autonomous match requires multi-attribute evidence; weak evidence triggers escalation.",
                "source": "DecisionEngine Check 1 (Minimum Evidence Count Check)",
                "status": "ENFORCED"
            },
            {
                "id": "AMBIGUOUS_CANDIDATES",
                "category": "Ambiguous Candidates",
                "condition": "Top two candidate ledger records have similarity scores within 0.05 margin",
                "action": "Mandatory Human Review",
                "rule": "Ambiguity risk stops automatic reconciliation to prevent misallocation across competing invoices.",
                "source": "DecisionEngine Check 4C (Ambiguity Index Override)",
                "status": "ENFORCED"
            },
            {
                "id": "HISTORICAL_CONFLICT",
                "category": "Conflicting Historical Precedent",
                "condition": "Historical reconciliation precedent decisions disagree on identical exception pattern",
                "action": "Mandatory Human Review",
                "rule": "Conflicting precedent resolutions prevent automated assumption of precedent.",
                "source": "DecisionEngine Check 4G (Historical Memory Conflict Override)",
                "status": "ENFORCED"
            }
        ],
        "governance": {
            "mode": "READ_ONLY",
            "is_editable": False,
            "description": "Reconciliation policy is read-only in this workspace to guarantee regulatory compliance and prevent unauthorized weakening of financial controls.",
            "promotion_requirement": "Policy and threshold modifications require candidate model generation, benchmark validation, and human promotion via Agent Evolution governance."
        }
    }

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
