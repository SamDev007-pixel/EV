import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_search_and_or_plan():
    response = client.post("/api/search/and-or-plan", json={"initial_state": "LOW_BATTERY_ORIGIN"})
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["success"] is True
    assert data["metrics"]["contingency_branches"] >= 2
    assert "readable_plan" in data


def test_api_search_belief_state():
    response = client.post("/api/search/belief-state", json={"with_observation": True})
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["goal_reached"] is True
    assert data["metrics"]["initial_belief_size"] == 3
    assert len(data["result"]["plan_actions"]) > 0


def test_api_search_lrta_step():
    response = client.post("/api/search/lrta-step", json={
        "start_node": "J_NORTH",
        "goal_node": "STATION_DC_FAST",
        "max_steps": 20
    })
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["goal_reached"] is True
    assert data["metrics"]["total_steps"] > 0
    assert "final_heuristic_table" in data["result"]


def test_api_game_slot_competition():
    response = client.post("/api/game/slot-competition", json={"max_rounds": 2})
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["nodes_evaluated"] > 0
    assert "minimax_utility" in data["metrics"]
    assert data["result"]["ev1_optimal_action"]["target_resource"] == "FAST_BAY"


def test_api_logic_resolution_prove():
    response = client.post("/api/logic/resolution-prove", json={"theorem_preset": "EMERGENCY_PREEMPTION"})
    assert response.status_code == 200
    data = response.json()
    assert data["metrics"]["proved"] is True
    assert data["metrics"]["empty_clause_derived"] is True
    assert len(data["result"]["proof_steps"]) > 0
