import pytest
from app.evaluation.benchmark import BenchmarkEvaluator, BenchmarkComparisonResult


def test_benchmark_evaluation_suite():
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)

    assert isinstance(res, BenchmarkComparisonResult)
    assert len(res.strategies) == 4
    strategy_ids = [s.strategy_id for s in res.strategies]
    assert "FCFS_BASELINE" in strategy_ids
    assert "NEAREST_STATION" in strategy_ids
    assert "SIMPLE_PRIORITY" in strategy_ids
    assert "INTELLIGENT_AI_PROPOSED" in strategy_ids


def test_ai_superiority_metrics():
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)
    ai_strat = next(s for s in res.strategies if s.strategy_id == "INTELLIGENT_AI_PROPOSED")
    fcfs_strat = next(s for s in res.strategies if s.strategy_id == "FCFS_BASELINE")

    # Verify AI has 0 grid overload incidents
    assert ai_strat.grid_overload_incidents == 0
    # Verify AI has higher successful allocation rate
    assert ai_strat.successful_allocation_pct > fcfs_strat.successful_allocation_pct
    # Verify AI has lower charging cost
    assert ai_strat.avg_charging_cost_usd < fcfs_strat.avg_charging_cost_usd


def test_disclaimer_presence():
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)
    assert "simulated academic demonstration environment" in res.simulation_disclaimer
    assert len(res.ai_decision_explanations) >= 4
