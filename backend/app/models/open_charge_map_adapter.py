from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class ExternalChargingStation(BaseModel):
    """
    Normalized Domain Model for External Charging Stations.
    Protects the internal system domain from external API schema changes.
    Enforces Data Honesty: Separates external metadata from simulated operational state.
    """
    stationId: str
    stationName: str
    latitude: float
    longitude: float
    address: str
    country: str
    operator: str
    usageType: str
    operationalStatus: str
    numberOfConnections: int
    connectorTypes: List[str]
    chargingPowerKW: float
    connectionStatus: str
    dataSource: str = "OPEN_CHARGE_MAP"
    availabilityMode: str = "EXTERNAL_METADATA"
    
    # Dynamic Simulation State (Separated for Data Honesty)
    simulatedTotalChargers: int = 4
    simulatedOccupiedChargers: int = 0
    simulatedAvailableChargers: int = 4
    simulatedQueueLength: int = 0
    simulatedStatus: str = "OPERATIONAL"

    def to_internal_dict(self) -> Dict[str, Any]:
        """Convert normalized external station to internal ChargingStation representation."""
        return {
            "id": self.stationId,
            "name": self.stationName,
            "location_name": self.address,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "country": self.country,
            "operator": self.operator,
            "status": self.simulatedStatus,
            "externalStatus": self.operationalStatus,
            "total_ports": self.simulatedTotalChargers,
            "occupied_ports": self.simulatedOccupiedChargers,
            "available_ports": self.simulatedAvailableChargers,
            "queue_length": self.simulatedQueueLength,
            "charging_power_kw": self.chargingPowerKW,
            "connector_types": self.connectorTypes,
            "data_source": self.dataSource,
            "availability_mode": self.availabilityMode,
            "price_per_kwh": 15.00
        }


class OpenChargeMapAdapter:
    """
    Adapter converting raw Open Charge Map POI API JSON responses
    into normalized ExternalChargingStation domain models.
    """

    @staticmethod
    def normalize_station(raw_poi: Dict[str, Any]) -> ExternalChargingStation:
        """Parse raw Open Charge Map dictionary item into normalized ExternalChargingStation model."""
        ocm_id = raw_poi.get("ID") or raw_poi.get("id") or 0
        station_id = f"OCM-{ocm_id}" if not str(ocm_id).startswith("OCM-") else str(ocm_id)
        
        # Title & Operator
        address_info = raw_poi.get("AddressInfo") or {}
        station_name = address_info.get("Title") or raw_poi.get("Title") or f"Charging Hub #{ocm_id}"
        
        operator_info = raw_poi.get("OperatorInfo") or {}
        operator_name = operator_info.get("Title") or "Independent / Public EV Network"
        
        # Address & Geographic Location
        address_line = address_info.get("AddressLine1") or ""
        town = address_info.get("Town") or address_info.get("StateOrProvince") or ""
        country_info = address_info.get("Country") or {}
        country_name = country_info.get("Title") or "India"
        
        full_address = ", ".join([p for p in [address_line, town, country_name] if p]) or "Bengaluru Smart Corridor, India"
        
        latitude = float(address_info.get("Latitude") or 12.9716)
        longitude = float(address_info.get("Longitude") or 77.5946)
        
        # Usage Type & Status
        usage_info = raw_poi.get("UsageType") or {}
        usage_type = usage_info.get("Title") or "Public Charging"
        
        status_info = raw_poi.get("StatusType") or {}
        is_operational = status_info.get("IsOperational") if status_info else True
        operational_status = "OPERATIONAL" if is_operational is not False else "FAULT"
        connection_status_title = status_info.get("Title") or ("Operational" if is_operational else "Offline/Unknown")
        
        # Connections / Charger Ports & Power
        connections = raw_poi.get("Connections") or []
        num_connections = len(connections) if connections else 4
        
        connector_types = []
        max_power = 50.0  # Default fast charger capacity in kW
        
        for conn in connections:
            conn_type = conn.get("ConnectionType") or {}
            conn_title = conn_type.get("Title") or "CCS (Type 2)"
            if conn_title not in connector_types:
                connector_types.append(conn_title)
                
            power_kw = conn.get("PowerKW")
            if power_kw and float(power_kw) > max_power:
                max_power = float(power_kw)
                
        if not connector_types:
            connector_types = ["CCS2 Fast Charger", "Type 2 AC"]

        return ExternalChargingStation(
            stationId=station_id,
            stationName=station_name,
            latitude=latitude,
            longitude=longitude,
            address=full_address,
            country=country_name,
            operator=operator_name,
            usageType=usage_type,
            operationalStatus=operational_status,
            numberOfConnections=max(1, num_connections),
            connectorTypes=connector_types,
            chargingPowerKW=max_power,
            connectionStatus=connection_status_title,
            dataSource="OPEN_CHARGE_MAP",
            availabilityMode="EXTERNAL_METADATA",
            simulatedTotalChargers=max(1, num_connections),
            simulatedOccupiedChargers=0,
            simulatedAvailableChargers=max(1, num_connections),
            simulatedQueueLength=0,
            simulatedStatus=operational_status
        )

    @classmethod
    def normalize_station_list(cls, raw_poi_list: List[Dict[str, Any]]) -> List[ExternalChargingStation]:
        """Convert list of raw Open Charge Map POI dicts into normalized ExternalChargingStation list."""
        normalized = []
        for raw_item in raw_poi_list:
            try:
                station = cls.normalize_station(raw_item)
                normalized.append(station)
            except Exception:
                continue
        return normalized
