"""
Regression test suite for Controlled Reconciliation Memory Layer.
Verifies all 9 core requirements:
1. Relevant historical feedback is retrieved.
2. Irrelevant feedback is excluded.
3. INR and USD historical cases remain separated (currency boundary).
4. Repeated consistent historical decisions strengthen the memory signal (WEAK -> MODERATE -> STRONG).
5. Conflicting historical decisions are surfaced (has_conflict=True, CONFLICTING trust, details).
6. A single historical decision does not globally alter reconciliation behavior.
7. Existing exact-match auto reconciliation remains unchanged.
8. Existing high-risk safety behavior remains unchanged.
9. Existing reports and CSV output remain unchanged.
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
    MemoryContext,
    MemoryTrustLevel,
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
from backend.app.services.report_service import CanonicalReportService


class TestReconciliationMemoryLayer(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        self.test_suffix = uuid.uuid4().hex[:8]
        self.batch_id = f"batch_mem_{self.test_suffix}"
        
        # Ensure agent version exists
        agent = self.db.query(DBAgentVersion).filter_by(id="v1").first()
        if not agent:
            agent = DBAgentVersion(
                id="v1",
                version_name="Agent V1 Base",
                system_prompt="Base reconciler",
                confidence_threshold=0.90
            )
            self.db.add(agent)
            self.db.commit()

        # Create batch
        self.batch = DBReconciliationBatch(
            id=self.batch_id,
            agent_version_id="v1",
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
        human_notes: str = "Verified by accountant",
        reviewer_id: str = "cpa_alice"
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
            agent_version_id="v1",
            match_type=exception_category,
            confidence_score=0.70,
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

    def test_01_relevant_historical_feedback_is_retrieved(self):
        """Test 1: Relevant historical feedback matching category, description, and currency is retrieved."""
        self._create_historical_case(
            case_id=f"rel_{self.test_suffix}",
            currency="USD",
            amount=500.00,
            description="WIRE TRANSFER ACME SUPPLIES INV-501",
            reference="INV-501",
            exception_category="TIMING_DIFFERENCE",
            resolution_type="TIMING_DIFFERENCE",
            human_notes="Supplier settlement cleared 2 days late due to holiday"
        )

        context = MemoryContext(
            currency="USD",
            amount=505.00,
            exception_category="TIMING_DIFFERENCE",
            description="ACME SUPPLIES WIRE",
            reference="INV-501"
        )
        result = ReconciliationMemoryService.retrieve_relevant_feedback(context, self.db)
        
        self.assertEqual(result.total_candidates_found, 1)
        self.assertEqual(result.matches[0].resolution_type, "TIMING_DIFFERENCE")
        self.assertGreaterEqual(result.matches[0].similarity_score, 0.60)
        self.assertEqual(result.predominant_resolution, "TIMING_DIFFERENCE")
        self.assertIn("Supplier settlement cleared 2 days late", result.advisory_evidence[-1])

    def test_02_irrelevant_feedback_is_excluded(self):
        """Test 2: Irrelevant feedback (different exception, completely different vendor and amount) is excluded."""
        self._create_historical_case(
            case_id=f"irrel_{self.test_suffix}",
            currency="USD",
            amount=50000.00,
            description="HEAVY MACHINERY PURCHASE CATERPILLAR",
            reference="CAT-9900",
            exception_category="DUPLICATE_TRANSACTION",
            resolution_type="DUPLICATE_TRANSACTION"
        )

        context = MemoryContext(
            currency="USD",
            amount=25.00,
            exception_category="BANK_FEE",
            description="MONTHLY SERVICE FEE CHASE",
            reference="FEE-001"
        )
        result = ReconciliationMemoryService.retrieve_relevant_feedback(context, self.db)
        self.assertEqual(result.total_candidates_found, 0)
        self.assertEqual(len(result.matches), 0)
        self.assertEqual(result.trust_level, MemoryTrustLevel.NONE)

    def test_03_inr_and_usd_historical_cases_remain_separated(self):
        """Test 3: Currency is a strict boundary; INR and USD cases are never mixed."""
        # Create identical amount, vendor, and exception in USD
        self._create_historical_case(
            case_id=f"usd_{self.test_suffix}",
            currency="USD",
            amount=1500.00,
            description="CLOUD HOSTING AWS SERVICES",
            reference="AWS-DEC",
            exception_category="AMOUNT_VARIANCE",
            resolution_type="AMOUNT_VARIANCE",
            human_notes="USD tax rate adjustment"
        )

        # Create identical amount, vendor, and exception in INR
        self._create_historical_case(
            case_id=f"inr_{self.test_suffix}",
            currency="INR",
            amount=1500.00,
            description="CLOUD HOSTING AWS SERVICES",
            reference="AWS-DEC",
            exception_category="AMOUNT_VARIANCE",
            resolution_type="AMOUNT_VARIANCE",
            human_notes="INR GST variance"
        )

        # 1. Query with USD boundary
        usd_context = MemoryContext(
            currency="USD",
            amount=1500.00,
            exception_category="AMOUNT_VARIANCE",
            description="CLOUD HOSTING AWS SERVICES",
            reference="AWS-DEC"
        )
        usd_res = ReconciliationMemoryService.retrieve_relevant_feedback(usd_context, self.db)
        self.assertEqual(usd_res.total_candidates_found, 1)
        self.assertEqual(usd_res.matches[0].currency, "USD")
        self.assertIn("USD tax rate adjustment", usd_res.matches[0].human_notes)

        # 2. Query with INR boundary
        inr_context = MemoryContext(
            currency="INR",
            amount=1500.00,
            exception_category="AMOUNT_VARIANCE",
            description="CLOUD HOSTING AWS SERVICES",
            reference="AWS-DEC"
        )
        inr_res = ReconciliationMemoryService.retrieve_relevant_feedback(inr_context, self.db)
        self.assertEqual(inr_res.total_candidates_found, 1)
        self.assertEqual(inr_res.matches[0].currency, "INR")
        self.assertIn("INR GST variance", inr_res.matches[0].human_notes)

    def test_04_repeated_consistent_historical_decisions_strengthen_memory_signal(self):
        """Test 4: Repeated consistent decisions strengthen trust level (WEAK -> MODERATE -> STRONG)."""
        context = MemoryContext(
            currency="EUR",
            amount=35.00,
            exception_category="BANK_FEE",
            description="EU WIRE TRANSFER FEE DEUTSCHE BANK",
            reference="FEE-DE"
        )

        # 1 historical case: trust level = WEAK
        self._create_historical_case(
            case_id=f"trust1_{self.test_suffix}",
            currency="EUR",
            amount=35.00,
            description="EU WIRE TRANSFER FEE DEUTSCHE BANK",
            reference="FEE-DE",
            exception_category="BANK_FEE",
            resolution_type="BANK_FEE"
        )
        res1 = ReconciliationMemoryService.retrieve_relevant_feedback(context, self.db)
        self.assertEqual(res1.total_candidates_found, 1)
        self.assertEqual(res1.trust_level, MemoryTrustLevel.WEAK)
        self.assertEqual(res1.consistency_score, 1.0)

        # 2 consistent cases: trust level = MODERATE
        self._create_historical_case(
            case_id=f"trust2_{self.test_suffix}",
            currency="EUR",
            amount=35.00,
            description="EU WIRE TRANSFER FEE DEUTSCHE BANK",
            reference="FEE-DE",
            exception_category="BANK_FEE",
            resolution_type="BANK_FEE"
        )
        res2 = ReconciliationMemoryService.retrieve_relevant_feedback(context, self.db)
        self.assertEqual(res2.total_candidates_found, 2)
        self.assertEqual(res2.trust_level, MemoryTrustLevel.MODERATE)
        self.assertEqual(res2.consistency_score, 1.0)

        # 3 consistent cases: trust level = STRONG
        self._create_historical_case(
            case_id=f"trust3_{self.test_suffix}",
            currency="EUR",
            amount=35.00,
            description="EU WIRE TRANSFER FEE DEUTSCHE BANK",
            reference="FEE-DE",
            exception_category="BANK_FEE",
            resolution_type="BANK_FEE"
        )
        res3 = ReconciliationMemoryService.retrieve_relevant_feedback(context, self.db)
        self.assertEqual(res3.total_candidates_found, 3)
        self.assertEqual(res3.trust_level, MemoryTrustLevel.STRONG)
        self.assertEqual(res3.consistency_score, 1.0)

    def test_05_conflicting_historical_decisions_are_surfaced(self):
        """Test 5: Conflicting historical decisions are explicitly surfaced rather than hidden."""
        # Insert Case A: resolved as BANK_FEE
        self._create_historical_case(
            case_id=f"confA_{self.test_suffix}",
            currency="GBP",
            amount=120.00,
            description="BARCLAYS RECON ADJUSTMENT",
            reference="ADJ-99",
            exception_category="AMOUNT_VARIANCE",
            resolution_type="BANK_FEE",
            human_notes="Accountant A considered this an overdraft fee"
        )

        # Insert Case B: resolved as TIMING_DIFFERENCE for the same vendor/context
        self._create_historical_case(
            case_id=f"confB_{self.test_suffix}",
            currency="GBP",
            amount=120.00,
            description="BARCLAYS RECON ADJUSTMENT",
            reference="ADJ-99",
            exception_category="AMOUNT_VARIANCE",
            resolution_type="TIMING_DIFFERENCE",
            human_notes="Accountant B considered this a timing difference"
        )

        context = MemoryContext(
            currency="GBP",
            amount=120.00,
            exception_category="AMOUNT_VARIANCE",
            description="BARCLAYS RECON ADJUSTMENT",
            reference="ADJ-99"
        )
        res = ReconciliationMemoryService.retrieve_relevant_feedback(context, self.db)
        self.assertEqual(res.total_candidates_found, 2)
        self.assertTrue(res.has_conflict)
        self.assertEqual(res.trust_level, MemoryTrustLevel.CONFLICTING)
        self.assertIsNotNone(res.conflict_details)
        self.assertEqual(res.conflict_details.get("BANK_FEE"), 1)
        self.assertEqual(res.conflict_details.get("TIMING_DIFFERENCE"), 1)
        
        # Verify evidence string contains the conflict warning
        conflict_msg = next((e for e in res.advisory_evidence if "[HISTORICAL MEMORY CONFLICT]" in e), None)
        self.assertIsNotNone(conflict_msg)
        self.assertIn("1x BANK_FEE", conflict_msg)
        self.assertIn("1x TIMING_DIFFERENCE", conflict_msg)

    def test_06_single_historical_decision_does_not_globally_alter_reconciliation_behavior(self):
        """Test 6: A historical human decision is strictly ADVISORY and does NOT force auto-reconciliation."""
        # Record a human resolution
        self._create_historical_case(
            case_id=f"adv_{self.test_suffix}",
            currency="USD",
            amount=250.00,
            description="OFFICE SUPPLIES CORP",
            reference="OFF-250",
            exception_category="AMOUNT_VARIANCE",
            resolution_type="BANK_FEE"
        )

        # Retrieve memory
        context = MemoryContext(
            currency="USD",
            amount=250.00,
            exception_category="AMOUNT_VARIANCE",
            description="OFFICE SUPPLIES CORP",
            reference="OFF-250"
        )
        mem = ReconciliationMemoryService.retrieve_relevant_feedback(context, self.db)
        self.assertEqual(mem.total_candidates_found, 1)

        # Evaluate through DecisionEngine: must NOT auto-reconcile
        bank_tx = NormalizedTransaction(
            id="TX_NEW_01",
            source=SourceType.BANK,
            date="2026-09-02",
            amount=250.00,
            normalized_amount=250.00,
            currency="USD",
            direction="DEBIT",
            description="OFFICE SUPPLIES CORP",
            reference="OFF-250"
        )
        ledger_cand = NormalizedTransaction(
            id="L_CAND_01",
            source=SourceType.LEDGER,
            date="2026-09-02",
            amount=250.00,
            normalized_amount=250.00,
            currency="USD",
            direction="DEBIT",
            description="OFFICE SUPPLIES CORP",
            reference="OFF-250"
        )
        decision_out = DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_cand,
            selected_ledger_id=ledger_cand.id,
            confidence=0.72,
            evidence=mem.advisory_evidence,
            exception_type="AMOUNT_VARIANCE",
            policy=DecisionPolicy(confidence_threshold=0.90)
        )
        
        # Must strictly remain ESCALATE_TO_HUMAN
        self.assertEqual(decision_out.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertNotEqual(decision_out.decision, ActionTaken.AUTO_RECONCILE.value)
        # Advisory evidence must be preserved
        self.assertTrue(any("[HISTORICAL MEMORY]" in ev for ev in decision_out.evidence))

    def test_07_existing_exact_match_auto_reconciliation_remains_unchanged(self):
        """Test 7: Standard exact-match auto-reconciliation is completely unaffected by memory layer."""
        bank_tx = NormalizedTransaction(
            id="B_EXACT_01",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=1000.00,
            normalized_amount=1000.00,
            currency="USD",
            direction="CREDIT",
            description="CUSTOMER PAYMENT INV-8899",
            reference="INV-8899"
        )
        ledger_tx = NormalizedTransaction(
            id="L_EXACT_01",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=1000.00,
            normalized_amount=1000.00,
            currency="USD",
            direction="CREDIT",
            description="Customer Invoice 8899",
            reference="INV-8899"
        )
        evidence = [
            "Exact reference match: INV-8899",
            "Exact amount match: $1,000.00 USD",
            "Matching economic direction: CREDIT"
        ]

        decision_out = DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            selected_ledger_id=ledger_tx.id,
            confidence=0.98,
            evidence=evidence,
            exception_type="EXACT",
            policy=DecisionPolicy(confidence_threshold=0.90)
        )
        self.assertEqual(decision_out.decision, ActionTaken.AUTO_RECONCILE.value)

    def test_08_existing_high_risk_safety_behavior_remains_unchanged(self):
        """Test 8: High-risk financial contradictions strictly override confidence and memory."""
        # Contradiction: Material amount mismatch ($1,000 vs $500)
        bank_tx = NormalizedTransaction(
            id="B_RISK_01",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=1000.00,
            normalized_amount=1000.00,
            currency="USD",
            direction="CREDIT",
            description="PARTNER SETTLEMENT",
            reference="REF-77"
        )
        ledger_tx = NormalizedTransaction(
            id="L_RISK_01",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=500.00,
            normalized_amount=500.00,
            currency="USD",
            direction="CREDIT",
            description="Partner Settlement Partial",
            reference="REF-77"
        )
        # Even with artificial 0.99 confidence and strong memory evidence:
        mem_evidence = ["[HISTORICAL MEMORY] 5 consistent human resolutions (STRONG trust)"]
        decision_out = DecisionEngine.evaluate_decision(
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            selected_ledger_id=ledger_tx.id,
            confidence=0.99,
            evidence=mem_evidence + ["High confidence match"],
            exception_type="AMOUNT_DISCREPANCY",
            policy=DecisionPolicy(confidence_threshold=0.90)
        )
        # Hard safety override forces escalation
        self.assertEqual(decision_out.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertFalse(decision_out.policy_checks[3].passed)

    def test_09_existing_reports_and_csv_output_remain_unchanged(self):
        """Test 9: Canonical reporting and CSV generation remain completely functional and unchanged."""
        bank_tx = NormalizedTransaction(
            id="b1",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=100.00,
            normalized_amount=100.00,
            currency="USD",
            direction="CREDIT",
            description="SAMPLE CREDIT"
        )
        ledger_tx = NormalizedTransaction(
            id="l1",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=100.00,
            normalized_amount=100.00,
            currency="USD",
            direction="CREDIT",
            description="SAMPLE LEDGER"
        )
        res_item = ReconciliationResultSchema(
            id="res_test_rep",
            batch_id=self.batch_id,
            agent_version_id="v1",
            bank_tx_id="b1",
            bank_tx=bank_tx,
            ledger_tx_id="l1",
            ledger_tx=ledger_tx,
            match_type=MatchType.EXACT,
            processing_method=ProcessingMethod.RULE,
            confidence_score=0.95,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Exact match",
            evidence=["Exact match $100.00"],
            reconciliation_status=ReconciliationStatus.AUTO_MATCHED
        )
        summary = CanonicalReportService.generate_canonical_summary(
            batch_id=self.batch_id,
            bank_txs=[bank_tx],
            ledger_txs=[ledger_tx],
            results=[res_item],
            agent_version_id="v1"
        )
        self.assertEqual(summary["counts"]["auto_matched"], 1)
        self.assertEqual(summary["quality_metrics"]["straight_through_rate"], 100.0)

        csv_str = CanonicalReportService.generate_csv_report(summary)
        self.assertIn("Bank Transaction ID", csv_str)
        self.assertIn("Reconciliation Status", csv_str)
        self.assertIn("AUTO_MATCHED", csv_str)


if __name__ == "__main__":
    unittest.main()
