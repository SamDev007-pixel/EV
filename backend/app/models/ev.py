from enum import Enum
from typing import Optional, Dict
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class EVStatus(str, Enum):
    QUEUED = "QUEUED"
    CHARGING = "CHARGING"
    COMPLETED = "COMPLETED"
    TIMED_OUT = "TIMED_OUT"
    CANCELLED = "CANCELLED"


class EVPriority(str, Enum):
    STANDARD = "STANDARD"
    HIGH = "HIGH"
    EMERGENCY = "EMERGENCY"


class EVModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    batteryCapacity: float = Field(..., alias="battery_capacity", gt=0, description="Total battery capacity in kWh")
    currentBatteryLevel: float = Field(..., alias="current_battery_level", ge=0, description="Current battery level in kWh")
    requiredBatteryLevel: float = Field(..., alias="required_battery_level", ge=0, description="Required target battery level in kWh")
    chargingRate: float = Field(..., alias="charging_rate", ge=0, description="Max charging rate accepted in kW")
    arrivalTime: int = Field(0, alias="arrival_time", ge=0, description="Arrival tick time in minutes")
    departureDeadline: int = Field(120, alias="departure_deadline", ge=0, description="Departure deadline tick time in minutes")
    
    destination: Dict[str, float] = Field(default_factory=lambda: {"x": 5.0, "y": 5.0})
    currentLocation: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0}, alias="current_location")
    
    priority: EVPriority = Field(EVPriority.STANDARD)
    status: EVStatus = Field(EVStatus.QUEUED)
    
    assignedStationId: Optional[str] = Field(None, alias="assigned_station_id")
    assignedChargerId: Optional[str] = Field(None, alias="assigned_charger_id")
    totalCostUSD: float = Field(0.0, alias="total_cost_usd", ge=0)
    waitTimeMin: int = Field(0, alias="wait_time_min", ge=0)
    # Straight-line distance (km) to the station this EV was assigned to, captured at
    # assignment time. Needed because `assignedStationId` is cleared when the session ends,
    # so a post-run measurement could not recover how far the vehicle actually drove.
    travelDistanceKm: float = Field(0.0, alias="travel_distance_km", ge=0)

    @property
    def chargingRequired(self) -> float:
        return max(0.0, self.requiredBatteryLevel - self.currentBatteryLevel)

    @field_validator("currentBatteryLevel", "requiredBatteryLevel")
    @classmethod
    def validate_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Battery level cannot be negative")
        return v

    @field_validator("chargingRate")
    @classmethod
    def validate_charging_rate(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Charging rate cannot be negative")
        return v

    @model_validator(mode="after")
    def validate_ev_constraints(self) -> "EVModel":
        if self.currentBatteryLevel > self.batteryCapacity:
            raise ValueError(f"Current battery level ({self.currentBatteryLevel} kWh) cannot exceed battery capacity ({self.batteryCapacity} kWh)")
        if self.requiredBatteryLevel > self.batteryCapacity:
            raise ValueError(f"Required battery level ({self.requiredBatteryLevel} kWh) cannot exceed battery capacity ({self.batteryCapacity} kWh)")
        if self.departureDeadline <= self.arrivalTime:
            raise ValueError(f"Departure deadline ({self.departureDeadline} min) must be strictly after arrival time ({self.arrivalTime} min)")
        return self
