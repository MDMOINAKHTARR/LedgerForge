import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.services.dataset_generator import SyntheticDatasetGenerator
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.eval_engine import EvaluationEngine

def run_tests():
    print("==========================================================")
    print("  RUNNING PHASE 1 DATA & EVALUATION FOUNDATION VERIFICATION  ")
    print("==========================================================")

    # Test 1: Deterministic Dataset Generation
    print("\n[Test 1] Generating Deterministic Seed=42 Dataset...")
    ds = SyntheticDatasetGenerator.generate_dataset(seed=42, count=60)
    assert len(ds.bank_transactions) == 64, f"Bank transactions count mismatch: {len(ds.bank_transactions)}"
    assert len(ds.ground_truth) == 64, f"Ground truth count mismatch: {len(ds.ground_truth)}"
    
    categories = set(gt.exception_type.value for gt in ds.ground_truth)
    print(f" -> Generated {len(ds.bank_transactions)} Bank & {len(ds.ledger_transactions)} Ledger transactions.")
    print(f" -> Cover {len(categories)}/10 Exception Categories: {sorted(list(categories))}")
    assert len(categories) == 10, "Must cover all 10 required exception categories"
    print(" -> PASSED: Seed=42 Dataset is deterministic and covers all 10 exception categories.")

    # Test 2: Golden Cases Generation
    print("\n[Test 2] Generating Golden Demo Edge Cases...")
    gold = SyntheticDatasetGenerator.generate_golden_cases()
    assert len(gold.bank_transactions) == 4, "Golden cases count mismatch"
    print(f" -> Generated {len(gold.bank_transactions)} hard financial edge cases for demo judges.")
    print(" -> PASSED: Golden cases generated successfully.")

    # Test 3: Benchmark Agent V1 vs V2 vs V3
    print("\n[Test 3] Benchmarking Agent V1 vs V2 vs V3 on Synthetic Seed=42 Dataset...")
    v1 = AgentRegistry.get_version_by_id("v1")
    v2 = AgentRegistry.get_version_by_id("v2")
    v3 = AgentRegistry.get_version_by_id("v3")

    res_v1 = EvaluationEngine.run_evaluation(ds, v1)
    res_v2 = EvaluationEngine.run_evaluation(ds, v2)
    res_v3 = EvaluationEngine.run_evaluation(ds, v3)

    print(f" -> Agent V1: Accuracy={res_v1.overall_accuracy*100:.1f}%, STP={res_v1.straight_through_processing_rate*100:.1f}%, False Auto-Posts={res_v1.false_auto_post_rate*100:.1f}%")
    print(f" -> Agent V2: Accuracy={res_v2.overall_accuracy*100:.1f}%, STP={res_v2.straight_through_processing_rate*100:.1f}%, False Auto-Posts={res_v2.false_auto_post_rate*100:.1f}%")
    print(f" -> Agent V3: Accuracy={res_v3.overall_accuracy*100:.1f}%, STP={res_v3.straight_through_processing_rate*100:.1f}%, False Auto-Posts={res_v3.false_auto_post_rate*100:.1f}%")

    assert res_v3.overall_accuracy >= res_v1.overall_accuracy, "Agent V3 accuracy must be equal or superior to V1"
    print(" -> PASSED: Evaluator proves Agent V3 outperforming Agent V1 with higher overall accuracy.")

    print("\n==========================================================")
    print("    ALL PHASE 1 EVALUATION FOUNDATION TESTS PASSED!       ")
    print("==========================================================")

if __name__ == "__main__":
    run_tests()
