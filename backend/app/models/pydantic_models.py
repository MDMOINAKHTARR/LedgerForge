from datetime import date, datetime
from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class SourceType(str, Enum):
    BANK = "BANK"
    LEDGER = "LEDGER"

class MatchType(str, Enum):
    EXACT = "EXACT"
    EXACT_MATCH = "EXACT_MATCH"
    FUZZY = "FUZZY"
    MEMO_MISMATCH = "MEMO_MISMATCH"
    TIMING_DIFFERENCE = "TIMING_DIFFERENCE"
    TIMING_MISMATCH = "TIMING_MISMATCH"
    FX_VARIANCE = "FX_VARIANCE"
    PARTIAL_PAYMENT = "PARTIAL_PAYMENT"
    OVERPAYMENT = "OVERPAYMENT"
    BANK_FEE = "BANK_FEE"
    DUPLICATE = "DUPLICATE"
    DUPLICATE_TRANSACTION = "DUPLICATE_TRANSACTION"
    MISSING_INVOICE = "MISSING_INVOICE"
    MISSING_IN_LEDGER = "MISSING_IN_LEDGER"
    MISSING_IN_BANK = "MISSING_IN_BANK"
    AMOUNT_DISCREPANCY = "AMOUNT_DISCREPANCY"
    AMOUNT_VARIANCE = "AMOUNT_VARIANCE"
    MULTIPLE_CANDIDATES = "MULTIPLE_CANDIDATES"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    FUZZY_MATCH_REVIEW = "FUZZY_MATCH_REVIEW"
    UNMATCHED = "UNMATCHED"

class LedgerCandidateState(str, Enum):
    AVAILABLE = "AVAILABLE"
    MATCHED = "MATCHED"
    PARTIALLY_MATCHED = "PARTIALLY_MATCHED"
    CONSUMED = "CONSUMED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"

class ReconciliationStatus(str, Enum):
    AUTO_MATCHED = "AUTO_MATCHED"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    UNMATCHED = "UNMATCHED"
    LEDGER_ONLY = "LEDGER_ONLY"

class ActionTaken(str, Enum):
    AUTO_RECONCILE = "AUTO_RECONCILE"
    ESCALATE_TO_HUMAN = "ESCALATE_TO_HUMAN"
    REJECT = "REJECT"

class HumanStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    OVERRIDDEN = "OVERRIDDEN"
    REJECTED = "REJECTED"

class ProcessingMethod(str, Enum):
    RULE = "RULE"
    FUZZY = "FUZZY"
    LLM = "LLM"

class CanonicalReconciliationResult(BaseModel):
    bank_transaction_id: Optional[str] = None
    ledger_transaction_id: Optional[str] = None
    reconciliation_status: ReconciliationStatus
    match_method: str = "RULE"
    confidence: float = 0.0
    exception_types: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    bank_amount: Optional[float] = None
    bank_currency: Optional[str] = None
    ledger_amount: Optional[float] = None
    ledger_currency: Optional[str] = None
    relevant_dates: Dict[str, Optional[str]] = Field(default_factory=dict)
    explanation: str = ""
    recommended_action: str = "REJECT"

class NormalizedTransaction(BaseModel):
    model_config = {"populate_by_name": True}

    id: str
    source: SourceType
    date: str  # Standardized ISO YYYY-MM-DD
    value_date: Optional[str] = None
    posting_date: Optional[str] = None
    document_date: Optional[str] = None
    amount: float  # Signed original amount
    normalized_amount: float = 0.0  # Absolute amount
    direction: str = "CREDIT"  # "CREDIT" or "DEBIT"
    currency: str = "USD"
    description: str
    normalized_description: Optional[str] = None
    reference: Optional[str] = Field(default=None, alias="reference_id")
    document_id: Optional[str] = None
    payment_reference: Optional[str] = None
    counterparty: Optional[str] = None
    normalized_counterparty: Optional[str] = None
    invoice_id: Optional[str] = None
    bank_account: Optional[str] = None
    status: Optional[str] = None
    transaction_type: str = "CR"  # "CR" or "DR"
    metadata: Dict[str, Any] = Field(default_factory=dict, alias="raw_data")
    
    @property
    def reference_id(self) -> Optional[str]:
        return self.reference or self.payment_reference or self.document_id or self.invoice_id

    @property
    def raw_data(self) -> Dict[str, Any]:
        return self.metadata

    @property
    def effective_settlement_date(self) -> str:
        """Returns posting date for ledger if available, else date."""
        if self.source == SourceType.LEDGER:
            return self.posting_date or self.date
        return self.value_date or self.date

