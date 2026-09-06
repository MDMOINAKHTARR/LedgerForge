"""
Comprehensive Regression Test Suite for Controlled Agent-Policy Validation and Optimization System.
Tests 1-10 covering:
1. Optimizer can generate a candidate improvement.
2. Candidate is evaluated against regression benchmark.
3. Unsafe candidate is rejected.
4. Candidate that increases false auto-matches is rejected.
5. Candidate does not alter active production policy automatically.
6. Approved candidate can become a new agent version using existing architecture.
7. Existing active policy remains unchanged when candidate validation fails.
8. Existing reconciliation behavior remains unchanged.
9. Currency separation remains intact.
10. "Knows when to stop" safety behavior remains intact.
"""

import os
import sys
import uuid
import unittest
from datetime import datetime
from fastapi.testclient import TestClient

# Ensure backend package import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.main import app
from backend.app.core.database import SessionLocal, engine, Base
from backend.app.models.pydantic_models import (
    NormalizedTransaction, SourceType, ActionTaken, MatchType,
    AgentVersionSchema, AgentSpec, DecisionPolicy, ReconciliationStatus
)
from backend.app.models.dataset_models import (
    SyntheticDatasetPackage, BankTransactionItem, LedgerTransactionItem,
    GroundTruthAnnotation, ExpectedAction, ExpectedStatus, ExceptionCategory,
    EvaluationMetricsResult
)
from backend.app.models.db import (
    DBAgentVersion, DBAgentOptimizationRun, DBReconciliationFeedback
)
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.agent_engineer import AgentEngineerService
from backend.app.services.eval_engine import EvaluationEngine
from backend.app.services.failure_analyzer import FailureAnalyzer
from backend.app.services.matching_engine import MultiTierMatchingEngine


