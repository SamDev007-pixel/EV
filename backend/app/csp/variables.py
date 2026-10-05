from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, Field


class CSPDomainValue(BaseModel):
    station_id: str
    charger_id: str
    start_time_min: int
    duration_min: int
    power_kw: float

    @property
    def end_time_min(self) -> int:
        return self.start_time_min + self.duration_min

    @property
    def energy_kwh(self) -> float:
        return round(self.power_kw * (self.duration_min / 60.0), 2)

    def value_key(self) -> Tuple[str, str, int, int, float]:
        return (self.station_id, self.charger_id, self.start_time_min, self.duration_min, self.power_kw)


class CSPEVVariable(BaseModel):
    ev_id: str
    priority: str = "STANDARD"  # "STANDARD", "HIGH", "EMERGENCY"
    battery_capacity: float = 60.0
    current_battery: float = 9.0
    required_battery: float = 48.0
    charging_rate: float = 100.0
    arrival_time: int = 0
    departure_deadline: int = 120
    location: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    charger_type_needed: str = "DC_FAST"
    domain: List[CSPDomainValue] = Field(default_factory=list)

    @property
    def energy_required_kwh(self) -> float:
        return max(0.0, self.required_battery - self.current_battery)


class CSPAssignment(BaseModel):
    assignments: Dict[str, CSPDomainValue] = Field(default_factory=dict)  # ev_id -> domain_value

    def is_assigned(self, ev_id: str) -> bool:
        return ev_id in self.assignments

    def get_assignment(self, ev_id: str) -> Optional[CSPDomainValue]:
        return self.assignments.get(ev_id)

    def assign(self, ev_id: str, value: CSPDomainValue):
        self.assignments[ev_id] = value

    def unassign(self, ev_id: str):
        if ev_id in self.assignments:
            del self.assignments[ev_id]

    def copy(self) -> "CSPAssignment":
        return CSPAssignment(assignments=dict(self.assignments))


class CSPProblemState(BaseModel):
    variables: Dict[str, CSPEVVariable] = Field(default_factory=dict)  # ev_id -> CSPEVVariable
    stations: Dict[str, Dict[str, Any]] = Field(default_factory=dict)  # station_id -> metadata
    chargers: Dict[str, Dict[str, Any]] = Field(default_factory=dict)  # charger_id -> metadata
    grid_capacity_kw: float = 450.0
    time_step_min: int = 15
    max_time_horizon_min: int = 240
