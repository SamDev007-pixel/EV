from typing import Dict, List, Optional
from app.agents.base_agent import BaseAgent, AgentMessage, AgentLogEntry


class MessageBroker:
    def __init__(self):
        self.agents: Dict[str, BaseAgent] = {}
        self.global_logs: List[AgentLogEntry] = []

    def register_agent(self, agent: BaseAgent):
        self.agents[agent.identity] = agent

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        return self.agents.get(agent_id)

    def send_message(self, message: AgentMessage):
        if message.recipient_id == "BROADCAST":
            for agent_id, agent in self.agents.items():
                if agent_id != message.sender_id:
                    agent.receive_message(message)
        elif message.recipient_id in self.agents:
            self.agents[message.recipient_id].receive_message(message)

    def get_all_logs(self, limit: int = 200) -> List[Dict]:
        all_logs = []
        for agent in self.agents.values():
            all_logs.extend([log.model_dump() for log in agent.decision_log])
        all_logs.sort(key=lambda x: (x["timestamp"], x["agent_id"]))
        return all_logs[-limit:]


# Global message broker instance
agent_broker = MessageBroker()
