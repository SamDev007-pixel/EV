import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.workflow import PrimaryWorkflowEngine, EVWorkflowRequest, FullWorkflowResult

client = TestClient(app)


def test_primary_workflow_engine_full_execution():
    """Verify that PrimaryWorkflowEngine executes all 8 sequential steps without failure."""
    req = EVWorkflowRequest(
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
        selected_search_algorithm="A*"
    )
    res = PrimaryWorkflowEngine.execute(req)

    assert isinstance(res, FullWorkflowResult)
    assert res.workflow_id.startswith("WF-")
    assert res.execution_time_ms > 0

    # Step 1 Check
    s1 = res.step1_request
    assert s1.ev_id == "EV-TEST-WF-01"
    assert s1.energy_needed_kwh == 42.0  # (85 - 15)% of 60 = 42 kWh
    assert s1.connector_requirement == "CCS2"

    # Step 2 Check
    s2 = res.step2_formulation
    assert "battery_soc_pct" in s2.initial_state
    assert s2.goal_state["battery_soc_pct_min"] == 85.0
    assert len(s2.actions) >= 4
    assert len(s2.constraints) >= 5
    assert "c(s, a, s')" in s2.cost_function

    # Step 3 Check
    s3 = res.step3_reasoning
    assert len(s3.facts_asserted) >= 3
    assert len(s3.rules_evaluated) >= 4
    assert len(s3.rules_fired) >= 2
    assert "HIGH" in s3.computed_priority or "CRITICAL" in s3.computed_priority
    assert s3.eligibility_status.get("CS-METRO") is True

    # Step 4 Check
    s4 = res.step4_search
    assert len(s4.algorithms_compared) == 5
    algo_names = [a.algorithm for a in s4.algorithms_compared]
    assert any("BFS" in a or "Breadth" in a for a in algo_names)
    assert any("DFS" in a or "Depth" in a for a in algo_names)
    assert any("UCS" in a or "Uniform" in a for a in algo_names)
    assert any("Greedy" in a for a in algo_names)
    assert any("A*" in a for a in algo_names)
    assert s4.chosen_station_id is not None
    assert len(s4.chosen_path) > 0

    # Step 5 Check
    s5 = res.step5_csp
    assert len(s5.variables) >= 2
    assert len(s5.constraints) >= 3
    assert s5.backtracking_used is True
    assert "TimeSlot" in s5.assigned_schedule

    # Step 6 Check
    s6 = res.step6_conflict_resolution
    assert s6.conflict_detected is True
    assert s6.nash_product > 0.0
    assert s6.is_pareto_efficient is True
    assert len(s6.alternatives_evaluated) >= 2

    # Step 7 Check
    s7 = res.step7_final_decision
    assert s7.recommended_station["station_id"] == "CS-METRO"
    assert s7.decision_confidence_score > 0.0
    assert s7.decision_confidence_score <= 100.0
    assert "Score =" in s7.score_formula
    assert all("PASSED" in v for v in s7.constraint_status.values())

    # Step 8 Check
    s8 = res.step8_explanation
    assert s8.prompt == "Why was this station selected?"
    assert len(s8.facts_tier) >= 3
    assert len(s8.rules_tier) >= 2
    assert len(s8.constraints_tier) >= 3
    assert len(s8.derivation_chain) >= 5


def test_api_workflow_execute_endpoint():
    """Verify POST /api/workflow/execute returns the full 8-step response."""
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
    assert "step1_request" in data
    assert "step2_formulation" in data
    assert "step3_reasoning" in data
    assert "step4_search" in data
    assert "step5_csp" in data
    assert "step6_conflict_resolution" in data
    assert "step7_final_decision" in data
    assert "step8_explanation" in data


def test_api_workflow_why_selected_endpoint():
    """Verify POST /api/workflow/why-selected returns the Step 8 drilldown."""
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
    assert "facts_tier" in data
    assert "rules_tier" in data
    assert "search_tier" in data
    assert "constraints_tier" in data
    assert "decision_tier" in data
    assert "derivation_chain" in data
