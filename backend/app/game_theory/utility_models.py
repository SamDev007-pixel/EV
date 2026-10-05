from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class AgentPreferences(BaseModel):
    agent_id: str
    agent_role: str
    goals: List[str]
    disagreement_point_d: float = 0.0  # Min utility threshold below which agent refuses consensus
    weight: float = 1.0


class UtilityBreakdown(BaseModel):
    agent_role: str
    utility_score: float
    explanation: str


class EVAgentUtility:
    @staticmethod
    def evaluate(
        start_time_min: int,
        duration_min: int,
        charging_cost_usd: float,
        ev_arrival_min: int = 0,
        ev_deadline_min: int = 120,
        budget_usd: float = 15.0
    ) -> UtilityBreakdown:
        wait_time = max(0, start_time_min - ev_arrival_min)
        end_time = start_time_min + duration_min

        if end_time > ev_deadline_min:
            # Deadline breached! Severe utility penalty
            return UtilityBreakdown(
                agent_role="EV_AGENT",
                utility_score=0.0,
                explanation=f"EV Utility = 0.0 (Deadline of {ev_deadline_min}m breached: session finishes at {end_time}m)"
            )

        wait_penalty = wait_time * 1.2
        cost_ratio = (charging_cost_usd / budget_usd) if budget_usd > 0 else 0.5
        cost_penalty = cost_ratio * 30.0

        score = max(0.0, min(100.0, 100.0 - wait_penalty - cost_penalty))
        explanation = f"EV Utility = {score:.1f} (Wait time: {wait_time}m, Cost: ${charging_cost_usd:.2f})"
        
        return UtilityBreakdown(
            agent_role="EV_AGENT",
            utility_score=round(score, 1),
            explanation=explanation
        )


class StationAgentUtility:
    @staticmethod
    def evaluate(
        power_kw: float,
        max_charger_power: float = 150.0,
        station_queue_length: int = 2,
        is_operational: bool = True
    ) -> UtilityBreakdown:
        if not is_operational:
            return UtilityBreakdown(
                agent_role="STATION_AGENT",
                utility_score=0.0,
                explanation="Station Utility = 0.0 (Station is in FAULT status)"
            )

        power_util_ratio = min(1.0, power_kw / max_charger_power) if max_charger_power > 0 else 0.5
        util_score = power_util_ratio * 60.0
        queue_clearing_bonus = min(40.0, station_queue_length * 15.0)

        score = max(0.0, min(100.0, util_score + queue_clearing_bonus))
        explanation = f"Station Utility = {score:.1f} (Charger power ratio: {power_util_ratio*100:.0f}%, Queue clearing bonus: +{queue_clearing_bonus:.0f})"

        return UtilityBreakdown(
            agent_role="STATION_AGENT",
            utility_score=round(score, 1),
            explanation=explanation
        )


class GridAgentUtility:
    @staticmethod
    def evaluate(
        requested_power_kw: float,
        current_grid_load_kw: float = 200.0,
        transformer_capacity_kw: float = 300.0
    ) -> UtilityBreakdown:
        projected_load = current_grid_load_kw + requested_power_kw

        if projected_load > transformer_capacity_kw:
            # Overload incident! Zero utility for safety
            return UtilityBreakdown(
                agent_role="GRID_AGENT",
                utility_score=0.0,
                explanation=f"Grid Utility = 0.0 (Transformer overload! Projected load {projected_load:.1f} kW exceeds limit {transformer_capacity_kw:.1f} kW)"
            )

        headroom_ratio = (transformer_capacity_kw - projected_load) / transformer_capacity_kw
        score = max(0.0, min(100.0, headroom_ratio * 100.0))
        explanation = f"Grid Utility = {score:.1f} (Safe load: {projected_load:.1f}/{transformer_capacity_kw:.1f} kW, {headroom_ratio*100:.0f}% safety headroom)"

        return UtilityBreakdown(
            agent_role="GRID_AGENT",
            utility_score=round(score, 1),
            explanation=explanation
        )


class EnergyAgentUtility:
    @staticmethod
    def evaluate(
        energy_source: str = "GRID_PEAK",
        unit_cost_usd_kwh: float = 0.28,
        renewable_available: bool = False
    ) -> UtilityBreakdown:
        if energy_source == "SOLAR_RENEWABLE":
            score = 95.0
            explanation = "Energy Utility = 95.0 (Optimal: 100% Zero-Carbon Solar energy used)"
        elif energy_source == "BATTERY_STORAGE":
            score = 80.0
            explanation = "Energy Utility = 80.0 (High: Stored off-peak battery energy used)"
        else: # GRID_PEAK
            if renewable_available:
                score = 30.0
                explanation = "Energy Utility = 30.0 (Sub-optimal: Using peak grid power despite solar availability)"
            else:
                score = 50.0
                explanation = f"Energy Utility = 50.0 (Standard grid power at ${unit_cost_usd_kwh:.2f}/kWh)"

        return UtilityBreakdown(
            agent_role="ENERGY_AGENT",
            utility_score=round(score, 1),
            explanation=explanation
        )
