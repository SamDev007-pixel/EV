"""
Two-Agent EV Charging Resource Competition Decision Game.
FOAI Unit III: Game Playing & Adversarial Search (Minimax and Alpha-Beta Pruning).
Russell & Norvig, Artificial Intelligence: A Modern Approach (Chapter 5).

Educational Demonstration Scenario:
- Two competing autonomous EV agents (EV-1 [MAX] and EV-2 [MIN]) arrive at a charging station.
- Limited shared resources:
  * 1 Fast DC Charger bay (150 kW) - Highest utility, rapid charge.
  * 1 Normal AC Charger bay (22 kW) - Moderate utility.
  * Standby Buffer Bay (0 kW) - Zero immediate charging, wait penalty.
- The game state represents current resource availability and allocation commitments.
- Both EV-1 and EV-2 evaluate future turns using Minimax with Alpha-Beta Pruning
  to choose the optimal resource claim strategy without physical collision or deadlock.
"""

import time
from typing import Dict, List, Optional, Tuple, Any
from pydantic import BaseModel, Field


class SlotGameState(BaseModel):
    round_number: int = 1
    max_rounds: int = 2
    is_ev1_turn: bool = True  # EV1 is MAX, EV2 is MIN
    fast_bay_claimed_by: Optional[str] = None  # None, "EV1", or "EV2"
    normal_bay_claimed_by: Optional[str] = None
    ev1_status: str = "UNASSIGNED"  # "FAST", "NORMAL", "BUFFER", "UNASSIGNED"
    ev2_status: str = "UNASSIGNED"
    history: List[str] = Field(default_factory=list)

    def is_terminal(self) -> bool:
        both_assigned = (self.ev1_status != "UNASSIGNED" and self.ev2_status != "UNASSIGNED")
        return both_assigned or self.round_number > self.max_rounds


class SlotGameAction(BaseModel):
    action_id: str
    player: str  # "EV1" (MAX) or "EV2" (MIN)
    target_resource: str  # "FAST_BAY", "NORMAL_BAY", "STANDBY_BUFFER"
    expected_power_kw: float
    description: str


class SlotCompetitionResult(BaseModel):
    game_name: str = "TWO_EV_SLOT_COMPETITION"
    algorithm: str = "MINIMAX_WITH_ALPHA_BETA_PRUNING"
    ev1_optimal_action: SlotGameAction
    minimax_utility: float
    nodes_evaluated: int
    alpha_cutoffs: int
    beta_cutoffs: int
    execution_time_ms: float
    game_trace: List[Dict[str, Any]]
    explanation: str


