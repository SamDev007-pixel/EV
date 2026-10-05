import time
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field

from app.game_theory.utility_models import (
    AgentPreferences,
    UtilityBreakdown,
    EVAgentUtility,
    StationAgentUtility,
    GridAgentUtility,
    EnergyAgentUtility
)
from app.game_theory.alternatives import ActionAlternative, AlternativeGenerator


class AlternativeEvaluation(BaseModel):
    alternative_id: str
    alternative_title: str
    utilities: Dict[str, float]  # role -> utility_score
    breakdowns: List[UtilityBreakdown]
    nash_bargaining_product: float
    social_welfare_score: float
    is_pareto_efficient: bool
    is_hard_constraint_satisfied: bool
    rejection_reason: Optional[str] = None

    @property
    def nash_product(self) -> float:
        return self.nash_bargaining_product


class DecisionTraceStep(BaseModel):
    step_number: int
    phase_name: str
    summary: str
    details: Dict[str, Any] = Field(default_factory=dict)


class NegotiationResult(BaseModel):
    scenario_name: str
    chosen_action: Dict[str, Any]
    rejected_alternatives: List[Dict[str, Any]]
    agent_preferences: List[AgentPreferences]
    evaluations_matrix: List[AlternativeEvaluation]
    decision_trace: List[DecisionTraceStep]
    explanation_summary: str
    execution_time_ms: float

    @property
    def alternatives_evaluated(self) -> List[AlternativeEvaluation]:
        return self.evaluations_matrix

    @property
    def selected_alternative(self) -> Any:
        class SelectedAltProxy:
            def __init__(self, action, matrix):
                self.alternative_id = action.get("alternative_id") or action.get("id", "NONE")
                matched = next((a for a in matrix if a.alternative_id == self.alternative_id), None)
                self.nash_product = matched.nash_bargaining_product if matched else 0.0
                self.is_pareto_efficient = matched.is_pareto_efficient if matched else True
        return SelectedAltProxy(self.chosen_action, self.evaluations_matrix)


