from typing import Dict, List, Any
from app.csp.variables import CSPEVVariable, CSPProblemState


def get_preset_csp_scenario(scenario_name: str = "NORMAL_DEMAND") -> CSPProblemState:
    """
    Generates preset CSP benchmark test problem scenarios.
    Supported scenario_name:
    - "NORMAL_DEMAND"
    - "CHARGER_SHORTAGE"
    - "GRID_CAPACITY_SHORTAGE"
    - "DEADLINE_CONFLICTS"
    - "NO_FEASIBLE_SOLUTION"
    """
    time_step = 15
    max_horizon = 240

    # Default Stations & Chargers
    stations = {
        "CS-NORTH": {
            "id": "CS-NORTH",
            "name": "Kazam EV - Hebbal Tech Park Supercharger",
            "chargingPower": 200.0,
            "energyPrice": 0.22,
            "operatingStatus": "OPERATIONAL",
            "location": {"x": 2.5, "y": 8.0},
            "chargers": ["CS-NORTH-CH-1", "CS-NORTH-CH-2"]
        },
        "CS-METRO": {
            "id": "CS-METRO",
            "name": "Tata Power - MG Road Central Metro EV Hub",
            "chargingPower": 250.0,
            "energyPrice": 0.28,
            "operatingStatus": "OPERATIONAL",
            "location": {"x": 5.0, "y": 5.0},
            "chargers": ["CS-METRO-CH-1", "CS-METRO-CH-2"]
        }
    }

    chargers = {
        "CS-NORTH-CH-1": {"id": "CS-NORTH-CH-1", "stationId": "CS-NORTH", "chargerType": "ULTRA_FAST", "maximumPower": 150.0, "currentStatus": "AVAILABLE"},
        "CS-NORTH-CH-2": {"id": "CS-NORTH-CH-2", "stationId": "CS-NORTH", "chargerType": "DC_FAST", "maximumPower": 50.0, "currentStatus": "AVAILABLE"},
        "CS-METRO-CH-1": {"id": "CS-METRO-CH-1", "stationId": "CS-METRO", "chargerType": "ULTRA_FAST", "maximumPower": 150.0, "currentStatus": "AVAILABLE"},
        "CS-METRO-CH-2": {"id": "CS-METRO-CH-2", "stationId": "CS-METRO", "chargerType": "DC_FAST", "maximumPower": 50.0, "currentStatus": "AVAILABLE"},
    }

    grid_capacity = 450.0

    if scenario_name == "NORMAL_DEMAND":
        evs = {
            "EV-101": CSPEVVariable(
                ev_id="EV-101", priority="STANDARD", battery_capacity=60.0, current_battery=12.0, required_battery=48.0,
                charging_rate=100.0, arrival_time=0, departure_deadline=120, location={"x": 4.0, "y": 4.5}, charger_type_needed="DC_FAST"
            ),
            "EV-102": CSPEVVariable(
                ev_id="EV-102", priority="HIGH", battery_capacity=50.0, current_battery=10.0, required_battery=40.0,
                charging_rate=100.0, arrival_time=0, departure_deadline=90, location={"x": 6.0, "y": 5.5}, charger_type_needed="DC_FAST"
            ),
            "EV-EMERGENCY": CSPEVVariable(
                ev_id="EV-EMERGENCY", priority="EMERGENCY", battery_capacity=90.0, current_battery=9.0, required_battery=81.0,
                charging_rate=150.0, arrival_time=0, departure_deadline=45, location={"x": 2.0, "y": 7.5}, charger_type_needed="ULTRA_FAST"
            )
        }

    elif scenario_name == "CHARGER_SHORTAGE":
        # 5 EVs competing for only 2 operational chargers
        stations = {
            "CS-METRO": {
                "id": "CS-METRO",
                "name": "Tata Power - MG Road Central Metro EV Hub",
                "chargingPower": 300.0,
                "energyPrice": 0.25,
                "operatingStatus": "OPERATIONAL",
                "location": {"x": 5.0, "y": 5.0},
                "chargers": ["CS-METRO-CH-1", "CS-METRO-CH-2"]
            }
        }
        chargers = {
            "CS-METRO-CH-1": {"id": "CS-METRO-CH-1", "stationId": "CS-METRO", "chargerType": "DC_FAST", "maximumPower": 50.0, "currentStatus": "AVAILABLE"},
            "CS-METRO-CH-2": {"id": "CS-METRO-CH-2", "stationId": "CS-METRO", "chargerType": "DC_FAST", "maximumPower": 50.0, "currentStatus": "AVAILABLE"}
        }
        evs = {
            "EV-S1": CSPEVVariable(ev_id="EV-S1", arrival_time=0, departure_deadline=60, required_battery=30.0, current_battery=5.0),
            "EV-S2": CSPEVVariable(ev_id="EV-S2", arrival_time=0, departure_deadline=90, required_battery=30.0, current_battery=5.0),
            "EV-S3": CSPEVVariable(ev_id="EV-S3", arrival_time=15, departure_deadline=120, required_battery=30.0, current_battery=5.0),
            "EV-S4": CSPEVVariable(ev_id="EV-S4", arrival_time=30, departure_deadline=150, required_battery=30.0, current_battery=5.0),
        }

    elif scenario_name == "GRID_CAPACITY_SHORTAGE":
        # Transformer capacity constricted to 100 kW, forcing power throttling
        grid_capacity = 100.0
        evs = {
            "EV-G1": CSPEVVariable(ev_id="EV-G1", arrival_time=0, departure_deadline=120, charging_rate=150.0, required_battery=60.0, current_battery=10.0),
            "EV-G2": CSPEVVariable(ev_id="EV-G2", arrival_time=0, departure_deadline=120, charging_rate=150.0, required_battery=60.0, current_battery=10.0),
            "EV-G3": CSPEVVariable(ev_id="EV-G3", arrival_time=0, departure_deadline=120, charging_rate=150.0, required_battery=60.0, current_battery=10.0),
        }

    elif scenario_name == "DEADLINE_CONFLICTS":
        # Extremely tight deadlines arriving at the same tick
        evs = {
            "EV-D1": CSPEVVariable(ev_id="EV-D1", priority="HIGH", arrival_time=0, departure_deadline=30, required_battery=40.0, current_battery=10.0, charger_type_needed="ULTRA_FAST"),
            "EV-D2": CSPEVVariable(ev_id="EV-D2", priority="STANDARD", arrival_time=0, departure_deadline=30, required_battery=40.0, current_battery=10.0, charger_type_needed="ULTRA_FAST"),
        }

    elif scenario_name == "NO_FEASIBLE_SOLUTION":
        # Unfeasible: EV needs 60 kWh in 15 minutes (requires 240 kW), but charger max power is 50 kW!
        stations["CS-NORTH"]["operatingStatus"] = "FAULT"
        stations["CS-METRO"]["operatingStatus"] = "FAULT"
        evs = {
            "EV-UNFEASIBLE": CSPEVVariable(
                ev_id="EV-UNFEASIBLE", priority="EMERGENCY", battery_capacity=90.0, current_battery=5.0, required_battery=85.0,
                charging_rate=150.0, arrival_time=0, departure_deadline=15, location={"x": 5.0, "y": 5.0}
            )
        }

    else: # Fallback to NORMAL_DEMAND
        evs = {
            "EV-101": CSPEVVariable(ev_id="EV-101", arrival_time=0, departure_deadline=120, required_battery=40.0, current_battery=10.0)
        }

    return CSPProblemState(
        variables=evs,
        stations=stations,
        chargers=chargers,
        grid_capacity_kw=grid_capacity,
        time_step_min=time_step,
        max_time_horizon_min=max_horizon
    )
