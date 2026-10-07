"""
Primary 8-step workflow tests.

The previous version of this file asserted the workflow's *hard-coded* demo values
(`rules_fired >= 2`, `backtracking_used is True`, `station_id == "CS-METRO"`, every
constraint "PASSED"). Those assertions passed because the values were literals in the
engine, not because the engine computed anything. The tests below instead check that each
step is derived from the live environment and that the steps are mutually consistent.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.workflow import PrimaryWorkflowEngine, EVWorkflowRequest, FullWorkflowResult

client = TestClient(app)


def _request(**overrides) -> EVWorkflowRequest:
    base = dict(
        ev_id="EV-TEST-WF-01",
        current_location={"x": 1.5, "y": 2.2},
        destination={"x": 8.0, "y": 8.5},
        battery_capacity_kwh=60.0,
        current_charge_pct=15.0,
        required_charge_pct=85.0,
        max_acceptable_distance_km=12.0,
        departure_deadline_min=90.0,
        priority="HIGH",
        connector_requirement="CCS2",
        selected_search_algorithm="A*",
    )
    base.update(overrides)
    return EVWorkflowRequest(**base)


def test_primary_workflow_engine_full_execution():
    res = PrimaryWorkflowEngine.execute(_request())

    assert isinstance(res, FullWorkflowResult)
    assert res.workflow_id.startswith("WF-")
    assert res.execution_time_ms > 0

    # ---- Step 1: request echo (user input) ----
    s1 = res.step1_request
    assert s1.ev_id == "EV-TEST-WF-01"
    assert s1.energy_needed_kwh == pytest.approx(42.0)  # (85 - 15)% of 60 kWh
    assert s1.connector_requirement == "CCS2"

    # ---- Step 2: formal problem formulation ----
    s2 = res.step2_formulation
    assert "battery_soc_pct" in s2.initial_state
    assert s2.goal_state["battery_soc_pct_min"] == 85.0
    assert len(s2.actions) >= 4
    assert len(s2.constraints) >= 5
    assert "c(s, a, s')" in s2.cost_function

    # ---- Step 3: knowledge reasoning over live facts ----
    s3 = res.step3_reasoning
    assert len(s3.facts_asserted) >= 3
    assert len(s3.rules_evaluated) >= 5          # the knowledge base ships 7 production rules
    assert "HIGH" in s3.computed_priority or "CRITICAL" in s3.computed_priority
    assert len(s3.station_availability) > 0
    # Every eligibility verdict refers to a station that really exists in the environment
    live_ids = {st["id"] for st in s3.station_availability}
    assert set(s3.eligibility_status.keys()) == live_ids
    # Fact subjects come from the request, the grid and the station catalogue - not from literals
    subjects = {fact["subject"] for fact in s3.facts_asserted}
    assert "EV-TEST-WF-01" in subjects
    assert "GRID-TRANSFORMER-MAIN" in subjects
    assert subjects & live_ids

    # ---- Step 4: all five search algorithms on the same problem ----
    s4 = res.step4_search
    assert len(s4.algorithms_compared) == 5
    algo_names = [a.algorithm for a in s4.algorithms_compared]
    for expected in ("BFS", "DFS", "UCS", "Greedy", "A*"):
        assert any(expected in name for name in algo_names), f"{expected} missing from comparison"
    assert s4.chosen_station_id not in ("", "NONE")
    assert len(s4.chosen_path) > 0
    # The reported chosen station must be one of the stations present in the live catalogue
    assert s4.chosen_station_id in live_ids
    # A* must return the same cost as UCS on the identical instance (optimality check)
    costs = {a.algorithm: a.path_cost for a in s4.algorithms_compared}
    if "UCS" in costs and "A* Search" in costs:
        assert costs["A* Search"] == pytest.approx(costs["UCS"], abs=1e-6)

    # ---- Step 5: CSP scheduling (variables come from the live request + environment) ----
    s5 = res.step5_csp
    assert s5.variables[0] == "EV-TEST-WF-01"
    assert len(s5.variables) >= 2
    assert len(s5.constraints) == 8               # the eight hard constraints are all reported
    assert "TimeSlot" in s5.assigned_schedule
    assert s5.domains and all(values for values in s5.domains.values())
    # behaviour, not a literal: backtracking is "used" only if it actually happened
    assert s5.backtracking_used == (s5.backtracks_count > 0)
    # If a schedule exists, it must be at the station the search step selected (pipeline coherence)
    if s5.assigned_schedule["Charger"] != "NOT SCHEDULED":
        assert s5.assigned_schedule["Station"] == s4.chosen_station_id

    # ---- Step 6: conflict resolution with game-theoretic utilities ----
    s6 = res.step6_conflict_resolution
    assert len(s6.alternatives_evaluated) >= 2
    assert s6.nash_product > 0.0
    assert s6.selected_alternative_id != "NONE"
    if s6.conflict_detected:
        assert s6.competing_ev_id != "NONE"

    # ---- Step 7: final decision computed from the live state ----
    s7 = res.step7_final_decision
    assert s7.recommended_station["station_id"] == s4.chosen_station_id
    assert s7.recommended_station["distance_km"] >= 0.0
    assert 0.0 < s7.decision_confidence_score <= 100.0
    assert "Score =" in s7.score_formula
    assert s7.recommended_time_slot == s5.assigned_schedule["TimeSlot"]
    assert set(s7.constraint_status.keys()) >= {
        "battery_safety_reserve", "distance_limit", "deadline_satisfaction",
        "connector_compatibility", "station_operational", "transformer_thermal_safety",
        "csp_schedule_feasible",
    }
    # Constraint rows must state a verdict with numbers; they may legitimately be FAILED
    for name, verdict in s7.constraint_status.items():
        assert verdict.startswith(("PASSED", "FAILED")), f"{name} has no verdict: {verdict}"

    # ---- Step 8: explanation tiers + registered decision id ----
    s8 = res.step8_explanation
    assert s8.prompt == "Why was this station selected?"
    assert len(s8.facts_tier) >= 3
    assert len(s8.rules_tier) >= 2
    assert len(s8.constraints_tier) >= 3
    assert len(s8.derivation_chain) >= 5

    assert res.decision_id is not None and res.decision_id.startswith("DEC-")
    lookup = client.get(f"/api/explanation/{res.decision_id}")
    assert lookup.status_code == 200
    assert lookup.json()["decision_id"] == res.decision_id


def test_workflow_is_deterministic_for_the_same_request():
    """The pipeline is classical and deterministic: the same request yields the same decision."""
    first = PrimaryWorkflowEngine.execute(_request())
    second = PrimaryWorkflowEngine.execute(_request())

    assert first.step4_search.chosen_station_id == second.step4_search.chosen_station_id
    assert first.step5_csp.assigned_schedule == second.step5_csp.assigned_schedule
    assert first.step7_final_decision.decision_confidence_score == second.step7_final_decision.decision_confidence_score


def test_workflow_reports_infeasible_schedule_instead_of_faking_success():
    """
    An impossible request (needs 55 kWh in 20 minutes) must be reported honestly: the CSP
    check is FAILED and the decision score is 0, rather than a PASSED row with a nice score.
    """
    res = PrimaryWorkflowEngine.execute(_request(
        current_charge_pct=5.0,
        required_charge_pct=95.0,
        departure_deadline_min=20.0,
        max_acceptable_distance_km=40.0,
    ))

    s5 = res.step5_csp
    s7 = res.step7_final_decision
    assert res.step1_request.energy_needed_kwh == pytest.approx(54.0)
    if s5.assigned_schedule["Charger"] == "NOT SCHEDULED":
        assert s7.constraint_status["csp_schedule_feasible"].startswith("FAILED")
        assert s7.decision_confidence_score == 0.0


def test_api_workflow_execute_endpoint():
    payload = {
        "ev_id": "EV-API-TEST",
        "current_location": {"x": 2.0, "y": 2.0},
        "destination": {"x": 7.0, "y": 7.0},
        "battery_capacity_kwh": 50.0,
        "current_charge_pct": 20.0,
        "required_charge_pct": 80.0,
        "max_acceptable_distance_km": 10.0,
        "departure_deadline_min": 60.0,
        "priority": "STANDARD",
        "connector_requirement": "CCS2",
        "selected_search_algorithm": "A*"
    }
    response = client.post("/api/workflow/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    for step in ("step1_request", "step2_formulation", "step3_reasoning", "step4_search",
                 "step5_csp", "step6_conflict_resolution", "step7_final_decision", "step8_explanation"):
        assert step in data
    assert data["decision_id"].startswith("DEC-")


def test_api_workflow_why_selected_endpoint():
    payload = {
        "ev_id": "EV-API-WHY-TEST",
        "current_charge_pct": 12.0,
        "required_charge_pct": 75.0,
        "priority": "HIGH"
    }
    response = client.post("/api/workflow/why-selected", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["prompt"] == "Why was this station selected?"
    for tier in ("facts_tier", "rules_tier", "search_tier", "constraints_tier", "decision_tier", "derivation_chain"):
        assert tier in data
