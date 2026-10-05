import pytest
from app.search.belief_search import (
    BeliefStateSearchEngine,
    PartiallyObservableEVProblem,
    PhysicalState,
    BeliefSearchResult
)


def test_initial_belief_state_contains_uncertainty():
    """Verify that initially the agent maintains multiple possible physical world states."""
    prob = PartiallyObservableEVProblem()
    b0 = prob.get_initial_belief_state()
    assert len(b0) == 3
    assert not prob.is_goal_belief(b0)


def test_predict_and_update_with_sensor_percept():
    """Verify that sensory observation collapses belief uncertainty."""
    prob = PartiallyObservableEVProblem()
    b0 = prob.get_initial_belief_state()

    # Sensing Station A returns AVAILABLE
    b1 = prob.predict_and_update(b0, "PING_STATUS_A", observed_percept="SENSOR_A_AVAILABLE")
    # Should eliminate states where Station A was OCCUPIED
    assert len(b1) < len(b0)
    for state_key in b1:
        st = prob.parse_state_key(state_key)
        assert st.station_a_status == "AVAILABLE"


def test_belief_state_search_resolution():
    """Verify full belief search execution reaching guaranteed charging goal."""
    res = BeliefStateSearchEngine.solve_conformant_or_conditional()
    assert isinstance(res, BeliefSearchResult)
    assert res.goal_reached is True
    assert len(res.plan_actions) > 0
    assert "CONNECT_CHARGER" in res.plan_actions[-1]
    assert len(res.belief_trace) >= 3
    assert res.nodes_explored > 0
