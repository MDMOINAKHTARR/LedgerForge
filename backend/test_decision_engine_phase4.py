import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.models.pydantic_models import NormalizedTransaction, SourceType, ActionTaken, CandidateMatchItem, DecisionPolicy
from backend.app.services.decision_engine import DecisionEngine

def run_phase4_decision_tests():
    print("==========================================================")
    print("  RUNNING PHASE 4 DECISION & ESCALATION ENGINE TESTS      ")
    print("==========================================================")

    b_tx = NormalizedTransaction(
        id="bank_tx_101", source=SourceType.BANK, date="2026-03-01", amount=1500.00,
        currency="USD", description="Stripe Payout INV-9001", reference="INV-9001"
    )

    policy = DecisionPolicy(confidence_threshold=0.90)

    # Test 1: Clean High-Confidence Match -> AUTO_RECONCILE
    print("\n[Test 1] Testing Clean High-Confidence Match -> AUTO_RECONCILE...")
    dec1 = DecisionEngine.evaluate_decision(
        bank_tx=b_tx,
        selected_ledger_id="ledger_tx_201",
        confidence=0.98,
        evidence=["Exact reference match INV-9001", "Exact amount match $1500.00"],
        exception_type="EXACT_MATCH",
        candidate_matches=[CandidateMatchItem(ledger_id="ledger_tx_201", similarity_score=1.0, reason="Exact match")],
        policy=policy
    )
    assert dec1.decision == ActionTaken.AUTO_RECONCILE.value, f"Expected AUTO_RECONCILE, got {dec1.decision}"
    assert "Matched to ledger_tx_201" in dec1.reason
    assert len(dec1.policy_checks) == 4
    assert all(chk.passed for chk in dec1.policy_checks)
    print(f" -> PASSED: Clean match auto-reconciled. Reason: '{dec1.reason}'")

    # Test 2: High Confidence + DUPLICATE Candidate -> High-Risk Escalation Override
    print("\n[Test 2] Testing High Confidence + Duplicate Anomaly Override -> ESCALATE...")
    dec2 = DecisionEngine.evaluate_decision(
        bank_tx=b_tx,
        selected_ledger_id="ledger_tx_201",
        confidence=0.95,
        evidence=["Multiple bank deposits found for single invoice"],
        exception_type="DUPLICATE",
        candidate_matches=[CandidateMatchItem(ledger_id="ledger_tx_201", similarity_score=0.95, reason="Duplicate")],
        policy=policy
    )
    assert dec2.decision == ActionTaken.ESCALATE_TO_HUMAN.value, f"Expected ESCALATE_TO_HUMAN, got {dec2.decision}"
    assert "Duplicate deposit candidate" in dec2.reason or "duplicate" in dec2.reason.lower()
    override_chk = next(c for c in dec2.policy_checks if c.check_name == "high_risk_anomaly_override")
    assert override_chk.passed == False
    print(f" -> PASSED: High-risk duplicate anomaly overrode high confidence. Reason: '{dec2.reason}'")

    # Test 3: Ambiguity Risk (2 Candidates close in score) -> ESCALATE
    print("\n[Test 3] Testing Ambiguity Index Risk (2 Candidates within 0.05) -> ESCALATE...")
    dec3 = DecisionEngine.evaluate_decision(
        bank_tx=b_tx,
        selected_ledger_id="ledger_tx_201",
        confidence=0.92,
        evidence=["Matched via amount"],
        exception_type="FUZZY",
        candidate_matches=[
            CandidateMatchItem(ledger_id="ledger_tx_201", similarity_score=0.88, reason="Match 1"),
            CandidateMatchItem(ledger_id="ledger_tx_202", similarity_score=0.86, reason="Match 2")  # Score diff = 0.02
        ],
        policy=policy
    )
    assert dec3.decision == ActionTaken.ESCALATE_TO_HUMAN.value
    assert "Ambiguity Risk" in dec3.reason
    print(f" -> PASSED: Ambiguous candidates triggered human escalation. Reason: '{dec3.reason}'")

    # Test 4: Unallowed Exception Category (Partial Payment) -> ESCALATE
    print("\n[Test 4] Testing Unallowed Exception Category (PARTIAL_PAYMENT) -> ESCALATE...")
    dec4 = DecisionEngine.evaluate_decision(
        bank_tx=b_tx,
        selected_ledger_id="ledger_tx_201",
        confidence=0.94,
        evidence=["Partial settlement received"],
        exception_type="PARTIAL_PAYMENT",
        candidate_matches=[CandidateMatchItem(ledger_id="ledger_tx_201", similarity_score=0.94, reason="Partial")],
        policy=policy
    )
    assert dec4.decision == ActionTaken.ESCALATE_TO_HUMAN.value
    assert "mandatory human auditor confirmation" in dec4.reason
    print(f" -> PASSED: Partial payment category strictly escalated. Reason: '{dec4.reason}'")

    # Test 5: Low Confidence (< 0.90 Threshold) -> ESCALATE
    print("\n[Test 5] Testing Low Confidence (0.82 < 0.90) -> ESCALATE...")
    dec5 = DecisionEngine.evaluate_decision(
        bank_tx=b_tx,
        selected_ledger_id="ledger_tx_201",
        confidence=0.82,
        evidence=["Weak memo alignment"],
        exception_type="FUZZY",
        candidate_matches=[CandidateMatchItem(ledger_id="ledger_tx_201", similarity_score=0.82, reason="Weak match")],
        policy=policy
    )
    assert dec5.decision == ActionTaken.ESCALATE_TO_HUMAN.value
    assert "below configurable policy threshold" in dec5.reason
    print(f" -> PASSED: Score below threshold escalated. Reason: '{dec5.reason}'")

    # Test 6: Configurable Policy Threshold Adjustment
    print("\n[Test 6] Testing Configurable Policy Threshold Adjustment (Threshold = 0.80)...")
    lenient_policy = DecisionPolicy(confidence_threshold=0.80)
    dec6 = DecisionEngine.evaluate_decision(
        bank_tx=b_tx,
        selected_ledger_id="ledger_tx_201",
        confidence=0.82,
        evidence=["Weak memo alignment"],
        exception_type="FUZZY",
        candidate_matches=[CandidateMatchItem(ledger_id="ledger_tx_201", similarity_score=0.82, reason="Weak match")],
        policy=lenient_policy
    )
    assert dec6.decision == ActionTaken.AUTO_RECONCILE.value
    print(" -> PASSED: Adjusted threshold from 0.90 to 0.80 allowed 0.82 confidence auto-reconcile.")

    print("\n==========================================================")
    print("   CRITICAL INVARIANT VERIFIED: PREFERS ESCALATION!      ")
    print("==========================================================")

if __name__ == "__main__":
    run_phase4_decision_tests()
