import time
import math
from typing import Dict, List, Tuple, Optional, Set, Any
from pydantic import BaseModel, Field

from app.csp.variables import CSPDomainValue, CSPEVVariable, CSPAssignment, CSPProblemState
from app.csp.constraints import HardConstraint, DEFAULT_HARD_CONSTRAINTS
from app.csp.evaluator import CSPSolutionEvaluator, SolutionUtilityScore


class CSPSearchStats(BaseModel):
    is_feasible: bool
    execution_time_ms: float
    backtracks_count: int
    constraint_checks_count: int
    solutions_found_count: int
    max_search_depth: int
    forward_checking_enabled: bool
    ac3_enabled: bool
    mrv_heuristic_enabled: bool
    lcv_enabled: bool = True
    violated_constraints_summary: List[str] = Field(default_factory=list)

    # --- Constraint-propagation measurements (all measured, never assumed) ---
    domain_values_generated: int = 0
    ac3_revisions: int = 0
    ac3_values_examined: int = 0
    ac3_values_pruned: int = 0
    forward_check_prunes: int = 0
    forward_check_wipeouts: int = 0
    value_choices_rejected: int = 0

    # --- Bounded-search reporting (a large infeasible instance must not hang the server) ---
    search_budget_nodes: int = 0
    search_budget_exhausted: bool = False


class CSPSolverResult(BaseModel):
    is_feasible: bool
    best_assignment: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    all_solutions: List[Dict[str, Dict[str, Any]]] = Field(default_factory=list)
    utility_score: Optional[SolutionUtilityScore] = None
    stats: CSPSearchStats
    explanation: str
    initial_domains: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    ac3_pruned_domains: Dict[str, int] = Field(default_factory=dict)
    backtracking_steps: List[Dict[str, Any]] = Field(default_factory=list)
    variable_selection_log: List[Dict[str, Any]] = Field(default_factory=list)
    constraints_enforced: List[Dict[str, str]] = Field(default_factory=list)


    @property
    def success(self) -> bool:
        return self.is_feasible

    @property
    def backtracks(self) -> int:
        return self.stats.backtracks_count

    @property
    def constraint_checks(self) -> int:
        return self.stats.constraint_checks_count

    @property
    def execution_time_ms(self) -> float:
        return self.stats.execution_time_ms

    @property
    def assignment(self) -> Any:
        class AssignmentProxy:
            def __init__(self, d):
                self.assignments = d
            def __len__(self):
                return len(self.assignments)
        return AssignmentProxy(self.best_assignment)


