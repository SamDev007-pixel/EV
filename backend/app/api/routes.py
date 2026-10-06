from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
import uuid
import time

from app.simulation.engine import sim_engine
from app.models.ev import EVModel, EVPriority, EVStatus
from app.models.station import StationOperatingStatus

router = APIRouter(prefix="/api")


class TickRequest(BaseModel):
    ticks: int = 1


class ResetRequest(BaseModel):
    seed: int = 42


class StrategyRequest(BaseModel):
    strategy: str = "FCFS_BASELINE"


class StationFaultRequest(BaseModel):
    station_id: str
    is_faulty: bool = True


# --- SYSTEM HEALTH & STATUS ---

@router.get("/health")
def api_health():
    """System health check endpoint for monitoring and frontend availability checks."""
    return {
        "status": "healthy",
        "system": "Intelligent EV Charging & Resource Management System",
        "ai_foundation": "Classical Artificial Intelligence (Units I-V)",
        "simulation_time": sim_engine.current_tick_min,
        "stations_loaded": len(sim_engine.stations),
        "active_evs": len(sim_engine.evs)
    }


# --- FULL SIMULATION STATE ---

@router.get("/state")
def get_state():
    """
    Full environment snapshot.

    DATA HONESTY: station metadata is a static snapshot of public station information that
    ships with the repository; occupancy, faults, battery levels and grid load are produced
    by the deterministic software simulation. No live external API is contacted anywhere in
    this system.
    """
    state = sim_engine.get_full_state()
    state["data_sources"] = {
        "station_metadata": {
            "type": "STATIC_PUBLIC_DATASET_SNAPSHOT",
            "provides": "station location, operator, port count, published tariff",
            "live_lookup": False,
        },
        "simulation_engine": {
            "status": "ACTIVE",
            "type": "SIMULATED_DATA",
            "provides": "occupancy, charger state, faults, queue, battery levels, grid load",
            "mode": "Classical AI decision engine (no machine learning)",
        },
        "user_input": {
            "type": "USER_INPUT",
            "provides": "the requesting EV's battery level, deadline, priority and connector",
        },
    }
    return state


# --- EV ENDPOINTS ---

@router.get("/evs")
def list_evs(status: Optional[EVStatus] = Query(None)):
    ev_list = list(sim_engine.evs.values())
    if status:
        ev_list = [ev for ev in ev_list if ev.status == status]
    return [ev.model_dump() for ev in ev_list]


@router.get("/evs/{ev_id}")
def get_ev(ev_id: str):
    if ev_id not in sim_engine.evs:
        raise HTTPException(status_code=404, detail="EV not found")
    return sim_engine.evs[ev_id].model_dump()


@router.post("/evs", status_code=201)
def create_ev(ev: EVModel):
    sim_engine.add_or_update_ev(ev)
    return ev.model_dump()


@router.put("/evs/{ev_id}")
def update_ev(ev_id: str, ev: EVModel):
    if ev_id != ev.id:
        raise HTTPException(status_code=400, detail="EV ID in path does not match payload ID")
    sim_engine.add_or_update_ev(ev)
    return ev.model_dump()


# --- STATIONS & CHARGERS ENDPOINTS ---

@router.get("/stations")
def list_stations():
    return [st.model_dump() for st in sim_engine.stations.values()]


@router.get("/stations/{station_id}")
def get_station(station_id: str):
    if station_id not in sim_engine.stations:
        raise HTTPException(status_code=404, detail="Station not found")
    return sim_engine.stations[station_id].model_dump()


@router.get("/chargers")
def list_chargers(station_id: Optional[str] = Query(None)):
    chargers = list(sim_engine.chargers.values())
    if station_id:
        chargers = [c for c in chargers if c.stationId == station_id]
    return [c.model_dump() for c in chargers]


# --- GRID & ENERGY RESOURCES ENDPOINTS ---

@router.get("/grid")
def view_grid_status():
    return sim_engine.grid_node.model_dump()


@router.get("/resources")
def list_energy_resources():
    return [r.model_dump() for r in sim_engine.energy_resources.values()]


# --- AGENT ARCHITECTURE ENDPOINTS ---

@router.get("/agents")
def list_agents():
    from app.agents.message_broker import agent_broker
    return [agent.get_info() for agent in agent_broker.agents.values()]


@router.get("/agents/logs")
def list_agent_logs(limit: int = Query(100, ge=1, le=500)):
    from app.agents.message_broker import agent_broker
    return agent_broker.get_all_logs(limit)


@router.get("/agents/station-master/details")
def get_master_station_agent_details(station_id: Optional[str] = Query(None)):
    from app.agents.message_broker import agent_broker
    master_agent = agent_broker.get_agent("AGENT-STATION-MASTER")
    if not master_agent or not hasattr(master_agent, "get_station_details"):
        raise HTTPException(status_code=404, detail="Master Station Agent not active")
    return master_agent.get_station_details(station_id)
 

class AgentDecisionRequest(BaseModel):
    agent_id: Optional[str] = "AGENT-COORDINATOR"
    tick: Optional[int] = 1
    ev_id: Optional[str] = "EV-101"
    ev_kwh_needed: Optional[float] = 35.0
    ev_priority: Optional[str] = "STANDARD"
    deadline_min: Optional[int] = 120


