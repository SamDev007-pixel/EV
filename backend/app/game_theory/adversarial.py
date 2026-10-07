import time
import math
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field


class GameState(BaseModel):
    round_id: int = 1
    max_rounds: int = 3
    ev_fleet_demand_kw: float = 150.0
    grid_safe_capacity_kw: float = 200.0
    current_grid_load_kw: float = 120.0
    current_tariff_per_kwh: float = 0.20
    allocated_power_kw: float = 0.0
    utility_score: float = 0.0
    history: List[str] = Field(default_factory=list)
    grid_reserve_kw: Optional[float] = None
    ev_urgency_score: Optional[float] = None
    current_tariff_usd: Optional[float] = None
    is_ev_turn: Optional[bool] = True
    depth: int = 0

    def is_terminal(self, max_depth: int = 3) -> bool:
        if self.grid_reserve_kw is not None and self.grid_reserve_kw <= 0.0:
            return True
        return self.depth >= max_depth or self.round_id > self.max_rounds


class GameAction(BaseModel):
    action_id: str
    player: str  # MAX (EV Fleet) or MIN (Energy Broker)
    name: str
    power_delta_kw: float
    tariff_multiplier: float
    description: str

    @property
    def action_type(self) -> str:
        return self.name


class MinimaxDecisionResult(BaseModel):
    algorithm: str = "MINIMAX_ALPHA_BETA_PRUNING"
    optimal_action: GameAction
    minimax_value: float
    nodes_evaluated: int
    alpha_beta_cutoffs: int          # total of alpha + beta cutoffs
    alpha_cutoffs: int = 0           # cutoffs recorded at MAX nodes
    beta_cutoffs: int = 0            # cutoffs recorded at MIN nodes
    max_depth: int
    execution_time_ms: float
    decision_trace: List[Dict[str, Any]]
    explanation: str

    @property
    def best_action(self) -> GameAction:
        return self.optimal_action


