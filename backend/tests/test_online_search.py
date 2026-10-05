import pytest
from app.search.online_search import LRTAStarAgent, OnlineRoadNetwork, OnlineSearchResult


def test_lrta_star_reaches_goal():
    """Verify that LRTA* online agent navigates from origin to charging destination."""
    agent = LRTAStarAgent()
    result = agent.run_online_search(start_node="J_NORTH", goal_node="STATION_DC_FAST", max_steps=20)

    assert isinstance(result, OnlineSearchResult)
    assert result.goal_reached is True
    assert result.path_traversed[0] == "J_NORTH"
    assert result.path_traversed[-1] == "STATION_DC_FAST"
    assert result.total_travel_cost > 0.0
    assert result.total_steps > 0


def test_lrta_star_updates_heuristics_online():
    """Verify that LRTA* updates its heuristic table H(s) upon encountering delays."""
    network = OnlineRoadNetwork()
    initial_h = dict(network.initial_heuristics)
    agent = LRTAStarAgent(network)

    result = agent.run_online_search(start_node="J_NORTH", goal_node="STATION_DC_FAST")
    assert result.heuristic_updates_count > 0

    # At least one heuristic value in H must have increased due to real delay
    increased = any(result.final_heuristic_table[k] > initial_h[k] for k in initial_h)
    assert increased is True


def test_lrta_star_immediate_goal():
    """Verify base case when start node is already goal node."""
    agent = LRTAStarAgent()
    result = agent.run_online_search(start_node="STATION_DC_FAST", goal_node="STATION_DC_FAST")

    assert result.goal_reached is True
    assert result.total_steps == 0
    assert result.total_travel_cost == 0.0
