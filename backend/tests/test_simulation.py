import pytest
from pydantic import ValidationError
from app.simulation.engine import SimulationEngine
from app.models.ev import EVModel, EVStatus, EVPriority
from app.models.charger import ChargerModel, ChargerStatus, ChargerType
from app.models.station import StationOperatingStatus
from app.models.session import ChargingSessionModel, SessionStatus


def test_ev_validations():
    # 1. Current battery level > battery capacity -> MUST throw error
    with pytest.raises(ValidationError):
        EVModel(
            id="EV-INVALID-1",
            batteryCapacity=50.0,
            currentBatteryLevel=60.0,  # Invalid: 60 > 50
            requiredBatteryLevel=40.0,
            chargingRate=50.0,
            arrivalTime=0,
            departureDeadline=60
        )

    # 2. Negative charging rate -> MUST throw error
    with pytest.raises(ValidationError):
        EVModel(
            id="EV-INVALID-2",
            batteryCapacity=50.0,
            currentBatteryLevel=10.0,
            requiredBatteryLevel=40.0,
            chargingRate=-10.0,  # Invalid: negative
            arrivalTime=0,
            departureDeadline=60
        )

    # 3. Invalid time range (deadline <= arrival) -> MUST throw error
    with pytest.raises(ValidationError):
        EVModel(
            id="EV-INVALID-3",
            batteryCapacity=50.0,
            currentBatteryLevel=10.0,
            requiredBatteryLevel=40.0,
            chargingRate=50.0,
            arrivalTime=30,
            departureDeadline=20  # Invalid: 20 <= 30
        )


def test_charger_validations():
    with pytest.raises(ValidationError):
        ChargerModel(
            id="CH-1",
            stationId="CS-NORTH",
            maximumPower=-50.0  # Invalid: negative
        )


def test_session_validations():
    with pytest.raises(ValidationError):
        ChargingSessionModel(
            id="SESS-1",
            evId="EV-101",
            stationId="CS-NORTH",
            chargerId="CH-1",
            startTime=10,
            endTime=5  # Invalid: end < start
        )

    with pytest.raises(ValidationError):
        ChargingSessionModel(
            id="SESS-2",
            evId="EV-101",
            stationId="CS-NORTH",
            chargerId="CH-1",
            startTime=0,
            energyAllocated=-5.0  # Invalid: negative energy
        )


def test_seed_determinism():
    engine1 = SimulationEngine(seed=42)
    state1 = engine1.get_full_state()

    engine2 = SimulationEngine(seed=42)
    state2 = engine2.get_full_state()

    assert state1["evs"] == state2["evs"]
    assert state1["stations"] == state2["stations"]
    assert state1["grid_node"] == state2["grid_node"]


def test_fcfs_simulation_progress():
    engine = SimulationEngine(seed=42)
    engine.step(10)
    
    # Check charging sessions created
    assert len(engine.sessions) > 0
    assert engine.grid_node.currentLoad > 0.0


def test_emergency_priority_service():
    engine = SimulationEngine(seed=42)
    emergency_ev = EVModel(
        id="EV-URGENT-AMB",
        batteryCapacity=100.0,
        currentBatteryLevel=5.0,
        requiredBatteryLevel=90.0,
        chargingRate=150.0,
        arrivalTime=0,
        departureDeadline=30,
        priority=EVPriority.EMERGENCY
    )
    engine.add_or_update_ev(emergency_ev)
    engine.step(1)
    
    assert engine.evs["EV-URGENT-AMB"].status == EVStatus.CHARGING
