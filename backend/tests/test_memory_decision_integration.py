"""
Fix 4 Integration Test Suite: Connecting Reconciliation Memory to Future Reconciliation Decisions.

Verifies all 10 core integration tests (Test A through Test J):
- Test A: Relevant memory is available to future decision evaluation
- Test B: Unrelated memory is ignored
- Test C: Currency separation (USD vs INR strict isolation)
- Test D: Memory does NOT inflate deterministic confidence
- Test E: Hard safety rules strictly override historical memory
- Test F: Conflicting historical memory remains conservative (escalates to human)
- Test G: Single historical precedent does not cause global auto-matching
- Test H: Strong repeated precedent remains advisory and cannot bypass safety
- Test I: Existing exact matches remain completely unchanged
- Test J: Canonical reports and CSV exports remain completely unchanged
"""

import os
import sys
import uuid
import unittest

# Ensure backend package import path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.core.database import SessionLocal, engine, Base
from backend.app.models.pydantic_models import (
    MemoryContext,
    MemoryTrustLevel,
    DecisionMemoryContext,
    HumanStatus,
    ResolutionType,
    ActionTaken,
    MatchType,
    ProcessingMethod,
    NormalizedTransaction,
    ReconciliationStatus,
    SourceType,
    CandidateMatchItem,
    DecisionPolicy,
    ReconciliationResultSchema,
)
from backend.app.models.db import (
    DBAgentVersion,
    DBReconciliationBatch,
    DBReconciliationResult,
    DBTransaction,
    DBReconciliationFeedback,
    DBAuditLog,
)
from backend.app.services.memory_service import ReconciliationMemoryService
from backend.app.services.decision_engine import DecisionEngine
from backend.app.services.audit_service import AuditService
from backend.app.services.report_service import CanonicalReportService


class TestMemoryDecisionIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

    def setUp(self):
        self.db = SessionLocal()
        self.test_suffix = uuid.uuid4().hex[:8]
        self.batch_id = f"batch_fix4_{self.test_suffix}"

        # Ensure agent version exists
        agent = self.db.query(DBAgentVersion).filter_by(id="v3").first()
        if not agent:
            agent = DBAgentVersion(
                id="v3",
                version_name="Agent V3 Configurable",
                system_prompt="Standard configurable reconciler",
                confidence_threshold=0.90
            )
            self.db.add(agent)
            self.db.commit()

        # Create batch
        self.batch = DBReconciliationBatch(
            id=self.batch_id,
            agent_version_id="v3",
            bank_filename="bank.csv",
            ledger_filename="ledger.csv",
            total_bank_tx=1,
            total_ledger_tx=1,
            status="completed"
        )
        self.db.add(self.batch)
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        self.db.query(DBReconciliationFeedback).filter(
            DBReconciliationFeedback.reconciliation_batch_id == self.batch_id
        ).delete()
        self.db.query(DBAuditLog).filter(
            DBAuditLog.transaction_id.like(f"%{self.test_suffix}%")
        ).delete()
        self.db.query(DBReconciliationResult).filter(
            DBReconciliationResult.batch_id == self.batch_id
        ).delete()
        self.db.query(DBTransaction).filter(
            DBTransaction.batch_id == self.batch_id
        ).delete()
        self.db.query(DBReconciliationBatch).filter(
            DBReconciliationBatch.id == self.batch_id
        ).delete()
        self.db.commit()
        self.db.close()

    def _create_historical_case(
        self,
        case_id: str,
        currency: str,
        amount: float,
        description: str,
        reference: str,
        exception_category: str,
        resolution_type: str,
        human_notes: str = "Verified by senior accountant",
        reviewer_id: str = "cpa_bob"
    ):
        bank_tx_id = f"bank_{case_id}"
        tx = DBTransaction(
            id=bank_tx_id,
            batch_id=self.batch_id,
            source="BANK",
            date="2026-09-01",
            amount=-amount,
            currency=currency,
            description=description,
            reference_id=reference
        )
        self.db.add(tx)

        res_id = f"res_{case_id}"
        res = DBReconciliationResult(
            id=res_id,
            batch_id=self.batch_id,
            bank_tx_id=bank_tx_id,
            ledger_tx_id=None,
            agent_version_id="v3",
            match_type=exception_category,
            confidence_score=0.75,
            action_taken="ESCALATE_TO_HUMAN",
            reasoning="Escalated for human review",
            human_status="APPROVED",
            human_notes=human_notes
        )
        self.db.add(res)

        fb = DBReconciliationFeedback(
            id=f"fb_{case_id}",
            reconciliation_result_id=res_id,
            reconciliation_batch_id=self.batch_id,
            bank_transaction_id=bank_tx_id,
            previous_decision="ESCALATE_TO_HUMAN",
            human_action="APPROVED",
            resolution_type=resolution_type,
            corrected_ledger_id=None,
            human_notes=human_notes,
            relevant_exception_category=exception_category,
            currency=currency,
            amount=amount,
            reviewer_id=reviewer_id
        )
        self.db.add(fb)
        self.db.commit()
        return res_id

    # -------------------------------------------------------------------------
    # Test A: Relevant memory is available to future decision evaluation
    # -------------------------------------------------------------------------
    def test_A_relevant_memory_is_available_to_future_decision_evaluation(self):
        """Test A: Historical human resolution is retrieved and attached as advisory context to future decision."""
        # 1. Historical human resolution
        self._create_historical_case(
            case_id=f"testA_{self.test_suffix}",
            currency="USD",
            amount=320.00,
            description="STRIPE PAYOUT SETTLEMENT FEE",
            reference="STRIPE-320",
            exception_category="BANK_FEE",
            resolution_type="BANK_FEE",
            human_notes="Stripe processing surcharge confirmed"
        )

        # 2. Future similar reconciliation result with candidate ledger entry
        future_bank_tx = NormalizedTransaction(
            id=f"b_future_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-05",
            amount=320.00,
            normalized_amount=320.00,
            currency="USD",
            direction="DEBIT",
            description="STRIPE PAYOUT SETTLEMENT FEE",
            reference="STRIPE-320"
        )
        future_ledger_tx = NormalizedTransaction(
            id=f"l_future_{self.test_suffix}",
            source=SourceType.LEDGER,
            date="2026-09-05",
            amount=330.00,
            normalized_amount=330.00,
            currency="USD",
            direction="DEBIT",
            description="Stripe Payout Gross",
            reference="STRIPE-320"
        )
        future_result = ReconciliationResultSchema(
            id=f"res_future_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=future_bank_tx.id,
            bank_tx=future_bank_tx,
            ledger_tx_id=future_ledger_tx.id,
            ledger_tx=future_ledger_tx,
            match_type=MatchType.BANK_FEE,
            confidence_score=0.72,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Bank fee exception requiring confirmation",
            reconciliation_status=ReconciliationStatus.HUMAN_REVIEW
        )

        # 3. Memory lookup + Decision evaluation
        decision_out = DecisionEngine.evaluate_reconciliation_result(
            result=future_result,
            agent_version="v3",
            db=self.db
        )

        # 4. Verify historical memory is visible in decision context
        self.assertIsNotNone(decision_out.memory_context)
        self.assertTrue(decision_out.memory_context.has_memory)
        self.assertEqual(decision_out.memory_context.precedent_count, 1)
        self.assertEqual(decision_out.memory_context.predominant_resolution, "BANK_FEE")
        self.assertFalse(decision_out.memory_context.has_conflict)
        self.assertTrue(any("[HISTORICAL MEMORY]" in e for e in decision_out.evidence))
        self.assertIsNotNone(decision_out.stop_reason_details)
        self.assertEqual(decision_out.stop_reason_details["historical_precedent_recommendation"], "BANK_FEE")
        self.assertTrue(decision_out.stop_reason_details["historical_memory"]["memory_used"])

    # -------------------------------------------------------------------------
    # Test B: Unrelated memory is ignored
    # -------------------------------------------------------------------------
    def test_B_unrelated_memory_is_ignored(self):
        """Test B: Unrelated historical cases (different exception, vendor, amount) do not attach to decision."""
        # Unrelated historical case: Heavy machinery in USD
        self._create_historical_case(
            case_id=f"testB_{self.test_suffix}",
            currency="USD",
            amount=75000.00,
            description="CATERPILLAR EXCAVATOR PURCHASE",
            reference="CAT-8899",
            exception_category="DUPLICATE_TRANSACTION",
            resolution_type="DUPLICATE_TRANSACTION"
        )

        # Future case: Small software subscription
        bank_tx = NormalizedTransaction(
            id=f"b_software_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-05",
            amount=49.00,
            normalized_amount=49.00,
            currency="USD",
            direction="DEBIT",
            description="GITHUB ENTERPRISE SEATS",
            reference="GH-49"
        )
        result = ReconciliationResultSchema(
            id=f"res_sw_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            ledger_tx_id=None,
            match_type=MatchType.BANK_FEE,
            confidence_score=0.60,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Subscription review"
        )

        decision_out = DecisionEngine.evaluate_reconciliation_result(
            result=result,
            agent_version="v3",
            db=self.db
        )

        # No memory attached
        self.assertTrue(decision_out.memory_context is None or not decision_out.memory_context.has_memory)
        self.assertFalse(any("CATERPILLAR" in e for e in decision_out.evidence))

    # -------------------------------------------------------------------------
    # Test C: Currency separation (USD vs INR strict isolation)
    # -------------------------------------------------------------------------
    def test_C_currency_separation_usd_inr(self):
        """Test C: USD precedent never influences INR, and INR precedent never influences USD."""
        # Create USD historical case
        self._create_historical_case(
            case_id=f"usd_c_{self.test_suffix}",
            currency="USD",
            amount=5000.00,
            description="CONSULTING SERVICES RETAINER",
            reference="RET-5000",
            exception_category="TIMING_DIFFERENCE",
            resolution_type="TIMING_DIFFERENCE",
            human_notes="USD Retainer approved"
        )

        # Future INR case: exactly identical description, reference, amount, but in INR
        inr_bank_tx = NormalizedTransaction(
            id=f"b_inr_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-05",
            amount=5000.00,
            normalized_amount=5000.00,
            currency="INR",
            direction="DEBIT",
            description="CONSULTING SERVICES RETAINER",
            reference="RET-5000"
        )
        inr_result = ReconciliationResultSchema(
            id=f"res_inr_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=inr_bank_tx.id,
            bank_tx=inr_bank_tx,
            ledger_tx_id=None,
            match_type=MatchType.TIMING_DIFFERENCE,
            confidence_score=0.70,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Timing check"
        )

        decision_inr = DecisionEngine.evaluate_reconciliation_result(
            result=inr_result,
            agent_version="v3",
            db=self.db
        )

        # USD historical record must NOT be visible to INR transaction
        self.assertTrue(decision_inr.memory_context is None or not decision_inr.memory_context.has_memory)

        # Now create an INR historical case
        self._create_historical_case(
            case_id=f"inr_c_{self.test_suffix}",
            currency="INR",
            amount=5000.00,
            description="CONSULTING SERVICES RETAINER",
            reference="RET-5000",
            exception_category="TIMING_DIFFERENCE",
            resolution_type="TIMING_DIFFERENCE",
            human_notes="INR Retainer approved with GST"
        )

        decision_inr_2 = DecisionEngine.evaluate_reconciliation_result(
            result=inr_result,
            agent_version="v3",
            db=self.db
        )

        # INR historical record is visible, but USD is excluded
        self.assertIsNotNone(decision_inr_2.memory_context)
        self.assertTrue(decision_inr_2.memory_context.has_memory)
        self.assertEqual(decision_inr_2.memory_context.precedent_count, 1)
        self.assertIn("INR Retainer approved with GST", decision_inr_2.evidence[-1])

    # -------------------------------------------------------------------------
    # Test D: Memory does NOT inflate deterministic confidence
    # -------------------------------------------------------------------------
    def test_D_memory_does_not_inflate_confidence(self):
        """Test D: Deterministic confidence before memory must strictly equal confidence after memory."""
        self._create_historical_case(
            case_id=f"testD_{self.test_suffix}",
            currency="USD",
            amount=200.00,
            description="SUBSCRIPTION FEE",
            reference="SUB-200",
            exception_category="BANK_FEE",
            resolution_type="BANK_FEE"
        )

        bank_tx = NormalizedTransaction(
            id=f"b_d_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-05",
            amount=200.00,
            normalized_amount=200.00,
            currency="USD",
            direction="DEBIT",
            description="SUBSCRIPTION FEE",
            reference="SUB-200"
        )

        ledger_cand = NormalizedTransaction(
            id=f"l_d_{self.test_suffix}",
            source=SourceType.LEDGER,
            date="2026-09-05",
            amount=210.00,
            normalized_amount=210.00,
            currency="USD",
            direction="DEBIT",
            description="Subscription Fee Gross",
            reference="SUB-200"
        )

        deterministic_conf = 0.68
        result = ReconciliationResultSchema(
            id=f"res_d_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            ledger_tx_id=ledger_cand.id,
            ledger_tx=ledger_cand,
            match_type=MatchType.BANK_FEE,
            confidence_score=deterministic_conf,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Bank fee deduction"
        )

        decision_out = DecisionEngine.evaluate_reconciliation_result(
            result=result,
            agent_version="v3",
            db=self.db
        )

        # Invariant: deterministic_confidence_before_memory == deterministic_confidence_after_memory
        self.assertEqual(decision_out.confidence, deterministic_conf)
        self.assertEqual(decision_out.match_confidence, deterministic_conf)
        self.assertNotEqual(decision_out.confidence, 0.95)

    # -------------------------------------------------------------------------
    # Test E: Hard safety rules still override memory
    # -------------------------------------------------------------------------
    def test_E_hard_safety_still_overrides_memory(self):
        """Test E: Even with strong memory, material amount mismatch, currency conflict, or direction conflict force human review."""
        # 3 consistent historical cases -> STRONG trust
        for i in range(3):
            self._create_historical_case(
                case_id=f"safety_{i}_{self.test_suffix}",
                currency="USD",
                amount=1000.00,
                description="SUPPLIER INVOICE PAYMENT",
                reference="INV-SUPP",
                exception_category="AMOUNT_VARIANCE",
                resolution_type="BANK_FEE"
            )

        # Case E1: Material Amount Variance ($1000 vs $600 -> diff $400)
        bank_tx = NormalizedTransaction(
            id=f"b_amt_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-05",
            amount=1000.00,
            normalized_amount=1000.00,
            currency="USD",
            direction="DEBIT",
            description="SUPPLIER INVOICE PAYMENT",
            reference="INV-SUPP"
        )
        ledger_cand = NormalizedTransaction(
            id=f"l_amt_{self.test_suffix}",
            source=SourceType.LEDGER,
            date="2026-09-05",
            amount=600.00,
            normalized_amount=600.00,
            currency="USD",
            direction="DEBIT",
            description="SUPPLIER INVOICE PAYMENT",
            reference="INV-SUPP"
        )
        res_e1 = ReconciliationResultSchema(
            id=f"res_e1_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            ledger_tx_id=ledger_cand.id,
            ledger_tx=ledger_cand,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.98,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Amount variance"
        )

        dec_e1 = DecisionEngine.evaluate_reconciliation_result(
            result=res_e1,
            agent_version="v3",
            db=self.db
        )

        # Hard safety must strictly escalate despite strong memory
        self.assertEqual(dec_e1.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertFalse(dec_e1.auto_match_eligible)
        self.assertTrue(dec_e1.memory_context.has_memory)
        self.assertEqual(dec_e1.memory_context.trust_level, MemoryTrustLevel.STRONG)

        # Case E2: Currency conflict (USD vs EUR)
        ledger_eur = NormalizedTransaction(
            id=f"l_eur_{self.test_suffix}",
            source=SourceType.LEDGER,
            date="2026-09-05",
            amount=1000.00,
            normalized_amount=1000.00,
            currency="EUR",
            direction="DEBIT",
            description="SUPPLIER INVOICE PAYMENT",
            reference="INV-SUPP"
        )
        res_e2 = ReconciliationResultSchema(
            id=f"res_e2_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            ledger_tx_id=ledger_eur.id,
            ledger_tx=ledger_eur,
            match_type=MatchType.FX_VARIANCE,
            confidence_score=0.95,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Currency mismatch"
        )
        dec_e2 = DecisionEngine.evaluate_reconciliation_result(result=res_e2, agent_version="v3", db=self.db)
        self.assertEqual(dec_e2.decision, ActionTaken.ESCALATE_TO_HUMAN.value)

    # -------------------------------------------------------------------------
    # Test F: Conflicting memory remains conservative
    # -------------------------------------------------------------------------
    def test_F_conflicting_memory_remains_conservative(self):
        """Test F: If memory has conflicting resolutions, surface conflict and escalate to human."""
        # Precedent 1: BANK_FEE
        self._create_historical_case(
            case_id=f"conf1_{self.test_suffix}",
            currency="USD",
            amount=150.00,
            description="VENDOR RECONCILIATION DIFFERENCE",
            reference="VEND-DIFF",
            exception_category="AMOUNT_VARIANCE",
            resolution_type="BANK_FEE"
        )
        # Precedent 2: TIMING_DIFFERENCE
        self._create_historical_case(
            case_id=f"conf2_{self.test_suffix}",
            currency="USD",
            amount=150.00,
            description="VENDOR RECONCILIATION DIFFERENCE",
            reference="VEND-DIFF",
            exception_category="AMOUNT_VARIANCE",
            resolution_type="TIMING_DIFFERENCE"
        )

        bank_tx = NormalizedTransaction(
            id=f"b_conf_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-05",
            amount=150.00,
            normalized_amount=150.00,
            currency="USD",
            direction="DEBIT",
            description="VENDOR RECONCILIATION DIFFERENCE",
            reference="VEND-DIFF"
        )
        ledger_cand = NormalizedTransaction(
            id=f"l_conf_{self.test_suffix}",
            source=SourceType.LEDGER,
            date="2026-09-05",
            amount=155.00,
            normalized_amount=155.00,
            currency="USD",
            direction="DEBIT",
            description="Vendor Recon Diff Ledger",
            reference="VEND-DIFF"
        )
        res = ReconciliationResultSchema(
            id=f"res_conf_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            ledger_tx_id=ledger_cand.id,
            ledger_tx=ledger_cand,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.70,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Variance exception"
        )

        dec = DecisionEngine.evaluate_reconciliation_result(result=res, agent_version="v3", db=self.db)

        self.assertEqual(dec.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertTrue(dec.memory_context.has_conflict)
        self.assertEqual(dec.memory_context.trust_level, MemoryTrustLevel.CONFLICTING)
        self.assertEqual(dec.memory_context.conflict_details.get("BANK_FEE"), 1)
        self.assertEqual(dec.memory_context.conflict_details.get("TIMING_DIFFERENCE"), 1)
        self.assertTrue(any("[HISTORICAL MEMORY CONFLICT]" in e for e in dec.evidence))

    # -------------------------------------------------------------------------
    # Test G: Single precedent is not global behavior
    # -------------------------------------------------------------------------
    def test_G_single_precedent_is_not_global_behavior(self):
        """Test G: One historical resolution does NOT cause future transactions to auto-reconcile."""
        self._create_historical_case(
            case_id=f"single_{self.test_suffix}",
            currency="USD",
            amount=88.00,
            description="RECURRING COURIER SERVICE",
            reference="COU-88",
            exception_category="AMOUNT_VARIANCE",
            resolution_type="BANK_FEE"
        )

        bank_tx = NormalizedTransaction(
            id=f"b_cou_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-05",
            amount=88.00,
            normalized_amount=88.00,
            currency="USD",
            direction="DEBIT",
            description="RECURRING COURIER SERVICE",
            reference="COU-88"
        )
        ledger_cand = NormalizedTransaction(
            id=f"l_cou_{self.test_suffix}",
            source=SourceType.LEDGER,
            date="2026-09-05",
            amount=90.00,
            normalized_amount=90.00,
            currency="USD",
            direction="DEBIT",
            description="Recurring Courier Service Open",
            reference="COU-88"
        )
        res = ReconciliationResultSchema(
            id=f"res_cou_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            ledger_tx_id=ledger_cand.id,
            ledger_tx=ledger_cand,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.74,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Courier variance"
        )

        dec = DecisionEngine.evaluate_reconciliation_result(result=res, agent_version="v3", db=self.db)

        # Single precedent is WEAK trust and MUST NOT trigger auto-reconciliation
        self.assertEqual(dec.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertEqual(dec.memory_context.trust_level, MemoryTrustLevel.WEAK)
        self.assertFalse(dec.auto_match_eligible)

    # -------------------------------------------------------------------------
    # Test H: Strong repeated precedent remains advisory
    # -------------------------------------------------------------------------
    def test_H_strong_repeated_precedent_remains_advisory(self):
        """Test H: Three consistent cases produce STRONG trust, but remain advisory and cannot bypass policy."""
        for i in range(3):
            self._create_historical_case(
                case_id=f"strong_{i}_{self.test_suffix}",
                currency="USD",
                amount=75.00,
                description="INTERNET PROVIDER FIBER",
                reference="ISP-75",
                exception_category="BANK_FEE",
                resolution_type="BANK_FEE"
            )

        bank_tx = NormalizedTransaction(
            id=f"b_isp_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-05",
            amount=75.00,
            normalized_amount=75.00,
            currency="USD",
            direction="DEBIT",
            description="INTERNET PROVIDER FIBER",
            reference="ISP-75"
        )
        ledger_cand = NormalizedTransaction(
            id=f"l_isp_{self.test_suffix}",
            source=SourceType.LEDGER,
            date="2026-09-05",
            amount=80.00,
            normalized_amount=80.00,
            currency="USD",
            direction="DEBIT",
            description="Internet Provider Fiber Invoice",
            reference="ISP-75"
        )
        res = ReconciliationResultSchema(
            id=f"res_isp_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            ledger_tx_id=ledger_cand.id,
            ledger_tx=ledger_cand,
            match_type=MatchType.BANK_FEE,
            confidence_score=0.75,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="ISP surcharge exception"
        )

        dec = DecisionEngine.evaluate_reconciliation_result(result=res, agent_version="v3", db=self.db)

        self.assertEqual(dec.memory_context.trust_level, MemoryTrustLevel.STRONG)
        self.assertEqual(dec.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertFalse(dec.auto_match_eligible)

    # -------------------------------------------------------------------------
    # Test I: Exact matches remain unchanged
    # -------------------------------------------------------------------------
    def test_I_exact_matches_remain_unchanged(self):
        """Test I: Exact-match auto-reconciliation is completely unchanged and does not query memory."""
        bank_tx = NormalizedTransaction(
            id=f"b_exact_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=1500.00,
            normalized_amount=1500.00,
            currency="USD",
            direction="CREDIT",
            description="INVOICE 1001 PAYMENT",
            reference="INV-1001"
        )
        ledger_tx = NormalizedTransaction(
            id=f"l_exact_{self.test_suffix}",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=1500.00,
            normalized_amount=1500.00,
            currency="USD",
            direction="CREDIT",
            description="Customer Invoice 1001",
            reference="INV-1001"
        )
        res = ReconciliationResultSchema(
            id=f"res_exact_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            ledger_tx_id=ledger_tx.id,
            ledger_tx=ledger_tx,
            match_type=MatchType.EXACT,
            confidence_score=0.99,
            action_taken=ActionTaken.AUTO_RECONCILE,
            evidence=[
                "Exact reference match: INV-1001",
                "Exact amount match: $1,500.00 USD",
                "Matching economic direction: CREDIT"
            ],
            reasoning="Deterministic exact match"
        )

        dec = DecisionEngine.evaluate_reconciliation_result(result=res, agent_version="v3", db=self.db)

        self.assertEqual(dec.decision, ActionTaken.AUTO_RECONCILE.value)
        self.assertEqual(dec.reconciliation_status, "AUTO_MATCHED")
        self.assertTrue(dec.auto_match_eligible)
        self.assertEqual(dec.confidence, 0.99)

    # -------------------------------------------------------------------------
    # Test J: Reports remain unchanged
    # -------------------------------------------------------------------------
    def test_J_reports_remain_unchanged(self):
        """Test J: Canonical reports and CSV exports operate identically with memory-enabled results."""
        bank_tx = NormalizedTransaction(
            id=f"b_rep_{self.test_suffix}",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=200.00,
            normalized_amount=200.00,
            currency="USD",
            direction="CREDIT",
            description="REPORT TEST TX"
        )
        res = ReconciliationResultSchema(
            id=f"res_rep_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=bank_tx.id,
            bank_tx=bank_tx,
            match_type=MatchType.BANK_FEE,
            processing_method=ProcessingMethod.RULE,
            confidence_score=0.70,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Human review required",
            reconciliation_status=ReconciliationStatus.HUMAN_REVIEW,
            memory_context=DecisionMemoryContext(
                has_memory=True,
                precedent_count=2,
                trust_level=MemoryTrustLevel.MODERATE,
                predominant_resolution="BANK_FEE",
                consistency_score=1.0,
                has_conflict=False,
                feedback_ids=["fb_rep_1", "fb_rep_2"],
                advisory_evidence=["[HISTORICAL MEMORY] 2 consistent precedents"]
            )
        )

        # Audit item creation with memory provenance
        audit_item = AuditService.create_audit_item(res, agent_version_id="v3")
        self.assertIsNotNone(audit_item.memory_provenance)
        self.assertTrue(audit_item.memory_provenance["memory_used"])
        self.assertEqual(audit_item.memory_provenance["memory_match_count"], 2)
        self.assertTrue(any(e.stage_name == "HISTORICAL_MEMORY_STAGE" for e in audit_item.timeline_events))

        # Canonical report generation
        summary = CanonicalReportService.generate_canonical_summary(
            batch_id=self.batch_id,
            bank_txs=[bank_tx],
            ledger_txs=[],
            results=[res],
            agent_version_id="v3"
        )
        self.assertEqual(summary["counts"]["human_review"], 1)

        csv_str = CanonicalReportService.generate_csv_report(summary)
        self.assertIn("Bank Transaction ID", csv_str)
        self.assertIn("HUMAN_REVIEW", csv_str)


if __name__ == "__main__":
    unittest.main()
