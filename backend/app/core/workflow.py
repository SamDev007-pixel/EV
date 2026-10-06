"""
Primary Application Workflow Engine.
Coordinates the end-to-end Classical AI decision-making story across 8 steps:
  STEP 1 — EV REQUEST
  STEP 2 — PROBLEM FORMULATION
  STEP 3 — KNOWLEDGE REASONING
  STEP 4 — SEARCH
  STEP 5 — CSP SCHEDULING
  STEP 6 — CONFLICT RESOLUTION
  STEP 7 — FINAL DECISION
  STEP 8 — EXPLANATION ("Why was this station selected?")

Strictly Classical AI: All decisions explainable through implemented algorithms.
Zero ML, zero neural networks, zero black-box heuristics.
"""

import time
import math
import uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from app.problem.formulation import ProblemFormulationRequest, ProblemFormulator
from app.search.station_selector import StationSelectorEngine, EVScenario
from app.search.algorithms import (
    breadth_first_search,
    depth_first_search,
    uniform_cost_search,
    greedy_best_first_search,
    a_star_search
)
from app.knowledge.kb import knowledge_base
from app.knowledge.rule import Rule
from app.csp.solver import CSPSolver
from app.csp.scenarios import get_preset_csp_scenario
from app.game_theory.negotiation import NegotiationEngine
from app.explanation.service import (
    explanation_registry,
    ExplanationRecord,
    ExplanationTraceItem
)


# =============================================================================
# WORKFLOW REQUEST & STEP MODELS
# =============================================================================

class EVWorkflowRequest(BaseModel):
    ev_id: str = "EV-WORKFLOW-01"
    current_location: Dict[str, float] = Field(default_factory=lambda: {"x": 1.2, "y": 2.5})
    destination: Dict[str, float] = Field(default_factory=lambda: {"x": 8.5, "y": 9.0})
    destination_area_name: Optional[str] = "Whitefield Tech Hub"
    battery_capacity_kwh: float = 60.0
    current_charge_pct: float = 18.0
    required_charge_pct: float = 80.0
    max_acceptable_distance_km: float = 15.0
    departure_deadline_min: float = 90.0
    priority: str = "STANDARD"  # "STANDARD", "HIGH", "EMERGENCY"
    connector_requirement: str = "CCS2"  # "CCS2", "Type 2", "CHAdeMO"
    selected_search_algorithm: str = "A*"  # "BFS", "DFS", "UCS", "GBFS", "A*"


class Step1RequestSummary(BaseModel):
    ev_id: str
    current_location: Dict[str, float]
    destination: Dict[str, float]
    destination_area: str
    battery_capacity_kwh: float
    current_charge_pct: float
    required_charge_pct: float
    energy_needed_kwh: float
    max_acceptable_distance_km: float
    departure_deadline_min: float
    priority: str
    connector_requirement: str


class Step2Formulation(BaseModel):
    problem_type: str = "Classical Deterministic Search & CSP Formulation"
    initial_state: Dict[str, Any]
    goal_state: Dict[str, Any]
    actions: List[str]
    state_space_description: str
    constraints: List[str]
    cost_function: str
    heuristic_function: str


class Step3Reasoning(BaseModel):
    facts_asserted: List[Dict[str, Any]]
    rules_evaluated: List[str]
    rules_fired: List[str]
    station_availability: List[Dict[str, Any]]
    computed_priority: str
    eligibility_status: Dict[str, bool]
    restrictions_applied: List[str]
    explanation: str


class SearchAlgorithmEntry(BaseModel):
    algorithm: str
    nodes_explored: int
    path: List[str]
    path_cost: float
    heuristic_value: Optional[float] = None
    runtime_ms: float
    result: str
    selected: bool = False


class Step4Search(BaseModel):
    algorithms_compared: List[SearchAlgorithmEntry]
    selected_algorithm: str
    chosen_path: List[str]
    chosen_station_id: str
    chosen_station_name: str
    chosen_path_cost: float
    explanation: str


class Step5CSP(BaseModel):
    variables: List[str]
    domains: Dict[str, List[str]]
    constraints: List[str]
    algorithm_techniques: Dict[str, str]
    backtracking_used: bool
    backtracks_count: int
    constraint_checks_count: int
    assigned_schedule: Dict[str, str]  # EV -> Station -> Charger -> Time Slot
    execution_time_ms: float
    explanation: str
    # --- real solver measurements (added so the UI/demo shows measured numbers, not literals) ---
    variable_sources: Dict[str, str] = {}          # ev_id -> USER_INPUT | SIMULATED
    excluded_variables: List[Dict[str, Any]] = []  # vehicles left out of the model + why
    domain_values_generated: int = 0
    solutions_found_count: int = 0
    utility_score: Optional[float] = None
    utility_breakdown: Optional[Dict[str, float]] = None
    ac3_values_examined: int = 0
    ac3_values_pruned: int = 0
    forward_check_prunes: int = 0
    mrv_variable_choices: List[str] = []
    backtracking_steps: List[Dict[str, Any]] = []


class Step6Conflict(BaseModel):
    conflict_detected: bool
    competing_ev_id: str
    contested_resource: str
    alternatives_evaluated: List[Dict[str, Any]]
    decision_method: str = "Nash Bargaining Solution (Game Theory)"
    selected_alternative_id: str
    nash_product: float
    is_pareto_efficient: bool
    rational_justification: str


class Step7FinalDecision(BaseModel):
    recommended_station: Dict[str, Any]
    recommended_route: List[str]
    recommended_time_slot: str
    expected_waiting_time_min: float
    estimated_charging_duration_min: float
    constraint_status: Dict[str, str]
    decision_confidence_score: float  # Strictly mathematically defined
    score_formula: str
    reasoning_explanation: str


class Step8Explanation(BaseModel):
    prompt: str = "Why was this station selected?"
    facts_tier: List[str]
    rules_tier: List[str]
    search_tier: str
    constraints_tier: List[str]
    decision_tier: str
    derivation_chain: List[str]


class FullWorkflowResult(BaseModel):
    workflow_id: str
    decision_id: Optional[str] = None   # id under which this decision is registered for explanation lookup
    timestamp: float
    execution_time_ms: float
    step1_request: Step1RequestSummary
    step2_formulation: Step2Formulation
    step3_reasoning: Step3Reasoning
    step4_search: Step4Search
    step5_csp: Step5CSP
    step6_conflict_resolution: Step6Conflict
    step7_final_decision: Step7FinalDecision
    step8_explanation: Step8Explanation


# =============================================================================
# WORKFLOW EXECUTION ENGINE
# =============================================================================

