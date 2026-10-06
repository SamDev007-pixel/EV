"""
User-supplied real Indian charging-station metadata (locations, operators, port counts).

DATA HONESTY NOTE
-----------------
These records describe **public station metadata** (location, operator, connector types,
published tariff). Occupancy, availability and live load are NOT part of this dataset.

Tariffs are published in Indian Rupees per kWh. The simulation keeps a single accounting
unit (USD), so `PRICE_CURRENCY` is tagged here and converted once when the station is
loaded into the environment (see `SimulationEngine.reset_environment`). Keeping the source
currency explicit avoids mixing ₹/kWh and $/kWh inside the same cost calculation.
"""

from typing import List, Dict, Any

#: Published tariffs in this dataset are quoted in Indian Rupees per kWh.
PRICE_CURRENCY = "INR"

#: Fixed conversion rate used for accounting. Documented, not market-live: 1 USD = 85 INR.
INR_PER_USD = 85.0


def price_in_usd(station_metadata: Dict[str, Any]) -> float:
    """Convert a dataset tariff into the simulation accounting unit (USD per kWh)."""
    price = float(station_metadata.get("price_per_kwh", 0.0))
    currency = station_metadata.get("price_currency", PRICE_CURRENCY)
    if currency == "INR":
        return round(price / INR_PER_USD, 4)
    return price


