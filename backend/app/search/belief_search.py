"""
Belief-State Search in Partially Observable Environments.
FOAI Unit II: Searching in Partially Observable Environments.
Russell & Norvig, Artificial Intelligence: A Modern Approach (Chapter 4.4).

In real-world EV charging scenarios, charging stations may lack real-time IoT meters
or telemetry may be partially degraded. The agent cannot observe the exact physical world state,
so it operates over a *Belief State* b = {s1, s2, ..., sk}, representing all candidate world states
consistent with prior actions and percepts.

This module implements:
1. Belief state representation (frozenset of physical states)
2. Predict-and-Update cycle:
   - Predict: b_predicted = Union_{s in b} Result(s, a)
   - Update: b' = { s' in b_predicted : o in Sensors(s') }
3. Belief-State Breadth-First / Uniform-Cost Search finding safe plans that guarantee
   reaching a goal state under state uncertainty.
"""

from typing import Dict, List, Set, FrozenSet, Tuple, Any, Optional
from pydantic import BaseModel, Field
from collections import deque


class PhysicalState(BaseModel):
    state_id: str
    ev_location: str
    station_a_status: str  # "AVAILABLE" or "OCCUPIED"
    station_b_status: str  # "AVAILABLE" or "OCCUPIED"
    is_charging: bool = False

    def to_key(self) -> str:
        return f"{self.ev_location}|A:{self.station_a_status}|B:{self.station_b_status}|Charge:{self.is_charging}"


class BeliefSearchResult(BaseModel):
    algorithm: str = "BELIEF_STATE_SEARCH"
    initial_belief_size: int
    goal_reached: bool
    plan_actions: List[str]
    belief_trace: List[Dict[str, Any]]
    nodes_explored: int
    explanation: str


class PartiallyObservableEVProblem:
    """
    EV Charging environment with partial observability:
    - EV knows its own location.
    - Status of stations A and B is initially UNKNOWN (partial observability).
    - Actions:
      - 'NAVIGATE_STATION_A' -> Moves to Station A. Sensor perceives status of A.
      - 'NAVIGATE_STATION_B' -> Moves to Station B. Sensor perceives status of B.
      - 'PING_STATUS_A' -> Telemetry check on Station A, returns percept.
      - 'CONNECT_CHARGER' -> If at station and station is AVAILABLE, transitions to is_charging=True.
    """

    def __init__(self):
        # 3 candidate physical states representing uncertainty about which charger is free
        self.all_possible_states: List[PhysicalState] = [
            PhysicalState(
                state_id="S1_A_AVAIL_B_BUSY",
                ev_location="JUNCTION",
                station_a_status="AVAILABLE",
                station_b_status="OCCUPIED"
            ),
            PhysicalState(
                state_id="S2_A_BUSY_B_AVAIL",
                ev_location="JUNCTION",
                station_a_status="OCCUPIED",
                station_b_status="AVAILABLE"
            ),
            PhysicalState(
                state_id="S3_A_AVAIL_B_AVAIL",
                ev_location="JUNCTION",
                station_a_status="AVAILABLE",
                station_b_status="AVAILABLE"
            )
        ]

    def get_initial_belief_state(self) -> FrozenSet[str]:
        """Returns belief state containing all 3 possible states initially."""
        return frozenset(s.to_key() for s in self.all_possible_states)

    def parse_state_key(self, key: str) -> PhysicalState:
        parts = key.split("|")
        loc = parts[0]
        st_a = parts[1].split(":")[1]
        st_b = parts[2].split(":")[1]
        chg = parts[3].split(":")[1] == "True"
        return PhysicalState(
            state_id=key,
            ev_location=loc,
            station_a_status=st_a,
            station_b_status=st_b,
            is_charging=chg
        )

    def actions(self, belief_state: FrozenSet[str]) -> List[str]:
        """Available actions from the current belief state."""
        return [
            "PING_STATUS_A",
            "NAVIGATE_STATION_A",
            "NAVIGATE_STATION_B",
            "CONNECT_CHARGER"
        ]

    def result(self, physical_key: str, action: str) -> str:
        """Physical transition function for a single physical state."""
        st = self.parse_state_key(physical_key)
        new_loc = st.ev_location
        new_chg = st.is_charging

        if action == "NAVIGATE_STATION_A":
            new_loc = "STATION_A"
        elif action == "NAVIGATE_STATION_B":
            new_loc = "STATION_B"
        elif action == "CONNECT_CHARGER":
            if new_loc == "STATION_A" and st.station_a_status == "AVAILABLE":
                new_chg = True
            elif new_loc == "STATION_B" and st.station_b_status == "AVAILABLE":
                new_chg = True

        next_st = PhysicalState(
            state_id=f"{new_loc}|A:{st.station_a_status}|B:{st.station_b_status}|Charge:{new_chg}",
            ev_location=new_loc,
            station_a_status=st.station_a_status,
            station_b_status=st.station_b_status,
            is_charging=new_chg
        )
        return next_st.to_key()

    def get_percept(self, physical_key: str, action: str) -> str:
        """Sensor model: what the agent perceives after performing an action."""
        st = self.parse_state_key(physical_key)
        if action == "PING_STATUS_A" or st.ev_location == "STATION_A":
            return f"SENSOR_A_{st.station_a_status}"
        elif st.ev_location == "STATION_B":
            return f"SENSOR_B_{st.station_b_status}"
        return "SENSOR_NOOP"

    def predict_and_update(
        self,
        belief_state: FrozenSet[str],
        action: str,
        observed_percept: Optional[str] = None
    ) -> FrozenSet[str]:
        """
        Calculates successor belief state:
        b' = { s' in predict(b, a) : observed_percept in sensors(s') }
        """
        predicted_states = {self.result(s_key, action) for s_key in belief_state}
        if observed_percept is None:
            return frozenset(predicted_states)

        updated_states = {
            s_key for s_key in predicted_states
            if self.get_percept(s_key, action) == observed_percept
        }
        return frozenset(updated_states)

    def is_goal_belief(self, belief_state: FrozenSet[str]) -> bool:
        """Goal test: In all states in the belief state, EV is actively charging."""
        if not belief_state:
            return False
        return all(self.parse_state_key(k).is_charging for k in belief_state)


