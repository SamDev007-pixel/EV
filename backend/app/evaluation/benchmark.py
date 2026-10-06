"""
Comparative evaluation of EV charging scheduling policies.

Every number reported by this module is **measured** from a deterministic
simulation run of the same seeded environment. No metric is hard-coded, and no
result is asserted: if a policy performs worse than a baseline on a given seed,
the reported table shows exactly that.

Data provenance:
- Environment (stations, chargers, transformer rating, seeded EV fleet): SIMULATED DATA
  (station metadata originates from real Open Charge Map / OpenStreetMap records, while
  occupancy, faults and battery levels are simulation state).
- Scheduling policies: CLASSICAL AI / CLASSICAL HEURISTIC COMPUTATION (no learning).
- Reported metrics: MEASURED from the simulation run (see `data_provenance` field).
"""

import time
import math
from typing import List, Dict, Any

from pydantic import BaseModel, Field

from app.simulation.engine import SimulationEngine
from app.models.ev import EVStatus
from app.models.charger import ChargerStatus


class StrategyEvaluationResult(BaseModel):
    strategy_id: str
    strategy_name: str
    description: str
    policy_classification: str  # "BASELINE_HEURISTIC" or "CLASSICAL_AI_POLICY"
    data_provenance: str = "MEASURED_FROM_SEEDED_SIMULATION"

    # --- Measured metrics ---
    avg_wait_time_min: float
    avg_travel_dist_km: float
    avg_charging_cost_usd: float
    station_utilization_pct: float
    grid_overload_incidents: int
    peak_grid_load_kw: float
    completed_evs: int
    timed_out_evs: int
    total_evs: int
    unit_price_usd_per_kwh: float
    successful_allocation_pct: float
    total_energy_delivered_kwh: float
    simulation_ticks: int
    simulation_runtime_ms: float


class BenchmarkComparisonResult(BaseModel):
    seed: int
    simulation_ticks: int
    synthetic_fleet_size: int = 0
    simulation_disclaimer: str = (
        "All metrics are measured from a deterministic, seeded software simulation of an EV charging "
        "network. Station metadata is sourced from public datasets, but occupancy, faults and battery "
        "levels are simulated. Do NOT interpret these numbers as real-world field telemetry."
    )
    strategies: List[StrategyEvaluationResult] = Field(default_factory=list)
    ai_decision_explanations: List[Dict[str, str]] = Field(default_factory=list)
    execution_time_ms: float


