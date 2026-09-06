from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ExceptionCategory(str, Enum):
    EXACT_MATCH = "EXACT_MATCH"
    TIMING_MISMATCH = "TIMING_MISMATCH"
    MEMO_MISMATCH = "MEMO_MISMATCH"
    BANK_FEE = "BANK_FEE"
    DUPLICATE = "DUPLICATE"
    PARTIAL_PAYMENT = "PARTIAL_PAYMENT"
    FX_VARIANCE = "FX_VARIANCE"
    MISSING_LEDGER = "MISSING_LEDGER"
    MISSING_BANK = "MISSING_BANK"
    AMOUNT_DISCREPANCY = "AMOUNT_DISCREPANCY"

class ExpectedAction(str, Enum):
    AUTO_RECONCILE = "AUTO_RECONCILE"
    ESCALATE = "ESCALATE"
    NO_MATCH = "NO_MATCH"

class ExpectedStatus(str, Enum):
    MATCHED = "MATCHED"
    UNMATCHED = "UNMATCHED"
    EXCEPTIONAL = "EXCEPTIONAL"

class BankTransactionItem(BaseModel):
    transaction_id: str
    date: str  # YYYY-MM-DD
    amount: float
    currency: str = "USD"
    description: str
    reference: Optional[str] = None
    transaction_type: str = "CR"  # CR or DR
    account: str = "OPERATING_1001"

class LedgerTransactionItem(BaseModel):
    ledger_id: str
    invoice_id: str
    date: str  # YYYY-MM-DD
    amount: float
    currency: str = "USD"
    vendor_customer: str
    description: str
    reference: Optional[str] = None
    account: str = "AR_4000"

class GroundTruthAnnotation(BaseModel):
    bank_transaction_id: str
    expected_match_ledger_id: Optional[str] = None
    expected_status: ExpectedStatus
    exception_type: ExceptionCategory
    expected_action: ExpectedAction
    notes: Optional[str] = None

class SyntheticDatasetPackage(BaseModel):
    seed: int
    total_bank_transactions: int
    total_ledger_transactions: int
    bank_transactions: List[BankTransactionItem]
    ledger_transactions: List[LedgerTransactionItem]
    ground_truth: List[GroundTruthAnnotation]

class EvaluationMetricsResult(BaseModel):
    agent_version: str
    dataset_name: str
    total_cases: int
    overall_accuracy: float
    match_precision: float
    match_recall: float
    exception_classification_accuracy: float
    auto_reconciliation_precision: float
    escalation_precision: float
    false_auto_post_rate: float  # CRITICAL SAFETY METRIC
    false_escalation_rate: float
    straight_through_processing_rate: float
    average_confidence: float
    avg_processing_latency_ms: float
    estimated_token_cost_usd: float
    breakdown_by_category: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    detailed_failures: List[Dict[str, Any]] = Field(default_factory=list)
