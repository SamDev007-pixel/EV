import math
from enum import Enum
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    EV_LOCATION = "EV_LOCATION"
    CHARGING_STATION = "CHARGING_STATION"
    WAYPOINT = "WAYPOINT"
    DESTINATION = "DESTINATION"


class GraphNode(BaseModel):
    id: str
    name: str
    node_type: NodeType
    x: float
    y: float
    # Station-specific attributes if node_type == CHARGING_STATION
    queue_length: int = 0
    available_chargers: int = 0
    total_chargers: int = 4
    charging_power_kw: float = 150.0
    energy_price_usd_kwh: float = 0.25
    charger_types: List[str] = Field(default_factory=lambda: ["DC_FAST"])
    operating_status: str = "OPERATIONAL"

    def euclidean_distance_to(self, other: "GraphNode") -> float:
        return math.sqrt((self.x - other.x) ** 2 + (self.y - other.y) ** 2)


class GraphEdge(BaseModel):
    source_id: str
    target_id: str
    distance_km: float
    travel_time_min: float
    travel_cost_usd: float
    road_type: str = "URBAN"


def read_station_field(record: Dict, field_name: str, alias: str, default=None):
    """
    Read a station attribute that may be keyed either by field name (camelCase) or by alias
    (snake_case, which is what `StationModel.model_dump()` produces because the model is
    configured with `serialize_by_alias=True`).

    This helper exists because the graph builder previously read only camelCase keys while
    every API route passed `model_dump()` output. All lookups silently fell through to the
    defaults, so station status, price, power and queue length shown to the search algorithms
    were constant no matter what the simulation did - station faults never reached the search
    screen. Accepting both spellings makes the live-state pipeline work as intended.
    """
    if field_name in record and record[field_name] is not None:
        return record[field_name]
    if alias in record and record[alias] is not None:
        return record[alias]
    return default


