import time
import heapq
from collections import deque
from typing import List, Dict, Tuple, Optional, Callable, Set, Any
from pydantic import BaseModel, Field

from app.search.problem import SearchProblem, SearchState, SearchAction, EVRouteSearchProblem
from app.search.heuristics import domain_specific_station_heuristic, euclidean_distance_heuristic


class SearchNode:
    def __init__(
        self,
        state: SearchState,
        parent: Optional["SearchNode"] = None,
        action: Optional[SearchAction] = None,
        path_cost: float = 0.0,
        heuristic: float = 0.0
    ):
        self.state = state
        self.parent = parent
        self.action = action
        self.path_cost = path_cost
        self.heuristic = heuristic

    @property
    def f_cost(self) -> float:
        return self.path_cost + self.heuristic

    # For priority queue ordering
    def __lt__(self, other: "SearchNode") -> bool:
        return self.f_cost < other.f_cost


class SearchResult(BaseModel):
    algorithm: str
    success: bool
    path: List[str] = Field(default_factory=list)
    path_names: List[str] = Field(default_factory=list)
    actions: List[Dict[str, Any]] = Field(default_factory=list)
    path_cost: float = 0.0
    nodes_explored: int = 0
    execution_time_ms: float = 0.0
    explored_sequence: List[str] = Field(default_factory=list)
    selected_station: Optional[str] = None
    total_duration_min: float = 0.0
    total_charging_cost_usd: float = 0.0


def _reconstruct_path(goal_node: SearchNode, problem: EVRouteSearchProblem) -> Tuple[List[str], List[str], List[Dict], Optional[str], float, float]:
    path = []
    path_names = []
    actions = []
    curr = goal_node
    selected_station = None
    total_charging_cost = 0.0

    while curr:
        node_id = curr.state.node_id
        path.append(node_id)
        g_node = problem.graph.get_node(node_id)
        path_names.append(g_node.name if g_node else node_id)

        if curr.state.station_visited and not selected_station:
            selected_station = curr.state.station_visited

        if curr.action:
            actions.append(curr.action.model_dump())
            if curr.action.action_type == "CHARGE_AND_TRAVEL":
                total_charging_cost += curr.action.charging_cost_usd

        curr = curr.parent

    path.reverse()
    path_names.reverse()
    actions.reverse()

    total_duration = goal_node.state.current_time_min - problem.start_time_min

    return path, path_names, actions, selected_station, round(total_duration, 2), round(total_charging_cost, 2)


# --- 1. BREADTH FIRST SEARCH (BFS) ---
def breadth_first_search(problem: EVRouteSearchProblem) -> SearchResult:
    start_time = time.perf_counter()
    init_state = problem.get_initial_state()
    start_node = SearchNode(init_state)

    if problem.is_goal_state(init_state):
        exec_time = (time.perf_counter() - start_time) * 1000.0
        return SearchResult(
            algorithm="BFS",
            success=True,
            path=[init_state.node_id],
            path_names=[problem.graph.get_node(init_state.node_id).name],
            path_cost=0.0,
            nodes_explored=1,
            execution_time_ms=round(exec_time, 3)
        )

    frontier = deque([start_node])
    explored_keys: Set[Tuple[str, bool]] = set()
    explored_keys.add(init_state.state_key())
    explored_sequence = []
    nodes_explored_count = 0

    while frontier:
        node = frontier.popleft()
        nodes_explored_count += 1
        explored_sequence.append(node.state.node_id)

        if problem.is_goal_state(node.state):
            exec_time = (time.perf_counter() - start_time) * 1000.0
            path, path_names, actions, station, duration, charge_cost = _reconstruct_path(node, problem)
            return SearchResult(
                algorithm="BFS",
                success=True,
                path=path,
                path_names=path_names,
                actions=actions,
                path_cost=round(node.path_cost, 4),
                nodes_explored=nodes_explored_count,
                execution_time_ms=round(exec_time, 3),
                explored_sequence=explored_sequence,
                selected_station=station,
                total_duration_min=duration,
                total_charging_cost_usd=charge_cost
            )

        for action in problem.get_actions(node.state):
            child_state = problem.get_result(node.state, action)
            child_key = child_state.state_key()

            if child_key not in explored_keys:
                explored_keys.add(child_key)
                step_c = problem.get_step_cost(node.state, action, child_state)
                child_node = SearchNode(
                    state=child_state,
                    parent=node,
                    action=action,
                    path_cost=node.path_cost + step_c
                )
                frontier.append(child_node)

    exec_time = (time.perf_counter() - start_time) * 1000.0
    return SearchResult(
        algorithm="BFS",
        success=False,
        nodes_explored=nodes_explored_count,
        execution_time_ms=round(exec_time, 3),
        explored_sequence=explored_sequence
    )


