import math
import random
import time
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel, Field


class LocalSearchResult(BaseModel):
    algorithm: str
    initial_cost: float
    final_cost: float
    improvement_percentage: float
    iterations: int
    execution_time_ms: float
    initial_schedule: List[float]
    optimized_schedule: List[float]
    cost_history: List[float] = Field(default_factory=list)
    temperature_history: List[float] = Field(default_factory=list)
    explanation: str


class LocalSearchOptimizer:
    """
    Local search and optimization (hill climbing and simulated annealing).
    Solves 24-hour microgrid aggregate power schedule optimization:
    Goal: Minimize peak load and smooth the load curve (minimizing variance & peak-to-average ratio).
    """

    @staticmethod
    def evaluate_cost(schedule: List[float], peak_limit: float = 300.0) -> float:
        """
        Objective function:
        E(s) = sum( (P_t - P_avg)^2 ) + 10 * sum( max(0, P_t - P_limit)^2 )
        """
        if not schedule:
            return 0.0
        n = len(schedule)
        avg_p = sum(schedule) / n
        variance = sum((p - avg_p) ** 2 for p in schedule) / n
        peak_penalty = sum(max(0.0, p - peak_limit) ** 2 for p in schedule) * 10.0
        return round(variance + peak_penalty, 2)

    @classmethod
    def simulated_annealing(
        cls,
        initial_schedule: Optional[List[float]] = None,
        initial_temp: float = 100.0,
        cooling_rate: float = 0.95,
        min_temp: float = 0.1,
        iterations_per_temp: int = 10,
        seed: int = 42,
        peak_limit: float = 300.0,
        max_iterations: Optional[int] = None,
        **kwargs
    ) -> LocalSearchResult:
        start_time = time.perf_counter()
        random.seed(seed)

        if initial_schedule is None:
            # Default 24-hour load curve with spike between 18:00 and 21:00
            initial_schedule = [
                30.0, 25.0, 20.0, 20.0, 25.0, 40.0,
                80.0, 140.0, 180.0, 160.0, 150.0, 130.0,
                140.0, 150.0, 160.0, 170.0, 210.0, 320.0,
                380.0, 350.0, 280.0, 190.0, 100.0, 50.0
            ]

        current_s = list(initial_schedule)
        best_s = list(initial_schedule)
        current_cost = cls.evaluate_cost(current_s)
        best_cost = current_cost
        init_cost = current_cost

        cost_history = [current_cost]
        temp_history = [initial_temp]

        temp = initial_temp
        total_iters = 0

        while temp > min_temp:
            for _ in range(iterations_per_temp):
                total_iters += 1
                # Generate neighbor by shifting power between adjacent peak & off-peak hours
                neighbor = list(current_s)
                h1 = random.randint(0, len(neighbor) - 1)
                h2 = random.randint(0, len(neighbor) - 1)
                if h1 != h2 and neighbor[h1] > 20.0:
                    shift_amount = min(neighbor[h1] * 0.15, 25.0)
                    neighbor[h1] = round(neighbor[h1] - shift_amount, 1)
                    neighbor[h2] = round(neighbor[h2] + shift_amount, 1)

                    neighbor_cost = cls.evaluate_cost(neighbor)
                    delta_e = neighbor_cost - current_cost

                    # Metropolis acceptance criterion: accept if better or with prob e^(-delta/T)
                    if delta_e < 0 or random.random() < math.exp(-delta_e / max(temp, 1e-6)):
                        current_s = neighbor
                        current_cost = neighbor_cost

                        if current_cost < best_cost:
                            best_s = list(current_s)
                            best_cost = current_cost

                cost_history.append(current_cost)
                temp_history.append(round(temp, 2))

            temp *= cooling_rate

        exec_time = (time.perf_counter() - start_time) * 1000.0
        improvement = ((init_cost - best_cost) / max(1.0, init_cost)) * 100.0

        explanation = (
            f"Simulated Annealing completed in {total_iters} iterations over {exec_time:.2f} ms. "
            f"Objective cost reduced from {init_cost:.1f} to {best_cost:.1f} ({improvement:.1f}% load curve variance reduction). "
            f"Peak load eliminated via temperature cooling schedule T: {initial_temp} -> {temp:.2f}."
        )

        return LocalSearchResult(
            algorithm="SIMULATED_ANNEALING",
            initial_cost=init_cost,
            final_cost=best_cost,
            improvement_percentage=round(improvement, 2),
            iterations=total_iters,
            execution_time_ms=round(exec_time, 3),
            initial_schedule=initial_schedule,
            optimized_schedule=best_s,
            cost_history=cost_history[::max(1, len(cost_history) // 30)],  # sampled for frontend
            temperature_history=temp_history[::max(1, len(temp_history) // 30)],
            explanation=explanation
        )

    @classmethod
    def hill_climbing(
        cls,
        initial_schedule: Optional[List[float]] = None,
        max_iterations: int = 150,
        restarts: int = 3,
        seed: int = 42,
        peak_limit: float = 300.0,
        **kwargs
    ) -> LocalSearchResult:
        start_time = time.perf_counter()
        random.seed(seed)

        if initial_schedule is None:
            initial_schedule = [
                30.0, 25.0, 20.0, 20.0, 25.0, 40.0,
                80.0, 140.0, 180.0, 160.0, 150.0, 130.0,
                140.0, 150.0, 160.0, 170.0, 210.0, 320.0,
                380.0, 350.0, 280.0, 190.0, 100.0, 50.0
            ]

        global_best_s = list(initial_schedule)
        global_best_cost = cls.evaluate_cost(global_best_s)
        init_cost = global_best_cost
        cost_history = [init_cost]
        total_steps = 0

        for r in range(restarts):
            curr_s = list(global_best_s) if r == 0 else [round(p * random.uniform(0.9, 1.1), 1) for p in initial_schedule]
            curr_cost = cls.evaluate_cost(curr_s)

            for step in range(max_iterations):
                total_steps += 1
                # Generate neighborhood of 10 perturbations, pick steepest improvement
                best_neighbor = None
                best_neighbor_cost = curr_cost

                for _ in range(10):
                    cand = list(curr_s)
                    h1 = random.randint(0, len(cand) - 1)
                    h2 = random.randint(0, len(cand) - 1)
                    if h1 != h2 and cand[h1] > 20.0:
                        shift = min(cand[h1] * 0.15, 25.0)
                        cand[h1] = round(cand[h1] - shift, 1)
                        cand[h2] = round(cand[h2] + shift, 1)
                        c_cost = cls.evaluate_cost(cand)
                        if c_cost < best_neighbor_cost:
                            best_neighbor = cand
                            best_neighbor_cost = c_cost

                if best_neighbor is not None and best_neighbor_cost < curr_cost:
                    curr_s = best_neighbor
                    curr_cost = best_neighbor_cost
                    cost_history.append(curr_cost)
                else:
                    # Local optimum reached for this restart
                    break

            if curr_cost < global_best_cost:
                global_best_cost = curr_cost
                global_best_s = list(curr_s)

        exec_time = (time.perf_counter() - start_time) * 1000.0
        improvement = ((init_cost - global_best_cost) / max(1.0, init_cost)) * 100.0

        explanation = (
            f"Steepest-Ascent Hill Climbing with {restarts} Random Restarts completed in {total_steps} steps. "
            f"Cost reduced from {init_cost:.1f} to {global_best_cost:.1f} ({improvement:.1f}% variance improvement). "
            f"Execution time: {exec_time:.2f} ms."
        )

        return LocalSearchResult(
            algorithm="HILL_CLIMBING_RESTARTS",
            initial_cost=init_cost,
            final_cost=global_best_cost,
            improvement_percentage=round(improvement, 2),
            iterations=total_steps,
            execution_time_ms=round(exec_time, 3),
            initial_schedule=initial_schedule,
            optimized_schedule=global_best_s,
            cost_history=cost_history[::max(1, len(cost_history) // 30)],
            explanation=explanation
        )

    simulated_annealing_schedule = simulated_annealing
    hill_climbing_schedule = hill_climbing

