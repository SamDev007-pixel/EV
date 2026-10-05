from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, Field, field_validator, computed_field, ConfigDict
from app.models.charger import ChargerModel, ChargerType, ChargerStatus


class StationOperatingStatus(str, Enum):
    OPERATIONAL = "OPERATIONAL"
    FAULT = "FAULT"
    DEGRADED = "DEGRADED"
    OVERLOADED = "OVERLOADED"


class StationModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)

    id: str
    name: str
    location: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    numberOfChargers: int = Field(4, alias="number_of_chargers", ge=0)
    chargingPower: float = Field(200.0, alias="charging_power", ge=0, description="Total station capacity in kW")
    currentQueue: List[str] = Field(default_factory=list, alias="current_queue", description="Queued EV IDs")
    operatingStatus: StationOperatingStatus = Field(StationOperatingStatus.OPERATIONAL, alias="operating_status")
    energyPrice: float = Field(0.25, alias="energy_price", ge=0, description="Price per kWh in USD")
    chargers: List[ChargerModel] = Field(default_factory=list)
    dataSource: str = Field("OPEN_CHARGE_MAP", alias="data_source")
    availabilityMode: str = Field("EXTERNAL_METADATA", alias="availability_mode")
    operatorName: Optional[str] = Field("Independent Operator", alias="operator_name")
    address: Optional[str] = Field(None, alias="address")
    latitude: Optional[float] = Field(None, alias="latitude")
    longitude: Optional[float] = Field(None, alias="longitude")

    @field_validator("energyPrice", "chargingPower")
    @classmethod
    def validate_non_negative_values(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Energy price and charging power cannot be negative")
        return v

    @computed_field
    @property
    def chargerTypes(self) -> List[str]:
        return list(set(c.chargerType.value for c in self.chargers)) if self.chargers else ["DC_FAST"]

    @computed_field
    @property
    def utilization(self) -> float:
        if not self.chargers:
            return 0.0
        occupied_count = sum(1 for c in self.chargers if c.currentStatus == ChargerStatus.OCCUPIED)
        return round((occupied_count / len(self.chargers)) * 100.0, 1)

    @computed_field
    @property
    def currentDrawKW(self) -> float:
        return sum(c.activePower for c in self.chargers)
