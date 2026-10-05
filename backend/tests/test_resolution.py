import pytest
from app.knowledge.resolution import (
    PropositionalResolutionProver,
    ResolutionResult,
    negate_literal,
    format_clause
)


def test_negate_literal_and_format():
    assert negate_literal("EMERGENCY") == "~EMERGENCY"
    assert negate_literal("~EMERGENCY") == "EMERGENCY"
    clause = frozenset(["B", "A"])
    assert format_clause(clause) == "A | B"
    assert "EMPTY_CLAUSE" in format_clause(frozenset())


def test_resolution_emergency_preemption_theorem():
    """Verify that resolution refutation proves emergency preemption safety invariant."""
    result = PropositionalResolutionProver.verify_emergency_preemption_theorem()

    assert isinstance(result, ResolutionResult)
    assert result.proved is True
    assert result.empty_clause_derived is True
    assert result.query == "THROTTLE"
    assert result.negated_query == "~THROTTLE"
    assert len(result.proof_steps) > 0

    # Ensure empty clause [] is the final resolvent
    last_step = result.proof_steps[-1]
    assert "EMPTY_CLAUSE" in last_step.resolvent or "[]" in last_step.resolvent


def test_resolution_connector_safety_theorem():
    """Verify that resolution refutation proves connector incompatibility rejection."""
    result = PropositionalResolutionProver.verify_connector_safety_theorem()

    assert result.proved is True
    assert result.empty_clause_derived is True
    assert result.query == "REJECT"


def test_resolution_unprovable_query():
    """Verify that if KB does not entail query, no contradiction is derived."""
    # KB: P -> Q. Query: R (completely unrelated)
    kb = [
        frozenset(["~P", "Q"]),
        frozenset(["P"])
    ]
    result = PropositionalResolutionProver.prove(kb, "R")
    assert result.proved is False
    assert result.empty_clause_derived is False
