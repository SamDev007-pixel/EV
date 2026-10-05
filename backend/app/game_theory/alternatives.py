from typing import List, Dict, Any
from pydantic import BaseModel, Field


class ActionAlternative(BaseModel):
    id: str
    title: str
    station_id: str
    charger_id: str
    start_time_min: int
    duration_min: int
    power_kw: float
    energy_source: str = "GRID_PEAK"  # "SOLAR_RENEWABLE", "BATTERY_STORAGE", "GRID_PEAK"
    unit_cost_usd_kwh: float = 0.25
    total_cost_usd: float = 0.0
    description: str

    @property
    def end_time_min(self) -> int:
        return self.start_time_min + self.duration_min

    @property
    def energy_kwh(self) -> float:
        return round(self.power_kw * (self.duration_min / 60.0), 2)


class AlternativeGenerator:
    @staticmethod
    def generate_candidate_alternatives(
        ev_id: str = "EV-101",
        energy_needed_kwh: float = 36.0,
        ev_arrival_min: int = 0,
        ev_deadline_min: int = 120,
        default_station_id: str = "CS-METRO",
        default_charger_id: str = "CS-METRO-CH-1"
    ) -> List[ActionAlternative]:
        """
        Generates discrete candidate resolution alternatives representing competing agent priorities.
        """
        alternatives = [
            ActionAlternative(
                id="ALT-1",
                title="Immediate Max Power Charging (EV Preference)",
                station_id=default_station_id,
                charger_id=default_charger_id,
                start_time_min=0,
                duration_min=15,
                power_kw=150.0,
                energy_source="GRID_PEAK",
                unit_cost_usd_kwh=0.28,
                total_cost_usd=round(36.0 * 0.28, 2),
                description="EV starts immediately at maximum 150 kW power. High EV utility, but risks grid transformer overload."
            ),
            ActionAlternative(
                id="ALT-2",
                title="Power-Throttled Safe Charging (Grid Compromise)",
                station_id=default_station_id,
                charger_id=default_charger_id,
                start_time_min=0,
                duration_min=30,
                power_kw=75.0,
                energy_source="GRID_PEAK",
                unit_cost_usd_kwh=0.25,
                total_cost_usd=round(36.0 * 0.25, 2),
                description="EV starts immediately at throttled 75 kW power. Extends duration by 15 min, keeping grid load within safe limits."
            ),
            ActionAlternative(
                id="ALT-3",
                title="Staggered Time Window Charging (Station/Grid Compromise)",
                station_id=default_station_id,
                charger_id=default_charger_id,
                start_time_min=30,
                duration_min=20,
                power_kw=110.0,
                energy_source="BATTERY_STORAGE",
                unit_cost_usd_kwh=0.20,
                total_cost_usd=round(36.0 * 0.20, 2),
                description="EV delays start by 30 min until grid demand drops and battery storage becomes available."
            ),
            ActionAlternative(
                id="ALT-4",
                title="Green Renewable Charging (Energy Compromise)",
                station_id="CS-NORTH",
                charger_id="CS-NORTH-CH-1",
                start_time_min=45,
                duration_min=25,
                power_kw=90.0,
                energy_source="SOLAR_RENEWABLE",
                unit_cost_usd_kwh=0.08,
                total_cost_usd=round(36.0 * 0.08, 2),
                description="EV delays start by 45 min to utilize 100% solar renewable energy at lowest cost ($0.08/kWh)."
            ),
            ActionAlternative(
                id="ALT-5",
                title="Secondary Station Reroute (Station Queue Compromise)",
                station_id="CS-SOUTH",
                charger_id="CS-SOUTH-CH-1",
                start_time_min=15,
                duration_min=20,
                power_kw=110.0,
                energy_source="GRID_PEAK",
                unit_cost_usd_kwh=0.22,
                total_cost_usd=round(36.0 * 0.22, 2),
                description="Reroutes EV to Zeon Electronic City Fast Hub to avoid central metro queue."
            )
        ]

        return alternatives
