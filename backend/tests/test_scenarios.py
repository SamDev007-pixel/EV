import pytest
from app.scenarios.scenario_engine import DynamicScenarioEngine, ScenarioResult


def test_scenario_1_peak_spike():
    engine = DynamicScenarioEngine()
    result = engine.run_scenario("SCENARIO_1_PEAK_SPIKE", seed=42)

    assert isinstance(result, ScenarioResult)
    assert result.scenario_id == "SCENARIO_1_PEAK_SPIKE"
    assert result.after_metrics.active_ev_count > result.before_metrics.active_ev_count
    assert len(result.affected_ev_ids) >= 15
    assert len(result.ai_layer_trace) >= 3
    assert result.execution_time_ms >= 0.0


def test_scenario_2_station_failure():
    engine = DynamicScenarioEngine()
    result = engine.run_scenario("SCENARIO_2_STATION_FAILURE", seed=42)

    assert isinstance(result, ScenarioResult)
    assert result.scenario_id == "SCENARIO_2_STATION_FAILURE"
    assert result.after_metrics.operational_stations_count < result.before_metrics.operational_stations_count
    assert len(result.reallocated_ev_ids) > 0


def test_scenario_3_grid_overload():
    engine = DynamicScenarioEngine()
    result = engine.run_scenario("SCENARIO_3_GRID_OVERLOAD", seed=42)

    assert isinstance(result, ScenarioResult)
    assert result.scenario_id == "SCENARIO_3_GRID_OVERLOAD"
    assert len(result.affected_ev_ids) > 0
    assert result.after_metrics.grid_load_kw <= 250.0  # Safe load restored!


def test_scenario_4_emergency_ev():
    engine = DynamicScenarioEngine()
    result = engine.run_scenario("SCENARIO_4_EMERGENCY_EV", seed=42)

    assert isinstance(result, ScenarioResult)
    assert result.scenario_id == "SCENARIO_4_EMERGENCY_EV"
    assert "EV-EMERGENCY-CRITICAL" in result.affected_ev_ids
    assert "preempting" in result.explanation_summary.lower() or "emergency" in result.explanation_summary.lower()


def test_scenario_5_renewable_availability():
    engine = DynamicScenarioEngine()
    result = engine.run_scenario("SCENARIO_5_RENEWABLE_AVAILABILITY", seed=42)

    assert isinstance(result, ScenarioResult)
    assert result.scenario_id == "SCENARIO_5_RENEWABLE_AVAILABILITY"
    assert result.after_metrics.renewable_power_kw == 120.0


def test_seed_reproducibility():
    engine = DynamicScenarioEngine()
    r1 = engine.run_scenario("SCENARIO_1_PEAK_SPIKE", seed=42)
    r2 = engine.run_scenario("SCENARIO_1_PEAK_SPIKE", seed=42)

    assert r1.before_metrics.grid_load_kw == r2.before_metrics.grid_load_kw
    assert r1.after_metrics.grid_load_kw == r2.after_metrics.grid_load_kw
    assert r1.affected_ev_ids == r2.affected_ev_ids