# --- 2. DEPTH FIRST SEARCH (DFS) ---
def depth_first_search(problem: EVRouteSearchProblem) -> SearchResult:
    start_time = time.perf_counter()
    init_state = problem.get_initial_state()
    start_node = SearchNode(init_state)

    frontier = [start_node]
    explored_keys: Set[Tuple[str, bool]] = set()
    explored_sequence = []
    nodes_explored_count = 0

    while frontier:
        node = frontier.pop()  # LIFO Stack
        state_key = node.state.state_key()

        if state_key in explored_keys:
            continue

        explored_keys.add(state_key)
        nodes_explored_count += 1
        explored_sequence.append(node.state.node_id)

        if problem.is_goal_state(node.state):
            exec_time = (time.perf_counter() - start_time) * 1000.0
            path, path_names, actions, station, duration, charge_cost = _reconstruct_path(node, problem)
            return SearchResult(
                algorithm="DFS",
                success=True,
                path=path,
                path_names=path_names,
                actions=actions,
                path_cost=round(node.path_cost, 4),
                nodes_explored=nodes_explored_count,
                execution_time_ms=round(exec_time, 3),
                explored_sequence=explored_sequence,
                selected_station=station,
                total_duration_min=duration,
                total_charging_cost_usd=charge_cost
            )

        for action in reversed(problem.get_actions(node.state)):
            child_state = problem.get_result(node.state, action)
            if child_state.state_key() not in explored_keys:
                step_c = problem.get_step_cost(node.state, action, child_state)
                child_node = SearchNode(
                    state=child_state,
                    parent=node,
                    action=action,
                    path_cost=node.path_cost + step_c
                )
                frontier.append(child_node)

    exec_time = (time.perf_counter() - start_time) * 1000.0
    return SearchResult(
        algorithm="DFS",
        success=False,
        nodes_explored=nodes_explored_count,
        execution_time_ms=round(exec_time, 3),
        explored_sequence=explored_sequence
    )


# --- 3. UNIFORM COST SEARCH (UCS / Dijkstra) ---
def uniform_cost_search(problem: EVRouteSearchProblem) -> SearchResult:
    start_time = time.perf_counter()
    init_state = problem.get_initial_state()
    start_node = SearchNode(init_state, path_cost=0.0)

    # Priority queue item: (path_cost, node_counter, node)
    counter = 0
    frontier = [(0.0, counter, start_node)]
    best_costs: Dict[Tuple[str, bool], float] = {init_state.state_key(): 0.0}
    explored_sequence = []
    nodes_explored_count = 0

    while frontier:
        cost, _, node = heapq.heappop(frontier)
        state_key = node.state.state_key()

        if cost > best_costs.get(state_key, float('inf')):
            continue

        nodes_explored_count += 1
        explored_sequence.append(node.state.node_id)

        if problem.is_goal_state(node.state):
            exec_time = (time.perf_counter() - start_time) * 1000.0
            path, path_names, actions, station, duration, charge_cost = _reconstruct_path(node, problem)
            return SearchResult(
                algorithm="UCS",
                success=True,
                path=path,
                path_names=path_names,
                actions=actions,
                path_cost=round(node.path_cost, 4),
                nodes_explored=nodes_explored_count,
                execution_time_ms=round(exec_time, 3),
                explored_sequence=explored_sequence,
                selected_station=station,
                total_duration_min=duration,
                total_charging_cost_usd=charge_cost
            )

        for action in problem.get_actions(node.state):
            child_state = problem.get_result(node.state, action)
            step_c = problem.get_step_cost(node.state, action, child_state)
            new_cost = node.path_cost + step_c
            child_key = child_state.state_key()

            if new_cost < best_costs.get(child_key, float('inf')):
                best_costs[child_key] = new_cost
                counter += 1
                child_node = SearchNode(
                    state=child_state,
                    parent=node,
                    action=action,
                    path_cost=new_cost
                )
                heapq.heappush(frontier, (new_cost, counter, child_node))

    exec_time = (time.perf_counter() - start_time) * 1000.0
    return SearchResult(
        algorithm="UCS",
        success=False,
        nodes_explored=nodes_explored_count,
        execution_time_ms=round(exec_time, 3),
        explored_sequence=explored_sequence
    )


