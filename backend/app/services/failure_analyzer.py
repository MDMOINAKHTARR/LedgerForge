from backend.app.models.dataset_models import EvaluationMetricsResult
from backend.app.models.pydantic_models import (
    FailureCategory, FailureDiagnosisReport, ImprovementProposal, AgentSpec
)

class FailureAnalyzer:
    """
    Phase 6 Failure Analysis Engine.
    Inspects benchmark evaluation metrics and failure logs to categorize errors into 11 failure modes,
    diagnose root causes, and propose targeted AgentSpec improvements.
    """

    @staticmethod
    def analyze_failures(
        metrics: EvaluationMetricsResult,
        current_spec: AgentSpec,
        target_version: str
    ) -> tuple[FailureDiagnosisReport, ImprovementProposal]:

        failures = metrics.detailed_failures or []
        category_counts: Dict[str, int] = {cat.value: 0 for cat in FailureCategory}
        
        for f in failures:
            exc = f.get("exception_category", "")
            exp_action = f.get("expected_action", "")
            pred_action = f.get("predicted_action", "")
            exp_ledger = f.get("expected_ledger_id")
            pred_ledger = f.get("predicted_ledger_id")

            # Classification Logic into 11 Failure Categories
            if pred_action == "AUTO_RECONCILE" and exp_action != "AUTO_RECONCILE":
                category_counts[FailureCategory.FALSE_AUTO_POST.value] += 1
            elif pred_action in ["ESCALATE", "ESCALATE_TO_HUMAN"] and exp_action == "AUTO_RECONCILE":
                category_counts[FailureCategory.UNNECESSARY_ESCALATION.value] += 1
            elif exc == "DUPLICATE":
                category_counts[FailureCategory.DUPLICATE_HANDLING_FAILURE.value] += 1
            elif exc == "TIMING_MISMATCH":
                category_counts[FailureCategory.TIMING_MISMATCH_FAILURE.value] += 1
            elif exc == "PARTIAL_PAYMENT":
                category_counts[FailureCategory.PARTIAL_PAYMENT_FAILURE.value] += 1
            elif exc == "FX_VARIANCE":
                category_counts[FailureCategory.FX_FAILURE.value] += 1
            elif pred_ledger is not None and exp_ledger is None:
                category_counts[FailureCategory.HALLUCINATED_MATCH.value] += 1
            elif pred_ledger is None and exp_ledger is not None:
                category_counts[FailureCategory.MISSED_MATCH.value] += 1
            elif pred_ledger != exp_ledger:
                category_counts[FailureCategory.WRONG_MATCH.value] += 1
            else:
                category_counts[FailureCategory.EXCEPTION_MISCLASSIFICATION.value] += 1

        # Determine Primary Failure Category
        primary_cat_str = max(category_counts, key=category_counts.get)
        primary_category = FailureCategory(primary_cat_str)
        total_failures = len(failures)

        # Generate Diagnosis & Proposed Changes
        proposed_changes: List[str] = []
        new_rules = dict(current_spec.matching_rules)
        new_confidence = current_spec.confidence_threshold
        new_policy = current_spec.escalation_policy

        if primary_category == FailureCategory.FALSE_AUTO_POST:
            new_confidence = min(0.95, round(current_spec.confidence_threshold + 0.04, 2))
            new_policy = "STRICT"
            new_rules["ambiguity_margin"] = 0.06
            proposed_changes.append(f"Increase confidence threshold from {current_spec.confidence_threshold} -> {new_confidence} to prevent unsafe auto-posts.")
            proposed_changes.append("Enforce STRICT escalation policy on ambiguity and unallowed exception categories.")
            diagnosis_summary = f"Detected {category_counts[FailureCategory.FALSE_AUTO_POST.value]} false auto-posts. Confidence threshold was overly permissive."

        elif primary_category == FailureCategory.UNNECESSARY_ESCALATION:
            new_confidence = max(0.85, round(current_spec.confidence_threshold - 0.02, 2))
            new_rules["date_window_days"] = min(14, new_rules.get("date_window_days", 7) + 3)
            proposed_changes.append(f"Calibrate confidence threshold to {new_confidence} for clean matches with variances.")
            proposed_changes.append(f"Expand clearing window tolerance to {new_rules['date_window_days']} days.")
            
            # Check if unnecessary escalations stem from unhandled Bank Fees or FX Variances
            unnec_exc = [f.get("exception_category") for f in failures]
            if "BANK_FEE" in unnec_exc and not new_rules.get("enable_fee_deduction_rule"):
                new_rules["enable_fee_deduction_rule"] = True
                new_rules["max_fee_amount"] = 50.0
                proposed_changes.append("Enable intermediary bank fee deduction rule ($50 max tolerance) to resolve wire deductions.")
            if "FX_VARIANCE" in unnec_exc and not new_rules.get("enable_fx_tolerance_rule"):
                new_rules["enable_fx_tolerance_rule"] = True
                proposed_changes.append("Enable multi-currency FX variance tolerance rule for foreign currency wires.")
            new_rules["escalate_on_duplicate"] = True
            diagnosis_summary = f"Detected {category_counts[FailureCategory.UNNECESSARY_ESCALATION.value]} unnecessary escalations. Unlocked fee/FX heuristic rules and expanded clearing window."

        elif primary_category == FailureCategory.TIMING_MISMATCH_FAILURE:
            new_rules["date_window_days"] = 10
            proposed_changes.append("Extend heuristic date clearing window to 10 days.")
            diagnosis_summary = "Failures dominated by timing mismatches outside clearing window."

        elif primary_category == FailureCategory.FX_FAILURE:
            new_rules["enable_fx_tolerance_rule"] = True
            new_rules["max_fee_amount"] = 75.0
            proposed_changes.append("Activate currency FX variance tolerance rule with 75.0 USD margin.")
            diagnosis_summary = "Failures caused by exchange rate variance and currency conversion deltas."

        else:
            new_confidence = 0.90
            new_policy = "STRICT"
            new_rules["enable_fee_deduction_rule"] = True
            new_rules["enable_fx_tolerance_rule"] = True
            new_rules["escalate_on_duplicate"] = True
            proposed_changes.append("Upgrade agent to Multi-Tier RULE + FUZZY + LLM matching with strict duplicate escalation.")
            diagnosis_summary = f"Primary failure mode '{primary_category.value}' requires multi-tier pre-filtering and tightened duplicate guardrails."

        # Create Improved AgentSpec
        next_spec = AgentSpec(
            version=target_version,
            matching_strategy="MULTI_TIER_RULE_FUZZY_LLM",
            confidence_threshold=new_confidence,
            llm_enabled=True,
            verification_enabled=True,
            prompt_version="p3_optimized",
            escalation_policy=new_policy,
            matching_rules=new_rules
        )

        diagnosis_report = FailureDiagnosisReport(
            total_failures=total_failures,
            primary_failure_category=primary_category,
            category_counts=category_counts,
            diagnosis_summary=diagnosis_summary,
            detailed_discrepancies=failures[:5]
        )

        proposal = ImprovementProposal(
            target_version=target_version,
            problem_statement=f"Agent '{current_spec.version}' exhibited {total_failures} failures, primarily '{primary_category.value}'.",
            diagnosis=diagnosis_summary,
            proposed_changes=proposed_changes,
            new_agent_spec=next_spec
        )

        return diagnosis_report, proposal
