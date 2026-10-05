from pydantic import BaseModel
from typing import List, Dict, Any


class PEASSpecification(BaseModel):
    agent_name: str = "Central Intelligent EV & Resource Coordinator Agent"
    
    performance_measure: List[str] = [
        "Minimize average EV queuing & charging waiting time (minutes)",
        "Zero grid transformer capacity overload violations (Maintain load < 100%)",
        "Maximize Charging Station operator utilization & revenue",
        "100% priority fulfillment for Emergency EVs (Ambulance / Fire Services)",
        "Maximize renewable solar self-consumption & minimize peak grid draw"
    ]
    
    environment: List[str] = [
        "Distributed network of EV Charging Stations (AC, DC Fast, Ultra-Fast)",
        "Dynamic stream of arriving EVs with diverse battery sizes & deadlines",
        "Local power grid transformer feed with peak/off-peak pricing",
        "Solar PV panels & stationary energy storage batteries",
        "Unpredictable events: station outages, sudden demand spikes, emergency arrivals"
    ]
    
    actuators: List[str] = [
        "EV-to-Station & Port Assignment",
        "Dynamic Time-Slot Scheduling (A* Search & CSP Backtracking)",
        "Charging Power Allocation (kW throttles / boost)",
        "Emergency Priority Queue Preemption",
        "Grid Energy Shedding & Battery Storage Discharge Trigger"
    ]
    
    sensors: List[str] = [
        "EV Battery Telemetry (SoC %, Max kW rate, Arrival time, Deadline)",
        "Station Port Occupancy & Health Sensors (Fault/Operational)",
        "Grid Transformer Load Meters (kW total draw)",
        "Solar PV Generation Sensors",
        "Dynamic Electricity Tariff Feed ($/kWh)"
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
