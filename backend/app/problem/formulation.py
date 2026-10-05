import math
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from app.search.graph import ChargingNetworkGraph
from app.search.problem import EVRouteSearchProblem, SearchState
from app.csp.variables import CSPProblemState, CSPEVVariable, CSPDomainValue
from app.models.ev import EVModel, EVPriority


class ProblemFormulationRequest(BaseModel):
    ev_id: str = "EV-USER-01"
    origin_node_id: str = "WAYPOINT-NORTH"
    destination_node_id: str = "CS-METRO"
    battery_capacity_kwh: float = 60.0
    current_battery_kwh: float = 12.0
    required_battery_kwh: float = 48.0
    arrival_time_min: int = 0
    departure_deadline_min: int = 120
    charging_rate_kw: float = 100.0
    priority: str = "STANDARD"
    is_emergency: bool = False


class ClassicalProblemFormulation(BaseModel):
    problem_type: str = "EV_CHARGING_AND_ROUTING"
    state_space_representation: str = "Tuple <node_id: str, current_battery_kwh: float, station_visited: bool, current_time_min: int>"
    initial_state: Dict[str, Any]
    goal_test: str = "node_id == goal_node_id AND current_battery_kwh >= required_battery_kwh"
    actions_available: List[str]
    transition_model: str = "Deterministic transition: TRAVEL(edge) reduces battery by dist*consumption; CHARGE(port) increases battery by power*duration"
    step_cost_function: str = "c(s, a, s') = road_travel_cost + (charging_energy_kwh * tariff) + queue_wait_penalty"
    admissible_heuristic: str = "h_dist(n) = euclidean_distance(n, goal) / v_max <= h*(n)"
    csp_variables: List[str]
    csp_domains_quantization: str = "15-minute discrete time slot increments, discrete power levels {25, 50, 100, 150} kW"
    hard_constraints_count: int = 8
    knowledge_base_facts_asserted: List[str]


class ProblemFormulator:
    @staticmethod
    def formulate_search_problem(
        req: ProblemFormulationRequest,
        graph: Optional[ChargingNetworkGraph] = None
    ) -> EVRouteSearchProblem:
        if graph is None:
            graph = ChargingNetworkGraph.create_default_network()
        
        return EVRouteSearchProblem(
            graph=graph,
            origin_node_id=req.origin_node_id,
            goal_node_id=req.destination_node_id,
            initial_battery_kwh=req.current_battery_kwh,
            required_battery_kwh=req.required_battery_kwh,
            start_time_min=req.arrival_time_min
        )

    @staticmethod
    def formulate_csp_problem(
        ev_requests: List[ProblemFormulationRequest],
        stations: Optional[Dict[str, Any]] = None,
        chargers: Optional[Dict[str, Any]] = None,
        transformer_capacity_kw: float = 300.0
    ) -> CSPProblemState:
        variables: Dict[str, CSPEVVariable] = {}
        for req in ev_requests:
            variables[req.ev_id] = CSPEVVariable(
                ev_id=req.ev_id,
                battery_capacity=req.battery_capacity_kwh,
                current_battery=req.current_battery_kwh,
                target_battery=req.required_battery_kwh,
                charging_rate=req.charging_rate_kw,
                arrival_time=req.arrival_time_min,
                departure_deadline=req.departure_deadline_min,
                priority=req.priority
            )
        
        st_dict = stations or {
            "CS-NORTH": {"id": "CS-NORTH", "name": "Hebbal Hub", "operatingStatus": "OPERATIONAL", "maximumPower": 200.0, "chargers": ["CS-NORTH-CH-1", "CS-NORTH-CH-2"]},
            "CS-METRO": {"id": "CS-METRO", "name": "MG Road Hub", "operatingStatus": "OPERATIONAL", "maximumPower": 250.0, "chargers": ["CS-METRO-CH-1", "CS-METRO-CH-2"]}
        }
        ch_dict = chargers or {
            "CS-NORTH-CH-1": {"id": "CS-NORTH-CH-1", "stationId": "CS-NORTH", "maximumPower": 150.0, "currentStatus": "AVAILABLE", "chargerType": "ULTRA_FAST"},
            "CS-NORTH-CH-2": {"id": "CS-NORTH-CH-2", "stationId": "CS-NORTH", "maximumPower": 50.0, "currentStatus": "AVAILABLE", "chargerType": "DC_FAST"},
            "CS-METRO-CH-1": {"id": "CS-METRO-CH-1", "stationId": "CS-METRO", "maximumPower": 150.0, "currentStatus": "AVAILABLE", "chargerType": "ULTRA_FAST"},
            "CS-METRO-CH-2": {"id": "CS-METRO-CH-2", "stationId": "CS-METRO", "maximumPower": 50.0, "currentStatus": "AVAILABLE", "chargerType": "DC_FAST"}
        }

        return CSPProblemState(
            variables=variables,
            stations=st_dict,
            chargers=ch_dict,
            transformer_capacity_kw=transformer_capacity_kw,
            time_horizon_min=180,
            time_step_min=15
        )

    @staticmethod
    def explain_formulation(req: ProblemFormulationRequest) -> ClassicalProblemFormulation:
        return ClassicalProblemFormulation(
            initial_state={
                "node_id": req.origin_node_id,
                "current_battery_kwh": req.current_battery_kwh,
                "station_visited": False,
                "current_time_min": req.arrival_time_min
            },
            actions_available=[
                f"TRAVEL(from, to): Navigate weighted road edge across network graph",
                f"CHARGE_AND_TRAVEL(station, charger): Reserve charger port and recharge to target {req.required_battery_kwh} kWh"
            ],
            csp_variables=[req.ev_id],
            knowledge_base_facts_asserted=[
                f"({req.ev_id}, battery_soc_percent, {round((req.current_battery_kwh / max(1.0, req.battery_capacity_kwh)) * 100.0, 1)})",
                f"({req.ev_id}, departure_deadline_min, {req.departure_deadline_min})",
                f"({req.ev_id}, is_emergency, {req.is_emergency})",
                f"({req.ev_id}, priority, {req.priority})"
            ]
        )

    describe_formulation = explain_formulation
