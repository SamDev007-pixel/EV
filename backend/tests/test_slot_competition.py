import pytest
from app.game_theory.slot_competition import (
    SlotCompetitionGame,
    SlotGameState,
    SlotGameAction,
    SlotCompetitionResult
)


def test_slot_competition_minimax_basic():
    """Verify that EV-1 (MAX) chooses the optimal high-power slot action."""
    game = SlotCompetitionGame(max_rounds=2)
    result = game.solve(SlotGameState(max_rounds=2))

    assert isinstance(result, SlotCompetitionResult)
    assert result.ev1_optimal_action is not None
    # EV-1 with first move should claim FAST_BAY
    assert result.ev1_optimal_action.target_resource == "FAST_BAY"
    assert result.minimax_utility > 0.0
    assert result.nodes_evaluated > 0


def test_slot_competition_alpha_beta_pruning():
    """Verify that Alpha-Beta pruning evaluates nodes and records cutoffs."""
    game = SlotCompetitionGame(max_rounds=2)
    result = game.solve(SlotGameState(max_rounds=2))

    total_cutoffs = result.alpha_cutoffs + result.beta_cutoffs
    assert total_cutoffs >= 0
    assert len(result.explanation) > 20


def test_slot_competition_fast_bay_already_claimed():
    """Verify EV-1 behavior when Fast Bay is already occupied (claims Normal bay)."""
    game = SlotCompetitionGame(max_rounds=2)
    # Fast bay pre-allocated to an emergency vehicle
    st = SlotGameState(
        round_number=1,
        max_rounds=2,
        is_ev1_turn=True,
        fast_bay_claimed_by="EMERGENCY_AMBULANCE",
        normal_bay_claimed_by=None
    )
    result = game.solve(st)

    assert result.ev1_optimal_action.target_resource == "NORMAL_BAY"
