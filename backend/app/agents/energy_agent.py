from typing import List, Dict, Any
from app.agents.base_agent import BaseAgent, AgentRole, Performative, AgentMessage
from app.models.energy_resource import EnergyResourceModel, EnergyResourceType


class EnergyAgent(BaseAgent):
    def __init__(self, energy_resources: List[EnergyResourceModel]):
        super().__init__(
            agent_id="AGENT-ENERGY",
            role=AgentRole.ENERGY_AGENT,
            goals=[
                "Maximize self-consumption of renewable solar & wind energy",
                "Minimize overall electricity procurement costs",
                "Recommend optimal energy resource mix for charging sessions"
            ]
        )
        self.energy_resources = energy_resources
        self.knowledge = {
            "renewable_priority": ["SOLAR", "WIND", "BATTERY_STORAGE", "GRID"]
        }

    def perceive(self, environment_state: Dict[str, Any], current_tick: int):
        resources = environment_state.get("energy_resources", [])
        if resources:
            self.percepts = {"resources": resources}

    def decide(self, current_tick: int) -> List[AgentMessage]:
        outbound_messages = []
        resources = self.percepts.get("resources", [r.model_dump() for r in self.energy_resources])
        
        def get_power(r):
            return r.get("availablePower", r.get("available_power", 0.0))

        def get_type(r):
            return r.get("type", "")

        solar_pwr = sum(get_power(r) for r in resources if get_type(r) == EnergyResourceType.SOLAR.value)
        battery_pwr = sum(get_power(r) for r in resources if get_type(r) == EnergyResourceType.BATTERY_STORAGE.value)

        for msg in list(self.inbox):
            if msg.performative == Performative.REQUEST:
                ev_id = msg.content.get("ev_id", "UNKNOWN")
                kw_needed = msg.content.get("requested_kw", 50.0)

                if solar_pwr > 0:
                    source_used = "SOLAR (Renewable)"
                    cost_rate = 0.05
                    reasoning = f"Active solar output is {solar_pwr:.1f} kW. Recommending green solar power allocation at ${cost_rate}/kWh."
                elif battery_pwr > 0:
                    source_used = "BATTERY_STORAGE"
                    cost_rate = 0.10
                    reasoning = f"Solar unavailable. Recommending stationary battery storage draw at ${cost_rate}/kWh."
                else:
                    source_used = "GRID_POWER"
                    cost_rate = 0.15
                    reasoning = f"Renewable resources exhausted. Falling back to grid electricity tariff at ${cost_rate}/kWh."

                action = f"Recommend {source_used} allocation for EV {ev_id}"
                result = f"Energy Mix: {source_used} (${cost_rate}/kWh)"

                self.log_decision(
                    input_desc=f"Energy Mix Request for EV {ev_id} ({kw_needed:.1f} kW)",
                    reasoning=reasoning,
                    action_desc=action,
                    result_desc=result,
                    timestamp=current_tick
                )

                response = AgentMessage(
                    sender_id=self.identity,
                    sender_role=self.role,
                    recipient_id="AGENT-COORDINATOR",
                    performative=Performative.INFORM,
                    content={
                        "ev_id": ev_id,
                        "recommended_source": source_used,
                        "cost_per_kwh": cost_rate,
                        "solar_available_kw": solar_pwr
                    },
                    timestamp=current_tick
                )
                outbound_messages.append(response)

        self.inbox.clear()
        return outbound_messages
