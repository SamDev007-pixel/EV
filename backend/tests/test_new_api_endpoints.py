import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_search_solve():
    payload = {
        "ev_id": "EV-TEST-SEARCH",
        "battery_percentage": 25.0,
        "battery_capacity_kwh": 60.0,
        "target_battery_percentage": 85.0,
        "departure_deadline_min": 90.0,
        "algorithm": "A*"
    }
    response = client.post("/api/search/solve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "input" in data
    assert "algorithm" in data
    assert "result" in data
    assert "metrics" in data
    assert "explanation" in data
    assert data["metrics"]["success"] is True


def test_api_search_compare():
    payload = {
        "ev_id": "EV-TEST-COMPARE",
        "battery_percentage": 20.0
    }
    response = client.post("/api/search/compare", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["result"], list)
    assert len(data["result"]) == 5  # BFS, DFS, UCS, GBFS, A*
    assert "explanation" in data


def test_api_csp_solve():
    payload = {
        "scenario_name": "NORMAL_DEMAND",
        "enable_forward_checking": True,
        "enable_ac3": True,
        "enable_mrv": True
    }
    response = client.post("/api/csp/solve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "input" in data
    assert "algorithm" in data
    assert "result" in data
    assert "metrics" in data
    assert "explanation" in data
    assert data["metrics"]["success"] is True


def test_api_logic_forward_chain():
    response = client.post("/api/logic/forward-chain", json={"sync_simulation": True})
    assert response.status_code == 200
    data = response.json()
    assert "input" in data
    assert "algorithm" in data
    assert "result" in data
    assert "metrics" in data
    assert "explanation" in data


def test_api_logic_backward_chain():
    payload = {
        "target_subject": "EV-01",
        "target_predicate": "charging_priority",
        "target_value": "STANDARD"
    }
    response = client.post("/api/logic/backward-chain", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "input" in data
    assert "algorithm" in data
    assert "result" in data
    assert "metrics" in data


def test_api_agents_decision():
    payload = {
        "agent_id": "AGENT-COORDINATOR",
        "tick": 1,
        "ev_id": "EV-TEST-AGENT",
        "ev_kwh_needed": 30.0,
        "ev_priority": "EMERGENCY"
    }
    response = client.post("/api/agents/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "input" in data
    assert "algorithm" in data
    assert "result" in data
    assert "metrics" in data
    assert "explanation" in data


def test_api_game_decision_nash():
    payload = {
        "game_type": "COOPERATIVE_NASH",
        "scenario_id": "SCENARIO_IMMEDIATE_VS_OVERLOAD",
        "grid_load_kw": 210.0,
        "transformer_limit_kw": 300.0,
        "ev_deadline_min": 60.0
    }
    response = client.post("/api/game/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "input" in data
    assert "algorithm" in data
    assert "result" in data
    assert "metrics" in data
    assert "explanation" in data


def test_api_game_decision_minimax():
    payload = {
        "game_type": "ADVERSARIAL_MINIMAX",
        "grid_load_kw": 180.0,
        "transformer_limit_kw": 300.0,
        "ev_deadline_min": 60.0,
        "depth": 3
    }
    response = client.post("/api/game/decision", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Minimax" in data["algorithm"]
    assert "minimax_value" in data["metrics"]


def test_api_pipeline_and_explanation():
    # 1. Run pipeline
    req_payload = {
        "ev_id": "EV-ENDPOINT-TEST",
        "battery_capacity_kwh": 60.0,
        "current_battery_kwh": 15.0,
        "target_battery_kwh": 50.0,
        "priority": "HIGH"
    }
    res_pipe = client.post("/api/pipeline/decide", json=req_payload)
    assert res_pipe.status_code == 200
    pipe_data = res_pipe.json()
    dec_id = pipe_data["decision_id"]
    assert dec_id.startswith("DEC-")

    # 2. Retrieve explanation via GET /api/explanation/{decision_id}
    res_exp = client.get(f"/api/explanation/{dec_id}")
    assert res_exp.status_code == 200
    exp_data = res_exp.json()
    assert exp_data["decision_id"] == dec_id
    assert exp_data["topic"] is not None

    # 3. List recent explanations via GET /api/explanation
    res_list = client.get("/api/explanation?limit=10")
    assert res_list.status_code == 200
    assert len(res_list.json()) > 0


def test_api_optimization_schedule():
    payload = {
        "algorithm": "SIMULATED_ANNEALING",
        "iterations": 200
    }
    response = client.post("/api/optimization/schedule", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "final_cost" in data["metrics"]
    assert data["metrics"]["final_cost"] <= data["metrics"]["initial_cost"]


def test_api_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    # The health payload describes the AI foundation in plain engineering terms; it must
    # not reference course units.
    assert "artificial intelligence" in data["ai_foundation"].lower()
    assert "unit" not in data["ai_foundation"].lower()


def test_api_problem_formulate():
    payload = {
        "ev_id": "EV-FORMULATE-TEST",
        "current_soc": 20.0,
        "target_soc": 80.0,
        "battery_capacity_kwh": 65.0,
        "priority": "HIGH",
        "departure_deadline_min": 90.0,
        "max_distance_km": 15.0
    }
    response = client.post("/api/problem/formulate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "formulation" in data and "tuple" in data
    assert len(data["tuple"]["action_space_A"]) > 0
    assert data["tuple"]["hard_constraints_count"] >= 3
    assert data["tuple"]["initial_state_s0"]["node_id"] is not None


def test_api_resolution_prove():
    payload = {
        "theorem_preset": "EMERGENCY_PREEMPTION"
    }
    response = client.post("/api/logic/resolution/prove", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["proved"] is True
    assert data["metrics"]["empty_clause_derived"] is True
    assert data["metrics"]["proof_steps_count"] > 0