# Alias for backward compatibility
TransactionSchema = NormalizedTransaction

class CandidateMatchItem(BaseModel):
    ledger_id: str
    similarity_score: float
    reason: str

class ReconciliationResultItem(BaseModel):
    bank_transaction_id: str
    candidate_matches: List[CandidateMatchItem] = []
    selected_match: Optional[str] = None
    confidence: float
    evidence: List[str] = []
    exception_type: Optional[str] = None
    proposed_action: str  # AUTO_RECONCILE, ESCALATE, NO_MATCH
    processing_method: ProcessingMethod  # RULE, FUZZY, LLM
    latency_ms: float
    estimated_cost_usd: float

class DecisionPolicy(BaseModel):
    confidence_threshold: float = 0.90
    max_amount_variance: float = 50.0
    max_date_difference_days: int = 7
    allowed_auto_exception_types: List[str] = Field(
        default_factory=lambda: [
            "EXACT_MATCH", "EXACT", "TIMING_MISMATCH", "TIMING_DIFFERENCE",
            "BANK_FEE", "FX_VARIANCE", "MEMO_MISMATCH", "FUZZY"
        ]
    )
    escalate_on_duplicate_candidates: bool = True
    escalate_on_ambiguity: bool = True
    min_evidence_count: int = 1

class PolicyCheckItem(BaseModel):
    check_name: str
    passed: bool
    details: str

class FinalDecisionOutput(BaseModel):
    decision: str  # AUTO_RECONCILE, ESCALATE, REJECT
    confidence: float
    reason: str
    evidence: List[str] = []
    policy_checks: List[PolicyCheckItem] = []
    timestamp: str
    agent_version: str
    stop_reason_details: Optional[Dict[str, Any]] = None

# Phase 5 Audit Trail & Timeline Models
class AgentTimelineEvent(BaseModel):
    stage_name: str  # AGENT_STARTED, MATCHING_STAGE, FUZZY_STAGE, LLM_STAGE, DECISION_STAGE, ESCALATION, FINAL_RESULT
    timestamp: str
    description: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class AuditTrailItem(BaseModel):
    audit_id: str
    reconciliation_result_id: str
    transaction_id: str  # Bank Transaction ID
    agent_version: str
    processing_method: str
    candidate_matches: List[Dict[str, Any]] = []
    selected_match: Optional[str] = None
    confidence: float
    reasoning: str
    evidence: List[str] = []
    exception_type: Optional[str] = None
    decision: str
    policy_checks: List[Dict[str, Any]] = []
    timeline_events: List[AgentTimelineEvent] = []
    timestamp: str
    latency_ms: float
    estimated_cost_usd: float

class DiscrepancyDetail(BaseModel):
    field: str
    bank_val: Optional[Any] = None
    ledger_val: Optional[Any] = None
    variance: Optional[float] = None
    note: str = ""

