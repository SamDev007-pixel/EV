import pytest
from app.knowledge.propositional_dpll import PropositionalDPLL, DPLLResult


def test_dpll_satisfiable_simple():
    # (P or Q) and (not P or Q)
    clauses = [
        ["P", "Q"],
        ["-P", "Q"]
    ]
    res = PropositionalDPLL.solve(clauses)

    assert isinstance(res, DPLLResult)
    assert res.is_satisfiable is True
    assert res.model.get("Q") is True
    assert "SATISFIABLE" in res.explanation


def test_dpll_unsatisfiable_contradiction():
    # P and not P
    clauses = [
        ["P"],
        ["-P"]
    ]
    res = PropositionalDPLL.solve(clauses)

    assert res.is_satisfiable is False
    assert res.model == {}
    assert "UNSATISFIABLE" in res.explanation


def test_dpll_unit_propagation():
    # Unit clause ["Safe"] must propagate
    clauses = [
        ["Safe"],
        ["-Safe", "Operational"],
        ["-Operational", "ChargerAvailable"]
    ]
    res = PropositionalDPLL.solve(clauses)

    assert res.is_satisfiable is True
    assert res.unit_propagations_count >= 1
    assert res.model.get("Safe") is True
    assert res.model.get("Operational") is True
    assert res.model.get("ChargerAvailable") is True


def test_dpll_pure_symbol():
    # Pure symbol "Positive" only appears as positive literal
    clauses = [
        ["Positive", "A"],
        ["Positive", "-A"]
    ]
    res = PropositionalDPLL.solve(clauses)

    assert res.is_satisfiable is True
    assert res.pure_symbol_eliminations_count >= 1
    assert res.model.get("Positive") is True
