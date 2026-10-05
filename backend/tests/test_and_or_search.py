import pytest
from app.search.and_or_search import AndOrSearchEngine, NondeterministicEVProblem, AndOrSearchResult


def test_and_or_search_contingency_success():
    """Verify that AND-OR search finds a complete contingency plan reaching goal under all outcomes."""
    problem = NondeterministicEVProblem(initial_state="LOW_BATTERY_ORIGIN")
    engine = AndOrSearchEngine()
    result = engine.search(problem)

    assert isinstance(result, AndOrSearchResult)
    assert result.success is True
    assert result.nodes_expanded > 0
    assert result.contingency_branches >= 2
    assert result.plan is not None
    assert result.plan["action"] == "TRAVEL_CS_CENTRAL"
    assert "CENTRAL_OPERATIONAL" in result.plan["branches"]
    assert "CENTRAL_HARDWARE_FAULT" in result.plan["branches"]
    assert "CENTRAL_QUEUE_FULL" in result.plan["branches"]
    assert len(result.readable_plan) > 50


def test_and_or_search_goal_already_met():
    """Verify base case when initial state is already a goal state."""
    problem = NondeterministicEVProblem(initial_state="CHARGING_COMPLETED")
    engine = AndOrSearchEngine()
    result = engine.search(problem)

    assert result.success is True
    assert result.plan["is_goal"] is True
    assert result.plan["action"] is None


def test_and_or_search_dead_end_failure():
    """Verify that if an outcome leads to a dead end with no actions, AND-branch fails."""
    # Problem where state TRAP has no actions and is not a goal
    transitions = {
        "START": {
            "ACT_RISKY": [("SAFE_NODE", "OUTCOME_GOOD"), ("TRAP", "OUTCOME_BAD")]
        },
        "SAFE_NODE": {
            "PLUG": [("GOAL", "DONE")]
        },
        "TRAP": {},
        "GOAL": {}
    }
    problem = NondeterministicEVProblem(initial_state="START", goal_states={"GOAL"}, transitions=transitions)
    engine = AndOrSearchEngine()
    result = engine.search(problem)

    assert result.success is False
    assert result.plan is None