# --- 4. GREEDY BEST FIRST SEARCH (GBFS) ---
def greedy_best_first_search(
    problem: EVRouteSearchProblem,
    heuristic_fn: Callable[[SearchState, EVRouteSearchProblem], float] = domain_specific_station_heuristic
) -> SearchResult:
    start_time = time.perf_counter()
    init_state = problem.get_initial_state()
    h_init = heuristic_fn(init_state, problem)
    start_node = SearchNode(init_state, path_cost=0.0, heuristic=h_init)

    counter = 0
    # Ordered by heuristic h only
    frontier = [(h_init, counter, start_node)]
    explored_keys: Set[Tuple[str, bool]] = set()
    explored_sequence = []
    nodes_explored_count = 0

    while frontier:
        h_val, _, node = heapq.heappop(frontier)
        state_key = node.state.state_key()

        if state_key in explored_keys:
            continue

        explored_keys.add(state_key)
        nodes_explored_count += 1
        explored_sequence.append(node.state.node_id)

        if problem.is_goal_state(node.state):
            exec_time = (time.perf_counter() - start_time) * 1000.0
            path, path_names, actions, station, duration, charge_cost = _reconstruct_path(node, problem)
            return SearchResult(
                algorithm="Greedy Best-First",
                success=True,
                path=path,
                path_names=path_names,
                actions=actions,
                path_cost=round(node.path_cost, 4),
                nodes_explored=nodes_explored_count,
                execution_time_ms=round(exec_time, 3),
                explored_sequence=explored_sequence,
                selected_station=station,
                total_duration_min=duration,
                total_charging_cost_usd=charge_cost
            )

        for action in problem.get_actions(node.state):
            child_state = problem.get_result(node.state, action)
            child_key = child_state.state_key()

            if child_key not in explored_keys:
                step_c = problem.get_step_cost(node.state, action, child_state)
                h_child = heuristic_fn(child_state, problem)
                counter += 1
                child_node = SearchNode(
                    state=child_state,
                    parent=node,
                    action=action,
                    path_cost=node.path_cost + step_c,
                    heuristic=h_child
                )
                heapq.heappush(frontier, (h_child, counter, child_node))

    exec_time = (time.perf_counter() - start_time) * 1000.0
    return SearchResult(
        algorithm="Greedy Best-First",
        success=False,
        nodes_explored=nodes_explored_count,
        execution_time_ms=round(exec_time, 3),
        explored_sequence=explored_sequence
    )


# --- 5. A* SEARCH (Astar) ---
def a_star_search(
    problem: EVRouteSearchProblem,
    heuristic_fn: Callable[[SearchState, EVRouteSearchProblem], float] = domain_specific_station_heuristic
) -> SearchResult:
    start_time = time.perf_counter()
    init_state = problem.get_initial_state()
    h_init = heuristic_fn(init_state, problem)
    start_node = SearchNode(init_state, path_cost=0.0, heuristic=h_init)

    counter = 0
    # Ordered by f(n) = g(n) + h(n)
    frontier = [(start_node.f_cost, counter, start_node)]
    best_g_costs: Dict[Tuple[str, bool], float] = {init_state.state_key(): 0.0}
    explored_sequence = []
    nodes_explored_count = 0

    while frontier:
        f_val, _, node = heapq.heappop(frontier)
        state_key = node.state.state_key()

        if node.path_cost > best_g_costs.get(state_key, float('inf')):
            continue

        nodes_explored_count += 1
        explored_sequence.append(node.state.node_id)

        if problem.is_goal_state(node.state):
            exec_time = (time.perf_counter() - start_time) * 1000.0
            path, path_names, actions, station, duration, charge_cost = _reconstruct_path(node, problem)
            return SearchResult(
                algorithm="A* Search",
                success=True,
                path=path,
                path_names=path_names,
                actions=actions,
                path_cost=round(node.path_cost, 4),
                nodes_explored=nodes_explored_count,
                execution_time_ms=round(exec_time, 3),
                explored_sequence=explored_sequence,
                selected_station=station,
                total_duration_min=duration,
                total_charging_cost_usd=charge_cost
            )

        for action in problem.get_actions(node.state):
            child_state = problem.get_result(node.state, action)
            step_c = problem.get_step_cost(node.state, action, child_state)
            new_g = node.path_cost + step_c
            child_key = child_state.state_key()

            if new_g < best_g_costs.get(child_key, float('inf')):
                best_g_costs[child_key] = new_g
                h_child = heuristic_fn(child_state, problem)
                counter += 1
                child_node = SearchNode(
                    state=child_state,
                    parent=node,
                    action=action,
                    path_cost=new_g,
                    heuristic=h_child
                )
                heapq.heappush(frontier, (child_node.f_cost, counter, child_node))

    exec_time = (time.perf_counter() - start_time) * 1000.0
    return SearchResult(
        algorithm="A* Search",
        success=False,
        nodes_explored=nodes_explored_count,
        execution_time_ms=round(exec_time, 3),
        explored_sequence=explored_sequence
    )
