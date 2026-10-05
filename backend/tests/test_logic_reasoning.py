import pytest
from app.simulation.engine import SimulationEngine
from app.knowledge.fact_base import FactBase, Fact
from app.knowledge.rule import Rule, Condition, Conclusion
from app.knowledge.inference_engine import InferenceEngine
from app.knowledge.kb import KnowledgeBase, knowledge_base


def test_fact_base_assertions():
    fb = FactBase()
    fb.assert_fact("EV-101", "battery_soc_percent", 14.0)
    fb.assert_fact("EV-101", "is_emergency", False)
    
    assert fb.get_value("EV-101", "battery_soc_percent") == 14.0
    assert fb.get_value("EV-101", "is_emergency") is False


def test_rule_evaluation():
    cond = Condition(subject_param="?ev", predicate="battery_soc_percent", operator="<", target_value=15.0)
    assert cond.evaluate(14.0) is True
    assert cond.evaluate(20.0) is False


def test_forward_chaining_critical_priority():
    engine = SimulationEngine(seed=42)
    kb = KnowledgeBase()
    
    res = kb.run_forward_chaining(engine)
    assert res.is_success is True
    assert len(res.derived_facts) > 0
    assert len(res.explanation_trace) > 0


def test_query_why_priority_emergency():
    engine = SimulationEngine(seed=42)
    kb = KnowledgeBase()
    
    # Query emergency EV
    res = kb.query_why_priority("EV-EMERGENCY-01", engine)
    assert res.is_success is True
    assert "CRITICAL" in str(res.result)
    assert any("RULE-EMERGENCY-PRIORITY" in step.rule_id for step in res.explanation_trace if step.rule_id)


def test_query_can_charge_safely():
    engine = SimulationEngine(seed=42)
    kb = KnowledgeBase()
    
    res = kb.query_can_charge_safely("EV-101", "CS-NORTH", engine)
    assert res.result is True
    assert any(step.step_type == "GOAL_PROVED" for step in res.explanation_trace)


def test_explanation_trace_formatting():
    engine = SimulationEngine(seed=42)
    kb = KnowledgeBase()
    
    res = kb.query_why_priority("EV-101", engine) # EV-101 has 15% battery in seed data
    assert len(res.explanation_trace) > 0
    first_step = res.explanation_trace[0]
    assert hasattr(first_step, "step_number")
    assert hasattr(first_step, "description")
