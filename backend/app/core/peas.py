from pydantic import BaseModel
from typing import List, Dict, Any


class PEASSpecification(BaseModel):
    """
    PEAS description of the coordinator agent.

    HONESTY NOTE: this is a *software* agent. Its "sensors" are data feeds produced by the
    application itself - the request form, the simulation state and the knowledge base. No
    physical sensor, vehicle telemetry unit or charging hardware exists anywhere in the
    project, and the "actuators" are decisions written into the simulation state.
    """

    agent_name: str = "EV Charging Coordinator Agent"

    performance_measure: List[str] = [
        "Minimise average EV queuing & charging waiting time (minutes) - measured by the simulation clock",
        "Avoid grid transformer overload incidents (keep modelled load below the 450 kW rating)",
        "Maximise charger utilisation and revenue in the modelled station network",
        "Serve emergency-priority vehicles first (measured: emergency EVs completed)",
        "Meet each vehicle's charging deadline (measured: timed-out EV count)",
    ]

    environment: List[str] = [
        "A network of 22 charging stations / 76 chargers with static public metadata and simulated occupancy",
        "A stream of arriving EVs with different battery sizes, connector needs and deadlines",
        "A modelled 450 kW grid transformer feed with a published per-station tariff",
        "Simulated station faults and demand spikes injected by the user or the scenario runner",
        "A partially observable, dynamic environment: future arrivals and station faults are unknown in advance",
    ]

    actuators: List[str] = [
        "Assign an EV request to a station and a charger",
        "Schedule the charging time slot (CSP backtracking search)",
        "Set the charging power for the session (kW throttle)",
        "Pre-empt the queue for emergency-priority vehicles",
        "Defer or reject a session when the modelled transformer headroom is exhausted",
    ]

    sensors: List[str] = [
        "User request fields (state of charge, deadline, priority, connector, location) - USER INPUT",
        "Station and charger status read from the environment snapshot - SIMULATED DATA",
        "Grid transformer load read from the environment snapshot - SIMULATED DATA",
        "Knowledge-base facts derived from the above by the rule engine - CLASSICAL AI COMPUTATION",
    ]


class PEASMetrics(BaseModel):
    total_evs_processed: int = 0
    completed_evs: int = 0
    timed_out_evs: int = 0
    average_wait_time_min: float = 0.0
    grid_overload_incidents: int = 0
    peak_grid_load_kw: float = 0.0
    solar_utilized_kwh: float = 0.0
    station_avg_utilization_pct: float = 0.0
    emergency_evs_serviced: int = 0
    total_energy_delivered_kwh: float = 0.0


def get_default_peas_spec() -> PEASSpecification:
    return PEASSpecification()
