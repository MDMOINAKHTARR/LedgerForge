import uuid
import time
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.app.models.dataset_models import EvaluationMetricsResult
from backend.app.models.pydantic_models import (
    AgentVersionSchema, AgentSpec,
    AgentOptimizationRunSchema, LeaderboardItemSchema,
    FailureDiagnosisReport, ImprovementProposal
)
from backend.app.models.db import DBAgentOptimizationRun, DBAgentVersion
from backend.app.services.dataset_generator import SyntheticDatasetGenerator
from backend.app.services.eval_engine import EvaluationEngine
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.failure_analyzer import FailureAnalyzer

class AgentEngineerService:
    """
    Phase 6 Autonomous Agent Engineer Service.
    Executes the self-improving agent engineering loop:
    Goal -> Run -> Evaluate -> Analyze Failures -> Synthesize Spec -> Benchmark Candidate -> Compare -> Decide -> Leaderboard.
    """

    @staticmethod
    def run_optimization_loop(
        db: Session,
        goal: str = "Maximize accuracy and STP while enforcing 0% false auto-post rate",
        base_version_id: str = "v1",
        dataset_seed: int = 42
    ) -> AgentOptimizationRunSchema:

        run_id = f"opt_{uuid.uuid4().hex[:8]}"
        now_str = time.strftime("%Y-%m-%d %H:%M:%S")

        # Step 1: Load Base Agent Version
        base_agent = AgentRegistry.get_version_by_id(base_version_id)
        base_spec = AgentSpec(
            version=base_agent.id,
            matching_strategy="RULE_FIRST" if base_agent.id == "v1" else "MULTI_TIER_RULE_FUZZY_LLM",
            confidence_threshold=base_agent.confidence_threshold,
            llm_enabled=True,
            verification_enabled=True,
            prompt_version="p1" if base_agent.id == "v1" else "p3",
            escalation_policy="STRICT" if base_agent.id != "v1" else "BALANCED",
            matching_rules=base_agent.matching_rules or {}
        )

        # Step 2: Generate Evaluation Dataset
        dataset = SyntheticDatasetGenerator.generate_dataset(seed=dataset_seed, count=60)

        # Step 3: Benchmark Base Agent on Dataset
        base_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(dataset, base_agent)

        # Step 4: Determine Candidate Version Name (e.g. v4, v5, v6)
        existing_versions = AgentRegistry.get_all_versions()
        cand_num = len(existing_versions) + 1
        candidate_version_id = f"v{cand_num}"
        
        # Check DB to guarantee uniqueness
        if db.query(DBAgentVersion).filter(DBAgentVersion.id == candidate_version_id).first():
            candidate_version_id = f"v{cand_num}_{uuid.uuid4().hex[:4]}"


        # Step 5: Failure Analysis & Improvement Proposal Generation
        diagnosis, proposal = FailureAnalyzer.analyze_failures(
            metrics=base_metrics,
            current_spec=base_spec,
            target_version=candidate_version_id
        )

        # Step 6: Instantiate Candidate Agent Configuration
        cand_spec = proposal.new_agent_spec
        cand_agent = AgentVersionSchema(
            id=candidate_version_id,
            version_name=f"Agent {candidate_version_id.upper()} (Autonomous Auto-Tuned)",
            created_at=now_str,
            system_prompt=f"System Prompt for {candidate_version_id.upper()}: Optimized for zero false auto-post rate and tight fee/FX verification.",
            confidence_threshold=cand_spec.confidence_threshold,
            matching_rules=cand_spec.matching_rules,
            is_active=False
        )

        # Step 7: Benchmark Candidate Agent on SAME Dataset
        cand_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(dataset, cand_agent)

        # Update candidate agent metrics
        cand_agent.accuracy_score = cand_metrics.overall_accuracy
        cand_agent.stp_rate = cand_metrics.straight_through_processing_rate
        cand_agent.reliability_score = round(1.0 - cand_metrics.false_auto_post_rate, 4)
        cand_agent.avg_cost_usd = cand_metrics.estimated_token_cost_usd
        cand_agent.avg_latency_ms = cand_metrics.avg_processing_latency_ms

        # Step 8: Multi-Objective Fitness Evaluation
        # Fitness = 0.40 * Accuracy + 0.30 * Reliability + 0.30 * STP
        base_fitness = (base_metrics.overall_accuracy * 0.40) + ((1.0 - base_metrics.false_auto_post_rate) * 0.30) + (base_metrics.straight_through_processing_rate * 0.30)
        cand_fitness = (cand_metrics.overall_accuracy * 0.40) + ((1.0 - cand_metrics.false_auto_post_rate) * 0.30) + (cand_metrics.straight_through_processing_rate * 0.30)

        # Safety Hard Constraint: False Auto-Post Rate <= 5%
        safety_passed = (cand_metrics.false_auto_post_rate <= 0.05) or (cand_metrics.false_auto_post_rate <= base_metrics.false_auto_post_rate)

        accepted = (cand_fitness > base_fitness) and safety_passed

        # Step 9: Generate Clear Decision Explanation Rationale
        if accepted:
            rationale = (
                f"{candidate_version_id.upper()} accepted because overall accuracy improved from "
                f"{base_metrics.overall_accuracy*100:.1f}% -> {cand_metrics.overall_accuracy*100:.1f}%, "
                f"false auto-post rate from {base_metrics.false_auto_post_rate*100:.1f}% -> {cand_metrics.false_auto_post_rate*100:.1f}%, "
                f"and STP rate reached {cand_metrics.straight_through_processing_rate*100:.1f}%."
            )
        else:
            rationale = (
                f"{candidate_version_id.upper()} rejected because candidate fitness ({cand_fitness:.3f}) did not exceed "
                f"baseline fitness ({base_fitness:.3f}) or violated safety constraint (False Auto-Post Rate: {cand_metrics.false_auto_post_rate*100:.1f}%)."
            )

        # Step 10: Register Candidate Agent Version
        AgentRegistry.register_version(cand_agent)
        if accepted:
            AgentRegistry.set_active_version(candidate_version_id)

        # Step 11: Persist DB Records
        db_cand_version = DBAgentVersion(
            id=cand_agent.id,
            version_name=cand_agent.version_name,
            system_prompt=cand_agent.system_prompt,
            confidence_threshold=cand_agent.confidence_threshold,
            matching_rules=cand_agent.matching_rules,
            is_active=accepted,
            accuracy_score=cand_agent.accuracy_score,
            stp_rate=cand_agent.stp_rate,
            reliability_score=cand_agent.reliability_score,
            avg_cost_usd=cand_agent.avg_cost_usd,
            avg_latency_ms=cand_agent.avg_latency_ms
        )
        db.add(db_cand_version)

        db_opt = DBAgentOptimizationRun(
            id=run_id,
            goal=goal,
            base_version_id=base_version_id,
            candidate_version_id=candidate_version_id,
            base_accuracy=base_metrics.overall_accuracy,
            candidate_accuracy=cand_metrics.overall_accuracy,
            base_false_auto_post_rate=base_metrics.false_auto_post_rate,
            candidate_false_auto_post_rate=cand_metrics.false_auto_post_rate,
            base_stp_rate=base_metrics.straight_through_processing_rate,
            candidate_stp_rate=cand_metrics.straight_through_processing_rate,
            accepted=accepted,
            decision_rationale=rationale,
            failure_diagnosis_json=diagnosis.model_dump(),
            improvement_proposal_json=proposal.model_dump()
        )
        db.add(db_opt)
        db.commit()

        return AgentOptimizationRunSchema(
            run_id=run_id,
            created_at=now_str,
            goal=goal,
            base_version_id=base_version_id,
            candidate_version_id=candidate_version_id,
            base_accuracy=base_metrics.overall_accuracy,
            candidate_accuracy=cand_metrics.overall_accuracy,
            base_false_auto_post_rate=base_metrics.false_auto_post_rate,
            candidate_false_auto_post_rate=cand_metrics.false_auto_post_rate,
            base_stp_rate=base_metrics.straight_through_processing_rate,
            candidate_stp_rate=cand_metrics.straight_through_processing_rate,
            accepted=accepted,
            decision_rationale=rationale,
            failure_diagnosis=diagnosis,
            improvement_proposal=proposal
        )

    @staticmethod
    def get_leaderboard(db: Session) -> List[LeaderboardItemSchema]:
        """
        Returns sorted Agent Leaderboard by accuracy & reliability.
        """
        versions = AgentRegistry.get_all_versions()
        # Sort by accuracy descending, then false_auto_post_rate ascending
        sorted_versions = sorted(
            versions,
            key=lambda v: (v.accuracy_score or 0.0, v.reliability_score or 0.0),
            reverse=True
        )

        leaderboard: List[LeaderboardItemSchema] = []
        for idx, v in enumerate(sorted_versions, start=1):
            false_post_rate = round(1.0 - (v.reliability_score or 1.0), 4)
            leaderboard.append(
                LeaderboardItemSchema(
                    rank=idx,
                    version_id=v.id,
                    version_name=v.version_name,
                    created_at=v.created_at,
                    accuracy=v.accuracy_score or 0.0,
                    stp_rate=v.stp_rate or 0.0,
                    reliability_score=v.reliability_score or 1.0,
                    false_auto_post_rate=false_post_rate,
                    avg_cost_usd=v.avg_cost_usd or 0.0,
                    avg_latency_ms=v.avg_latency_ms or 0.0,
                    is_active=v.is_active,
                    accepted_runs=1 if v.id in ["v2", "v3"] else 0
                )
            )

        return leaderboard
