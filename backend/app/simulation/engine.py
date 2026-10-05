import math
import random
from typing import List, Dict, Optional

from app.models.ev import EVModel, EVStatus, EVPriority
from app.models.station import StationModel, StationOperatingStatus
from app.models.charger import ChargerModel, ChargerStatus, ChargerType
from app.models.grid import GridNodeModel, GridStatus
from app.models.energy_resource import EnergyResourceModel, EnergyResourceType, EnergyAvailabilityStatus
from app.models.session import ChargingSessionModel, SessionStatus
from app.core.peas import get_default_peas_spec, PEASMetrics

from app.agents.message_broker import agent_broker
from app.agents.ev_agent import EVAgent
from app.agents.station_agent import ChargingStationAgent
from app.agents.grid_agent import GridAgent
from app.agents.energy_agent import EnergyAgent
from app.agents.coordinator_agent import CoordinatorAgent


class SimulationEngine:
    def __init__(self, seed: int = 42):
        self.current_tick_min: int = 0
        self.is_running: bool = False
        self.strategy_name: str = "FCFS_BASELINE"
        
        self.grid_node: GridNodeModel = GridNodeModel()
        self.stations: Dict[str, StationModel] = {}
        self.chargers: Dict[str, ChargerModel] = {}
        self.evs: Dict[str, EVModel] = {}
        self.energy_resources: Dict[str, EnergyResourceModel] = {}
        self.sessions: Dict[str, ChargingSessionModel] = {}
        self.peas_metrics: PEASMetrics = PEASMetrics()
        
        self.reset_environment(seed)

    def reset_environment(self, seed: int = 42):
        """Deterministic environment initialization based on seed."""
        random.seed(seed)
        self.current_tick_min = 0
        self.is_running = False
        self.sessions.clear()
        agent_broker.agents.clear()
        agent_broker.global_logs.clear()
        
        # 1. Grid Node
        self.grid_node = GridNodeModel(
            id="GRID-TRANSFORMER-MAIN",
            maximumCapacity=450.0,
            currentLoad=0.0,
            status=GridStatus.STABLE
        )
        
        # 2. Energy Resources
        self.energy_resources = {
            "RES-SOLAR-01": EnergyResourceModel(
                id="RES-SOLAR-01",
                type=EnergyResourceType.SOLAR,
                availablePower=80.0,
                cost=0.05,
                availabilityStatus=EnergyAvailabilityStatus.AVAILABLE
            ),
            "RES-BATTERY-01": EnergyResourceModel(
                id="RES-BATTERY-01",
                type=EnergyResourceType.BATTERY_STORAGE,
                availablePower=150.0,
                cost=0.10,
                availabilityStatus=EnergyAvailabilityStatus.AVAILABLE
            )
        }
        
        # 3. Real Open Charge Map Stations & Core Simulation Hubs (Bengaluru)
        self.stations = {}
        self.chargers = {}
        
        # Core simulation stations (aligned with Bengaluru corridors for baseline unit test & scenario stability)
        station_configs = [
            ("CS-NORTH", "Kazam EV - Hebbal Tech Park Supercharger", 2.5, 8.0, 4, 200.0, 0.22, "Kazam EV", "Bellary Rd, Hebbal, Bengaluru, Karnataka 560024", 13.0358, 77.5970),
            ("CS-SOUTH", "Zeon EV - Electronic City Fast Hub", 8.0, 1.5, 4, 180.0, 0.20, "Zeon Charging", "Hosur Rd, Electronic City Phase 1, Bengaluru, Karnataka 560100", 12.8452, 77.6602),
            ("CS-METRO", "Tata Power - MG Road Central Metro EV Hub", 5.0, 5.0, 4, 250.0, 0.28, "Tata Power EZ Charge", "MG Road Metro Station, Shivaji Nagar, Bengaluru, Karnataka 560001", 12.9756, 77.6066)
        ]
        
        for st_id, st_name, x, y, num_chargers, max_pwr, price, op_name, addr, lat, lng in station_configs:
            station_chargers = []
            for i in range(1, num_chargers + 1):
                c_id = f"{st_id}-CH-{i}"
                c_type = ChargerType.ULTRA_FAST if i == 1 else ChargerType.DC_FAST
                power = 150.0 if c_type == ChargerType.ULTRA_FAST else 50.0
                
                charger = ChargerModel(
                    id=c_id,
                    stationId=st_id,
                    chargerType=c_type,
                    maximumPower=power,
                    currentStatus=ChargerStatus.AVAILABLE
                )
                self.chargers[c_id] = charger
                station_chargers.append(charger)

            station = StationModel(
                id=st_id,
                name=st_name,
                location={"x": x, "y": y},
                numberOfChargers=num_chargers,
                chargingPower=max_pwr,
                energyPrice=price,
                operatingStatus=StationOperatingStatus.OPERATIONAL,
                chargers=station_chargers,
                dataSource="OPEN_CHARGE_MAP",
                availabilityMode="EXTERNAL_METADATA",
                operatorName=op_name,
                address=addr,
                latitude=lat,
                longitude=lng
            )
            self.stations[st_id] = station

        # Load User-Supplied Real Indian Charging Stations (Shell, BPCL, Ather, Jio-bp, Zeon, ChargeZone, Hyundai)
        from app.services.custom_station_dataset import INDIAN_USER_STATIONS
        for user_st in INDIAN_USER_STATIONS:
            st_id = user_st["id"]
            station_chargers = []
            num_chargers = user_st.get("total_ports", 3)
            
            for i in range(1, num_chargers + 1):
                c_id = f"{st_id}-CH-{i}"
                c_type = ChargerType.ULTRA_FAST if i == 1 else ChargerType.DC_FAST
                power = user_st["charging_power_kw"] if i == 1 else 50.0
                
                charger = ChargerModel(
                    id=c_id,
                    stationId=st_id,
                    chargerType=c_type,
                    maximumPower=power,
                    currentStatus=ChargerStatus.AVAILABLE
                )
                self.chargers[c_id] = charger
                station_chargers.append(charger)

            grid_x = round(((user_st["longitude"] - 77.5946) * 10) + 5.0, 2)
            grid_y = round(((user_st["latitude"] - 12.9716) * 10) + 5.0, 2)
            grid_x = max(1.0, min(9.5, grid_x))
            grid_y = max(1.0, min(9.5, grid_y))

            station = StationModel(
                id=st_id,
                name=user_st["name"],
                location={"x": grid_x, "y": grid_y},
                numberOfChargers=len(station_chargers),
                chargingPower=user_st["charging_power_kw"],
                energyPrice=user_st.get("price_per_kwh", 16.0),
                operatingStatus=StationOperatingStatus.OPERATIONAL,
                chargers=station_chargers,
                dataSource=user_st.get("data_source", "OPEN_CHARGE_MAP"),
                availabilityMode="EXTERNAL_METADATA",
                operatorName=user_st["operator"],
                address=user_st["address"],
                latitude=user_st["latitude"],
                longitude=user_st["longitude"]
            )
            self.stations[st_id] = station

        # Fetch & Merge real Open Charge Map POI stations across India
        try:
            from app.services.open_charge_map_provider import OpenChargeMapProvider
            from app.models.open_charge_map_adapter import OpenChargeMapAdapter
            
            raw_ocm = OpenChargeMapProvider.fetch_raw_poi_data(
                country_code="IN", 
                max_results=50
            )
            ocm_normalized = OpenChargeMapAdapter.normalize_station_list(raw_ocm.get("data", []))
            
            for ext_st in ocm_normalized:
                st_id = ext_st.stationId
                if st_id in self.stations:
                    continue
                    
                station_chargers = []
                num_chargers = max(2, ext_st.numberOfConnections)
                
                for i in range(1, num_chargers + 1):
                    c_id = f"{st_id}-CH-{i}"
                    c_type = ChargerType.ULTRA_FAST if i == 1 else ChargerType.DC_FAST
                    power = ext_st.chargingPowerKW if i == 1 else 50.0
                    
                    charger = ChargerModel(
                        id=c_id,
                        stationId=st_id,
                        chargerType=c_type,
                        maximumPower=power,
                        currentStatus=ChargerStatus.AVAILABLE
                    )
                    self.chargers[c_id] = charger
                    station_chargers.append(charger)

                grid_x = round(((ext_st.longitude - 77.5946) * 100) + 5.0, 2)
                grid_y = round(((ext_st.latitude - 12.9716) * 100) + 5.0, 2)
                grid_x = max(1.0, min(9.5, grid_x))
                grid_y = max(1.0, min(9.5, grid_y))

                station = StationModel(
                    id=st_id,
                    name=ext_st.stationName,
                    location={"x": grid_x, "y": grid_y},
                    numberOfChargers=len(station_chargers),
                    chargingPower=ext_st.chargingPowerKW,
                    energyPrice=0.25,
                    operatingStatus=StationOperatingStatus.OPERATIONAL,
                    chargers=station_chargers,
                    dataSource="OPEN_CHARGE_MAP",
                    availabilityMode="EXTERNAL_METADATA",
                    operatorName=ext_st.operator,
                    address=ext_st.address,
                    latitude=ext_st.latitude,
                    longitude=ext_st.longitude
                )
                self.stations[st_id] = station
        except Exception:
            pass

        # 4. Seed EVs
        self.evs = {}
        initial_evs = [
            EVModel(
                id="EV-101",
                batteryCapacity=60.0,
                currentBatteryLevel=9.0,      # 15%
                requiredBatteryLevel=48.0,   # 80%
                chargingRate=100.0,
                arrivalTime=0,
                departureDeadline=90,
                currentLocation={"x": 4.0, "y": 4.5},
                destination={"x": 5.0, "y": 5.0},
                priority=EVPriority.STANDARD
            ),
            EVModel(
                id="EV-102",
                batteryCapacity=40.0,
                currentBatteryLevel=4.0,      # 10%
                requiredBatteryLevel=36.0,   # 90%
                chargingRate=50.0,
                arrivalTime=0,
                departureDeadline=60,
                currentLocation={"x": 7.5, "y": 2.0},
                destination={"x": 8.0, "y": 1.5},
                priority=EVPriority.HIGH
            ),
            EVModel(
                id="EV-EMERGENCY-01",
                batteryCapacity=90.0,
                currentBatteryLevel=7.2,      # 8%
                requiredBatteryLevel=85.5,   # 95%
                chargingRate=150.0,
                arrivalTime=0,
                departureDeadline=30,
                currentLocation={"x": 2.0, "y": 7.5},
                destination={"x": 2.5, "y": 8.0},
                priority=EVPriority.EMERGENCY
            ),
            EVModel(
                id="EV-104",
                batteryCapacity=77.0,
                currentBatteryLevel=19.25,   # 25%
                requiredBatteryLevel=61.6,   # 80%
                chargingRate=150.0,
                arrivalTime=0,
                departureDeadline=120,
                currentLocation={"x": 5.5, "y": 5.5},
                destination={"x": 5.0, "y": 5.0},
                priority=EVPriority.STANDARD
            )
        ]
        for ev in initial_evs:
            self.evs[ev.id] = ev

        self.peas_metrics = PEASMetrics()

        # 5. REGISTER CLASSICAL AI INTELLIGENT AGENTS
        # Coordinator Agent
        coordinator = CoordinatorAgent()
        agent_broker.register_agent(coordinator)

        # Grid Agent
        grid_agent = GridAgent(self.grid_node)
        agent_broker.register_agent(grid_agent)

        # Energy Agent
        energy_agent = EnergyAgent(list(self.energy_resources.values()))
        agent_broker.register_agent(energy_agent)

        # Single Master Station Agent managing all stations in the network
        master_station_agent = ChargingStationAgent(self.stations)
        agent_broker.register_agent(master_station_agent)

        # EV Agents
        for ev in self.evs.values():
            ev_agent = EVAgent(ev)
            agent_broker.register_agent(ev_agent)

    def add_or_update_ev(self, ev: EVModel):
        self.evs[ev.id] = ev
        # Create and register corresponding EV Agent
        ev_agent = EVAgent(ev)
        agent_broker.register_agent(ev_agent)

    def update_solar_generation(self):
        time_of_day = self.current_tick_min % 1440
        solar = self.energy_resources.get("RES-SOLAR-01")
        if solar:
            if 360 <= time_of_day <= 1080:  # 6 AM to 6 PM
                radians = ((time_of_day - 360) / 720.0) * math.pi
                solar.availablePower = round(120.0 * math.sin(radians), 1)
                solar.availabilityStatus = EnergyAvailabilityStatus.AVAILABLE
            else:
                solar.availablePower = 0.0
                solar.availabilityStatus = EnergyAvailabilityStatus.UNAVAILABLE

    def step(self, num_ticks: int = 1) -> Dict:
        for _ in range(num_ticks):
            self.current_tick_min += 1
            self.update_solar_generation()
            
            # 1. Handle faulty stations
            for station in self.stations.values():
                if station.operatingStatus == StationOperatingStatus.FAULT:
                    for charger in station.chargers:
                        if charger.assignedEV:
                            ev = self.evs.get(charger.assignedEV)
                            if ev:
                                ev.status = EVStatus.QUEUED
                                ev.assignedStationId = None
                                ev.assignedChargerId = None
                            charger.assignedEV = None
                            charger.currentStatus = ChargerStatus.FAULT
                        charger.activePower = 0.0

            # 2. Update active charging sessions & EV battery levels
            for ev in list(self.evs.values()):
                if ev.status == EVStatus.CHARGING:
                    station = self.stations.get(ev.assignedStationId)
                    charger = self.chargers.get(ev.assignedChargerId) if ev.assignedChargerId else None
                    
                    if station and charger:
                        kwh_gained = (charger.activePower / 60.0)  # 1 min tick
                        ev.currentBatteryLevel = min(ev.batteryCapacity, ev.currentBatteryLevel + kwh_gained)
                        
                        session_id = f"SESS-{ev.id}"
                        if session_id not in self.sessions:
                            self.sessions[session_id] = ChargingSessionModel(
                                id=session_id,
                                evId=ev.id,
                                stationId=station.id,
                                chargerId=charger.id,
                                startTime=self.current_tick_min,
                                energyAllocated=0.0,
                                sessionStatus=SessionStatus.ACTIVE
                            )
                        
                        session = self.sessions[session_id]
                        session.energyAllocated += kwh_gained
                        ev.totalCostUSD += (kwh_gained * station.energyPrice)
                        self.peas_metrics.total_energy_delivered_kwh += kwh_gained
                        
                        # Completion check
                        if ev.currentBatteryLevel >= ev.requiredBatteryLevel:
                            ev.status = EVStatus.COMPLETED
                            session.sessionStatus = SessionStatus.COMPLETED
                            session.endTime = self.current_tick_min
                            charger.assignedEV = None
                            charger.activePower = 0.0
                            charger.currentStatus = ChargerStatus.AVAILABLE
                            ev.assignedStationId = None
                            ev.assignedChargerId = None
                            self.peas_metrics.completed_evs += 1
                            if ev.priority == EVPriority.EMERGENCY:
                                self.peas_metrics.emergency_evs_serviced += 1

                elif ev.status == EVStatus.QUEUED:
                    ev.waitTimeMin += 1
                    if self.current_tick_min > ev.departureDeadline:
                        ev.status = EVStatus.TIMED_OUT
                        self.peas_metrics.timed_out_evs += 1

            # 3. CLASSICAL AGENT DECISION CYCLE & MESSAGE BROKER EXCHANGES
            env_state = self.get_full_state()
            
            # Step A: Perceive
            for agent in agent_broker.agents.values():
                agent.perceive(env_state, self.current_tick_min)

            # Step B: Agent Decide & Send Messages
            outbound_queue = []
            for agent in list(agent_broker.agents.values()):
                msgs = agent.decide(self.current_tick_min)
                outbound_queue.extend(msgs)

            # Step C: Deliver Messages via Broker
            for msg in outbound_queue:
                agent_broker.send_message(msg)

            # Step D: Second pass for Coordinator Agent to process responses
            coordinator = agent_broker.get_agent("AGENT-COORDINATOR")
            if coordinator:
                coordinator.decide(self.current_tick_min)

            # 4. Strategy Allocation (Baseline FCFS)
            self._apply_strategy()

            # 5. Calculate total load & update grid node
            total_active_load = sum(c.activePower for c in self.chargers.values() if c.currentStatus == ChargerStatus.OCCUPIED)
            self.grid_node.currentLoad = round(total_active_load, 1)
            self.grid_node.update_status()

            if self.grid_node.status == GridStatus.CRITICAL_OVERLOAD:
                self.peas_metrics.grid_overload_incidents += 1

            if self.grid_node.currentLoad > self.peas_metrics.peak_grid_load_kw:
                self.peas_metrics.peak_grid_load_kw = self.grid_node.currentLoad

        return self.get_full_state()

    def set_strategy(self, strategy_name: str):
        self.strategy_name = strategy_name
        self._apply_strategy()

    def _apply_strategy(self):
        queued_evs = [ev for ev in self.evs.values() if ev.status == EVStatus.QUEUED]
        if not queued_evs:
            return

        priority_weights = {
            EVPriority.EMERGENCY: 0,
            EVPriority.HIGH: 1,
            EVPriority.STANDARD: 2
        }

        if self.strategy_name == "PRIORITY_DRIVEN":
            # Sort strictly by priority, then by remaining time to departure deadline
            queued_evs.sort(key=lambda ev: (
                priority_weights.get(ev.priority, 2),
                ev.departureDeadline - self.current_tick_min,
                ev.arrivalTime
            ))
            # Emergency EVs can preempt standard EVs if no charger available
            emergency_evs = [e for e in queued_evs if e.priority == EVPriority.EMERGENCY]
            if emergency_evs:
                available_chargers = sum(
                    1 for st in self.stations.values() if st.operatingStatus == StationOperatingStatus.OPERATIONAL
                    for c in st.chargers if c.currentStatus == ChargerStatus.AVAILABLE
                )
                if available_chargers == 0:
                    for st in self.stations.values():
                        if st.operatingStatus == StationOperatingStatus.OPERATIONAL:
                            for c in st.chargers:
                                if c.assignedEV:
                                    curr_ev = self.evs.get(c.assignedEV)
                                    if curr_ev and curr_ev.priority == EVPriority.STANDARD:
                                        curr_ev.status = EVStatus.QUEUED
                                        curr_ev.assignedStationId = None
                                        curr_ev.assignedChargerId = None
                                        c.assignedEV = None
                                        c.currentStatus = ChargerStatus.AVAILABLE
                                        c.activePower = 0.0
                                        break

        elif self.strategy_name == "PEAK_SHAVING":
            queued_evs.sort(key=lambda ev: (priority_weights.get(ev.priority, 2), ev.arrivalTime))

        elif self.strategy_name == "SMART_AGENT":
            def urgency_score(ev):
                time_left = max(1, ev.departureDeadline - self.current_tick_min)
                need = ev.chargingRequired
                p_bonus = 1000 if ev.priority == EVPriority.EMERGENCY else (500 if ev.priority == EVPriority.HIGH else 0)
                return -(p_bonus + (need / time_left * 100))

            queued_evs.sort(key=urgency_score)

        else: # FCFS_BASELINE
            queued_evs.sort(key=lambda ev: (priority_weights.get(ev.priority, 2), ev.arrivalTime))

        # Assign to available chargers
        current_grid_load = sum(c.activePower for c in self.chargers.values() if c.currentStatus == ChargerStatus.OCCUPIED)

        for ev in queued_evs:
            assigned = False
            for station in self.stations.values():
                if station.operatingStatus == StationOperatingStatus.OPERATIONAL:
                    sorted_chargers = sorted(
                        station.chargers,
                        key=lambda c: c.maximumPower,
                        reverse=(ev.priority in [EVPriority.EMERGENCY, EVPriority.HIGH])
                    )
                    for charger in sorted_chargers:
                        if charger.currentStatus == ChargerStatus.AVAILABLE:
                            power_wanted = min(ev.chargingRate, charger.maximumPower)
                            
                            # Peak shaving power moderation
                            if self.strategy_name == "PEAK_SHAVING":
                                if current_grid_load + power_wanted > 300.0 and ev.priority == EVPriority.STANDARD:
                                    power_wanted = max(30.0, min(50.0, 300.0 - current_grid_load))
                            
                            charger.assignedEV = ev.id
                            charger.currentStatus = ChargerStatus.OCCUPIED
                            charger.activePower = power_wanted
                            current_grid_load += power_wanted
                            
                            ev.status = EVStatus.CHARGING
                            ev.assignedStationId = station.id
                            ev.assignedChargerId = charger.id
                            assigned = True
                            break
                if assigned:
                    break

    def get_full_state(self) -> Dict:
        return {
            "current_tick_min": self.current_tick_min,
            "is_running": self.is_running,
            "strategy_name": self.strategy_name,
            "grid_node": self.grid_node.model_dump(),
            "energy_resources": [r.model_dump() for r in self.energy_resources.values()],
            "stations": [s.model_dump() for s in self.stations.values()],
            "chargers": [c.model_dump() for c in self.chargers.values()],
            "evs": [ev.model_dump() for ev in self.evs.values()],
            "sessions": [sess.model_dump() for sess in self.sessions.values()],
            "agents": [a.get_info() for a in agent_broker.agents.values()],
            "peas_spec": get_default_peas_spec().model_dump(),
            "peas_metrics": self.peas_metrics.model_dump()
        }


# Global simulation instance
sim_engine = SimulationEngine()
