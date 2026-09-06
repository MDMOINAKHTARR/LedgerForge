"""
Regression test suite for the Structured Feedback Layer.
Verifies Tests 1-8 specified in the requirements:
1. Human resolution still updates ReconciliationResult correctly.
2. Human resolution creates exactly one structured feedback record.
3. Corrected ledger ID is stored correctly.
4. Resolution type is stored correctly (explicit and inferred).
5. Notes are preserved.
6. Existing audit logging still works.
7. Repeating the same request does not unexpectedly create duplicate feedback (idempotency).
8. Feedback schema serialization and retrieval endpoints.
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
    MatchType,
)
from backend.app.models.db import (
    DBAgentVersion,
    DBReconciliationBatch,
    DBReconciliationResult,
    DBTransaction,
    DBReconciliationFeedback,
    DBAuditLog,
)


class TestStructuredFeedbackLayer(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def setUp(self):
        self.db = SessionLocal()
        self.test_suffix = uuid.uuid4().hex[:8]
        self.batch_id = f"batch_{self.test_suffix}"
        
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

        # Create sample batch
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

        # Create sample bank transaction
        self.bank_tx_id = f"bank_tx_{self.test_suffix}"
        self.bank_tx = DBTransaction(
            id=self.bank_tx_id,
            batch_id=self.batch_id,
            source="BANK",
            date="2026-09-01",
            amount=-1250.00,
            currency="USD",
            description="WIRE OUT TO SUPPLIER",
            reference_id="REF-1001"
        )
        self.db.add(self.bank_tx)

        # Create sample initial ledger transaction
        self.ledger_tx_id = f"ledger_tx_{self.test_suffix}"
        self.ledger_tx = DBTransaction(
            id=self.ledger_tx_id,
            batch_id=self.batch_id,
            source="LEDGER",
            date="2026-09-02",
            amount=-1250.00,
            currency="USD",
            description="SUPPLIER INVOICE PAYMENT",
            reference_id="INV-1001"
        )
        self.db.add(self.ledger_tx)

        # Create sample reconciliation result in ESCALATE_TO_HUMAN / PENDING status
        self.result_id = f"res_{self.test_suffix}"
        self.rec_result = DBReconciliationResult(
            id=self.result_id,
            batch_id=self.batch_id,
            bank_tx_id=self.bank_tx_id,
            ledger_tx_id=self.ledger_tx_id,
            agent_version_id="v1",
            match_type=MatchType.TIMING_DIFFERENCE.value,
            confidence_score=0.75,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN.value,
            reasoning="Date difference of 1 day exceeds strict same-day policy.",
            discrepancy_details=["Date offset: 1 day", "Amount match: $1,250.00"],
            human_status="PENDING",
            human_notes=None
        )
        self.db.add(self.rec_result)

        # Create sample existing audit log for this result
        self.audit_log = DBAuditLog(
            id=f"audit_{self.test_suffix}",
            reconciliation_result_id=self.result_id,
            transaction_id=self.bank_tx_id,
            agent_version="v1",
            processing_method="RULE",
            candidate_matches=[],
            selected_match=self.ledger_tx_id,
            confidence=0.75,
            reasoning="Date difference of 1 day exceeds strict same-day policy.",
            evidence=["Date offset: 1 day"],
            exception_type=MatchType.TIMING_DIFFERENCE.value,
            decision=ActionTaken.ESCALATE_TO_HUMAN.value,
            policy_checks=[{"check": "MAX_DATE_WINDOW", "passed": False}],
            timeline_events=[{
                "stage_name": "INITIAL_MATCH",
                "timestamp": "2026-09-01 10:00:00",
                "description": "Initial matching evaluation",
                "metadata": {}
            }],
            latency_ms=1.2,
            estimated_cost_usd=0.0001
        )
        self.db.add(self.audit_log)
        self.db.commit()

    def tearDown(self):
        self.db.rollback()
        # Clean up database records created for the test
        self.db.query(DBReconciliationFeedback).filter(
            DBReconciliationFeedback.reconciliation_batch_id == self.batch_id
        ).delete()
        self.db.query(DBAuditLog).filter(
            DBAuditLog.reconciliation_result_id == self.result_id
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

    def test_01_human_resolution_updates_reconciliation_result_correctly(self):
        """Test 1: Human resolution still updates ReconciliationResult correctly."""
        payload = {
            "action": "APPROVED",
            "notes": "Verified against supplier bill. Approved."
        }
        response = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "updated")
        self.assertEqual(data["result_id"], self.result_id)
        self.assertEqual(data["human_status"], "APPROVED")
        self.assertEqual(data["notes"], "Verified against supplier bill. Approved.")

        # Verify DB directly
        self.db.expire_all()
        updated_res = self.db.query(DBReconciliationResult).filter_by(id=self.result_id).first()
        self.assertEqual(updated_res.human_status, "APPROVED")
        self.assertEqual(updated_res.human_notes, "Verified against supplier bill. Approved.")

    def test_02_human_resolution_creates_exactly_one_structured_feedback_record(self):
        """Test 2: Human resolution creates exactly one structured feedback record."""
        payload = {
            "action": "APPROVED",
            "notes": "Single feedback record validation",
            "reviewer_id": "usr_cpa_101"
        }
        response = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload)
        self.assertEqual(response.status_code, 200)

        # Verify exactly one record in DB
        self.db.expire_all()
        feedbacks = self.db.query(DBReconciliationFeedback).filter_by(
            reconciliation_result_id=self.result_id
        ).all()
        self.assertEqual(len(feedbacks), 1)

        fb = feedbacks[0]
        self.assertEqual(fb.id, f"fb_{self.result_id}")
        self.assertEqual(fb.reconciliation_batch_id, self.batch_id)
        self.assertEqual(fb.bank_transaction_id, self.bank_tx_id)
        self.assertEqual(fb.previous_decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertEqual(fb.human_action, "APPROVED")
        self.assertEqual(fb.reviewer_id, "usr_cpa_101")
        self.assertEqual(fb.currency, "USD")
        self.assertEqual(fb.amount, 1250.00)

    def test_03_corrected_ledger_id_is_stored_correctly(self):
        """Test 3: Corrected ledger ID is stored correctly in result and feedback."""
        corrected_id = f"tx_corrected_{self.test_suffix}"
        # Insert the corrected transaction into the DB to satisfy FK constraints if any
        corrected_tx = DBTransaction(
            id=corrected_id,
            batch_id=self.batch_id,
            source="LEDGER",
            date="2026-09-02",
            amount=-1250.00,
            currency="USD",
            description="CORRECTED SUPPLIER PAYMENT"
        )
        self.db.add(corrected_tx)
        self.db.commit()

        payload = {
            "action": "APPROVED",
            "notes": "Matched to corrected ledger entry",
            "corrected_ledger_id": corrected_id,
            "resolution_type": "CORRECT_MATCH"
        }
        response = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["corrected_ledger_id"], corrected_id)

        # Verify DB records
        self.db.expire_all()
        res = self.db.query(DBReconciliationResult).filter_by(id=self.result_id).first()
        fb = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id).first()
        self.assertEqual(res.ledger_tx_id, corrected_id)
        self.assertEqual(fb.corrected_ledger_id, corrected_id)

    def test_04_resolution_type_is_stored_correctly(self):
        """Test 4: Resolution type is stored correctly both when explicit and when inferred."""
        # Explicit resolution type: BANK_FEE
        payload_explicit = {
            "action": "APPROVED",
            "notes": "Small bank fee variance accounted for",
            "resolution_type": "BANK_FEE"
        }
        resp1 = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload_explicit)
        self.assertEqual(resp1.status_code, 200)
        self.assertEqual(resp1.json()["resolution_type"], "BANK_FEE")

        self.db.expire_all()
        fb1 = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id).first()
        self.assertEqual(fb1.resolution_type, "BANK_FEE")

        # Inferred resolution type: when not provided, match_type TIMING_DIFFERENCE infers TIMING_DIFFERENCE
        result_id_2 = f"res_infer_{self.test_suffix}"
        res2 = DBReconciliationResult(
            id=result_id_2,
            batch_id=self.batch_id,
            bank_tx_id=self.bank_tx_id,
            ledger_tx_id=self.ledger_tx_id,
            agent_version_id="v1",
            match_type="TIMING_DIFFERENCE",
            confidence_score=0.70,
            action_taken="ESCALATE_TO_HUMAN",
            reasoning="Timing discrepancy observed across settlement windows.",
            human_status="PENDING"
        )
        self.db.add(res2)
        self.db.commit()

        payload_inferred = {
            "action": "APPROVED",
            "notes": "Inferred timing resolution"
        }
        resp2 = self.client.post(f"/api/v1/exceptions/{result_id_2}/human-action", json=payload_inferred)
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.json()["resolution_type"], "TIMING_DIFFERENCE")

        self.db.expire_all()
        fb2 = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=result_id_2).first()
        self.assertEqual(fb2.resolution_type, "TIMING_DIFFERENCE")

    def test_05_notes_are_preserved(self):
        """Test 5: Notes are preserved across result and feedback records."""
        detailed_notes = "Accountant verified vendor clearing note with Bank confirmation #BK-88231."
        payload = {
            "action": "APPROVED",
            "notes": detailed_notes,
            "resolution_type": "TIMING_DIFFERENCE"
        }
        response = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload)
        self.assertEqual(response.status_code, 200)

        self.db.expire_all()
        res = self.db.query(DBReconciliationResult).filter_by(id=self.result_id).first()
        fb = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id).first()
        self.assertEqual(res.human_notes, detailed_notes)
        self.assertEqual(fb.human_notes, detailed_notes)

    def test_06_existing_audit_logging_still_works(self):
        """Test 6: Existing audit logging still works and logs human resolution events."""
        payload = {
            "action": "REJECTED",
            "notes": "Transaction is a fraudulent charge. Escalated to ops.",
            "resolution_type": "WRONG_MATCH"
        }
        response = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload)
        self.assertEqual(response.status_code, 200)

        # Verify audit log updated with HUMAN_RESOLUTION timeline event
        self.db.expire_all()
        audit_entry = self.db.query(DBAuditLog).filter_by(reconciliation_result_id=self.result_id).first()
        self.assertIsNotNone(audit_entry)
        
        stages = [e.get("stage_name") for e in (audit_entry.timeline_events or [])]
        self.assertIn("HUMAN_RESOLUTION", stages)

        # Verify via audit endpoint
        audit_resp = self.client.get(f"/api/v1/audit/{audit_entry.id}")
        self.assertEqual(audit_resp.status_code, 200)
        audit_data = audit_resp.json()
        timeline_stages = [e.get("stage_name") for e in audit_data.get("timeline_events", [])]
        self.assertIn("HUMAN_RESOLUTION", timeline_stages)

    def test_07_repeating_same_request_does_not_create_duplicate_feedback(self):
        """Test 7: Repeating the same request updates idempotently without duplicate feedback."""
        payload_1 = {
            "action": "APPROVED",
            "notes": "Initial approval",
            "resolution_type": "CORRECT_MATCH"
        }
        resp1 = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload_1)
        self.assertEqual(resp1.status_code, 200)
        feedback_id_1 = resp1.json()["feedback_id"]

        # Submit second time with updated note
        payload_2 = {
            "action": "APPROVED",
            "notes": "Amended approval note: verified invoice copy.",
            "resolution_type": "CORRECT_MATCH"
        }
        resp2 = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload_2)
        self.assertEqual(resp2.status_code, 200)
        feedback_id_2 = resp2.json()["feedback_id"]

        # Must maintain the same feedback ID
        self.assertEqual(feedback_id_1, feedback_id_2)

        # Count in DB must still be strictly 1
        self.db.expire_all()
        feedbacks = self.db.query(DBReconciliationFeedback).filter_by(
            reconciliation_result_id=self.result_id
        ).all()
        self.assertEqual(len(feedbacks), 1)
        self.assertEqual(feedbacks[0].human_notes, "Amended approval note: verified invoice copy.")

    def test_08_feedback_retrieval_endpoints(self):
        """Test 8: Feedback can be fetched by result ID and filtered in list."""
        payload = {
            "action": "APPROVED",
            "notes": "Feedback API test note",
            "resolution_type": "PARTIAL_PAYMENT",
            "reviewer_id": "auditor_07"
        }
        self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload)

        # 1. Fetch by result ID
        resp_item = self.client.get(f"/api/v1/exceptions/{self.result_id}/feedback")
        self.assertEqual(resp_item.status_code, 200)
        item = resp_item.json()
        self.assertEqual(item["reconciliation_result_id"], self.result_id)
        self.assertEqual(item["resolution_type"], "PARTIAL_PAYMENT")
        self.assertEqual(item["reviewer_id"], "auditor_07")
        self.assertEqual(item["currency"], "USD")
        self.assertEqual(item["amount"], 1250.00)

        # 2. List with filters
        resp_list = self.client.get(f"/api/v1/exceptions/feedback/list?batch_id={self.batch_id}")
        self.assertEqual(resp_list.status_code, 200)
        items = resp_list.json()
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], item["id"])

    def test_09_previous_decision_captures_machine_decision_and_persists_across_updates(self):
        """Test 9: previous_decision captures machine decision before modification and never gets overwritten by human action."""
        # Initial human resolution: APPROVED
        payload_1 = {
            "action": "APPROVED",
            "notes": "Machine escalated this initially, now approved",
            "resolution_type": "CORRECT_MATCH"
        }
        resp1 = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload_1)
        self.assertEqual(resp1.status_code, 200)

        self.db.expire_all()
        fb1 = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id).first()
        self.assertEqual(fb1.previous_decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertNotEqual(fb1.previous_decision, "APPROVED")

        # Second human resolution amending to REJECTED
        payload_2 = {
            "action": "REJECTED",
            "notes": "Reversed to rejected upon further inspection",
            "resolution_type": "WRONG_MATCH"
        }
        resp2 = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload_2)
        self.assertEqual(resp2.status_code, 200)

        self.db.expire_all()
        fb2 = self.db.query(DBReconciliationFeedback).filter_by(reconciliation_result_id=self.result_id).first()
        # Must STILL retain original machine decision ESCALATE_TO_HUMAN
        self.assertEqual(fb2.previous_decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertNotEqual(fb2.previous_decision, "REJECTED")
        self.assertEqual(fb2.human_action, "REJECTED")

    def test_10_conservative_resolution_inference_matrix(self):
        """Test 10: Fallback inference logic is conservative, deterministic, and falls back to OTHER on weak evidence."""
        from backend.app.api.endpoints.exceptions import infer_resolution_type

        # 1. Timing
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "TIMING_DIFFERENCE", None), ResolutionType.TIMING_DIFFERENCE)
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "DATE_MISMATCH", None), ResolutionType.TIMING_DIFFERENCE)

        # 2. Partial payment
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "PARTIAL_PAYMENT", None), ResolutionType.PARTIAL_PAYMENT)

        # 3. Duplicate
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "DUPLICATE_TRANSACTION", None), ResolutionType.DUPLICATE_TRANSACTION)

        # 4. Amount variance
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "AMOUNT_DISCREPANCY", None), ResolutionType.AMOUNT_VARIANCE)
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "AMOUNT_VARIANCE", None), ResolutionType.AMOUNT_VARIANCE)

        # 5. Currency issue
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "FX_VARIANCE", None), ResolutionType.CURRENCY_ISSUE)
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "CURRENCY_MISMATCH", None), ResolutionType.CURRENCY_ISSUE)

        # 6. Bank fee
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "BANK_FEE", None), ResolutionType.BANK_FEE)

        # 7. Missing ledger / bank
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "MISSING_IN_LEDGER", None), ResolutionType.MISSING_LEDGER_ENTRY)
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "MISSING_IN_BANK", None), ResolutionType.MISSING_BANK_ENTRY)

        # 8. Re-matching with approved corrected ledger
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "UNMATCHED", "tx_ledger_101"), ResolutionType.CORRECT_MATCH)

        # 9. Explicit rejection of proposed match candidates
        self.assertEqual(infer_resolution_type(HumanStatus.REJECTED, "FUZZY", None), ResolutionType.WRONG_MATCH)

        # 10. Weak or generic evidence must conservatively fall back to OTHER
        self.assertEqual(infer_resolution_type(HumanStatus.APPROVED, "UNMATCHED", None), ResolutionType.OTHER)
        self.assertEqual(infer_resolution_type(HumanStatus.OVERRIDDEN, "GENERIC_NOTE", None), ResolutionType.OTHER)
        self.assertEqual(infer_resolution_type(HumanStatus.PENDING, None, None), ResolutionType.OTHER)

    def test_11_audit_history_preserves_multiple_human_actions_across_conflicting_updates(self):
        """Test 11: Audit trail preserves full sequential history of human actions without destruction upon update."""
        # Action 1: APPROVED, notes A
        payload_1 = {
            "action": "APPROVED",
            "notes": "First review: approved by reviewer A",
            "resolution_type": "CORRECT_MATCH",
            "reviewer_id": "usr_reviewer_A"
        }
        resp1 = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload_1)
        self.assertEqual(resp1.status_code, 200)

        # Action 2: REJECTED, notes B (conflicting update)
        payload_2 = {
            "action": "REJECTED",
            "notes": "Second review: supervisor rejected due to fraud alert",
            "resolution_type": "WRONG_MATCH",
            "reviewer_id": "usr_supervisor_B"
        }
        resp2 = self.client.post(f"/api/v1/exceptions/{self.result_id}/human-action", json=payload_2)
        self.assertEqual(resp2.status_code, 200)

        # Database state verification: exactly one feedback record updated in place
        self.db.expire_all()
        feedbacks = self.db.query(DBReconciliationFeedback).filter_by(
            reconciliation_result_id=self.result_id
        ).all()
        self.assertEqual(len(feedbacks), 1)
        self.assertEqual(feedbacks[0].human_action, "REJECTED")
        self.assertEqual(feedbacks[0].resolution_type, "WRONG_MATCH")
        self.assertEqual(feedbacks[0].reviewer_id, "usr_supervisor_B")

        # Audit trail verification: BOTH events preserved in sequence
        audit = self.db.query(DBAuditLog).filter_by(reconciliation_result_id=self.result_id).first()
        hr_events = [e for e in (audit.timeline_events or []) if e.get("stage_name") == "HUMAN_RESOLUTION"]
        self.assertEqual(len(hr_events), 2)

        # Event 1 details
        event_1_meta = hr_events[0].get("metadata", {})
        self.assertEqual(event_1_meta.get("action"), "APPROVED")
        self.assertEqual(event_1_meta.get("reviewer_id"), "usr_reviewer_A")
        self.assertEqual(event_1_meta.get("resolution_type"), "CORRECT_MATCH")

        # Event 2 details
        event_2_meta = hr_events[1].get("metadata", {})
        self.assertEqual(event_2_meta.get("action"), "REJECTED")
        self.assertEqual(event_2_meta.get("reviewer_id"), "usr_supervisor_B")
        self.assertEqual(event_2_meta.get("resolution_type"), "WRONG_MATCH")


if __name__ == "__main__":
    unittest.main()