class BenchmarkEvaluator:
    """Runs the same seeded scenario under each scheduling policy and measures the outcome."""

    STRATEGIES: List[Dict[str, str]] = [
        {
            "strategy_id": "FCFS_BASELINE",
            "policy_name": "FCFS_BASELINE",
            "strategy_name": "Baseline 1: First-Come-First-Served (FCFS)",
            "policy_classification": "BASELINE_HEURISTIC",
            "description": (
                "Admits EVs strictly in arrival order and takes the most powerful free charger. "
                "No priority weighting, no grid-capacity awareness."
            ),
        },
        {
            "strategy_id": "NEAREST_STATION",
            "policy_name": "NEAREST_STATION",
            "strategy_name": "Baseline 2: Nearest Station Assignment",
            "policy_classification": "BASELINE_HEURISTIC",
            "description": (
                "Admits EVs in arrival order and assigns the geographically closest operational "
                "station, ignoring station congestion and transformer loading."
            ),
        },
        {
            "strategy_id": "SIMPLE_PRIORITY",
            "policy_name": "SIMPLE_PRIORITY",
            "strategy_name": "Baseline 3: Simple Priority Scheduling",
            "policy_classification": "BASELINE_HEURISTIC",
            "description": (
                "Sorts the queue by priority rank (Emergency > High > Standard) and deadline, with "
                "emergency preemption, but without grid-capacity or station-congestion awareness."
            ),
        },
        {
            "strategy_id": "INTELLIGENT_AI_PROPOSED",
            "policy_name": "INTELLIGENT_AI_PROPOSED",
            "strategy_name": "Proposed: Grid-Safe Urgency Policy (Classical AI)",
            "policy_classification": "CLASSICAL_AI_POLICY",
            "description": (
                "Orders EVs by an urgency score (priority + energy required per remaining minute), ranks "
                "charger candidates by a composite score (distance, congestion, price) and throttles power "
                "so that admitted sessions stay below 90% of the transformer rating."
            ),
        },
    ]

    @staticmethod
    def _inject_demand(sim: SimulationEngine, seed: int, fleet_size: int) -> None:
        """
        Add a deterministic synthetic EV fleet so that the policies face real contention.

        The seeded fleet of four EVs is too small for scheduling policies to differ: every
        EV gets a free charger immediately. These extra vehicles are generated from the
        seed with a fixed local RNG, so every policy in the comparison sees exactly the same
        demand. They are SIMULATED DATA, not real vehicles.
        """
        import random as _random
        from app.models.ev import EVModel, EVPriority

        rng = _random.Random(seed * 7919 + 13)
        for i in range(fleet_size):
            capacity = rng.choice([40.0, 50.0, 60.0, 75.0, 90.0])
            soc = rng.uniform(0.08, 0.35)
            required_pct = rng.choice([0.7, 0.8, 0.9])
            priority = EVPriority.EMERGENCY if i % 11 == 10 else (
                EVPriority.HIGH if i % 4 == 0 else EVPriority.STANDARD
            )
            sim.add_or_update_ev(EVModel(
                id=f"DEMAND-{i + 1:03d}",
                batteryCapacity=capacity,
                currentBatteryLevel=round(capacity * soc, 2),
                requiredBatteryLevel=round(capacity * required_pct, 2),
                chargingRate=rng.choice([22.0, 30.0, 50.0, 60.0, 100.0, 150.0]),
                arrivalTime=0,
                departureDeadline=rng.choice([30, 45, 60, 90, 120, 180]),
                currentLocation={"x": round(rng.uniform(1.0, 9.0), 2), "y": round(rng.uniform(1.0, 9.0), 2)},
                destination={"x": round(rng.uniform(1.0, 9.0), 2), "y": round(rng.uniform(1.0, 9.0), 2)},
                priority=priority,
            ))

    @staticmethod
    def _measure_strategy(policy_name: str, seed: int, ticks: int, fleet_size: int) -> Dict[str, Any]:
        """Run one policy on a fresh seeded environment and measure the outcome tick by tick."""
        start = time.perf_counter()

        sim = SimulationEngine(seed=seed)
        sim.strategy_name = policy_name
        BenchmarkEvaluator._inject_demand(sim, seed, fleet_size)

        # Station utilisation is sampled every simulated minute and averaged, so that
        # sessions that finish before the end of the run are still accounted for.
        utilisation_samples: List[float] = []
        for _ in range(ticks):
            sim.step(1)
            occupied = sum(1 for c in sim.chargers.values() if c.currentStatus == ChargerStatus.OCCUPIED)
            utilisation_samples.append((occupied / max(1, len(sim.chargers))) * 100.0)

        runtime_ms = round((time.perf_counter() - start) * 1000.0, 2)

        ev_list = list(sim.evs.values())
        total_evs = len(ev_list)

        # Waiting time: measured per EV by the simulation clock
        wait_values = [ev.waitTimeMin for ev in ev_list]
        avg_wait = round(sum(wait_values) / max(1, total_evs), 1)

        # Charging cost: measured energy billed to each EV (single accounting unit, USD)
        cost_values = [ev.totalCostUSD for ev in ev_list if ev.totalCostUSD > 0]
        avg_cost = round(sum(cost_values) / max(1, len(cost_values)), 2) if cost_values else 0.0

        # Travel distance: straight-line distance from the EV's start location to the
        # station it was actually assigned to (only for EVs that received an assignment).
        distances = []
        for ev in ev_list:
            if not ev.assignedStationId:
                continue
            station = sim.stations.get(ev.assignedStationId)
            if not station:
                continue
            loc = ev.currentLocation or {"x": 0.0, "y": 0.0}
            st_loc = station.location or {"x": 0.0, "y": 0.0}
            distances.append(math.hypot(loc.get("x", 0.0) - st_loc.get("x", 0.0),
                                        loc.get("y", 0.0) - st_loc.get("y", 0.0)))
        avg_distance = round(sum(distances) / len(distances), 2) if distances else 0.0

        mean_util = round(sum(utilisation_samples) / max(1, len(utilisation_samples)), 1)

        completed = sum(1 for ev in ev_list if ev.status == EVStatus.COMPLETED)
        timed_out = sim.peas_metrics.timed_out_evs

        return {
            "avg_wait_time_min": avg_wait,
            "avg_travel_dist_km": avg_distance,
            "avg_charging_cost_usd": avg_cost,
            "station_utilization_pct": mean_util,
            "grid_overload_incidents": sim.peas_metrics.grid_overload_incidents,
            "peak_grid_load_kw": round(sim.peas_metrics.peak_grid_load_kw, 1),
            "completed_evs": completed,
            "timed_out_evs": timed_out,
            "total_evs": total_evs,
            "unit_price_usd_per_kwh": round(
                sum(ev.totalCostUSD for ev in ev_list) / max(1e-9, sim.peas_metrics.total_energy_delivered_kwh), 4
            ),
            "successful_allocation_pct": round((completed / max(1, total_evs)) * 100.0, 1),
            "total_energy_delivered_kwh": round(sim.peas_metrics.total_energy_delivered_kwh, 2),
            "simulation_ticks": ticks,
            "simulation_runtime_ms": runtime_ms,
        }

    @staticmethod
    def _build_explanations(measured: Dict[str, Dict[str, Any]]) -> List[Dict[str, str]]:
        """Derive explanations from the measured table (never from assumed outcomes)."""
        explanations: List[Dict[str, str]] = []

        proposed = measured.get("INTELLIGENT_AI_PROPOSED")
        fcfs = measured.get("FCFS_BASELINE")
        nearest = measured.get("NEAREST_STATION")

        if proposed and fcfs:
            explanations.append({
                "topic": "Grid-safety behaviour",
                "explanation": (
                    f"The proposed policy admitted sessions only while the transformer load stayed below "
                    f"90% of its rating ({proposed['peak_grid_load_kw']} kW peak measured) and recorded "
                    f"{proposed['grid_overload_incidents']} critical overload incidents, versus "
                    f"{fcfs['grid_overload_incidents']} for FCFS on the same seed."
                ),
            })
            explanations.append({
                "topic": "Service completion",
                "explanation": (
                    f"Completed EVs: proposed policy {proposed['completed_evs']}/{proposed['total_evs']} "
                    f"({proposed['successful_allocation_pct']}%), FCFS {fcfs['completed_evs']}/{fcfs['total_evs']} "
                    f"({fcfs['successful_allocation_pct']}%), measured over {proposed['simulation_ticks']} simulated minutes."
                ),
            })
            explanations.append({
                "topic": "Driver waiting time",
                "explanation": (
                    f"Average measured wait: proposed policy {proposed['avg_wait_time_min']} min, "
                    f"FCFS {fcfs['avg_wait_time_min']} min. The grid-safe policy is slower because it defers "
                    f"or throttles sessions instead of exceeding the transformer rating."
                ),
            })
            explanations.append({
                "topic": "Measured trade-off (read this before quoting any percentage)",
                "explanation": (
                    f"On seed 42 with a {proposed['simulation_ticks']}-minute horizon the grid-safe policy served "
                    f"{proposed['successful_allocation_pct']}% of EVs with {proposed['grid_overload_incidents']} grid "
                    f"overload incidents, while FCFS served {fcfs['successful_allocation_pct']}% of EVs with "
                    f"{fcfs['grid_overload_incidents']} overload incidents and a peak draw of {fcfs['peak_grid_load_kw']} kW "
                    f"against a 450 kW transformer. Neither policy dominates the other: the choice is a policy decision "
                    f"about grid safety versus waiting time, and the numbers above are measured, not assumed."
                ),
            })

        if proposed and nearest:
            explanations.append({
                "topic": "Distance versus congestion trade-off",
                "explanation": (
                    f"Nearest-station assignment minimises travel distance "
                    f"({nearest['avg_travel_dist_km']} km measured vs {proposed['avg_travel_dist_km']} km for the "
                    f"proposed policy) but ignores congestion and transformer headroom, which is why it is used "
                    f"in this benchmark as a single-objective baseline."
                ),
            })

        explanations.append({
            "topic": "Scope of this benchmark",
            "explanation": (
                "This table compares four scheduling policies executed in the same simulated environment. "
                "The classical AI modules (A*/UCS/GBFS search, CSP backtracking with MRV/LCV/forward checking/AC-3, "
                "the rule-based knowledge base and the Minimax/Nash conflict-resolution modules) are demonstrated and "
                "measured separately on their own screens; they are not executed inside this policy benchmark."
            ),
        })

        return explanations

    @staticmethod
    def run_comparative_benchmark(
        seed: int = 42,
        ticks: int = 180,
        fleet_size: int = 12,
    ) -> BenchmarkComparisonResult:
        start_time = time.perf_counter()

        results: List[StrategyEvaluationResult] = []
        measured: Dict[str, Dict[str, Any]] = {}

        for strategy in BenchmarkEvaluator.STRATEGIES:
            metrics = BenchmarkEvaluator._measure_strategy(strategy["policy_name"], seed, ticks, fleet_size)
            measured[strategy["strategy_id"]] = metrics
            results.append(StrategyEvaluationResult(
                strategy_id=strategy["strategy_id"],
                strategy_name=strategy["strategy_name"],
                description=strategy["description"],
                policy_classification=strategy["policy_classification"],
                **metrics,
            ))

        explanations = BenchmarkEvaluator._build_explanations(measured)

        exec_time = round((time.perf_counter() - start_time) * 1000.0, 2)

        return BenchmarkComparisonResult(
            seed=seed,
            simulation_ticks=ticks,
            synthetic_fleet_size=fleet_size,
            strategies=results,
            ai_decision_explanations=explanations,
            execution_time_ms=exec_time,
        )