class SlotCompetitionGame:
    """
    Simulates resource contention between two competing EVs for limited charging bays.
    EV1 seeks to maximize its competitive advantage / charging speed.
    EV2 seeks to maximize its own utility (minimizing EV1's relative margin in zero-sum framing).
    """

    def __init__(self, max_rounds: int = 2):
        self.max_rounds = max_rounds
        self.nodes_evaluated = 0
        self.alpha_cutoffs = 0
        self.beta_cutoffs = 0
        self.trace: List[Dict[str, Any]] = []

    def get_available_actions(self, state: SlotGameState) -> List[SlotGameAction]:
        player = "EV1" if state.is_ev1_turn else "EV2"
        actions = []

        # Can claim Fast bay if unallocated
        if state.fast_bay_claimed_by is None:
            actions.append(SlotGameAction(
                action_id=f"ACT_{player}_CLAIM_FAST",
                player=player,
                target_resource="FAST_BAY",
                expected_power_kw=150.0,
                description=f"{player} claims the premium 150 kW DC Fast Charging Bay."
            ))

        # Can claim Normal bay if unallocated
        if state.normal_bay_claimed_by is None:
            actions.append(SlotGameAction(
                action_id=f"ACT_{player}_CLAIM_NORMAL",
                player=player,
                target_resource="NORMAL_BAY",
                expected_power_kw=22.0,
                description=f"{player} claims the 22 kW AC Normal Charging Bay."
            ))

        # Buffer standby is always available
        actions.append(SlotGameAction(
            action_id=f"ACT_{player}_ENTER_BUFFER",
            player=player,
            target_resource="STANDBY_BUFFER",
            expected_power_kw=0.0,
            description=f"{player} yields and enters the standby buffer to wait."
        ))

        return actions

    def apply_action(self, state: SlotGameState, action: SlotGameAction) -> SlotGameState:
        next_st = state.model_copy(deep=True)
        player = action.player
        res = action.target_resource

        next_st.history.append(f"{player} -> {res}")

        if player == "EV1":
            next_st.ev1_status = res
            if res == "FAST_BAY":
                next_st.fast_bay_claimed_by = "EV1"
            elif res == "NORMAL_BAY":
                next_st.normal_bay_claimed_by = "EV1"
            next_st.is_ev1_turn = False
        else:
            next_st.ev2_status = res
            if res == "FAST_BAY":
                next_st.fast_bay_claimed_by = "EV2"
            elif res == "NORMAL_BAY":
                next_st.normal_bay_claimed_by = "EV2"
            next_st.is_ev1_turn = True
            next_st.round_number += 1

        return next_st

    def evaluate(self, state: SlotGameState) -> float:
        """
        Payoff function from perspective of MAX (EV1):
        Utility(EV1) - Utility(EV2)
        Fast Bay = +100 points
        Normal Bay = +40 points
        Buffer Standby = -20 points
        """
        payoffs = {
            "FAST_BAY": 100.0,
            "NORMAL_BAY": 40.0,
            "STANDBY_BUFFER": -20.0,
            "UNASSIGNED": 0.0
        }

        u1 = payoffs.get(state.ev1_status, 0.0)
        u2 = payoffs.get(state.ev2_status, 0.0)

        # Relative utility advantage for EV1 (zero-sum differential)
        return round(u1 - u2, 2)

    def minimax_alpha_beta(
        self,
        state: SlotGameState,
        depth: int,
        alpha: float,
        beta: float,
        is_max: bool
    ) -> Tuple[float, Optional[SlotGameAction]]:
        self.nodes_evaluated += 1

        if state.is_terminal():
            score = self.evaluate(state)
            return score, None

        actions = self.get_available_actions(state)
        if not actions:
            return self.evaluate(state), None

        if is_max:
            max_eval = -float('inf')
            best_action = actions[0]

            for act in actions:
                next_st = self.apply_action(state, act)
                eval_val, _ = self.minimax_alpha_beta(next_st, depth + 1, alpha, beta, is_max=False)

                if eval_val > max_eval:
                    max_eval = eval_val
                    best_action = act

                alpha = max(alpha, eval_val)
                if beta <= alpha:
                    self.alpha_cutoffs += 1
                    self.trace.append({
                        "depth": depth,
                        "type": "ALPHA_PRUNE",
                        "pruned_by": f"beta ({beta}) <= alpha ({alpha})"
                    })
                    break

            return max_eval, best_action
        else:
            min_eval = float('inf')
            best_action = actions[0]

            for act in actions:
                next_st = self.apply_action(state, act)
                eval_val, _ = self.minimax_alpha_beta(next_st, depth + 1, alpha, beta, is_max=True)

                if eval_val < min_eval:
                    min_eval = eval_val
                    best_action = act

                beta = min(beta, eval_val)
                if beta <= alpha:
                    self.beta_cutoffs += 1
                    self.trace.append({
                        "depth": depth,
                        "type": "BETA_PRUNE",
                        "pruned_by": f"beta ({beta}) <= alpha ({alpha})"
                    })
                    break

            return min_eval, best_action

    def solve(self, initial_state: Optional[SlotGameState] = None) -> SlotCompetitionResult:
        start_time = time.perf_counter()
        self.nodes_evaluated = 0
        self.alpha_cutoffs = 0
        self.beta_cutoffs = 0
        self.trace = []

        state = initial_state or SlotGameState()
        best_val, best_action = self.minimax_alpha_beta(
            state=state,
            depth=0,
            alpha=-float('inf'),
            beta=float('inf'),
            is_max=True
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        explanation = (
            f"EV-1 (MAX) optimal decision is '{best_action.action_id}' ({best_action.description}). "
            f"Expected game value: {best_val:.1f} utility margin. "
            f"Evaluated {self.nodes_evaluated} game states with {self.alpha_cutoffs + self.beta_cutoffs} Alpha-Beta cutoffs."
        )

        return SlotCompetitionResult(
            game_name="TWO_EV_SLOT_COMPETITION",
            algorithm="MINIMAX_WITH_ALPHA_BETA_PRUNING",
            ev1_optimal_action=best_action,
            minimax_utility=best_val,
            nodes_evaluated=self.nodes_evaluated,
            alpha_cutoffs=self.alpha_cutoffs,
            beta_cutoffs=self.beta_cutoffs,
            execution_time_ms=round(elapsed_ms, 3),
            game_trace=self.trace,
            explanation=explanation
        )
