from abc import ABC, abstractmethod
from typing import List, Dict, Optional, Tuple, Any
from pydantic import BaseModel, Field
from app.search.graph import ChargingNetworkGraph, GraphNode, GraphEdge, NodeType


class SearchState(BaseModel):
    node_id: str
    current_time_min: float
    current_battery_kwh: float
    station_visited: Optional[str] = None
    accumulated_cost: float = 0.0

    def state_key(self) -> Tuple[str, bool]:
        """Unique state hash key for graph search closed list / visited check."""
        return (self.node_id, self.station_visited is not None)


class SearchAction(BaseModel):
    edge: GraphEdge
    action_type: str = "TRAVEL"  # "TRAVEL" or "CHARGE_AND_TRAVEL"
    charging_kwh: float = 0.0
    charging_time_min: float = 0.0
    queue_wait_min: float = 0.0
    charging_cost_usd: float = 0.0


class SearchProblem(ABC):
    @abstractmethod
    def get_initial_state(self) -> SearchState:
        pass

    @abstractmethod
    def is_goal_state(self, state: SearchState) -> bool:
        pass

    @abstractmethod
    def get_actions(self, state: SearchState) -> List[SearchAction]:
        pass

    @abstractmethod
    def get_result(self, state: SearchState, action: SearchAction) -> SearchState:
        pass

    @abstractmethod
    def get_step_cost(self, state: SearchState, action: SearchAction, next_state: SearchState) -> float:
        pass


