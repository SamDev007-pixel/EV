from typing import Dict, List, Any
from app.game_theory.alternatives import ActionAlternative, AlternativeGenerator


def get_preset_game_theory_scenario(scenario_id: str = "SCENARIO_IMMEDIATE_VS_OVERLOAD") -> Dict[str, Any]:
    """
    Generates preset multi-agent conflict scenarios for game-theoretic negotiation.
    """
    if scenario_id == "SCENARIO_IMMEDIATE_VS_OVERLOAD":
        # Problem statement example scenario:
        # EV Agent: "Wants immediate charging."
        # Grid Agent: "Charging now exceeds transformer capacity (Current: 200 kW, Requested: 150 kW, Limit: 300 kW)."
        # Station Agent: "Charger is available."
        # Energy Agent: "Low-cost energy is unavailable."
        return {
            "scenario_id": "SCENARIO_IMMEDIATE_VS_OVERLOAD",
            "name": "Immediate Charging vs Grid Transformer Overload (Problem Benchmark)",
            "description": "EV demands immediate 150 kW fast charging, but Grid transformer capacity limit (300 kW) is threatened by current 200 kW load.",
            "grid_load_kw": 200.0,
            "transformer_limit_kw": 300.0,
            "ev_deadline_min": 120,
            "custom_alternatives": AlternativeGenerator.generate_candidate_alternatives(
                ev_id="EV-07",
                energy_needed_kwh=36.0,
                ev_arrival_min=0,
                ev_deadline_min=120
            )
        }

    elif scenario_id == "SCENARIO_RENEWABLE_VS_WAIT":
        return {
            "scenario_id": "SCENARIO_RENEWABLE_VS_WAIT",
            "name": "Renewable Solar Optimization vs EV Wait Time",
            "description": "Energy Agent advocates 45 min delay to utilize zero-carbon Solar generation, conflicting with EV desire for immediate departure.",
            "grid_load_kw": 120.0,
            "transformer_limit_kw": 400.0,
            "ev_deadline_min": 150,
            "custom_alternatives": AlternativeGenerator.generate_candidate_alternatives(
                ev_id="EV-102",
                energy_needed_kwh=40.0,
                ev_arrival_min=0,
                ev_deadline_min=150
            )
        }

    elif scenario_id == "SCENARIO_STATION_QUEUE_VS_TRAVEL":
        return {
            "scenario_id": "SCENARIO_STATION_QUEUE_VS_TRAVEL",
            "name": "Station Queue Clearance vs Extra Travel Distance",
            "description": "Station A has an 8-car queue causing 40 min wait delay; Station B has 0 queue but requires 4 km additional travel.",
            "grid_load_kw": 150.0,
            "transformer_limit_kw": 350.0,
            "ev_deadline_min": 90,
            "custom_alternatives": AlternativeGenerator.generate_candidate_alternatives(
                ev_id="EV-104",
                energy_needed_kwh=30.0,
                ev_arrival_min=0,
                ev_deadline_min=90
            )
        }

    else:
        return get_preset_game_theory_scenario("SCENARIO_IMMEDIATE_VS_OVERLOAD")
