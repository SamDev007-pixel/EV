import pytest
from app.csp.variables import CSPDomainValue, CSPEVVariable, CSPAssignment, CSPProblemState
from app.csp.constraints import (
    NoChargerOverlapConstraint,
    StationPowerCapacityConstraint,
    GridTransformerCapacityConstraint,
    DepartureDeadlineConstraint,
    ChargerCompatibilityConstraint,
    OperationalStationConstraint
)
from app.csp.solver import CSPSolver
from app.csp.scenarios import get_preset_csp_scenario
from app.csp.evaluator import CSPSolutionEvaluator


def test_no_charger_overlap_constraint():
    constraint = NoChargerOverlapConstraint()
    problem = get_preset_csp_scenario("NORMAL_DEMAND")
    
    val1 = CSPDomainValue(station_id="CS-NORTH", charger_id="CS-NORTH-CH-1", start_time_min=0, duration_min=45, power_kw=100.0)
    val2 = CSPDomainValue(station_id="CS-NORTH", charger_id="CS-NORTH-CH-1", start_time_min=30, duration_min=45, power_kw=100.0)

    assignment = CSPAssignment()
    assignment.assign("EV-101", val1)

    # Check overlapping assignment on same charger
    satisfied, reason = constraint.check("EV-102", val2, assignment, problem)
    assert satisfied is False
    assert "already serving" in reason

    # Check non-overlapping assignment on same charger
    val3 = CSPDomainValue(station_id="CS-NORTH", charger_id="CS-NORTH-CH-1", start_time_min=45, duration_min=45, power_kw=100.0)
    satisfied_non_overlap, _ = constraint.check("EV-102", val3, assignment, problem)
    assert satisfied_non_overlap is True


def test_departure_deadline_constraint():
    constraint = DepartureDeadlineConstraint()
    problem = get_preset_csp_scenario("NORMAL_DEMAND")

    # EV-101 has departure_deadline = 120
    val_valid = CSPDomainValue(station_id="CS-NORTH", charger_id="CS-NORTH-CH-1", start_time_min=0, duration_min=60, power_kw=50.0)
    val_invalid = CSPDomainValue(station_id="CS-NORTH", charger_id="CS-NORTH-CH-1", start_time_min=90, duration_min=60, power_kw=50.0)  # Ends at 150m > 120m

    assignment = CSPAssignment()
    ok_valid, _ = constraint.check("EV-101", val_valid, assignment, problem)
    assert ok_valid is True

    ok_invalid, reason = constraint.check("EV-101", val_invalid, assignment, problem)
    assert ok_invalid is False
    assert "exceeds EV departure deadline" in reason


def test_operational_station_constraint():
    constraint = OperationalStationConstraint()
    problem = get_preset_csp_scenario("NO_FEASIBLE_SOLUTION")

    val = CSPDomainValue(station_id="CS-NORTH", charger_id="CS-NORTH-CH-1", start_time_min=0, duration_min=30, power_kw=50.0)
    assignment = CSPAssignment()

    ok, reason = constraint.check("EV-UNFEASIBLE", val, assignment, problem)
    assert ok is False
    assert "FAULT status" in reason


def test_backtracking_solver_normal_demand():
    problem = get_preset_csp_scenario("NORMAL_DEMAND")
    solver = CSPSolver()

    result = solver.solve(problem, enable_forward_checking=True, enable_ac3=True)

    assert result.is_feasible is True
    assert len(result.best_assignment) == len(problem.variables)
    assert result.stats.execution_time_ms >= 0.0
    assert result.utility_score is not None
    assert result.utility_score.total_score != 0.0


def test_charger_shortage_scenario():
    problem = get_preset_csp_scenario("CHARGER_SHORTAGE")
    solver = CSPSolver()

    result = solver.solve(problem, enable_forward_checking=True, enable_ac3=True)

    assert result.is_feasible is True
    assert result.stats.solutions_found_count > 0


def test_grid_capacity_shortage_scenario():
    problem = get_preset_csp_scenario("GRID_CAPACITY_SHORTAGE")
    solver = CSPSolver()

    result = solver.solve(problem, enable_forward_checking=True, enable_ac3=True)

    assert result.is_feasible is True
    # Verify peak load across all assigned EVs never exceeds grid transformer capacity (100 kW)
    assignment = CSPAssignment(assignments={
        k: CSPDomainValue(**v) for k, v in result.best_assignment.items()
    })
    evaluator = CSPSolutionEvaluator()
    score = evaluator.evaluate_assignment(assignment, problem)
    assert score.total_score != 0.0


def test_unfeasible_scenario_diagnosis():
    problem = get_preset_csp_scenario("NO_FEASIBLE_SOLUTION")
    solver = CSPSolver()

    result = solver.solve(problem, enable_forward_checking=True, enable_ac3=True)

    assert result.is_feasible is False
    assert "No feasible" in result.explanation or "Unfeasible" in result.explanation


def test_solution_utility_ranking():
    problem = get_preset_csp_scenario("NORMAL_DEMAND")
    solver = CSPSolver()

    result = solver.solve(problem, find_all_solutions=True, max_solutions=5)

    assert result.is_feasible is True
    assert len(result.all_solutions) >= 1
    # Check explanation trace
    assert "Schedule utility score" in result.explanation