class EVRouteSearchProblem(SearchProblem):
    def __init__(
        self,
        graph: ChargingNetworkGraph,
        origin_node_id: str,
        goal_node_id: str,
        ev_capacity_kwh: float = 60.0,
        initial_battery_kwh: float = 9.0,      # e.g., 15%
        required_battery_kwh: float = 48.0,     # e.g., 80%
        max_charging_rate_kw: float = 100.0,
        departure_deadline_min: float = 90.0,
        start_time_min: float = 0.0,
        charger_type_needed: str = "DC_FAST"
    ):
        self.graph = graph
        self.origin_node_id = origin_node_id
        self.goal_node_id = goal_node_id
        self.ev_capacity_kwh = ev_capacity_kwh
        self.initial_battery_kwh = initial_battery_kwh
        self.required_battery_kwh = required_battery_kwh
        self.max_charging_rate_kw = max_charging_rate_kw
        self.departure_deadline_min = departure_deadline_min
        self.start_time_min = start_time_min
        self.charger_type_needed = charger_type_needed

        self.kwh_per_km = 0.20  # Average EV energy consumption rate

    def get_initial_state(self) -> SearchState:
        # Check if origin node is already a charging station or has met battery requirement
        origin_node = self.graph.get_node(self.origin_node_id)
        already_charged = self.initial_battery_kwh >= self.required_battery_kwh
        st_visited = origin_node.id if (origin_node and origin_node.node_type == NodeType.CHARGING_STATION) else None

        return SearchState(
            node_id=self.origin_node_id,
            current_time_min=self.start_time_min,
            current_battery_kwh=self.initial_battery_kwh,
            station_visited=st_visited if already_charged else None,
            accumulated_cost=0.0
        )

    def is_goal_state(self, state: SearchState) -> bool:
        if state.node_id != self.goal_node_id:
            return False
        # EV must have charged at least at one station or started with required battery level
        needs_charging = self.initial_battery_kwh < self.required_battery_kwh
        if needs_charging and not state.station_visited:
            return False
        return state.current_battery_kwh >= (self.required_battery_kwh * 0.95)

    def get_actions(self, state: SearchState) -> List[SearchAction]:
        actions = []
        neighbors = self.graph.get_neighbors(state.node_id)

        for next_node, edge in neighbors:
            # Energy consumption for travel along edge
            energy_used = edge.distance_km * self.kwh_per_km
            
            # Check if EV has enough battery to reach next node
            if state.current_battery_kwh < energy_used:
                continue  # Cannot traverse edge due to depleted battery

            if next_node.node_type == NodeType.CHARGING_STATION and not state.station_visited:
                # Option to stop and charge at this station
                energy_needed = max(0.0, self.required_battery_kwh - (state.current_battery_kwh - energy_used))
                effective_power = min(self.max_charging_rate_kw, next_node.charging_power_kw)
                charge_time_min = (energy_needed / effective_power) * 60.0 if effective_power > 0 else 999.0
                
                # Queue wait calculation
                queue_cars = next_node.queue_length
                avail = max(0, next_node.available_chargers)
                wait_min = (queue_cars * 12.0) if avail == 0 else (queue_cars * 5.0)
                
                charge_cost = energy_needed * next_node.energy_price_usd_kwh

                actions.append(SearchAction(
                    edge=edge,
                    action_type="CHARGE_AND_TRAVEL",
                    charging_kwh=energy_needed,
                    charging_time_min=charge_time_min,
                    queue_wait_min=wait_min,
                    charging_cost_usd=charge_cost
                ))
            
            # Standard travel without charging
            actions.append(SearchAction(
                edge=edge,
                action_type="TRAVEL",
                charging_kwh=0.0,
                charging_time_min=0.0,
                queue_wait_min=0.0,
                charging_cost_usd=0.0
            ))

        return actions

    def get_result(self, state: SearchState, action: SearchAction) -> SearchState:
        edge = action.edge
        target_node = self.graph.get_node(edge.target_id)
        
        energy_used = edge.distance_km * self.kwh_per_km
        battery_after_travel = state.current_battery_kwh - energy_used

        if action.action_type == "CHARGE_AND_TRAVEL":
            new_battery = battery_after_travel + action.charging_kwh
            total_duration = edge.travel_time_min + action.queue_wait_min + action.charging_time_min
            st_visited = target_node.id if target_node else edge.target_id
        else:
            new_battery = battery_after_travel
            total_duration = edge.travel_time_min
            st_visited = state.station_visited

        step_c = self.get_step_cost(state, action, None)

        return SearchState(
            node_id=edge.target_id,
            current_time_min=state.current_time_min + total_duration,
            current_battery_kwh=min(self.ev_capacity_kwh, new_battery),
            station_visited=st_visited,
            accumulated_cost=state.accumulated_cost + step_c
        )

    def get_step_cost(self, state: SearchState, action: SearchAction, next_state: Optional[SearchState]) -> float:
        edge = action.edge
        target_node = self.graph.get_node(edge.target_id)

        # 1. Base travel cost & travel time cost
        travel_cost = edge.travel_cost_usd + (edge.travel_time_min * 0.15)  # $0.15/min value of time

        # 2. Charging & Wait Cost if applicable
        if action.action_type == "CHARGE_AND_TRAVEL" and target_node:
            queue_wait_cost = action.queue_wait_min * 0.50   # Heavy penalty per minute of waiting ($0.50/min)
            charging_time_cost = action.charging_time_min * 0.10
            energy_usd = action.charging_cost_usd
            
            # Station operating status check
            status_penalty = 0.0
            if target_node.operating_status == "FAULT":
                status_penalty = 1000.0
            elif target_node.operating_status == "OVERLOADED":
                status_penalty = 50.0

            # Connector compatibility check
            compat_penalty = 0.0
            if self.charger_type_needed not in target_node.charger_types:
                compat_penalty = 100.0  # Incompatible charger penalty

            # Total charging step cost
            charging_step_cost = energy_usd + queue_wait_cost + charging_time_cost + status_penalty + compat_penalty
        else:
            charging_step_cost = 0.0

        total_step_cost = travel_cost + charging_step_cost

        # 3. User Deadline Risk Penalty
        projected_time = state.current_time_min + edge.travel_time_min + action.queue_wait_min + action.charging_time_min
        if projected_time > self.departure_deadline_min:
            lateness_min = projected_time - self.departure_deadline_min
            total_step_cost += (lateness_min * 2.0)  # $2.00 penalty per minute past deadline

        return round(total_step_cost, 4)
