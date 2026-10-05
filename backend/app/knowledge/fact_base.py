from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class Fact(BaseModel):
    subject: str
    predicate: str
    value: Any
    source: str = "SIMULATION_TELEMETRY"

    @property
    def key(self) -> str:
        return f"{self.subject}:{self.predicate}"

    def __str__(self) -> str:
        return f"FACT: {self.subject}.{self.predicate} = {self.value}"


class FactBase:
    def __init__(self):
        self.facts: Dict[str, Fact] = {}

    def assert_fact(self, subject: str, predicate: str, value: Any, source: str = "SIMULATION_TELEMETRY") -> Fact:
        fact = Fact(subject=subject, predicate=predicate, value=value, source=source)
        self.facts[fact.key] = fact
        return fact

    def get_fact(self, subject: str, predicate: str) -> Optional[Fact]:
        return self.facts.get(f"{subject}:{predicate}")

    def get_value(self, subject: str, predicate: str, default: Any = None) -> Any:
        fact = self.get_fact(subject, predicate)
        return fact.value if fact else default

    def list_facts(self, subject_filter: Optional[str] = None) -> List[Fact]:
        if subject_filter:
            return [f for f in self.facts.values() if f.subject == subject_filter]
        return list(self.facts.values())

    def clear(self):
        self.facts.clear()
