import pytest
from app.game_theory.utility_models import (
    EVAgentUtility,
    StationAgentUtility,
    GridAgentUtility,
    EnergyAgentUtility
)
from app.game_theory.negotiation import NegotiationEngine
from app.game_theory.scenarios import get_preset_game_theory_scenario


def test_ev_utility_model():
    # 0 wait time, within budget & deadline
    ub1 = EVAgentUtility.evaluate(start_time_min=0, duration_min=30, charging_cost_usd=5.0, ev_deadline_min=120)
    assert ub1.utility_score > 80.0

    # Deadline breached
    ub2 = EVAgentUtility.evaluate(start_time_min=100, duration_min=30, charging_cost_usd=5.0, ev_deadline_min=120)
    assert ub2.utility_score == 0.0
    assert "Deadline of 120m breached" in ub2.explanation


def test_grid_utility_model():
    # Safe load: current 200 kW + requested 50 kW = 250 kW < limit 300 kW
    ub1 = GridAgentUtility.evaluate(requested_power_kw=50.0, current_grid_load_kw=200.0, transformer_capacity_kw=300.0)
    assert ub1.utility_score > 0.0

    # Transformer overload: current 200 kW + requested 150 kW = 350 kW > limit 300 kW
    ub2 = GridAgentUtility.evaluate(requested_power_kw=150.0, current_grid_load_kw=200.0, transformer_capacity_kw=300.0)
    assert ub2.utility_score == 0.0
    assert "Transformer overload" in ub2.explanation


def test_conflict_resolution_immediate_vs_overload():
    """
    Tests the problem statement benchmark example:
    EV Agent: Wants immediate charging (150 kW).
    Grid Agent: Charging now at 150 kW exceeds 300 kW transformer limit (200 + 150 = 350 kW > 300 kW limit).
    Station Agent: Charger available.
    Energy Agent: Low-cost energy unavailable.
    Coordinator must reject ALT-1 (immediate 150 kW) and select a safe compromise (ALT-2 throttled 75 kW).
    """
    sc_data = get_preset_game_theory_scenario("SCENARIO_IMMEDIATE_VS_OVERLOAD")
    engine = NegotiationEngine()

    res = engine.resolve_conflict(
        scenario_name=sc_data["scenario_id"],
        custom_alternatives=sc_data["custom_alternatives"],
        grid_load_kw=sc_data["grid_load_kw"],
        transformer_limit_kw=sc_data["transformer_limit_kw"],
        ev_deadline_min=sc_data["ev_deadline_min"]
    )

    assert res.chosen_action["id"] != "ALT-1"  # Immediate 150 kW MUST be rejected!
    assert res.chosen_action["id"] in ["ALT-2", "ALT-3"]  # Safe compromise selected

    # Verify ALT-1 is in rejected alternatives with explanation
    alt1_rej = next((r for r in res.rejected_alternatives if r["alternative_id"] == "ALT-1"), None)
    assert alt1_rej is not None
    assert "Transformer overload" in alt1_rej["rejection_reason"] or "Hard constraint violation" in alt1_rej["rejection_reason"]

    # Verify decision trace has all 7 steps
    assert len(res.decision_trace) == 7
    step_names = [s["phase_name"] for s in [st.model_dump() for st in res.decision_trace]]
    assert "RECEIVE_COMPETING_PREFERENCES" in step_names
    assert "GENERATE_FEASIBLE_ALTERNATIVES" in step_names
    assert "EVALUATE_UTILITIES" in step_names
    assert "IDENTIFY_CONFLICTS" in step_names
    assert "NEGOTIATE_AND_RANK" in step_names
    assert "SELECT_FEASIBLE_COMPROMISE" in step_names
    assert "PRODUCE_EXPLANATION" in step_names


def test_scenario_renewable_vs_wait():
    sc_data = get_preset_game_theory_scenario("SCENARIO_RENEWABLE_VS_WAIT")
    engine = NegotiationEngine()

    res = engine.resolve_conflict(
        scenario_name=sc_data["scenario_id"],
        custom_alternatives=sc_data["custom_alternatives"],
        grid_load_kw=sc_data["grid_load_kw"],
        transformer_limit_kw=sc_data["transformer_limit_kw"],
        ev_deadline_min=sc_data["ev_deadline_min"]
    )

    assert res.chosen_action is not None
    assert len(res.evaluations_matrix) >= 4
    assert res.execution_time_ms >= 0.0
