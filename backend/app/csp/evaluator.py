import math
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

from app.csp.variables import CSPDomainValue, CSPEVVariable, CSPAssignment, CSPProblemState


class SolutionUtilityScore(BaseModel):
    total_score: float
    wait_time_penalty: float
    travel_distance_penalty: float
    charging_cost_penalty: float
    grid_stress_penalty: float
    station_utilization_reward: float
    urgency_priority_reward: float
    explanation: str


class CSPSolutionEvaluator:
    def __init__(
        self,
        weight_wait_time: float = 1.0,
        weight_distance: float = 2.0,
        weight_cost: float = 1.5,
        weight_grid_stress: float = 3.0,
        weight_utilization: float = 1.0,
        weight_priority: float = 5.0
    ):
        self.w_wait = weight_wait_time
        self.w_dist = weight_distance
        self.w_cost = weight_cost
        self.w_grid = weight_grid_stress
        self.w_util = weight_utilization
        self.w_prio = weight_priority

    def evaluate_assignment(
        self,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> SolutionUtilityScore:
        """
        Computes weighted utility score for a complete or partial CSP schedule assignment.
        Higher score = better solution quality.
        """
        total_wait_min = 0.0
        total_dist_km = 0.0
        total_cost_usd = 0.0
        urgency_reward = 0.0

        for ev_id, val in assignment.assignments.items():
            ev_var = problem.variables.get(ev_id)
            station = problem.stations.get(val.station_id)

            if not ev_var or not station:
                continue

            # 1. Waiting Time
            wait_min = max(0, val.start_time_min - ev_var.arrival_time)
            total_wait_min += wait_min

            # 2. Travel Distance (Euclidean)
            ev_loc = ev_var.location
            st_loc = station.get("location", {"x": 0.0, "y": 0.0})
            dist = math.sqrt((ev_loc.get("x", 0.0) - st_loc.get("x", 0.0)) ** 2 + (ev_loc.get("y", 0.0) - st_loc.get("y", 0.0)) ** 2)
            total_dist_km += dist

            # 3. Charging Cost
            cost = val.energy_kwh * station.get("energyPrice", 0.25)
            total_cost_usd += cost

            # 4. Urgency Priority Reward
            if ev_var.priority == "EMERGENCY":
                urgency_reward += (100.0 - wait_min) * 2.0
            elif ev_var.priority == "HIGH":
                urgency_reward += (50.0 - wait_min) * 1.0

        # 5. Grid Stress Penalty
        time_step = problem.time_step_min
        peak_grid_load = 0.0
        for t in range(0, problem.max_time_horizon_min, time_step):
            t_load = sum(val.power_kw for val in assignment.assignments.values() if val.start_time_min <= t < val.end_time_min)
            if t_load > peak_grid_load:
                peak_grid_load = t_load

        grid_utilization_ratio = peak_grid_load / problem.grid_capacity_kw if problem.grid_capacity_kw > 0 else 0.0
        grid_stress_penalty = (grid_utilization_ratio ** 2) * 50.0

        # 6. Station Utilization Reward
        stations_used = len(set(val.station_id for val in assignment.assignments.values()))
        station_utilization_reward = stations_used * 10.0

        # Weighted Aggregate Utility Score
        wait_penalty = total_wait_min * self.w_wait
        dist_penalty = total_dist_km * self.w_dist
        cost_penalty = total_cost_usd * self.w_cost
        grid_penalty = grid_stress_penalty * self.w_grid
        prio_reward = urgency_reward * self.w_prio
        util_reward = station_utilization_reward * self.w_util

        total_utility = prio_reward + util_reward - (wait_penalty + dist_penalty + cost_penalty + grid_penalty)

        explanation = (
            f"Schedule utility score: {total_utility:.1f}. "
            f"Average wait time: {total_wait_min / max(1, len(assignment.assignments)):.1f} min, "
            f"Total travel distance: {total_dist_km:.1f} km, Total cost: ${total_cost_usd:.2f}, "
            f"Peak grid load: {peak_grid_load:.1f} kW ({grid_utilization_ratio * 100:.1f}% of capacity)."
        )

        return SolutionUtilityScore(
            total_score=round(total_utility, 2),
            wait_time_penalty=round(wait_penalty, 2),
            travel_distance_penalty=round(dist_penalty, 2),
            charging_cost_penalty=round(cost_penalty, 2),
            grid_stress_penalty=round(grid_penalty, 2),
            station_utilization_reward=round(util_reward, 2),
            urgency_priority_reward=round(prio_reward, 2),
            explanation=explanation
        )
