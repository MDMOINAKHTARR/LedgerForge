"""
Supabase Schema Types and Data Transfer Objects for LedgerForge / Autonomous Bank Reconciliation Agent.
Provides strongly-typed Pydantic definitions for all 10 PostgreSQL tables:
- Financial tables: reconciliations, bank_transactions, ledger_transactions, matches, decisions, audit_logs
- Agent engineering tables: agent_versions, agent_runs, evaluation_results, failure_analyses
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field


# ============================================================================
# 1. Agent Engineering Tables
# ============================================================================

class AgentVersionBase(BaseModel):
    version_name: str
    parent_version_id: Optional[str] = None
    configuration: Dict[str, Any] = Field(default_factory=dict)
    prompt_version: Optional[str] = None
    matching_strategy: Optional[str] = None
    confidence_threshold: float = 0.90
    escalation_policy: Dict[str, Any] = Field(default_factory=dict)
    verification_enabled: bool = True
    status: str = "active"


class AgentVersionCreate(AgentVersionBase):
    id: Optional[str] = None


class AgentVersion(AgentVersionBase):
    id: str
    created_at: Optional[datetime] = None


class AgentRunBase(BaseModel):
    agent_version_id: str
    reconciliation_id: Optional[str] = None
    status: str = "completed"
    latency_ms: float = 0.0
    estimated_cost: float = 0.0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentRunCreate(AgentRunBase):
    id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AgentRun(AgentRunBase):
    id: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class EvaluationResultBase(BaseModel):
    agent_version_id: str
    dataset_name: str
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    false_auto_post_rate: float = 0.0
    escalation_precision: float = 0.0
    straight_through_rate: float = 0.0
    average_latency_ms: float = 0.0
    estimated_cost: float = 0.0


class EvaluationResultCreate(EvaluationResultBase):
    id: Optional[str] = None


class EvaluationResult(EvaluationResultBase):
    id: str
    created_at: Optional[datetime] = None


class FailureAnalysisBase(BaseModel):
    agent_version_id: str
    evaluation_id: Optional[str] = None
    failure_type: str
    severity: Optional[str] = None
    root_cause: Optional[str] = None
    evidence: List[str] = Field(default_factory=list)
    recommended_change: Optional[str] = None
    expected_impact: Optional[str] = None


class FailureAnalysisCreate(FailureAnalysisBase):
    id: Optional[str] = None


class FailureAnalysis(FailureAnalysisBase):
    id: str
    created_at: Optional[datetime] = None


# ============================================================================
# 2. Financial Reconciliation Tables
# ============================================================================

class ReconciliationBase(BaseModel):
    name: str
    status: str = "completed"
    agent_version_id: Optional[str] = None
    total_transactions: int = 0
    auto_reconciled_count: int = 0
    escalated_count: int = 0
    unmatched_count: int = 0
    accuracy: float = 0.0
    straight_through_rate: float = 0.0
    false_auto_post_rate: float = 0.0
    average_latency_ms: float = 0.0
    estimated_cost: float = 0.0


class ReconciliationCreate(ReconciliationBase):
    id: Optional[str] = None
    completed_at: Optional[datetime] = None


class Reconciliation(ReconciliationBase):
    id: str
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class BankTransactionBase(BaseModel):
    reconciliation_id: str
    external_transaction_id: Optional[str] = None
    transaction_date: str
    amount: float
    currency: str = "USD"
    description: Optional[str] = None
    reference: Optional[str] = None
    counterparty: Optional[str] = None
    transaction_type: Optional[str] = "CR"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BankTransactionCreate(BankTransactionBase):
    id: Optional[str] = None


class BankTransaction(BankTransactionBase):
    id: str
    created_at: Optional[datetime] = None


class LedgerTransactionBase(BaseModel):
    reconciliation_id: str
    external_ledger_id: Optional[str] = None
    invoice_id: Optional[str] = None
    transaction_date: str
    amount: float
    currency: str = "USD"
    description: Optional[str] = None
    reference: Optional[str] = None
    counterparty: Optional[str] = None
    account: Optional[str] = None
    transaction_type: Optional[str] = "LEDGER_ENTRY"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LedgerTransactionCreate(LedgerTransactionBase):
    id: Optional[str] = None


class LedgerTransaction(LedgerTransactionBase):
    id: str
    created_at: Optional[datetime] = None


class MatchBase(BaseModel):
    reconciliation_id: str
    bank_transaction_id: str
    ledger_transaction_id: Optional[str] = None
    match_type: str  # exact, fuzzy, semantic, llm, none
    match_score: float = 0.0
    confidence: float
    evidence: List[str] = Field(default_factory=list)
    is_selected: bool = False


class MatchCreate(MatchBase):
    id: Optional[str] = None


class Match(MatchBase):
    id: str
    created_at: Optional[datetime] = None


class DecisionBase(BaseModel):
    reconciliation_id: str
    bank_transaction_id: str
    match_id: Optional[str] = None
    decision: str  # AUTO_RECONCILE, ESCALATE, REJECT, UNMATCHED
    confidence: float
    reason: str
    evidence: List[str] = Field(default_factory=list)
    exception_type: Optional[str] = None
    policy_checks: Dict[str, Any] = Field(default_factory=dict)
    agent_version_id: Optional[str] = None


class DecisionCreate(DecisionBase):
    id: Optional[str] = None


class Decision(DecisionBase):
    id: str
    created_at: Optional[datetime] = None


class AuditLogBase(BaseModel):
    reconciliation_id: str
    bank_transaction_id: Optional[str] = None
    event_type: str
    stage: str
    message: str
    evidence: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    agent_version_id: Optional[str] = None


class AuditLogCreate(AuditLogBase):
    id: Optional[str] = None


class AuditLog(AuditLogBase):
    id: str
    created_at: Optional[datetime] = None
