from typing import List, Dict, Any, Callable
from pydantic import BaseModel, Field


class Condition(BaseModel):
    subject_param: str      # e.g., "?ev", "?station", "?grid"
    predicate: str          # e.g., "battery_soc_percent", "is_emergency"
    operator: str           # "<", ">", "==", "!=", "<=", ">="
    target_value: Any       # e.g., 15.0, True, "OPERATIONAL"

    def evaluate(self, actual_value: Any) -> bool:
        if actual_value is None:
            return False
        if self.operator == "<":
            return actual_value < self.target_value
        elif self.operator == ">":
            return actual_value > self.target_value
        elif self.operator == "==":
            return actual_value == self.target_value
        elif self.operator == "!=":
            return actual_value != self.target_value
        elif self.operator == "<=":
            return actual_value <= self.target_value
        elif self.operator == ">=":
            return actual_value >= self.target_value
        elif self.operator == "in":
            return actual_value in self.target_value
        return False

    def __str__(self) -> str:
        return f"{self.subject_param}.{self.predicate} {self.operator} {self.target_value}"


class Conclusion(BaseModel):
    subject_param: str      # e.g., "?ev", "?station"
    predicate: str          # e.g., "charging_priority", "suitability", "can_charge_safely"
    value: Any              # e.g., "CRITICAL", "HIGH", "UNSUITABLE", False

    def __str__(self) -> str:
        return f"{self.subject_param}.{self.predicate} = {self.value}"


class Rule(BaseModel):
    id: str
    name: str
    description: str
    conditions: List[Condition]
    conclusion: Conclusion

    def __str__(self) -> str:
        cond_str = " AND ".join(str(c) for c in self.conditions)
        return f"IF {cond_str} THEN {self.conclusion}"