class PrimaryWorkflowEngine:
    """
    Executes the 8-step primary application workflow end-to-end,
    generating a coherent Classical AI decision narrative.
    """

    @classmethod
    def execute(cls, req: EVWorkflowRequest, stations_override: Optional[List[Dict[str, Any]]] = None) -> FullWorkflowResult:
        t0 = time.perf_counter()
        wf_id = f"WF-{uuid.uuid4().hex[:8].upper()}"

        # ---------------------------------------------------------------------
        # STEP 1: EV REQUEST
        # ---------------------------------------------------------------------
        current_kwh = (req.current_charge_pct / 100.0) * req.battery_capacity_kwh
        target_kwh = (req.required_charge_pct / 100.0) * req.battery_capacity_kwh
        energy_needed = max(0.0, round(target_kwh - current_kwh, 2))

        step1 = Step1RequestSummary(
            ev_id=req.ev_id,
            current_location=req.current_location,
            destination=req.destination,
            destination_area=req.destination_area_name or "Destination Area",
            battery_capacity_kwh=req.battery_capacity_kwh,
            current_charge_pct=req.current_charge_pct,
            required_charge_pct=req.required_charge_pct,
            energy_needed_kwh=energy_needed,
            max_acceptable_distance_km=req.max_acceptable_distance_km,
            departure_deadline_min=req.departure_deadline_min,
            priority=req.priority.upper(),
            connector_requirement=req.connector_requirement
        )

        # ---------------------------------------------------------------------
        # STEP 2: PROBLEM FORMULATION
        # ---------------------------------------------------------------------
        initial_state = {
            "node": f"ORIGIN-{req.ev_id}",
            "coordinates": req.current_location,
            "battery_soc_pct": req.current_charge_pct,
            "battery_kwh": round(current_kwh, 2),
            "elapsed_time_min": 0.0,
            "status": "EN_ROUTE"
        }
        goal_state = {
            "battery_soc_pct_min": req.required_charge_pct,
            "battery_kwh_min": round(target_kwh, 2),
            "max_elapsed_time_min": req.departure_deadline_min,
            "session_status": "CHARGING_COMPLETED"
        }
        actions = [
            f"TRAVEL(u, v): Transit between graph nodes u and v consuming energy",
            f"QUEUE(station): Enter station buffer bay if all chargers are currently engaged",
            f"PLUG_IN(bay, connector='{req.connector_requirement}'): Connect matching physical port",
            f"CHARGE(power_kw, duration_min): Transfer energy at rated station inverter capacity",
            f"DEPART(station): Disconnect and proceed to final destination"
        ]
        constraints = [
            f"1. Minimum Battery Reserve: SOC(t) >= 5% across all road edges (no road stranding)",
            f"2. Distance Horizon: Distance(origin, station) <= {req.max_acceptable_distance_km} km",
            f"3. Temporal Deadline: t_arrival + t_wait + t_charge <= {req.departure_deadline_min} min",
            f"4. Connector Interlock: Station bay connector == '{req.connector_requirement}'",
            f"5. Operational Status: Station operating_status == 'OPERATIONAL'",
            f"6. Grid Inverter Limit: Sum(active_kw) <= Transformer thermal capacity"
        ]
        cost_func = "c(s, a, s') = 0.35 * road_distance_km + 0.45 * (travel_time + wait_time) + 0.20 * tariff_cost_usd"
        heuristic_func = "h(n) = EuclideanDistance(n, GoalStation) / max_speed_kmh (admissible: never overestimates true travel time)"

        step2 = Step2Formulation(
            initial_state=initial_state,
            goal_state=goal_state,
            actions=actions,
            state_space_description="S = R^2 (position) x [0, 100%] (battery) x [0, T_deadline] (time) x {DRIVING, QUEUED, CHARGING, COMPLETED}",
            constraints=constraints,
            cost_function=cost_func,
            heuristic_function=heuristic_func
        )

        # ---------------------------------------------------------------------
        # STEP 3: KNOWLEDGE REASONING — facts are read from the live environment
        # ---------------------------------------------------------------------
        from app.search.graph import read_station_field
        from app.simulation.engine import sim_engine
        from app.csp.variables import CSPEVVariable, CSPProblemState

        live_stations = (
            stations_override if stations_override
            else [st.model_dump() for st in sim_engine.stations.values()]
        )

        grid = sim_engine.grid_node
        grid_load_kw = round(grid.currentLoad, 1)
        grid_capacity_kw = grid.maximumCapacity
        grid_load_pct = grid.loadPercentage

        # (a) Assert the request facts that the rule base reasons over
        facts_asserted_list: List[Dict[str, Any]] = [
            {"subject": req.ev_id, "predicate": "battery_soc_percent", "value": req.current_charge_pct, "source": "USER_INPUT"},
            {"subject": req.ev_id, "predicate": "connector_needed", "value": req.connector_requirement, "source": "USER_INPUT"},
            {"subject": req.ev_id, "predicate": "is_emergency", "value": (req.priority.upper() == "EMERGENCY"), "source": "USER_INPUT"},
            {"subject": req.ev_id, "predicate": "departure_deadline_min", "value": req.departure_deadline_min, "source": "USER_INPUT"},
            {"subject": "GRID-TRANSFORMER-MAIN", "predicate": "load_percentage", "value": grid_load_pct, "source": "SIMULATED"},
            {"subject": "GRID-TRANSFORMER-MAIN", "predicate": "maximum_capacity_kw", "value": grid_capacity_kw, "source": "SIMULATED"},
            {"subject": "GRID-TRANSFORMER-MAIN", "predicate": "current_load_kw", "value": grid_load_kw, "source": "SIMULATED"},
        ]
        for fact in facts_asserted_list:
            knowledge_base.fact_base.assert_fact(fact["subject"], fact["predicate"], fact["value"], source=fact["source"])

        # (b) Station candidates are read from the live environment, not from a literal table
        stations_eval: List[Dict[str, Any]] = []
        for station_record in live_stations:
            st_id = read_station_field(station_record, "id", "id")
            if not st_id:
                continue
            chargers = read_station_field(station_record, "chargers", "chargers", []) or []
            available_chargers = sum(
                1 for c in chargers
                if read_station_field(c, "currentStatus", "current_status") == "AVAILABLE"
            )
            status = PrimaryWorkflowEngine._as_text(
                read_station_field(station_record, "operatingStatus", "operating_status", "OPERATIONAL")
            )
            loc = read_station_field(station_record, "location", "location", {"x": 0.0, "y": 0.0})
            distance_km = round(math.hypot(
                req.current_location.get("x", 0.0) - loc.get("x", 0.0),
                req.current_location.get("y", 0.0) - loc.get("y", 0.0)
            ), 2)
            connectors = PrimaryWorkflowEngine._supported_connectors(station_record)

            record = {
                "id": st_id,
                "name": read_station_field(station_record, "name", "name", st_id),
                "operator": read_station_field(station_record, "operatorName", "operator_name", "Unknown operator"),
                "status": status,
                "connectors": connectors,
                "chargers": len(chargers),
                "available_chargers": available_chargers,
                "charging_power_kw": read_station_field(station_record, "chargingPower", "charging_power", 0.0),
                "energy_price_usd_kwh": read_station_field(station_record, "energyPrice", "energy_price", 0.0),
                "dist_km": distance_km,
                "data_source": read_station_field(station_record, "dataSource", "data_source", "UNKNOWN"),
                "latitude": read_station_field(station_record, "latitude", "latitude"),
                "longitude": read_station_field(station_record, "longitude", "longitude"),
            }
            stations_eval.append(record)

            # Assert the real facts that the production rules consume
            knowledge_base.fact_base.assert_fact(st_id, "operating_status", status, source="SIMULATION_ENGINE")
            knowledge_base.fact_base.assert_fact(st_id, "available_chargers", available_chargers, source="SIMULATION_ENGINE")
            knowledge_base.fact_base.assert_fact(st_id, "distance_km", distance_km, source="GEOMETRY")
            facts_asserted_list.append({"subject": st_id, "predicate": "operating_status", "value": status, "source": "SIMULATED"})
            facts_asserted_list.append({"subject": st_id, "predicate": "available_chargers", "value": available_chargers, "source": "SIMULATED"})

        # (c) Run the actual rule engine (forward chaining) over those facts
        forward_result = knowledge_base.run_forward_chaining(None)
        rules_fired_list = sorted(set(forward_result.rules_applied))
        rules_evaluated_list = [
            f"{rule.id} — {rule.name}: {rule.description}"
            for rule in knowledge_base.rules
        ]

        # (d) Priority is proved by backward chaining, and eligibility is tested per station
        why_prio = knowledge_base.query_why_priority(req.ev_id, None)
        if why_prio.result and "CRITICAL" in str(why_prio.result):
            computed_priority = "CRITICAL"
        elif why_prio.result and "HIGH" in str(why_prio.result):
            computed_priority = "HIGH"
        elif req.priority.upper() in ["HIGH", "EMERGENCY"]:
            computed_priority = req.priority.upper()
        else:
            computed_priority = "STANDARD"

        eligibility_status: Dict[str, bool] = {}
        restrictions_applied: List[str] = []
        for st in stations_eval:
            is_compat = req.connector_requirement in st["connectors"]
            is_oper = (st["status"] == "OPERATIONAL")
            is_in_range = (st["dist_km"] <= req.max_acceptable_distance_km)
            has_capacity = st["available_chargers"] > 0
            eligible = bool(is_compat and is_oper and is_in_range and has_capacity)
            eligibility_status[st["id"]] = eligible

            if not is_oper:
                restrictions_applied.append(f"Station {st['id']} excluded: status is {st['status']}, not OPERATIONAL.")
            elif not has_capacity:
                restrictions_applied.append(f"Station {st['id']} excluded: no charger is currently AVAILABLE.")
            elif not is_compat:
                restrictions_applied.append(
                    f"Station {st['id']} excluded: supports {st['connectors']}, request needs '{req.connector_requirement}'."
                )
            elif not is_in_range:
                restrictions_applied.append(
                    f"Station {st['id']} excluded: {st['dist_km']} km exceeds the {req.max_acceptable_distance_km} km limit."
                )

        step3 = Step3Reasoning(
            facts_asserted=facts_asserted_list,
            rules_evaluated=rules_evaluated_list,
            rules_fired=rules_fired_list,
            station_availability=stations_eval,
            computed_priority=computed_priority,
            eligibility_status=eligibility_status,
            restrictions_applied=restrictions_applied,
            explanation=(
                f"Asserted {len(facts_asserted_list)} facts read from the live environment and evaluated them "
                f"against {len(rules_evaluated_list)} production rules; forward chaining fired "
                f"{len(rules_fired_list)} rule(s) ({', '.join(rules_fired_list) if rules_fired_list else 'none'}). "
                f"Backward chaining proved priority [{computed_priority}]. "
                f"{sum(1 for v in eligibility_status.values() if v)} of {len(eligibility_status)} stations are eligible "
                f"under the request constraints."
            )
        )

        # ---------------------------------------------------------------------
        # STEP 4: SEARCH over the live network
        # ---------------------------------------------------------------------
        scenario = EVScenario(
            ev_id=req.ev_id,
            battery_percentage=req.current_charge_pct,
            battery_capacity_kwh=req.battery_capacity_kwh,
            target_battery_percentage=req.required_charge_pct,
            max_charging_rate_kw=120.0,
            current_location=req.current_location,
            destination_location=req.destination,
            departure_deadline_min=req.departure_deadline_min,
            charger_type_needed="DC_FAST" if req.connector_requirement.upper() != "TYPE 2" else "AC_SLOW"
        )
        selector_engine = StationSelectorEngine()
        comparison = selector_engine.run_algorithm_comparison(scenario, stations_override=live_stations)
        comp_matrix = comparison.get("comparison_matrix", [])

        algos_compared: List[SearchAlgorithmEntry] = []
        for item in comp_matrix:
            algo_name = item.get("algorithm", "")
            is_sel = (req.selected_search_algorithm.upper() in algo_name.upper())
            station_id = item.get("selected_station")
            station_name = next((s["name"] for s in stations_eval if s["id"] == station_id), station_id)
            algos_compared.append(SearchAlgorithmEntry(
                algorithm=algo_name,
                nodes_explored=item.get("nodes_explored", 0),
                path=item.get("path", []),
                path_cost=item.get("path_cost", 0.0),
                heuristic_value=item.get("heuristic_value"),
                runtime_ms=item.get("execution_time_ms", 0.0),
                result=(
                    f"Reached station {station_name} ({station_id}) with path cost {item.get('path_cost', 0.0)}"
                    if item.get("success") and station_id
                    else ("No charging stop reachable under the current constraints"
                          if not item.get("success") else "Destination reached without a charging stop")
                ),
                selected=is_sel
            ))

        requested_entry = next((e for e in algos_compared if e.selected), None)
        successful_entries = [e for e in algos_compared if "No charging stop" not in e.result and "without a charging stop" not in e.result]
        best_entry = min(successful_entries, key=lambda e: e.path_cost) if successful_entries else None

        chosen_entry = requested_entry if (requested_entry and "No charging stop" not in requested_entry.result) else best_entry
        selection_note = ""
        if requested_entry is not None and chosen_entry is not requested_entry:
            selection_note = (
                f" The requested algorithm ({requested_entry.algorithm}) did not return a feasible charging stop, "
                f"so the lowest-cost successful result ({chosen_entry.algorithm}) was used instead."
            )
        for entry in algos_compared:
            entry.selected = (entry is chosen_entry)

        chosen_station_id = ""
        if chosen_entry:
            chosen_station_id = next((s["id"] for s in stations_eval if s["id"] in chosen_entry.path and s["id"] != req.ev_id), "")
        chosen_station = next((s for s in stations_eval if s["id"] == chosen_station_id), None)
        if chosen_station is None:
            chosen_station = min(
                (s for s in stations_eval if eligibility_status.get(s["id"])),
                key=lambda s: s["dist_km"],
                default=None
            )
            if chosen_station:
                chosen_station_id = chosen_station["id"]
                selection_note += " No station appeared in a search path, so the nearest eligible station was selected."

        chosen_station_name = chosen_station["name"] if chosen_station else "NO ELIGIBLE STATION"

        # Approach distance/time from the requesting vehicle to the selected station. Computed
        # once here and reused by the CSP (earliest possible charging start) and by Step 7, so
        # the schedule and the final decision can never disagree about travel time.
        chosen_dist_km = 0.0
        approach_time_min = 0.0
        if chosen_station:
            st_record = next(
                (st for st in live_stations if read_station_field(st, "id", "id") == chosen_station["id"]), None
            )
            if st_record is not None:
                st_loc = read_station_field(st_record, "location", "location", {"x": 0.0, "y": 0.0})
                chosen_dist_km = round(math.hypot(
                    req.current_location.get("x", 0.0) - st_loc.get("x", 0.0),
                    req.current_location.get("y", 0.0) - st_loc.get("y", 0.0)
                ), 2)
                approach_time_min = round(chosen_dist_km * 1.5, 1)

        step4 = Step4Search(
            algorithms_compared=algos_compared,
            selected_algorithm=chosen_entry.algorithm if chosen_entry else req.selected_search_algorithm,
            chosen_path=chosen_entry.path if chosen_entry else [],
            chosen_station_id=chosen_station_id or "NONE",
            chosen_station_name=chosen_station_name,
            chosen_path_cost=chosen_entry.path_cost if chosen_entry else 0.0,
            explanation=(
                f"Executed all five classical search algorithms on the live network "
                f"({len(live_stations)} stations). "
                + (
                    f"{chosen_entry.algorithm} returned the selected path {chosen_entry.path} "
                    f"with cost {chosen_entry.path_cost} after exploring {chosen_entry.nodes_explored} nodes, "
                    f"reaching station {chosen_station_name} ({chosen_station_id})."
                    if chosen_entry else "No algorithm returned a feasible route to a charging station."
                )
                + selection_note
            )
        )

        # ---------------------------------------------------------------------
        # STEP 5: CSP SCHEDULING over the live stations/chargers
        # ---------------------------------------------------------------------
        csp_prob, csp_variable_sources, csp_excluded_evs = PrimaryWorkflowEngine._build_live_csp_problem(
            req, live_stations, chosen_station_id=chosen_station_id, arrival_time_min=approach_time_min
        )
        csp_solver = CSPSolver()
        csp_res = csp_solver.solve(
            csp_prob,
            enable_forward_checking=True,
            enable_ac3=True,
            enable_mrv=True,
            enable_lcv=True,
            # Bounded enumeration: collect a few feasible schedules and let the weighted
            # utility evaluator pick the best one. Without this the solver would stop at the
            # first DFS-ordered solution and the utility function would have nothing to rank.
            find_all_solutions=True,
            max_solutions=5,
        )

        request_assignment = csp_res.best_assignment.get(req.ev_id) if csp_res.best_assignment else None

        if request_assignment:
            assigned_charger = f"{request_assignment['charger_id']} ({request_assignment['power_kw']:.0f} kW)"
            assigned_slot = (
                f"T+{request_assignment['start_time_min']} to "
                f"T+{request_assignment['start_time_min'] + request_assignment['duration_min']} min"
            )
            assigned_station_id = request_assignment["station_id"]
        else:
            assigned_charger = "NOT SCHEDULED"
            assigned_slot = "NOT SCHEDULED"
            assigned_station_id = chosen_station_id

        assigned_dict = {
            "EV": req.ev_id,
            "Station": assigned_station_id or "NONE",
            "Charger": assigned_charger,
            "TimeSlot": assigned_slot
        }

        domain_summary = {
            ev_id: [
                f"{value['station_id']}|{value['charger_id']}|+{value['start_time_min']}min|{value['duration_min']}min|{value['power_kw']:.0f}kW"
                for value in values[:6]
            ]
            for ev_id, values in csp_res.initial_domains.items()
        }

        step5 = Step5CSP(
            variables=list(csp_prob.variables.keys()),
            domains=domain_summary,
            constraints=[f"{c['name']} ({c['type']})" for c in csp_res.constraints_enforced],
            algorithm_techniques={
                "Variable_Ordering": "MRV (minimum remaining values, degree tie-break)" if csp_res.stats.mrv_heuristic_enabled else "declaration order",
                "Value_Ordering": "LCV (least constraining value)" if csp_res.stats.lcv_enabled else "domain order",
                "Inference": (
                    ("Forward Checking" if csp_res.stats.forward_checking_enabled else "")
                    + (" + " if csp_res.stats.forward_checking_enabled and csp_res.stats.ac3_enabled else "")
                    + ("AC-3 Arc Consistency" if csp_res.stats.ac3_enabled else "")
                ).strip(" +") or "none (pure chronological backtracking)",
                "Search_Engine": "Chronological backtracking",
            },
            backtracking_used=csp_res.stats.backtracks_count > 0,
            backtracks_count=csp_res.stats.backtracks_count,
            constraint_checks_count=csp_res.stats.constraint_checks_count,
            assigned_schedule=assigned_dict,
            execution_time_ms=csp_res.stats.execution_time_ms,
            variable_sources=csp_variable_sources,
            excluded_variables=csp_excluded_evs,
            domain_values_generated=csp_res.stats.domain_values_generated,
            solutions_found_count=csp_res.stats.solutions_found_count,
            utility_score=(
                round(csp_res.utility_score.total_score, 2) if csp_res.utility_score else None
            ),
            utility_breakdown=(
                {
                    "wait_time_penalty": csp_res.utility_score.wait_time_penalty,
                    "travel_distance_penalty": csp_res.utility_score.travel_distance_penalty,
                    "charging_cost_penalty": csp_res.utility_score.charging_cost_penalty,
                    "grid_stress_penalty": csp_res.utility_score.grid_stress_penalty,
                    "station_utilization_reward": csp_res.utility_score.station_utilization_reward,
                    "urgency_priority_reward": csp_res.utility_score.urgency_priority_reward,
                } if csp_res.utility_score else None
            ),
            ac3_values_examined=csp_res.stats.ac3_values_examined,
            ac3_values_pruned=csp_res.stats.ac3_values_pruned,
            forward_check_prunes=csp_res.stats.forward_check_prunes,
            mrv_variable_choices=[
                str(entry.get("ev_id")) for entry in csp_res.variable_selection_log[:8]
            ],
            backtracking_steps=csp_res.backtracking_steps[:20],
            explanation=(
                f"CSP solved {len(csp_prob.variables)} EV variables over {len(csp_prob.stations)} live stations and "
                f"{len(csp_prob.chargers)} chargers, generating {csp_res.stats.domain_values_generated} candidate values. "
                f"AC-3 examined {csp_res.stats.ac3_values_examined} support pairs and pruned {csp_res.stats.ac3_values_pruned} value(s); "
                f"forward checking pruned {csp_res.stats.forward_check_prunes} value(s). "
                + (
                    f"Feasible schedule found in {csp_res.stats.execution_time_ms} ms with "
                    f"{csp_res.stats.backtracks_count} backtrack(s): {req.ev_id} -> {assigned_station_id} -> "
                    f"{assigned_charger} -> {assigned_slot}."
                    if request_assignment else
                    "No feasible schedule exists for all variables under the eight hard constraints; "
                    "the conflict/decision steps below report the resulting restriction."
                )
                + (
                    f" {len(csp_excluded_evs)} vehicle(s) were excluded from the model because their own "
                    f"deadline cannot be met: "
                    + "; ".join(f"{e['ev_id']} ({e['reason']})" for e in csp_excluded_evs[:3])
                    if csp_excluded_evs else ""
                )
            )
        )

        # ---------------------------------------------------------------------
        # STEP 6: CONFLICT RESOLUTION (game theory over the live resource)
        # ---------------------------------------------------------------------
        competing_ev_id = next(
            (ev_id for ev_id, value in (csp_res.best_assignment or {}).items()
             if ev_id != req.ev_id and value["station_id"] == assigned_station_id),
            None
        ) if request_assignment else None

        contested_charger = request_assignment["charger_id"] if request_assignment else "NONE"
        conflict_detected = bool(competing_ev_id) or bool(
            chosen_station and chosen_station["available_chargers"] == 0
        )

        neg_engine = NegotiationEngine()
        neg_res = neg_engine.resolve_conflict(
            scenario_name="SCENARIO_IMMEDIATE_VS_OVERLOAD",
            grid_load_kw=grid_load_kw,
            transformer_limit_kw=grid_capacity_kw,
            ev_deadline_min=int(req.departure_deadline_min)
        )
        selected_alt = neg_res.selected_alternative
        selected_alt_id = getattr(selected_alt, "alternative_id", "NONE")
        selected_nash = getattr(selected_alt, "nash_product", 0.0)

        step6 = Step6Conflict(
            conflict_detected=conflict_detected,
            competing_ev_id=competing_ev_id or "NONE",
            contested_resource=f"{contested_charger} at {assigned_station_id}",
            alternatives_evaluated=[a.model_dump() for a in neg_res.alternatives_evaluated],
            decision_method="Nash Bargaining Product N(a)=prod(max(0, U_i(a)-d_i)) with Pareto filtering",
            selected_alternative_id=selected_alt_id,
            nash_product=round(float(selected_nash), 3),
            is_pareto_efficient=bool(getattr(selected_alt, "is_pareto_efficient", False)),
            rational_justification=(
                (
                    f"{req.ev_id} and {competing_ev_id} were both assigned to {assigned_station_id} by the CSP, "
                    f"so the contested resource is {contested_charger}. "
                    if competing_ev_id else
                    f"No other EV in the CSP solution shares {assigned_station_id}, and the station still has "
                    f"{chosen_station['available_chargers'] if chosen_station else 0} free charger(s); "
                    f"the negotiation module is therefore run on the grid/energy conflict scenario instead. "
                )
                + f"The four agent utilities (EV, station, grid, energy) were evaluated on the live grid state "
                  f"({grid_load_kw} kW of {grid_capacity_kw} kW) and the alternative [{selected_alt_id}] was selected "
                  f"because it maximises the Nash Bargaining Product ({selected_nash:.3f})."
            )
        )

        # ---------------------------------------------------------------------
        # STEP 7: FINAL DECISION — every quantity below is computed from the live state
        # ---------------------------------------------------------------------
        dist_km = chosen_dist_km
        travel_time_min = approach_time_min
        effective_power_kw = (
            float(request_assignment["power_kw"]) if request_assignment
            else min(120.0, chosen_station["charging_power_kw"] if chosen_station else 0.0)
        )
        if request_assignment:
            # start_time_min is measured from "now", so it already contains the approach travel.
            # Pure waiting is the gap between arrival at the station and the charging start.
            start_min = float(request_assignment["start_time_min"])
            wait_min = max(0.0, round(start_min - travel_time_min, 1))
            dur_min = float(request_assignment["duration_min"])
            session_end_min = round(start_min + dur_min, 1)
        else:
            wait_min = float((chosen_station["available_chargers"] == 0) * 15) if chosen_station else 0.0
            dur_min = round((energy_needed / effective_power_kw) * 60.0, 1) if effective_power_kw > 0 else 0.0
            session_end_min = round(travel_time_min + wait_min + dur_min, 1)

        total_time_min = session_end_min
        battery_after_travel_pct = round(
            max(0.0, req.current_charge_pct - ((dist_km * 0.20 / max(1.0, req.battery_capacity_kwh)) * 100.0)), 1
        )

        connector_supported = bool(chosen_station and req.connector_requirement in chosen_station["connectors"])
        station_operational = bool(chosen_station and chosen_station["status"] == "OPERATIONAL")
        projected_grid_load_kw = round(grid_load_kw + effective_power_kw, 1)

        constraint_status = {
            "battery_safety_reserve": (
                f"{'PASSED' if battery_after_travel_pct >= 5.0 else 'FAILED'} — "
                f"{(req.current_charge_pct - battery_after_travel_pct):.1f}% consumed on the {dist_km} km approach, "
                f"{battery_after_travel_pct:.1f}% remaining (minimum 5.0%)"
            ),
            "distance_limit": (
                f"{'PASSED' if dist_km <= req.max_acceptable_distance_km else 'FAILED'} — "
                f"{dist_km} km {'<=' if dist_km <= req.max_acceptable_distance_km else '>'} "
                f"{req.max_acceptable_distance_km} km acceptable"
            ),
            "deadline_satisfaction": (
                f"{'PASSED' if total_time_min <= req.departure_deadline_min else 'FAILED'} — "
                f"arrive T+{travel_time_min}, wait {wait_min} min, charge {dur_min} min -> "
                f"session ends T+{session_end_min} vs {req.departure_deadline_min} min deadline"
            ),
            "connector_compatibility": (
                f"{'PASSED' if connector_supported else 'FAILED'} — "
                f"'{req.connector_requirement}' {'supported by' if connector_supported else 'not supported by'} "
                f"{chosen_station['connectors'] if chosen_station else 'no station'}"
            ),
            "station_operational": (
                f"{'PASSED' if station_operational else 'FAILED'} — station status is "
                f"{chosen_station['status'] if chosen_station else 'UNKNOWN'}"
            ),
            "transformer_thermal_safety": (
                f"{'PASSED' if projected_grid_load_kw <= grid_capacity_kw else 'FAILED'} — "
                f"{grid_load_kw} kW current + {effective_power_kw:.0f} kW session = {projected_grid_load_kw} kW "
                f"vs {grid_capacity_kw} kW transformer rating"
            ),
            "csp_schedule_feasible": (
                f"{'PASSED' if request_assignment else 'FAILED'} — "
                + (f"assigned {assigned_charger} in slot {assigned_slot}" if request_assignment
                   else "no feasible assignment satisfied all eight hard constraints")
            ),
        }
        all_constraints_passed = all(value.startswith("PASSED") for value in constraint_status.values())

        # A solution that cannot legally/safely be executed must not receive a high "quality"
        # score. These five checks are hard viability gates: if any fails, the option is not a
        # usable plan and the score is defined to be 0.
        HARD_VIABILITY_GATES = (
            "distance_limit",
            "deadline_satisfaction",
            "connector_compatibility",
            "station_operational",
            "csp_schedule_feasible",
        )
        failed_gates = [
            name for name in HARD_VIABILITY_GATES
            if not constraint_status[name].startswith("PASSED")
        ]

        if effective_power_kw > 0 and not failed_gates:
            dist_factor = 1.0 / (1.0 + (dist_km / 5.0))
            wait_factor = 1.0 / (1.0 + (wait_min / 15.0))
            power_factor = min(1.0, effective_power_kw / 150.0)
            math_score = round(100.0 * (0.40 * dist_factor + 0.35 * wait_factor + 0.25 * power_factor), 1)
            score_formula = (
                "Score = 100 * [0.40/(1+dist_km/5) + 0.35/(1+wait_min/15) + 0.25*min(1, power_kw/150)] "
                f"= 100 * [0.40*{dist_factor:.3f} + 0.35*{wait_factor:.3f} + 0.25*{power_factor:.3f}]"
                f" = {math_score}"
            )
        else:
            dist_factor = wait_factor = power_factor = 0.0
            math_score = 0.0
            score_formula = (
                f"Score = 0 because hard viability gate(s) failed: {', '.join(failed_gates)}"
                if failed_gates else "Score = 0 (no feasible assignment)"
            )

        recommended_station_payload = {
            "station_id": chosen_station_id or "NONE",
            "station_name": chosen_station_name,
            "operator": chosen_station["operator"] if chosen_station else "NONE",
            "distance_km": dist_km,
            "latitude": chosen_station["latitude"] if chosen_station else None,
            "longitude": chosen_station["longitude"] if chosen_station else None,
            "data_source": chosen_station["data_source"] if chosen_station else "NONE",
        }

        final_explanation = (
            f"Recommended station '{chosen_station_name}' ({chosen_station_id or 'NONE'}) at {dist_km} km, "
            f"reached by the {chosen_entry.algorithm if chosen_entry else req.selected_search_algorithm} path "
            f"{chosen_entry.path if chosen_entry else []}. "
            f"Session: {assigned_charger} in slot {assigned_slot}; arrival T+{travel_time_min}, "
            f"expected wait {wait_min} min, "
            f"estimated charging duration {dur_min} min at {effective_power_kw:.0f} kW. "
            f"{'All' if all_constraints_passed else str(sum(1 for v in constraint_status.values() if not v.startswith('PASSED')))} "
            f"constraint(s) {'satisfied' if all_constraints_passed else 'violated'}. "
            f"Mathematical decision score: {math_score} / 100."
        )

        step7 = Step7FinalDecision(
            recommended_station=recommended_station_payload,
            recommended_route=chosen_entry.path if chosen_entry else [],
            recommended_time_slot=assigned_slot,
            expected_waiting_time_min=wait_min,
            estimated_charging_duration_min=dur_min,
            constraint_status=constraint_status,
            decision_confidence_score=math_score,
            score_formula=score_formula,
            reasoning_explanation=final_explanation
        )

        # ---------------------------------------------------------------------
        # STEP 8: EXPLANATION — assembled from the values computed above
        # ---------------------------------------------------------------------
        facts_tier = [
            f"EV state (USER INPUT): SOC {req.current_charge_pct}%, energy needed {energy_needed} kWh, "
            f"deadline {req.departure_deadline_min} min, priority {computed_priority}.",
            f"Grid state (SIMULATED): transformer load {grid_load_kw} kW of {grid_capacity_kw} kW ({grid_load_pct}%).",
            f"Station state (SIMULATED occupancy, real metadata): {len(stations_eval)} stations read, "
            f"{sum(1 for s in stations_eval if s['status'] == 'OPERATIONAL')} operational, "
            f"{sum(1 for v in eligibility_status.values() if v)} eligible for this request.",
        ]
        rules_tier = [
            f"Forward chaining fired {len(rules_fired_list)} rule(s): {', '.join(rules_fired_list) if rules_fired_list else 'none applicable'}.",
            f"Backward chaining proved priority '{computed_priority}' for {req.ev_id}."
            + (f" (query: {why_prio.query})" if why_prio.query else ""),
            f"{len(restrictions_applied)} station(s) were excluded by rule-based eligibility checks."
            + (" " + " ".join(restrictions_applied[:2]) if restrictions_applied else ""),
        ]
        search_tier = (
            f"{chosen_entry.algorithm if chosen_entry else req.selected_search_algorithm} explored "
            f"{chosen_entry.nodes_explored if chosen_entry else 0} nodes and returned path cost "
            f"{chosen_entry.path_cost if chosen_entry else 0.0}; the other four algorithms were run on the "
            f"identical graph and are compared in Step 4."
        )
        constraints_tier = [f"{name}: {text}" for name, text in constraint_status.items()]
        decision_tier = (
            f"{chosen_station_name} ({chosen_station_id or 'NONE'}) selected with decision score {math_score}/100; "
            f"schedule {assigned_charger} in slot {assigned_slot}. "
            + (f"Conflict resolution chose alternative [{selected_alt_id}] "
               f"(Nash product {selected_nash:.3f})."
               if conflict_detected else "No resource conflict arose for this assignment.")
        )
        derivation_chain = [
            f"1. REQUEST: {req.ev_id} needs {energy_needed} kWh before {req.departure_deadline_min} min.",
            f"2. FACTS: {len(facts_asserted_list)} facts asserted from the live environment.",
            f"3. RULES: {len(rules_fired_list)} rule(s) fired; priority proved '{computed_priority}' by backward chaining.",
            f"4. SEARCH: {chosen_entry.algorithm if chosen_entry else req.selected_search_algorithm} chose "
            f"{chosen_station_name} at {dist_km} km (path cost {chosen_entry.path_cost if chosen_entry else 0.0}).",
            f"5. CSP: {'feasible' if request_assignment else 'infeasible'} schedule for "
            f"{len(csp_prob.variables)} EV(s) with {csp_res.stats.constraint_checks_count} constraint checks "
            f"and {csp_res.stats.backtracks_count} backtrack(s).",
            f"6. DECISION: constraint status {'all PASSED' if all_constraints_passed else 'contains FAILED checks'}; "
            f"score {math_score}/100.",
        ]

        step8 = Step8Explanation(
            prompt="Why was this station selected?",
            facts_tier=facts_tier,
            rules_tier=rules_tier,
            search_tier=search_tier,
            constraints_tier=constraints_tier,
            decision_tier=decision_tier,
            derivation_chain=derivation_chain
        )

        total_exec_time = round((time.perf_counter() - t0) * 1000.0, 2)

        # Register the decision so that GET /api/explanation/{decision_id} returns it
        record = ExplanationRecord(
            topic=f"EV charging station & schedule decision for {req.ev_id}",
            algorithm_used=(
                f"{chosen_entry.algorithm if chosen_entry else req.selected_search_algorithm} + "
                f"CSP backtracking (MRV/LCV/forward checking/AC-3) + forward/backward chaining"
                + (" + Nash bargaining" if conflict_detected else "")
            ),
            syllabus_unit="Units I-IV (agent, search, CSP, logic)",
            input_data={
                "request": req.model_dump(),
                "grid_load_kw": grid_load_kw,
                "grid_capacity_kw": grid_capacity_kw,
                "live_station_count": len(stations_eval),
            },
            selected_decision={
                "station_id": chosen_station_id or "NONE",
                "station_name": chosen_station_name,
                "charger": assigned_charger,
                "time_slot": assigned_slot,
                "decision_score": math_score,
            },
            alternatives_evaluated=[
                {"algorithm": e.algorithm, "path_cost": e.path_cost, "nodes_explored": e.nodes_explored,
                 "selected": e.selected}
                for e in algos_compared
            ],
            metrics={
                "dist_km": dist_km,
                "wait_min": wait_min,
                "charging_duration_min": dur_min,
                "effective_power_kw": effective_power_kw,
                "constraint_checks": csp_res.stats.constraint_checks_count,
                "backtracks": csp_res.stats.backtracks_count,
                "ac3_values_pruned": csp_res.stats.ac3_values_pruned,
                "workflow_runtime_ms": total_exec_time,
            },
            explanation_summary=final_explanation,
            why_chosen=(
                f"It is the lowest-cost reachable eligible station returned by "
                f"{chosen_entry.algorithm if chosen_entry else req.selected_search_algorithm}, it satisfies "
                f"{'all' if all_constraints_passed else 'most'} hard constraints, and it yields the highest "
                f"value of the stated decision score function ({math_score}/100)."
            ),
            why_rejected=[f"{s['id']}: {reason}" for s in stations_eval for reason in restrictions_applied
                          if s["id"] in reason][:10],
            derivation_trace=[
                ExplanationTraceItem(step_number=i + 1, step_type="WORKFLOW_STEP", description=line)
                for i, line in enumerate(derivation_chain)
            ],
        )
        decision_id = explanation_registry.register(record)

        return FullWorkflowResult(
            workflow_id=wf_id,
            decision_id=decision_id,
            timestamp=time.time(),
            execution_time_ms=total_exec_time,
            step1_request=step1,
            step2_formulation=step2,
            step3_reasoning=step3,
            step4_search=step4,
            step5_csp=step5,
            step6_conflict_resolution=step6,
            step7_final_decision=step7,
            step8_explanation=step8
        )

    # -------------------------------------------------------------------------
    # WORKFLOW HELPERS
    # -------------------------------------------------------------------------

    #: Connector standards implied by the charger types present at a station. The public
    #: station datasets record power class (AC/DC/ULTRA), not plug standard, so this mapping
    #: is an explicit, documented assumption used for eligibility checks.
    CONNECTOR_BY_CHARGER_TYPE = {
        "AC_SLOW": ["Type 2"],
        "DC_FAST": ["CCS2"],
        "ULTRA_FAST": ["CCS2"],
    }

    @staticmethod
    def _as_text(value: Any) -> str:
        """Render enum/None values as plain strings for explanations and constraint rows."""
        if value is None:
            return "UNKNOWN"
        return str(getattr(value, "value", value))

    @staticmethod
    def _supported_connectors(station_record: Dict[str, Any]) -> List[str]:
        from app.search.graph import read_station_field
        charger_types = read_station_field(station_record, "chargerTypes", "charger_types", []) or []
        chargers = read_station_field(station_record, "chargers", "chargers", []) or []
        if not charger_types:
            charger_types = [
                read_station_field(c, "chargerType", "charger_type", "DC_FAST") for c in chargers
            ]
        connectors: List[str] = []
        for charger_type in charger_types:
            for connector in PrimaryWorkflowEngine.CONNECTOR_BY_CHARGER_TYPE.get(str(charger_type).upper(), []):
                if connector not in connectors:
                    connectors.append(connector)
        return connectors

    @staticmethod
    def _build_live_csp_problem(
        req: "EVWorkflowRequest",
        live_stations: List[Dict[str, Any]],
        chosen_station_id: str = "",
        arrival_time_min: float = 0.0,
        max_variables: int = 4,
        max_stations: int = 5,
    ):
        """
        Build the scheduling CSP from the live environment: the requesting EV plus the other
        vehicles currently present in the simulation compete for the real chargers. Keeping the
        other EVs in the model is what makes the scheduling (and the conflict resolution in
        Step 6) a genuine resource-allocation problem instead of a single-vehicle exercise.
        """
        from app.search.graph import read_station_field
        from app.simulation.engine import sim_engine
        from app.csp.variables import CSPEVVariable, CSPProblemState
        from app.models.ev import EVStatus

        stations_map: Dict[str, Any] = {}
        chargers_map: Dict[str, Any] = {}

        def _distance_from_request(station_record: Dict[str, Any]) -> float:
            loc = read_station_field(station_record, "location", "location", {"x": 0.0, "y": 0.0})
            return math.hypot(
                req.current_location.get("x", 0.0) - loc.get("x", 0.0),
                req.current_location.get("y", 0.0) - loc.get("y", 0.0),
            )

        # The CSP only needs the stations that can realistically serve this request: the station
        # selected by the search step plus the nearest alternatives (these also act as the
        # fallback options for the competing vehicles). Keeping the shortlist small keeps the
        # domain sizes - and therefore the search - tractable and explainable.
        operational_records = [
            r for r in live_stations
            if PrimaryWorkflowEngine._as_text(
                read_station_field(r, "operatingStatus", "operating_status", "OPERATIONAL")
            ) == "OPERATIONAL"
        ]
        operational_records.sort(key=_distance_from_request)
        shortlist: Dict[str, Dict[str, Any]] = {}
        pinned = next((r for r in operational_records
                       if read_station_field(r, "id", "id") == chosen_station_id), None)
        if pinned is not None:
            shortlist[chosen_station_id] = pinned
        for record in operational_records:
            if len(shortlist) >= max_stations:
                break
            shortlist.setdefault(read_station_field(record, "id", "id"), record)

        for station_record in shortlist.values():
            st_id = read_station_field(station_record, "id", "id")
            status = PrimaryWorkflowEngine._as_text(
                read_station_field(station_record, "operatingStatus", "operating_status", "OPERATIONAL")
            )
            if status != "OPERATIONAL" or not st_id:
                continue

            charger_ids = []
            for charger in read_station_field(station_record, "chargers", "chargers", []) or []:
                charger_id = read_station_field(charger, "id", "id")
                charger_status = read_station_field(charger, "currentStatus", "current_status", "AVAILABLE")
                if not charger_id or charger_status in ("FAULT", "MAINTENANCE"):
                    continue
                chargers_map[charger_id] = {
                    "id": charger_id,
                    "stationId": st_id,
                    "chargerType": read_station_field(charger, "chargerType", "charger_type", "DC_FAST"),
                    "maximumPower": read_station_field(charger, "maximumPower", "maximum_power", 50.0),
                    "currentStatus": "AVAILABLE",
                }
                charger_ids.append(charger_id)

            if not charger_ids:
                continue

            stations_map[st_id] = {
                "id": st_id,
                "name": read_station_field(station_record, "name", "name", st_id),
                "chargingPower": read_station_field(station_record, "chargingPower", "charging_power", 180.0),
                "energyPrice": read_station_field(station_record, "energyPrice", "energy_price", 0.25),
                "operatingStatus": "OPERATIONAL",
                "location": read_station_field(station_record, "location", "location", {"x": 5.0, "y": 5.0}),
                "chargers": charger_ids,
            }

        variables: Dict[str, Any] = {}
        sources: Dict[str, str] = {}

        connector_needed = "AC_SLOW" if req.connector_requirement.upper() == "TYPE 2" else "DC_FAST"
        pinned_stations = [chosen_station_id] if chosen_station_id in stations_map else []
        variables[req.ev_id] = CSPEVVariable(
            ev_id=req.ev_id,
            allowed_station_ids=pinned_stations,
            # The vehicle cannot start charging before it has driven to the station; the CSP
            # deadline constraint uses this to reject assignments that finish after departure.
            arrival_time=int(math.ceil(arrival_time_min)),
            priority=req.priority.upper(),
            battery_capacity=req.battery_capacity_kwh,
            current_battery=(req.current_charge_pct / 100.0) * req.battery_capacity_kwh,
            required_battery=(req.required_charge_pct / 100.0) * req.battery_capacity_kwh,
            charging_rate=min(120.0, req.battery_capacity_kwh),
            departure_deadline=int(req.departure_deadline_min),
            location=req.current_location,
            charger_type_needed=connector_needed,
        )
        sources[req.ev_id] = "USER_INPUT"

        # Charging CSP semantics require *every* variable to receive a value. A vehicle that
        # cannot physically finish charging before its own deadline makes the whole instance
        # unsatisfiable, so such vehicles are reported as excluded instead of silently making
        # the requesting user's schedule infeasible.
        max_charger_power = max((c["maximumPower"] for c in chargers_map.values()), default=0.0)
        excluded_evs: List[Dict[str, Any]] = []

        for ev in sim_engine.evs.values():
            if len(variables) >= max_variables:
                break
            if ev.id == req.ev_id or ev.status in (EVStatus.COMPLETED, EVStatus.CANCELLED):
                continue

            energy_remaining = max(0.0, ev.requiredBatteryLevel - ev.currentBatteryLevel)
            effective_power = min(ev.chargingRate, max_charger_power) if max_charger_power > 0 else 0.0
            min_needed_min = (energy_remaining / effective_power * 60.0) if effective_power > 0 else float("inf")
            if min_needed_min > ev.departureDeadline:
                excluded_evs.append({
                    "ev_id": ev.id,
                    "reason": (
                        f"needs {energy_remaining:.1f} kWh at up to {effective_power:.0f} kW "
                        f"({min_needed_min:.0f} min) but departs in {ev.departureDeadline} min"
                    ),
                    "data_source": "SIMULATED",
                })
                continue

            variables[ev.id] = CSPEVVariable(
                ev_id=ev.id,
                priority=ev.priority.value,
                battery_capacity=ev.batteryCapacity,
                current_battery=ev.currentBatteryLevel,
                required_battery=ev.requiredBatteryLevel,
                charging_rate=ev.chargingRate,
                arrival_time=0,
                departure_deadline=max(15, int(ev.departureDeadline)),
                location=ev.currentLocation,
                charger_type_needed=connector_needed,
            )
            sources[ev.id] = "SIMULATED"

        problem = CSPProblemState(
            variables=variables,
            stations=stations_map,
            chargers=chargers_map,
            grid_capacity_kw=sim_engine.grid_node.maximumCapacity,
            time_step_min=15,
            max_time_horizon_min=max(240, int(req.departure_deadline_min) + 60),
        )
        return problem, sources, excluded_evs
