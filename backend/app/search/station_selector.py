from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field

from app.search.graph import ChargingNetworkGraph, GraphNode, GraphEdge, NodeType
from app.search.problem import EVRouteSearchProblem
from app.search.heuristics import domain_specific_station_heuristic
from app.search.algorithms import (
    breadth_first_search,
    depth_first_search,
    uniform_cost_search,
    greedy_best_first_search,
    a_star_search,
    SearchResult
)


class StationCandidateEval(BaseModel):
    station_id: str
    station_name: str
    distance_km: float
    queue_length: int
    queue_wait_min: float
    charging_power_kw: float
    estimated_charge_time_min: float
    total_trip_duration_min: float
    charging_cost_usd: float
    total_path_cost: float
    deadline_met: bool
    is_recommended: bool = False
    explanation: str


class EVScenario(BaseModel):
    ev_id: str = "EV-07"
    battery_percentage: float = 15.0  # 15%
    battery_capacity_kwh: float = 60.0
    target_battery_percentage: float = 80.0
    max_charging_rate_kw: float = 100.0
    current_location: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    destination_location: Dict[str, float] = Field(default_factory=lambda: {"x": 10.0, "y": 10.0})
    departure_deadline_min: float = 90.0  # e.g., 90 mins from start
    charger_type_needed: str = "DC_FAST"