INDIAN_USER_STATIONS: List[Dict[str, Any]] = [
    {
        "id": "STATION-BESCOM-KRCIRCLE",
        "name": "BESCOM EV Fast Charging Station - KR Circle",
        "operator": "BESCOM",
        "latitude": 12.9733,
        "longitude": 77.5885,
        "address": "BESCOM Corporate Office, K.R. Circle, Bengaluru, Karnataka 560001",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS (Type 2)", "Bharat DC-001"],
        "total_ports": 4,
        "price_per_kwh": 14.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-ATHER-INDIRANAGAR",
        "name": "Ather Grid Fast Charger - Indiranagar",
        "operator": "Ather Energy",
        "latitude": 12.9784,
        "longitude": 77.6408,
        "address": "100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038",
        "charging_power_kw": 30.0,
        "connector_types": ["LECCS Fast Charger", "Type 2 AC"],
        "total_ports": 3,
        "price_per_kwh": 14.00,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-SHELL-KORAMANGALA",
        "name": "Shell Recharge EV Hub - Koramangala",
        "operator": "Shell Recharge",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "address": "80 Feet Rd, 4th Block, Koramangala, Bengaluru, Karnataka 560034",
        "charging_power_kw": 120.0,
        "connector_types": ["CCS2 Ultra-Fast 120kW", "Type 2 AC"],
        "total_ports": 4,
        "price_per_kwh": 18.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-JIOBP-BELLANDUR",
        "name": "Jio-bp pulse EV Charging Hub - Bellandur",
        "operator": "Jio-bp pulse",
        "latitude": 12.9260,
        "longitude": 77.6762,
        "address": "Outer Ring Rd, Near RMZ Ecospace, Bellandur, Bengaluru, Karnataka 560103",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 Fast Charger", "CHAdeMO"],
        "total_ports": 4,
        "price_per_kwh": 16.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-CHARGEZONE-WHITEFIELD",
        "name": "ChargeZone EV Supercharger - Whitefield",
        "operator": "ChargeZone",
        "latitude": 12.9863,
        "longitude": 77.7344,
        "address": "ITPL Main Rd, Pattandur Agrahara, Whitefield, Bengaluru, Karnataka 560066",
        "charging_power_kw": 150.0,
        "connector_types": ["CCS2 Ultra Fast 150kW", "CCS2 60kW"],
        "total_ports": 4,
        "price_per_kwh": 17.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-TATAPOWER-MALLESHWARAM",
        "name": "Tata Power EZ Charge - Malleshwaram",
        "operator": "Tata Power EZ Charge",
        "latitude": 13.0031,
        "longitude": 77.5702,
        "address": "Margosa Rd, 8th Cross, Malleshwaram, Bengaluru, Karnataka 560003",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 Fast Charger", "Type 2 AC"],
        "total_ports": 3,
        "price_per_kwh": 16.00,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-ZEON-HSR",
        "name": "Zeon EV Fast Charger - HSR Layout",
        "operator": "Zeon Charging",
        "latitude": 12.9116,
        "longitude": 77.6534,
        "address": "27th Main Rd, Sector 1, HSR Layout, Bengaluru, Karnataka 560102",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 Fast Charger", "Type 2 AC"],
        "total_ports": 3,
        "price_per_kwh": 16.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-RELUX-JAYANAGAR",
        "name": "Relux EV Charging Station - Jayanagar",
        "operator": "Relux Electric",
        "latitude": 12.9298,
        "longitude": 77.5834,
        "address": "11th Main Rd, 4th Block, Jayanagar, Bengaluru, Karnataka 560011",
        "charging_power_kw": 50.0,
        "connector_types": ["CCS2 Fast Charger"],
        "total_ports": 2,
        "price_per_kwh": 15.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-STATIQ-MARATHAHALLI",
        "name": "Statiq EV Station - Marathahalli",
        "operator": "Statiq",
        "latitude": 12.9562,
        "longitude": 77.7011,
        "address": "Marathahalli - Sarjapur Outer Ring Rd, Bengaluru, Karnataka 560037",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 Fast Charger", "Type 2 AC"],
        "total_ports": 3,
        "price_per_kwh": 16.00,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-BESCOM-RAJAJINAGAR",
        "name": "BESCOM EV Charging Hub - Rajajinagar",
        "operator": "BESCOM",
        "latitude": 12.9904,
        "longitude": 77.5528,
        "address": "Dr Rajkumar Rd, 1st Block, Rajajinagar, Bengaluru, Karnataka 560010",
        "charging_power_kw": 50.0,
        "connector_types": ["CCS2", "Bharat DC-001"],
        "total_ports": 4,
        "price_per_kwh": 14.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-BPCL-YELAHANKA",
        "name": "BPCL eDrive Fast Charger - Yelahanka",
        "operator": "BPCL eDrive",
        "latitude": 13.1007,
        "longitude": 77.5963,
        "address": "BBMP Main Rd, Sector B, Yelahanka New Town, Bengaluru, Karnataka 560064",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 Fast Charger"],
        "total_ports": 2,
        "price_per_kwh": 15.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-ATHER-BANASHANKARI",
        "name": "Ather Grid Charger - Banashankari",
        "operator": "Ather Energy",
        "latitude": 12.9254,
        "longitude": 77.5649,
        "address": "24th Cross Rd, 2nd Stage, Banashankari, Bengaluru, Karnataka 560070",
        "charging_power_kw": 30.0,
        "connector_types": ["LECCS Fast Charger"],
        "total_ports": 2,
        "price_per_kwh": 14.00,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-SHELL-YESHWANTHPUR",
        "name": "Shell Recharge EV Station - Yeshwanthpur",
        "operator": "Shell Recharge",
        "latitude": 13.0280,
        "longitude": 77.5409,
        "address": "Tumkur Rd, Near Yeshwanthpur Metro Station, Bengaluru, Karnataka 560022",
        "charging_power_kw": 120.0,
        "connector_types": ["CCS2 Ultra-Fast 120kW", "Type 2 AC"],
        "total_ports": 4,
        "price_per_kwh": 18.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-TATA-SARJAPUR",
        "name": "ChargeZone x TATA.ev Superhub - Sarjapur",
        "operator": "ChargeZone x TATA.ev",
        "latitude": 12.9102,
        "longitude": 77.6854,
        "address": "Sarjapur - Marathahalli Rd, Doddakannelli, Bengaluru, Karnataka 560035",
        "charging_power_kw": 120.0,
        "connector_types": ["CCS2 MegaCharger 120kW"],
        "total_ports": 4,
        "price_per_kwh": 17.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-HPCL-BANNERGHATTA",
        "name": "HPCL eCharge Station - Bannerghatta Road",
        "operator": "HPCL eCharge",
        "latitude": 12.8941,
        "longitude": 77.5982,
        "address": "Bannerghatta Main Rd, Bilekahalli, Bengaluru, Karnataka 560076",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 60kW", "Type 2 AC"],
        "total_ports": 3,
        "price_per_kwh": 15.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-KAZAM-MANYATA",
        "name": "Kazam EV Fast Charger - Manyata Embassy Tech Park",
        "operator": "Kazam EV",
        "latitude": 13.0487,
        "longitude": 77.6208,
        "address": "Outer Ring Rd, Manyata Tech Park, Nagavara, Bengaluru, Karnataka 560045",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 Fast Charger", "Type 2 AC"],
        "total_ports": 4,
        "price_per_kwh": 16.00,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-TATAPOWER-INDIRANAGAR",
        "name": "Tata Power EZ Charge - CMH Road Indiranagar",
        "operator": "Tata Power EZ Charge",
        "latitude": 12.9789,
        "longitude": 77.6432,
        "address": "CMH Road, Indiranagar, Bengaluru, Karnataka 560038",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 Fast Charger"],
        "total_ports": 3,
        "price_per_kwh": 16.00,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-ZEON-WHITEFIELD",
        "name": "Zeon Charging - Nexus Whitefield",
        "operator": "Zeon Charging",
        "latitude": 12.9583,
        "longitude": 77.7472,
        "address": "Whitefield Main Rd, Devasandra Industrial Estate, Bengaluru, Karnataka 560066",
        "charging_power_kw": 120.0,
        "connector_types": ["CCS2 Ultra Fast 120kW"],
        "total_ports": 4,
        "price_per_kwh": 17.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    },
    {
        "id": "STATION-JIOBP-HEBBAL",
        "name": "Jio-bp pulse EV Hub - Hebbal",
        "operator": "Jio-bp pulse",
        "latitude": 13.0380,
        "longitude": 77.5890,
        "address": "Bellary Rd, Near Hebbal Lake, Bengaluru, Karnataka 560024",
        "charging_power_kw": 60.0,
        "connector_types": ["CCS2 Fast Charger", "Type 2 AC"],
        "total_ports": 4,
        "price_per_kwh": 16.50,
        "data_source": "OPENSTREETMAP_VERIFIED"
    }
]

# Every record in this dataset is quoted in INR; tag it explicitly so that the
# conversion is verifiable rather than implicit.
for _station in INDIAN_USER_STATIONS:
    _station.setdefault("price_currency", PRICE_CURRENCY)