# Legacy compatibility schema for batch results
class ReconciliationResultSchema(BaseModel):
    id: str
    batch_id: str
    agent_version_id: str
    bank_tx_id: str
    bank_tx: Optional[NormalizedTransaction] = None
    ledger_tx_id: Optional[str] = None
    ledger_tx: Optional[NormalizedTransaction] = None
    match_type: MatchType
    confidence_score: float
    action_taken: ActionTaken
    reasoning: str
    discrepancy_details: List[DiscrepancyDetail] = []
    human_status: HumanStatus = HumanStatus.PENDING
    human_notes: Optional[str] = None
    created_at: Optional[str] = None
    processing_method: ProcessingMethod = ProcessingMethod.RULE
    evidence: List[str] = []
    candidate_matches: List[CandidateMatchItem] = []
    evidence_details: Optional[Dict[str, Any]] = None
    policy_checks: List[PolicyCheckItem] = []
    timeline_events: List[AgentTimelineEvent] = []
    stop_reason_details: Optional[Dict[str, Any]] = None
    # Canonical Result Architecture fields
    reconciliation_status: Optional[ReconciliationStatus] = None
    bank_transaction_id: Optional[str] = None
    ledger_transaction_id: Optional[str] = None
    match_method: Optional[str] = None
    confidence: Optional[float] = None
    exception_types: List[str] = Field(default_factory=list)
    bank_amount: Optional[float] = None
    bank_currency: Optional[str] = None
    ledger_amount: Optional[float] = None
    ledger_currency: Optional[str] = None
    relevant_dates: Dict[str, Optional[str]] = Field(default_factory=dict)
    explanation: Optional[str] = None
    recommended_action: Optional[str] = None

    def sync_canonical_fields(self) -> "ReconciliationResultSchema":
        self.bank_transaction_id = self.bank_transaction_id or self.bank_tx_id or (self.bank_tx.id if self.bank_tx else None)
        self.ledger_transaction_id = self.ledger_transaction_id or self.ledger_tx_id or (self.ledger_tx.id if self.ledger_tx else None)
        
        if not self.reconciliation_status:
            if self.match_type in [MatchType.MISSING_IN_BANK, MatchType.UNMATCHED] and not self.bank_tx:
                self.reconciliation_status = ReconciliationStatus.LEDGER_ONLY
            elif self.action_taken == ActionTaken.AUTO_RECONCILE:
                self.reconciliation_status = ReconciliationStatus.AUTO_MATCHED
            elif self.action_taken == ActionTaken.ESCALATE_TO_HUMAN:
                self.reconciliation_status = ReconciliationStatus.HUMAN_REVIEW
            else:
                self.reconciliation_status = ReconciliationStatus.UNMATCHED

        self.match_method = self.match_method or (self.processing_method.value if hasattr(self.processing_method, "value") else str(self.processing_method))
        self.confidence = self.confidence_score if self.confidence is None else self.confidence
        self.explanation = self.explanation or self.reasoning
        self.recommended_action = self.recommended_action or (self.action_taken.value if hasattr(self.action_taken, "value") else str(self.action_taken))

        if self.bank_tx:
            self.bank_amount = self.bank_amount if self.bank_amount is not None else (self.bank_tx.normalized_amount if self.bank_tx.normalized_amount != 0.0 else abs(self.bank_tx.amount))
            self.bank_currency = self.bank_currency or self.bank_tx.currency
        if self.ledger_tx:
            self.ledger_amount = self.ledger_amount if self.ledger_amount is not None else (self.ledger_tx.normalized_amount if self.ledger_tx.normalized_amount != 0.0 else abs(self.ledger_tx.amount))
            self.ledger_currency = self.ledger_currency or self.ledger_tx.currency

        if not self.relevant_dates:
            self.relevant_dates = {
                "bank_date": self.bank_tx.date if self.bank_tx else None,
                "ledger_date": self.ledger_tx.date if self.ledger_tx else None,
                "posting_date": self.ledger_tx.posting_date if self.ledger_tx else None,
            }

        if not self.exception_types:
            exc_list = []
            if self.match_type and self.match_type not in [MatchType.EXACT, MatchType.EXACT_MATCH]:
                exc_list.append(self.match_type.value if hasattr(self.match_type, "value") else str(self.match_type))
            if self.stop_reason_details and "primary_reason" in self.stop_reason_details:
                exc_list.append(str(self.stop_reason_details["primary_reason"]))
            self.exception_types = exc_list
            
        return self

    def to_canonical(self) -> CanonicalReconciliationResult:
        self.sync_canonical_fields()
        return CanonicalReconciliationResult(
            bank_transaction_id=self.bank_transaction_id,
            ledger_transaction_id=self.ledger_transaction_id,
            reconciliation_status=self.reconciliation_status or ReconciliationStatus.UNMATCHED,
            match_method=self.match_method or "RULE",
            confidence=self.confidence if self.confidence is not None else 0.0,
            exception_types=self.exception_types,
            evidence=self.evidence,
            bank_amount=self.bank_amount,
            bank_currency=self.bank_currency,
            ledger_amount=self.ledger_amount,
            ledger_currency=self.ledger_currency,
            relevant_dates=self.relevant_dates,
            explanation=self.explanation or "",
            recommended_action=self.recommended_action or "REJECT"
        )

