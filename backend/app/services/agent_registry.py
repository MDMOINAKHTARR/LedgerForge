import datetime
from typing import List, Dict, Optional
from backend.app.models.pydantic_models import AgentVersionSchema

V1_PROMPT = """You are a basic financial reconciliation assistant. Compare bank transactions with ledger candidates. If amount and reference match, report exact match. Otherwise flag as uncertain."""

V2_PROMPT = """You are an expert autonomous financial reconciliation agent. Analyze bank and ledger records considering timing lags (up to 7 days), intermediary wire/bank fees, currency FX variance, and vendor memo aliases. Apply domain knowledge to assign confidence scores accurately."""

V3_PROMPT = """You are a high-performance autonomous bank reconciliation agent. Utilize deterministic tier pre-filtering, fine-tuned confidence scoring, and zero-hallucination safety policies. Adhere to the core principle: KNOWS WHEN TO STOP AND ASK. Automatically reconcile high-confidence items while escalating edge cases with clear explanations."""

DEFAULT_AGENT_VERSIONS = [
    AgentVersionSchema(
        id="v1",
        version_name="Agent V1 (Baseline Prompt)",
        created_at="2026-09-05 10:00:00",
        system_prompt=V1_PROMPT,
        confidence_threshold=0.90,
        matching_rules={
            "enable_fee_deduction_rule": False,
            "enable_fx_tolerance_rule": False,
            "date_window_days": 3,
            "max_fee_amount": 0.0
        },
        is_active=False,
        accuracy_score=0.74,
        stp_rate=0.62,
        reliability_score=0.92,
        avg_cost_usd=0.00012,
        avg_latency_ms=18.5
    ),
    AgentVersionSchema(
        id="v2",
        version_name="Agent V2 (Few-Shot & FX/Fee Rules)",
        created_at="2026-09-05 12:00:00",
        system_prompt=V2_PROMPT,
        confidence_threshold=0.88,
        matching_rules={
            "enable_fee_deduction_rule": True,
            "enable_fx_tolerance_rule": True,
            "date_window_days": 7,
            "max_fee_amount": 50.0
        },
        is_active=False,
        accuracy_score=0.91,
        stp_rate=0.84,
        reliability_score=0.98,
        avg_cost_usd=0.00008,
        avg_latency_ms=12.2
    ),
    AgentVersionSchema(
        id="v3",
        version_name="Agent V3 (Optimized Cost & Multi-Tier)",
        created_at="2026-09-05 14:00:00",
        system_prompt=V3_PROMPT,
        confidence_threshold=0.85,
        matching_rules={
            "enable_fee_deduction_rule": True,
            "enable_fx_tolerance_rule": True,
            "date_window_days": 10,
            "max_fee_amount": 75.0,
            "tier1_exact_prefilter": True,
            "compact_prompt_mode": True
        },
        is_active=True,
        accuracy_score=0.98,
        stp_rate=0.94,
        reliability_score=1.00,
        avg_cost_usd=0.00004,
        avg_latency_ms=6.8
    )
]

_REGISTERED_VERSIONS: Dict[str, AgentVersionSchema] = {
    v.id: v for v in DEFAULT_AGENT_VERSIONS
}

class AgentRegistry:
    @staticmethod
    def get_all_versions() -> List[AgentVersionSchema]:
        return list(_REGISTERED_VERSIONS.values())

    @staticmethod
    def get_version_by_id(version_id: str) -> AgentVersionSchema:
        if version_id in _REGISTERED_VERSIONS:
            return _REGISTERED_VERSIONS[version_id]
        return DEFAULT_AGENT_VERSIONS[0]

    @staticmethod
    def register_version(version: AgentVersionSchema) -> None:
        _REGISTERED_VERSIONS[version.id] = version

    @staticmethod
    def set_active_version(version_id: str) -> None:
        for vid, v in _REGISTERED_VERSIONS.items():
            if vid == version_id:
                _REGISTERED_VERSIONS[vid] = v.model_copy(update={"is_active": True})
            else:
                _REGISTERED_VERSIONS[vid] = v.model_copy(update={"is_active": False})

    @staticmethod
    def get_active_version() -> AgentVersionSchema:
        for v in _REGISTERED_VERSIONS.values():
            if v.is_active:
                return v
        return DEFAULT_AGENT_VERSIONS[-1]

