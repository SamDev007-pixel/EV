import pytest
from app.optimization.local_search import LocalSearchOptimizer, LocalSearchResult


def test_simulated_annealing_cost_reduction():
    # Load profile with a prominent sharp spike
    initial = [100.0, 90.0, 80.0, 70.0, 110.0, 200.0, 380.0, 420.0, 410.0, 300.0, 220.0, 180.0]
    peak_limit = 280.0

    res = LocalSearchOptimizer.simulated_annealing_schedule(
        initial_schedule=initial,
        peak_limit=peak_limit,
        initial_temp=50.0,
        cooling_rate=0.92,
        max_iterations=500,
        seed=42
    )

    assert isinstance(res, LocalSearchResult)
    assert "SIMULATED_ANNEALING" in res.algorithm.upper()
    assert res.final_cost <= res.initial_cost
    assert res.improvement_percentage >= 0.0
    assert len(res.optimized_schedule) == len(initial)
    assert res.iterations > 0
    assert len(res.cost_history) > 0


def test_hill_climbing_cost_reduction():
    initial = [120.0, 110.0, 100.0, 90.0, 150.0, 260.0, 390.0, 430.0, 350.0, 280.0, 190.0, 140.0]
    peak_limit = 300.0

    res = LocalSearchOptimizer.hill_climbing_schedule(
        initial_schedule=initial,
        peak_limit=peak_limit,
        max_iterations=300,
        restarts=2,
        seed=42
    )

    assert isinstance(res, LocalSearchResult)
    assert "HILL_CLIMBING" in res.algorithm.upper()
    assert res.final_cost <= res.initial_cost
    assert len(res.optimized_schedule) == len(initial)
