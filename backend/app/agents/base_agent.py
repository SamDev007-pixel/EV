from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import uuid


class AgentRole(str, Enum):
    EV_AGENT = "EV_AGENT"
    STATION_AGENT = "STATION_AGENT"
    GRID_AGENT = "GRID_AGENT"
    ENERGY_AGENT = "ENERGY_AGENT"
    COORDINATOR_AGENT = "COORDINATOR_AGENT"


class Performative(str, Enum):
    REQUEST = "REQUEST"
    INFORM = "INFORM"
    PROPOSE = "PROPOSE"
    ACCEPT = "ACCEPT"
    REJECT = "REJECT"


class AgentMessage(BaseModel):
    id: str = Field(default_factory=lambda: f"MSG-{uuid.uuid4().hex[:6].upper()}")
    sender_id: str
    sender_role: AgentRole
    recipient_id: str = "BROADCAST"
    performative: Performative = Performative.INFORM
    content: Any
    timestamp: int = 0


class AgentLogEntry(BaseModel):
    id: str = Field(default_factory=lambda: f"LOG-{uuid.uuid4().hex[:6].upper()}")
    timestamp: int
    agent_id: str
    agent_role: str
    input: str
    reasoning_step: str
    action: str
    result: str


class BaseAgent:
    def __init__(self, agent_id: str, role: AgentRole, goals: Optional[List[str]] = None):
        self.identity: str = agent_id
        self.role: AgentRole = role
        self.goals: List[str] = goals or []
        self.percepts: Dict[str, Any] = {}
        self.knowledge: Dict[str, Any] = {}
        self.decision_log: List[AgentLogEntry] = []
        self.inbox: List[AgentMessage] = []

    def perceive(self, environment_state: Dict[str, Any], current_tick: int):
        """Update agent percepts from environment state."""
        self.percepts = environment_state

    def receive_message(self, message: AgentMessage):
        """Receive message into inbox."""
        self.inbox.append(message)

    def log_decision(self, input_desc: str, reasoning: str, action_desc: str, result_desc: str, timestamp: int):
        """Record structured decision log entry."""
        entry = AgentLogEntry(
            timestamp=timestamp,
            agent_id=self.identity,
            agent_role=self.role.value,
            input=input_desc,
            reasoning_step=reasoning,
            action=action_desc,
            result=result_desc
        )
        self.decision_log.append(entry)
        # Keep log size bounded
        if len(self.decision_log) > 100:
            self.decision_log.pop(0)

    def decide(self, current_tick: int) -> List[AgentMessage]:
        """Core decision cycle to be overridden by concrete agent subclass."""
        return []

    def get_info(self) -> Dict[str, Any]:
        return {
            "identity": self.identity,
            "role": self.role.value,
            "goals": self.goals,
            "percepts": self.percepts,
            "knowledge": self.knowledge,
            "log_count": len(self.decision_log)
        }
