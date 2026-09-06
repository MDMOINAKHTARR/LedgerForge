"""
Test suite for Accountant-in-the-Loop Resolution Workflow (Fix 7 Hardening).

Covers all 19 targeted safety and correctness test cases (A through S):
A. Confirm match
B. Correct ledger reassignment
C. Wrong match
D. Bank fee
E. Timing difference
F. Partial payment
G. Duplicate
H. Missing ledger
I. Missing bank
J. Amount variance
K. Other without note -> rejected (400)
L. Other with note -> accepted (200)
M. Invalid corrected ledger -> rejected (400)
N. Cross-batch corrected ledger -> rejected (400)
O. Already-consumed corrected ledger -> rejected (400)
P. Cross-currency corrected ledger -> rejected (400)
Q. Reviewer ID + notes preserved
R. AI recommendation remains reconstructable
S. Legacy APPROVE/REJECT compatibility
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
    HumanStatus,
    ResolutionType,
    ActionTaken,
)
from backend.app.models.db import (
    DBAgentVersion,
    DBReconciliationBatch,
    DBReconciliationResult,
    DBTransaction,
    DBReconciliationFeedback,
    DBAuditLog,
)


class TestAccountantResolutionWorkflow(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        self.test_suffix = uuid.uuid4().hex[:8]
        self.batch_id = f"batch_acct_{self.test_suffix}"
        self.other_batch_id = f"batch_other_{self.test_suffix}"
        
        # Ensure agent version exists
        agent = self.db.query(DBAgentVersion).filter_by(id="v3").first()
        if not agent:
            agent = DBAgentVersion(
                id="v3",
                version_name="Agent V3 Production",
                system_prompt="Production reconciler",
                confidence_threshold=0.90,
                is_active=True
            )
            self.db.add(agent)
            self.db.commit()

        # Create primary batch
        self.batch = DBReconciliationBatch(
            id=self.batch_id,
            agent_version_id="v3",
            bank_filename="test_bank.csv",
            ledger_filename="test_ledger.csv",
            total_bank_tx=4,
            total_ledger_tx=5,
            auto_reconciled_count=1,
            escalated_count=3,
            rejected_count=0,
            status="completed"
        )
        self.db.add(self.batch)

        # Create other batch (for cross-batch candidate isolation testing)
        self.other_batch = DBReconciliationBatch(
            id=self.other_batch_id,
            agent_version_id="v3",
            bank_filename="other_bank.csv",
            ledger_filename="other_ledger.csv",
            total_bank_tx=1,
            total_ledger_tx=1,
            auto_reconciled_count=0,
            escalated_count=1,
            rejected_count=0,
            status="completed"
        )
        self.db.add(self.other_batch)

        # 1. Bank Transaction 1 (USD, $2,475.00)
        self.bank_tx_1 = DBTransaction(
            id=f"{self.batch_id}_bank_b1",
            batch_id=self.batch_id,
            source="BANK",
            date="2026-03-15",
            amount=2475.00,
            currency="USD",
            description="GlobalTech Wire Ref INV-1001",
            reference_id="INV-1001",
            raw_data={"value_date": "2026-03-16", "counterparty": "GlobalTech Consulting", "direction": "CREDIT", "transaction_type": "CR"}
        )
        self.db.add(self.bank_tx_1)

        # 2. Ledger Transaction 1 (USD, $2,500.00 - original candidate)
        self.ledger_tx_1 = DBTransaction(
            id=f"{self.batch_id}_ledger_l1",
            batch_id=self.batch_id,
            source="LEDGER",
            date="2026-03-15",
            amount=2500.00,
            currency="USD",
            description="GlobalTech Invoice INV-1001 Gross",
            reference_id="INV-1001",
            raw_data={"posting_date": "2026-03-15", "invoice_id": "INV-1001", "counterparty": "GlobalTech Consulting", "status": "POSTED"}
        )
        self.db.add(self.ledger_tx_1)

        # 3. Ledger Transaction 2 (USD, $2,475.00 - valid alternative candidate)
        self.ledger_tx_2 = DBTransaction(
            id=f"{self.batch_id}_ledger_l2",
            batch_id=self.batch_id,
            source="LEDGER",
            date="2026-03-14",
            amount=2475.00,
            currency="USD",
            description="GlobalTech Revised Net Invoice INV-1002",
            reference_id="INV-1002",
            raw_data={"posting_date": "2026-03-14", "invoice_id": "INV-1002", "counterparty": "GlobalTech Consulting", "status": "POSTED"}
        )
        self.db.add(self.ledger_tx_2)

        # 4. Bank Transaction Consumed & Ledger Transaction Consumed (Already reconciled in this batch)
        self.bank_tx_consumed = DBTransaction(
            id=f"{self.batch_id}_bank_b_consumed",
            batch_id=self.batch_id,
            source="BANK",
            date="2026-03-10",
            amount=1000.00,
            currency="USD",
            description="Already Reconciled Bank Item",
            reference_id="REF-CONS-01"
        )
        self.db.add(self.bank_tx_consumed)

        self.ledger_tx_consumed = DBTransaction(
            id=f"{self.batch_id}_ledger_l_consumed",
            batch_id=self.batch_id,
            source="LEDGER",
            date="2026-03-10",
            amount=1000.00,
            currency="USD",
            description="Already Consumed Ledger Item",
            reference_id="REF-CONS-01",
            raw_data={"status": "POSTED"}
        )
        self.db.add(self.ledger_tx_consumed)

        self.result_consumed = DBReconciliationResult(
            id=f"res_cons_{self.test_suffix}",
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=self.bank_tx_consumed.id,
            ledger_tx_id=self.ledger_tx_consumed.id,
            match_type="EXACT",
            confidence_score=1.0,
            action_taken="AUTO_RECONCILE",
            reasoning="Exact match auto-reconciled.",
            human_status="PENDING",
            created_at=datetime.utcnow()
        )
        self.db.add(self.result_consumed)

        # 5. Cross-Currency Ledger Transaction (EUR, 2,475.00 in same batch)
        self.ledger_tx_eur = DBTransaction(
            id=f"{self.batch_id}_ledger_l_eur",
            batch_id=self.batch_id,
            source="LEDGER",
            date="2026-03-15",
            amount=2475.00,
            currency="EUR",
            description="Euro Invoice EUR-99",
            reference_id="EUR-99"
        )
        self.db.add(self.ledger_tx_eur)

        # 6. Ledger Transaction in Other Batch
        self.ledger_tx_other_batch = DBTransaction(
            id=f"{self.other_batch_id}_ledger_l_other",
            batch_id=self.other_batch_id,
            source="LEDGER",
            date="2026-03-15",
            amount=2475.00,
            currency="USD",
            description="Other Batch Invoice",
            reference_id="OTH-01"
        )
        self.db.add(self.ledger_tx_other_batch)

        # 7. Non-ledger transaction (e.g. source BANK)
        self.non_ledger_tx = DBTransaction(
            id=f"{self.batch_id}_bank_not_ledger",
            batch_id=self.batch_id,
            source="BANK",
            date="2026-03-15",
            amount=2475.00,
            currency="USD",
            description="Bank tx cannot be chosen as ledger",
            reference_id="NOT-LEDGER"
        )
        self.db.add(self.non_ledger_tx)

        # 8. Primary Exception Result (Escalated due to AMOUNT_VARIANCE)
        self.result_id_1 = f"res_{self.test_suffix}_1"
        self.result_1 = DBReconciliationResult(
            id=self.result_id_1,
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=self.bank_tx_1.id,
            ledger_tx_id=self.ledger_tx_1.id,
            match_type="AMOUNT_VARIANCE",
            confidence_score=0.75,
            action_taken="ESCALATE_TO_HUMAN",
            reasoning="Bank amount ($2475.00) differs from ledger invoice ($2500.00) by $25.00.",
            discrepancy_details=[{"field": "amount", "variance": 25.00, "note": "Potential wire fee"}],
            human_status="PENDING",
            created_at=datetime.utcnow()
        )
        self.db.add(self.result_1)

        # Initial DBAuditLog for result_1
        self.audit_log_1 = DBAuditLog(
            id=f"aud_{self.result_id_1}",
            reconciliation_result_id=self.result_id_1,
            transaction_id=self.bank_tx_1.id,
            agent_version="v3",
            processing_method="RULE",
            candidate_matches=[{"ledger_id": self.ledger_tx_1.id, "similarity": 0.75}],
            selected_match=self.ledger_tx_1.id,
            confidence=0.75,
            reasoning="Bank amount differs from ledger invoice by $25.00.",
            evidence=["Variance delta: $25.00"],
            exception_type="AMOUNT_VARIANCE",
            decision="ESCALATE_TO_HUMAN",
            policy_checks=[],
            timeline_events=[
                {"stage_name": "ESCALATION", "timestamp": "2026-03-15 10:00:00", "description": "Escalated for human review."}
            ],
            latency_ms=1.2,
            estimated_cost_usd=0.0001
        )
        self.db.add(self.audit_log_1)

        # 9. INR Bank and Ledger pair (INR Dynamic Currency Isolation)
        self.bank_tx_inr = DBTransaction(
            id=f"{self.batch_id}_bank_b_inr",
            batch_id=self.batch_id,
            source="BANK",
            date="2026-03-15",
            amount=50000.00,
            currency="INR",
            description="Infosys Technologies Remittance INV-INR-501",
            reference_id="INV-INR-501",
            raw_data={"value_date": "2026-03-15", "counterparty": "Infosys Technologies Ltd", "direction": "CREDIT", "transaction_type": "CR"}
        )
        self.db.add(self.bank_tx_inr)

        self.ledger_tx_inr = DBTransaction(
            id=f"{self.batch_id}_ledger_l_inr",
            batch_id=self.batch_id,
            source="LEDGER",
            date="2026-03-10",
            amount=50000.00,
            currency="INR",
            description="Infosys Consulting Fee INV-INR-501",
            reference_id="INV-INR-501",
            raw_data={"posting_date": "2026-03-10", "invoice_id": "INV-INR-501", "counterparty": "Infosys Technologies Ltd", "status": "POSTED"}
        )
        self.db.add(self.ledger_tx_inr)

        self.result_id_inr = f"res_{self.test_suffix}_inr"
        self.result_inr = DBReconciliationResult(
            id=self.result_id_inr,
            batch_id=self.batch_id,
            agent_version_id="v3",
            bank_tx_id=self.bank_tx_inr.id,
            ledger_tx_id=self.ledger_tx_inr.id,
            match_type="TIMING_DIFFERENCE",
            confidence_score=0.82,
            action_taken="ESCALATE_TO_HUMAN",
            reasoning="Clearing date differs by 5 days between bank and ledger in INR account.",
            discrepancy_details=[{"field": "date", "variance": 5}],
            human_status="PENDING",
            created_at=datetime.utcnow()
        )
        self.db.add(self.result_inr)

        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        self.db.query(DBReconciliationFeedback).filter(
            DBReconciliationFeedback.reconciliation_batch_id.in_([self.batch_id, self.other_batch_id])
        ).delete()
        self.db.query(DBAuditLog).filter(
            DBAuditLog.reconciliation_result_id.like(f"%{self.test_suffix}%")
        ).delete()
        self.db.query(DBReconciliationResult).filter(
            DBReconciliationResult.batch_id.in_([self.batch_id, self.other_batch_id])
        ).delete()
        self.db.query(DBTransaction).filter(
            DBTransaction.batch_id.in_([self.batch_id, self.other_batch_id])
        ).delete()
        self.db.query(DBReconciliationBatch).filter(
            DBReconciliationBatch.id.in_([self.batch_id, self.other_batch_id])
        ).delete()
        self.db.commit()
        self.db.close()

    # =========================================================================
    # A. Confirm match
    # =========================================================================
    def test_A_confirm_match(self):
        """A. Confirm match: Validates accountant confirming the proposed match."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "CORRECT_MATCH",
            "notes": "Verified candidate invoice against customer remittance advice."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["human_status"], "APPROVED")
        self.assertEqual(data["resolution_type"], "CORRECT_MATCH")

        self.db.expire_all()
        fb = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id_1).first()
        self.assertEqual(fb.resolution_type, "CORRECT_MATCH")
        self.assertEqual(fb.human_action, "APPROVED")

    # =========================================================================
    # B. Correct ledger reassignment
    # =========================================================================
    def test_B_correct_ledger_reassignment(self):
        """B. Correct ledger reassignment: Validates accountant selecting a different valid ledger entry."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "CORRECT_MATCH",
            "corrected_ledger_id": self.ledger_tx_2.id,
            "notes": "Re-matched to revised net invoice INV-1002."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["corrected_ledger_id"], self.ledger_tx_2.id)

        self.db.expire_all()
        res = self.db.query(DBReconciliationResult).filter_by(id=self.result_id_1).first()
        fb = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id_1).first()
        self.assertEqual(res.ledger_tx_id, self.ledger_tx_2.id)
        self.assertEqual(fb.corrected_ledger_id, self.ledger_tx_2.id)

    # =========================================================================
    # C. Wrong match
    # =========================================================================
    def test_C_wrong_match(self):
        """C. Wrong match: Validates candidate rejection without candidate re-assignment."""
        payload = {
            "action": "REJECTED",
            "resolution_type": "WRONG_MATCH",
            "notes": "Proposed candidate invoice belongs to completely different customer."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "WRONG_MATCH")

        self.db.expire_all()
        fb = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id_1).first()
        self.assertEqual(fb.resolution_type, "WRONG_MATCH")
        self.assertEqual(fb.human_action, "REJECTED")

    # =========================================================================
    # D. Bank fee
    # =========================================================================
    def test_D_bank_fee(self):
        """D. Bank fee: Validates classifying variance as bank fee."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "BANK_FEE",
            "notes": "$25 wire transfer charge confirmed."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "BANK_FEE")

    # =========================================================================
    # E. Timing difference
    # =========================================================================
    def test_E_timing_difference(self):
        """E. Timing difference: Validates classifying variance as settlement timing lag."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "TIMING_DIFFERENCE",
            "notes": "Deposit in transit cleared on the 16th."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "TIMING_DIFFERENCE")

    # =========================================================================
    # F. Partial payment
    # =========================================================================
    def test_F_partial_payment(self):
        """F. Partial payment: Validates recording partial settlement."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "PARTIAL_PAYMENT",
            "notes": "First milestone installment received; balance outstanding."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "PARTIAL_PAYMENT")

    # =========================================================================
    # G. Duplicate
    # =========================================================================
    def test_G_duplicate(self):
        """G. Duplicate: Validates flagging duplicate bank transaction."""
        payload = {
            "action": "REJECTED",
            "resolution_type": "DUPLICATE_TRANSACTION",
            "notes": "Duplicate bank feed transmission."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "DUPLICATE_TRANSACTION")

    # =========================================================================
    # H. Missing ledger
    # =========================================================================
    def test_H_missing_ledger(self):
        """H. Missing ledger: Validates unrecorded bank deposit needing GL entry."""
        payload = {
            "action": "OVERRIDDEN",
            "resolution_type": "MISSING_LEDGER_ENTRY",
            "notes": "Direct debit payment without corresponding GL entry."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "MISSING_LEDGER_ENTRY")

    # =========================================================================
    # I. Missing bank
    # =========================================================================
    def test_I_missing_bank(self):
        """I. Missing bank: Validates unpresented check / uncleared ledger item."""
        payload = {
            "action": "OVERRIDDEN",
            "resolution_type": "MISSING_BANK_ENTRY",
            "notes": "Check issued but not yet presented at bank."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "MISSING_BANK_ENTRY")

    # =========================================================================
    # J. Amount variance
    # =========================================================================
    def test_J_amount_variance(self):
        """J. Amount variance: Validates material discrepancy requiring adjustment."""
        payload = {
            "action": "OVERRIDDEN",
            "resolution_type": "AMOUNT_VARIANCE",
            "notes": "Early payment discount applied per contract clause 4.2."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "AMOUNT_VARIANCE")

    # =========================================================================
    # K. Other without note -> rejected
    # =========================================================================
    def test_K_other_without_note_rejected(self):
        """K. Other without note: Must be rejected with 400."""
        payload = {
            "action": "OVERRIDDEN",
            "resolution_type": "OTHER",
            "notes": ""  # Missing note
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("requires explanatory working-paper notes", resp.json()["detail"])

        # Also test None / whitespace
        payload_ws = {
            "action": "OVERRIDDEN",
            "resolution_type": "OTHER",
            "notes": "   "
        }
        resp_ws = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload_ws)
        self.assertEqual(resp_ws.status_code, 400)

    # =========================================================================
    # L. Other with note -> accepted
    # =========================================================================
    def test_L_other_with_note_accepted(self):
        """L. Other with note: Must be accepted with 200."""
        payload = {
            "action": "OVERRIDDEN",
            "resolution_type": "OTHER",
            "notes": "Legal settlement escrow withholding per court escrow order #CV-2026-99."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["resolution_type"], "OTHER")

        self.db.expire_all()
        fb = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id_1).first()
        self.assertEqual(fb.resolution_type, "OTHER")
        self.assertIn("escrow order", fb.human_notes)

    # =========================================================================
    # M. Invalid corrected ledger -> rejected
    # =========================================================================
    def test_M_invalid_corrected_ledger_rejected(self):
        """M. Nonexistent corrected ledger: Must be rejected with 400."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "CORRECT_MATCH",
            "corrected_ledger_id": "tx_nonexistent_fake_id_12345",
            "notes": "Attempting to assign arbitrary fake ledger id."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("does not exist", resp.json()["detail"])

        # Also test selecting non-ledger transaction
        payload_non_ledger = {
            "action": "APPROVED",
            "resolution_type": "CORRECT_MATCH",
            "corrected_ledger_id": self.non_ledger_tx.id,
            "notes": "Attempting to assign bank tx as ledger."
        }
        resp_nl = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload_non_ledger)
        self.assertEqual(resp_nl.status_code, 400)
        self.assertIn("not a LEDGER transaction", resp_nl.json()["detail"])

    # =========================================================================
    # N. Cross-batch corrected ledger -> rejected
    # =========================================================================
    def test_N_cross_batch_corrected_ledger_rejected(self):
        """N. Corrected ledger from another batch: Must be rejected with 400."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "CORRECT_MATCH",
            "corrected_ledger_id": self.ledger_tx_other_batch.id,
            "notes": "Attempting to match against transaction in another batch."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("belongs to batch", resp.json()["detail"])

    # =========================================================================
    # O. Already-consumed corrected ledger -> rejected
    # =========================================================================
    def test_O_already_consumed_corrected_ledger_rejected(self):
        """O. Corrected ledger already reconciled: Must be rejected with 400."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "CORRECT_MATCH",
            "corrected_ledger_id": self.ledger_tx_consumed.id,
            "notes": "Attempting to double-consume an already reconciled ledger entry."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("already reconciled", resp.json()["detail"])

    # =========================================================================
    # P. Cross-currency corrected ledger -> rejected
    # =========================================================================
    def test_P_cross_currency_corrected_ledger_rejected(self):
        """P. Cross-currency candidate (EUR vs USD): Must be rejected with 400."""
        payload = {
            "action": "APPROVED",
            "resolution_type": "CORRECT_MATCH",
            "corrected_ledger_id": self.ledger_tx_eur.id,  # EUR candidate against USD bank tx
            "notes": "Attempting to match USD bank transaction with EUR ledger entry."
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Currency mismatch", resp.json()["detail"])

    # =========================================================================
    # Q. Reviewer ID + notes preserved
    # =========================================================================
    def test_Q_reviewer_id_and_notes_preserved(self):
        """Q. Reviewer ID and audit notes: Must be accurately preserved in DB feedback and audit log."""
        rev_id = "senior_cpa_jennifer"
        notes_text = "Ref WP-2026-03: Wire deduction verified against bank debit advice."
        payload = {
            "action": "APPROVED",
            "resolution_type": "BANK_FEE",
            "notes": notes_text,
            "reviewer_id": rev_id
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)

        self.db.expire_all()
        fb = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id_1).first()
        self.assertEqual(fb.reviewer_id, rev_id)
        self.assertEqual(fb.human_notes, notes_text)

        audit = self.db.query(DBAuditLog).filter_by(reconciliation_result_id=self.result_id_1).first()
        last_event = audit.timeline_events[-1]
        self.assertEqual(last_event["stage_name"], "HUMAN_RESOLUTION")
        self.assertEqual(last_event["metadata"]["reviewer_id"], rev_id)
        self.assertEqual(last_event["metadata"]["notes"], notes_text)

    # =========================================================================
    # R. AI recommendation remains reconstructable
    # =========================================================================
    def test_R_ai_recommendation_remains_reconstructable(self):
        """R. AI provenance preservation: Submitting a human decision must NOT destroy original recommendation."""
        original_machine_decision = self.result_1.action_taken
        original_candidate_id = self.result_1.ledger_tx_id
        original_stop_reason = self.result_1.match_type
        original_conf = self.result_1.confidence_score

        # Accountant reassigns to ledger_tx_2
        payload = {
            "action": "APPROVED",
            "resolution_type": "CORRECT_MATCH",
            "corrected_ledger_id": self.ledger_tx_2.id,
            "notes": "Re-matching to candidate 2.",
            "reviewer_id": "auditor_prov_test"
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload)
        self.assertEqual(resp.status_code, 200)

        self.db.expire_all()
        res = self.db.query(DBReconciliationResult).filter_by(id=self.result_id_1).first()
        fb = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id_1).first()
        audit = self.db.query(DBAuditLog).filter_by(reconciliation_result_id=self.result_id_1).first()

        # 1. DBReconciliationResult retains original machine decision and confidence
        self.assertEqual(res.action_taken, original_machine_decision)
        self.assertEqual(res.confidence_score, original_conf)
        self.assertEqual(res.match_type, original_stop_reason)

        # 2. Structured feedback preserves previous_decision and relevant_exception_category
        self.assertEqual(fb.previous_decision, original_machine_decision)
        self.assertEqual(fb.relevant_exception_category, original_stop_reason)
        self.assertEqual(fb.corrected_ledger_id, self.ledger_tx_2.id)

        # 3. Audit log retains original candidate in candidate_matches and metadata
        self.assertEqual(audit.decision, original_machine_decision)
        self.assertEqual(audit.candidate_matches[0]["ledger_id"], original_candidate_id)

        hr_event = next(e for e in audit.timeline_events if e.get("stage_name") == "HUMAN_RESOLUTION")
        meta = hr_event["metadata"]
        self.assertEqual(meta["previous_machine_decision"], original_machine_decision)
        self.assertEqual(meta["original_candidate_ledger_id"], original_candidate_id)
        self.assertEqual(meta["corrected_ledger_id"], self.ledger_tx_2.id)
        self.assertEqual(meta["ai_stop_reason"], original_stop_reason)

    # =========================================================================
    # S. Legacy APPROVE/REJECT compatibility
    # =========================================================================
    def test_S_legacy_approve_reject_compatibility(self):
        """S. Backward compatibility: Legacy payload without resolution_type or corrected_ledger_id works seamlessly."""
        payload_legacy = {
            "action": "APPROVED",
            "notes": "Legacy sign-off by accountant"
        }
        resp = self.client.post(f"/api/v1/exceptions/{self.result_id_1}/human-action", json=payload_legacy)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "updated")
        self.assertEqual(data["human_status"], "APPROVED")
        # Inferred resolution_type for AMOUNT_VARIANCE exception
        self.assertEqual(data["resolution_type"], "AMOUNT_VARIANCE")


if __name__ == "__main__":
    unittest.main()
