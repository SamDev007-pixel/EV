from typing import List, Dict, Any
from app.agents.base_agent import BaseAgent, AgentRole, Performative, AgentMessage
from app.models.ev import EVModel, EVStatus, EVPriority


class EVAgent(BaseAgent):
    def __init__(self, ev_data: EVModel):
        super().__init__(
            agent_id=f"AGENT-{ev_data.id}",
            role=AgentRole.EV_AGENT,
            goals=[
                "Secure charging port before departure deadline",
                "Minimize wait time & charging cost",
                "Fulfill target battery State-of-Charge (SoC %)"
            ]
        )
        self.ev_data = ev_data
        self.knowledge = {
            "battery_capacity": ev_data.batteryCapacity,
            "max_charging_rate": ev_data.chargingRate,
            "deadline": ev_data.departureDeadline,
            "priority": ev_data.priority.value
        }

    def perceive(self, environment_state: Dict[str, Any], current_tick: int):
        # Update EV data from environment state
        evs = environment_state.get("evs", [])
        updated = next((e for e in evs if e["id"] == self.ev_data.id), None)
        if updated:
            self.percepts = updated

    def decide(self, current_tick: int) -> List[AgentMessage]:
        outbound_messages = []
        status = self.percepts.get("status", self.ev_data.status.value)
        curr_battery = self.percepts.get("currentBatteryLevel", self.ev_data.currentBatteryLevel)
        req_battery = self.percepts.get("requiredBatteryLevel", self.ev_data.requiredBatteryLevel)
        energy_needed = max(0.0, req_battery - curr_battery)

        if status == EVStatus.QUEUED.value and energy_needed > 0:
            deadline = self.percepts.get("departureDeadline", self.ev_data.departureDeadline)
            time_remaining = max(1, deadline - current_tick)
            urgency_score = round(energy_needed / time_remaining, 2)
            
            reasoning = (
                f"EV {self.ev_data.id} needs {energy_needed:.1f} kWh before tick {deadline}. "
                f"Time remaining: {time_remaining} min. Urgency score: {urgency_score} kWh/min."
            )
            
            action = f"Broadcast charging REQUEST to Coordinator Agent"
            result = f"Requested allocation for {energy_needed:.1f} kWh"
            
            self.log_decision(
                input_desc=f"Queue State: SoC={curr_battery:.1f}/{req_battery:.1f} kWh",
                reasoning=reasoning,
                action_desc=action,
                result_desc=result,
                timestamp=current_tick
            )
            
            msg = AgentMessage(
                sender_id=self.identity,
                sender_role=self.role,
                recipient_id="AGENT-COORDINATOR",
                performative=Performative.REQUEST,
                content={
                    "ev_id": self.ev_data.id,
                    "energy_needed_kwh": energy_needed,
                    "deadline_min": deadline,
                    "urgency_score": urgency_score,
                    "priority": self.percepts.get("priority", self.ev_data.priority.value),
                    "location": self.percepts.get("currentLocation", {"x": 0, "y": 0})
                },
                timestamp=current_tick
            )
            outbound_messages.append(msg)
            
        return outbound_messages
