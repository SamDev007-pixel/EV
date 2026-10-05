import pytest
from app.search.graph import ChargingNetworkGraph, GraphNode, GraphEdge, NodeType
from app.search.problem import EVRouteSearchProblem
from app.search.heuristics import domain_specific_station_heuristic, euclidean_distance_heuristic
from app.search.algorithms import (
    breadth_first_search,
    depth_first_search,
    uniform_cost_search,
    greedy_best_first_search,
    a_star_search
)
from app.search.station_selector import StationSelectorEngine, EVScenario


@pytest.fixture
def sample_network():
    return ChargingNetworkGraph.create_default_network()


def test_bfs_search(sample_network):
    problem = EVRouteSearchProblem(
        graph=sample_network,
        origin_node_id="WAYPOINT-NORTH",
        goal_node_id="CS-METRO",
        initial_battery_kwh=5.0,  # Needs charging
        required_battery_kwh=40.0
    )
    result = breadth_first_search(problem)

    assert result.success is True
    assert result.algorithm == "BFS"
    assert len(result.path) > 0
    assert result.nodes_explored > 0
    assert result.selected_station is not None


def test_dfs_search(sample_network):
    problem = EVRouteSearchProblem(
        graph=sample_network,
        origin_node_id="WAYPOINT-NORTH",
        goal_node_id="CS-METRO",
        initial_battery_kwh=5.0,
        required_battery_kwh=40.0
    )
    result = depth_first_search(problem)

    assert result.success is True
    assert result.algorithm == "DFS"
    assert len(result.path) > 0
    assert result.nodes_explored > 0


def test_ucs_search(sample_network):
    problem = EVRouteSearchProblem(
        graph=sample_network,
        origin_node_id="WAYPOINT-NORTH",
        goal_node_id="CS-METRO",
        initial_battery_kwh=5.0,
        required_battery_kwh=40.0
    )
    result = uniform_cost_search(problem)

    assert result.success is True
    assert result.algorithm == "UCS"
    assert result.path_cost > 0.0
    assert result.selected_station is not None


def test_gbfs_search(sample_network):
    problem = EVRouteSearchProblem(
        graph=sample_network,
        origin_node_id="WAYPOINT-NORTH",
        goal_node_id="CS-METRO",
        initial_battery_kwh=5.0,
        required_battery_kwh=40.0
    )
    result = greedy_best_first_search(problem, domain_specific_station_heuristic)

    assert result.success is True
    assert result.algorithm == "Greedy Best-First"
    assert len(result.path) > 0


def test_astar_search(sample_network):
    problem = EVRouteSearchProblem(
        graph=sample_network,
        origin_node_id="WAYPOINT-NORTH",
        goal_node_id="CS-METRO",
        initial_battery_kwh=5.0,
        required_battery_kwh=40.0
    )
    result = a_star_search(problem, domain_specific_station_heuristic)

    assert result.success is True
    assert result.algorithm == "A* Search"
    assert result.path_cost > 0.0
    assert result.selected_station is not None


def test_heuristic_admissibility(sample_network):
    problem = EVRouteSearchProblem(
        graph=sample_network,
        origin_node_id="WAYPOINT-NORTH",
        goal_node_id="CS-METRO",
        initial_battery_kwh=5.0,
        required_battery_kwh=40.0
    )
    state = problem.get_initial_state()
    
    # Calculate heuristic estimate
    h_val = euclidean_distance_heuristic(state, problem)
    
    # Calculate actual optimal path cost via UCS
    ucs_res = uniform_cost_search(problem)
    
    assert ucs_res.success is True
    # Admissibility condition: h(n) <= h*(n)
    assert h_val <= ucs_res.path_cost, f"Heuristic overestimate: h({h_val}) > actual cost({ucs_res.path_cost})"


def test_candidate_station_comparison_ev07():
    """
    Tests station selection trade-off evaluation for EV-07 scenario:
    EV-07: Battery = 15%, Destination = Dest, Deadline = 90 min.
    Station A: 2 km, 8 waiting cars.
    Station B: 4 km, 1 waiting car.
    Station C: 6 km, 0 waiting cars.
    """
    engine = StationSelectorEngine()

    scenario = EVScenario(
        ev_id="EV-07",
        battery_percentage=15.0,
        battery_capacity_kwh=60.0,
        target_battery_percentage=80.0,
        departure_deadline_min=90.0,
        current_location={"x": 0.0, "y": 0.0},
        destination_location={"x": 10.0, "y": 10.0}
    )

    eval_result = engine.compare_candidate_stations(scenario)

    assert eval_result["recommended_station_name"] != "None"
    assert len(eval_result["candidate_evaluations"]) >= 3
    assert "explanation_summary" in eval_result
    assert len(eval_result["explanation_summary"]) > 0

    # Ensure recommended station has explanation
    rec = next(e for e in eval_result["candidate_evaluations"] if e["is_recommended"])
    assert rec["deadline_met"] is True


def test_algorithm_comparison_suite():
    engine = StationSelectorEngine()
    scenario = EVScenario(ev_id="EV-TEST")

    comp_result = engine.run_algorithm_comparison(scenario)

    assert "comparison_matrix" in comp_result
    assert len(comp_result["comparison_matrix"]) == 5  # BFS, DFS, UCS, GBFS, A*
    
    algos = [r["algorithm"] for r in comp_result["comparison_matrix"]]
    assert "BFS" in algos
    assert "DFS" in algos
    assert "UCS" in algos
    assert "Greedy Best-First" in algos
    assert "A* Search" in algos
