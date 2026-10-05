import pytest
from app.core.pipeline import UnifiedAIDecisionPipeline, DecisionPipelineRequest, DecisionPipelineResult
from app.explanation.service import explanation_registry


def test_pipeline_execution():
    req = DecisionPipelineRequest(
        ev_id="EV-TEST-PIPE",
        battery_capacity_kwh=60.0,
        current_battery_kwh=10.0,
        target_battery_kwh=50.0,
        departure_deadline_min=100.0,
        current_location={"x": 2.0, "y": 3.0},
        destination_location={"x": 8.0, "y": 9.0},
        priority="HIGH",
        search_algorithm="A*",
        enable_csp_check=True,
        enable_game_theory=True,
        enable_dpll_verification=True
    )

    res = UnifiedAIDecisionPipeline.execute(req)

    assert isinstance(res, DecisionPipelineResult)
    assert res.decision_id.startswith("DEC-")
    assert len(res.algorithm_steps) >= 5
    assert "selected_station_id" in res.result
    assert "metrics" in res.model_dump()
    assert res.metrics.get("dpll_sat_verified") is True
    assert res.explanation.get("summary") is not None
    assert len(res.explanation.get("derivation_trace", [])) >= 4


def test_explanation_registry_lookup():
    req = DecisionPipelineRequest(
        ev_id="EV-TEST-REGISTRY",
        priority="EMERGENCY"
    )
    res = UnifiedAIDecisionPipeline.execute(req)
    dec_id = res.decision_id

    # Verify lookup in registry
    record = explanation_registry.get(dec_id)
    assert record is not None
    assert record.decision_id == dec_id
    assert record.input_data.get("ev_id") == "EV-TEST-REGISTRY"
    assert "EMERGENCY" in str(record.selected_decision)

    # Verify listing
    recent = explanation_registry.list_recent(limit=10)
    assert len(recent) > 0
    assert any(r.decision_id == dec_id for r in recent)