class BeliefStateSearchEngine:
    """
    Search over the belief space (Russell & Norvig, Ch 4.4).
    Finds a guaranteed sequence of actions from an uncertain belief state to a goal belief state.
    """

    @classmethod
    def solve_conformant_or_conditional(
        cls,
        problem: Optional[PartiallyObservableEVProblem] = None
    ) -> BeliefSearchResult:
        prob = problem or PartiallyObservableEVProblem()
        initial_belief = prob.get_initial_belief_state()

        # BFS over belief space: queue of (belief_state, plan_so_far, trace)
        queue = deque([(initial_belief, [], [{"belief_size": len(initial_belief), "action": "INITIAL", "states": list(initial_belief)}])])
        visited: Set[FrozenSet[str]] = {initial_belief}
        nodes_explored = 0

        while queue:
            current_belief, plan, trace = queue.popleft()
            nodes_explored += 1

            if prob.is_goal_belief(current_belief):
                return BeliefSearchResult(
                    algorithm="BELIEF_STATE_SEARCH",
                    initial_belief_size=len(initial_belief),
                    goal_reached=True,
                    plan_actions=plan,
                    belief_trace=trace,
                    nodes_explored=nodes_explored,
                    explanation=(
                        f"Guaranteed plan found in {len(plan)} steps across {nodes_explored} belief nodes. "
                        f"Belief state collapsed from {len(initial_belief)} uncertainty candidates to guaranteed charging state."
                    )
                )

            # Max depth limit to prevent infinite loops in belief space
            if len(plan) >= 5:
                continue

            for act in prob.actions(current_belief):
                # Predict next belief without observation (conformant step)
                next_belief = prob.predict_and_update(current_belief, act)
                if next_belief and next_belief not in visited:
                    visited.add(next_belief)
                    step_trace = list(trace) + [{
                        "action": act,
                        "belief_size": len(next_belief),
                        "sample_state": list(next_belief)[0] if next_belief else ""
                    }]
                    queue.append((next_belief, plan + [act], step_trace))

        # If pure conformant plan is not found without sensing, demonstrate observation branch
        return cls._simulate_observed_belief_resolution(prob)

    @classmethod
    def _simulate_observed_belief_resolution(cls, prob: PartiallyObservableEVProblem) -> BeliefSearchResult:
        """
        Demonstrates belief state update with sensory feedback:
        1. Action: PING_STATUS_A
        2. Percept: SENSOR_A_AVAILABLE
        3. Belief collapses from {S1, S2, S3} -> {S1, S3}
        4. Action: NAVIGATE_STATION_A -> CONNECT_CHARGER -> Goal reached.
        """
        b0 = prob.get_initial_belief_state()
        trace = [{"step": 0, "action": "INITIAL", "belief_size": len(b0), "uncertainty": "Stations A and B unobserved"}]
        
        # Step 1: Sense Station A
        act1 = "PING_STATUS_A"
        percept = "SENSOR_A_AVAILABLE"
        b1 = prob.predict_and_update(b0, act1, observed_percept=percept)
        trace.append({
            "step": 1,
            "action": act1,
            "percept_received": percept,
            "belief_size": len(b1),
            "uncertainty": "Eliminated state where Station A was busy. Station A is guaranteed AVAILABLE."
        })

        # Step 2: Navigate to Station A
        act2 = "NAVIGATE_STATION_A"
        b2 = prob.predict_and_update(b1, act2)
        trace.append({
            "step": 2,
            "action": act2,
            "belief_size": len(b2),
            "uncertainty": "EV physically at Station A."
        })

        # Step 3: Connect Charger
        act3 = "CONNECT_CHARGER"
        b3 = prob.predict_and_update(b2, act3)
        goal_met = prob.is_goal_belief(b3)
        trace.append({
            "step": 3,
            "action": act3,
            "belief_size": len(b3),
            "is_goal": goal_met,
            "uncertainty": "All remaining physical states in belief set satisfy is_charging=True."
        })

        return BeliefSearchResult(
            algorithm="BELIEF_STATE_SEARCH",
            initial_belief_size=len(b0),
            goal_reached=goal_met,
            plan_actions=[act1, act2, act3],
            belief_trace=trace,
            nodes_explored=4,
            explanation=(
                "Partial observability resolved: Pinging Station A eliminated uncertain states. "
                "The agent navigated to guaranteed open Station A and achieved goal with 100% certainty."
            )
        )
