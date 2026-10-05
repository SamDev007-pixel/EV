import math
from typing import Dict, Any, Tuple
from app.search.problem import SearchState, EVRouteSearchProblem
from app.search.graph import NodeType


def euclidean_distance_heuristic(state: SearchState, problem: EVRouteSearchProblem) -> float:
    """
    Admissible and consistent spatial distance heuristic.
    Estimates lower bound travel cost from current node to target goal node based on Euclidean distance.
    """
    current_node = problem.graph.get_node(state.node_id)
    goal_node = problem.graph.get_node(problem.goal_node_id)

    if not current_node or not goal_node:
        return 0.0

    dist_km = current_node.euclidean_distance_to(goal_node)
    
    # Minimum possible cost per km (assuming zero traffic, zero price)
    min_cost_per_km = 0.10
    return round(dist_km * min_cost_per_km, 4)


def domain_specific_station_heuristic(state: SearchState, problem: EVRouteSearchProblem) -> float:
    """
    Domain-specific explainable heuristic for EV Station & Route Selection.
    Accounts for:
    1. Distance to goal destination (via charging station if not yet charged).
    2. Estimated minimum energy cost required to reach target battery level.
    3. Estimated minimum travel & charging time impact.
    """
    current_node = problem.graph.get_node(state.node_id)
    goal_node = problem.graph.get_node(problem.goal_node_id)

    if not current_node or not goal_node:
        return 0.0

    needs_charging = not state.station_visited and (problem.initial_battery_kwh < problem.required_battery_kwh)

    if not needs_charging:
        # Simple straight-line lower bound cost to goal
        dist = current_node.euclidean_distance_to(goal_node)
        return round(dist * 0.15, 4)

    # EV needs charging: estimate cost via nearest/best candidate station
    all_stations = [
        n for n in problem.graph.nodes.values()
        if n.node_type == NodeType.CHARGING_STATION and n.operating_status == "OPERATIONAL"
    ]

    if not all_stations:
        # Fallback if no operational station found
        return round(current_node.euclidean_distance_to(goal_node) * 0.50, 4)

    min_total_est_cost = float('inf')

    for st in all_stations:
        # Leg 1: Current node -> Station
        dist1 = current_node.euclidean_distance_to(st)
        # Leg 2: Station -> Destination
        dist2 = st.euclidean_distance_to(goal_node)

        travel_dist_total = dist1 + dist2
        travel_cost_est = travel_dist_total * 0.15

        # Estimated charging cost
        energy_needed = max(0.0, problem.required_battery_kwh - state.current_battery_kwh)
        min_price = st.energy_price_usd_kwh
        charging_cost_est = energy_needed * min_price

        # Queue wait estimation
        queue_penalty_est = st.queue_length * 1.5  # $1.50 per vehicle in queue penalty estimate

        total_h = travel_cost_est + charging_cost_est + queue_penalty_est

        if total_h < min_total_est_cost:
            min_total_est_cost = total_h

    return round(min_total_est_cost, 4)


def explain_heuristic_score(state: SearchState, problem: EVRouteSearchProblem) -> Dict[str, Any]:
    """
    Produces a human-readable explanation of the heuristic evaluation for state n.
    """
    h_value = domain_specific_station_heuristic(state, problem)
    current_node = problem.graph.get_node(state.node_id)
    goal_node = problem.graph.get_node(problem.goal_node_id)

    needs_charging = not state.station_visited and (problem.initial_battery_kwh < problem.required_battery_kwh)

    rationale = []
    if needs_charging:
        rationale.append(f"EV battery is at {state.current_battery_kwh:.1f} kWh (< target {problem.required_battery_kwh:.1f} kWh). Heuristic includes estimated charging energy and station queue wait cost.")
    else:
        rationale.append(f"Station already visited / battery requirement met. Heuristic measures remaining direct distance to destination {goal_node.name if goal_node else problem.goal_node_id}.")

    return {
        "heuristic_value": h_value,
        "needs_charging": needs_charging,
        "current_node": current_node.name if current_node else state.node_id,
        "explanation": " ".join(rationale)
    }
