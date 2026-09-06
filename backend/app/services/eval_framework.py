import uuid
import time
from typing import Dict, Any, List
from backend.app.models.pydantic_models import AgentVersionSchema, EvalRunSchema, ActionTaken
from backend.app.services.matching_engine import MultiTierMatchingEngine
import os
from backend.app.services.ingestion import DataIngestionService
from backend.app.models.pydantic_models import SourceType

def get_benchmark_dataset():
    """
    Ingests real CSV transactions from disk for evaluation.
    """
    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    bank_path = os.path.join(data_dir, "sample_bank.csv")
    ledger_path = os.path.join(data_dir, "sample_ledger.csv")
    with open(bank_path, "rb") as f:
        bank_bytes = f.read()
    with open(ledger_path, "rb") as f:
        ledger_bytes = f.read()
    bank_txs = DataIngestionService.parse_csv_content(bank_bytes, SourceType.BANK, "sample_eval")
    ledger_txs = DataIngestionService.parse_csv_content(ledger_bytes, SourceType.LEDGER, "sample_eval")
    
    # Ground truth mapping based on real reference IDs
    ground_truth = []
    for b in bank_txs:
        matched_l = next((l for l in ledger_txs if l.reference_id and l.reference_id == b.reference_id), None)
        ground_truth.append({
            "bank_tx_id": b.id,
            "ledger_tx_id": matched_l.id if matched_l else None,
            "expected_action": ActionTaken.AUTO_RECONCILE.value if matched_l else ActionTaken.ESCALATE_TO_HUMAN.value
        })
    return bank_txs, ledger_txs, ground_truth

class BenchmarkEvaluator:
    @staticmethod
    def evaluate_agent(agent_version: AgentVersionSchema, dataset_id: str = "benchmark_default") -> EvalRunSchema:
        bank_txs, ledger_txs, ground_truth = get_benchmark_dataset()
        
        batch_id = f"eval_batch_{uuid.uuid4().hex[:8]}"
        start_time = time.time()
        
        results, traces = MultiTierMatchingEngine.process_batch(
            batch_id=batch_id,
            bank_txs=bank_txs,
            ledger_txs=ledger_txs,
            agent_version=agent_version
        )
        
        total_time = (time.time() - start_time) * 1000
        
        # Map results by bank_tx_id
        res_by_bank_id = {r.bank_tx_id: r for r in results}
        
        correct_matches = 0
        auto_reconciled_count = 0
        false_auto_posts = 0
        failures: List[Dict[str, Any]] = []
        
        for gt in ground_truth:
            b_id = gt["bank_tx_id"]
            expected_l_id = gt["ledger_tx_id"]
            expected_action = gt["expected_action"]
            
            res = res_by_bank_id.get(b_id)
            if not res:
                failures.append({"bank_id": b_id, "issue": "Missing result"})
                continue
                
            actual_l_id = res.ledger_tx_id
            actual_action = res.action_taken.value
            
            # Check match correctness
            is_match_correct = (actual_l_id == expected_l_id)
            if is_match_correct:
                correct_matches += 1
            else:
                failures.append({
                    "bank_id": b_id,
                    "reason": f"Expected ledger match '{expected_l_id}', got '{actual_l_id}'",
                    "confidence": res.confidence_score,
                    "action_taken": actual_action,
                    "match_type": res.match_type.value
                })
                
            if actual_action == ActionTaken.AUTO_RECONCILE.value:
                auto_reconciled_count += 1
                if not is_match_correct:
                    false_auto_posts += 1
                    
        total_cases = len(ground_truth)
        accuracy = round(correct_matches / total_cases, 4) if total_cases > 0 else 0.0
        stp_rate = round(auto_reconciled_count / total_cases, 4) if total_cases > 0 else 0.0
        reliability = round(1.0 - (false_auto_posts / max(1, auto_reconciled_count)), 4)
        
        total_cost = sum(t.cost_usd for t in traces)
        avg_latency = round(total_time / max(1, total_cases), 2)
        
        eval_run = EvalRunSchema(
            id=f"eval_{uuid.uuid4().hex[:8]}",
            dataset_id=dataset_id,
            agent_version_id=agent_version.id,
            created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            accuracy=accuracy,
            stp_rate=stp_rate,
            reliability_score=reliability,
            total_cost_usd=round(total_cost, 6),
            avg_latency_ms=avg_latency,
            failure_summary={
                "total_cases": total_cases,
                "failed_cases_count": len(failures),
                "failures": failures
            }
        )
        return eval_run
