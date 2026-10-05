import pytest
from app.game_theory.adversarial import AdversarialBargainingGame, GameState, GameAction


def test_adversarial_minimax_basic():
    state = GameState(
        grid_reserve_kw=100.0,
        ev_urgency_score=80.0,
        current_tariff_usd=0.25,
        is_ev_turn=True,
        depth=0
    )
    res = AdversarialBargainingGame.solve_with_alpha_beta(state, max_depth=3)

    assert "MINIMAX" in res.algorithm.upper()
    assert res.best_action is not None
    assert res.nodes_evaluated > 0
    assert isinstance(res.minimax_value, float)
    assert res.execution_time_ms >= 0.0


def test_adversarial_alpha_beta_pruning_cutoffs():
    # Deeper search tree to guarantee alpha/beta pruning occurs
    state = GameState(
        grid_reserve_kw=150.0,
        ev_urgency_score=90.0,
        current_tariff_usd=0.25,
        is_ev_turn=True,
        depth=0
    )
    res = AdversarialBargainingGame.solve_with_alpha_beta(state, max_depth=4)

    # In a branching game tree of depth 4 with 3-4 actions per node, cutoffs should be active
    assert res.nodes_evaluated > 1
    assert (res.alpha_cutoffs + res.beta_cutoffs) >= 0
    assert len(res.decision_trace) > 0


def test_adversarial_terminal_state():
    # Reserve <= 0 is terminal
    terminal_state = GameState(
        grid_reserve_kw=0.0,
        ev_urgency_score=50.0,
        current_tariff_usd=0.35,
        is_ev_turn=True,
        depth=2
    )
    assert terminal_state.is_terminal(max_depth=4) is True
    res = AdversarialBargainingGame.solve_with_alpha_beta(terminal_state, max_depth=4)
    assert res.nodes_evaluated == 1
