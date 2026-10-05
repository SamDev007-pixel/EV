from typing import List, Dict, Any, Union, Optional
from app.agents.base_agent import BaseAgent, AgentRole, Performative, AgentMessage
from app.models.station import StationModel, StationOperatingStatus
from app.models.charger import ChargerStatus


class ChargingStationAgent(BaseAgent):
    """
    Unified Master Station Agent managing and providing details for ALL charging stations
    in the Intelligent EV Charging & Resource Management System.
    """
    def __init__(self, stations: Union[Dict[str, StationModel], List[StationModel], StationModel]):
        super().__init__(
            agent_id="AGENT-STATION-MASTER",
            role=AgentRole.STATION_AGENT,
            goals=[
                "Manage and provide operational details for all charging stations in the network",
                "Maximize total charger utilization and revenue across all hubs",
                "Accurately report charger availability, pricing, and power limits to Coordinator and EVs"
            ]
        )
        # Normalize stations storage into dict {station_id: StationModel}
        if isinstance(stations, dict):
            self.stations: Dict[str, StationModel] = stations
        elif isinstance(stations, list):
            self.stations = {st.id: st for st in stations}
        elif isinstance(stations, StationModel):
            self.stations = {stations.id: stations}
        else:
            self.stations = {}

        self.station_percepts: Dict[str, Dict[str, Any]] = {}
        self.update_knowledge_summary()

    def update_knowledge_summary(self):
        """Update internal knowledge dictionary with network-wide station metrics."""
        total_chargers = sum(st.numberOfChargers for st in self.stations.values())
        avg_price = round(
            sum(st.energyPrice for st in self.stations.values()) / max(1, len(self.stations)), 2
        ) if self.stations else 0.0

        self.knowledge = {
            "agent_name": "Master Charging Station Agent",
            "managed_stations_count": len(self.stations),
            "total_chargers": total_chargers,
            "average_energy_price_usd": avg_price,
            "operational_status": "OPERATIONAL"
        }

    def perceive(self, environment_state: Dict[str, Any], current_tick: int):
        """Perceive live environment state for ALL managed stations in the network."""
        env_stations = environment_state.get("stations", [])
        for st_data in env_stations:
            st_id = st_data.get("id")
            if st_id:
                self.station_percepts[st_id] = st_data

    def get_station_details(self, station_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Public method to retrieve comprehensive operational details for all stations
        or a specific station managed by this agent.
        """
        if station_id:
            st_model = self.stations.get(station_id)
            if not st_model:
                return {"error": f"Station {station_id} not found under Master Station Agent."}
            percept = self.station_percepts.get(station_id, st_model.model_dump())
            return {
                "master_agent_id": self.identity,
                "station": percept
            }

        # Network-wide detailed summary
        all_details = []
        total_chargers = 0
        available_chargers = 0
        operational_count = 0

        for st_id, st_model in self.stations.items():
            percept = self.station_percepts.get(st_id, st_model.model_dump())
            op_status = percept.get("operatingStatus", st_model.operatingStatus.value)
            chargers = percept.get("chargers", [c.model_dump() for c in st_model.chargers])
            
            total_chargers += len(chargers)
            avail_in_st = sum(
                1 for c in chargers 
                if c.get("currentStatus", c.get("current_status")) == ChargerStatus.AVAILABLE.value
            )
            available_chargers += avail_in_st

            if op_status == StationOperatingStatus.OPERATIONAL.value:
                operational_count += 1

            all_details.append({
                "id": st_id,
                "name": percept.get("name", st_model.name),
                "operator": percept.get("operatorName", st_model.operatorName),
                "operating_status": op_status,
                "location": percept.get("location", st_model.location),
                "latitude": percept.get("latitude", st_model.latitude),
                "longitude": percept.get("longitude", st_model.longitude),
                "energy_price": percept.get("energyPrice", st_model.energyPrice),
                "charging_power_kw": percept.get("chargingPower", st_model.chargingPower),
                "total_chargers": len(chargers),
                "available_chargers": avail_in_st,
                "address": percept.get("address", st_model.address),
                "data_source": percept.get("dataSource", st_model.dataSource)
            })

        return {
            "master_agent_id": self.identity,
            "total_managed_stations": len(self.stations),
            "operational_stations_count": operational_count,
            "total_chargers_network": total_chargers,
            "total_available_chargers_network": available_chargers,
            "network_utilization_percent": round(
                ((total_chargers - available_chargers) / max(1, total_chargers)) * 100.0, 1
            ),
            "stations": all_details
        }

    def decide(self, current_tick: int) -> List[AgentMessage]:
        """
        Process messages and evaluate charging suitability across all managed stations.
        """
        outbound_messages = []

        def get_status(c):
            return c.get("currentStatus", c.get("current_status"))

        def get_power(c):
            return c.get("maximumPower", c.get("maximum_power", 50.0))

        def get_type(c):
            return c.get("chargerType", c.get("charger_type", "DC_FAST"))

        # Process incoming EV/Coordinator requests
        for msg in list(self.inbox):
            if msg.performative == Performative.REQUEST:
                ev_request = msg.content
                ev_id = ev_request.get("ev_id")
                energy_needed = ev_request.get("energy_needed_kwh", 0)
                requested_st_id = ev_request.get("station_id")

                # If specific station requested, evaluate that station; else evaluate default or best station
                target_st_id = requested_st_id if requested_st_id and requested_st_id in self.stations else "CS-NORTH"
                if target_st_id not in self.stations and self.stations:
                    target_st_id = list(self.stations.keys())[0]

                target_model = self.stations.get(target_st_id)
                if not target_model:
                    self.inbox.clear()
                    return outbound_messages

                percept = self.station_percepts.get(target_st_id, target_model.model_dump())
                op_status = percept.get("operatingStatus", target_model.operatingStatus.value)
                chargers = percept.get("chargers", [c.model_dump() for c in target_model.chargers])

                available_chargers = [c for c in chargers if get_status(c) == ChargerStatus.AVAILABLE.value]
                occupied_count = sum(1 for c in chargers if get_status(c) == ChargerStatus.OCCUPIED.value)
                utilization = round((occupied_count / max(1, len(chargers))) * 100.0, 1)

                if op_status != StationOperatingStatus.OPERATIONAL.value:
                    reasoning = f"Master Station Agent: Hub {target_st_id} is in {op_status} state. Cannot accept EV {ev_id}."
                    action = f"Send REJECT for EV {ev_id} at Station {target_st_id}"
                    result = "Station Fault/Unavailable"
                    self.log_decision(f"EV Request {ev_id}", reasoning, action, result, current_tick)
                elif not available_chargers:
                    reasoning = f"Master Station Agent: Hub {target_st_id} has 0 available chargers (Utilization {utilization}%)."
                    action = f"Send PROPOSE (Full Queue) for EV {ev_id}"
                    result = "Queued at station"
                    self.log_decision(f"EV Request {ev_id}", reasoning, action, result, current_tick)
                else:
                    best_charger = available_chargers[0]
                    c_power = get_power(best_charger)
                    c_type = get_type(best_charger)

                    reasoning = (
                        f"Master Station Agent evaluated network: Hub {target_st_id} has {len(available_chargers)} chargers available. "
                        f"Charger {best_charger['id']} ({c_type}) can provide {c_power} kW at ${target_model.energyPrice}/kWh. "
                        f"Total network hubs managed: {len(self.stations)}."
                    )
                    action = f"Send INFORM (Availability) to Coordinator for EV {ev_id} at Hub {target_st_id}"
                    result = f"Offered charger {best_charger['id']}"

                    self.log_decision(
                        input_desc=f"Evaluation for EV {ev_id} ({energy_needed:.1f} kWh needed)",
                        reasoning=reasoning,
                        action_desc=action,
                        result_desc=result,
                        timestamp=current_tick
                    )

                    response_msg = AgentMessage(
                        sender_id=self.identity,
                        sender_role=self.role,
                        recipient_id=msg.sender_id or "AGENT-COORDINATOR",
                        performative=Performative.INFORM,
                        content={
                            "station_id": target_st_id,
                            "ev_id": ev_id,
                            "suitable": True,
                            "charger_id": best_charger["id"],
                            "max_power_kw": c_power,
                            "price_per_kwh": target_model.energyPrice,
                            "available_count": len(available_chargers),
                            "total_network_stations": len(self.stations)
                        },
                        timestamp=current_tick
                    )
                    outbound_messages.append(response_msg)

        self.inbox.clear()
        return outbound_messages
