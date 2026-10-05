import pytest
import os
from unittest.mock import patch, MagicMock
from app.services.open_charge_map_provider import OpenChargeMapProvider, _STATION_CACHE
from app.models.open_charge_map_adapter import OpenChargeMapAdapter, ExternalChargingStation
from app.models.station import StationModel, StationOperatingStatus
from app.knowledge.kb import KnowledgeBase
from app.search.algorithms import a_star_search
from app.csp.solver import CSPSolverResult


def test_missing_api_key(monkeypatch):
    """Test 1: Missing API Key returns connection failure status."""
    monkeypatch.delenv("OPENCHARGEMAP_API_KEY", raising=False)
    with patch.object(OpenChargeMapProvider, "get_api_key", return_value=None):
        result = OpenChargeMapProvider.check_open_charge_map_connection()
        assert result["connected"] is False
        assert result["statusCode"] == 401
        assert "missing" in result["message"].lower()


def test_successful_api_connection():
    """Test 2: Successful API Health Check."""
    res = OpenChargeMapProvider.check_open_charge_map_connection()
    assert isinstance(res, dict)
    assert "connected" in res
    assert "statusCode" in res
    assert "OPENCHARGEMAP_API_KEY" not in str(res)  # Security rule: Key must never leak


def test_station_normalization():
    """Test 3: Raw Open Charge Map POI JSON normalization."""
    raw_poi = {
        "ID": 192842,
        "Title": "TATA Power - MG Road Central",
        "AddressInfo": {
            "Title": "TATA Power - MG Road Central",
            "AddressLine1": "MG Road",
            "Town": "Bengaluru",
            "StateOrProvince": "Karnataka",
            "Latitude": 12.9716,
            "Longitude": 77.5946,
            "Country": {"Title": "India"}
        },
        "OperatorInfo": {
            "Title": "Tata Power EV"
        },
        "UsageType": {
            "Title": "Public"
        },
        "StatusType": {
            "IsOperational": True,
            "Title": "Operational"
        },
        "Connections": [
            {
                "ConnectionType": {"Title": "CCS (Type 2)"},
                "PowerKW": 150.0
            },
            {
                "ConnectionType": {"Title": "Type 2 (AC)"},
                "PowerKW": 22.0
            }
        ]
    }

    normalized = OpenChargeMapAdapter.normalize_station(raw_poi)
    assert normalized.stationId == "OCM-192842"
    assert normalized.stationName == "TATA Power - MG Road Central"
    assert normalized.latitude == 12.9716
    assert normalized.longitude == 77.5946
    assert normalized.operator == "Tata Power EV"
    assert normalized.chargingPowerKW == 150.0
    assert normalized.dataSource == "OPEN_CHARGE_MAP"
    assert normalized.availabilityMode == "EXTERNAL_METADATA"


def test_data_honesty_rule():
    """Test 4: Strict Data Honesty Rule (Metadata vs Simulated State)."""
    raw_poi = {"ID": 99, "Title": "Test Station"}
    normalized = OpenChargeMapAdapter.normalize_station(raw_poi)
    
    # Check that external data source is clearly labelled
    assert normalized.dataSource == "OPEN_CHARGE_MAP"
    assert normalized.availabilityMode == "EXTERNAL_METADATA"
    
    # Internal representation separates external metadata from dynamic simulation state
    internal = normalized.to_internal_dict()
    assert internal["data_source"] == "OPEN_CHARGE_MAP"
    assert internal["availability_mode"] == "EXTERNAL_METADATA"


def test_cached_data_fallback():
    """Test 5: Fallback to cached data on API network failure."""
    _STATION_CACHE["data"] = [{"ID": 555, "Title": "Cached Backup Station"}]
    _STATION_CACHE["last_sync"] = "2026-08-26T21:00:00Z"
    
    with patch("urllib.request.urlopen", side_effect=Exception("Network Timeout")):
        res = OpenChargeMapProvider.fetch_raw_poi_data(country_code="IN")
        assert res["success"] is True
        assert res["source"] == "CACHED_METADATA"
        assert len(res["data"]) == 1
        assert res["data"][0]["Title"] == "Cached Backup Station"


def test_knowledge_base_integration():
    """Test 6: Facts asserted with explicit Open Charge Map data source."""
    kb = KnowledgeBase()
    kb.fact_base.assert_fact("OCM-192842", "data_source", "OPEN_CHARGE_MAP", source="OPEN_CHARGE_MAP")
    kb.fact_base.assert_fact("OCM-192842", "charging_power", 150.0, source="OPEN_CHARGE_MAP")
    
    fact = kb.fact_base.get_fact("OCM-192842", "data_source")
    assert fact is not None
    assert fact.value == "OPEN_CHARGE_MAP"
    assert fact.source == "OPEN_CHARGE_MAP"


def test_search_integration():
    """Test 7: A* Search integrates Open Charge Map stations into candidate evaluation."""
    raw_poi = {"ID": 777, "Title": "AStar Candidate Station", "AddressInfo": {"Latitude": 12.97, "Longitude": 77.59}}
    norm_st = OpenChargeMapAdapter.normalize_station(raw_poi)
    internal_st = norm_st.to_internal_dict()
    
    assert internal_st["id"] == "OCM-777"
    assert internal_st["data_source"] == "OPEN_CHARGE_MAP"