class ChargingNetworkGraph:
    def __init__(self):
        self.nodes: Dict[str, GraphNode] = {}
        self.adjacency: Dict[str, List[GraphEdge]] = {}

    def add_node(self, node: GraphNode):
        self.nodes[node.id] = node
        if node.id not in self.adjacency:
            self.adjacency[node.id] = []

    def add_edge(self, edge: GraphEdge, bidirectional: bool = True):
        if edge.source_id not in self.nodes or edge.target_id not in self.nodes:
            raise ValueError(f"Both nodes ({edge.source_id}, {edge.target_id}) must exist in graph before adding edge.")
        
        self.adjacency[edge.source_id].append(edge)
        
        if bidirectional:
            rev_edge = GraphEdge(
                source_id=edge.target_id,
                target_id=edge.source_id,
                distance_km=edge.distance_km,
                travel_time_min=edge.travel_time_min,
                travel_cost_usd=edge.travel_cost_usd,
                road_type=edge.road_type
            )
            self.adjacency[edge.target_id].append(rev_edge)

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        return self.nodes.get(node_id)

    def get_neighbors(self, node_id: str) -> List[Tuple[GraphNode, GraphEdge]]:
        result = []
        for edge in self.adjacency.get(node_id, []):
            target_node = self.nodes.get(edge.target_id)
            if target_node:
                result.append((target_node, edge))
        return result

    def to_dict(self) -> Dict:
        edges_list = []
        visited_pairs = set()
        for src, edges in self.adjacency.items():
            for e in edges:
                pair = tuple(sorted([e.source_id, e.target_id]))
                if pair not in visited_pairs:
                    visited_pairs.add(pair)
                    edges_list.append(e.model_dump())

        return {
            "nodes": [n.model_dump() for n in self.nodes.values()],
            "edges": edges_list
        }

    @classmethod
    def create_default_network(cls, stations: Optional[List[Dict]] = None) -> "ChargingNetworkGraph":
        """
        Builds default urban charging network graph with EV origin, waypoints, charging stations, and destination.
        """
        graph = cls()

        # 1. Waypoints / Intersections
        waypoints = [
            GraphNode(id="WAYPOINT-NORTH", name="North Junction", node_type=NodeType.WAYPOINT, x=2.5, y=5.0),
            GraphNode(id="WAYPOINT-SOUTH", name="South Interchange", node_type=NodeType.WAYPOINT, x=7.5, y=5.0),
            GraphNode(id="WAYPOINT-CENTRAL", name="Metro Crossroads", node_type=NodeType.WAYPOINT, x=5.0, y=3.0),
            GraphNode(id="WAYPOINT-EAST", name="East Expressway Gate", node_type=NodeType.WAYPOINT, x=8.5, y=8.0),
        ]
        for wp in waypoints:
            graph.add_node(wp)

        # 2. Charging Stations
        if stations:
            for s in stations:
                st_id = read_station_field(s, "id", "id", "CS-GENERIC")
                loc = read_station_field(s, "location", "location", {"x": 5.0, "y": 5.0})
                queue_list = read_station_field(s, "currentQueue", "current_queue", [])
                queue = len(queue_list) if queue_list else read_station_field(s, "queue_length", "queue_length", 0)
                chargers = read_station_field(s, "chargers", "chargers", [])
                total_c = len(chargers) or read_station_field(s, "numberOfChargers", "number_of_chargers", 4)
                avail_c = (
                    sum(1 for c in chargers if read_station_field(c, "currentStatus", "current_status") == "AVAILABLE")
                    if chargers else read_station_field(s, "available_chargers", "available_chargers", 2)
                )
                pwr = read_station_field(s, "chargingPower", "charging_power", 180.0)
                price = read_station_field(s, "energyPrice", "energy_price", 0.25)
                c_types = read_station_field(s, "chargerTypes", "charger_types", ["DC_FAST", "ULTRA_FAST"])
                status = read_station_field(s, "operatingStatus", "operating_status", "OPERATIONAL")

                node = GraphNode(
                    id=st_id,
                    name=read_station_field(s, "name", "name", f"Station {st_id}"),
                    node_type=NodeType.CHARGING_STATION,
                    x=loc.get("x", 5.0),
                    y=loc.get("y", 5.0),
                    queue_length=queue,
                    available_chargers=avail_c,
                    total_chargers=total_c,
                    charging_power_kw=pwr,
                    energy_price_usd_kwh=price,
                    charger_types=c_types,
                    operating_status=status
                )
                graph.add_node(node)
        else:
            # Default stations if none provided
            st_a = GraphNode(
                id="CS-NORTH",
                name="Kazam EV - Hebbal Tech Park Supercharger",
                node_type=NodeType.CHARGING_STATION,
                x=2.5, y=8.0,
                queue_length=8,
                available_chargers=0,
                total_chargers=4,
                charging_power_kw=150.0,
                energy_price_usd_kwh=0.22,
                charger_types=["DC_FAST", "ULTRA_FAST"],
                operating_status="OPERATIONAL"
            )
            st_b = GraphNode(
                id="CS-METRO",
                name="Tata Power - MG Road Central Metro EV Hub",
                node_type=NodeType.CHARGING_STATION,
                x=5.0, y=5.0,
                queue_length=1,
                available_chargers=2,
                total_chargers=4,
                charging_power_kw=200.0,
                energy_price_usd_kwh=0.28,
                charger_types=["DC_FAST", "ULTRA_FAST"],
                operating_status="OPERATIONAL"
            )
            st_c = GraphNode(
                id="CS-SOUTH",
                name="Zeon EV - Electronic City Fast Hub",
                node_type=NodeType.CHARGING_STATION,
                x=8.0, y=1.5,
                queue_length=0,
                available_chargers=4,
                total_chargers=4,
                charging_power_kw=180.0,
                energy_price_usd_kwh=0.20,
                charger_types=["DC_FAST"],
                operating_status="OPERATIONAL"
            )
            graph.add_node(st_a)
            graph.add_node(st_b)
            graph.add_node(st_c)

        # 3. Interconnecting Edges
        edges = [
            # Waypoint connections
            GraphEdge(source_id="WAYPOINT-NORTH", target_id="WAYPOINT-CENTRAL", distance_km=3.2, travel_time_min=5.0, travel_cost_usd=0.6),
            GraphEdge(source_id="WAYPOINT-CENTRAL", target_id="WAYPOINT-SOUTH", distance_km=4.1, travel_time_min=6.5, travel_cost_usd=0.8),
            GraphEdge(source_id="WAYPOINT-SOUTH", target_id="WAYPOINT-EAST", distance_km=4.5, travel_time_min=7.0, travel_cost_usd=0.9),

            # Station connections
            GraphEdge(source_id="WAYPOINT-NORTH", target_id="CS-NORTH", distance_km=3.0, travel_time_min=4.5, travel_cost_usd=0.5),
            GraphEdge(source_id="WAYPOINT-CENTRAL", target_id="CS-METRO", distance_km=2.0, travel_time_min=3.0, travel_cost_usd=0.4),
            GraphEdge(source_id="WAYPOINT-SOUTH", target_id="CS-SOUTH", distance_km=3.5, travel_time_min=5.5, travel_cost_usd=0.7),
            GraphEdge(source_id="WAYPOINT-EAST", target_id="CS-METRO", distance_km=4.8, travel_time_min=7.5, travel_cost_usd=0.95),

            # Direct cross-station highway links
            GraphEdge(source_id="CS-NORTH", target_id="CS-METRO", distance_km=4.0, travel_time_min=6.0, travel_cost_usd=0.7),
            GraphEdge(source_id="CS-METRO", target_id="CS-SOUTH", distance_km=4.5, travel_time_min=7.0, travel_cost_usd=0.85),
        ]

        for e in edges:
            graph.add_edge(e, bidirectional=True)

        # 4. Connectivity for dynamically supplied stations
        # -------------------------------------------------
        # The literal edge list above only covers the three core hubs. Real stations loaded
        # from the public dataset (and any station injected later) would otherwise be isolated
        # nodes that no search algorithm can ever reach. Each unconnected station is linked to
        # its two nearest road waypoints using straight-line geometry as an approximation of
        # the road link, with the same cost model as the hand-written edges.
        if stations:
            waypoint_nodes = [n for n in graph.nodes.values() if n.node_type == NodeType.WAYPOINT]
            for s in stations:
                st_id = read_station_field(s, "id", "id")
                node = graph.nodes.get(st_id)
                if node is None:
                    continue
                if graph.adjacency.get(st_id):
                    continue  # already linked by the explicit edge list

                nearest = sorted(waypoint_nodes, key=lambda w: node.euclidean_distance_to(w))[:2]
                for waypoint in nearest:
                    dist_km = round(node.euclidean_distance_to(waypoint), 2)
                    graph.add_edge(
                        GraphEdge(
                            source_id=waypoint.id,
                            target_id=st_id,
                            distance_km=dist_km,
                            travel_time_min=round(dist_km * 1.5, 1),
                            travel_cost_usd=round(dist_km * 0.10, 2),
                        ),
                        bidirectional=True,
                    )

        return graph
