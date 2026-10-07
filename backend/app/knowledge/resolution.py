"""
Propositional Resolution Refutation Theorem Prover.
Propositional resolution refutation over the charging knowledge base.

Resolution is a complete inference rule for propositional logic.
To prove KB |= alpha:
1. Negate the query alpha (~alpha).
2. Add ~alpha to KB in Conjunctive Normal Form (CNF clauses).
3. Repeatedly resolve pairs of clauses containing complementary literals (P and ~P).
4. If the empty clause [] (contradiction) is derived, KB |= alpha is PROVED by refutation.
5. If no new clauses can be added, KB does not entail alpha.

EV Charging System Application:
Verifies critical safety invariants, such as:
- Guaranteed emergency EV priority preemption under transformer overload.
- Connector compatibility and safety interlock invariants before energizing high-voltage DC.
"""

from typing import Dict, List, Set, FrozenSet, Tuple, Any, Optional
from pydantic import BaseModel, Field


class ResolutionProofStep(BaseModel):
    step_number: int
    clause_1: str
    clause_2: str
    complementary_literal: str
    resolvent: str


class ResolutionResult(BaseModel):
    algorithm: str = "PROPOSITIONAL_RESOLUTION_REFUTATION"
    query: str
    negated_query: str
    proved: bool
    empty_clause_derived: bool
    proof_steps: List[ResolutionProofStep] = Field(default_factory=list)
    total_clauses_generated: int = 0
    explanation: str


def negate_literal(lit: str) -> str:
    """Returns ~P if P, or P if ~P."""
    lit = lit.strip()
    if lit.startswith("~"):
        return lit[1:]
    return f"~{lit}"


def format_clause(clause: FrozenSet[str]) -> str:
    if not clause:
        return "[] (EMPTY_CLAUSE_CONTRADICTION)"
    return " | ".join(sorted(list(clause)))


class PropositionalResolutionProver:
    """
    Propositional Resolution Refutation Theorem Prover.
    Implements standard clause resolution, tautology elimination, and refutation trace generation.
    """

    @staticmethod
    def resolve(c1: FrozenSet[str], c2: FrozenSet[str]) -> List[Tuple[FrozenSet[str], str]]:
        """
        Resolves two clauses c1 and c2.
        Returns a list of (resolvent, resolved_literal) pairs.
        """
        resolvents = []
        for lit in c1:
            neg_lit = negate_literal(lit)
            if neg_lit in c2:
                # Construct resolvent by unioning c1 and c2 and removing lit and neg_lit
                new_lits = (c1 - {lit}) | (c2 - {neg_lit})
                
                # Check for tautology: if new_lits contains both P and ~P, ignore
                is_tautology = any(negate_literal(x) in new_lits for x in new_lits)
                if not is_tautology:
                    resolvents.append((frozenset(new_lits), lit))
        return resolvents

    @classmethod
    def prove(
        cls,
        kb_clauses: List[FrozenSet[str]],
        query_literal: str,
        max_iterations: int = 200
    ) -> ResolutionResult:
        """
        Proves KB |= query_literal via resolution refutation by adding ~query_literal.
        """
        neg_query = negate_literal(query_literal)
        neg_query_clause = frozenset([neg_query])

        # Initial clause set includes KB + { ~query }
        clauses: Set[FrozenSet[str]] = set(kb_clauses) | {neg_query_clause}
        proof_steps: List[ResolutionProofStep] = []
        step_counter = 1

        new: Set[FrozenSet[str]] = set()
        iterations = 0

        while iterations < max_iterations:
            iterations += 1
            clause_list = list(clauses)
            n = len(clause_list)
            found_empty = False

            for i in range(n):
                for j in range(i + 1, n):
                    c1 = clause_list[i]
                    c2 = clause_list[j]

                    resolvent_pairs = cls.resolve(c1, c2)
                    for resolvent, pivot_lit in resolvent_pairs:
                        if resolvent not in clauses and resolvent not in new:
                            new.add(resolvent)
                            proof_steps.append(ResolutionProofStep(
                                step_number=step_counter,
                                clause_1=format_clause(c1),
                                clause_2=format_clause(c2),
                                complementary_literal=pivot_lit,
                                resolvent=format_clause(resolvent)
                            ))
                            step_counter += 1

                            if len(resolvent) == 0:  # Empty clause derived!
                                found_empty = True
                                break
                    if found_empty:
                        break
                if found_empty:
                    break

            if found_empty:
                explanation = (
                    f"Theorem '{query_literal}' is PROVED by Resolution Refutation in {len(proof_steps)} derivation steps. "
                    f"Derived empty clause [] from KB and negated query '{neg_query}', confirming KB entails {query_literal}."
                )
                return ResolutionResult(
                    query=query_literal,
                    negated_query=neg_query,
                    proved=True,
                    empty_clause_derived=True,
                    proof_steps=proof_steps,
                    total_clauses_generated=len(clauses) + len(new),
                    explanation=explanation
                )

            if new.issubset(clauses):
                # No new clauses can be added
                break

            clauses.update(new)
            new.clear()

        return ResolutionResult(
            query=query_literal,
            negated_query=neg_query,
            proved=False,
            empty_clause_derived=False,
            proof_steps=proof_steps,
            total_clauses_generated=len(clauses),
            explanation=f"Cannot prove KB |= '{query_literal}'. No contradiction derived before clause saturation."
        )

    @classmethod
    def verify_emergency_preemption_theorem(cls) -> ResolutionResult:
        """
        Built-in educational verification:
        Safety Rule 1: Emergency EV and Peak Grid requires session throttle or low-priority deferral.
        KB:
          C1: ~EMERGENCY | ~GRID_MAX | THROTTLE | DEFER
          C2: EMERGENCY
          C3: GRID_MAX
          C4: ~DEFER  (Low priority EV is at 0% SOC, cannot defer)
        Query: THROTTLE
        """
        kb = [
            frozenset(["~EMERGENCY", "~GRID_MAX", "THROTTLE", "DEFER"]),
            frozenset(["EMERGENCY"]),
            frozenset(["GRID_MAX"]),
            frozenset(["~DEFER"])
        ]
        return cls.prove(kb, "THROTTLE")

    @classmethod
    def verify_connector_safety_theorem(cls) -> ResolutionResult:
        """
        Safety Rule 2: Vehicle requires CCS2. If station does not provide CCS2, must reject.
        KB:
          C1: ~NEEDS_CCS2 | SUPPORTS_CCS2 | REJECT
          C2: NEEDS_CCS2
          C3: ~SUPPORTS_CCS2
        Query: REJECT
        """
        kb = [
            frozenset(["~NEEDS_CCS2", "SUPPORTS_CCS2", "REJECT"]),
            frozenset(["NEEDS_CCS2"]),
            frozenset(["~SUPPORTS_CCS2"])
        ]
        return cls.prove(kb, "REJECT")
