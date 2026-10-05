from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict


class ChargerType(str, Enum):
    AC_SLOW = "AC_SLOW"          # 7-22 kW
    DC_FAST = "DC_FAST"          # 50-120 kW
    ULTRA_FAST = "ULTRA_FAST"    # 150-350 kW


class ChargerStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    OCCUPIED = "OCCUPIED"
    FAULT = "FAULT"
    MAINTENANCE = "MAINTENANCE"


class ChargerModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    stationId: str = Field(..., alias="station_id")
    chargerType: ChargerType = Field(ChargerType.DC_FAST, alias="charger_type")
    maximumPower: float = Field(50.0, alias="maximum_power", gt=0, description="Max power output in kW")
    currentStatus: ChargerStatus = Field(ChargerStatus.AVAILABLE, alias="current_status")
    assignedEV: Optional[str] = Field(None, alias="assigned_ev")
    activePower: float = Field(0.0, alias="active_power", ge=0, description="Current power output in kW")

    @field_validator("maximumPower", "activePower")
    @classmethod
    def validate_power_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Charging power cannot be negative")
        return v
