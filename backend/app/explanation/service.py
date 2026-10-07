import uuid
import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class ExplanationTraceItem(BaseModel):
    step_number: int
    step_type: str
    description: str
    details: Dict[str, Any] = Field(default_factory=dict)


class ExplanationRecord(BaseModel):
    decision_id: str = Field(default_factory=lambda: f"DEC-{uuid.uuid4().hex[:8].upper()}")
    timestamp: float = Field(default_factory=lambda: time.time())
    topic: str
    algorithm_used: str
    input_data: Dict[str, Any] = Field(default_factory=dict)
    selected_decision: Dict[str, Any] = Field(default_factory=dict)
    alternatives_evaluated: List[Dict[str, Any]] = Field(default_factory=list)
    metrics: Dict[str, Any] = Field(default_factory=dict)
    explanation_summary: str
    why_chosen: str
    why_rejected: List[str] = Field(default_factory=list)
    derivation_trace: List[ExplanationTraceItem] = Field(default_factory=list)


class ExplanationRegistry:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ExplanationRegistry, cls).__new__(cls)
            cls._instance._records: Dict[str, ExplanationRecord] = {}
        return cls._instance

    def register(self, record: ExplanationRecord) -> str:
        self._records[record.decision_id] = record
        # Keep registry bounded to latest 500 decisions
        if len(self._records) > 500:
            oldest_key = next(iter(self._records))
            del self._records[oldest_key]
        return record.decision_id

    def get(self, decision_id: str) -> Optional[ExplanationRecord]:
        return self._records.get(decision_id)

    def list_recent(self, limit: int = 20) -> List[ExplanationRecord]:
        records = list(self._records.values())
        records.reverse()
        return records[:limit]

    def clear(self):
        self._records.clear()


explanation_registry = ExplanationRegistry()
