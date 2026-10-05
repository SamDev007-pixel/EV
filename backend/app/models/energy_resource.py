from enum import Enum
from pydantic import BaseModel, Field, field_validator, ConfigDict


class EnergyResourceType(str, Enum):
    GRID = "GRID"
    SOLAR = "SOLAR"
    WIND = "WIND"
    BATTERY_STORAGE = "BATTERY_STORAGE"


class EnergyAvailabilityStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    LIMITED = "LIMITED"
    UNAVAILABLE = "UNAVAILABLE"


class EnergyResourceModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    type: EnergyResourceType = Field(EnergyResourceType.GRID)
    availablePower: float = Field(100.0, alias="available_power", ge=0, description="Available power output in kW")
    cost: float = Field(0.15, ge=0, description="Cost rate per kWh in USD")
    availabilityStatus: EnergyAvailabilityStatus = Field(EnergyAvailabilityStatus.AVAILABLE, alias="availability_status")

    @field_validator("availablePower", "cost")
    @classmethod
    def validate_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Energy power and cost cannot be negative")
        return v
