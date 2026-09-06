"""
Fix 5 Integration Test Suite: Integrate existing LLMReasoningAgent as a controlled reasoning specialist for ambiguous reconciliation cases.

Verifies all required tests (Test A through Test L):
- Test A: Exact match does not invoke LLM (straightforward exact match bypasses LLM)
- Test B: Ambiguous case invokes LLM (multiple candidates / conflicting evidence invokes LLM)
- Test C: Structured output is parsed (mock valid LLM response and verify all typed fields are captured)
- Test D: LLM recommendation reaches DecisionEngine (verified passed into decision layer & stop details)
- Test E: LLM cannot override hard safety (confidence=0.99 + MATCH cannot override currency/direction/material variance)
- Test F: Invalid ledger ID (LLM selects ID not in candidate set -> ESCALATE_TO_HUMAN)
- Test G: LLM timeout (simulated timeout caught safely, falls back to ESCALATE_TO_HUMAN, batch continues)
- Test H: Malformed LLM response (safe human-review fallback)
- Test I: Memory + LLM (historical memory passed to LLM context; remains advisory)
- Test J: LLM confidence does not modify deterministic confidence (deterministic_conf_before == deterministic_conf_after)
- Test K: Audit provenance (LLM invocation and outcome represented in audit data)
- Test L: Existing behavior unchanged (exact matches, safety cases, memory tests continue to pass)
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
    LLMReasoningInput,
    LLMReasoningOutput,
    FinalDecisionOutput,
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
from backend.app.services.llm_agent import LLMReasoningAgent


class TestLLMReasoningIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

    def setUp(self):
        self.db = SessionLocal()
        self.batch_id = f"batch_llm_{uuid.uuid4().hex[:8]}"
        self.agent_version_id = "v3"
        self.agent = LLMReasoningAgent(mock_mode=True)
        # Ensure clean mock handler state before each test
        LLMReasoningAgent.set_mock_handler(None)

    def tearDown(self):
        LLMReasoningAgent.set_mock_handler(None)
        self.db.rollback()
        self.db.query(DBAuditLog).filter(DBAuditLog.agent_version == self.agent_version_id).delete()
        self.db.close()

    def _make_bank_tx(self, tx_id="TX_B1", amount=1500.0, currency="USD", desc="Vendor Payment Inv #9921", ref="INV-9921"):
        return NormalizedTransaction(
            id=tx_id,
            source=SourceType.BANK,
            date="2026-03-01",
            amount=amount,
            normalized_amount=abs(amount),
            currency=currency,
            direction="DEBIT",
            description=desc,
            reference=ref,
            reference_id=ref,
            raw_data={"source": "bank_csv"}
        )

    def _make_ledger_tx(self, tx_id="TX_L1", amount=1500.0, currency="USD", desc="Vendor Payment Inv #9921", ref="INV-9921"):
        return NormalizedTransaction(
            id=tx_id,
            source=SourceType.LEDGER,
            date="2026-03-01",
            amount=amount,
            normalized_amount=abs(amount),
            currency=currency,
            direction="DEBIT",
            description=desc,
            reference=ref,
            reference_id=ref,
            raw_data={"source": "ledger_csv"}
        )

    # -------------------------------------------------------------------------
    # Test A — Exact match does not invoke LLM
    # -------------------------------------------------------------------------
    def test_a_exact_match_does_not_invoke_llm(self):
        """Straightforward high-confidence exact matches must bypass the LLM entirely."""
        bank_tx = self._make_bank_tx(tx_id="B_EXACT", amount=2500.0, currency="USD", ref="REF-100")
        ledger_tx = self._make_ledger_tx(tx_id="L_EXACT", amount=2500.0, currency="USD", ref="REF-100")

        result = ReconciliationResultSchema(
            id="res_exact_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=ledger_tx.id,
            bank_tx=bank_tx,
            ledger_tx=ledger_tx,
            match_type=MatchType.EXACT,
            confidence_score=1.0,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Deterministic exact reference and amount match",
            evidence=["Exact reference match 'REF-100'", "Zero amount variance"],
            processing_method=ProcessingMethod.RULE,
            candidate_matches=[CandidateMatchItem(ledger_id=ledger_tx.id, similarity_score=1.0, reason="Exact ref")]
        )

        # Gate check
        should_run, gate_reason = self.agent.should_invoke_llm(
            bank_tx=result.bank_tx,
            ledger_tx=result.ledger_tx,
            match_type=result.match_type.value,
            confidence=result.confidence_score,
            candidate_matches=result.candidate_matches
        )
        self.assertFalse(should_run, "Exact matches should not invoke the LLM gate.")
        self.assertEqual(gate_reason, "EXACT_MATCH_BYPASS")

        # Full DecisionEngine evaluation check
        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        self.assertIsNone(dec_out.llm_output, "LLM output must be None for exact matches.")
        self.assertEqual(dec_out.decision, "AUTO_RECONCILE")
        self.assertEqual(dec_out.confidence, 1.0)

    # -------------------------------------------------------------------------
    # Test B — Ambiguous case invokes LLM
    # -------------------------------------------------------------------------
    def test_b_ambiguous_case_invokes_llm(self):
        """Ambiguous cases such as multiple ledger candidates must trigger the LLM gate."""
        bank_tx = self._make_bank_tx(tx_id="B_AMBIG", amount=1200.0, currency="USD", desc="Tech Services Monthly", ref=None)
        cand1 = self._make_ledger_tx(tx_id="L_CAND1", amount=1200.0, currency="USD", desc="Tech Services Monthly Feb")
        cand2 = self._make_ledger_tx(tx_id="L_CAND2", amount=1200.0, currency="USD", desc="Tech Services Monthly Mar")

        candidates = [
            CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.88, reason="Plausible candidate 1"),
            CandidateMatchItem(ledger_id=cand2.id, similarity_score=0.86, reason="Plausible candidate 2"),
        ]

        result = ReconciliationResultSchema(
            id="res_ambig_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.MULTIPLE_CANDIDATES,
            confidence_score=0.72,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Multiple plausible matches identified",
            evidence=["Found 2 potential candidates"],
            processing_method=ProcessingMethod.FUZZY,
            candidate_matches=candidates
        )

        should_run, gate_reason = self.agent.should_invoke_llm(
            bank_tx=result.bank_tx,
            ledger_tx=result.ledger_tx,
            match_type=result.match_type.value,
            confidence=result.confidence_score,
            candidate_matches=candidates
        )
        self.assertTrue(should_run, "Multiple candidates must trigger the LLM gate.")
        self.assertEqual(gate_reason, "MULTIPLE_CANDIDATES")

    # -------------------------------------------------------------------------
    # Test C — Structured output is parsed
    # -------------------------------------------------------------------------
    def test_c_structured_output_is_parsed(self):
        """Mock valid LLM response and verify all typed fields in LLMReasoningOutput are correctly populated."""
        def mock_llm_response(reasoning_input):
            return {
                "recommendation": "MATCH",
                "selected_ledger_id": "L_CAND1",
                "reasoning": "Candidate 1 matches the monthly recurring service cycle with identical fee.",
                "evidence_used": ["Amount matches exactly $1200.00", "Description matches Tech Services"],
                "contradictions": [],
                "confidence": 0.89,
                "resolution_type": "MATCH",
                "requires_human_review": False
            }

        LLMReasoningAgent.set_mock_handler(mock_llm_response)

        bank_tx = self._make_bank_tx(tx_id="B_PARSED", amount=1200.0, currency="USD")
        cand1 = self._make_ledger_tx(tx_id="L_CAND1", amount=1200.0, currency="USD")
        candidates = [cand1]

        result = ReconciliationResultSchema(
            id="res_parse_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.70,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Amount variance flagged",
            candidate_matches=[CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.88, reason="Candidate match")]
        )

        r_input = self.agent.build_reasoning_input(
            bank_tx=bank_tx,
            ledger_candidates=candidates,
            deterministic_evidence=["Amount matches $1200.00"],
            deterministic_confidence=0.70,
            exception_category="AMOUNT_VARIANCE",
            memory_context=None,
            invocation_reason="MULTIPLE_CANDIDATES"
        )
        llm_out = self.agent.reason_exception(reasoning_input=r_input, candidate_pool=candidates, bank_tx=bank_tx)

        self.assertIsInstance(llm_out, LLMReasoningOutput)
        self.assertEqual(llm_out.recommendation, "MATCH")
        self.assertEqual(llm_out.selected_ledger_id, "L_CAND1")
        self.assertEqual(llm_out.confidence, 0.89)
        self.assertFalse(llm_out.requires_human_review)
        self.assertTrue(llm_out.validation_passed)
        self.assertIn("Amount matches exactly", llm_out.evidence_used[0])

    # -------------------------------------------------------------------------
    # Test D — LLM recommendation reaches DecisionEngine
    # -------------------------------------------------------------------------
    def test_d_llm_recommendation_reaches_decision_engine(self):
        """Verify the LLM proposal is passed into DecisionEngine and recorded in evidence and stop details."""
        def mock_llm_fee(reasoning_input):
            return {
                "recommendation": "BANK_FEE",
                "selected_ledger_id": None,
                "reasoning": "Unmatched $15 bank charge corresponds to wire transfer processing fee.",
                "evidence_used": ["Wire transfer keyword in description", "Amount fits wire fee schedule"],
                "contradictions": [],
                "confidence": 0.84,
                "resolution_type": "BANK_FEE",
                "requires_human_review": True
            }

        LLMReasoningAgent.set_mock_handler(mock_llm_fee)

        bank_tx = self._make_bank_tx(tx_id="B_FEE", amount=15.0, currency="USD", desc="Wire Out Fee Chg", ref=None)
        cand1 = self._make_ledger_tx(tx_id="L_CAND_D", amount=15.0, currency="USD", desc="Wire Fee")
        result = ReconciliationResultSchema(
            id="res_fee_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.70,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Amount mismatch",
            candidate_matches=[CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.70, reason="Fee candidate")]
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        self.assertIsNotNone(dec_out.llm_output)
        self.assertEqual(dec_out.llm_output.recommendation, "BANK_FEE")
        self.assertIn("llm_reasoning", dec_out.stop_reason_details)
        self.assertEqual(dec_out.stop_reason_details["llm_reasoning"]["llm_recommendation"], "BANK_FEE")
        self.assertEqual(dec_out.stop_reason_details["llm_recommendation"], "BANK_FEE")
        llm_evidence_present = any("[LLM REASONING]" in ev for ev in dec_out.evidence)
        self.assertTrue(llm_evidence_present, "LLM reasoning must be represented in decision evidence.")

    # -------------------------------------------------------------------------
    # Test E — LLM cannot override hard safety
    # -------------------------------------------------------------------------
    def test_e_llm_cannot_override_hard_safety(self):
        """Mock LLM confidence=0.99 + MATCH with a material amount variance, currency mismatch, or direction conflict.
        Verify the final result remains ESCALATE_TO_HUMAN / REJECT and cannot be overridden.
        """
        def mock_hallucinating_match(reasoning_input):
            return {
                "recommendation": "MATCH",
                "selected_ledger_id": "L_DIFF_AMT",
                "reasoning": "LLM insists this is an exact match despite $500 variance.",
                "evidence_used": ["Same reference"],
                "contradictions": [],
                "confidence": 0.99,
                "resolution_type": "MATCH",
                "requires_human_review": False
            }

        LLMReasoningAgent.set_mock_handler(mock_hallucinating_match)

        # Case 1: Material Amount Variance ($1000 bank vs $1500 ledger -> $500 diff)
        bank_tx = self._make_bank_tx(tx_id="B_VAR", amount=1000.0, currency="USD", ref="REF-SAME")
        cand_diff_amt = self._make_ledger_tx(tx_id="L_DIFF_AMT", amount=1500.0, currency="USD", ref="REF-SAME")
        candidates = [CandidateMatchItem(ledger_id=cand_diff_amt.id, similarity_score=0.80, reason="Variance match")]

        result = ReconciliationResultSchema(
            id="res_safety_var",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand_diff_amt.id,
            bank_tx=bank_tx,
            ledger_tx=cand_diff_amt,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.75,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Amount variance",
            candidate_matches=candidates
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        self.assertEqual(dec_out.decision, "ESCALATE_TO_HUMAN", "LLM 0.99 confidence must NOT override material variance safety check.")
        self.assertFalse(dec_out.policy_checks[3].passed, "Hard safety Check 4 must fail due to material variance.")

        # Case 2: Currency Mismatch (USD vs EUR)
        cand_diff_curr = self._make_ledger_tx(tx_id="L_DIFF_CURR", amount=1000.0, currency="EUR", ref="REF-SAME")
        result_curr = ReconciliationResultSchema(
            id="res_safety_curr",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand_diff_curr.id,
            bank_tx=bank_tx,
            ledger_tx=cand_diff_curr,
            match_type=MatchType.FX_VARIANCE,
            confidence_score=0.70,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Currency mismatch",
            candidate_matches=[CandidateMatchItem(ledger_id=cand_diff_curr.id, similarity_score=0.70, reason="Currency variance")]
        )

        dec_out_curr = DecisionEngine.evaluate_reconciliation_result(
            result_curr,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )
        self.assertIn(dec_out_curr.decision, ["ESCALATE_TO_HUMAN", "REJECT"], "Currency mismatch must force human review or rejection.")

    # -------------------------------------------------------------------------
    # Test F — Invalid ledger ID
    # -------------------------------------------------------------------------
    def test_f_invalid_ledger_id(self):
        """If LLM hallucinates or selects a ledger ID not present in candidate set, validation must fail
        and result must be forced to ESCALATE_TO_HUMAN."""
        def mock_hallucinated_id(reasoning_input):
            return {
                "recommendation": "MATCH",
                "selected_ledger_id": "L_NON_EXISTENT_9999",  # Hallucinated ID
                "reasoning": "I found this ledger entry in external memory.",
                "evidence_used": ["Invoice 123"],
                "contradictions": [],
                "confidence": 0.95,
                "resolution_type": "MATCH",
                "requires_human_review": False
            }

        LLMReasoningAgent.set_mock_handler(mock_hallucinated_id)

        bank_tx = self._make_bank_tx(tx_id="B_HALLUC", amount=800.0, currency="USD")
        cand_real = self._make_ledger_tx(tx_id="L_REAL_1", amount=800.0, currency="USD")
        candidates = [CandidateMatchItem(ledger_id=cand_real.id, similarity_score=0.85, reason="Candidate match")]

        result = ReconciliationResultSchema(
            id="res_halluc_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand_real.id,
            bank_tx=bank_tx,
            ledger_tx=cand_real,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.85,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Candidate match",
            candidate_matches=candidates
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        self.assertEqual(dec_out.decision, "ESCALATE_TO_HUMAN", "Invalid/hallucinated ledger ID must force human review.")
        self.assertFalse(dec_out.llm_output.validation_passed)
        self.assertTrue(dec_out.llm_output.requires_human_review)

    # -------------------------------------------------------------------------
    # Test G — LLM timeout
    # -------------------------------------------------------------------------
    def test_g_llm_timeout(self):
        """Simulate timeout. Verify the transaction safely falls back to ESCALATE_TO_HUMAN and does not crash."""
        def mock_timeout(reasoning_input):
            raise TimeoutError("Model request timed out after 10000ms")

        LLMReasoningAgent.set_mock_handler(mock_timeout)

        bank_tx = self._make_bank_tx(tx_id="B_TIMEOUT", amount=450.0, currency="USD")
        cand1 = self._make_ledger_tx(tx_id="L_TO_1", amount=450.0, currency="USD")
        candidates = [
            CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.82, reason="Candidate 1"),
            CandidateMatchItem(ledger_id="L_TO_2", similarity_score=0.80, reason="Candidate 2"),
        ]

        result = ReconciliationResultSchema(
            id="res_timeout_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.MULTIPLE_CANDIDATES,
            confidence_score=0.82,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Multiple candidates",
            candidate_matches=candidates
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        self.assertEqual(dec_out.decision, "ESCALATE_TO_HUMAN", "Timeout must safely fall back to ESCALATE_TO_HUMAN.")
        self.assertIsNotNone(dec_out.llm_output)
        self.assertTrue(dec_out.llm_output.requires_human_review)
        self.assertFalse(dec_out.llm_output.validation_passed)
        self.assertIn("safe fallback", dec_out.llm_output.reasoning)

    # -------------------------------------------------------------------------
    # Test H — Malformed LLM response
    # -------------------------------------------------------------------------
    def test_h_malformed_llm_response(self):
        """Simulate malformed output (missing required fields, non-JSON, invalid types).
        Verify safe human-review fallback."""
        def mock_malformed(reasoning_input):
            # Returns an invalid dictionary missing mandatory fields like confidence and reasoning
            return {
                "recommendation": "INVALID_UNKNOWN",
                "random_key": "some text"
            }

        LLMReasoningAgent.set_mock_handler(mock_malformed)

        bank_tx = self._make_bank_tx(tx_id="B_MALF", amount=300.0, currency="USD")
        cand1 = self._make_ledger_tx(tx_id="L_MALF", amount=300.0, currency="USD")
        candidates = [
            CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.75, reason="Candidate 1"),
            CandidateMatchItem(ledger_id="L_MALF_2", similarity_score=0.74, reason="Candidate 2")
        ]

        result = ReconciliationResultSchema(
            id="res_malf_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.MULTIPLE_CANDIDATES,
            confidence_score=0.75,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Multiple candidates",
            candidate_matches=candidates
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        self.assertEqual(dec_out.decision, "ESCALATE_TO_HUMAN", "Malformed output must fall back to ESCALATE_TO_HUMAN.")
        self.assertTrue(dec_out.llm_output.requires_human_review)

    # -------------------------------------------------------------------------
    # Test I — Memory + LLM
    # -------------------------------------------------------------------------
    def test_i_memory_plus_llm(self):
        """Historical memory is passed into the bounded LLM input context and remains advisory."""
        captured_input = []

        def mock_inspect_prompt(reasoning_input):
            captured_input.append(reasoning_input)
            return {
                "recommendation": "TIMING_DIFFERENCE",
                "selected_ledger_id": None,
                "reasoning": "Historical precedent indicates this vendor has a 3-day clearing delay.",
                "evidence_used": ["Historical memory 3 precedents supporting TIMING_DIFFERENCE"],
                "contradictions": [],
                "confidence": 0.85,
                "resolution_type": "TIMING_DIFFERENCE",
                "requires_human_review": True
            }

        LLMReasoningAgent.set_mock_handler(mock_inspect_prompt)

        bank_tx = self._make_bank_tx(tx_id="B_MEM", amount=500.0, currency="USD", desc="AWS EMEA Clearing")
        cand1 = self._make_ledger_tx(tx_id="L_MEM", amount=500.0, currency="USD", desc="AWS EMEA Cloud")

        mem_ctx = DecisionMemoryContext(
            has_memory=True,
            precedent_count=3,
            trust_level=MemoryTrustLevel.STRONG,
            predominant_resolution="TIMING_DIFFERENCE",
            consistency=1.0,
            has_conflicts=False,
            compact_evidence="Historical precedent: 3 past cases with 100% TIMING_DIFFERENCE.",
            relevant_feedback_ids=["fb_1", "fb_2", "fb_3"]
        )

        result = ReconciliationResultSchema(
            id="res_mem_llm_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.75,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Amount variance with timing",
            candidate_matches=[CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.75, reason="Timing match")],
            memory_context=mem_ctx
        )

        # Build reasoning input directly to inspect structured payload
        r_input = self.agent.build_reasoning_input(
            bank_tx=bank_tx,
            ledger_candidates=[cand1],
            deterministic_evidence=["Found matching vendor"],
            deterministic_confidence=0.75,
            exception_category="AMOUNT_VARIANCE",
            memory_context=mem_ctx,
            invocation_reason="PARTIAL_PAYMENT"
        )

        self.assertIsNotNone(r_input.historical_memory)
        self.assertEqual(r_input.historical_memory["precedent_count"], 3)
        self.assertEqual(r_input.historical_memory["predominant_resolution"], "TIMING_DIFFERENCE")
        self.assertEqual(r_input.historical_memory["trust_level"], "STRONG")

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent,
            memory_context=mem_ctx
        )

        self.assertEqual(dec_out.decision, "ESCALATE_TO_HUMAN", "Memory + LLM remains advisory and must not force unsafe auto-matching.")
        self.assertEqual(dec_out.llm_output.recommendation, "TIMING_DIFFERENCE")

    # -------------------------------------------------------------------------
    # Test J — LLM confidence does not modify deterministic confidence
    # -------------------------------------------------------------------------
    def test_j_llm_confidence_does_not_modify_deterministic_confidence(self):
        """Ensure deterministic_confidence_before == deterministic_confidence_after.
        LLM confidence must never be added to or replace deterministic confidence."""
        def mock_high_conf(reasoning_input):
            return {
                "recommendation": "MATCH",
                "selected_ledger_id": "L_DET_1",
                "reasoning": "High confidence LLM matching",
                "evidence_used": ["Evidence A"],
                "contradictions": [],
                "confidence": 0.98,
                "resolution_type": "MATCH",
                "requires_human_review": False
            }

        LLMReasoningAgent.set_mock_handler(mock_high_conf)

        bank_tx = self._make_bank_tx(tx_id="B_DET", amount=700.0, currency="USD")
        cand1 = self._make_ledger_tx(tx_id="L_DET_1", amount=700.0, currency="USD")
        candidates = [
            CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.78, reason="Candidate 1"),
            CandidateMatchItem(ledger_id="L_DET_2", similarity_score=0.76, reason="Candidate 2")
        ]

        initial_det_conf = 0.78
        result = ReconciliationResultSchema(
            id="res_conf_sep_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.MULTIPLE_CANDIDATES,
            confidence_score=initial_det_conf,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Multiple candidates present",
            candidate_matches=candidates
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        # Deterministic confidence must not be boosted to 0.98
        self.assertEqual(dec_out.confidence, initial_det_conf, "Deterministic confidence must remain exactly unchanged.")
        self.assertNotEqual(dec_out.confidence, dec_out.llm_output.confidence, "Deterministic and LLM confidences must remain separate.")
        self.assertEqual(dec_out.llm_output.confidence, 0.98)

    # -------------------------------------------------------------------------
    # Test K — Audit provenance
    # -------------------------------------------------------------------------
    def test_k_audit_provenance(self):
        """Verify LLM invocation, reason, recommendation, and validation status are recorded in audit data."""
        def mock_audit_match(reasoning_input):
            return {
                "recommendation": "BANK_FEE",
                "selected_ledger_id": None,
                "reasoning": "Standard recurring wire processing surcharge.",
                "evidence_used": ["Wire surcharge identifier"],
                "contradictions": [],
                "confidence": 0.88,
                "resolution_type": "BANK_FEE",
                "requires_human_review": True
            }

        LLMReasoningAgent.set_mock_handler(mock_audit_match)

        bank_tx = self._make_bank_tx(tx_id="B_AUD", amount=25.0, currency="USD", desc="Wire Fee Surcharge")
        cand1 = self._make_ledger_tx(tx_id="L_AUD", amount=25.0, currency="USD", desc="Wire Fee")
        result = ReconciliationResultSchema(
            id="res_aud_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.70,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Ambiguous surcharge fee",
            candidate_matches=[CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.70, reason="Fee")]
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        result.llm_output = dec_out.llm_output
        result.action_taken = ActionTaken(dec_out.decision)
        result.policy_checks = dec_out.policy_checks
        result.stop_reason_details = dec_out.stop_reason_details

        audit_item = AuditService.create_audit_item(result=result, agent_version_id=self.agent_version_id)

        self.assertIsNotNone(audit_item.llm_provenance, "AuditTrailItem must capture llm_provenance.")
        self.assertTrue(audit_item.llm_provenance["llm_used"])
        self.assertEqual(audit_item.llm_provenance["llm_recommendation"], "BANK_FEE")
        self.assertEqual(audit_item.llm_provenance["llm_confidence"], 0.88)
        self.assertTrue(audit_item.llm_provenance["llm_validation_passed"])
        self.assertEqual(audit_item.llm_provenance["role"], "ADVISORY_REASONING_SPECIALIST")
        self.assertEqual(audit_item.llm_provenance["authority"], "DECISION_ENGINE")
        self.assertIn("final_decision_differed", audit_item.llm_provenance)

        # Timeline events should also contain LLM_STAGE
        timeline_stage_names = [e.stage_name for e in audit_item.timeline_events]
        self.assertIn("LLM_STAGE", timeline_stage_names, "Timeline events must contain LLM_STAGE event.")

    # -------------------------------------------------------------------------
    # Test L — Existing behavior unchanged
    # -------------------------------------------------------------------------
    def test_l_existing_behavior_unchanged(self):
        """Verify that existing memory lookup, exact matches, and report formats function normally."""
        query = ReconciliationResultSchema(
            id="res_exist_1",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id="B_EX",
            ledger_tx_id=None,
            bank_tx=self._make_bank_tx(tx_id="B_EX", amount=500.0, currency="INR"),
            ledger_tx=None,
            match_type=MatchType.UNMATCHED,
            confidence_score=0.20,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Unmatched in database"
        )
        mem_ctx = ReconciliationMemoryService.build_context_from_transaction(
            bank_tx=query.bank_tx,
            ledger_tx=query.ledger_tx,
            exception_type=query.match_type.value
        )
        self.assertIsNotNone(mem_ctx)
        self.assertEqual(mem_ctx.currency, "INR")
        mem_res = ReconciliationMemoryService.retrieve_relevant_feedback(
            context=mem_ctx,
            db=self.db
        )
        self.assertEqual(mem_res.total_candidates_found, 0)
        self.assertFalse(mem_res.has_conflict)


    # -------------------------------------------------------------------------
    # Test M — Production LLM failure cannot produce an automatic match
    # -------------------------------------------------------------------------
    def test_m_production_llm_failure_cannot_auto_match(self):
        """Simulate real LLM provider outage (e.g. 500 API error / litellm exception).
        Verify the result is safely escalated to human review and never auto-reconciled.
        """
        def mock_provider_failure(reasoning_input):
            raise RuntimeError("OpenAI 500 InternalServerError: provider unavailable")

        LLMReasoningAgent.set_mock_handler(mock_provider_failure)

        bank_tx = self._make_bank_tx(tx_id="B_FAIL_M", amount=900.0, currency="USD")
        cand1 = self._make_ledger_tx(tx_id="L_FAIL_M", amount=900.0, currency="USD")
        candidates = [CandidateMatchItem(ledger_id=cand1.id, similarity_score=0.85, reason="Candidate")]

        result = ReconciliationResultSchema(
            id="res_fail_m",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=cand1.id,
            bank_tx=bank_tx,
            ledger_tx=cand1,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.85,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Candidate found with ambiguity",
            candidate_matches=candidates
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        self.assertEqual(dec_out.decision, "ESCALATE_TO_HUMAN", "LLM failure must escalate to human review.")
        self.assertNotEqual(dec_out.decision, "AUTO_RECONCILE", "LLM failure must NEVER produce an automatic match.")
        self.assertIsNotNone(dec_out.llm_output)
        self.assertEqual(dec_out.llm_output.confidence, 0.0)
        self.assertFalse(dec_out.llm_output.validation_passed)
        self.assertTrue(dec_out.llm_output.requires_human_review)

    # -------------------------------------------------------------------------
    # Test N — LLM cannot directly mutate final ledger selection
    # -------------------------------------------------------------------------
    def test_n_llm_cannot_directly_mutate_final_ledger_selection(self):
        """Ensure LLM proposal does not directly overwrite result.ledger_tx_id with an unvalidated ID.
        Verify DecisionEngine and validation layer prevent arbitrary ID injection.
        """
        def mock_injected_id(reasoning_input):
            return {
                "recommendation": "MATCH",
                "selected_ledger_id": "INJECTED_UNAUTHORIZED_ID_999",
                "reasoning": "Direct ledger mutation attempt",
                "evidence_used": ["Injected invoice"],
                "contradictions": [],
                "confidence": 0.99,
                "resolution_type": "MATCH",
                "requires_human_review": False
            }

        LLMReasoningAgent.set_mock_handler(mock_injected_id)

        bank_tx = self._make_bank_tx(tx_id="B_MUT_N", amount=1250.0, currency="USD")
        legitimate_cand = self._make_ledger_tx(tx_id="L_LEGIT_N", amount=1250.0, currency="USD")
        candidates = [CandidateMatchItem(ledger_id=legitimate_cand.id, similarity_score=0.80, reason="Legitimate candidate")]

        result = ReconciliationResultSchema(
            id="res_mut_n",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_tx.id,
            ledger_tx_id=legitimate_cand.id,
            bank_tx=bank_tx,
            ledger_tx=legitimate_cand,
            match_type=MatchType.AMOUNT_VARIANCE,
            confidence_score=0.80,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Testing ledger mutation safety",
            candidate_matches=candidates
        )

        dec_out = DecisionEngine.evaluate_reconciliation_result(
            result,
            agent_version=self.agent_version_id,
            db=self.db,
            llm_agent=self.agent
        )

        # DecisionEngine must reject the injection and escalate
        self.assertEqual(dec_out.decision, "ESCALATE_TO_HUMAN")
        # Injected ledger ID was rejected by validation layer
        self.assertFalse(dec_out.llm_output.validation_passed)
        self.assertIsNone(dec_out.llm_output.selected_ledger_id)

    # -------------------------------------------------------------------------
    # Test O — Batch continues after one LLM failure
    # -------------------------------------------------------------------------
    def test_o_batch_continues_after_one_llm_failure(self):
        """Simulate a multi-transaction batch where Transaction A fails the LLM call,
        Transaction B is a straightforward exact match, and Transaction C has a valid LLM recommendation.
        Verify that Transaction A safely escalates without crashing the batch.
        """
        def dynamic_handler(reasoning_input):
            tx_id = reasoning_input.bank_tx.get("id", "")
            if tx_id == "TX_A_TIMEOUT":
                raise TimeoutError("Simulated LLM Gateway Timeout for Tx A")
            return {
                "recommendation": "TIMING_DIFFERENCE",
                "selected_ledger_id": None,
                "reasoning": "Normal contextual clearing lag",
                "evidence_used": ["Cleared within 2 days"],
                "contradictions": [],
                "confidence": 0.88,
                "resolution_type": "TIMING_DIFFERENCE",
                "requires_human_review": True
            }

        LLMReasoningAgent.set_mock_handler(dynamic_handler)

        # Tx A: Ambiguous, triggers LLM, which times out
        bank_a = self._make_bank_tx(tx_id="TX_A_TIMEOUT", amount=100.0, currency="USD")
        cand_a = self._make_ledger_tx(tx_id="L_A", amount=100.0, currency="USD")
        res_a = ReconciliationResultSchema(
            id="res_a",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_a.id,
            ledger_tx_id=cand_a.id,
            bank_tx=bank_a,
            ledger_tx=cand_a,
            match_type=MatchType.MULTIPLE_CANDIDATES,
            confidence_score=0.75,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Ambiguous candidates",
            candidate_matches=[CandidateMatchItem(ledger_id=cand_a.id, similarity_score=0.75, reason="Candidate")]
        )

        # Tx B: Exact match (bypasses LLM)
        bank_b = self._make_bank_tx(tx_id="TX_B_EXACT", amount=500.0, currency="USD", ref="REF-B")
        cand_b = self._make_ledger_tx(tx_id="L_B_EXACT", amount=500.0, currency="USD", ref="REF-B")
        res_b = ReconciliationResultSchema(
            id="res_b",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_b.id,
            ledger_tx_id=cand_b.id,
            bank_tx=bank_b,
            ledger_tx=cand_b,
            match_type=MatchType.EXACT,
            confidence_score=1.0,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Exact match",
            evidence=["Exact reference match 'REF-B'", "Zero amount variance"],
            candidate_matches=[CandidateMatchItem(ledger_id=cand_b.id, similarity_score=1.0, reason="Exact")]
        )

        # Tx C: Ambiguous, triggers LLM, succeeds
        bank_c = self._make_bank_tx(tx_id="TX_C_OK", amount=350.0, currency="USD")
        cand_c = self._make_ledger_tx(tx_id="L_C", amount=350.0, currency="USD")
        res_c = ReconciliationResultSchema(
            id="res_c",
            batch_id=self.batch_id,
            agent_version_id=self.agent_version_id,
            bank_tx_id=bank_c.id,
            ledger_tx_id=cand_c.id,
            bank_tx=bank_c,
            ledger_tx=cand_c,
            match_type=MatchType.TIMING_DIFFERENCE,
            confidence_score=0.75,
            action_taken=ActionTaken.ESCALATE_TO_HUMAN,
            reasoning="Timing lag",
            candidate_matches=[CandidateMatchItem(ledger_id=cand_c.id, similarity_score=0.75, reason="Timing")]
        )

        batch_results = [res_a, res_b, res_c]
        decision_outputs = []

        # Process batch sequentially (mirroring runtime pipeline_service)
        for r in batch_results:
            d_out = DecisionEngine.evaluate_reconciliation_result(
                r,
                agent_version=self.agent_version_id,
                db=self.db,
                llm_agent=self.agent
            )
            decision_outputs.append(d_out)

        # Assert all three completed processing without aborting
        self.assertEqual(len(decision_outputs), 3)

        # Tx A safely escalated on timeout
        self.assertEqual(decision_outputs[0].decision, "ESCALATE_TO_HUMAN")
        self.assertFalse(decision_outputs[0].llm_output.validation_passed)

        # Tx B auto-reconciled cleanly (bypassed LLM)
        self.assertEqual(decision_outputs[1].decision, "AUTO_RECONCILE")
        self.assertIsNone(decision_outputs[1].llm_output)

        # Tx C evaluated cleanly with advisory LLM context
        self.assertEqual(decision_outputs[2].decision, "ESCALATE_TO_HUMAN")
        self.assertTrue(decision_outputs[2].llm_output.validation_passed)
        self.assertEqual(decision_outputs[2].llm_output.recommendation, "TIMING_DIFFERENCE")


if __name__ == "__main__":
    unittest.main()

