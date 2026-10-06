"""
Regression tests for issues found during the technical audit.

Each test here corresponds to a defect that was reproduced first and then fixed:

1. `SearchState.state_key()` ignored battery/time, so DFS could not find solutions that
   provably exist and UCS/A* optimality was not guaranteed.
2. The CSP solver reported empty instrumentation (no AC-3 statistics, no backtracking
   trace, no MRV log) and silently ignored the `enable_lcv` toggle.
3. Station tariffs quoted in INR were summed into a USD cost field.
4. The evaluation benchmark reported hard-coded numbers (covered in test_evaluation.py).
5. The published API surface did not match the frontend (missing DPLL path alias,
   duplicate /search/network route, no PEAS endpoint).
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.search.station_selector import EVScenario, StationSelectorEngine
from app.csp.scenarios import get_preset_csp_scenario
from app.csp.solver import CSPSolver
from app.services.custom_station_dataset import INDIAN_USER_STATIONS, price_in_usd
from app.simulation.engine import SimulationEngine

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. Search soundness
# ---------------------------------------------------------------------------

def _scenario(**overrides) -> EVScenario:
    base = dict(
        ev_id="EV-REG",
        battery_percentage=15.0,
        target_battery_percentage=80.0,
        battery_capacity_kwh=60.0,
        departure_deadline_min=120.0,
        current_location={"x": 1.2, "y": 1.0},
        destination_location={"x": 9.5, "y": 9.0},
    )
    base.update(overrides)
    return EVScenario(**base)


def test_dfs_finds_a_solution_when_one_exists():
    """
    Regression: with the collapsed state key, DFS returned success=False on every one of
    40 sampled instances while UCS succeeded on all of them.
    """
    engine = StationSelectorEngine()
    result = {r["algorithm"]: r for r in engine.run_algorithm_comparison(_scenario())["comparison_matrix"]}

    assert result["UCS"]["success"] is True
    assert result["DFS"]["success"] is True, "DFS failed on an instance that UCS solves"


def test_astar_is_optimal_against_ucs_across_instances():
    """A* (domain heuristic) must return the same path cost as UCS on every sampled instance."""
    engine = StationSelectorEngine()
    offsets = [(0, 0), (0.7, -0.4), (-0.9, 0.6), (1.1, 1.3), (-1.2, -0.8)]
    for dx, dy in offsets:
        scenario = _scenario(
            current_location={"x": 1.2 + dx, "y": 1.0 + dy},
            destination_location={"x": 9.5 - dx, "y": 9.0 - dy},
        )
        matrix = {r["algorithm"]: r for r in engine.run_algorithm_comparison(scenario)["comparison_matrix"]}
        if not (matrix["UCS"]["success"] and matrix["A* Search"]["success"]):
            continue
        assert matrix["A* Search"]["path_cost"] == pytest.approx(matrix["UCS"]["path_cost"], abs=1e-6), (
            f"A* deviated from the UCS optimum for offset {(dx, dy)}"
        )


def test_heuristic_effect_is_measured_for_each_informed_search():
    """
    Measured behaviour of the informed searches on the reference instance (values change with
    the scenario, so the assertions are about relationships, not about fixed node counts):

    - A* returns the same optimal cost as UCS while expanding far fewer nodes thanks to h(n).
    - Greedy best-first expands the fewest nodes but returns a *more expensive* path, i.e. it is
      fast because it is not optimal. Both facts are read from the algorithm results.
    """
    engine = StationSelectorEngine()
    matrix = {r["algorithm"]: r for r in engine.run_algorithm_comparison(_scenario())["comparison_matrix"]}

    astar, ucs, gbfs = matrix["A* Search"], matrix["UCS"], matrix["Greedy Best-First"]

    assert astar["path_cost"] == pytest.approx(ucs["path_cost"], abs=1e-6)
    assert astar["nodes_explored"] < ucs["nodes_explored"], "A* did not benefit from the heuristic"

    if gbfs["success"] and ucs["success"]:
        assert gbfs["nodes_explored"] <= astar["nodes_explored"]


def test_state_key_distinguishes_battery_levels():
    """A state reached with an empty battery must not be identical to one reached with charge."""
    from app.search.problem import SearchState

    low = SearchState(node_id="CS-NORTH", current_time_min=10.0, current_battery_kwh=2.0, station_visited="CS-NORTH")
    high = SearchState(node_id="CS-NORTH", current_time_min=10.0, current_battery_kwh=40.0, station_visited="CS-NORTH")

    assert low.state_key() != high.state_key()


# ---------------------------------------------------------------------------
# 2. CSP instrumentation, heuristics and toggles
# ---------------------------------------------------------------------------

def test_csp_reports_real_domain_and_mrv_instrumentation():
    problem = get_preset_csp_scenario("CHARGER_SHORTAGE")
    result = CSPSolver().solve(problem, enable_ac3=True, enable_forward_checking=True, enable_mrv=True, enable_lcv=True)

    assert result.stats.domain_values_generated > 0
    assert set(result.initial_domains.keys()) == set(problem.variables.keys())
    assert len(result.variable_selection_log) == len(problem.variables)
    assert len(result.constraints_enforced) == 8
    assert result.variable_selection_log[0]["method"].startswith("MRV")
    # The trace must contain the real operations performed, not a canned script
    events = {step["event"] for step in result.backtracking_steps}
    assert "ASSIGN" in events and "SOLUTION_FOUND" in events


def test_csp_backtracking_demo_scenario_shows_heuristics_reducing_backtracking():
    """
    `TIGHT_WINDOW_BACKTRACKING` is built so that a naive depth-first assignment dead-ends
    while MRV + LCV + forward checking do not. Both numbers are produced by the solver.
    """
    problem = get_preset_csp_scenario("TIGHT_WINDOW_BACKTRACKING")

    naive = CSPSolver().solve(problem, enable_ac3=False, enable_forward_checking=False,
                              enable_mrv=False, enable_lcv=False)
    heuristic = CSPSolver().solve(problem, enable_ac3=True, enable_forward_checking=True,
                                  enable_mrv=True, enable_lcv=True)

    assert naive.is_feasible and heuristic.is_feasible
    assert naive.stats.backtracks_count > heuristic.stats.backtracks_count
    assert heuristic.stats.backtracks_count == 0


def test_ac3_propagation_can_prove_infeasibility_before_search():
    """
    `PROPAGATION_INFEASIBLE` cannot be satisfied: AC-3 empties a domain during propagation,
    so the solver reports infeasibility with zero search steps and a non-zero prune count.
    """
    problem = get_preset_csp_scenario("PROPAGATION_INFEASIBLE")
    result = CSPSolver().solve(problem, enable_ac3=True, enable_forward_checking=True)

    assert result.is_feasible is False
    assert result.stats.ac3_values_pruned > 0
    assert sum(result.ac3_pruned_domains.values()) == result.stats.ac3_values_pruned
    assert result.stats.backtracks_count == 0
    assert "AC-3" in result.explanation


def test_lcv_toggle_changes_solver_behaviour():
    """Regression: `enable_lcv` used to be ignored, so the LCV switch in the UI did nothing."""
    problem = get_preset_csp_scenario("CHARGER_SHORTAGE")

    with_lcv = CSPSolver().solve(problem, enable_lcv=True, enable_mrv=True, enable_forward_checking=True)
    without_lcv = CSPSolver().solve(problem, enable_lcv=False, enable_mrv=True, enable_forward_checking=True)

    # The LCV ordering inspects other variables' domains, so it must change the constraint-check count
    assert with_lcv.stats.constraint_checks_count != without_lcv.stats.constraint_checks_count
    assert with_lcv.stats.lcv_enabled is True
    assert without_lcv.stats.lcv_enabled is False


def test_ac3_is_measured_even_when_it_prunes_nothing():
    """AC-3 must report its real workload; on loose instances it legitimately prunes zero values."""
    problem = get_preset_csp_scenario("NORMAL_DEMAND")
    result = CSPSolver().solve(problem, enable_ac3=True)

    assert result.stats.ac3_values_examined > 0
    assert result.stats.ac3_values_pruned == sum(result.ac3_pruned_domains.values())


# ---------------------------------------------------------------------------
# 3. Currency handling
# ---------------------------------------------------------------------------

def test_dataset_tariffs_are_converted_to_the_accounting_unit():
    assert all(st["price_currency"] == "INR" for st in INDIAN_USER_STATIONS)

    converted = price_in_usd({"price_per_kwh": 17.0, "price_currency": "INR"})
    assert converted == pytest.approx(0.2, abs=0.01)

    sim = SimulationEngine(seed=42)
    custom = sim.stations.get(INDIAN_USER_STATIONS[0]["id"])
    assert custom is not None
    assert 0.05 <= custom.energyPrice <= 0.60, "an INR tariff was stored as if it were USD"
    assert custom.priceCurrency == "USD"

    core = sim.stations["CS-METRO"]
    assert custom.energyPrice == pytest.approx(core.energyPrice, abs=0.15)


# ---------------------------------------------------------------------------
# 4. API surface regressions
# ---------------------------------------------------------------------------

def test_dpll_paths_are_both_available():
    """The frontend published /logic/dpll/solve while the backend only had /logic/dpll-verify."""
    for path in ("/api/logic/dpll/solve", "/api/logic/dpll-verify"):
        response = client.post(path, json={})
        assert response.status_code == 200, f"{path} is not served"
        assert "DPLL" in response.json()["algorithm"]


def test_search_network_reflects_live_station_state():
    """
    Regression: /search/network was declared twice with two different implementations (the
    second silently shadowed the first), and every algorithm comparison built its own static
    copy of the network - so station faults never reached the search screen.
    """
    response = client.get("/api/search/network")
    assert response.status_code == 200
    payload = response.json()
    assert payload["nodes"] and payload["edges"]

    node = next(n for n in payload["nodes"] if n["node_type"] == "CHARGING_STATION")
    station_id = node["id"]

    # Take a station offline in the live environment and re-read the graph
    client.post("/api/reset", json={"seed": 42})
    fault = client.post("/api/station/fault", json={"station_id": station_id, "is_faulty": True})
    assert fault.status_code == 200

    refreshed = client.get("/api/search/network").json()
    updated = next(n for n in refreshed["nodes"] if n["id"] == station_id)
    assert updated["operating_status"] == "FAULT", "search graph is not reading live station state"

    # Compare BFS/DFS/UCS/GBFS/A* and record which station source was used
    compare = client.post("/api/search/compare", json={"ev_id": "EV-REG"})
    assert compare.status_code == 200
    assert compare.json()["station_source"] == "LIVE_SIMULATION_STATE"

    client.post("/api/reset", json={"seed": 42})


def test_peas_endpoint_exposes_spec_and_measured_metrics():
    response = client.get("/api/peas")
    assert response.status_code == 200

    payload = response.json()
    assert set(payload["specification"].keys()) >= {"performance_measure", "environment", "actuators", "sensors"}
    assert "measured_metrics" in payload
    assert payload["environment_classification"]["observability"].startswith("PARTIALLY_OBSERVABLE")
    assert payload["data_provenance"]["occupancy_and_faults"].startswith("SIMULATED")
    # the endpoint must state that station metadata is a static snapshot, not a live feed
    assert "SNAPSHOT" in payload["data_provenance"]["station_metadata"].upper()
    assert "no live api call" in payload["data_provenance"]["station_metadata"].lower()


def test_new_csp_scenarios_are_listed_by_the_api():
    response = client.get("/api/csp/scenarios")
    assert response.status_code == 200
    ids = {scenario["id"] for scenario in response.json()}
    assert {"TIGHT_WINDOW_BACKTRACKING", "PROPAGATION_INFEASIBLE"} <= ids


def test_minimax_reports_separate_alpha_and_beta_cutoffs():
    from app.game_theory.adversarial import AdversarialBargainingGame

    result = AdversarialBargainingGame.solve_with_alpha_beta(max_depth=3)
    assert result.alpha_beta_cutoffs == result.alpha_cutoffs + result.beta_cutoffs
    assert result.nodes_evaluated > 0
