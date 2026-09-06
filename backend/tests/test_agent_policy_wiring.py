"""
Regression test suite for AgentVersion policy wiring into DecisionEngine.
Verifies Tests 1-6 specified in the strict policy wiring requirements.
"""
import unittest
from backend.app.models.pydantic_models import (
    NormalizedTransaction, SourceType, ActionTaken, CandidateMatchItem,
    DecisionPolicy, AgentVersionSchema, MatchType, ReconciliationResultSchema,
    ReconciliationStatus
)
from backend.app.services.decision_engine import DecisionEngine
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.report_service import CanonicalReportService


class TestAgentPolicyWiring(unittest.TestCase):

    def setUp(self):
        self.bank_tx = NormalizedTransaction(
            id="B_WIRE_01",
            source=SourceType.BANK,
            date="2026-09-01",
            amount=5000.00,
            normalized_amount=5000.00,
            currency="USD",
            direction="CREDIT",
            description="WIRE CREDIT ACME CORP INV-5001",
            reference="INV-5001"
        )
        self.ledger_tx = NormalizedTransaction(
            id="L_INV_01",
            source=SourceType.LEDGER,
            date="2026-09-01",
            amount=5000.00,
            normalized_amount=5000.00,
            currency="USD",
            direction="CREDIT",
            description="Acme Corp Invoice 5001",
            reference="INV-5001"
        )
        self.clean_evidence = [
            "Exact reference match: INV-5001",
            "Exact amount match: $5,000.00 USD",
            "Matching economic direction: CREDIT"
        ]

    def test_01_high_confidence_match_satisfying_agent_policy_is_auto_reconcile(self):
        """Test 1: High-confidence exact match that satisfies configured agent policy is AUTO_RECONCILE."""
        # Custom agent with threshold 0.80
        agent_80 = AgentVersionSchema(
            id="test_agent_v80",
            version_name="Agent V80 (Permissive 0.80)",
            created_at="2026-09-06 12:00:00",
            system_prompt="Test agent with 0.80 threshold",
            confidence_threshold=0.80,
            matching_rules={"date_window_days": 7}
        )
        AgentRegistry.register_version(agent_80)

        # Confidence is 0.82, which satisfies the 0.80 threshold
        decision = DecisionEngine.evaluate_decision(
            bank_tx=self.bank_tx,
            ledger_tx=self.ledger_tx,
            selected_ledger_id=self.ledger_tx.id,
            confidence=0.82,
            evidence=self.clean_evidence,
            exception_type="EXACT_MATCH",
            candidate_matches=[CandidateMatchItem(ledger_id=self.ledger_tx.id, similarity_score=0.82, reason="Exact ref")],
            agent_version_id="test_agent_v80"
        )

        self.assertEqual(decision.decision, ActionTaken.AUTO_RECONCILE.value)
        self.assertTrue(decision.auto_match_eligible)
        conf_chk = next(c for c in decision.policy_checks if c.check_name == "confidence_threshold_check")
        self.assertTrue(conf_chk.passed)

    def test_02_same_match_below_configured_agent_threshold_is_human_review(self):
        """Test 2: Same match below configured confidence threshold is escalated to HUMAN_REVIEW."""
        # Agent with threshold 0.90 (e.g. V1)
        agent_90 = AgentVersionSchema(
            id="test_agent_v90",
            version_name="Agent V90 (Strict 0.90)",
            created_at="2026-09-06 12:00:00",
            system_prompt="Test agent with 0.90 threshold",
            confidence_threshold=0.90,
            matching_rules={"date_window_days": 7}
        )
        AgentRegistry.register_version(agent_90)

        # Same confidence (0.82), but evaluated against 0.90 policy
        decision = DecisionEngine.evaluate_decision(
            bank_tx=self.bank_tx,
            ledger_tx=self.ledger_tx,
            selected_ledger_id=self.ledger_tx.id,
            confidence=0.82,
            evidence=self.clean_evidence,
            exception_type="EXACT_MATCH",
            candidate_matches=[CandidateMatchItem(ledger_id=self.ledger_tx.id, similarity_score=0.82, reason="Exact ref")],
            agent_version_id="test_agent_v90"
        )

        self.assertEqual(decision.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertFalse(decision.auto_match_eligible)
        conf_chk = next(c for c in decision.policy_checks if c.check_name == "confidence_threshold_check")
        self.assertFalse(conf_chk.passed)

    def test_03_high_risk_anomaly_does_not_auto_reconcile_even_if_confidence_1_0(self):
        """Test 3: Transaction with a high-risk anomaly does NOT auto-reconcile even with 1.0 confidence."""
        # 3A: Material amount variance ($5000 vs $5050)
        ledger_varied = self.ledger_tx.model_copy(update={"amount": 5050.00, "normalized_amount": 5050.00})
        agent_v3 = AgentRegistry.get_version_by_id("v3")

        decision_var = DecisionEngine.evaluate_decision(
            bank_tx=self.bank_tx,
            ledger_tx=ledger_varied,
            selected_ledger_id=ledger_varied.id,
            confidence=1.0,
            evidence=["High confidence matching candidate"],
            exception_type="AMOUNT_VARIANCE",
            candidate_matches=[CandidateMatchItem(ledger_id=ledger_varied.id, similarity_score=1.0, reason="Match")],
            policy=agent_v3.get_decision_policy(),
            agent_version_id="v3"
        )
        self.assertEqual(decision_var.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertFalse(decision_var.auto_match_eligible)
        override_chk = next(c for c in decision_var.policy_checks if c.check_name == "high_risk_anomaly_override")
        self.assertFalse(override_chk.passed)

        # 3B: Duplicate candidate consumption
        decision_dup = DecisionEngine.evaluate_decision(
            bank_tx=self.bank_tx,
            ledger_tx=self.ledger_tx,
            selected_ledger_id=self.ledger_tx.id,
            confidence=1.0,
            evidence=["Duplicate bank deposit"],
            exception_type="DUPLICATE",
            candidate_matches=[CandidateMatchItem(ledger_id=self.ledger_tx.id, similarity_score=1.0, reason="Duplicate")],
            policy=agent_v3.get_decision_policy(),
            agent_version_id="v3"
        )
        self.assertEqual(decision_dup.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertFalse(decision_dup.auto_match_eligible)

    def test_04_currency_mismatch_remains_human_review_regardless_of_high_confidence(self):
        """Test 4: Currency mismatch remains HUMAN_REVIEW/blocked regardless of high confidence."""
        ledger_eur = self.ledger_tx.model_copy(update={"currency": "EUR"})
        agent_v3 = AgentRegistry.get_version_by_id("v3")

        decision_curr = DecisionEngine.evaluate_decision(
            bank_tx=self.bank_tx,  # USD
            ledger_tx=ledger_eur,  # EUR
            selected_ledger_id=ledger_eur.id,
            confidence=1.0,
            evidence=["Reference matched", "Amount matched numerically"],
            exception_type="EXACT_MATCH",
            candidate_matches=[CandidateMatchItem(ledger_id=ledger_eur.id, similarity_score=1.0, reason="Match")],
            policy=agent_v3.get_decision_policy(),
            agent_version_id="v3"
        )

        self.assertEqual(decision_curr.decision, ActionTaken.ESCALATE_TO_HUMAN.value)
        self.assertFalse(decision_curr.auto_match_eligible)
        self.assertIn("FX_VARIANCE", decision_curr.exception_types)
        override_chk = next(c for c in decision_curr.policy_checks if c.check_name == "high_risk_anomaly_override")
        self.assertFalse(override_chk.passed)

    def test_05_existing_default_agent_behavior_remains_unchanged(self):
        """Test 5: Existing default-agent behavior remains unchanged."""
        agent_v3 = AgentRegistry.get_version_by_id("v3")
        self.assertEqual(agent_v3.confidence_threshold, 0.85)

        # Policy extracted from v3 matches its confidence_threshold
        v3_policy = agent_v3.get_decision_policy()
        self.assertEqual(v3_policy.confidence_threshold, 0.85)

        # Evaluating without policy explicitly provided uses default agent v3 policy (0.85)
        dec_v3 = DecisionEngine.evaluate_decision(
            bank_tx=self.bank_tx,
            ledger_tx=self.ledger_tx,
            selected_ledger_id=self.ledger_tx.id,
            confidence=0.86,
            evidence=self.clean_evidence,
            exception_type="EXACT_MATCH",
            agent_version_id="v3"
        )
        self.assertEqual(dec_v3.decision, ActionTaken.AUTO_RECONCILE.value)

        # When agent version has no custom policy or is omitted, falls back safely to default DecisionPolicy (0.90)
        dec_fallback = DecisionEngine.evaluate_decision(
            bank_tx=self.bank_tx,
            ledger_tx=self.ledger_tx,
            selected_ledger_id=self.ledger_tx.id,
            confidence=0.86,
            evidence=self.clean_evidence,
            exception_type="EXACT_MATCH",
            policy=None,
            agent_version_id="unknown_agent_fallback"
        )
        # 0.86 is below default 0.90 -> escalates
        self.assertEqual(dec_fallback.decision, ActionTaken.ESCALATE_TO_HUMAN.value)

    def test_06_report_generation_and_currency_behavior_remain_unchanged(self):
        """Test 6: Existing report generation and currency behavior remain unchanged."""
        res = ReconciliationResultSchema(
            id="res_test_01",
            batch_id="batch_test",
            agent_version_id="v3",
            bank_tx_id=self.bank_tx.id,
            bank_tx=self.bank_tx,
            ledger_tx_id=self.ledger_tx.id,
            ledger_tx=self.ledger_tx,
            match_type=MatchType.EXACT,
            confidence_score=1.0,
            action_taken=ActionTaken.AUTO_RECONCILE,
            reasoning="Matched cleanly",
            reconciliation_status=ReconciliationStatus.AUTO_MATCHED
        ).sync_canonical_fields()

        summary = CanonicalReportService.generate_canonical_summary(
            batch_id="batch_test",
            bank_txs=[self.bank_tx],
            ledger_txs=[self.ledger_tx],
            results=[res],
            agent_version_id="v3"
        )

        self.assertEqual(summary["counts"]["total_bank_transactions"], 1)
        self.assertEqual(summary["counts"]["total_ledger_entries"], 1)
        self.assertEqual(summary["counts"]["auto_matched"], 1)
        self.assertEqual(summary["counts"]["human_review"], 0)
        self.assertEqual(summary["currency_summaries"]["USD"]["variance"], 0.0)

        csv_content = CanonicalReportService.generate_csv_report(summary)
        self.assertIn("AUTONOMOUS RECONCILIATION AUDIT REPORT", csv_content)
        self.assertIn("batch_test", csv_content)
        self.assertIn("B_WIRE_01", csv_content)


if __name__ == "__main__":
    unittest.main()
