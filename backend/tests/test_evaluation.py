"""
Evaluation / benchmarking tests.

These tests deliberately assert **measured** properties of the benchmark. The earlier
version of this file asserted that the "AI" policy had a better allocation rate and a
lower charging cost than every baseline; those numbers were produced by hard-coded
constants inside the benchmark module, so the assertions only proved the constants
existed. The rewritten tests below check that:

1. every metric is produced by an actual simulation run (values change with the seed),
2. the grid-safe policy never allows the transformer to be overloaded (a real invariant
   of the implemented policy, not a declared result), and
3. the trade-off against FCFS is reported, not hidden.
"""

from app.evaluation.benchmark import BenchmarkEvaluator, BenchmarkComparisonResult
from app.simulation.engine import SimulationEngine

TRANSFORMER_CAPACITY_KW = 450.0


def test_benchmark_evaluation_suite():
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)

    assert isinstance(res, BenchmarkComparisonResult)
    assert len(res.strategies) == 4
    strategy_ids = [s.strategy_id for s in res.strategies]
    assert "FCFS_BASELINE" in strategy_ids
    assert "NEAREST_STATION" in strategy_ids
    assert "SIMPLE_PRIORITY" in strategy_ids
    assert "INTELLIGENT_AI_PROPOSED" in strategy_ids

    # Every strategy reports where its numbers came from
    for strategy in res.strategies:
        assert strategy.data_provenance == "MEASURED_FROM_SEEDED_SIMULATION"
        assert strategy.policy_classification in ("BASELINE_HEURISTIC", "CLASSICAL_AI_POLICY")
        assert strategy.total_evs > 0


def test_ai_policy_is_grid_safe_by_construction():
    """
    The proposed policy admits sessions only below 92% of the transformer rating, and the
    environment flags a critical overload at 95%. Therefore it must report zero overloads
    and must stay below the critical threshold - this is a property of the policy, not a
    hard-coded '0' in the results table.
    """
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)
    ai_strat = next(s for s in res.strategies if s.strategy_id == "INTELLIGENT_AI_PROPOSED")

    assert ai_strat.grid_overload_incidents == 0
    assert ai_strat.peak_grid_load_kw < TRANSFORMER_CAPACITY_KW * 0.95


def test_baselines_ignore_grid_capacity_measured_not_assumed():
    """
    FCFS takes the most powerful free charger without looking at the transformer, so on the
    seeded scenario it demonstrably drives the grid past its rating. If this ever stops being
    true the benchmark must show that instead - hence the assertion is on the measurement.
    """
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)
    fcfs = next(s for s in res.strategies if s.strategy_id == "FCFS_BASELINE")

    assert fcfs.peak_grid_load_kw > TRANSFORMER_CAPACITY_KW
    assert fcfs.grid_overload_incidents > 0


def test_metrics_are_measured_not_hard_coded():
    """
    Two different seeds must produce different measured outcomes. Hard-coded results would
    be identical for every seed, which is exactly the bug this test guards against.
    """
    res_a = BenchmarkEvaluator.run_comparative_benchmark(seed=42, ticks=90)
    res_b = BenchmarkEvaluator.run_comparative_benchmark(seed=99, ticks=90)

    metrics_a = {(s.strategy_id, s.peak_grid_load_kw, s.completed_evs, s.total_energy_delivered_kwh) for s in res_a.strategies}
    metrics_b = {(s.strategy_id, s.peak_grid_load_kw, s.completed_evs, s.total_energy_delivered_kwh) for s in res_b.strategies}

    assert metrics_a != metrics_b


def test_benchmark_reports_trade_off_and_scope():
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)
    topics = [e["topic"] for e in res.ai_decision_explanations]

    assert "Measured trade-off (read this before quoting any percentage)" in topics
    assert "Scope of this benchmark" in topics
    assert len(res.ai_decision_explanations) >= 4


def test_disclaimer_presence():
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)
    assert "simulated" in res.simulation_disclaimer.lower()
    assert "NOT" in res.simulation_disclaimer or "not" in res.simulation_disclaimer


def test_all_four_policies_are_implemented_in_the_engine():
    """
    Guard against the previous situation where NEAREST_STATION and INTELLIGENT_AI_PROPOSED
    were benchmark strategy *names* that silently fell through to the FCFS branch, making the
    comparison meaningless.
    """
    policies = {s["policy_name"] for s in BenchmarkEvaluator.STRATEGIES}
    assert policies == {"FCFS_BASELINE", "NEAREST_STATION", "SIMPLE_PRIORITY", "INTELLIGENT_AI_PROPOSED"}

    # Each policy must produce a distinct assignment behaviour on the same seeded demand
    outcomes = {}
    for policy in sorted(policies):
        sim = SimulationEngine(seed=42)
        sim.strategy_name = policy
        BenchmarkEvaluator._inject_demand(sim, 42, 8)
        sim.step(30)
        outcomes[policy] = tuple(sorted(
            (ev.id, ev.assignedStationId or "NONE") for ev in sim.evs.values()
        ))

    assert outcomes["FCFS_BASELINE"] != outcomes["NEAREST_STATION"], "nearest-station policy is not active"
    assert outcomes["FCFS_BASELINE"] != outcomes["INTELLIGENT_AI_PROPOSED"], "AI policy is not active"


def test_unit_price_is_within_a_sane_single_currency_range():
    """
    Station tariffs come from datasets quoted in different currencies. The engine converts
    them to one accounting unit (USD) on load; mixing ₹/kWh and $/kWh used to inflate the
    'cost' column by roughly 85x for the Indian stations.
    """
    res = BenchmarkEvaluator.run_comparative_benchmark(seed=42)
    for strategy in res.strategies:
        assert 0.05 <= strategy.unit_price_usd_per_kwh <= 0.60, (
            f"{strategy.strategy_id} reports {strategy.unit_price_usd_per_kwh} USD/kWh, "
            "which suggests raw INR tariffs are being summed as USD"
        )