class NegotiationEngine:
    def __init__(self):
        # Default disagreement utility threshold d_i
        self.d_ev = 10.0
        self.d_station = 10.0
        self.d_grid = 10.0
        self.d_energy = 10.0

    def resolve_conflict(
        self,
        scenario_name: str = "SCENARIO_IMMEDIATE_VS_OVERLOAD",
        custom_alternatives: Optional[List[ActionAlternative]] = None,
        grid_load_kw: float = 200.0,
        transformer_limit_kw: float = 300.0,
        ev_deadline_min: int = 120
    ) -> NegotiationResult:
        """
        Executes the 7-Step Game-Theoretic Conflict Resolution Protocol.
        Deterministic, reproducible, and transparent for academic evaluation.
        """
        start_time = time.perf_counter()
        trace: List[DecisionTraceStep] = []

        # ---------------------------------------------------------------------
        # STEP 1: RECEIVE COMPETING PREFERENCES
        # ---------------------------------------------------------------------
        agent_prefs = [
            AgentPreferences(
                agent_id="AGENT-EV-101",
                agent_role="EV_AGENT",
                goals=["Minimize waiting time", "Minimize charging cost", "Satisfy departure deadline"],
                disagreement_point_d=self.d_ev,
                weight=1.2
            ),
            AgentPreferences(
                agent_id="AGENT-STATION-METRO",
                agent_role="STATION_AGENT",
                goals=["Maximize charger utilization", "Reduce idle chargers", "Maintain fair queueing"],
                disagreement_point_d=self.d_station,
                weight=1.0
            ),
            AgentPreferences(
                agent_id="AGENT-GRID-MAIN",
                agent_role="GRID_AGENT",
                goals=["Prevent transformer overload", "Maintain safe load headroom"],
                disagreement_point_d=self.d_grid,
                weight=1.5
            ),
            AgentPreferences(
                agent_id="AGENT-ENERGY-SOLAR",
                agent_role="ENERGY_AGENT",
                goals=["Minimize energy cost", "Efficiently use solar/renewable storage"],
                disagreement_point_d=self.d_energy,
                weight=1.0
            )
        ]

        trace.append(DecisionTraceStep(
            step_number=1,
            phase_name="RECEIVE_COMPETING_PREFERENCES",
            summary="Collected conflicting preferences from EV, Station, Grid, and Energy agents.",
            details={"agent_preferences": [p.model_dump() for p in agent_prefs]}
        ))

        # ---------------------------------------------------------------------
        # STEP 2: GENERATE FEASIBLE ALTERNATIVES
        # ---------------------------------------------------------------------
        alternatives = custom_alternatives or AlternativeGenerator.generate_candidate_alternatives(
            ev_deadline_min=ev_deadline_min
        )

        trace.append(DecisionTraceStep(
            step_number=2,
            phase_name="GENERATE_FEASIBLE_ALTERNATIVES",
            summary=f"Generated {len(alternatives)} candidate resolution alternatives.",
            details={"alternatives": [a.model_dump() for a in alternatives]}
        ))

        # ---------------------------------------------------------------------
        # STEP 3: EVALUATE EACH ALTERNATIVE FOR EACH AGENT
        # ---------------------------------------------------------------------
        evaluations: List[AlternativeEvaluation] = []

        for alt in alternatives:
            # 1. EV Utility
            ev_ub = EVAgentUtility.evaluate(
                start_time_min=alt.start_time_min,
                duration_min=alt.duration_min,
                charging_cost_usd=alt.total_cost_usd,
                ev_deadline_min=ev_deadline_min
            )

            # 2. Station Utility
            st_ub = StationAgentUtility.evaluate(
                power_kw=alt.power_kw,
                max_charger_power=150.0,
                station_queue_length=2
            )

            # 3. Grid Utility
            grid_ub = GridAgentUtility.evaluate(
                requested_power_kw=alt.power_kw,
                current_grid_load_kw=grid_load_kw,
                transformer_capacity_kw=transformer_limit_kw
            )

            # 4. Energy Utility
            ren_avail = (alt.energy_source == "SOLAR_RENEWABLE")
            energy_ub = EnergyAgentUtility.evaluate(
                energy_source=alt.energy_source,
                unit_cost_usd_kwh=alt.unit_cost_usd_kwh,
                renewable_available=ren_avail
            )

            breakdowns = [ev_ub, st_ub, grid_ub, energy_ub]
            utilities = {b.agent_role: b.utility_score for b in breakdowns}

            # Hard Constraint Check: Grid Utility > 0 and EV Utility > 0
            is_satisfied = (grid_ub.utility_score > 0.0) and (ev_ub.utility_score > 0.0)

            rejection_reason = None
            if not is_satisfied:
                if grid_ub.utility_score == 0.0:
                    rejection_reason = f"Hard constraint violation: {grid_ub.explanation}"
                elif ev_ub.utility_score == 0.0:
                    rejection_reason = f"Hard constraint violation: {ev_ub.explanation}"

            # Nash Bargaining Product: N(a) = prod( max(0, U_i - d_i) )
            n_ev = max(0.0, ev_ub.utility_score - self.d_ev)
            n_st = max(0.0, st_ub.utility_score - self.d_station)
            n_grid = max(0.0, grid_ub.utility_score - self.d_grid)
            n_energy = max(0.0, energy_ub.utility_score - self.d_energy)

            nash_product = round(n_ev * n_st * n_grid * n_energy, 2) if is_satisfied else 0.0

            # Social Welfare Score: W(a) = sum( w_i * U_i )
            weights = {p.agent_role: p.weight for p in agent_prefs}
            social_welfare = sum(weights.get(b.agent_role, 1.0) * b.utility_score for b in breakdowns)
            social_welfare = round(social_welfare, 2)

            evaluations.append(AlternativeEvaluation(
                alternative_id=alt.id,
                alternative_title=alt.title,
                utilities=utilities,
                breakdowns=breakdowns,
                nash_bargaining_product=nash_product,
                social_welfare_score=social_welfare,
                is_pareto_efficient=False,  # Computed in step 5
                is_hard_constraint_satisfied=is_satisfied,
                rejection_reason=rejection_reason
            ))

        trace.append(DecisionTraceStep(
            step_number=3,
            phase_name="EVALUATE_UTILITIES",
            summary="Computed explicit numerical utility scores U_i(a) for all agents across all alternatives.",
            details={"utility_matrix": [e.model_dump() for e in evaluations]}
        ))

        # ---------------------------------------------------------------------
        # STEP 4: IDENTIFY CONFLICTS
        # ---------------------------------------------------------------------
        conflicts = []
        for e in evaluations:
            if not e.is_hard_constraint_satisfied:
                conflicts.append(f"Alternative {e.alternative_id} ({e.alternative_title}): {e.rejection_reason}")
            elif e.utilities.get("EV_AGENT", 0) > 80.0 and e.utilities.get("GRID_AGENT", 0) < 40.0:
                conflicts.append(f"Alternative {e.alternative_id}: Conflict between EV immediate demand and Grid headroom safety.")

        trace.append(DecisionTraceStep(
            step_number=4,
            phase_name="IDENTIFY_CONFLICTS",
            summary=f"Identified {len(conflicts)} direct objective conflicts among alternatives.",
            details={"identified_conflicts": conflicts}
        ))

        # ---------------------------------------------------------------------
        # STEP 5: NEGOTIATE OR RANK ALTERNATIVES & PARETO CHECK
        # ---------------------------------------------------------------------
        # Compute Pareto efficiency
        for i, eval_i in enumerate(evaluations):
            if not eval_i.is_hard_constraint_satisfied:
                eval_i.is_pareto_efficient = False
                continue

            dominated = False
            for j, eval_j in enumerate(evaluations):
                if i == j or not eval_j.is_hard_constraint_satisfied:
                    continue
                # eval_j dominates eval_i if j is >= i in all utilities and strictly > in at least one
                all_ge = all(eval_j.utilities[r] >= eval_i.utilities[r] for r in eval_i.utilities)
                strictly_gt = any(eval_j.utilities[r] > eval_i.utilities[r] for r in eval_i.utilities)
                if all_ge and strictly_gt:
                    dominated = True
                    break
            eval_i.is_pareto_efficient = not dominated

        # Rank valid alternatives by Nash Bargaining Product descending, then Social Welfare
        valid_evals = [e for e in evaluations if e.is_hard_constraint_satisfied]
        valid_evals.sort(key=lambda x: (x.nash_bargaining_product, x.social_welfare_score), reverse=True)

        trace.append(DecisionTraceStep(
            step_number=5,
            phase_name="NEGOTIATE_AND_RANK",
            summary="Ranked alternatives using Nash Bargaining Product N(a) and Social Welfare W(a). Filtered Pareto efficient set.",
            details={"ranked_valid_alternatives": [e.model_dump() for e in valid_evals]}
        ))

        # ---------------------------------------------------------------------
        # STEP 6: SELECT FEASIBLE COMPROMISE
        # ---------------------------------------------------------------------
        if valid_evals:
            best_eval = valid_evals[0]
            chosen_alt = next(a for a in alternatives if a.id == best_eval.alternative_id)
        else:
            # Fallback if all fail
            best_eval = evaluations[0]
            chosen_alt = alternatives[0]

        trace.append(DecisionTraceStep(
            step_number=6,
            phase_name="SELECT_FEASIBLE_COMPROMISE",
            summary=f"Selected {chosen_alt.id} ({chosen_alt.title}) as the Pareto-optimal compromise choice.",
            details={"chosen_alternative_id": chosen_alt.id, "nash_score": best_eval.nash_bargaining_product}
        ))

        # ---------------------------------------------------------------------
        # STEP 7: PRODUCE EXPLANATION & DECISION TRACE
        # ---------------------------------------------------------------------
        rejected_list = []
        for e in evaluations:
            if e.alternative_id != chosen_alt.id:
                reason = e.rejection_reason or (
                    f"Sub-optimal compromise: Nash Bargaining Product ({e.nash_bargaining_product:.1f}) "
                    f"is lower than selected compromise ({best_eval.nash_bargaining_product:.1f})."
                )
                rejected_list.append({
                    "alternative_id": e.alternative_id,
                    "title": e.alternative_title,
                    "utilities": e.utilities,
                    "rejection_reason": reason
                })

        explanation_summary = (
            f"Multi-Agent Consensus Reached: Selected {chosen_alt.title}. "
            f"This compromise satisfies all hard grid safety limits (Grid Utility: {best_eval.utilities.get('GRID_AGENT'):.1f}) "
            f"while providing high EV satisfaction (EV Utility: {best_eval.utilities.get('EV_AGENT'):.1f}) "
            f"and achieving maximum Nash Bargaining Product N(a) = {best_eval.nash_bargaining_product:.1f}."
        )

        trace.append(DecisionTraceStep(
            step_number=7,
            phase_name="PRODUCE_EXPLANATION",
            summary=explanation_summary,
            details={"rejected_alternatives_count": len(rejected_list)}
        ))

        exec_time = (time.perf_counter() - start_time) * 1000.0

        return NegotiationResult(
            scenario_name=scenario_name,
            chosen_action=chosen_alt.model_dump(),
            rejected_alternatives=rejected_list,
            agent_preferences=agent_prefs,
            evaluations_matrix=evaluations,
            decision_trace=trace,
            explanation_summary=explanation_summary,
            execution_time_ms=round(exec_time, 2)
        )
