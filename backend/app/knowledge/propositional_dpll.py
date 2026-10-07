import time
from typing import List, Dict, Set, Optional, Tuple, Any
from pydantic import BaseModel, Field


class DPLLResult(BaseModel):
    is_satisfiable: bool
    model: Dict[str, bool] = Field(default_factory=dict)
    steps_taken: int = 0
    unit_clauses_propagated: int = 0
    pure_symbols_eliminated: int = 0
    execution_time_ms: float = 0.0
    proof_trace: List[str] = Field(default_factory=list)
    explanation: str = ""

    @property
    def decisions_count(self) -> int:
        return self.steps_taken

    @property
    def unit_propagations_count(self) -> int:
        return self.unit_clauses_propagated

    @property
    def pure_symbol_eliminations_count(self) -> int:
        return self.pure_symbols_eliminated

    @property
    def backtracks_count(self) -> int:
        return max(0, self.steps_taken - self.unit_clauses_propagated - self.pure_symbols_eliminated)

    @property
    def decision_trace(self) -> List[str]:
        return self.proof_trace


class DPLLSolver:
    """
    Propositional satisfiability (DPLL) used as a consistency check on charging rules.
    Implements the Davis-Putnam-Logemann-Loveland (DPLL) Algorithm for CNF SAT verification.
    """

    def __init__(self):
        self.steps = 0
        self.unit_propagations = 0
        self.pure_eliminations = 0
        self.trace: List[str] = []

    @classmethod
    def solve(cls, cnf_clauses: List[List[str]], symbols: Optional[List[str]] = None) -> DPLLResult:
        instance = cls()
        return instance.run(cnf_clauses, symbols)

    def run(self, cnf_clauses: List[List[str]], symbols: Optional[List[str]] = None) -> DPLLResult:
        start_time = time.perf_counter()
        self.steps = 0
        self.unit_propagations = 0
        self.pure_eliminations = 0
        self.trace = []

        if symbols is None:
            # Extract symbols from clauses (handling ~ or -)
            sym_set = set()
            for clause in cnf_clauses:
                for lit in clause:
                    clean = lit.lstrip('~').lstrip('-')
                    if clean:
                        sym_set.add(clean)
            symbols = sorted(list(sym_set))

        self.trace.append(f"Starting DPLL with {len(cnf_clauses)} clauses and symbols: {symbols}")

        sat, model = self._dpll(cnf_clauses, symbols, {})
        exec_time = round((time.perf_counter() - start_time) * 1000.0, 3)

        if sat:
            explanation = (
                f"Propositional Formula is SATISFIABLE (Safe). Proved consistent in {self.steps} steps "
                f"({self.unit_propagations} unit propagations, {self.pure_eliminations} pure symbol rules)."
            )
        else:
            explanation = (
                f"Propositional Formula is UNSATISFIABLE (Invariant Violation). Conflict detected in {self.steps} steps."
            )

        return DPLLResult(
            is_satisfiable=sat,
            model=model if sat else {},
            steps_taken=self.steps,
            unit_clauses_propagated=self.unit_propagations,
            pure_symbols_eliminated=self.pure_eliminations,
            execution_time_ms=exec_time,
            proof_trace=self.trace,
            explanation=explanation
        )

    def _dpll(
        self,
        clauses: List[List[str]],
        symbols: List[str],
        model: Dict[str, bool]
    ) -> Tuple[bool, Dict[str, bool]]:
        self.steps += 1

        # 1. Check if all clauses are satisfied in the current model
        all_true = True
        for clause in clauses:
            res = self._check_clause(clause, model)
            if res is False:
                return False, {}  # Clause is definitely False in current model -> conflict
            if res is None:
                all_true = False

        if all_true:
            return True, model

        # 2. Unit Clause Heuristic: Find a clause with exactly one unassigned literal (all other false)
        for clause in clauses:
            unassigned_lits = []
            clause_sat = False
            for lit in clause:
                val = self._eval_literal(lit, model)
                if val is True:
                    clause_sat = True
                    break
                elif val is None:
                    unassigned_lits.append(lit)

            if not clause_sat and len(unassigned_lits) == 1:
                unit_lit = unassigned_lits[0]
                is_neg = unit_lit.startswith('~') or unit_lit.startswith('-')
                sym = unit_lit.lstrip('~').lstrip('-')
                val_to_assign = not is_neg

                self.unit_propagations += 1
                self.trace.append(f"Unit Propagation: Clause {clause} forced {sym} = {val_to_assign}")

                new_symbols = [s for s in symbols if s != sym]
                new_model = model.copy()
                new_model[sym] = val_to_assign
                return self._dpll(clauses, new_symbols, new_model)

        # 3. Pure Symbol Heuristic: Symbol appearing with only one polarity in unresolved clauses
        for sym in list(symbols):
            pos_found = False
            neg_found = False

            for clause in clauses:
                if self._check_clause(clause, model) is True:
                    continue  # Ignore satisfied clauses
                for lit in clause:
                    clean = lit.lstrip('~').lstrip('-')
                    if clean == sym:
                        if lit.startswith('~') or lit.startswith('-'):
                            neg_found = True
                        else:
                            pos_found = True

            if pos_found and not neg_found:
                self.pure_eliminations += 1
                self.trace.append(f"Pure Symbol: {sym} appears only positively -> set {sym} = True")
                new_symbols = [s for s in symbols if s != sym]
                new_model = model.copy()
                new_model[sym] = True
                return self._dpll(clauses, new_symbols, new_model)
            elif neg_found and not pos_found:
                self.pure_eliminations += 1
                self.trace.append(f"Pure Symbol: {sym} appears only negatively -> set {sym} = False")
                new_symbols = [s for s in symbols if s != sym]
                new_model = model.copy()
                new_model[sym] = False
                return self._dpll(clauses, new_symbols, new_model)

        # 4. Branching on first remaining symbol
        if not symbols:
            return False, {}

        first_sym = symbols[0]
        rest_symbols = symbols[1:]

        # Try True
        self.trace.append(f"Branching: Trying {first_sym} = True")
        model_true = model.copy()
        model_true[first_sym] = True
        sat_t, res_m_t = self._dpll(clauses, rest_symbols, model_true)
        if sat_t:
            return True, res_m_t

        # Try False
        self.trace.append(f"Branching: Trying {first_sym} = False")
        model_false = model.copy()
        model_false[first_sym] = False
        return self._dpll(clauses, rest_symbols, model_false)

    def _eval_literal(self, literal: str, model: Dict[str, bool]) -> Optional[bool]:
        is_neg = literal.startswith('~') or literal.startswith('-')
        sym = literal.lstrip('~').lstrip('-')
        if sym not in model:
            return None
        val = model[sym]
        return not val if is_neg else val

    def _check_clause(self, clause: List[str], model: Dict[str, bool]) -> Optional[bool]:
        has_unassigned = False
        for lit in clause:
            val = self._eval_literal(lit, model)
            if val is True:
                return True
            if val is None:
                has_unassigned = True
        if has_unassigned:
            return None
        return False


PropositionalDPLL = DPLLSolver