class ReconciliationBatchSchema(BaseModel):
    id: str
    created_at: str
    agent_version_id: str
    bank_filename: str
    ledger_filename: str
    total_bank_tx: int
    total_ledger_tx: int
    auto_reconciled_count: int
    escalated_count: int
    rejected_count: int
    status: str
    results: List[ReconciliationResultSchema] = []

class AgentVersionSchema(BaseModel):
    id: str
    version_name: str
    created_at: str
    system_prompt: str
    confidence_threshold: float = 0.90
    matching_rules: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = False
    accuracy_score: Optional[float] = None
    stp_rate: Optional[float] = None
    reliability_score: Optional[float] = None
    avg_cost_usd: Optional[float] = None
    avg_latency_ms: Optional[float] = None

class AgentTraceSchema(BaseModel):
    id: str
    reconciliation_result_id: str
    agent_version_id: str
    step_name: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    latency_ms: float = 0.0
    llm_prompt: Optional[str] = None
    llm_response: Optional[str] = None
    thought_process: Optional[str] = None
    timestamp: str

class EvalRunSchema(BaseModel):
    id: str
    dataset_id: str
    agent_version_id: str
    created_at: str
    accuracy: float
    stp_rate: float
    reliability_score: float
    total_cost_usd: float
    avg_latency_ms: float
    failure_summary: Dict[str, Any] = Field(default_factory=dict)

class ValidationErrorItem(BaseModel):
    source: str
    row_index: int
    raw_row: Dict[str, Any]
    error_message: str

class IngestionStatistics(BaseModel):
    bank_total_rows: int
    bank_valid: int
    bank_invalid: int
    ledger_total_rows: int
    ledger_valid: int
    ledger_invalid: int

class IngestionResponseSchema(BaseModel):
    bank_transactions: List[NormalizedTransaction]
    ledger_transactions: List[NormalizedTransaction]
    invalid_bank_transactions: List[Dict[str, Any]] = []
    invalid_ledger_transactions: List[Dict[str, Any]] = []
    statistics: IngestionStatistics
    errors: List[ValidationErrorItem] = []

class HumanActionRequest(BaseModel):
    action: HumanStatus
    notes: Optional[str] = None
    corrected_ledger_id: Optional[str] = None

class OptimizeAgentRequest(BaseModel):
    base_version_id: str = "v1"
    optimization_goal: str = "Maximize overall accuracy and STP while keeping false auto-post rate strictly below 5%"
    dataset_seed: int = 42

# Phase 6 Autonomous Agent Engineer Models
class FailureCategory(str, Enum):
    WRONG_MATCH = "WRONG_MATCH"
    MISSED_MATCH = "MISSED_MATCH"
    FALSE_AUTO_POST = "FALSE_AUTO_POST"
    UNNECESSARY_ESCALATION = "UNNECESSARY_ESCALATION"
    EXCEPTION_MISCLASSIFICATION = "EXCEPTION_MISCLASSIFICATION"
    HALLUCINATED_MATCH = "HALLUCINATED_MATCH"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    DUPLICATE_HANDLING_FAILURE = "DUPLICATE_HANDLING_FAILURE"
    TIMING_MISMATCH_FAILURE = "TIMING_MISMATCH_FAILURE"
    PARTIAL_PAYMENT_FAILURE = "PARTIAL_PAYMENT_FAILURE"
    FX_FAILURE = "FX_FAILURE"