class StationSelectorEngine:
    def __init__(self, graph: Optional[ChargingNetworkGraph] = None):
        self.graph = graph or ChargingNetworkGraph.create_default_network()

    def compare_candidate_stations(
        self,
        scenario: EVScenario,
        stations_override: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates candidate charging stations for an EV, balancing distance, wait time, energy price, and deadline.
        Returns a step-by-step explainable trade-off comparison.
        """
        initial_kwh = scenario.battery_capacity_kwh * (scenario.battery_percentage / 100.0)
        required_kwh = scenario.battery_capacity_kwh * (scenario.target_battery_percentage / 100.0)

        # Build custom or default graph with EV origin & destination
        graph = ChargingNetworkGraph.create_default_network(stations=stations_override)

        # Inject EV origin node
        origin_node = GraphNode(
            id=f"ORIGIN-{scenario.ev_id}",
            name=f"EV Origin ({scenario.ev_id})",
            node_type=NodeType.EV_LOCATION,
            x=scenario.current_location.get("x", 0.0),
            y=scenario.current_location.get("y", 0.0)
        )
        # Inject Goal Destination node
        dest_node = GraphNode(
            id=f"DEST-{scenario.ev_id}",
            name=f"Destination ({scenario.ev_id})",
            node_type=NodeType.DESTINATION,
            x=scenario.destination_location.get("x", 10.0),
            y=scenario.destination_location.get("y", 10.0)
        )

        graph.add_node(origin_node)
        graph.add_node(dest_node)

        # Connect EV origin to nearest waypoints/stations
        for n_id, node in graph.nodes.items():
            if node.id not in [origin_node.id, dest_node.id]:
                dist_orig = origin_node.euclidean_distance_to(node)
                if dist_orig <= 12.0:
                    graph.add_edge(GraphEdge(
                        source_id=origin_node.id,
                        target_id=node.id,
                        distance_km=round(dist_orig, 2),
                        travel_time_min=round(dist_orig * 1.5, 1),
                        travel_cost_usd=round(dist_orig * 0.10, 2)
                    ))

                dist_dest = node.euclidean_distance_to(dest_node)
                if dist_dest <= 12.0:
                    graph.add_edge(GraphEdge(
                        source_id=node.id,
                        target_id=dest_node.id,
                        distance_km=round(dist_dest, 2),
                        travel_time_min=round(dist_dest * 1.5, 1),
                        travel_cost_usd=round(dist_dest * 0.10, 2)
                    ))

        # Create Search Problem
        problem = EVRouteSearchProblem(
            graph=graph,
            origin_node_id=origin_node.id,
            goal_node_id=dest_node.id,
            ev_capacity_kwh=scenario.battery_capacity_kwh,
            initial_battery_kwh=initial_kwh,
            required_battery_kwh=required_kwh,
            max_charging_rate_kw=scenario.max_charging_rate_kw,
            departure_deadline_min=scenario.departure_deadline_min,
            charger_type_needed=scenario.charger_type_needed
        )

        # Execute primary intelligent search algorithm (A* Search)
        astar_res = a_star_search(problem, domain_specific_station_heuristic)

        # Detailed evaluation per candidate station
        evaluations: List[StationCandidateEval] = []

        candidate_stations = [
            n for n in graph.nodes.values()
            if n.node_type == NodeType.CHARGING_STATION
        ]

        best_station_id = astar_res.selected_station

        for st in candidate_stations:
            dist_to_st = origin_node.euclidean_distance_to(st)
            queue_wait = st.queue_length * (12.0 if st.available_chargers == 0 else 5.0)
            energy_needed = max(0.0, required_kwh - initial_kwh)
            eff_power = min(scenario.max_charging_rate_kw, st.charging_power_kw)
            charge_time = (energy_needed / eff_power) * 60.0 if eff_power > 0 else 99.0
            
            dist_dest = st.euclidean_distance_to(dest_node)
            trip_time = (dist_to_st * 1.5) + queue_wait + charge_time + (dist_dest * 1.5)
            charging_cost = energy_needed * st.energy_price_usd_kwh
            deadline_met = trip_time <= scenario.departure_deadline_min
            
            path_cost_est = charging_cost + (trip_time * 0.15) + (st.queue_length * 2.0)
            if not deadline_met:
                path_cost_est += 50.0  # Deadline breach penalty

            is_best = (st.id == best_station_id)

            if is_best:
                exp = f"RECOMMENDED: Best trade-off. Reaches destination in {trip_time:.1f} min within deadline ({scenario.departure_deadline_min} min). Queue wait is {queue_wait:.0f} min."
            elif not deadline_met:
                exp = f"REJECTED: High queue delay ({st.queue_length} vehicles waiting) causes total trip time ({trip_time:.1f} min) to breach deadline of {scenario.departure_deadline_min} min."
            elif dist_to_st > 6.0:
                exp = f"SUB-OPTIMAL: Station distance ({dist_to_st:.1f} km) increases travel overhead compared to recommended choice."
            else:
                exp = f"VIABLE ALTERNATIVE: Slightly higher path cost (${path_cost_est:.2f})."

            evaluations.append(StationCandidateEval(
                station_id=st.id,
                station_name=st.name,
                distance_km=round(dist_to_st, 2),
                queue_length=st.queue_length,
                queue_wait_min=round(queue_wait, 1),
                charging_power_kw=st.charging_power_kw,
                estimated_charge_time_min=round(charge_time, 1),
                total_trip_duration_min=round(trip_time, 1),
                charging_cost_usd=round(charging_cost, 2),
                total_path_cost=round(path_cost_est, 2),
                deadline_met=deadline_met,
                is_recommended=is_best,
                explanation=exp
            ))

        # Generate summary explainable recommendation text
        recommended_eval = next((e for e in evaluations if e.is_recommended), evaluations[0] if evaluations else None)
        
        explanation_summary = []
        if recommended_eval:
            explanation_summary.append(
                f"Selected {recommended_eval.station_name} using A* Search. "
                f"It provides an optimal balance between travel distance ({recommended_eval.distance_km} km), "
                f"queue wait time ({recommended_eval.queue_wait_min} min), and charging cost (${recommended_eval.charging_cost_usd:.2f}). "
                f"Total trip duration is {recommended_eval.total_trip_duration_min:.1f} min, fully respecting the user deadline of {scenario.departure_deadline_min:.0f} min."
            )

        return {
            "scenario": scenario.model_dump(),
            "selected_station_id": best_station_id,
            "recommended_station_name": recommended_eval.station_name if recommended_eval else "None",
            "explanation_summary": " ".join(explanation_summary),
            "candidate_evaluations": [e.model_dump() for e in evaluations],
            "astar_search_result": astar_res.model_dump()
        }

    def run_algorithm_comparison(self, scenario: EVScenario) -> Dict[str, Any]:
        """
        Runs all 5 classical search algorithms (BFS, DFS, UCS, GBFS, A*) on the same search problem.
        Returns detailed comparison matrix.
        """
        initial_kwh = scenario.battery_capacity_kwh * (scenario.battery_percentage / 100.0)
        required_kwh = scenario.battery_capacity_kwh * (scenario.target_battery_percentage / 100.0)

        graph = ChargingNetworkGraph.create_default_network()

        origin_node = GraphNode(
            id=f"ORIGIN-{scenario.ev_id}",
            name=f"EV Origin ({scenario.ev_id})",
            node_type=NodeType.EV_LOCATION,
            x=scenario.current_location.get("x", 0.0),
            y=scenario.current_location.get("y", 0.0)
        )
        dest_node = GraphNode(
            id=f"DEST-{scenario.ev_id}",
            name=f"Destination ({scenario.ev_id})",
            node_type=NodeType.DESTINATION,
            x=scenario.destination_location.get("x", 10.0),
            y=scenario.destination_location.get("y", 10.0)
        )

        graph.add_node(origin_node)
        graph.add_node(dest_node)

        # Connect EV origin and destination
        for n_id, node in graph.nodes.items():
            if node.id not in [origin_node.id, dest_node.id]:
                dist_orig = origin_node.euclidean_distance_to(node)
                graph.add_edge(GraphEdge(
                    source_id=origin_node.id,
                    target_id=node.id,
                    distance_km=round(dist_orig, 2),
                    travel_time_min=round(dist_orig * 1.5, 1),
                    travel_cost_usd=round(dist_orig * 0.10, 2)
                ))
                dist_dest = node.euclidean_distance_to(dest_node)
                graph.add_edge(GraphEdge(
                    source_id=node.id,
                    target_id=dest_node.id,
                    distance_km=round(dist_dest, 2),
                    travel_time_min=round(dist_dest * 1.5, 1),
                    travel_cost_usd=round(dist_dest * 0.10, 2)
                ))

        problem = EVRouteSearchProblem(
            graph=graph,
            origin_node_id=origin_node.id,
            goal_node_id=dest_node.id,
            ev_capacity_kwh=scenario.battery_capacity_kwh,
            initial_battery_kwh=initial_kwh,
            required_battery_kwh=required_kwh,
            max_charging_rate_kw=scenario.max_charging_rate_kw,
            departure_deadline_min=scenario.departure_deadline_min,
            charger_type_needed=scenario.charger_type_needed
        )

        # Run algorithms
        bfs_res = breadth_first_search(problem)
        dfs_res = depth_first_search(problem)
        ucs_res = uniform_cost_search(problem)
        gbfs_res = greedy_best_first_search(problem, domain_specific_station_heuristic)
        astar_res = a_star_search(problem, domain_specific_station_heuristic)

        results = [bfs_res, dfs_res, ucs_res, gbfs_res, astar_res]

        return {
            "scenario": scenario.model_dump(),
            "graph": graph.to_dict(),
            "comparison_matrix": [r.model_dump() for r in results]
        }
