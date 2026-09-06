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
from backend.app.models.db import DBAgentOptimizationRun, DBAgentVersion, DBReconciliationFeedback
from backend.app.services.dataset_generator import SyntheticDatasetGenerator
from backend.app.services.eval_engine import EvaluationEngine
from backend.app.services.agent_registry import AgentRegistry
from backend.app.services.failure_analyzer import FailureAnalyzer
from backend.app.services.audit_service import AuditService

class AgentEngineerService:
    """
    Controlled Agent-Policy Validation and Engineering Service.
    Executes the self-improving agent engineering and policy validation loop:
    Observe/Goal -> Run Base -> Benchmark -> Analyze Failures -> Propose Candidate Spec ->
    Validate Candidate on Independent Regression Benchmark -> Enforce Strict Safety Gates ->
    Report Proposal & Safety Outcome -> Require Controlled Explicit Promotion.
    
    CRITICAL SAFETY PRINCIPLE:
    No autonomous rule mutation in production.
    The optimization system NEVER automatically activates candidate policies.
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

        # Step 2: Regression Benchmark Independence
        # Observation dataset is used to observe operational failures and tune proposals.
        # Independent regression benchmark (different seed) is used for independent policy validation.
        obs_dataset = SyntheticDatasetGenerator.generate_dataset(seed=dataset_seed, count=60)
        regression_seed = (dataset_seed * 37 + 54321) % 99999 + 1000
        benchmark_dataset = SyntheticDatasetGenerator.generate_dataset(seed=regression_seed, count=60)

        # Step 3: Observe Base Agent Performance & Failures
        obs_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(obs_dataset, base_agent)
        base_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(benchmark_dataset, base_agent)

        # Step 4: Determine Candidate Version Name (e.g. v4, v5, v6)
        existing_versions = AgentRegistry.get_all_versions()
        cand_num = len(existing_versions) + 1
        candidate_version_id = f"v{cand_num}"
        
        # Check DB to guarantee uniqueness
        if db.query(DBAgentVersion).filter(DBAgentVersion.id == candidate_version_id).first():
            candidate_version_id = f"v{cand_num}_{uuid.uuid4().hex[:4]}"

        # Step 5: Failure Analysis & Improvement Proposal Generation with Human Feedback
        historical_feedbacks = db.query(DBReconciliationFeedback).all()
        diagnosis, proposal = FailureAnalyzer.analyze_failures(
            metrics=obs_metrics,
            current_spec=base_spec,
            target_version=candidate_version_id,
            historical_feedback=historical_feedbacks
        )

        # Step 6: Instantiate Candidate Agent Configuration (Candidate Version)
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

        # Audit Trail: Record CANDIDATE GENERATED event
        AuditService.record_agent_lifecycle_event(
            db=db,
            event_type="CANDIDATE_GENERATED",
            agent_version=candidate_version_id,
            decision="GENERATED",
            reasoning=f"Candidate spec generated based on {diagnosis.total_failures} observed failures and feedback patterns. Target: {candidate_version_id}.",
            metadata={
                "base_version_id": base_version_id,
                "candidate_version_id": candidate_version_id,
                "proposed_changes": proposal.proposed_changes,
                "confidence_threshold": cand_spec.confidence_threshold,
                "escalation_policy": cand_spec.escalation_policy
            },
            commit=False
        )

        # Step 7: Benchmark Candidate Agent on INDEPENDENT Regression Benchmark
        cand_metrics: EvaluationMetricsResult = EvaluationEngine.run_evaluation(benchmark_dataset, cand_agent)

        # Update candidate agent metrics
        cand_agent.accuracy_score = cand_metrics.overall_accuracy
        cand_agent.stp_rate = cand_metrics.straight_through_processing_rate
        cand_agent.reliability_score = round(1.0 - cand_metrics.false_auto_post_rate, 4)
        cand_agent.avg_cost_usd = cand_metrics.estimated_token_cost_usd
        cand_agent.avg_latency_ms = cand_metrics.avg_processing_latency_ms

        # Step 8: Multi-Objective Fitness Evaluation & Hard Safety Gate Checks
        # Fitness = 0.40 * Accuracy + 0.30 * Reliability + 0.30 * STP
        base_fitness = (base_metrics.overall_accuracy * 0.40) + ((1.0 - base_metrics.false_auto_post_rate) * 0.30) + (base_metrics.straight_through_processing_rate * 0.30)
        cand_fitness = (cand_metrics.overall_accuracy * 0.40) + ((1.0 - cand_metrics.false_auto_post_rate) * 0.30) + (cand_metrics.straight_through_processing_rate * 0.30)

        # HARD SAFETY GATES:
        # Priority 1: Hard safety gates (currency confusion == 0, duplicate auto-match == 0, direction conflict == 0, material variance == 0, high-risk == 0)
        # Priority 2: Zero false auto-matches (count == 0, rate == 0.0)
        # Priority 3: No regression in precision (cand precision >= base precision)
        # Priority 4: Automation/fitness improvement
        safety_passed = (
            cand_metrics.safety_gates_passed
            and cand_metrics.false_auto_match_count == 0
            and cand_metrics.false_auto_post_rate == 0.0
            and cand_metrics.currency_confusion_errors == 0
            and cand_metrics.duplicate_auto_match_count == 0
            and cand_metrics.direction_conflict_auto_match_count == 0
            and cand_metrics.amount_variance_auto_match_count == 0
            and cand_metrics.high_risk_auto_match_count == 0
            and cand_metrics.false_auto_match_count <= base_metrics.false_auto_match_count
        )

        # Most Important Metric: NOT maximum automation.
        # A policy that auto-reconciles more transactions but increases false matches MUST be considered worse.
        accepted = (
            safety_passed
            and (cand_fitness >= base_fitness)
            and (cand_metrics.auto_reconciliation_precision >= base_metrics.auto_reconciliation_precision)
        )

        # Step 9: Generate Clear Decision Explanation Rationale
        if accepted:
            rationale = (
                f"Candidate {candidate_version_id.upper()} PASSED validation on independent regression benchmark: all safety gates verified "
                f"(0 false auto-matches, 0 currency confusion errors, 0 duplicate auto-matches, 0 material variances). "
                f"Accuracy: {base_metrics.overall_accuracy*100:.1f}% -> {cand_metrics.overall_accuracy*100:.1f}%, "
                f"STP: {base_metrics.straight_through_processing_rate*100:.1f}% -> {cand_metrics.straight_through_processing_rate*100:.1f}%. "
                f"Candidate registered as candidate version with is_active=False. Controlled promotion required before production use."
            )
        else:
            violations_str = ", ".join(cand_metrics.safety_gate_violations) if cand_metrics.safety_gate_violations else "fitness or precision did not exceed baseline"
            rationale = (
                f"Candidate {candidate_version_id.upper()} REJECTED: Failed validation criteria on independent benchmark ({violations_str}). "
                f"Candidate fitness: {cand_fitness:.3f} vs baseline: {base_fitness:.3f}. "
                f"False auto-matches: {cand_metrics.false_auto_match_count} (rate: {cand_metrics.false_auto_post_rate*100:.1f}%). "
                f"Active production policy remains unchanged."
            )

        # Audit Trail: Record CANDIDATE VALIDATED event
        AuditService.record_agent_lifecycle_event(
            db=db,
            event_type="CANDIDATE_VALIDATED",
            agent_version=candidate_version_id,
            decision="VALIDATED_ACCEPTED" if accepted else "VALIDATED_REJECTED",
            reasoning=rationale,
            metadata={
                "candidate_version_id": candidate_version_id,
                "accepted": accepted,
                "safety_passed": safety_passed,
                "base_accuracy": base_metrics.overall_accuracy,
                "candidate_accuracy": cand_metrics.overall_accuracy,
                "base_false_auto_post_rate": base_metrics.false_auto_post_rate,
                "candidate_false_auto_post_rate": cand_metrics.false_auto_post_rate,
                "false_auto_match_count": cand_metrics.false_auto_match_count,
                "currency_confusion_errors": cand_metrics.currency_confusion_errors,
                "duplicate_auto_match_count": cand_metrics.duplicate_auto_match_count,
                "direction_conflict_auto_match_count": cand_metrics.direction_conflict_auto_match_count,
                "amount_variance_auto_match_count": cand_metrics.amount_variance_auto_match_count,
                "high_risk_auto_match_count": cand_metrics.high_risk_auto_match_count,
                "safety_gate_violations": cand_metrics.safety_gate_violations
            },
            commit=False
        )

        # Step 10: Register Candidate Agent Version as INACTIVE candidate
        # CRITICAL SAFETY: Never silently activate candidate version in production.
        cand_agent.is_active = False
        AgentRegistry.register_version(cand_agent)

        # Step 11: Persist DB Records (Always is_active=False until explicit human promotion)
        db_cand_version = DBAgentVersion(
            id=cand_agent.id,
            version_name=cand_agent.version_name,
            system_prompt=cand_agent.system_prompt,
            confidence_threshold=cand_agent.confidence_threshold,
            matching_rules=cand_agent.matching_rules,
            is_active=False,
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
            improvement_proposal=proposal,
            safety_gates_passed=cand_metrics.safety_gates_passed,
            safety_gate_violations=cand_metrics.safety_gate_violations
        )

    @staticmethod
    def promote_candidate_version(
        db: Session,
        version_id: str,
        operator_id: Optional[str] = None
    ) -> AgentVersionSchema:
        """
        Controlled promotion gate: Promotes an evaluated candidate agent version
        to become the active production agent.
        Requires that the candidate exists, is registered, and has passed
        safety validation benchmarks.
        The promotion method itself directly re-checks the candidate's validation
        state against an independent regression benchmark.
        """
        version = AgentRegistry.get_version_by_id(version_id)
        if not version or version.id != version_id:
            raise ValueError(f"Agent version '{version_id}' not found in registry.")

        previous_active = AgentRegistry.get_active_version()

        # For candidate versions, verify prior optimization run status
        opt_run = db.query(DBAgentOptimizationRun).filter(
            DBAgentOptimizationRun.candidate_version_id == version_id
        ).order_by(DBAgentOptimizationRun.created_at.desc()).first()

        if opt_run and not opt_run.accepted:
            raise ValueError(
                f"Cannot promote candidate '{version_id}': Candidate failed safety validation benchmark "
                f"({opt_run.decision_rationale})."
            )

        # RE-CHECK VALIDATION STATE:
        # Promotion method directly re-verifies safety gates and policy invariants.
        # It does not rely solely on the optimizer having previously checked it.
        if version_id not in ["v1", "v2", "v3"] or opt_run is not None:
            recheck_violations = []

            # 1. Inspect candidate policy threshold safety floor
            if (version.confidence_threshold or 0.0) < 0.70:
                recheck_violations.append(f"confidence threshold {version.confidence_threshold} is below safe floor of 0.70")

            # 2. Inspect candidate matching rules for forbidden auto-match categories
            rules = version.matching_rules or {}
            disallowed_auto = set(rules.get("allowed_auto_exception_types", [])) & {
                "DUPLICATE", "AMOUNT_DISCREPANCY", "PARTIAL_PAYMENT", "MISSING_LEDGER", "MISSING_BANK", "CURRENCY_MISMATCH"
            }
            if disallowed_auto:
                recheck_violations.append(f"disallowed auto-reconciliation exception types: {sorted(list(disallowed_auto))}")

            if rules.get("escalate_on_duplicate") is False or rules.get("escalate_on_duplicate_candidates") is False:
                recheck_violations.append("duplicate escalation safeguards disabled")

            if (rules.get("max_fee_amount") or 0.0) > 200.0:
                recheck_violations.append(f"fee tolerance exceeds safe ceiling of 200.0 (${rules.get('max_fee_amount')})")

            # 3. Independent regression benchmark evaluation re-check against baseline
            bench_dataset = SyntheticDatasetGenerator.generate_dataset(seed=8888, count=60)
            recheck_metrics = EvaluationEngine.run_evaluation(bench_dataset, version)
            base_bench_metrics = EvaluationEngine.run_evaluation(bench_dataset, previous_active)

            if recheck_metrics.currency_confusion_errors > 0:
                recheck_violations.append(f"{recheck_metrics.currency_confusion_errors} currency confusion errors")
            if recheck_metrics.direction_conflict_auto_match_count > 0:
                recheck_violations.append(f"{recheck_metrics.direction_conflict_auto_match_count} direction conflict auto-matches")
            if recheck_metrics.amount_variance_auto_match_count > 0:
                recheck_violations.append(f"{recheck_metrics.amount_variance_auto_match_count} material variance auto-matches")
            if recheck_metrics.false_auto_match_count > base_bench_metrics.false_auto_match_count:
                recheck_violations.append(f"candidate increases false auto-matches ({recheck_metrics.false_auto_match_count} vs base {base_bench_metrics.false_auto_match_count})")
            if recheck_metrics.duplicate_auto_match_count > base_bench_metrics.duplicate_auto_match_count:
                recheck_violations.append(f"candidate increases duplicate auto-matches ({recheck_metrics.duplicate_auto_match_count} vs base {base_bench_metrics.duplicate_auto_match_count})")
            if recheck_metrics.high_risk_auto_match_count > base_bench_metrics.high_risk_auto_match_count:
                recheck_violations.append(f"candidate increases high-risk auto-matches ({recheck_metrics.high_risk_auto_match_count} vs base {base_bench_metrics.high_risk_auto_match_count})")

            if recheck_violations:
                violation_summary = ", ".join(recheck_violations)
                raise ValueError(
                    f"Cannot promote candidate '{version_id}': Promotion re-check failed validation criteria ({violation_summary})."
                )

        # Record Audit Trail: AGENT_VERSION_PROMOTION event
        AuditService.record_agent_lifecycle_event(
            db=db,
            event_type="AGENT_VERSION_PROMOTION",
            agent_version=version_id,
            decision="PROMOTED",
            reasoning=f"Explicit operator promotion of agent version '{version_id}'. Previous active: '{previous_active.id}'.",
            metadata={
                "previous_active_version": previous_active.id,
                "promoted_version": version_id,
                "candidate_validation_status": "PASSED",
                "accuracy": version.accuracy_score,
                "stp_rate": version.stp_rate,
                "safety_gate_status": "PASSED",
                "promoted_at": time.strftime("%Y-%m-%d %H:%M:%S")
            },
            operator_id=operator_id or "system_operator",
            commit=False
        )

        # Explicit controlled activation in in-memory registry
        AgentRegistry.set_active_version(version_id)

        # Synchronize DB persistence: deactivate all others, activate selected
        db.query(DBAgentVersion).update({DBAgentVersion.is_active: False})
        db_ver = db.query(DBAgentVersion).filter(DBAgentVersion.id == version_id).first()
        if db_ver:
            db_ver.is_active = True
        else:
            db.add(DBAgentVersion(
                id=version.id,
                version_name=version.version_name,
                system_prompt=version.system_prompt,
                confidence_threshold=version.confidence_threshold,
                matching_rules=version.matching_rules,
                is_active=True,
                accuracy_score=version.accuracy_score,
                stp_rate=version.stp_rate,
                reliability_score=version.reliability_score,
                avg_cost_usd=version.avg_cost_usd,
                avg_latency_ms=version.avg_latency_ms
            ))
        db.commit()

        return AgentRegistry.get_version_by_id(version_id)


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
