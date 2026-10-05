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
    violated_constraints_summary: List[str] = Field(default_factory=list)


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

            for st_id, station in problem.stations.items():
                if station.get("operatingStatus") == "FAULT":
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
        AC-3 Arc Consistency Algorithm for domain reduction.
        """
        queue = [(v1, v2) for v1 in problem.variables for v2 in problem.variables if v1 != v2]

        while queue:
            v1, v2 = queue.pop(0)
            if self._revise(v1, v2, domains, problem):
                if len(domains[v1]) == 0:
                    return False  # Inconsistent domain
                for v3 in problem.variables:
                    if v3 != v1 and v3 != v2:
                        queue.append((v3, v1))
        return True

    def _revise(self, v1: str, v2: str, domains: Dict[str, List[CSPDomainValue]], problem: CSPProblemState) -> bool:
        revised = False
        to_remove = []

        for val1 in domains[v1]:
            # Check if there exists ANY compatible val2 in domains[v2]
            has_support = False
            dummy_assignment = CSPAssignment(assignments={v1: val1})

            for val2 in domains[v2]:
                satisfied, _ = self.check_hard_constraints(v2, val2, dummy_assignment, problem)
                if satisfied:
                    has_support = True
                    break

            if not has_support:
                to_remove.append(val1)
                revised = True

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

            if len(filtered_domain) == 0:
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
            # Degree: number of unassigned neighbors
            degree = sum(1 for o in problem.variables if o != v_id and not assignment.is_assigned(o))
            return (domain_size, -degree)

        unassigned.sort(key=mrv_degree_key)
        return unassigned[0]

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

        # 1. Generate domains
        domains = self.generate_candidate_domains(problem)

        # 2. Optional AC-3 Constraint Propagation
        if enable_ac3:
            ac3_ok = self.ac3(problem, domains)
            if not ac3_ok:
                exec_time = (time.perf_counter() - start_time) * 1000.0
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
                        violated_constraints_summary=list(self.violated_reasons)[:5]
                    ),
                    explanation="Unfeasible: AC-3 constraint propagation reduced one or more variable domains to empty before search."
                )

        found_assignments: List[CSPAssignment] = []

        # 3. Backtracking Search Core
        def backtrack_recursive(current_assignment: CSPAssignment, current_domains: Dict[str, List[CSPDomainValue]], depth: int):
            if depth > self.max_depth_reached:
                self.max_depth_reached = depth

            if len(current_assignment.assignments) == len(problem.variables):
                found_assignments.append(current_assignment.copy())
                return

            if find_all_solutions and len(found_assignments) >= max_solutions:
                return

            # Select variable
            if enable_mrv:
                var_id = self.select_unassigned_variable_mrv(current_assignment, problem, current_domains)
            else:
                var_id = [v for v in problem.variables if not current_assignment.is_assigned(v)][0]

            # Order values using LCV
            values = self.order_domain_values_lcv(var_id, current_assignment, problem, current_domains)

            for val in values:
                satisfied, reason = self.check_hard_constraints(var_id, val, current_assignment, problem)
                if satisfied:
                    current_assignment.assign(var_id, val)

                    # Forward checking
                    fc_ok = True
                    next_domains = current_domains
                    if enable_forward_checking:
                        fc_ok, next_domains = self.forward_check(var_id, val, current_assignment, problem, current_domains)

                    if fc_ok:
                        backtrack_recursive(current_assignment, next_domains, depth + 1)
                        if not find_all_solutions and len(found_assignments) > 0:
                            return

                    # Backtrack step
                    current_assignment.unassign(var_id)
                    self.backtracks_count += 1

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
        else:
            explanation = (
                f"No feasible CSP schedule exists under current hard constraints. "
                f"Backtracked {self.backtracks_count} times and checked {self.constraint_checks_count} constraints. "
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
                violated_constraints_summary=list(self.violated_reasons)[:5]
            ),
            explanation=explanation
        )