@router.post("/agents/decision")
def run_agent_decision(req: AgentDecisionRequest):
    from app.agents.message_broker import agent_broker
    from app.agents.base_agent import AgentMessage, Performative, AgentRole

    agent_id = req.agent_id or "AGENT-COORDINATOR"
    agent = agent_broker.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found in active broker")

    # If EV request info supplied, post request message into broker for agent to perceive
    if req.ev_id:
        req_msg = AgentMessage(
            sender_id=f"EV-{req.ev_id}",
            sender_role=AgentRole.EV_AGENT,
            recipient_id=agent_id,
            performative=Performative.REQUEST,
            content={
                "ev_id": req.ev_id,
                "energy_needed_kwh": req.ev_kwh_needed,
                "priority": req.ev_priority,
                "deadline_min": req.deadline_min
            },
            timestamp=req.tick or 1
        )
        agent.receive_message(req_msg)

    # Deliberate
    outbound_msgs = agent.decide(req.tick or 1)
    for msg in outbound_msgs:
        agent_broker.send_message(msg)

    recent_logs = agent_broker.get_all_logs(limit=10)
    filtered_logs = [log for log in recent_logs if log.get("agent_id") == agent_id]

    return {
        "input": req.model_dump(),
        "algorithm": "Multi-Agent Perception & Deliberation (FIPA-ACL Message Passing)",
        "result": {
            "agent_id": agent.identity,
            "role": agent.role.value,
            "messages_dispatched": [m.model_dump() for m in outbound_msgs],
            "recent_decisions": filtered_logs[:3]
        },
        "metrics": {
            "inbox_count": len(agent.inbox),
            "outbound_count": len(outbound_msgs),
            "registered_agents_in_broker": len(agent_broker.agents)
        },
        "explanation": f"Agent {agent.identity} ({agent.role.value}) deliberated over inbox messages at tick {req.tick}, generating {len(outbound_msgs)} coordinated action messages across the multi-agent network."
    }


# --- KNOWLEDGE BASE & LOGICAL REASONING ENDPOINTS ---

@router.get("/kb/facts")
def list_kb_facts(subject: Optional[str] = Query(None)):
    from app.knowledge.kb import knowledge_base
    knowledge_base.sync_from_simulation(sim_engine)
    facts = knowledge_base.fact_base.list_facts(subject)
    return [f.model_dump() for f in facts]


@router.get("/kb/rules")
def list_kb_rules():
    from app.knowledge.kb import knowledge_base
    return [r.model_dump() for r in knowledge_base.rules]


@router.post("/kb/forward_chain")
def run_forward_chain():
    from app.knowledge.kb import knowledge_base
    res = knowledge_base.run_forward_chaining(sim_engine)
    return res.model_dump()


class PriorityQueryRequest(BaseModel):
    ev_id: str


class SafeChargingQueryRequest(BaseModel):
    ev_id: str
    station_id: str


@router.post("/kb/query/priority")
def query_priority(req: PriorityQueryRequest):
    from app.knowledge.kb import knowledge_base
    res = knowledge_base.query_why_priority(req.ev_id, sim_engine)
    return res.model_dump()


@router.post("/kb/query/safe_charging")
def query_safe_charging(req: SafeChargingQueryRequest):
    from app.knowledge.kb import knowledge_base
    res = knowledge_base.query_can_charge_safely(req.ev_id, req.station_id, sim_engine)
    return res.model_dump()


class LogicForwardChainRequest(BaseModel):
    subjects: Optional[List[str]] = None
    sync_simulation: bool = True


class LogicBackwardChainRequest(BaseModel):
    target_subject: str = "EV-101"
    target_predicate: str = "charging_priority"
    target_value: Any = "CRITICAL"
    sync_simulation: bool = True


class DPLLVerifyRequest(BaseModel):
    clauses: Optional[List[List[str]]] = None
    station_id: Optional[str] = "CS-METRO"


@router.post("/logic/forward-chain")
def run_logic_forward_chain(req: LogicForwardChainRequest):
    from app.knowledge.kb import knowledge_base
    from app.knowledge.inference_engine import InferenceEngine
    if req.sync_simulation:
        knowledge_base.sync_from_simulation(sim_engine)
    
    subjects = req.subjects or (list(sim_engine.evs.keys()) + list(sim_engine.stations.keys()) + ["GRID-TRANSFORMER-MAIN"])
    res = InferenceEngine.forward_chain(knowledge_base.fact_base, knowledge_base.rules, subjects)
    
    return {
        "input": req.model_dump(),
        "algorithm": "Forward Chaining (Data-Driven Logical Inference)",
        "result": {
            "derived_facts": [f.model_dump() if hasattr(f, 'model_dump') else f for f in res.derived_facts],
            "rules_applied": res.rules_applied
        },
        "metrics": {
            "facts_derived_count": len(res.derived_facts),
            "rules_applied_count": len(res.rules_applied),
            "inference_steps_count": len(res.explanation_trace)
        },
        "explanation": f"Forward chaining evaluated rule antecedents until fixpoint. Inferred {len(res.derived_facts)} new facts and fired {len(res.rules_applied)} production rules.",
        "explanation_trace": [t.model_dump() for t in res.explanation_trace]
    }


@router.post("/logic/backward-chain")
def run_logic_backward_chain(req: LogicBackwardChainRequest):
    from app.knowledge.kb import knowledge_base
    from app.knowledge.inference_engine import InferenceEngine
    if req.sync_simulation:
        knowledge_base.sync_from_simulation(sim_engine)
    
    res = InferenceEngine.backward_chain(
        knowledge_base.fact_base,
        knowledge_base.rules,
        req.target_subject,
        req.target_predicate,
        req.target_value
    )

    return {
        "input": req.model_dump(),
        "algorithm": "Backward Chaining (Goal-Driven Logical Inference)",
        "result": {
            "query": f"{req.target_subject}.{req.target_predicate} == {req.target_value}",
            "proved": bool(res.result),
            "rules_applied": res.rules_applied
        },
        "metrics": {
            "is_proved": bool(res.result),
            "rules_evaluated_count": len(res.rules_applied),
            "steps_count": len(res.explanation_trace)
        },
        "explanation": f"Goal [{req.target_subject}.{req.target_predicate} == {req.target_value}] was {'PROVED' if res.result else 'DISPROVED'} using backward goal decomposition.",
        "explanation_trace": [t.model_dump() for t in res.explanation_trace]
    }