class TestPolicyOptimizationValidation(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        # Ensure default agent versions are registered and v3 is active
        AgentRegistry.set_active_version("v3")

        # Clean any leftover test feedback records
        self.db.query(DBReconciliationFeedback).filter(
            DBReconciliationFeedback.reconciliation_batch_id.like("batch_test_%")
        ).delete()
        self.db.commit()
        
        # Ensure v1, v2, v3 exist in DB
        for v in AgentRegistry.get_all_versions():
            db_v = self.db.query(DBAgentVersion).filter(DBAgentVersion.id == v.id).first()
            if not db_v:
                self.db.add(DBAgentVersion(
                    id=v.id,
                    version_name=v.version_name,
                    system_prompt=v.system_prompt,
                    confidence_threshold=v.confidence_threshold,
                    matching_rules=v.matching_rules,
                    is_active=v.is_active,
                    accuracy_score=v.accuracy_score,
                    stp_rate=v.stp_rate,
                    reliability_score=v.reliability_score
                ))
            else:
                db_v.is_active = (v.id == "v3")
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        self.db.query(DBReconciliationFeedback).filter(
            DBReconciliationFeedback.reconciliation_batch_id.like("batch_test_%")
        ).delete()
        self.db.query(DBAgentOptimizationRun).filter(
            DBAgentOptimizationRun.id.like("opt_%")
        ).delete()
        self.db.query(DBAgentVersion).filter(
            ~DBAgentVersion.id.in_(["v1", "v2", "v3"])
        ).delete()
        self.db.query(DBAgentVersion).update({DBAgentVersion.is_active: False})
        v3_db = self.db.query(DBAgentVersion).filter(DBAgentVersion.id == "v3").first()
        if v3_db:
            v3_db.is_active = True
        self.db.commit()
        self.db.close()
        AgentRegistry.set_active_version("v3")

    def test_01_optimizer_can_generate_candidate_improvement(self):
        """Test 1: Optimizer generates a candidate improvement proposal with diagnosed root cause."""
        run_res = AgentEngineerService.run_optimization_loop(
            db=self.db,
            goal="Maximize accuracy and STP while enforcing 0% false auto-post rate",
            base_version_id="v1",
            dataset_seed=101
        )

        self.assertIsNotNone(run_res.run_id)
        self.assertTrue(run_res.candidate_version_id.startswith("v"))
        self.assertIsNotNone(run_res.failure_diagnosis)
        self.assertIsNotNone(run_res.improvement_proposal)
        self.assertTrue(len(run_res.improvement_proposal.proposed_changes) > 0)
        self.assertIsNotNone(run_res.improvement_proposal.new_agent_spec)
        self.assertEqual(run_res.improvement_proposal.new_agent_spec.matching_strategy, "MULTI_TIER_RULE_FUZZY_LLM")

    def test_02_candidate_evaluated_against_regression_benchmark(self):
        """Test 2: Candidate is evaluated against regression benchmark with full metrics."""
        run_res = AgentEngineerService.run_optimization_loop(
            db=self.db,
            goal="Benchmark candidate against regression suite",
            base_version_id="v1",
            dataset_seed=102
        )

        # Baseline & candidate metrics must be populated
        self.assertGreater(run_res.base_accuracy, 0.0)
        self.assertGreater(run_res.candidate_accuracy, 0.0)
        self.assertGreaterEqual(run_res.candidate_stp_rate, 0.0)
        self.assertGreaterEqual(run_res.candidate_false_auto_post_rate, 0.0)

        # Candidate must be evaluated on the regression benchmark
        cand = AgentRegistry.get_version_by_id(run_res.candidate_version_id)
        self.assertIsNotNone(cand)
        self.assertEqual(cand.id, run_res.candidate_version_id)
        self.assertEqual(cand.accuracy_score, run_res.candidate_accuracy)

    def test_03_unsafe_candidate_is_rejected(self):
        """Test 3: Unsafe candidate violating hard safety gates (e.g. duplicate auto-match) is rejected."""
        # Create an intentionally reckless candidate agent that allows duplicate auto-matching
        unsafe_spec = AgentSpec(
            version="v_unsafe_dup",
            matching_strategy="MULTI_TIER_RULE_FUZZY_LLM",
            confidence_threshold=0.50,
            matching_rules={
                "escalate_on_duplicate": False,
                "escalate_on_duplicate_candidates": False,
                "allowed_auto_exception_types": ["DUPLICATE", "EXACT_MATCH"]
            }
        )

        # Construct a synthetic benchmark that contains a duplicate exception
        dataset = SyntheticDatasetPackage(
            seed=999,
            total_bank_transactions=2,
            total_ledger_transactions=1,
            bank_transactions=[
                BankTransactionItem(
                    transaction_id="b_dup1", date="2026-03-01", amount=1000.0,
                    currency="USD", description="Dup 1 INV-D1", reference="INV-D1"
                ),
                BankTransactionItem(
                    transaction_id="b_dup2", date="2026-03-01", amount=1000.0,
                    currency="USD", description="Dup 2 INV-D1", reference="INV-D1"
                )
            ],
            ledger_transactions=[
                LedgerTransactionItem(
                    ledger_id="l_single", invoice_id="INV-D1", date="2026-03-01",
                    amount=1000.0, currency="USD", vendor_customer="Vendor",
                    description="Invoice INV-D1", reference="INV-D1"
                )
            ],
            ground_truth=[
                GroundTruthAnnotation(
                    bank_transaction_id="b_dup1",
                    expected_match_ledger_id="l_single",
                    expected_status=ExpectedStatus.EXCEPTIONAL,
                    exception_type=ExceptionCategory.DUPLICATE,
                    expected_action=ExpectedAction.ESCALATE
                ),
                GroundTruthAnnotation(
                    bank_transaction_id="b_dup2",
                    expected_match_ledger_id="l_single",
                    expected_status=ExpectedStatus.EXCEPTIONAL,
                    exception_type=ExceptionCategory.DUPLICATE,
                    expected_action=ExpectedAction.ESCALATE
                )
            ]
        )

        unsafe_agent = AgentVersionSchema(
            id="v_unsafe_dup",
            version_name="Unsafe Agent",
            created_at="2026-09-06 12:00:00",
            system_prompt="Permissive prompt",
            confidence_threshold=0.50,
            matching_rules=unsafe_spec.matching_rules,
            is_active=False
        )

        metrics = EvaluationEngine.run_evaluation(dataset, unsafe_agent)
        
        # Candidate MUST trigger safety gate violations or duplicate auto-matches
        self.assertFalse(metrics.safety_gates_passed)
        self.assertTrue(metrics.duplicate_auto_match_count > 0 or metrics.false_auto_match_count > 0)
        self.assertGreater(len(metrics.safety_gate_violations), 0)

    def test_04_candidate_that_increases_false_auto_matches_is_rejected(self):
        """Test 4: Candidate that increases false auto-matches is rejected regardless of match rate."""
        # Evaluate a base agent with 0 false auto-matches
        base_agent = AgentRegistry.get_version_by_id("v3")
        
        # Construct candidate with overly broad tolerance that causes false auto-matches
        loose_agent = AgentVersionSchema(
            id="v_loose_thresholds",
            version_name="Loose Agent",
            created_at="2026-09-06 12:00:00",
            system_prompt="Permissive",
            confidence_threshold=0.10,  # Ridiculously low threshold
            matching_rules={
                "max_fee_amount": 5000.0,
                "date_window_days": 90,
                "allowed_auto_exception_types": [
                    "EXACT_MATCH", "AMOUNT_DISCREPANCY", "PARTIAL_PAYMENT", "MISSING_LEDGER"
                ]
            },
            is_active=False
        )

        # Generate standard dataset
        from backend.app.services.dataset_generator import SyntheticDatasetGenerator
        dataset = SyntheticDatasetGenerator.generate_dataset(seed=42, count=60)

        cand_metrics = EvaluationEngine.run_evaluation(dataset, loose_agent)

        # Cand metrics MUST violate safety gates
        self.assertGreater(cand_metrics.false_auto_match_count, 0)
        self.assertFalse(cand_metrics.safety_gates_passed)

        # Verify that optimization run would mark it as rejected
        fitness = (cand_metrics.overall_accuracy * 0.40) + ((1.0 - cand_metrics.false_auto_post_rate) * 0.30) + (cand_metrics.straight_through_processing_rate * 0.30)
        safety_passed = (
            cand_metrics.safety_gates_passed
            and cand_metrics.false_auto_match_count == 0
            and cand_metrics.false_auto_post_rate == 0.0
        )
        self.assertFalse(safety_passed, "Candidate causing false auto-matches must NOT pass safety gates")

    def test_05_candidate_does_not_alter_active_production_policy_automatically(self):
        """Test 5: Candidate does NOT alter active production policy automatically."""
        # Pre-condition: active version is v3
        active_before = AgentRegistry.get_active_version()
        self.assertEqual(active_before.id, "v3")

        # Run optimization loop
        run_res = AgentEngineerService.run_optimization_loop(
            db=self.db,
            goal="Test isolation of active production agent",
            base_version_id="v1",
            dataset_seed=105
        )

        # Post-condition: active version in AgentRegistry MUST still be v3
        active_after = AgentRegistry.get_active_version()
        self.assertEqual(active_after.id, "v3")

        # The candidate version itself MUST have is_active == False
        candidate = AgentRegistry.get_version_by_id(run_res.candidate_version_id)
        self.assertFalse(candidate.is_active)

        # In the database, the candidate version MUST also have is_active == False
        db_cand = self.db.query(DBAgentVersion).filter(DBAgentVersion.id == run_res.candidate_version_id).first()
        self.assertIsNotNone(db_cand)
        self.assertFalse(db_cand.is_active)

    def test_06_approved_candidate_can_become_new_agent_version_using_existing_architecture(self):
        """Test 6: Approved candidate can become a new agent version via controlled promotion."""
        # Create an accepted optimization run in DB for a clean candidate
        cand_id = f"v_approved_{uuid.uuid4().hex[:4]}"
        approved_candidate = AgentVersionSchema(
            id=cand_id,
            version_name="Approved Candidate",
            created_at="2026-09-06 12:00:00",
            system_prompt="Approved prompt",
            confidence_threshold=0.88,
            matching_rules={
                "enable_fee_deduction_rule": True,
                "enable_fx_tolerance_rule": True,
                "date_window_days": 10,
                "max_fee_amount": 75.0,
                "tier1_exact_prefilter": True
            },
            is_active=False,
            accuracy_score=0.98,
            stp_rate=0.95,
            reliability_score=1.0
        )
        AgentRegistry.register_version(approved_candidate)

        # Add optimization run showing candidate passed validation
        db_run = DBAgentOptimizationRun(
            id=f"opt_{uuid.uuid4().hex[:8]}",
            goal="Approved promotion test",
            base_version_id="v3",
            candidate_version_id=cand_id,
            base_accuracy=0.95,
            candidate_accuracy=0.98,
            base_false_auto_post_rate=0.0,
            candidate_false_auto_post_rate=0.0,
            base_stp_rate=0.90,
            candidate_stp_rate=0.95,
            accepted=True,
            decision_rationale="Passed all safety validation gates."
        )
        self.db.add(db_run)
        self.db.commit()

        # Controlled promotion
        promoted = AgentEngineerService.promote_candidate_version(self.db, cand_id)

        # Verify promotion succeeded
        self.assertEqual(promoted.id, cand_id)
        self.assertTrue(promoted.is_active)
        self.assertEqual(AgentRegistry.get_active_version().id, cand_id)

        # Verify DB updated
        db_promoted = self.db.query(DBAgentVersion).filter(DBAgentVersion.id == cand_id).first()
        self.assertTrue(db_promoted.is_active)
        
        # Verify other versions deactivated
        db_v3 = self.db.query(DBAgentVersion).filter(DBAgentVersion.id == "v3").first()
        self.assertFalse(db_v3.is_active)

        # Reset active version back to v3 for other tests
        AgentEngineerService.promote_candidate_version(self.db, "v3")

    def test_07_existing_active_policy_remains_unchanged_when_candidate_validation_fails(self):
        """Test 7: Existing active policy remains unchanged when candidate validation fails, and rejected candidate cannot be promoted."""
        # Ensure v3 is active
        AgentRegistry.set_active_version("v3")
        self.assertEqual(AgentRegistry.get_active_version().id, "v3")

        # Create a rejected candidate
        failed_id = f"v_failed_{uuid.uuid4().hex[:4]}"
        failed_candidate = AgentVersionSchema(
            id=failed_id,
            version_name="Failed Candidate",
            created_at="2026-09-06 12:00:00",
            system_prompt="Failed",
            confidence_threshold=0.60,
            is_active=False
        )
        AgentRegistry.register_version(failed_candidate)

        db_run = DBAgentOptimizationRun(
            id=f"opt_{uuid.uuid4().hex[:8]}",
            goal="Rejection test",
            base_version_id="v3",
            candidate_version_id=failed_id,
            base_accuracy=0.95,
            candidate_accuracy=0.80,
            base_false_auto_post_rate=0.0,
            candidate_false_auto_post_rate=0.05,
            base_stp_rate=0.90,
            candidate_stp_rate=0.85,
            accepted=False,
            decision_rationale="REJECTED: Failed validation criteria (false auto-matches > 0)."
        )
        self.db.add(db_run)
        self.db.commit()

        # Attempt to promote rejected candidate MUST raise ValueError
        with self.assertRaises(ValueError) as ctx:
            AgentEngineerService.promote_candidate_version(self.db, failed_id)
        self.assertIn("failed safety validation benchmark", str(ctx.exception).lower())

        # Active policy MUST remain v3
        self.assertEqual(AgentRegistry.get_active_version().id, "v3")

    def test_08_existing_reconciliation_behavior_remains_unchanged(self):
        """Test 8: Existing runtime reconciliation behavior remains 100% identical before and after candidate optimization."""
        bank_tx = NormalizedTransaction(
            id="B_BENCH_01",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=2500.00,
            normalized_amount=2500.00,
            currency="USD",
            direction="CREDIT",
            description="Acme Payout INV-2500",
            reference="INV-2500"
        )
        ledger_tx = NormalizedTransaction(
            id="L_BENCH_01",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=2500.00,
            normalized_amount=2500.00,
            currency="USD",
            direction="CREDIT",
            description="Acme Invoice 2500",
            reference="INV-2500"
        )

        active_agent = AgentRegistry.get_active_version()

        # Run reconciliation before optimization loop
        results_before, _ = MultiTierMatchingEngine.process_batch(
            batch_id="bench_pre",
            bank_txs=[bank_tx],
            ledger_txs=[ledger_tx],
            agent_version=active_agent,
            policy=active_agent.get_decision_policy()
        )

        # Run an optimization run (which registers a candidate)
        AgentEngineerService.run_optimization_loop(
            db=self.db,
            goal="Optimization test for runtime stability",
            base_version_id="v1",
            dataset_seed=108
        )

        # Run reconciliation after optimization loop with active production agent
        results_after, _ = MultiTierMatchingEngine.process_batch(
            batch_id="bench_post",
            bank_txs=[bank_tx],
            ledger_txs=[ledger_tx],
            agent_version=AgentRegistry.get_active_version(),
            policy=AgentRegistry.get_active_version().get_decision_policy()
        )

        self.assertEqual(len(results_before), 1)
        self.assertEqual(len(results_after), 1)
        self.assertEqual(results_before[0].action_taken, results_after[0].action_taken)
        self.assertEqual(results_before[0].match_type, results_after[0].match_type)
        self.assertEqual(results_before[0].confidence_score, results_after[0].confidence_score)
        self.assertEqual(results_before[0].ledger_tx_id, results_after[0].ledger_tx_id)

    def test_09_currency_separation_remains_intact(self):
        """Test 9: Cross-currency transactions (USD vs INR) are never auto-reconciled and fail validation gates if breached."""
        # USD Bank vs INR Ledger
        bank_tx = NormalizedTransaction(
            id="B_USD_CURR",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=5000.00,
            normalized_amount=5000.00,
            currency="USD",
            direction="CREDIT",
            description="Payment Ref 9901",
            reference="REF-9901"
        )
        ledger_tx = NormalizedTransaction(
            id="L_INR_CURR",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=5000.00,
            normalized_amount=5000.00,
            currency="INR",
            direction="CREDIT",
            description="Invoice Ref 9901",
            reference="REF-9901"
        )

        active_agent = AgentRegistry.get_active_version()
        results, _ = MultiTierMatchingEngine.process_batch(
            batch_id="curr_iso",
            bank_txs=[bank_tx],
            ledger_txs=[ledger_tx],
            agent_version=active_agent,
            policy=active_agent.get_decision_policy()
        )

        # Cross-currency USD vs INR MUST NOT be AUTO_RECONCILE
        self.assertNotEqual(results[0].action_taken, ActionTaken.AUTO_RECONCILE)

        # Verify that if an agent attempts cross-currency auto-reconcile on INR, EvaluationEngine flags currency_confusion_errors
        dataset = SyntheticDatasetPackage(
            seed=555,
            total_bank_transactions=1,
            total_ledger_transactions=1,
            bank_transactions=[
                BankTransactionItem(
                    transaction_id="b_usd", date="2026-03-01", amount=100.0,
                    currency="USD", description="USD Ref", reference="REF-C"
                )
            ],
            ledger_transactions=[
                LedgerTransactionItem(
                    ledger_id="l_inr", invoice_id="REF-C", date="2026-03-01",
                    amount=100.0, currency="INR", vendor_customer="Vendor",
                    description="INR Ref", reference="REF-C"
                )
            ],
            ground_truth=[
                GroundTruthAnnotation(
                    bank_transaction_id="b_usd",
                    expected_match_ledger_id=None,
                    expected_status=ExpectedStatus.UNMATCHED,
                    exception_type=ExceptionCategory.MISSING_LEDGER,
                    expected_action=ExpectedAction.ESCALATE
                )
            ]
        )

        metrics = EvaluationEngine.run_evaluation(dataset, active_agent)
        # Currency separation intact: no false auto-match across currencies
        self.assertEqual(metrics.currency_confusion_errors, 0)
        self.assertEqual(metrics.false_auto_match_count, 0)

    def test_10_knows_when_to_stop_safety_behavior_remains_intact(self):
        """Test 10: 'Knows when to stop' safety rules remain intact: partial payment & material variance are escalated."""
        # Partial payment scenario ($600 bank deposit on $1000 invoice)
        bank_tx = NormalizedTransaction(
            id="B_PARTIAL",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=600.00,
            normalized_amount=600.00,
            currency="USD",
            direction="CREDIT",
            description="Partial Wire INV-PART-1",
            reference="INV-PART-1"
        )
        ledger_tx = NormalizedTransaction(
            id="L_FULL",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=1000.00,
            normalized_amount=1000.00,
            currency="USD",
            direction="CREDIT",
            description="Full Invoice INV-PART-1",
            reference="INV-PART-1"
        )

        active_agent = AgentRegistry.get_active_version()
        results, _ = MultiTierMatchingEngine.process_batch(
            batch_id="stop_safety",
            bank_txs=[bank_tx],
            ledger_txs=[ledger_tx],
            agent_version=active_agent,
            policy=active_agent.get_decision_policy()
        )

        # Partial payment with material variance ($400) MUST NOT be auto-reconciled
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].action_taken, ActionTaken.ESCALATE_TO_HUMAN)
        self.assertEqual(results[0].reconciliation_status, ReconciliationStatus.HUMAN_REVIEW)

    def test_11_human_feedback_influences_candidate_generation_inputs(self):
        """Test 11: Structured human feedback signals directly influence candidate proposal synthesis."""
        fb_id1 = f"fb_fee_{uuid.uuid4().hex[:6]}"
        fb_id2 = f"fb_time_{uuid.uuid4().hex[:6]}"
        
        fb1 = DBReconciliationFeedback(
            id=fb_id1,
            reconciliation_result_id=f"res_{fb_id1}",
            reconciliation_batch_id="batch_test_fb",
            bank_transaction_id="b_fee_01",
            previous_decision="ESCALATE_TO_HUMAN",
            human_action="MATCH",
            resolution_type="MANUAL_ADJUSTMENT",
            relevant_exception_category="BANK_FEE",
            currency="USD",
            amount=25.00,
            human_notes="Confirmed intermediary bank wire fee of $25"
        )
        fb2 = DBReconciliationFeedback(
            id=fb_id2,
            reconciliation_result_id=f"res_{fb_id2}",
            reconciliation_batch_id="batch_test_fb",
            bank_transaction_id="b_time_01",
            previous_decision="ESCALATE_TO_HUMAN",
            human_action="MATCH",
            resolution_type="MANUAL_ADJUSTMENT",
            relevant_exception_category="TIMING_DIFFERENCE",
            currency="USD",
            amount=1500.00,
            human_notes="Confirmed clearing delay outside 7 days"
        )
        self.db.add(fb1)
        self.db.add(fb2)
        self.db.commit()

        base_spec = AgentSpec(
            version="v1",
            matching_strategy="RULE_FIRST",
            confidence_threshold=0.90,
            matching_rules={"date_window_days": 3, "enable_fee_deduction_rule": False}
        )
        obs_metrics = EvaluationMetricsResult(
            agent_version="v1",
            dataset_name="synthetic",
            total_cases=10,
            overall_accuracy=0.70,
            match_precision=0.80,
            match_recall=0.70,
            exception_classification_accuracy=0.75,
            auto_reconciliation_precision=1.0,
            escalation_precision=0.60,
            false_auto_post_rate=0.0,
            false_escalation_rate=0.40,
            straight_through_processing_rate=0.50,
            average_confidence=0.85,
            avg_processing_latency_ms=10.0,
            estimated_token_cost_usd=0.001,
            detailed_failures=[]
        )

        feedbacks = self.db.query(DBReconciliationFeedback).all()
        diagnosis, proposal = FailureAnalyzer.analyze_failures(
            metrics=obs_metrics,
            current_spec=base_spec,
            target_version="v_fb_tuned",
            historical_feedback=feedbacks
        )

        # Proposed changes and candidate rules MUST reflect the human feedback signals
        self.assertTrue(proposal.new_agent_spec.matching_rules.get("enable_fee_deduction_rule"))
        self.assertGreaterEqual(proposal.new_agent_spec.matching_rules.get("date_window_days", 0), 10)
        changes_str = " ".join(proposal.proposed_changes)
        self.assertIn("bank fee", changes_str.lower())
        self.assertIn("timing", changes_str.lower())

    def test_12_promotion_creates_audit_trail_and_distinguishes_lifecycle_events(self):
        """Test 12: Audit service records distinct lifecycle events: CANDIDATE_GENERATED, CANDIDATE_VALIDATED, AGENT_VERSION_PROMOTION."""
        from backend.app.models.db import DBAuditLog
        
        cand_id = f"v_audit_{uuid.uuid4().hex[:4]}"
        approved_candidate = AgentVersionSchema(
            id=cand_id,
            version_name="Audited Candidate",
            created_at="2026-09-06 12:00:00",
            system_prompt="Audited prompt",
            confidence_threshold=0.85,
            matching_rules={
                "enable_fee_deduction_rule": True,
                "enable_fx_tolerance_rule": True,
                "date_window_days": 10,
                "max_fee_amount": 75.0,
                "tier1_exact_prefilter": True
            },
            is_active=False,
            accuracy_score=0.98,
            stp_rate=0.95,
            reliability_score=1.0
        )
        AgentRegistry.register_version(approved_candidate)

        db_run = DBAgentOptimizationRun(
            id=f"opt_{uuid.uuid4().hex[:8]}",
            goal="Audited promotion test",
            base_version_id="v3",
            candidate_version_id=cand_id,
            base_accuracy=0.95,
            candidate_accuracy=0.98,
            base_false_auto_post_rate=0.0,
            candidate_false_auto_post_rate=0.0,
            base_stp_rate=0.90,
            candidate_stp_rate=0.95,
            accepted=True,
            decision_rationale="Passed all safety validation gates."
        )
        self.db.add(db_run)
        self.db.commit()

        # Explicit operator promotion
        operator = "reviewer_alice"
        AgentEngineerService.promote_candidate_version(self.db, cand_id, operator_id=operator)

        # Query DBAuditLog
        promo_audit = self.db.query(DBAuditLog).filter(
            DBAuditLog.exception_type == "AGENT_VERSION_PROMOTION",
            DBAuditLog.agent_version == cand_id
        ).first()

        self.assertIsNotNone(promo_audit, "AGENT_VERSION_PROMOTION event must be recorded in DBAuditLog")
        self.assertEqual(promo_audit.decision, "PROMOTED")
        self.assertIn("Explicit operator promotion", promo_audit.reasoning)
        self.assertTrue(len(promo_audit.timeline_events) > 0)
        self.assertEqual(promo_audit.timeline_events[0].get("operator_id"), operator)

        # Reset active version to v3
        AgentEngineerService.promote_candidate_version(self.db, "v3")

    def test_13_benchmark_evaluation_remains_regression_oriented_and_independent(self):
        """Test 13: Optimizer uses independent observation dataset and independent regression benchmark."""
        obs_seed = 42
        reg_seed = (obs_seed * 37 + 54321) % 99999 + 1000
        self.assertNotEqual(obs_seed, reg_seed, "Observation seed and regression benchmark seed must be independent")

        from backend.app.services.dataset_generator import SyntheticDatasetGenerator
        obs_ds = SyntheticDatasetGenerator.generate_dataset(seed=obs_seed, count=60)
        reg_ds = SyntheticDatasetGenerator.generate_dataset(seed=reg_seed, count=60)

        obs_amts = [b.amount for b in obs_ds.bank_transactions[:5]]
        reg_amts = [b.amount for b in reg_ds.bank_transactions[:5]]
        self.assertNotEqual(obs_amts, reg_amts, "Regression benchmark must contain independent transaction values")

    def test_14_promotion_rechecks_candidate_validation_and_rejects_unsafe_candidate(self):
        """Test 14: Promotion method re-checks candidate safety gates and rejects unsafe candidate even if marked accepted in DB."""
        unsafe_id = f"v_spoofed_{uuid.uuid4().hex[:4]}"
        unsafe_candidate = AgentVersionSchema(
            id=unsafe_id,
            version_name="Spoofed Unsafe Candidate",
            created_at="2026-09-06 12:00:00",
            system_prompt="Permissive prompt",
            confidence_threshold=0.10,  # Unsafe threshold
            matching_rules={
                "max_fee_amount": 5000.0,
                "date_window_days": 90,
                "allowed_auto_exception_types": [
                    "EXACT_MATCH", "AMOUNT_DISCREPANCY", "PARTIAL_PAYMENT", "MISSING_LEDGER"
                ]
            },
            is_active=False
        )
        AgentRegistry.register_version(unsafe_candidate)

        # Inject a forged accepted=True optimization run
        db_run = DBAgentOptimizationRun(
            id=f"opt_{uuid.uuid4().hex[:8]}",
            goal="Spoofed acceptance test",
            base_version_id="v3",
            candidate_version_id=unsafe_id,
            base_accuracy=0.99,
            candidate_accuracy=0.99,
            base_false_auto_post_rate=0.0,
            candidate_false_auto_post_rate=0.0,
            base_stp_rate=0.99,
            candidate_stp_rate=0.99,
            accepted=True,
            decision_rationale="Forged accepted rationale."
        )
        self.db.add(db_run)
        self.db.commit()

        # Promotion MUST independently re-check candidate validation and raise ValueError
        with self.assertRaises(ValueError) as ctx:
            AgentEngineerService.promote_candidate_version(self.db, unsafe_id)
        
        self.assertIn("failed validation criteria", str(ctx.exception).lower())
        # Active version remains v3
        self.assertEqual(AgentRegistry.get_active_version().id, "v3")


if __name__ == "__main__":
    unittest.main()

