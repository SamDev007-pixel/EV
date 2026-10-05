from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from app.knowledge.fact_base import FactBase, Fact
from app.knowledge.rule import Rule, Condition, Conclusion


class ExplanationStep(BaseModel):
    step_number: int
    step_type: str        # FACT_MATCH, RULE_EVALUATION, RULE_FIRED, DERIVED_CONCLUSION, GOAL_SUBPROVED
    description: str
    rule_id: Optional[str] = None
    supporting_facts: List[str] = Field(default_factory=list)


class InferenceResult(BaseModel):
    query: str
    result: Any
    is_success: bool = True
    derived_facts: List[Dict[str, Any]] = Field(default_factory=list)
    rules_applied: List[str] = Field(default_factory=list)
    explanation_trace: List[ExplanationStep] = Field(default_factory=list)


class InferenceEngine:
    @staticmethod
    def forward_chain(fact_base: FactBase, rules: List[Rule], subjects: List[str]) -> InferenceResult:
        """
        Data-driven Forward Chaining.
        Evaluates facts against rule antecedents to infer all new logical conclusions until fixpoint.
        """
        explanation_trace: List[ExplanationStep] = []
        rules_applied: List[str] = []
        derived_facts: List[Fact] = []
        step_counter = 1

        explanation_trace.append(ExplanationStep(
            step_number=step_counter,
            step_type="INITIALIZATION",
            description=f"Initialized Forward Chaining with {len(fact_base.facts)} base facts and {len(rules)} rules across subjects: {subjects}"
        ))
        step_counter += 1

        changed = True
        max_iterations = 10
        iteration = 0

        while changed and iteration < max_iterations:
            changed = False
            iteration += 1

            for subj in subjects:
                for rule in rules:
                    # Check if rule conclusion is already asserted
                    target_pred = rule.conclusion.predicate
                    target_val = rule.conclusion.value
                    existing_val = fact_base.get_value(subj, target_pred)

                    if existing_val == target_val:
                        continue  # Already known

                    # Evaluate rule conditions for this subject
                    all_matched = True
                    matching_facts = []

                    for cond in rule.conditions:
                        # Determine subject to check
                        c_subj = subj
                        actual_val = fact_base.get_value(c_subj, cond.predicate)

                        if actual_val is None and cond.subject_param == "?grid":
                            # Check grid subject
                            c_subj = "GRID-TRANSFORMER-MAIN"
                            actual_val = fact_base.get_value(c_subj, cond.predicate)

                        matched = cond.evaluate(actual_val)
                        if matched:
                            fact_obj = fact_base.get_fact(c_subj, cond.predicate)
                            if fact_obj:
                                matching_facts.append(str(fact_obj))
                        else:
                            all_matched = False
                            break

                    if all_matched:
                        # Rule FIRED!
                        new_fact = fact_base.assert_fact(
                            subject=subj,
                            predicate=target_pred,
                            value=target_val,
                            source=f"FORWARD_CHAINING:{rule.id}"
                        )
                        derived_facts.append(new_fact)
                        rules_applied.append(rule.id)
                        changed = True

                        explanation_trace.append(ExplanationStep(
                            step_number=step_counter,
                            step_type="RULE_FIRED",
                            description=f"Rule [{rule.id}] FIRED for {subj}: {rule.name} -> Asserted {new_fact}",
                            rule_id=rule.id,
                            supporting_facts=matching_facts
                        ))
                        step_counter += 1

        return InferenceResult(
            query="FORWARD_CHAINING_ALL",
            result=f"Forward chaining completed in {iteration} iteration(s). Derived {len(derived_facts)} new facts.",
            is_success=True,
            derived_facts=[{"subject": f.subject, "predicate": f.predicate, "value": f.value} for f in derived_facts],
            rules_applied=list(set(rules_applied)),
            explanation_trace=explanation_trace
        )

    @staticmethod
    def backward_chain(
        fact_base: FactBase,
        rules: List[Rule],
        target_subject: str,
        target_predicate: str,
        target_value: Any
    ) -> InferenceResult:
        """
        Goal-driven Backward Chaining.
        Attempts to prove target_subject.target_predicate == target_value.
        """
        explanation_trace: List[ExplanationStep] = []
        rules_applied: List[str] = []
        step_counter = 1

        query_str = f"{target_subject}.{target_predicate} == {target_value}"
        explanation_trace.append(ExplanationStep(
            step_number=step_counter,
            step_type="GOAL_INITIALIZATION",
            description=f"Goal to prove: [{query_str}]"
        ))
        step_counter += 1

        # Step 1: Direct fact lookup
        actual_val = fact_base.get_value(target_subject, target_predicate)
        if actual_val is not None:
            if actual_val == target_value:
                fact_obj = fact_base.get_fact(target_subject, target_predicate)
                explanation_trace.append(ExplanationStep(
                    step_number=step_counter,
                    step_type="FACT_MATCH",
                    description=f"Goal proved directly from Base Fact: {fact_obj}",
                    supporting_facts=[str(fact_obj)]
                ))
                return InferenceResult(
                    query=query_str,
                    result=True,
                    is_success=True,
                    rules_applied=[],
                    explanation_trace=explanation_trace
                )

        # Step 2: Backward rule search
        candidate_rules = [r for r in rules if r.conclusion.predicate == target_predicate and r.conclusion.value == target_value]

        if not candidate_rules:
            explanation_trace.append(ExplanationStep(
                step_number=step_counter,
                step_type="GOAL_DISPROVED",
                description=f"No rules or facts exist to conclude {query_str}"
            ))
            return InferenceResult(
                query=query_str,
                result=False,
                is_success=False,
                rules_applied=[],
                explanation_trace=explanation_trace
            )

        for rule in candidate_rules:
            explanation_trace.append(ExplanationStep(
                step_number=step_counter,
                step_type="RULE_EVALUATION",
                description=f"Evaluating candidate Rule [{rule.id}]: {rule.name}",
                rule_id=rule.id
            ))
            step_counter += 1

            all_antecedents_proved = True
            supporting_facts = []

            for cond in rule.conditions:
                c_subj = target_subject
                c_val = fact_base.get_value(c_subj, cond.predicate)

                if c_val is None and cond.subject_param == "?grid":
                    c_subj = "GRID-TRANSFORMER-MAIN"
                    c_val = fact_base.get_value(c_subj, cond.predicate)

                if cond.evaluate(c_val):
                    fact_obj = fact_base.get_fact(c_subj, cond.predicate)
                    if fact_obj:
                        supporting_facts.append(str(fact_obj))
                        explanation_trace.append(ExplanationStep(
                            step_number=step_counter,
                            step_type="FACT_MATCH",
                            description=f"Antecedent condition met: {cond} -> Actual value: {c_val}",
                            rule_id=rule.id,
                            supporting_facts=[str(fact_obj)]
                        ))
                        step_counter += 1
                else:
                    all_antecedents_proved = False
                    explanation_trace.append(ExplanationStep(
                        step_number=step_counter,
                        step_type="CONDITION_FAILED",
                        description=f"Antecedent condition FAILED: {cond} -> Actual value: {c_val}",
                        rule_id=rule.id
                    ))
                    step_counter += 1
                    break

            if all_antecedents_proved:
                rules_applied.append(rule.id)
                # Assert derived conclusion
                fact_base.assert_fact(target_subject, target_predicate, target_value, source=f"BACKWARD_CHAINING:{rule.id}")

                explanation_trace.append(ExplanationStep(
                    step_number=step_counter,
                    step_type="GOAL_PROVED",
                    description=f"Goal PROVED via Rule [{rule.id}]! Conclusion: {target_subject}.{target_predicate} = {target_value}",
                    rule_id=rule.id,
                    supporting_facts=supporting_facts
                ))

                return InferenceResult(
                    query=query_str,
                    result=True,
                    is_success=True,
                    rules_applied=rules_applied,
                    explanation_trace=explanation_trace
                )

        return InferenceResult(
            query=query_str,
            result=False,
            is_success=False,
            rules_applied=rules_applied,
            explanation_trace=explanation_trace
        )