@router.post("/logic/dpll/solve")
@router.post("/logic/dpll-verify")
def run_dpll_verification(req: DPLLVerifyRequest):
    from app.knowledge.propositional_dpll import PropositionalDPLL
    clauses = req.clauses or [
        ["StationOperational"],
        ["ChargerAvailable"],
        ["GridLoadUnderLimit"],
        ["-StationOperational", "-ChargerAvailable", "-GridLoadUnderLimit", "SafeToCharge"]
    ]
    res = PropositionalDPLL.solve(clauses)
    return {
        "input": req.model_dump(),
        "algorithm": "DPLL Propositional SAT Solver (Unit Propagation & Pure Symbol Elimination)",
        "result": res.model_dump(),
        "metrics": {
            "is_satisfiable": res.is_satisfiable,
            "decisions_count": res.decisions_count,
            "unit_propagations_count": res.unit_propagations_count,
            "pure_symbol_eliminations_count": res.pure_symbol_eliminations_count,
            "backtracks_count": res.backtracks_count,
            "execution_time_ms": res.execution_time_ms
        },
        "explanation": res.explanation
    }


class ResolutionProveRequest(BaseModel):
    theorem_preset: str = "EMERGENCY_PREEMPTION"
    custom_kb_clauses: Optional[List[List[str]]] = None
    custom_query: Optional[str] = None


@router.post("/logic/resolution-prove", operation_id="resolution_prove")
@router.post("/logic/resolution/prove", operation_id="resolution_prove_alias", include_in_schema=False)
def run_resolution_prove(req: ResolutionProveRequest):
    from app.knowledge.resolution import PropositionalResolutionProver
    if req.theorem_preset == "CONNECTOR_SAFETY":
        result = PropositionalResolutionProver.verify_connector_safety_theorem()
    elif req.theorem_preset == "CUSTOM" and req.custom_kb_clauses and req.custom_query:
        kb = [frozenset(c) for c in req.custom_kb_clauses]
        result = PropositionalResolutionProver.prove(kb, req.custom_query)
    else:
        result = PropositionalResolutionProver.verify_emergency_preemption_theorem()

    return {
        "input": req.model_dump(),
        "algorithm": "Propositional Resolution Refutation Theorem Prover (FOAI Unit IV)",
        "result": result.model_dump(),
        "metrics": {
            "proved": result.proved,
            "empty_clause_derived": result.empty_clause_derived,
            "proof_steps_count": len(result.proof_steps),
            "total_clauses_generated": result.total_clauses_generated
        },
        "explanation": result.explanation
    }


# --- SESSIONS ENDPOINTS ---

@router.get("/sessions")
def list_sessions():
    return [sess.model_dump() for sess in sim_engine.sessions.values()]


# --- SIMULATION CONTROL ENDPOINTS ---

@router.post("/tick")
def step_simulation(req: TickRequest):
    if req.ticks <= 0 or req.ticks > 1000:
        raise HTTPException(status_code=400, detail="Ticks must be between 1 and 1000")
    return sim_engine.step(req.ticks)


@router.post("/reset")
def reset_simulation(req: ResetRequest):
    sim_engine.reset_environment(req.seed)
    return sim_engine.get_full_state()


@router.post("/strategy")
def set_simulation_strategy(req: StrategyRequest):
    sim_engine.set_strategy(req.strategy)
    return sim_engine.get_full_state()


@router.post("/ev/add")
def add_custom_ev(ev: EVModel):
    sim_engine.add_or_update_ev(ev)
    sim_engine._apply_strategy()
    return sim_engine.get_full_state()


@router.post("/ev/emergency")
def inject_emergency_ev():
    ev_id = f"EV-EMERGENCY-{uuid.uuid4().hex[:4].upper()}"
    ev = EVModel(
        id=ev_id,
        batteryCapacity=100.0,
        currentBatteryLevel=5.0,
        requiredBatteryLevel=95.0,
        chargingRate=150.0,
        arrivalTime=sim_engine.current_tick_min,
        departureDeadline=sim_engine.current_tick_min + 30,
        priority=EVPriority.EMERGENCY,
        currentLocation={"x": 5.0, "y": 5.0},
        destination={"x": 2.5, "y": 8.0}
    )
    sim_engine.add_or_update_ev(ev)
    return sim_engine.get_full_state()


@router.post("/station/fault")
def toggle_station_fault(req: StationFaultRequest):
    if req.station_id not in sim_engine.stations:
        raise HTTPException(status_code=404, detail="Station not found")
    
    station = sim_engine.stations[req.station_id]
    if req.is_faulty:
        station.operatingStatus = StationOperatingStatus.FAULT
    else:
        station.operatingStatus = StationOperatingStatus.OPERATIONAL

    return sim_engine.get_full_state()


# --- PHASE 4: CLASSICAL AI SEARCH & ROUTE SELECTION ENDPOINTS ---

from app.search.station_selector import StationSelectorEngine, EVScenario
from app.search.graph import ChargingNetworkGraph

search_engine = StationSelectorEngine()


@router.get("/search/network")
def get_search_network():
    current_stations = [s.model_dump() for s in sim_engine.stations.values()]
    graph = ChargingNetworkGraph.create_default_network(stations=current_stations)
    return graph.to_dict()


# NOTE: /search/compare-algorithms and /search/recommend-station used to be defined here as
# separate handlers. Because those paths were also registered further down (as aliases of the
# canonical /search/compare and /search/solve handlers), the routes defined *first* silently
# shadowed the canonical ones and the two "equivalent" paths returned different response
# shapes. The duplicated handlers were removed; the alias decorators below are now the single
# implementation for both paths.


class SearchSolveRequest(BaseModel):
    ev_id: str = "EV-SEARCH-01"
    battery_percentage: float = 20.0
    battery_capacity_kwh: float = 60.0
    target_battery_percentage: float = 80.0
    departure_deadline_min: float = 90.0
    current_location: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    destination_location: Dict[str, float] = Field(default_factory=lambda: {"x": 10.0, "y": 10.0})
    charger_type_needed: str = "DC_FAST"
    algorithm: str = "A*"  # "BFS", "DFS", "UCS", "GBFS", "A*"
    heuristic: str = "domain"  # "domain" or "euclidean"


