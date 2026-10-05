"""
AND-OR Graph Search for Nondeterministic Problem Spaces.
FOAI Unit II: Search in Partially Observable and Nondeterministic Environments.
Russell & Norvig, Artificial Intelligence: A Modern Approach (Chapter 4.3).

In real-world EV charging scenarios, navigation and charging actions have
contingent outcomes:
- Action: Travel to Station Central
  - Outcome 1: Operational and bay open -> Proceed to charge.
  - Outcome 2: Hardware fault / grid trip -> Contingency: Divert to backup station.
  - Outcome 3: Queue overflow -> Contingency: Park in reservation buffer.

AND-OR graph search constructs a tree-structured conditional plan guaranteeing
goal achievement across all possible environment contingencies.
"""

from typing import Dict, List, Set, Tuple, Any, Optional
from pydantic import BaseModel, Field


class PlanNode(BaseModel):
    state: str
    action: Optional[str] = None
    is_goal: bool = False
    branches: Dict[str, Any] = Field(default_factory=dict)  # outcome_name -> PlanNode dict


class AndOrSearchResult(BaseModel):
    algorithm: str = "AND_OR_GRAPH_SEARCH"
    initial_state: str
    success: bool
    plan: Optional[Dict[str, Any]] = None
    nodes_expanded: int = 0
    contingency_branches: int = 0
    execution_trace: List[str] = Field(default_factory=list)
    readable_plan: str = ""


class NondeterministicEVProblem:
    """
    Defines a nondeterministic transition model for EV charging decisions.
    States represent the physical status of the EV and charging stations.
    Actions yield a set of possible outcome states (AND nodes).
    """

    def __init__(
        self,
        initial_state: str = "LOW_BATTERY_ORIGIN",
        goal_states: Optional[Set[str]] = None,
        transitions: Optional[Dict[str, Dict[str, List[Tuple[str, str]]]]] = None
    ):
        self.initial_state = initial_state
        self.goal_states = goal_states or {"CHARGING_COMPLETED"}
        
        # Default realistic EV charging contingency model
        # transitions[state][action] = [(next_state, outcome_label), ...]
        self.transitions = transitions or {
            "LOW_BATTERY_ORIGIN": {
                "TRAVEL_CS_CENTRAL": [
                    ("CS_CENTRAL_AVAILABLE", "CENTRAL_OPERATIONAL"),
                    ("CS_CENTRAL_FAULTED", "CENTRAL_HARDWARE_FAULT"),
                    ("CS_CENTRAL_OVERFLOW", "CENTRAL_QUEUE_FULL")
                ],
                "TRAVEL_CS_NORTH": [
                    ("CS_NORTH_AVAILABLE", "NORTH_OPERATIONAL"),
                    ("CS_NORTH_OFFLINE", "NORTH_STATION_OFFLINE")
                ]
            },
            "CS_CENTRAL_AVAILABLE": {
                "CONNECT_DC_FAST": [
                    ("CHARGING_COMPLETED", "CHARGE_SESSION_SUCCESS")
                ]
            },
            "CS_CENTRAL_FAULTED": {
                "DIVERT_CS_NORTH": [
                    ("CS_NORTH_AVAILABLE", "NORTH_OPERATIONAL"),
                    ("CS_NORTH_OFFLINE", "NORTH_STATION_OFFLINE")
                ],
                "CALL_MOBILE_CHARGER": [
                    ("CHARGING_COMPLETED", "ROADSIDE_RECOVERY_SUCCESS")
                ]
            },
            "CS_CENTRAL_OVERFLOW": {
                "ENTER_RESERVE_BUFFER": [
                    ("BUFFER_PARKED", "PARKED_IN_BAY")
                ],
                "DIVERT_CS_NORTH": [
                    ("CS_NORTH_AVAILABLE", "NORTH_OPERATIONAL"),
                    ("CS_NORTH_OFFLINE", "NORTH_STATION_OFFLINE")
                ]
            },
            "BUFFER_PARKED": {
                "AWAIT_NOTIFICATION_AND_PLUG": [
                    ("CHARGING_COMPLETED", "BAY_CLEARED_CHARGING_SUCCESS")
                ]
            },
            "CS_NORTH_AVAILABLE": {
                "CONNECT_AC_NORMAL": [
                    ("CHARGING_COMPLETED", "AC_CHARGE_SUCCESS")
                ]
            },
            "CS_NORTH_OFFLINE": {
                "CALL_MOBILE_CHARGER": [
                    ("CHARGING_COMPLETED", "ROADSIDE_RECOVERY_SUCCESS")
                ]
            },
            "CHARGING_COMPLETED": {}
        }

    def actions(self, state: str) -> List[str]:
        return list(self.transitions.get(state, {}).keys())

    def results(self, state: str, action: str) -> List[Tuple[str, str]]:
        return self.transitions.get(state, {}).get(action, [])

    def is_goal(self, state: str) -> bool:
        return state in self.goal_states


