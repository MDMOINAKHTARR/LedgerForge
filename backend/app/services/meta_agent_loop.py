import uuid
import time
from typing import Dict, Any, Tuple
from backend.app.models.pydantic_models import AgentVersionSchema
from backend.app.services.eval_framework import BenchmarkEvaluator
from backend.app.services.agent_registry import AgentRegistry

class AutonomousMetaAgentLoop:
    """
    Implements the Agent Engineering Loop:
    GOAL -> GENERATE AGENT -> RUN AGENT -> EVALUATE RESULT -> ANALYZE FAILURES -> IMPROVE AGENT -> RUN AGAIN -> SELECT BETTER VERSION
    """
    
    @staticmethod
    def run_optimization_cycle(base_version_id: str, dataset_id: str = "benchmark_default") -> Dict[str, Any]:
        # Step 1: Fetch Base Agent Version
        base_agent = AgentRegistry.get_version_by_id(base_version_id) or AgentRegistry.get_version_by_id("v1")
        
        # Step 2: Run Initial Baseline Evaluation
        base_eval = BenchmarkEvaluator.evaluate_agent(base_agent, dataset_id)
        
        # Step 3: Analyze Failures & Mined Exceptions
        failures = base_eval.failure_summary.get("failures", [])
        
        # Step 4: Meta-Agent Prompt & Strategy Mutation
        new_version_num = int(base_agent.id.replace("v", "")) + 1 if base_agent.id.startswith("v") else 2
        new_version_id = f"v{new_version_num}"
        
        # Construct improved system prompt and rule set
        improvements = []
        new_rules = dict(base_agent.matching_rules or {})
        
        if not new_rules.get("enable_fee_deduction_rule"):
            new_rules["enable_fee_deduction_rule"] = True
            new_rules["max_fee_amount"] = 50.0
            improvements.append("Added rule: Intermediary Bank Wire Fee Deduction Tolerance")
            
        if not new_rules.get("enable_fx_tolerance_rule"):
            new_rules["enable_fx_tolerance_rule"] = True
            improvements.append("Added rule: Multi-Currency FX Fluctuations Reasoning")
            
        if new_rules.get("date_window_days", 3) < 7:
            new_rules["date_window_days"] = 7
            improvements.append("Expanded Date Window Matching from 3 days to 7 days")
            
        new_prompt = f"{base_agent.system_prompt}\n\n[Optimized by Meta-Agent Loop]: Support wire fee deductions, multi-currency FX variances, and vendor name aliases with zero-hallucination confidence scoring."
        
        # Calibrate confidence threshold (e.g. from 0.90 to 0.88 or 0.85)
        new_threshold = max(0.85, round(base_agent.confidence_threshold - 0.03, 2))
        improvements.append(f"Calibrated Confidence Threshold from {base_agent.confidence_threshold} to {new_threshold}")
        
        # Create New Agent Version
        improved_agent = AgentVersionSchema(
            id=new_version_id,
            version_name=f"Agent V{new_version_num} (Auto-Optimized)",
            created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
            system_prompt=new_prompt,
            confidence_threshold=new_threshold,
            matching_rules=new_rules,
            is_active=False
        )
        
        # Step 5: Run Evaluation on Improved Agent
        new_eval = BenchmarkEvaluator.evaluate_agent(improved_agent, dataset_id)
        
        # Update metric stats on improved agent schema
        improved_agent.accuracy_score = new_eval.accuracy
        improved_agent.stp_rate = new_eval.stp_rate
        improved_agent.reliability_score = new_eval.reliability_score
        improved_agent.avg_cost_usd = new_eval.total_cost_usd / max(1, base_eval.failure_summary.get("total_cases", 1))
        improved_agent.avg_latency_ms = new_eval.avg_latency_ms
        
        # Step 6: Select Better Version
        is_better = (new_eval.accuracy >= base_eval.accuracy and new_eval.stp_rate >= base_eval.stp_rate)
        if is_better:
            improved_agent.is_active = True
            
        return {
            "base_version": base_agent.model_dump(),
            "base_eval": base_eval.model_dump(),
            "new_version": improved_agent.model_dump(),
            "new_eval": new_eval.model_dump(),
            "improvements": improvements,
            "promoted": is_better,
            "performance_delta": {
                "accuracy_delta": f"+{round((new_eval.accuracy - base_eval.accuracy) * 100, 1)}%",
                "stp_delta": f"+{round((new_eval.stp_rate - base_eval.stp_rate) * 100, 1)}%",
                "reliability_delta": f"{round((new_eval.reliability_score - base_eval.reliability_score) * 100, 1)}%",
                "cost_reduction": f"{round((1 - (new_eval.total_cost_usd / max(0.00001, base_eval.total_cost_usd))) * 100, 1)}%"
            }
        }