class SearchCompareRequest(BaseModel):
    ev_id: str = "EV-SEARCH-01"
    battery_percentage: float = 20.0
    battery_capacity_kwh: float = 60.0
    target_battery_percentage: float = 80.0
    departure_deadline_min: float = 90.0
    current_location: Dict[str, float] = Field(default_factory=lambda: {"x": 0.0, "y": 0.0})
    destination_location: Dict[str, float] = Field(default_factory=lambda: {"x": 10.0, "y": 10.0})
    charger_type_needed: str = "DC_FAST"


class ProblemFormulationAPIRequest(BaseModel):
    ev_id: str = "EV-USER-01"
    origin_node_id: Optional[str] = "WAYPOINT-NORTH"
    destination_node_id: Optional[str] = "CS-METRO"
    destination_area_name: Optional[str] = "Whitefield Tech Hub"
    current_location: Optional[Dict[str, float]] = None
    destination_location: Optional[Dict[str, float]] = None
    battery_capacity_kwh: float = 60.0
    current_battery_kwh: Optional[float] = None
    current_charge_pct: Optional[float] = 18.0
    required_battery_kwh: Optional[float] = None
    required_charge_pct: Optional[float] = 80.0
    departure_deadline_min: int = 90
    arrival_time_min: int = 0
    priority: str = "STANDARD"
    is_emergency: bool = False
    connector_requirement: str = "CCS2"
    selected_search_algorithm: str = "A*"


@router.post("/problem/formulate")
def formulate_problem_endpoint(req: ProblemFormulationAPIRequest):
    """
    Unit I: Formal Problem Formulation API
    Translates vehicle telematics into the formal AI 6-tuple: <S, s0, A, G, C, c>
    """
    from app.problem.formulation import ProblemFormulator, ProblemFormulationRequest
    cap = req.battery_capacity_kwh or 60.0
    curr_kwh = req.current_battery_kwh if req.current_battery_kwh is not None else ((req.current_charge_pct or 18.0) / 100.0) * cap
    req_kwh = req.required_battery_kwh if req.required_battery_kwh is not None else ((req.required_charge_pct or 80.0) / 100.0) * cap
    
    pf_req = ProblemFormulationRequest(
        ev_id=req.ev_id,
        origin_node_id=req.origin_node_id or "WAYPOINT-NORTH",
        destination_node_id=req.destination_node_id or "CS-METRO",
        battery_capacity_kwh=cap,
        current_battery_kwh=curr_kwh,
        required_battery_kwh=req_kwh,
        arrival_time_min=req.arrival_time_min,
        departure_deadline_min=int(req.departure_deadline_min),
        priority=req.priority,
        is_emergency=(req.priority.upper() == "EMERGENCY" or req.is_emergency)
    )
    
    formulation = ProblemFormulator.explain_formulation(pf_req)
    return {
        "input": req.model_dump(),
        "algorithm": "Russell & Norvig Formal Problem Formulation <S, s0, A, G, C, c>",
        "formulation": formulation.model_dump(),
        "tuple": {
            "initial_state_s0": formulation.initial_state,
            "goal_test_G": formulation.goal_test,
            "action_space_A": formulation.actions_available,
            "transition_model": formulation.transition_model,
            "step_cost_function_c": formulation.step_cost_function,
            "admissible_heuristic_h": formulation.admissible_heuristic,
            "csp_variables": formulation.csp_variables,
            "hard_constraints_count": formulation.hard_constraints_count,
            "knowledge_base_facts": formulation.knowledge_base_facts_asserted
        },
        "explanation": f"Converted telematics for {req.ev_id} into formal state-space search and constraint satisfaction definitions."
    }


@router.post("/search/solve")
@router.post("/search/recommend-station")
def solve_search_path(req: SearchSolveRequest):
    scenario = EVScenario(
        ev_id=req.ev_id,
        battery_percentage=req.battery_percentage,
        battery_capacity_kwh=req.battery_capacity_kwh,
        target_battery_percentage=req.target_battery_percentage,
        departure_deadline_min=req.departure_deadline_min,
        current_location=req.current_location,
        destination_location=req.destination_location,
        charger_type_needed=req.charger_type_needed
    )
    engine = StationSelectorEngine()
    current_stations = [st.model_dump() for st in sim_engine.stations.values()]
    comparison = engine.run_algorithm_comparison(scenario, stations_override=current_stations)
    matrix = comparison.get("comparison_matrix", [])
    
    algo_name = req.algorithm.upper()
    matching_result = next((m for m in matrix if algo_name in m["algorithm"].upper()), matrix[-1] if matrix else {})

    return {
        "input": req.model_dump(),
        "station_source": comparison.get("station_source", "STATIC_DEFAULT_NETWORK"),
        "algorithm": matching_result.get("algorithm", req.algorithm),
        "result": matching_result,
        "metrics": {
            "nodes_explored": matching_result.get("nodes_explored", 0),
            "execution_time_ms": matching_result.get("execution_time_ms", 0.0),
            "path_cost": matching_result.get("path_cost", 0.0),
            "success": matching_result.get("success", False),
            "total_duration_min": matching_result.get("total_duration_min", 0.0),
            "total_charging_cost_usd": matching_result.get("total_charging_cost_usd", 0.0)
        },
        "explanation": f"Executed {matching_result.get('algorithm', req.algorithm)} search. Explored {matching_result.get('nodes_explored')} nodes to find optimal charging route reaching station {matching_result.get('selected_station')}."
    }


