from enum import Enum
from pydantic import BaseModel, Field, field_validator, computed_field, ConfigDict


class GridStatus(str, Enum):
    STABLE = "STABLE"
    WARNING = "WARNING"
    CRITICAL_OVERLOAD = "CRITICAL_OVERLOAD"


class GridNodeModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str = "GRID-TRANSFORMER-MAIN"
    maximumCapacity: float = Field(500.0, alias="maximum_capacity", gt=0, description="Max safe capacity in kW")
    currentLoad: float = Field(0.0, alias="current_load", ge=0, description="Current power draw in kW")
    status: GridStatus = Field(GridStatus.STABLE)

    @field_validator("maximumCapacity", "currentLoad")
    @classmethod
    def validate_non_negative(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Grid capacity and current load cannot be negative")
        return v

    @computed_field
    @property
    def availableCapacity(self) -> float:
        return max(0.0, self.maximumCapacity - self.currentLoad)

    @computed_field
    @property
    def loadPercentage(self) -> float:
        if self.maximumCapacity == 0:
            return 0.0
        return round((self.currentLoad / self.maximumCapacity) * 100.0, 1)

    def update_status(self):
        load_pct = self.loadPercentage
        if load_pct >= 95.0:
            self.status = GridStatus.CRITICAL_OVERLOAD
        elif load_pct >= 80.0:
            self.status = GridStatus.WARNING
        else:
            self.status = GridStatus.STABLE
