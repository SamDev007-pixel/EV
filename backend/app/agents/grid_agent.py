from typing import List, Dict, Any
from app.agents.base_agent import BaseAgent, AgentRole, Performative, AgentMessage
from app.models.grid import GridNodeModel, GridStatus


class GridAgent(BaseAgent):
    def __init__(self, grid_data: GridNodeModel):
        super().__init__(
            agent_id="AGENT-GRID",
            role=AgentRole.GRID_AGENT,
            goals=[
                "Maintain transformer load strictly below safe capacity threshold",
                "Prevent grid overload incidents and thermal trips",
                "Report active capacity headroom to Coordinator Agent"
            ]
        )
        self.grid_data = grid_data
        self.knowledge = {
            "max_transformer_capacity": grid_data.maximumCapacity,
            "safety_headroom_target_kw": 20.0
        }

    def perceive(self, environment_state: Dict[str, Any], current_tick: int):
        grid = environment_state.get("grid_node", {})
        if grid:
            self.percepts = grid

    def decide(self, current_tick: int) -> List[AgentMessage]:
        outbound_messages = []
        max_cap = self.percepts.get("maximumCapacity", self.grid_data.maximumCapacity)
        curr_load = self.percepts.get("currentLoad", self.grid_data.currentLoad)
        avail_cap = max(0.0, max_cap - curr_load)
        load_pct = round((curr_load / max(1.0, max_cap)) * 100.0, 1)

        for msg in list(self.inbox):
            if msg.performative == Performative.REQUEST:
                content = msg.content
                requested_kw = content.get("requested_kw", 50.0)
                ev_id = content.get("ev_id", "UNKNOWN")

                is_safe = (curr_load + requested_kw) <= (max_cap * 0.95)  # 95% safety ceiling
                
                if is_safe:
                    reasoning = (
                        f"Grid load is {curr_load:.1f} kW / {max_cap:.1f} kW ({load_pct}%). "
                        f"Allocating +{requested_kw:.1f} kW is within safe capacity threshold ({avail_cap:.1f} kW headroom)."
                    )
                    action = f"Approve power draw of {requested_kw:.1f} kW for EV {ev_id}"
                    result = "Grid Safety Approved"
                else:
                    reasoning = (
                        f"Grid load is {curr_load:.1f} kW ({load_pct}%). "
                        f"Adding +{requested_kw:.1f} kW would violate 95% safety ceiling ({max_cap*0.95:.1f} kW)."
                    )
                    action = f"Reject/Throttle power draw for EV {ev_id}"
                    result = "Grid Overload Veto"

                self.log_decision(
                    input_desc=f"Grid Check for EV {ev_id} (+{requested_kw:.1f} kW)",
                    reasoning=reasoning,
                    action_desc=action,
                    result_desc=result,
                    timestamp=current_tick
                )

                response = AgentMessage(
                    sender_id=self.identity,
                    sender_role=self.role,
                    recipient_id="AGENT-COORDINATOR",
                    performative=Performative.INFORM if is_safe else Performative.REJECT,
                    content={
                        "ev_id": ev_id,
                        "approved": is_safe,
                        "available_headroom_kw": avail_cap,
                        "load_percentage": load_pct,
                        "max_capacity_kw": max_cap
                    },
                    timestamp=current_tick
                )
                outbound_messages.append(response)

        self.inbox.clear()
        return outbound_messages