@router.post("/search/compare")
@router.post("/search/compare-algorithms")
def compare_all_search(req: SearchCompareRequest):
    scenario = EVScenario(
        ev_id=req.ev_id,
        battery_percentage=req.battery_percentage,
        battery_capacity_kwh=req.battery_capacity_kwh,
        target_battery_percentage=req.target_battery_percentage,
        departure_deadline_min=req.departure_deadline_min,
        current_location=req.current_location,
        destination_location=req.destination_location,
        charger_type_needed=req.charger_type_needed
    )
    engine = StationSelectorEngine()
    current_stations = [st.model_dump() for st in sim_engine.stations.values()]
    comparison = engine.run_algorithm_comparison(scenario, stations_override=current_stations)
    matrix = comparison.get("comparison_matrix", [])

    # Measured facts about the run, so the UI never has to state a claim it cannot verify
    ucs_cost = next((m.get("path_cost") for m in matrix if m.get("algorithm") == "UCS" and m.get("success")), None)
    astar_cost = next((m.get("path_cost") for m in matrix if m.get("algorithm") == "A* Search" and m.get("success")), None)
    ucs_nodes = next((m.get("nodes_explored") for m in matrix if m.get("algorithm") == "UCS"), None)
    astar_nodes = next((m.get("nodes_explored") for m in matrix if m.get("algorithm") == "A* Search"), None)

    optimal = None
    if ucs_cost is not None and astar_cost is not None:
        optimal = abs(ucs_cost - astar_cost) <= 1e-6

    return {
        "input": req.model_dump(),
        "station_source": comparison.get("station_source", "STATIC_DEFAULT_NETWORK"),
        "algorithm": "Comparative Classical Search (BFS, DFS, UCS, GBFS, A*)",
        "result": matrix,
        "comparison_matrix": matrix,
        "metrics": {
            "algorithms_evaluated": len(matrix),
            "optimal_path_cost": min((m.get("path_cost", float('inf')) for m in matrix if m.get("success")), default=0.0),
            "astar_matches_ucs_optimum": optimal,
            "ucs_nodes_explored": ucs_nodes,
            "astar_nodes_explored": astar_nodes,
            "astar_node_saving_pct": (
                round((1 - astar_nodes / ucs_nodes) * 100.0, 1)
                if ucs_nodes and astar_nodes and ucs_nodes > 0 else None
            ),
        },
        "explanation": (
            "All five classical search algorithms were executed on the same live graph state. "
            + (
                f"A* returned the same optimal path cost as UCS ({astar_cost:.2f}) while expanding "
                f"{astar_nodes} nodes versus {ucs_nodes} for UCS. Greedy best-first expands the fewest nodes "
                "because it uses h(n) only, which is why it can return a more expensive path. DFS returns a "
                "goal path but gives no optimality guarantee."
                if optimal else
                "A* and UCS did not return the same cost on this instance, which would indicate a non-admissible "
                "heuristic - inspect the comparison matrix."
            )
        )
    }


class AndOrSearchRequest(BaseModel):
    initial_state: str = "LOW_BATTERY_ORIGIN"


@router.post("/search/and-or-plan")
def run_and_or_search_plan(req: AndOrSearchRequest):
    from app.search.and_or_search import AndOrSearchEngine, NondeterministicEVProblem
    problem = NondeterministicEVProblem(initial_state=req.initial_state)
    engine = AndOrSearchEngine()
    res = engine.search(problem)
    return {
        "input": req.model_dump(),
        "algorithm": "AND-OR Graph Search for Nondeterministic Contingency Planning (FOAI Unit II)",
        "result": res.model_dump(),
        "metrics": {
            "success": res.success,
            "nodes_expanded": res.nodes_expanded,
            "contingency_branches": res.contingency_branches
        },
        "explanation": f"AND-OR Graph Search generated a complete conditional contingency plan spanning {res.contingency_branches} branching contingencies.",
        "readable_plan": res.readable_plan
    }


class BeliefSearchRequest(BaseModel):
    with_observation: bool = True


@router.post("/search/belief-state")
def run_belief_state_search(req: BeliefSearchRequest):
    from app.search.belief_search import BeliefStateSearchEngine, PartiallyObservableEVProblem
    prob = PartiallyObservableEVProblem()
    res = BeliefStateSearchEngine.solve_conformant_or_conditional(prob)
    return {
        "input": req.model_dump(),
        "algorithm": "Belief-State Search in Partially Observable Environments (FOAI Unit II)",
        "result": res.model_dump(),
        "metrics": {
            "initial_belief_size": res.initial_belief_size,
            "goal_reached": res.goal_reached,
            "plan_length": len(res.plan_actions),
            "nodes_explored": res.nodes_explored
        },
        "explanation": res.explanation
    }


class LRTASearchRequest(BaseModel):
    start_node: str = "J_NORTH"
    goal_node: str = "STATION_DC_FAST"
    max_steps: int = 25


@router.post("/search/lrta-step")
def run_lrta_online_search(req: LRTASearchRequest):
    from app.search.online_search import LRTAStarAgent, OnlineRoadNetwork
    agent = LRTAStarAgent()
    res = agent.run_online_search(start_node=req.start_node, goal_node=req.goal_node, max_steps=req.max_steps)
    return {
        "input": req.model_dump(),
        "algorithm": "Learning Real-Time A* (LRTA*) Online Search Agent (FOAI Unit II)",
        "result": res.model_dump(),
        "metrics": {
            "goal_reached": res.goal_reached,
            "total_travel_cost": res.total_travel_cost,
            "total_steps": res.total_steps,
            "heuristic_updates_count": res.heuristic_updates_count
        },
        "explanation": res.explanation
    }


# --- PHASE 5: CONSTRAINT SATISFACTION BASED CHARGING SCHEDULER ENDPOINTS ---

class CSPSolveRequest(BaseModel):
    scenario_name: str = "NORMAL_DEMAND"
    enable_forward_checking: bool = True
    enable_ac3: bool = True
    enable_mrv: bool = True
    enable_lcv: bool = True


@router.get("/csp/scenarios")
def list_csp_scenarios():
    return [
        {"id": "NORMAL_DEMAND", "name": "Normal Demand (Feasible Schedule)", "description": "Balanced grid and stations with available chargers and time windows."},
        {"id": "CHARGER_SHORTAGE", "name": "Charger Shortage", "description": "Multiple EVs competing for limited physical chargers; tests time-staggering."},
        {"id": "GRID_CAPACITY_SHORTAGE", "name": "Grid Capacity Shortage", "description": "Transformer capacity restricted to 100 kW; tests power allocation ceiling."},
        {"id": "DEADLINE_CONFLICTS", "name": "Deadline Conflicts", "description": "Tight departure deadlines arriving simultaneously."},
        {"id": "TIGHT_WINDOW_BACKTRACKING", "name": "Tight Window (Backtracking Demonstration)",
         "description": "One shared 50 kW charger and three staggered deadlines: naive depth-first assignment dead-ends and backtracks, while MRV + LCV + forward checking reach the solution without backtracking."},
        {"id": "PROPAGATION_INFEASIBLE", "name": "Propagation Proves Infeasible (AC-3)",
         "description": "Four sessions need 150 charger-minutes inside a 120 minute window. AC-3 arc consistency empties a domain and proves unsatisfiability before the search starts."},
        {"id": "NO_FEASIBLE_SOLUTION", "name": "No Feasible Solution (Unfeasible)", "description": "Station outage and impossible deadlines triggering constraint violation diagnosis."}
    ]


