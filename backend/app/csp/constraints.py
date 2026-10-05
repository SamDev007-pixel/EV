from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Tuple, Any
from app.csp.variables import CSPDomainValue, CSPEVVariable, CSPAssignment, CSPProblemState


class HardConstraint(ABC):
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        """
        Checks if assigning `val` to `ev_id` violates this hard constraint given current partial `assignment`.
        Returns (is_satisfied: bool, violation_reason: Optional[str]).
        """
        pass


# --- 1. CHARGER NON-OVERLAP CONSTRAINT ---
class NoChargerOverlapConstraint(HardConstraint):
    def name(self) -> str:
        return "NoChargerOverlap"

    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        for other_id, other_val in assignment.assignments.items():
            if other_id == ev_id:
                continue
            
            if other_val.charger_id == val.charger_id:
                # Time overlap check: max(start1, start2) < min(end1, end2)
                overlap = max(val.start_time_min, other_val.start_time_min) < min(val.end_time_min, other_val.end_time_min)
                if overlap:
                    return False, f"Charger {val.charger_id} is already serving {other_id} between {other_val.start_time_min}m-{other_val.end_time_min}m"

        return True, None


# --- 2. STATION POWER CAPACITY CONSTRAINT ---
class StationPowerCapacityConstraint(HardConstraint):
    def name(self) -> str:
        return "StationPowerCapacity"

    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        station = problem.stations.get(val.station_id)
        if not station:
            return False, f"Station {val.station_id} not found"

        station_max_power = station.get("chargingPower", 250.0)
        time_step = problem.time_step_min

        # Check total power at each time slot in interval [val.start_time_min, val.end_time_min)
        for t in range(val.start_time_min, val.end_time_min, time_step):
            t_power = val.power_kw
            for other_id, other_val in assignment.assignments.items():
                if other_id == ev_id:
                    continue
                if other_val.station_id == val.station_id:
                    if other_val.start_time_min <= t < other_val.end_time_min:
                        t_power += other_val.power_kw

            if t_power > station_max_power:
                return False, f"Station {val.station_id} power capacity ({station_max_power} kW) exceeded at {t} min (Requested {t_power:.1f} kW)"

        return True, None


# --- 3. GRID TRANSFORMER CAPACITY CONSTRAINT ---
class GridTransformerCapacityConstraint(HardConstraint):
    def name(self) -> str:
        return "GridTransformerCapacity"

    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        grid_limit = problem.grid_capacity_kw
        time_step = problem.time_step_min

        for t in range(val.start_time_min, val.end_time_min, time_step):
            total_grid_power = val.power_kw
            for other_id, other_val in assignment.assignments.items():
                if other_id == ev_id:
                    continue
                if other_val.start_time_min <= t < other_val.end_time_min:
                    total_grid_power += other_val.power_kw

            if total_grid_power > grid_limit:
                return False, f"Grid transformer capacity ({grid_limit} kW) exceeded at {t} min (Total load {total_grid_power:.1f} kW)"

        return True, None


# --- 4. DEPARTURE DEADLINE CONSTRAINT ---
class DepartureDeadlineConstraint(HardConstraint):
    def name(self) -> str:
        return "DepartureDeadline"

    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        ev_var = problem.variables.get(ev_id)
        if not ev_var:
            return False, f"EV variable {ev_id} not found"

        if val.end_time_min > ev_var.departure_deadline:
            return False, f"Session completion time ({val.end_time_min} min) exceeds EV departure deadline ({ev_var.departure_deadline} min)"

        if val.start_time_min < ev_var.arrival_time:
            return False, f"Session start time ({val.start_time_min} min) is prior to EV arrival time ({ev_var.arrival_time} min)"

        return True, None


# --- 5. EV MAX POWER LIMIT CONSTRAINT ---
class EVMaxPowerLimitConstraint(HardConstraint):
    def name(self) -> str:
        return "EVMaxPowerLimit"

    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        ev_var = problem.variables.get(ev_id)
        charger = problem.chargers.get(val.charger_id)

        if not ev_var or not charger:
            return False, "EV or Charger details missing"

        max_allowed_power = min(ev_var.charging_rate, charger.get("maximumPower", 150.0))
        if val.power_kw > (max_allowed_power + 0.1):
            return False, f"Allocated power ({val.power_kw} kW) exceeds EV/Charger limit ({max_allowed_power} kW)"

        return True, None


# --- 6. CHARGER COMPATIBILITY CONSTRAINT ---
class ChargerCompatibilityConstraint(HardConstraint):
    def name(self) -> str:
        return "ChargerCompatibility"

    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        ev_var = problem.variables.get(ev_id)
        charger = problem.chargers.get(val.charger_id)

        if not ev_var or not charger:
            return False, "EV or Charger details missing"

        needed = ev_var.charger_type_needed
        supported = charger.get("chargerType", "DC_FAST")
        
        # Accept if exact match or if charger is ULTRA_FAST for DC_FAST request
        if needed == "ULTRA_FAST" and supported != "ULTRA_FAST":
            return False, f"EV requires ULTRA_FAST charger but charger {val.charger_id} is {supported}"

        return True, None


# --- 7. ENERGY AVAILABILITY CONSTRAINT ---
class EnergyAvailabilityConstraint(HardConstraint):
    def name(self) -> str:
        return "EnergyAvailability"

    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        ev_var = problem.variables.get(ev_id)
        if not ev_var:
            return False, f"EV {ev_id} not found"

        req_kwh = ev_var.energy_required_kwh
        # Must allocate at least 90% of required energy
        if val.energy_kwh < (req_kwh * 0.90):
            return False, f"Allocated energy ({val.energy_kwh:.1f} kWh) is insufficient for EV requirement ({req_kwh:.1f} kWh)"

        return True, None


# --- 8. OPERATIONAL STATION CONSTRAINT ---
class OperationalStationConstraint(HardConstraint):
    def name(self) -> str:
        return "OperationalStation"

    def check(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        station = problem.stations.get(val.station_id)
        charger = problem.chargers.get(val.charger_id)

        if not station or not charger:
            return False, f"Station {val.station_id} or Charger {val.charger_id} not found"

        if station.get("operatingStatus") == "FAULT":
            return False, f"Station {val.station_id} is in FAULT status and cannot receive new sessions"

        if charger.get("currentStatus") in ["FAULT", "MAINTENANCE"]:
            return False, f"Charger {val.charger_id} is in {charger.get('currentStatus')} status"

        return True, None


# All 8 Hard Constraints Suite
DEFAULT_HARD_CONSTRAINTS: List[HardConstraint] = [
    NoChargerOverlapConstraint(),
    StationPowerCapacityConstraint(),
    GridTransformerCapacityConstraint(),
    DepartureDeadlineConstraint(),
    EVMaxPowerLimitConstraint(),
    ChargerCompatibilityConstraint(),
    EnergyAvailabilityConstraint(),
    OperationalStationConstraint()
]
