from typing import List, Dict, Any
from app.agents.base_agent import BaseAgent, AgentRole, Performative, AgentMessage
from app.agents.message_broker import agent_broker


class CoordinatorAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="AGENT-COORDINATOR",
            role=AgentRole.COORDINATOR_AGENT,
            goals=[
                "Receive information from all agents and coordinate global EV charging assignments",
                "Resolve priority conflicts between standard and emergency EVs",
                "Enforce grid transformer safety limits and minimize EV waiting times"
            ]
        )

    def decide(self, current_tick: int) -> List[AgentMessage]:
        outbound_messages = []
        
        # Process requests in inbox
        requests = [m for m in self.inbox if m.performative == Performative.REQUEST]
        informs = [m for m in self.inbox if m.performative == Performative.INFORM]

        # 1. Process incoming EV Requests
        for req in requests:
            ev_info = req.content
            ev_id = ev_info.get("ev_id")
            energy_needed = ev_info.get("energy_needed_kwh", 0)
            priority = ev_info.get("priority", "STANDARD")
            deadline = ev_info.get("deadline_min", 120)

            reasoning = (
                f"Received EV charging request from {ev_id} ({energy_needed:.1f} kWh needed, "
                f"Priority: {priority}, Deadline: tick {deadline}). Querying Station, Grid, and Energy Agents."
            )
            action = f"Forward query for EV {ev_id} to Station, Grid & Energy agents"
            result = "Multi-Agent Coordination Cycle Initiated"

            self.log_decision(
                input_desc=f"Coordination Trigger: EV {ev_id}",
                reasoning=reasoning,
                action_desc=action,
                result_desc=result,
                timestamp=current_tick
            )

            # Query Station Agents
            for agent_id, agent in agent_broker.agents.items():
                if agent.role == AgentRole.STATION_AGENT:
                    broker_msg = AgentMessage(
                        sender_id=self.identity,
                        sender_role=self.role,
                        recipient_id=agent_id,
                        performative=Performative.REQUEST,
                        content=ev_info,
                        timestamp=current_tick
                    )
                    agent_broker.send_message(broker_msg)

            # Query Grid Agent
            grid_msg = AgentMessage(
                sender_id=self.identity,
                sender_role=self.role,
                recipient_id="AGENT-GRID",
                performative=Performative.REQUEST,
                content={"ev_id": ev_id, "requested_kw": 50.0},
                timestamp=current_tick
            )
            agent_broker.send_message(grid_msg)

            # Query Energy Agent
            energy_msg = AgentMessage(
                sender_id=self.identity,
                sender_role=self.role,
                recipient_id="AGENT-ENERGY",
                performative=Performative.REQUEST,
                content={"ev_id": ev_id, "requested_kw": 50.0},
                timestamp=current_tick
            )
            agent_broker.send_message(energy_msg)

        # 2. Process answers from Station, Grid, Energy agents
        station_offers = [inf.content for inf in informs if "station_id" in inf.content]
        grid_approvals = [inf.content for inf in informs if "available_headroom_kw" in inf.content]
        energy_recs = [inf.content for inf in informs if "recommended_source" in inf.content]

        if station_offers and grid_approvals:
            for offer in station_offers:
                ev_id = offer.get("ev_id")
                st_id = offer.get("station_id")
                ch_id = offer.get("charger_id")
                grid_ok = any(g.get("approved", False) for g in grid_approvals if g.get("ev_id") == ev_id)

                if offer.get("suitable") and grid_ok:
                    reasoning = (
                        f"Station Agent {st_id} offered charger {ch_id}. Grid Agent confirmed safe capacity headroom. "
                        f"Conflict Resolution: Assigning EV {ev_id} to Charger {ch_id}."
                    )
                    action = f"Issue ACCEPT assignment for EV {ev_id} to Station {st_id}"
                    result = f"EV {ev_id} -> {ch_id} Assigned"

                    self.log_decision(
                        input_desc=f"Allocation Consensus for EV {ev_id}",
                        reasoning=reasoning,
                        action_desc=action,
                        result_desc=result,
                        timestamp=current_tick
                    )

        self.inbox.clear()
        return outbound_messages