@router.post("/csp/solve")
def solve_csp_schedule(req: CSPSolveRequest):
    from app.csp.scenarios import get_preset_csp_scenario
    from app.csp.solver import CSPSolver

    problem = get_preset_csp_scenario(req.scenario_name)
    solver = CSPSolver()
    result = solver.solve(
        problem=problem,
        enable_forward_checking=req.enable_forward_checking,
        enable_ac3=req.enable_ac3,
        enable_mrv=req.enable_mrv,
        enable_lcv=req.enable_lcv
    )
    return {
        "input": req.model_dump(),
        "algorithm": "CSP Backtracking with AC-3 Arc Consistency, MRV, LCV, and Forward Checking",
        "result": result.model_dump(),
        "metrics": {
            # Values below are read from the solver's own instrumentation for this run.
            "success": result.success,
            "backtracks": result.backtracks,
            "constraint_checks": result.constraint_checks,
            "execution_time_ms": result.execution_time_ms,
            "assigned_variables": len(result.assignment.assignments) if result.assignment else 0,
            "variables_count": len(problem.variables),
            "domain_values_generated": result.stats.domain_values_generated,
            "solutions_found_count": result.stats.solutions_found_count,
            "max_search_depth": result.stats.max_search_depth,
            "ac3_revisions": result.stats.ac3_revisions,
            "ac3_values_examined": result.stats.ac3_values_examined,
            "ac3_values_pruned": result.stats.ac3_values_pruned,
            "forward_check_prunes": result.stats.forward_check_prunes,
            "forward_check_wipeouts": result.stats.forward_check_wipeouts,
            "value_choices_rejected": result.stats.value_choices_rejected,
            "techniques_enabled": {
                "mrv": result.stats.mrv_heuristic_enabled,
                "lcv": result.stats.lcv_enabled,
                "forward_checking": result.stats.forward_checking_enabled,
                "ac3": result.stats.ac3_enabled,
            },
            "utility_score": result.utility_score.total_score if result.utility_score else None,
        },
        "explanation": f"CSP Backtracking search completed with {result.backtracks} backtracks and {result.constraint_checks} constraint checks. {'All 8 hard constraints satisfied.' if result.success else 'No feasible assignment satisfying all hard constraints.'}",
        "problem_state": problem.model_dump(),
        "solution": result.model_dump()
    }


# --- PHASE 6: MULTI-AGENT CONFLICT RESOLUTION ENDPOINTS ---

class NegotiationResolveRequest(BaseModel):
    scenario_id: str = "SCENARIO_IMMEDIATE_VS_OVERLOAD"


class GameDecisionRequest(BaseModel):
    game_type: str = "COOPERATIVE_NASH"  # "COOPERATIVE_NASH" or "ADVERSARIAL_MINIMAX"
    scenario_id: str = "SCENARIO_IMMEDIATE_VS_OVERLOAD"
    grid_load_kw: float = 200.0
    transformer_limit_kw: float = 300.0
    ev_deadline_min: float = 60.0
    depth: int = 4


@router.get("/negotiation/scenarios")
def list_negotiation_scenarios():
    return [
        {
            "id": "SCENARIO_IMMEDIATE_VS_OVERLOAD",
            "name": "Immediate Charging vs Grid Transformer Overload (Benchmark Example)",
            "description": "EV demands immediate 150 kW fast charging, but Grid transformer capacity limit (300 kW) is threatened by current 200 kW load."
        },
        {
            "id": "SCENARIO_RENEWABLE_VS_WAIT",
            "name": "Renewable Solar Optimization vs EV Wait Time",
            "description": "Energy Agent advocates 45 min delay to utilize zero-carbon Solar generation, conflicting with EV desire for immediate departure."
        },
        {
            "id": "SCENARIO_STATION_QUEUE_VS_TRAVEL",
            "name": "Station Queue Clearance vs Extra Travel Distance",
            "description": "Station A has an 8-car queue causing 40 min wait delay; Station B has 0 queue but requires 4 km additional travel."
        }
    ]


@router.post("/negotiation/resolve")
def resolve_multi_agent_conflict(req: NegotiationResolveRequest):
    from app.game_theory.scenarios import get_preset_game_theory_scenario
    from app.game_theory.negotiation import NegotiationEngine

    sc_data = get_preset_game_theory_scenario(req.scenario_id)
    engine = NegotiationEngine()
    result = engine.resolve_conflict(
        scenario_name=sc_data["scenario_id"],
        custom_alternatives=sc_data["custom_alternatives"],
        grid_load_kw=sc_data["grid_load_kw"],
        transformer_limit_kw=sc_data["transformer_limit_kw"],
        ev_deadline_min=sc_data["ev_deadline_min"]
    )
    return result.model_dump()


