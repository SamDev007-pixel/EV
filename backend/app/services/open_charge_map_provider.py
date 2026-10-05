import os
import time
import json
import urllib.request
import urllib.parse
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path

# Load .env manually if dotenv is not imported
def _load_env_file():
    env_path = Path(__file__).resolve().parent.parent.parent / ".env"
    if env_path.exists():
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        if not os.getenv(k):
                            os.environ[k] = v.strip()
        except Exception:
            pass

_load_env_file()

# In-Memory Cache Store for API resilience & fallback
_STATION_CACHE: Dict[str, Any] = {
    "data": [],
    "last_sync": None,
    "source": None
}

class OpenChargeMapProvider:
    """
    Dedicated Provider for external Open Charge Map API communication.
    Responsible ONLY for external HTTP API communication, error handling, caching & fallback.
    """
    
    BASE_URL = "https://api.openchargemap.io/v3/poi/"
    USER_AGENT = "IntelligentEVChargingResourceManagementSystem/1.0"
    
    @classmethod
    def get_api_key(cls) -> Optional[str]:
        """Retrieve API Key securely from server-side environment variables."""
        return os.getenv("OPENCHARGEMAP_API_KEY")

    @classmethod
    def check_open_charge_map_connection(cls) -> Dict[str, Any]:
        """
        Backend Health Check Function for Open Charge Map API.
        Verifies key existence, makes a test HTTP request, and returns connection metadata.
        NEVER exposes the secret API Key in response payload.
        """
        api_key = cls.get_api_key()
        if not api_key:
            return {
                "connected": False,
                "statusCode": 401,
                "stationCount": 0,
                "responseTimeMs": 0,
                "message": "OPENCHARGEMAP_API_KEY is missing in server environment variables.",
                "lastSync": None
            }
            
        start_time = time.time()
        params = {
            "output": "json",
            "countrycode": "IN",
            "maxresults": 1
        }
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        
        req = urllib.request.Request(url, headers={
            "User-Agent": cls.USER_AGENT,
            "X-API-Key": api_key
        })
        
        try:
            with urllib.request.urlopen(req, timeout=8) as response:
                response_time = round((time.time() - start_time) * 1000, 2)
                status_code = response.status
                raw_body = response.read().decode('utf-8')
                data = json.loads(raw_body)
                
                station_count = len(data) if isinstance(data, list) else 0
                now_iso = datetime.utcnow().isoformat() + "Z"
                
                return {
                    "connected": True,
                    "statusCode": status_code,
                    "stationCount": station_count,
                    "responseTimeMs": response_time,
                    "message": "Successfully connected to Open Charge Map API",
                    "lastSync": now_iso
                }
        except urllib.error.HTTPError as e:
            response_time = round((time.time() - start_time) * 1000, 2)
            return {
                "connected": False,
                "statusCode": e.code,
                "stationCount": 0,
                "responseTimeMs": response_time,
                "message": f"HTTP Error from Open Charge Map API: {e.code} {e.reason}",
                "lastSync": _STATION_CACHE.get("last_sync")
            }
        except Exception as e:
            response_time = round((time.time() - start_time) * 1000, 2)
            return {
                "connected": False,
                "statusCode": 500,
                "stationCount": 0,
                "responseTimeMs": response_time,
                "message": f"Connection Failure: {str(e)}",
                "lastSync": _STATION_CACHE.get("last_sync")
            }

    @classmethod
    def fetch_raw_poi_data(
        cls, 
        country_code: str = "IN", 
        latitude: Optional[float] = None, 
        longitude: Optional[float] = None, 
        distance_km: Optional[float] = None, 
        max_results: int = 25
    ) -> Dict[str, Any]:
        """
        Service to fetch raw POI stations from Open Charge Map API.
        Supports location-based queries (lat/lng/distance), countrycode, and maxresults.
        Implements local caching and graceful fallback if the external API fails.
        """
        api_key = cls.get_api_key()
        
        # Build Query Parameters dynamically
        params: Dict[str, Any] = {
            "output": "json",
            "countrycode": country_code,
            "maxresults": max_results,
            "compact": "true",
            "verbose": "false"
        }
        
        if latitude is not None and longitude is not None:
            params["latitude"] = latitude
            params["longitude"] = longitude
            if distance_km is not None:
                params["distance"] = distance_km
                params["distanceunit"] = "KM"
                
        url = f"{cls.BASE_URL}?{urllib.parse.urlencode(params)}"
        now_iso = datetime.utcnow().isoformat() + "Z"

        if not api_key:
            return cls._get_fallback_data("Missing API Key. Using cached or simulation fallback.")
            
        req = urllib.request.Request(url, headers={
            "User-Agent": cls.USER_AGENT,
            "X-API-Key": api_key
        })
        
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    raw_body = response.read().decode('utf-8')
                    raw_data = json.loads(raw_body)
                    
                    if isinstance(raw_data, list):
                        # Save to Cache
                        _STATION_CACHE["data"] = raw_data
                        _STATION_CACHE["last_sync"] = now_iso
                        _STATION_CACHE["source"] = "OPEN_CHARGE_MAP"
                        
                        return {
                            "success": True,
                            "data": raw_data,
                            "source": "OPEN_CHARGE_MAP",
                            "lastSync": now_iso,
                            "stationCount": len(raw_data),
                            "message": f"Successfully retrieved {len(raw_data)} stations from Open Charge Map"
                        }
        except Exception as e:
            return cls._get_fallback_data(f"External API unavailable ({str(e)}). Using cached station metadata.")
            
        return cls._get_fallback_data("External API returned non-200 response. Using cached metadata.")

    @classmethod
    def _get_fallback_data(cls, reason_message: str) -> Dict[str, Any]:
        """Return cached stations if available, or fallback dataset if cache is empty."""
        cached_list = _STATION_CACHE.get("data", [])
        if cached_list:
            return {
                "success": True,
                "data": cached_list,
                "source": "CACHED_METADATA",
                "lastSync": _STATION_CACHE.get("last_sync"),
                "stationCount": len(cached_list),
                "message": f"Fallback: {reason_message}"
            }
        else:
            return {
                "success": False,
                "data": [],
                "source": "SIMULATION_FALLBACK",
                "lastSync": None,
                "stationCount": 0,
                "message": f"Fallback: {reason_message}"
            }