class AndOrSearchEngine:
    """
    Standard Russell & Norvig AND-OR Graph Search implementation.
    Returns a conditional plan containing sub-plans for each branch.
    """

    def __init__(self):
        self.nodes_expanded = 0
        self.trace: List[str] = []
        self.contingency_count = 0

    def search(self, problem: NondeterministicEVProblem) -> AndOrSearchResult:
        self.nodes_expanded = 0
        self.trace = []
        self.contingency_count = 0

        self.trace.append(f"Starting AND-OR search from initial state: {problem.initial_state}")
        plan = self._or_search(problem.initial_state, problem, path=[])

        if plan is not None:
            self.trace.append("AND-OR Search SUCCEEDED. Contingency plan synthesized.")
            readable = self._format_plan(plan)
            return AndOrSearchResult(
                algorithm="AND_OR_GRAPH_SEARCH",
                initial_state=problem.initial_state,
                success=True,
                plan=plan,
                nodes_expanded=self.nodes_expanded,
                contingency_branches=self.contingency_count,
                execution_trace=self.trace,
                readable_plan=readable
            )
        else:
            self.trace.append("AND-OR Search FAILED. No contingency plan guarantees goal.")
            return AndOrSearchResult(
                algorithm="AND_OR_GRAPH_SEARCH",
                initial_state=problem.initial_state,
                success=False,
                plan=None,
                nodes_expanded=self.nodes_expanded,
                contingency_branches=self.contingency_count,
                execution_trace=self.trace,
                readable_plan="No plan found."
            )

    def _or_search(self, state: str, problem: NondeterministicEVProblem, path: List[str]) -> Optional[Dict[str, Any]]:
        self.nodes_expanded += 1
        
        if problem.is_goal(state):
            self.trace.append(f"OR-Node [State: {state}] is a GOAL.")
            return {"state": state, "is_goal": True, "action": None, "branches": {}}

        if state in path:
            self.trace.append(f"OR-Node [State: {state}] detected loop in path {path}. Pruning.")
            return None  # Cycle detected

        actions = problem.actions(state)
        if not actions:
            self.trace.append(f"OR-Node [State: {state}] has no available actions (dead end).")
            return None

        for action in actions:
            self.trace.append(f"OR-Node [State: {state}] trying action: {action}")
            outcomes = problem.results(state, action)
            
            sub_plan = self._and_search(outcomes, problem, path + [state])
            if sub_plan is not None:
                return {
                    "state": state,
                    "is_goal": False,
                    "action": action,
                    "branches": sub_plan
                }

        return None

    def _and_search(
        self,
        outcomes: List[Tuple[str, str]],
        problem: NondeterministicEVProblem,
        path: List[str]
    ) -> Optional[Dict[str, Any]]:
        """
        AND-search requires ALL contingent outcomes to succeed.
        """
        branches = {}
        for next_state, outcome_label in outcomes:
            self.trace.append(f"  AND-Branch evaluating outcome: {outcome_label} -> State {next_state}")
            branch_plan = self._or_search(next_state, problem, path)
            if branch_plan is None:
                self.trace.append(f"  AND-Branch FAILED on outcome {outcome_label}. Branch cannot reach goal.")
                return None
            branches[outcome_label] = branch_plan
            self.contingency_count += 1

        return branches

    def _format_plan(self, plan: Dict[str, Any], indent: int = 0) -> str:
        prefix = "  " * indent
        state = plan.get("state")
        if plan.get("is_goal"):
            return f"{prefix}[GOAL REACHED: {state}]"
        
        action = plan.get("action")
        lines = [f"{prefix}State: {state} => Action: {action}"]
        branches = plan.get("branches", {})
        for outcome, sub_node in branches.items():
            lines.append(f"{prefix}  Case [{outcome}]:")
            lines.append(self._format_plan(sub_node, indent + 2))
        return "\n".join(lines)
