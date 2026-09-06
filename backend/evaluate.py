import sys
import os
import json
import argparse

# Add backend root to PYTHONPATH
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.models.pydantic_models import AgentVersionSchema
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.dataset_generator import SyntheticDatasetGenerator
from backend.app.services.eval_engine import EvaluationEngine

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "app", "data"))

def ensure_datasets_exist():
    os.makedirs(DATA_DIR, exist_ok=True)
    
    dataset_file = os.path.join(DATA_DIR, "synthetic_dataset_42.json")
    golden_file = os.path.join(DATA_DIR, "golden_cases.json")
    
    if not os.path.exists(dataset_file):
        ds = SyntheticDatasetGenerator.generate_dataset(seed=42, count=60)
        with open(dataset_file, "w") as f:
            f.write(ds.model_dump_json(indent=2))
        print(f"Generated deterministic dataset (seed=42) at {dataset_file}")

    if not os.path.exists(golden_file):
        gold = SyntheticDatasetGenerator.generate_golden_cases()
        with open(golden_file, "w") as f:
            f.write(gold.model_dump_json(indent=2))
        print(f"Generated Golden Demo Edge Cases at {golden_file}")

def evaluate_agent(dataset_type: str, agent_version_id: str):
    ensure_datasets_exist()
    
    filename = "golden_cases.json" if dataset_type == "golden" else "synthetic_dataset_42.json"
    file_path = os.path.join(DATA_DIR, filename)
    
    with open(file_path, "r") as f:
        data_dict = json.load(f)
        
    from backend.app.models.dataset_models import SyntheticDatasetPackage
    dataset = SyntheticDatasetPackage(**data_dict)
    
    agent_version = AgentRegistry.get_version_by_id(agent_version_id) or AgentRegistry.get_version_by_id("v1")
    
    eval_result = EvaluationEngine.run_evaluation(dataset, agent_version)
    
    # Print formatted output to console
    print("\n" + "="*70)
    print(f"  EVALUATION REPORT: {eval_result.agent_version.upper()} ON {eval_result.dataset_name.upper()}  ")
    print("="*70)
    print(f" Total Cases:                       {eval_result.total_cases}")
    print(f" Overall Accuracy:                  {eval_result.overall_accuracy * 100:.1f}%")
    print(f" Match Precision / Recall:          {eval_result.match_precision * 100:.1f}% / {eval_result.match_recall * 100:.1f}%")
    print(f" Exception Classification Accuracy: {eval_result.exception_classification_accuracy * 100:.1f}%")
    print(f" Auto-Reconciliation Precision:     {eval_result.auto_reconciliation_precision * 100:.1f}%")
    print(f" Escalation Precision:              {eval_result.escalation_precision * 100:.1f}%")
    print(f" FALSE AUTO-POST RATE (SAFETY):     {eval_result.false_auto_post_rate * 100:.1f}%  <-- CRITICAL")
    print(f" False Escalation Rate:             {eval_result.false_escalation_rate * 100:.1f}%")
    print(f" Straight-Through-Processing (STP): {eval_result.straight_through_processing_rate * 100:.1f}%")
    print(f" Average Confidence:                {eval_result.average_confidence * 100:.1f}%")
    print(f" Avg Latency per Case:              {eval_result.avg_processing_latency_ms:.2f} ms")
    print(f" Estimated API Token Cost:          ${eval_result.estimated_token_cost_usd:.6f} USD")
    print("="*70)
    
    # Output raw JSON format as requested
    json_output = {
        "agent_version": eval_result.agent_version,
        "dataset_name": eval_result.dataset_name,
        "accuracy": eval_result.overall_accuracy,
        "false_auto_post_rate": eval_result.false_auto_post_rate,
        "straight_through_rate": eval_result.straight_through_processing_rate,
        "match_precision": eval_result.match_precision,
        "match_recall": eval_result.match_recall,
        "avg_latency_ms": eval_result.avg_processing_latency_ms,
        "estimated_cost_usd": eval_result.estimated_token_cost_usd,
        "breakdown_by_category": eval_result.breakdown_by_category
    }
    
    print("\nSTRUCTURED JSON RESULT:")
    print(json.dumps(json_output, indent=2))
    return json_output

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Bank Reconciliation Agent against Ground Truth Datasets.")
    parser.add_argument("--agent", type=str, default="v1", help="Agent version (v1, v2, v3)")
    parser.add_argument("--dataset", type=str, default="synthetic", choices=["synthetic", "golden"], help="Dataset type (synthetic, golden)")
    parser.add_argument("--generate", action="store_true", help="Force regenerate datasets")
    
    args = parser.parse_args()
    
    if args.generate:
        ensure_datasets_exist()
        print("Datasets regenerated successfully.")
    else:
        evaluate_agent(args.dataset, args.agent)
