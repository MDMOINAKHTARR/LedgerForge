import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.models.pydantic_models import SourceType, MatchType, ActionTaken
from backend.app.services.ingestion import DataIngestionService
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.matching_engine import MultiTierMatchingEngine
from backend.app.services.eval_framework import BenchmarkEvaluator
from backend.app.services.meta_agent_loop import AutonomousMetaAgentLoop
from backend.app.data.synthetic_data import get_benchmark_dataset

def run_tests():
    print("==================================================")
    print("  RUNNING LEDGERMIND BACKEND VERIFICATION TESTS  ")
    print("==================================================")

    # Test 1: Ingestion
    print("\n[Test 1] CSV Ingestion & Field Normalization...")
    bank_csv = b"Date,Amount,Currency,Description,Reference_ID\n2026-03-01,1500.00,USD,Stripe Payout INV-9001,INV-9001"
    bank_txs = DataIngestionService.parse_csv_content(bank_csv, SourceType.BANK, "batch_test")
    assert len(bank_txs) == 1, "Failed ingestion count"
    assert bank_txs[0].amount == 1500.00, "Failed amount parsing"
    assert bank_txs[0].reference_id == "INV-9001", "Failed reference parsing"
    print(" -> PASSED: CSV Parsed and Normalized successfully.")

    # Test 2: Agent Registry
    print("\n[Test 2] Agent Registry & Version Management...")
    v1 = AgentRegistry.get_version_by_id("v1")
    v3 = AgentRegistry.get_version_by_id("v3")
    assert v1.id == "v1", "Failed V1 version fetch"
    assert v3.is_active == True, "Failed V3 active status"
    print(f" -> PASSED: Agent V1 ({v1.confidence_threshold*100}% threshold) and Agent V3 ({v3.confidence_threshold*100}% threshold) loaded.")

    # Test 3: Benchmark Evaluator
    print("\n[Test 3] Benchmark Evaluation on Synthetic Edge Cases...")
    eval_v1 = BenchmarkEvaluator.evaluate_agent(v1)
    eval_v3 = BenchmarkEvaluator.evaluate_agent(v3)
    print(f" -> Agent V1 Benchmark: Accuracy={eval_v1.accuracy*100:.1f}%, STP Rate={eval_v1.stp_rate*100:.1f}%, Safety={eval_v1.reliability_score*100:.1f}%")
    print(f" -> Agent V3 Benchmark: Accuracy={eval_v3.accuracy*100:.1f}%, STP Rate={eval_v3.stp_rate*100:.1f}%, Safety={eval_v3.reliability_score*100:.1f}%")
    assert eval_v3.accuracy >= eval_v1.accuracy, "Agent V3 should perform better than V1"
    print(" -> PASSED: Empirical benchmark confirms Agent V3 outperforming Agent V1.")

    # Test 4: Autonomous Meta-Agent Engineering Loop
    print("\n[Test 4] Autonomous Agent Engineering Loop Execution...")
    result = AutonomousMetaAgentLoop.run_optimization_cycle("v1")
    print(f" -> Base Version: {result['base_version']['version_name']} (Accuracy: {result['base_eval']['accuracy']*100:.1f}%)")
    print(f" -> New Version: {result['new_version']['version_name']} (Accuracy: {result['new_eval']['accuracy']*100:.1f}%)")
    print(f" -> Accuracy Delta: {result['performance_delta']['accuracy_delta']}")
    print(f" -> STP Rate Delta: {result['performance_delta']['stp_delta']}")
    print(f" -> Promoted Status: {result['promoted']}")
    assert result['promoted'] == True, "New version should be promoted"
    print(" -> PASSED: Autonomous Agent Engineering Loop self-improvement cycle validated.")

    print("\n==================================================")
    print("   ALL VERIFICATION TESTS PASSED SUCCESSFULLY!    ")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