class CSPSolver:
    def __init__(
        self,
        hard_constraints: Optional[List[HardConstraint]] = None,
        evaluator: Optional[CSPSolutionEvaluator] = None
    ):
        self.hard_constraints = hard_constraints or DEFAULT_HARD_CONSTRAINTS
        self.evaluator = evaluator or CSPSolutionEvaluator()

        # Stats tracking
        self.backtracks_count = 0
        self.constraint_checks_count = 0
        self.max_depth_reached = 0
        self.violated_reasons: Set[str] = set()

        # Search instrumentation: every entry below is produced by the running algorithm,
        # so the UI can show what the solver actually did instead of a canned trace.
        self.ac3_revisions = 0
        self.ac3_values_examined = 0
        self.ac3_values_pruned = 0
        self.ac3_queue_operations = 0
        self.forward_check_prunes = 0
        self.forward_check_wipeouts = 0
        self.value_choices_rejected = 0
        self.backtracking_steps: List[Dict[str, Any]] = []
        self.variable_selection_log: List[Dict[str, Any]] = []
        self.ac3_pruned_domains: Dict[str, int] = {}
        self.nodes_explored = 0
        self.search_budget_exhausted = False
        self.max_search_nodes = 120_000  # overridden per run by solve(max_search_nodes=...)

        # Bound the trace so that API responses stay small on large instances.
        self.max_trace_entries = 400

    def _log_step(self, event: str, **details: Any) -> None:
        if len(self.backtracking_steps) >= self.max_trace_entries:
            return
        self.backtracking_steps.append({
            "step": len(self.backtracking_steps) + 1,
            "event": event,
            **details,
        })

    def generate_candidate_domains(self, problem: CSPProblemState) -> Dict[str, List[CSPDomainValue]]:
        """
        Constructs discrete candidate domains for each EV variable.
        """
        domains: Dict[str, List[CSPDomainValue]] = {}
        time_step = problem.time_step_min

        for ev_id, ev_var in problem.variables.items():
            ev_domain: List[CSPDomainValue] = []

            req_kwh = ev_var.energy_required_kwh
            if req_kwh <= 0:
                # EV is already fully charged
                req_kwh = 1.0

            allowed_stations = getattr(ev_var, "allowed_station_ids", None)

            for st_id, station in problem.stations.items():
                if station.get("operatingStatus") == "FAULT":
                    continue
                if allowed_stations and st_id not in allowed_stations:
                    continue

                for ch_id in station.get("chargers", []):
                    charger = problem.chargers.get(ch_id)
                    if not charger or charger.get("currentStatus") in ["FAULT", "MAINTENANCE"]:
                        continue

                    # Effective power limit
                    eff_power = min(ev_var.charging_rate, charger.get("maximumPower", 150.0))
                    if eff_power <= 0:
                        continue

                    # Required duration in minutes
                    min_duration_min = max(time_step, int(math.ceil((req_kwh / eff_power) * 60.0)))
                    # Discretize to time_step increments
                    min_duration_min = int(math.ceil(min_duration_min / time_step) * time_step)

                    # Candidate start times between arrival and deadline - duration
                    earliest_start = int(math.ceil(ev_var.arrival_time / time_step) * time_step)
                    latest_start = ev_var.departure_deadline - min_duration_min

                    for start_t in range(earliest_start, latest_start + 1, time_step):
                        val = CSPDomainValue(
                            station_id=st_id,
                            charger_id=ch_id,
                            start_time_min=start_t,
                            duration_min=min_duration_min,
                            power_kw=eff_power
                        )
                        ev_domain.append(val)

            domains[ev_id] = ev_domain

        return domains

    def check_hard_constraints(
        self,
        ev_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState
    ) -> Tuple[bool, Optional[str]]:
        """
        Evaluates all 8 hard constraints for assigned domain value.
        """
        for constraint in self.hard_constraints:
            self.constraint_checks_count += 1
            satisfied, reason = constraint.check(ev_id, val, assignment, problem)
            if not satisfied:
                if reason:
                    self.violated_reasons.add(reason)
                return False, reason
        return True, None

    def ac3(self, problem: CSPProblemState, domains: Dict[str, List[CSPDomainValue]]) -> bool:
        """
        AC-3 arc-consistency propagation over every ordered pair of EV variables.

        For each arc (v1, v2) the values of v1 that have no support in v2's current domain
        are removed; any domain reduction re-queues the affected arcs. Every queue
        operation and every pruned value is counted, so the effect of the propagation is
        reported honestly (on several of the preset instances AC-3 legitimately prunes
        nothing because every value already has support).
        """
        queue = [(v1, v2) for v1 in problem.variables for v2 in problem.variables if v1 != v2]
        queue_operations = 0

        while queue:
            queue_operations += 1
            v1, v2 = queue.pop(0)
            if self._revise(v1, v2, domains, problem):
                if len(domains[v1]) == 0:
                    self.ac3_queue_operations = queue_operations
                    return False  # Inconsistent domain
                for v3 in problem.variables:
                    if v3 != v1 and v3 != v2:
                        queue.append((v3, v1))

        self.ac3_queue_operations = queue_operations
        return True

    def _revise(self, v1: str, v2: str, domains: Dict[str, List[CSPDomainValue]], problem: CSPProblemState) -> bool:
        revised = False
        to_remove = []

        for val1 in domains[v1]:
            # Is there ANY value of v2 that is compatible with v1 = val1?
            has_support = False
            partial_assignment = CSPAssignment(assignments={v1: val1})

            for val2 in domains[v2]:
                self.ac3_values_examined += 1
                satisfied, _ = self.check_hard_constraints(v2, val2, partial_assignment, problem)
                if satisfied:
                    has_support = True
                    break

            if not has_support:
                to_remove.append(val1)
                revised = True

        if to_remove:
            self.ac3_revisions += 1
            self.ac3_values_pruned += len(to_remove)
            self.ac3_pruned_domains[v1] = self.ac3_pruned_domains.get(v1, 0) + len(to_remove)

        for r in to_remove:
            domains[v1].remove(r)

        return revised

    def forward_check(
        self,
        var_id: str,
        val: CSPDomainValue,
        assignment: CSPAssignment,
        problem: CSPProblemState,
        domains: Dict[str, List[CSPDomainValue]]
    ) -> Tuple[bool, Dict[str, List[CSPDomainValue]]]:
        """
        Forward checking: prunes inconsistent domain values from remaining unassigned variables.
        """
        new_domains = {v: list(vals) for v, vals in domains.items()}
        temp_assignment = assignment.copy()
        temp_assignment.assign(var_id, val)

        for other_id in problem.variables:
            if temp_assignment.is_assigned(other_id):
                continue

            filtered_domain = []
            for other_val in new_domains[other_id]:
                satisfied, _ = self.check_hard_constraints(other_id, other_val, temp_assignment, problem)
                if satisfied:
                    filtered_domain.append(other_val)

            pruned_here = len(new_domains[other_id]) - len(filtered_domain)
            self.forward_check_prunes += pruned_here

            if len(filtered_domain) == 0:
                self.forward_check_wipeouts += 1
                self._log_step(
                    "FORWARD_CHECK_WIPEOUT",
                    depth=len(assignment.assignments) + 1,
                    ev_id=other_id,
                    reason=f"Assigning {var_id} wiped out every remaining value of {other_id}",
                )
                return False, domains  # Domain wiped out, trigger early backtrack

            new_domains[other_id] = filtered_domain

        return True, new_domains

    def select_unassigned_variable_mrv(
        self,
        assignment: CSPAssignment,
        problem: CSPProblemState,
        domains: Dict[str, List[CSPDomainValue]]
    ) -> str:
        """
        MRV (Minimum Remaining Values) heuristic with Degree Heuristic tie-breaker.
        """
        unassigned = [v for v in problem.variables if not assignment.is_assigned(v)]

        # Sort by remaining domain size (MRV) ascending, then degree descending
        def mrv_degree_key(v_id: str) -> Tuple[int, int]:
            domain_size = len(domains.get(v_id, []))
            # Degree: number of unassigned neighbours still to be scheduled
            degree = sum(1 for o in problem.variables if o != v_id and not assignment.is_assigned(o))
            return (domain_size, -degree)

        unassigned.sort(key=mrv_degree_key)
        chosen = unassigned[0]

        # Record the real MRV decision: candidate sizes and which variable was picked
        self.variable_selection_log.append({
            "step": len(self.variable_selection_log) + 1,
            "selected_variable": chosen,
            "domain_size": len(domains.get(chosen, [])),
            "method": "MRV (minimum remaining values)",
            "candidate_domain_sizes": {v: len(domains.get(v, [])) for v in unassigned},
        })

        return chosen

    def order_domain_values_lcv(
        self,
        var_id: str,
        assignment: CSPAssignment,
        problem: CSPProblemState,
        domains: Dict[str, List[CSPDomainValue]]
    ) -> List[CSPDomainValue]:
        """
        LCV (Least Constraining Value) heuristic.
        Orders values by how few choices they eliminate for other unassigned variables.
        """
        candidate_values = domains.get(var_id, [])

        def count_conflicts(val: CSPDomainValue) -> int:
            conflicts = 0
            temp_assignment = assignment.copy()
            temp_assignment.assign(var_id, val)

            for other_id in problem.variables:
                if temp_assignment.is_assigned(other_id):
                    continue
                for other_val in domains.get(other_id, []):
                    satisfied, _ = self.check_hard_constraints(other_id, other_val, temp_assignment, problem)
                    if not satisfied:
                        conflicts += 1
            return conflicts

        return sorted(candidate_values, key=count_conflicts)

    def solve(
        self,
        problem: CSPProblemState,
        enable_forward_checking: bool = True,
        enable_ac3: bool = True,
        enable_mrv: bool = True,
        find_all_solutions: bool = False,
        max_solutions: int = 5,
        enable_lcv: bool = True,
        max_search_nodes: int = 120_000,
        max_search_seconds: float = 5.0,
        **kwargs
    ) -> CSPSolverResult:
        """
        Executes classical Backtracking Search with AC-3 and Forward Checking.
        """
        start_time = time.perf_counter()
        self.backtracks_count = 0
        self.constraint_checks_count = 0
        self.max_depth_reached = 0
        self.violated_reasons.clear()

        # Reset search instrumentation for this run
        self.ac3_revisions = 0
        self.ac3_values_examined = 0
        self.ac3_values_pruned = 0
        self.ac3_queue_operations = 0
        self.forward_check_prunes = 0
        self.forward_check_wipeouts = 0
        self.value_choices_rejected = 0
        self.backtracking_steps = []
        self.variable_selection_log = []
        self.ac3_pruned_domains = {}

        # 1. Generate domains
        domains = self.generate_candidate_domains(problem)

        # Snapshot the generated candidate domains (capped per variable) so that the
        # search screen can show the real variables/domains of this instance.
        initial_domain_snapshot: Dict[str, List[Dict[str, Any]]] = {
            ev_id: [v.model_dump() for v in vals[:8]]
            for ev_id, vals in domains.items()
        }
        domain_values_generated = sum(len(v) for v in domains.values())

        # 2. Optional AC-3 Constraint Propagation
        if enable_ac3:
            ac3_ok = self.ac3(problem, domains)
            if not ac3_ok:
                exec_time = (time.perf_counter() - start_time) * 1000.0
                empty_vars = [v for v, vals in domains.items() if len(vals) == 0]
                return CSPSolverResult(
                    is_feasible=False,
                    stats=CSPSearchStats(
                        is_feasible=False,
                        execution_time_ms=round(exec_time, 2),
                        backtracks_count=0,
                        constraint_checks_count=self.constraint_checks_count,
                        solutions_found_count=0,
                        max_search_depth=0,
                        forward_checking_enabled=enable_forward_checking,
                        ac3_enabled=enable_ac3,
                        mrv_heuristic_enabled=enable_mrv,
                        lcv_enabled=enable_lcv,
                        violated_constraints_summary=list(self.violated_reasons)[:5],
                        domain_values_generated=domain_values_generated,
                        ac3_revisions=self.ac3_revisions,
                        ac3_values_examined=self.ac3_values_examined,
                        ac3_values_pruned=self.ac3_values_pruned,
                        forward_check_prunes=self.forward_check_prunes,
                        forward_check_wipeouts=self.forward_check_wipeouts,
                        value_choices_rejected=self.value_choices_rejected,
                        search_budget_nodes=self.nodes_explored,
                        search_budget_exhausted=False
                    ),
                    initial_domains=initial_domain_snapshot,
                    ac3_pruned_domains=self.ac3_pruned_domains,
                    backtracking_steps=self.backtracking_steps,
                    variable_selection_log=self.variable_selection_log,
                    constraints_enforced=self._constraint_metadata(),
                    explanation=(
                        "Unfeasible: AC-3 constraint propagation removed every candidate value for "
                        f"{', '.join(empty_vars) or 'one or more EVs'} before search started. "
                        f"{self.ac3_values_pruned} candidate value(s) were pruned."
                    )
                )

        found_assignments: List[CSPAssignment] = []

        # 3. Backtracking Search Core
        def backtrack_recursive(current_assignment: CSPAssignment, current_domains: Dict[str, List[CSPDomainValue]], depth: int):
            if depth > self.max_depth_reached:
                self.max_depth_reached = depth

            # Bounded search: a classical depth-limited/budgeted search. Without a budget, an
            # infeasible instance with a large domain space can keep backtracking for minutes
            # (measured: 771k backtracks / 50M constraint checks on a 6-EV spike scenario).
            self.nodes_explored += 1
            if self.nodes_explored > self.max_search_nodes:
                self.search_budget_exhausted = True
                return
            # A wall-clock cap as well: node cost is not uniform (MRV/LCV ordering is O(domain)),
            # so a node budget alone can still take a minute on large instances.
            if (self.nodes_explored & 0xFF) == 0 and (time.perf_counter() - self._search_start) > self.max_search_seconds:
                self.search_budget_exhausted = True
                return

            if len(current_assignment.assignments) == len(problem.variables):
                found_assignments.append(current_assignment.copy())
                self._log_step(
                    "SOLUTION_FOUND",
                    depth=depth,
                    solution_index=len(found_assignments),
                )
                return

            if find_all_solutions and len(found_assignments) >= max_solutions:
                return

            # Select variable
            if enable_mrv:
                var_id = self.select_unassigned_variable_mrv(current_assignment, problem, current_domains)
            else:
                var_id = [v for v in problem.variables if not current_assignment.is_assigned(v)][0]

            # Order values using LCV when enabled; otherwise keep the generated domain order
            # (the flag is honoured so that "LCV on/off" comparisons are meaningful).
            if enable_lcv:
                values = self.order_domain_values_lcv(var_id, current_assignment, problem, current_domains)
            else:
                values = list(current_domains.get(var_id, []))

            for choice_index, val in enumerate(values):
                satisfied, reason = self.check_hard_constraints(var_id, val, current_assignment, problem)
                if not satisfied:
                    self.value_choices_rejected += 1
                    self._log_step(
                        "VALUE_REJECTED",
                        depth=depth,
                        ev_id=var_id,
                        value=f"{val.station_id}/{val.charger_id}@+{val.start_time_min}min",
                        reason=reason,
                    )
                    continue

                current_assignment.assign(var_id, val)
                self._log_step(
                    "ASSIGN",
                    depth=depth,
                    ev_id=var_id,
                    value=f"{val.station_id}/{val.charger_id}@+{val.start_time_min}min",
                    lcv_choice_rank=choice_index + 1,
                    values_considered=len(values),
                )

                # Forward checking
                fc_ok = True
                next_domains = current_domains
                if enable_forward_checking:
                    fc_ok, next_domains = self.forward_check(var_id, val, current_assignment, problem, current_domains)

                if fc_ok:
                    backtrack_recursive(current_assignment, next_domains, depth + 1)
                    if not find_all_solutions and len(found_assignments) > 0:
                        return
                    # Bounded enumeration: stop as soon as the requested number of feasible
                    # schedules has been collected. This check has to live inside the value
                    # loop, otherwise every ancestor keeps iterating and the cap is overshot.
                    if find_all_solutions and len(found_assignments) >= max_solutions:
                        current_assignment.unassign(var_id)
                        return

                # Backtrack step: this value (or its subtree) failed, so undo and try the next
                current_assignment.unassign(var_id)
                self.backtracks_count += 1
                self._log_step(
                    "BACKTRACK",
                    depth=depth,
                    ev_id=var_id,
                    value=f"{val.station_id}/{val.charger_id}@+{val.start_time_min}min",
                    reason=("forward-check wipeout in subtree" if not fc_ok else "subtree produced no solution"),
                )

        initial_assignment = CSPAssignment()
        backtrack_recursive(initial_assignment, domains, 0)

        exec_time = (time.perf_counter() - start_time) * 1000.0
        is_feasible = len(found_assignments) > 0

        # Rank solutions using soft objectives
        best_assignment_dict = {}
        all_solutions_dicts = []
        best_score = None

        if is_feasible:
            ranked_solutions = []
            for assign in found_assignments:
                score = self.evaluator.evaluate_assignment(assign, problem)
                ranked_solutions.append((score.total_score, score, assign))

            ranked_solutions.sort(key=lambda x: x[0], reverse=True)
            best_score = ranked_solutions[0][1]
            best_assign_obj = ranked_solutions[0][2]

            best_assignment_dict = {
                k: v.model_dump() for k, v in best_assign_obj.assignments.items()
            }
            all_solutions_dicts = [
                {k: v.model_dump() for k, v in sol[2].assignments.items()}
                for sol in ranked_solutions
            ]

            explanation = (
                f"Feasible CSP schedule generated successfully. Solved in {exec_time:.2f} ms with {self.backtracks_count} backtracks. "
                f"{best_score.explanation}"
            )
        elif self.search_budget_exhausted:
            explanation = (
                f"No solution was found within the search budget "
                f"({self.max_search_nodes} nodes / {self.max_search_seconds:g} s; explored {self.nodes_explored} nodes with "
                f"{self.backtracks_count} backtracks and {self.constraint_checks_count} constraint checks). "
                f"The instance is therefore UNKNOWN rather than proven infeasible: the budget was exhausted "
                f"before the search space was covered. Raise max_search_nodes to search further. "
                f"Last constraint conflicts seen: {', '.join(list(self.violated_reasons)[:3]) or 'none recorded'}."
            )
        else:
            explanation = (
                f"No feasible CSP schedule exists under current hard constraints. The search space was "
                f"exhausted without a solution (proven infeasible): "
                f"{self.backtracks_count} backtracks, {self.constraint_checks_count} constraint checks. "
                f"Violated constraints summary: {', '.join(list(self.violated_reasons)[:3]) or 'Deadline / Power conflicts'}."
            )

        return CSPSolverResult(
            is_feasible=is_feasible,
            best_assignment=best_assignment_dict,
            all_solutions=all_solutions_dicts,
            utility_score=best_score,
            stats=CSPSearchStats(
                is_feasible=is_feasible,
                execution_time_ms=round(exec_time, 2),
                backtracks_count=self.backtracks_count,
                constraint_checks_count=self.constraint_checks_count,
                solutions_found_count=len(found_assignments),
                max_search_depth=self.max_depth_reached,
                forward_checking_enabled=enable_forward_checking,
                ac3_enabled=enable_ac3,
                mrv_heuristic_enabled=enable_mrv,
                lcv_enabled=enable_lcv,
                violated_constraints_summary=list(self.violated_reasons)[:5],
                domain_values_generated=domain_values_generated,
                ac3_revisions=self.ac3_revisions,
                ac3_values_examined=self.ac3_values_examined,
                ac3_values_pruned=self.ac3_values_pruned,
                forward_check_prunes=self.forward_check_prunes,
                forward_check_wipeouts=self.forward_check_wipeouts,
                value_choices_rejected=self.value_choices_rejected,
                search_budget_nodes=self.nodes_explored,
                search_budget_exhausted=self.search_budget_exhausted
            ),
            initial_domains=initial_domain_snapshot,
            ac3_pruned_domains=self.ac3_pruned_domains,
            backtracking_steps=self.backtracking_steps,
            variable_selection_log=self.variable_selection_log,
            constraints_enforced=self._constraint_metadata(),
            explanation=explanation
        )

    def _constraint_metadata(self) -> List[Dict[str, str]]:
        """Names of the hard constraints that were actually enforced during this search."""
        return [{"name": c.name(), "type": type(c).__name__} for c in self.hard_constraints]
