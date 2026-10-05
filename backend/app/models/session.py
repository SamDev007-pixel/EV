from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class SessionStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    INTERRUPTED = "INTERRUPTED"
    CANCELLED = "CANCELLED"


class ChargingSessionModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    evId: str = Field(..., alias="ev_id")
    stationId: str = Field(..., alias="station_id")
    chargerId: str = Field(..., alias="charger_id")
    startTime: int = Field(0, alias="start_time", ge=0)
    endTime: Optional[int] = Field(None, alias="end_time", ge=0)
    energyAllocated: float = Field(0.0, alias="energy_allocated", ge=0, description="Total energy delivered in kWh")
    sessionStatus: SessionStatus = Field(SessionStatus.ACTIVE, alias="session_status")

    @field_validator("energyAllocated")
    @classmethod
    def validate_energy_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Energy allocated cannot be negative")
        return v

    @model_validator(mode="after")
    def validate_session_time_window(self) -> "ChargingSessionModel":
        if self.endTime is not None and self.endTime < self.startTime:
            raise ValueError(f"Session end time ({self.endTime}) cannot be earlier than start time ({self.startTime})")
        return self
