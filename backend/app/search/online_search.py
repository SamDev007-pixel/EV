"""
Online Search with Learning Real-Time A* (LRTA*).
Online search agents for environments whose structure is unknown up front.

Unlike offline search algorithms (which compute a full path before moving), an
Online Search Agent interleaves computation and physical execution in unknown or
dynamically evolving environments.

In EV Charging corridors:
- Unmapped traffic delays, roadwork, and dynamic station queues change real edge costs.
- The agent explores one step at a time, senses actual edge costs, and updates its
  heuristic table H(s) online:
  H(s) <- max(H(s), min_a [ c(s, a, s') + H(s') ])
- LRTA* is guaranteed to find a goal in any finite, safely explorable environment
  and converges to optimal paths over repeated trials without getting trapped in local loops.
"""

from typing import Dict, List, Tuple, Any, Optional
from pydantic import BaseModel, Field


class OnlineStepRecord(BaseModel):
    step_number: int
    current_node: str
    action_chosen: str
    next_node: str
    step_cost: float
    old_heuristic: float
    updated_heuristic: float
    total_cost_so_far: float


class OnlineSearchResult(BaseModel):
    algorithm: str = "LRTA_STAR_ONLINE_SEARCH"
    start_node: str
    goal_node: str
    goal_reached: bool
    path_traversed: List[str]
    total_travel_cost: float
    total_steps: int
    heuristic_updates_count: int
    step_history: List[OnlineStepRecord]
    final_heuristic_table: Dict[str, float]
    explanation: str


class OnlineRoadNetwork:
    """
    Simulated dynamic road/charging network where some edge costs are discovered
    only upon arrival (e.g. sudden traffic delay or charger queue).
    """

    def __init__(self):
        # Nodes: Junctions and Charging Hubs
        self.nodes = ["J_NORTH", "J_EAST", "J_WEST", "J_CENTRAL", "STATION_DC_FAST", "STATION_AC_HUB"]
        
        # Adjacency graph: {from_node: {to_node: base_cost}}
        self.edges: Dict[str, Dict[str, float]] = {
            "J_NORTH": {"J_EAST": 4.0, "J_WEST": 3.0, "J_CENTRAL": 6.0},
            "J_WEST": {"J_NORTH": 3.0, "J_CENTRAL": 2.5, "STATION_AC_HUB": 7.0},
            "J_EAST": {"J_NORTH": 4.0, "J_CENTRAL": 3.0, "STATION_DC_FAST": 5.0},
            "J_CENTRAL": {"J_NORTH": 6.0, "J_WEST": 2.5, "J_EAST": 3.0, "STATION_DC_FAST": 4.0, "STATION_AC_HUB": 3.5},
            "STATION_DC_FAST": {"J_EAST": 5.0, "J_CENTRAL": 4.0},
            "STATION_AC_HUB": {"J_WEST": 7.0, "J_CENTRAL": 3.5}
        }
        
        # Real-time traffic delays discovered online (not known initially)
        self.unmapped_delays: Dict[Tuple[str, str], float] = {
            ("J_NORTH", "J_CENTRAL"): 5.0,     # Road construction delay (+5 min)
            ("J_CENTRAL", "STATION_DC_FAST"): 3.0  # Station access ramp queue (+3 min)
        }

        # Initial heuristic estimates h(s) to STATION_DC_FAST
        self.initial_heuristics: Dict[str, float] = {
            "J_NORTH": 7.0,
            "J_WEST": 6.0,
            "J_EAST": 4.5,
            "J_CENTRAL": 3.5,
            "STATION_DC_FAST": 0.0,
            "STATION_AC_HUB": 4.0
        }

    def get_actions(self, node: str) -> List[str]:
        return list(self.edges.get(node, {}).keys())

    def get_step_cost(self, u: str, v: str) -> float:
        base = self.edges.get(u, {}).get(v, 999.0)
        delay = self.unmapped_delays.get((u, v), 0.0)
        return round(base + delay, 2)


class LRTAStarAgent:
    """
    Learning Real-Time A* Agent.
    Interleaves single-step action execution with local heuristic updates.
    """

    def __init__(self, network: Optional[OnlineRoadNetwork] = None):
        self.network = network or OnlineRoadNetwork()
        self.H: Dict[str, float] = dict(self.network.initial_heuristics)

    def run_online_search(
        self,
        start_node: str = "J_NORTH",
        goal_node: str = "STATION_DC_FAST",
        max_steps: int = 25
    ) -> OnlineSearchResult:
        current = start_node
        path = [current]
        history: List[OnlineStepRecord] = []
        total_cost = 0.0
        updates_count = 0

        for step in range(1, max_steps + 1):
            if current == goal_node:
                break

            neighbors = self.network.get_actions(current)
            if not neighbors:
                break

            # Evaluate each candidate action: cost(current, next) + H(next)
            action_evals = []
            for nxt in neighbors:
                c = self.network.get_step_cost(current, nxt)
                h_val = self.H.get(nxt, 0.0)
                action_evals.append((c + h_val, nxt, c))

            # Select best action (greedy over f = c + H)
            action_evals.sort(key=lambda x: x[0])
            best_f, best_next, actual_cost = action_evals[0]

            old_h = self.H[current]
            # LRTA* Update Rule: H(s) <- max(H(s), min_a [c(s, a, s') + H(s')])
            new_h = round(best_f, 2)
            if new_h > old_h:
                self.H[current] = new_h
                updates_count += 1

            total_cost += actual_cost
            history.append(OnlineStepRecord(
                step_number=step,
                current_node=current,
                action_chosen=f"MOVE_TO_{best_next}",
                next_node=best_next,
                step_cost=actual_cost,
                old_heuristic=old_h,
                updated_heuristic=new_h,
                total_cost_so_far=round(total_cost, 2)
            ))

            current = best_next
            path.append(current)

        goal_reached = (current == goal_node)
        explanation = (
            f"LRTA* Online Search reached goal '{goal_node}' in {len(path)-1} moves. "
            f"Total travel cost: {total_cost:.2f}. "
            f"Dynamically updated heuristic table {updates_count} times to learn real-time congestion costs."
        )

        return OnlineSearchResult(
            algorithm="LRTA_STAR_ONLINE_SEARCH",
            start_node=start_node,
            goal_node=goal_node,
            goal_reached=goal_reached,
            path_traversed=path,
            total_travel_cost=round(total_cost, 2),
            total_steps=len(history),
            heuristic_updates_count=updates_count,
            step_history=history,
            final_heuristic_table={k: round(v, 2) for k, v in self.H.items()},
            explanation=explanation
        )