@router.post("/game/decision")
def run_game_decision(req: GameDecisionRequest):
    if req.game_type.upper() == "ADVERSARIAL_MINIMAX":
        from app.game_theory.adversarial import AdversarialBargainingGame, GameState
        init_state = GameState(
            grid_reserve_kw=max(0.0, req.transformer_limit_kw - req.grid_load_kw),
            ev_urgency_score=round(max(1.0, 100.0 - req.ev_deadline_min), 1),
            current_tariff_usd=0.25,
            is_ev_turn=True,
            depth=0
        )
        game_res = AdversarialBargainingGame.solve_with_alpha_beta(init_state, max_depth=req.depth)
        return {
            "input": req.model_dump(),
            "algorithm": "Adversarial Minimax with Alpha-Beta Pruning",
            "result": game_res.model_dump(),
            "metrics": {
                "minimax_value": game_res.minimax_value,
                "nodes_evaluated": game_res.nodes_evaluated,
                "alpha_cutoffs": game_res.alpha_cutoffs,
                "beta_cutoffs": game_res.beta_cutoffs,
                "execution_time_ms": game_res.execution_time_ms
            },
            "explanation": f"Minimax game tree explored {game_res.nodes_evaluated} nodes to depth {req.depth} with {game_res.alpha_cutoffs} alpha cutoffs and {game_res.beta_cutoffs} beta cutoffs. Best action: {game_res.best_action.action_type if game_res.best_action else 'NONE'}."
        }
    else:
        from app.game_theory.scenarios import get_preset_game_theory_scenario
        from app.game_theory.negotiation import NegotiationEngine
        sc_data = get_preset_game_theory_scenario(req.scenario_id)
        engine = NegotiationEngine()
        result = engine.resolve_conflict(
            scenario_name=sc_data["scenario_id"],
            custom_alternatives=sc_data["custom_alternatives"],
            grid_load_kw=req.grid_load_kw,
            transformer_limit_kw=req.transformer_limit_kw,
            ev_deadline_min=req.ev_deadline_min
        )
        return {
            "input": req.model_dump(),
            "algorithm": "Cooperative Game Theory: Nash Bargaining Product & Pareto Dominance",
            "result": result.model_dump(),
            "metrics": {
                "alternatives_count": len(result.alternatives_evaluated),
                "pareto_efficient_count": sum(1 for a in result.alternatives_evaluated if a.is_pareto_efficient),
                "best_nash_product": result.selected_alternative.nash_product if result.selected_alternative else 0.0
            },
            "explanation": f"Evaluated {len(result.alternatives_evaluated)} alternatives. Selected [{result.selected_alternative.alternative_id if result.selected_alternative else 'NONE'}] which maximizes the Nash Bargaining Product subject to Pareto efficiency."
        }


class SlotCompetitionRequest(BaseModel):
    max_rounds: int = 2


@router.post("/game/slot-competition")
def run_slot_competition_game(req: SlotCompetitionRequest):
    from app.game_theory.slot_competition import SlotCompetitionGame, SlotGameState
    game = SlotCompetitionGame(max_rounds=req.max_rounds)
    result = game.solve(SlotGameState(max_rounds=req.max_rounds))
    return {
        "input": req.model_dump(),
        "algorithm": "Two-Agent EV Resource Competition with Minimax & Alpha-Beta Pruning (FOAI Unit III)",
        "result": result.model_dump(),
        "metrics": {
            "minimax_utility": result.minimax_utility,
            "nodes_evaluated": result.nodes_evaluated,
            "alpha_cutoffs": result.alpha_cutoffs,
            "beta_cutoffs": result.beta_cutoffs,
            "execution_time_ms": result.execution_time_ms
        },
        "explanation": result.explanation
    }


# --- PHASE 7: DYNAMIC EV ECOSYSTEM SCENARIOS ENDPOINTS ---

class RunScenarioRequest(BaseModel):
    scenario_id: str = "SCENARIO_1_PEAK_SPIKE"
    seed: int = 42


@router.get("/scenarios/list")
def list_dynamic_scenarios():
    return [
        {
            "id": "SCENARIO_1_PEAK_SPIKE",
            "name": "Scenario 1 — Peak Demand Spike",
            "description": "Sudden arrival influx of 15 EVs simultaneously. Tests demand detection, CSP schedule regeneration, and grid overload prevention."
        },
        {
            "id": "SCENARIO_2_STATION_FAILURE",
            "name": "Scenario 2 — Charging Station Failure",
            "description": "Station CS-METRO shifts to FAULT status. Tests affected EV identification, A* search rerouting, and schedule regeneration."
        },
        {
            "id": "SCENARIO_3_GRID_OVERLOAD",
            "name": "Scenario 3 — Grid Overload Mitigation",
            "description": "Grid transformer limit restricted to 250 kW. Tests throttling non-critical sessions while preserving emergency EV priorities."
        },
        {
            "id": "SCENARIO_4_EMERGENCY_EV",
            "name": "Scenario 4 — Emergency EV Preemption",
            "description": "Emergency EV arrives with 5% battery and 30 min deadline. Tests Knowledge Base rule preemption and charging resource reallocation."
        },
        {
            "id": "SCENARIO_5_RENEWABLE_AVAILABILITY",
            "name": "Scenario 5 — Renewable Energy Optimization",
            "description": "Solar power generation surges to 120 kW. Tests renewable power preference and cost optimization."
        }
    ]


@router.post("/scenarios/run")
def run_dynamic_scenario(req: RunScenarioRequest):
    from app.scenarios.scenario_engine import DynamicScenarioEngine

    engine = DynamicScenarioEngine()
    result = engine.run_scenario(req.scenario_id, seed=req.seed)
    return result.model_dump()


# --- PHASE 8: FINAL SYSTEM EVALUATION & BENCHMARK ENDPOINT ---

@router.get("/evaluation/benchmark")
def get_evaluation_benchmark(seed: int = 42):
    from app.evaluation.benchmark import BenchmarkEvaluator

    evaluator = BenchmarkEvaluator()
    result = evaluator.run_comparative_benchmark(seed=seed)
    return result.model_dump()


# --- PEAS AGENT-ENVIRONMENT SPECIFICATION (FOAI UNIT I) ---