class AdversarialBargainingGame:
    """
    Adversarial search: two-player game tree with minimax and alpha-beta pruning.
    2-Player Zero-Sum Game:
    - MAX Player: EV Fleet Aggregator seeking maximum power at minimal tariff.
    - MIN Player: Grid/Station Energy Broker seeking grid headroom preservation and peak moderation.
    """

    def __init__(self, max_depth: int = 3):
        self.max_depth = max_depth
        self.nodes_evaluated = 0
        self.alpha_beta_cutoffs = 0
        self.alpha_cutoffs = 0
        self.beta_cutoffs = 0
        self.trace: List[Dict[str, Any]] = []

    def get_actions(self, state: GameState, is_max: bool) -> List[GameAction]:
        if is_max:
            # EV Fleet proposals: Aggressive Max, Balanced Nominal, Eco Throttled
            return [
                GameAction(
                    action_id="ACT-MAX-AGGRESSIVE",
                    player="MAX",
                    name="Aggressive 150 kW Fast Charge",
                    power_delta_kw=150.0,
                    tariff_multiplier=1.2,
                    description="Demand maximum 150 kW rate immediately; willing to pay peak tariff."
                ),
                GameAction(
                    action_id="ACT-MAX-BALANCED",
                    player="MAX",
                    name="Balanced 75 kW Moderate Charge",
                    power_delta_kw=75.0,
                    tariff_multiplier=1.0,
                    description="Request nominal 75 kW rate at base tariff."
                ),
                GameAction(
                    action_id="ACT-MAX-ECO",
                    player="MAX",
                    name="Eco 40 kW Off-Peak Charge",
                    power_delta_kw=40.0,
                    tariff_multiplier=0.8,
                    description="Accept throttled 40 kW rate in exchange for green/off-peak discount."
                )
            ]
        else:
            # Energy Broker counter-actions: Full Grant, Demand Response Surcharge, Throttling Cap
            return [
                GameAction(
                    action_id="ACT-MIN-GRANT",
                    player="MIN",
                    name="Accept Full Allocation (Normal Surcharge)",
                    power_delta_kw=0.0,
                    tariff_multiplier=1.0,
                    description="Approve requested power level with baseline network fee."
                ),
                GameAction(
                    action_id="ACT-MIN-SURCHARGE",
                    player="MIN",
                    name="Peak Demand Response Surcharge (+30%)",
                    power_delta_kw=0.0,
                    tariff_multiplier=1.3,
                    description="Approve request but apply 30% grid congestion surcharge."
                ),
                GameAction(
                    action_id="ACT-MIN-THROTTLE",
                    player="MIN",
                    name="Mandatory Power Throttling (-25 kW)",
                    power_delta_kw=-25.0,
                    tariff_multiplier=0.9,
                    description="Throttle power delivery by 25 kW to preserve transformer thermal buffer."
                )
            ]

    def apply_action(self, state: GameState, action: GameAction) -> GameState:
        new_state = state.model_copy(deep=True)
        new_state.round_id += 1
        new_state.history.append(f"{action.player}: {action.name}")

        if action.player == "MAX":
            new_state.allocated_power_kw = max(0.0, action.power_delta_kw)
            new_state.current_tariff_per_kwh = round(state.current_tariff_per_kwh * action.tariff_multiplier, 3)
        else:
            new_state.allocated_power_kw = max(20.0, new_state.allocated_power_kw + action.power_delta_kw)
            new_state.current_tariff_per_kwh = round(new_state.current_tariff_per_kwh * action.tariff_multiplier, 3)

        new_state.utility_score = self.evaluate_state(new_state)
        return new_state

    def is_terminal(self, state: GameState, depth: int) -> bool:
        if state.grid_reserve_kw is not None and state.grid_reserve_kw <= 0.0:
            return True
        return depth >= self.max_depth or state.round_id > state.max_rounds

    def evaluate_state(self, state: GameState) -> float:
        """
        Evaluation function from MAX (Fleet) perspective:
        + Value for power received
        - Penalty for high tariff
        - Severe penalty if grid capacity exceeded (shared brownout risk)
        """
        total_grid = state.current_grid_load_kw + state.allocated_power_kw
        if total_grid > state.grid_safe_capacity_kw:
            # Overload penalty
            overload = total_grid - state.grid_safe_capacity_kw
            return round(-50.0 - (overload * 2.0), 2)

        power_benefit = state.allocated_power_kw * 0.8
        tariff_penalty = (state.current_tariff_per_kwh / 0.20) * 20.0
        return round(power_benefit - tariff_penalty, 2)

    def minimax_alpha_beta(
        self,
        state: GameState,
        depth: int,
        alpha: float,
        beta: float,
        is_max: bool
    ) -> Tuple[float, Optional[GameAction]]:
        self.nodes_evaluated += 1

        if self.is_terminal(state, depth):
            score = self.evaluate_state(state)
            return score, None

        actions = self.get_actions(state, is_max)

        if is_max:
            max_eval = -float('inf')
            best_action = actions[0] if actions else None

            for act in actions:
                next_state = self.apply_action(state, act)
                eval_score, _ = self.minimax_alpha_beta(next_state, depth + 1, alpha, beta, False)

                if eval_score > max_eval:
                    max_eval = eval_score
                    best_action = act

                alpha = max(alpha, eval_score)
                if beta <= alpha:
                    self.alpha_beta_cutoffs += 1
                    self.alpha_cutoffs += 1
                    self.trace.append({
                        "depth": depth,
                        "type": "ALPHA_CUTOFF",
                        "reason": f"Pruned remaining MAX actions: beta ({beta:.2f}) <= alpha ({alpha:.2f})"
                    })
                    break

            return max_eval, best_action
        else:
            min_eval = float('inf')
            best_action = actions[0] if actions else None

            for act in actions:
                next_state = self.apply_action(state, act)
                eval_score, _ = self.minimax_alpha_beta(next_state, depth + 1, alpha, beta, True)

                if eval_score < min_eval:
                    min_eval = eval_score
                    best_action = act

                beta = min(beta, eval_score)
                if beta <= alpha:
                    self.alpha_beta_cutoffs += 1
                    self.beta_cutoffs += 1
                    self.trace.append({
                        "depth": depth,
                        "type": "BETA_CUTOFF",
                        "reason": f"Pruned remaining MIN actions: beta ({beta:.2f}) <= alpha ({alpha:.2f})"
                    })
                    break

            return min_eval, best_action

    def solve(self, initial_state: Optional[GameState] = None) -> MinimaxDecisionResult:
        start_time = time.perf_counter()
        self.nodes_evaluated = 0
        self.alpha_beta_cutoffs = 0
        self.alpha_cutoffs = 0
        self.beta_cutoffs = 0
        self.trace = []

        state = initial_state or GameState()
        best_val, best_action = self.minimax_alpha_beta(
            state=state,
            depth=0,
            alpha=-float('inf'),
            beta=float('inf'),
            is_max=True
        )

        exec_time = (time.perf_counter() - start_time) * 1000.0

        action_name = best_action.name if best_action else "Terminal State"
        explanation = (
            f"Adversarial Game Solved (Depth {self.max_depth}): Optimal action for MAX player is "
            f"'{action_name}' yielding Minimax utility {best_val:.2f}. "
            f"Explored {self.nodes_evaluated} nodes with {self.alpha_beta_cutoffs} Alpha-Beta branch cutoffs."
        )

        fallback_action = best_action or GameAction(
            action_id="ACT-TERMINAL",
            player="MAX",
            name="Terminal State",
            power_delta_kw=0.0,
            tariff_multiplier=1.0,
            description="Terminal state reached; no further actions taken."
        )

        return MinimaxDecisionResult(
            optimal_action=fallback_action,
            minimax_value=best_val,
            nodes_evaluated=self.nodes_evaluated,
            alpha_beta_cutoffs=self.alpha_beta_cutoffs,
            alpha_cutoffs=self.alpha_cutoffs,
            beta_cutoffs=self.beta_cutoffs,
            max_depth=self.max_depth,
            execution_time_ms=round(exec_time, 3),
            decision_trace=self.trace,
            explanation=explanation
        )

    @classmethod
    def solve_with_alpha_beta(cls, initial_state: Optional[GameState] = None, max_depth: int = 3) -> MinimaxDecisionResult:
        game = cls(max_depth=max_depth)
        return game.solve(initial_state)

