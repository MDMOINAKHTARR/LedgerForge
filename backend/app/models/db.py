from datetime import datetime
import json
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

class DBReconciliationBatch(Base):
    __tablename__ = "reconciliation_batches"

    id = Column(String, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    agent_version_id = Column(String, nullable=False)
    bank_filename = Column(String, nullable=False)
    ledger_filename = Column(String, nullable=False)
    total_bank_tx = Column(Integer, default=0)
    total_ledger_tx = Column(Integer, default=0)
    auto_reconciled_count = Column(Integer, default=0)
    escalated_count = Column(Integer, default=0)
    rejected_count = Column(Integer, default=0)
    status = Column(String, default="completed") # processing, completed, failed

    transactions = relationship("DBTransaction", back_populates="batch", cascade="all, delete-orphan")
    results = relationship("DBReconciliationResult", back_populates="batch", cascade="all, delete-orphan")


class DBTransaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True)
    batch_id = Column(String, ForeignKey("reconciliation_batches.id"), nullable=False)
    source = Column(String, nullable=False) # BANK or LEDGER
    date = Column(String, nullable=False) # YYYY-MM-DD
    amount = Column(Float, nullable=False)
    currency = Column(String, default="USD")
    description = Column(Text, nullable=False)
    reference_id = Column(String, nullable=True)
    raw_data = Column(JSON, nullable=True)

    batch = relationship("DBReconciliationBatch", back_populates="transactions")


class DBAgentVersion(Base):
    __tablename__ = "agent_versions"

    id = Column(String, primary_key=True)
    version_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    system_prompt = Column(Text, nullable=False)
    confidence_threshold = Column(Float, default=0.90)
    matching_rules = Column(JSON, nullable=True) # micro rules dictionary
    is_active = Column(Boolean, default=False)
    accuracy_score = Column(Float, nullable=True)
    stp_rate = Column(Float, nullable=True)
    reliability_score = Column(Float, nullable=True)
    avg_cost_usd = Column(Float, nullable=True)
    avg_latency_ms = Column(Float, nullable=True)

    results = relationship("DBReconciliationResult", back_populates="agent_version")


class DBReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    id = Column(String, primary_key=True)
    batch_id = Column(String, ForeignKey("reconciliation_batches.id"), nullable=False)
    agent_version_id = Column(String, ForeignKey("agent_versions.id"), nullable=False)
    bank_tx_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    ledger_tx_id = Column(String, ForeignKey("transactions.id"), nullable=True)
    match_type = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=False)
    action_taken = Column(String, nullable=False) # AUTO_RECONCILE, ESCALATE_TO_HUMAN, REJECT
    reasoning = Column(Text, nullable=False)
    discrepancy_details = Column(JSON, nullable=True)
    human_status = Column(String, default="PENDING")
    human_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("DBReconciliationBatch", back_populates="results")
    agent_version = relationship("DBAgentVersion", back_populates="results")
    bank_tx = relationship("DBTransaction", foreign_keys=[bank_tx_id])
    ledger_tx = relationship("DBTransaction", foreign_keys=[ledger_tx_id])
    traces = relationship("DBAgentTrace", back_populates="result", cascade="all, delete-orphan")


class DBAgentTrace(Base):
    __tablename__ = "agent_traces"

    id = Column(String, primary_key=True)
    reconciliation_result_id = Column(String, ForeignKey("reconciliation_results.id"), nullable=False)
    agent_version_id = Column(String, nullable=False)
    step_name = Column(String, nullable=False)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    cost_usd = Column(Float, default=0.0)
    latency_ms = Column(Float, default=0.0)
    llm_prompt = Column(Text, nullable=True)
    llm_response = Column(Text, nullable=True)
    thought_process = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    result = relationship("DBReconciliationResult", back_populates="traces")


class DBEvalDataset(Base):
    __tablename__ = "eval_datasets"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    ground_truth_json = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class DBEvalRun(Base):
    __tablename__ = "eval_runs"

    id = Column(String, primary_key=True)
    dataset_id = Column(String, ForeignKey("eval_datasets.id"), nullable=False)
    agent_version_id = Column(String, ForeignKey("agent_versions.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    accuracy = Column(Float, nullable=False)
    stp_rate = Column(Float, nullable=False)
    reliability_score = Column(Float, nullable=False)
    total_cost_usd = Column(Float, default=0.0)
    avg_latency_ms = Column(Float, default=0.0)
    failure_summary = Column(JSON, nullable=True)


class DBAuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True)
    reconciliation_result_id = Column(String, nullable=False)
    transaction_id = Column(String, nullable=False)
    agent_version = Column(String, nullable=False)
    processing_method = Column(String, nullable=False)
    candidate_matches = Column(JSON, nullable=True)
    selected_match = Column(String, nullable=True)
    confidence = Column(Float, nullable=False)
    reasoning = Column(Text, nullable=False)
    evidence = Column(JSON, nullable=True)
    exception_type = Column(String, nullable=True)
    decision = Column(String, nullable=False)
    policy_checks = Column(JSON, nullable=True)
    timeline_events = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    latency_ms = Column(Float, default=0.0)
    estimated_cost_usd = Column(Float, default=0.0)


class DBAgentOptimizationRun(Base):
    __tablename__ = "agent_optimization_runs"

    id = Column(String, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    goal = Column(Text, nullable=False)
    base_version_id = Column(String, nullable=False)
    candidate_version_id = Column(String, nullable=False)
    base_accuracy = Column(Float, default=0.0)
    candidate_accuracy = Column(Float, default=0.0)
    base_false_auto_post_rate = Column(Float, default=0.0)
    candidate_false_auto_post_rate = Column(Float, default=0.0)
    base_stp_rate = Column(Float, default=0.0)
    candidate_stp_rate = Column(Float, default=0.0)
    accepted = Column(Boolean, default=False)
    decision_rationale = Column(Text, nullable=False)
    failure_diagnosis_json = Column(JSON, nullable=True)
    improvement_proposal_json = Column(JSON, nullable=True)


class DBAutopsyReport(Base):
    __tablename__ = "autopsy_reports"

    id = Column(String, primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    agent_version_id = Column(String, nullable=False)
    dataset_name = Column(String, nullable=False)
    total_evaluated = Column(Integer, default=0)
    total_failures = Column(Integer, default=0)
    failure_type_breakdown = Column(JSON, nullable=True)
    failure_percentage_distribution = Column(JSON, nullable=True)
    top_failure_type = Column(String, nullable=False)
    single_autopsies_json = Column(JSON, nullable=True)
    dataset_recommendations_json = Column(JSON, nullable=True)
    executive_summary = Column(Text, nullable=False)


class DBReconciliationFeedback(Base):
    __tablename__ = "reconciliation_feedback"

    id = Column(String, primary_key=True)
    reconciliation_result_id = Column(String, ForeignKey("reconciliation_results.id"), nullable=False, unique=True)
    reconciliation_batch_id = Column(String, nullable=True)
    bank_transaction_id = Column(String, nullable=True)
    previous_decision = Column(String, nullable=True)
    human_action = Column(String, nullable=False)
    resolution_type = Column(String, nullable=False)
    corrected_ledger_id = Column(String, nullable=True)
    human_notes = Column(Text, nullable=True)
    relevant_exception_category = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    amount = Column(Float, nullable=True)
    reviewer_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    result = relationship("DBReconciliationResult", backref="feedback")