class AgentSpec(BaseModel):
    version: str  # e.g., "v4"
    matching_strategy: str = "MULTI_TIER_RULE_FUZZY_LLM"  # RULE_FIRST, WEIGHTED_HYBRID, MULTI_TIER_RULE_FUZZY_LLM
    confidence_threshold: float = 0.90
    llm_enabled: bool = True
    verification_enabled: bool = True
    prompt_version: str = "p3"
    system_prompt: Optional[str] = None
    escalation_policy: str = "STRICT"  # STRICT, BALANCED, PERMISSIVE
    matching_rules: Dict[str, Any] = Field(
        default_factory=lambda: {
            "date_window_days": 7,
            "max_fee_amount": 50.0,
            "enable_fee_deduction_rule": True,
            "enable_fx_tolerance_rule": True,
            "escalate_on_duplicate": True,
            "ambiguity_margin": 0.05
        }
    )

class FailureDiagnosisReport(BaseModel):
    total_failures: int
    primary_failure_category: FailureCategory
    category_counts: Dict[str, int]
    diagnosis_summary: str
    detailed_discrepancies: List[Dict[str, Any]] = []

class ImprovementProposal(BaseModel):
    target_version: str
    problem_statement: str
    diagnosis: str
    proposed_changes: List[str]
    new_agent_spec: AgentSpec

class AgentOptimizationRunSchema(BaseModel):
    run_id: str
    created_at: str
    goal: str
    base_version_id: str
    candidate_version_id: str
    base_accuracy: float
    candidate_accuracy: float
    base_false_auto_post_rate: float
    candidate_false_auto_post_rate: float
    base_stp_rate: float
    candidate_stp_rate: float
    accepted: bool
    decision_rationale: str
    failure_diagnosis: FailureDiagnosisReport
    improvement_proposal: ImprovementProposal

class LeaderboardItemSchema(BaseModel):
    rank: int
    version_id: str
    version_name: str
    created_at: str
    accuracy: float
    stp_rate: float
    reliability_score: float
    false_auto_post_rate: float
    avg_cost_usd: float
    avg_latency_ms: float
    is_active: bool
    accepted_runs: int = 0

# Phase 7 Agent Autopsy Models
class AutopsyFailureType(str, Enum):
    MATCHING = "MATCHING"
    DECISION = "DECISION"
    CONFIDENCE = "CONFIDENCE"
    EXCEPTION_CLASSIFICATION = "EXCEPTION_CLASSIFICATION"
    VERIFICATION = "VERIFICATION"
    PROMPT = "PROMPT"
    TOOL_SELECTION = "TOOL_SELECTION"
    MEMORY = "MEMORY"
    ORCHESTRATION = "ORCHESTRATION"
    COST = "COST"
    LATENCY = "LATENCY"

class SeverityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class SingleAutopsyResult(BaseModel):
    transaction_id: str
    predicted_match: Optional[str] = None
    expected_match: Optional[str] = None
    predicted_action: str
    expected_action: str
    failure_stage: str
    missing_or_misinterpreted_evidence: List[str] = []
    failure_type: AutopsyFailureType
    severity: SeverityLevel
    root_cause: str
    evidence: List[str] = []
    recommended_change: str
    expected_impact: str

class AggregateAutopsyReport(BaseModel):
    autopsy_id: str
    created_at: str
    agent_version_id: str
    dataset_name: str
    total_evaluated: int
    total_failures: int
    failure_type_breakdown: Dict[str, int] = Field(default_factory=dict)
    failure_percentage_distribution: Dict[str, float] = Field(default_factory=dict)
    top_failure_type: AutopsyFailureType
    single_autopsies: List[SingleAutopsyResult] = []
    dataset_recommendations: List[str] = []
    executive_summary: str

class AutopsyRequest(BaseModel):
    agent_version_id: str = "v1"
    dataset_seed: int = 42