@router.get("/peas")
def get_peas_specification():
    """
    Unit I: PEAS description of the charging-coordinator agent.

    Returns the formal Performance / Environment / Actuators / Sensors specification
    together with the metrics that the running environment actually measures
    (taken from the live simulation, not from constants).
    """
    from app.core.peas import get_default_peas_spec
    spec = get_default_peas_spec()
    return {
        "specification": spec.model_dump(),
        "measured_metrics": sim_engine.peas_metrics.model_dump(),
        "environment_classification": {
            "observability": "PARTIALLY_OBSERVABLE (future arrivals and station faults are unknown to the agent when it plans)",
            "determinism": (
                "DETERMINISTIC for a fixed random seed (the whole simulation is seeded and reproducible), "
                "but treated as NONDETERMINISTIC by the agent because future arrivals, faults and demand "
                "spikes are not known in advance"
            ),
            "episodicity": "SEQUENTIAL (each scheduling decision changes the state later decisions see)",
            "dynamism": "DYNAMIC (the environment keeps changing while the agent deliberates)",
            "agents": "MULTI_AGENT (EV agents, station agent, grid agent, energy agent, coordinator)",
            "continuity": "DISCRETE (integer-minute ticks, discrete 15-minute charging slots)",
            "reproducibility": "The same seed always reproduces the same run (tested in tests/test_evaluation.py)",
        },
        "data_provenance": {
            "station_metadata": "STATIC PUBLIC DATASET SNAPSHOT (location, operator, ports, published tariff; bundled with the repository, no live API call)",
            "occupancy_and_faults": "SIMULATED DATA (deterministic software simulation)",
            "user_inputs": "USER INPUT (EV request form)",
            "decisions": "CLASSICAL AI COMPUTATION (search, CSP, logic programming, game theory)",
        },
    }


# --- EXPLAINABLE AI / DECISION EXPLANATION ENDPOINTS ---

@router.get("/explanation/{decision_id}")
def get_explanation_by_id(decision_id: str):
    from app.explanation.service import explanation_registry
    record = explanation_registry.get(decision_id)
    if not record:
        recent = [r.decision_id for r in explanation_registry.list_recent(limit=5)]
        raise HTTPException(
            status_code=404,
            detail=f"Explanation for decision_id '{decision_id}' not found. Recent IDs: {recent}"
        )
    return record.model_dump()


@router.get("/explanation")
def list_recent_explanations(limit: int = Query(20, ge=1, le=100)):
    from app.explanation.service import explanation_registry
    records = explanation_registry.list_recent(limit=limit)
    return [r.model_dump() for r in records]


# --- MASTER UNIFIED AI DECISION PIPELINE ENDPOINTS ---

from app.core.pipeline import UnifiedAIDecisionPipeline, DecisionPipelineRequest


@router.post("/pipeline/decide")
def run_unified_pipeline_decision(req: DecisionPipelineRequest):
    current_stations = [s.model_dump() for s in sim_engine.stations.values()]
    result = UnifiedAIDecisionPipeline.execute(req, stations_override=current_stations)
    return result.model_dump()


# --- PRIMARY 8-STEP APPLICATION WORKFLOW ENDPOINTS ---

from app.core.workflow import PrimaryWorkflowEngine, EVWorkflowRequest


@router.post("/workflow/execute")
def execute_primary_workflow(req: EVWorkflowRequest):
    """
    Executes the 8-Step Primary Application Workflow:
    STEP 1: EV Request
    STEP 2: Problem Formulation
    STEP 3: Knowledge Reasoning
    STEP 4: Search (BFS, DFS, UCS, GBFS, A*)
    STEP 5: CSP Scheduling (Backtracking, MRV, LCV, AC-3)
    STEP 6: Conflict Resolution (Game Theory / Nash Bargaining)
    STEP 7: Final Decision (Recommended Station, Route, Slot, Math Utility Score)
    STEP 8: Explanation ("Why was this station selected?" drill-down)
    """
    current_stations = [s.model_dump() for s in sim_engine.stations.values()]
    result = PrimaryWorkflowEngine.execute(req, stations_override=current_stations)
    return result.model_dump()


@router.post("/workflow/why-selected")
def get_workflow_explanation_drilldown(req: EVWorkflowRequest):
    """
    Returns the interactive Step 8 explanation drill-down:
    Facts -> Rules -> Search Result -> Constraints -> Final Decision.
    """
    current_stations = [s.model_dump() for s in sim_engine.stations.values()]
    result = PrimaryWorkflowEngine.execute(req, stations_override=current_stations)
    return result.step8_explanation.model_dump()


# --- LOCAL SEARCH & SCHEDULE OPTIMIZATION ENDPOINTS ---

class LocalSearchRequest(BaseModel):
    algorithm: str = "SIMULATED_ANNEALING"  # "SIMULATED_ANNEALING" or "HILL_CLIMBING"
    initial_schedule: Optional[List[float]] = None
    peak_limit_kw: float = 300.0
    iterations: int = 1000
    initial_temp: float = 100.0
    cooling_rate: float = 0.95


@router.post("/optimization/schedule")
def optimize_load_schedule(req: LocalSearchRequest):
    from app.optimization.local_search import LocalSearchOptimizer
    
    if req.initial_schedule:
        schedule = req.initial_schedule
    else:
        # Default 24-hr schedule with a peak
        schedule = [120.0, 100.0, 90.0, 85.0, 95.0, 140.0, 260.0, 340.0, 390.0, 380.0, 310.0, 270.0,
                    250.0, 240.0, 260.0, 290.0, 360.0, 420.0, 440.0, 380.0, 310.0, 240.0, 180.0, 140.0]
    
    if req.algorithm.upper() == "HILL_CLIMBING":
        res = LocalSearchOptimizer.hill_climbing_schedule(
            initial_schedule=schedule,
            peak_limit=req.peak_limit_kw,
            max_iterations=req.iterations
        )
    else:
        res = LocalSearchOptimizer.simulated_annealing_schedule(
            initial_schedule=schedule,
            peak_limit=req.peak_limit_kw,
            initial_temp=req.initial_temp,
            cooling_rate=req.cooling_rate,
            max_iterations=req.iterations
        )

    return {
        "input": req.model_dump(),
        "algorithm": res.algorithm,
        "result": res.model_dump(),
        "metrics": {
            "initial_cost": res.initial_cost,
            "final_cost": res.final_cost,
            "improvement_percentage": res.improvement_percentage,
            "iterations": res.iterations,
            "execution_time_ms": res.execution_time_ms
        },
        "explanation": res.explanation
    }






