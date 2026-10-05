import pytest
from app.simulation.engine import SimulationEngine
from app.agents.message_broker import agent_broker
from app.agents.base_agent import AgentRole, Performative, AgentMessage
from app.models.ev import EVModel, EVPriority


def test_agent_registration():
    engine = SimulationEngine(seed=42)
    agents = agent_broker.agents
    
    # Verify Coordinator, Grid, Energy, Master Station Agent, and EV agents registered
    assert "AGENT-COORDINATOR" in agents
    assert "AGENT-GRID" in agents
    assert "AGENT-ENERGY" in agents
    assert "AGENT-STATION-MASTER" in agents
    assert any(a.role == AgentRole.STATION_AGENT for a in agents.values())
    assert any(a.role == AgentRole.EV_AGENT for a in agents.values())


def test_ev_agent_decision():
    engine = SimulationEngine(seed=42)
    ev_agent = agent_broker.get_agent("AGENT-EV-101")
    assert ev_agent is not None
    
    ev_agent.perceive(engine.get_full_state(), 1)
    msgs = ev_agent.decide(1)
    
    assert len(msgs) > 0
    assert msgs[0].performative == Performative.REQUEST
    assert msgs[0].recipient_id == "AGENT-COORDINATOR"
    assert len(ev_agent.decision_log) > 0


def test_station_agent_response():
    engine = SimulationEngine(seed=42)
    st_agent = agent_broker.get_agent("AGENT-STATION-MASTER")
    assert st_agent is not None
    
    # Test getting network-wide station details from single master station agent
    details = st_agent.get_station_details()
    assert details["total_managed_stations"] > 0
    assert details["total_chargers_network"] > 0
    
    # Send mock EV request to station inbox
    msg = AgentMessage(
        sender_id="AGENT-COORDINATOR",
        sender_role=AgentRole.COORDINATOR_AGENT,
        recipient_id=st_agent.identity,
        performative=Performative.REQUEST,
        content={"ev_id": "EV-101", "energy_needed_kwh": 39.0, "station_id": "CS-NORTH"},
        timestamp=1
    )
    st_agent.receive_message(msg)
    st_agent.perceive(engine.get_full_state(), 1)
    responses = st_agent.decide(1)
    
    assert len(responses) > 0
    assert responses[0].content["suitable"] is True
    assert responses[0].content["station_id"] == "CS-NORTH"


def test_grid_agent_safety_check():
    engine = SimulationEngine(seed=42)
    grid_agent = agent_broker.get_agent("AGENT-GRID")
    assert grid_agent is not None
    
    msg = AgentMessage(
        sender_id="AGENT-COORDINATOR",
        sender_role=AgentRole.COORDINATOR_AGENT,
        recipient_id="AGENT-GRID",
        performative=Performative.REQUEST,
        content={"ev_id": "EV-101", "requested_kw": 50.0},
        timestamp=1
    )
    grid_agent.receive_message(msg)
    grid_agent.perceive(engine.get_full_state(), 1)
    responses = grid_agent.decide(1)
    
    assert len(responses) > 0
    assert responses[0].content["approved"] is True


def test_multi_agent_communication_cycle():
    engine = SimulationEngine(seed=42)
    engine.step(3)
    
    # Fetch all agent decision logs
    logs = agent_broker.get_all_logs(limit=500)
    assert len(logs) > 0
    
    roles_in_logs = set(log["agent_role"] for log in logs)
    assert "EV_AGENT" in roles_in_logs
    assert "STATION_AGENT" in roles_in_logs
    assert "GRID_AGENT" in roles_in_logs
    assert "COORDINATOR_AGENT" in roles_in_logs
