from typing import List, Dict, Any, Optional
from app.knowledge.fact_base import FactBase, Fact
from app.knowledge.rule import Rule, Condition, Conclusion
from app.knowledge.inference_engine import InferenceEngine, InferenceResult, ExplanationStep


class KnowledgeBase:
    def __init__(self):
        self.fact_base: FactBase = FactBase()
        self.rules: List[Rule] = []
        self._initialize_default_rules()

    def _initialize_default_rules(self):
        """Populate classical AI rule base (Units I-IV logical reasoning)."""
        self.rules = [
            # Rule 1: IF EV is emergency THEN chargingPriority = CRITICAL
            Rule(
                id="RULE-EMERGENCY-PRIORITY",
                name="Emergency Vehicle Priority Override",
                description="IF EV is an emergency vehicle (Ambulance/Fire) THEN set charging priority to CRITICAL.",
                conditions=[
                    Condition(subject_param="?ev", predicate="is_emergency", operator="==", target_value=True)
                ],
                conclusion=Conclusion(subject_param="?ev", predicate="charging_priority", value="CRITICAL")
            ),

            # Rule 2: IF batteryLevel < 15.0 THEN chargingPriority = CRITICAL
            Rule(
                id="RULE-CRITICAL-BATTERY",
                name="Critical Battery Level Rule",
                description="IF battery SoC level < 15% THEN set charging priority to CRITICAL.",
                conditions=[
                    Condition(subject_param="?ev", predicate="battery_soc_percent", operator="<", target_value=15.0)
                ],
                conclusion=Conclusion(subject_param="?ev", predicate="charging_priority", value="CRITICAL")
            ),

            # Rule 3: IF batteryLevel < 30.0 AND deadline <= 60 min THEN chargingPriority = HIGH
            Rule(
                id="RULE-HIGH-PRIORITY-URGENT",
                name="Low Battery & Near Deadline Rule",
                description="IF battery SoC level < 30% AND departure deadline <= 60 min THEN set charging priority to HIGH.",
                conditions=[
                    Condition(subject_param="?ev", predicate="battery_soc_percent", operator="<", target_value=30.0),
                    Condition(subject_param="?ev", predicate="departure_deadline_min", operator="<=", target_value=60.0)
                ],
                conclusion=Conclusion(subject_param="?ev", predicate="charging_priority", value="HIGH")
            ),

            # Rule 4: IF station operatingStatus != OPERATIONAL THEN station suitability = UNSUITABLE
            Rule(
                id="RULE-STATION-UNAVAILABLE",
                name="Unavailable Station Exclusion",
                description="IF station operating status is NOT OPERATIONAL THEN station is UNSUITABLE for selection.",
                conditions=[
                    Condition(subject_param="?station", predicate="operating_status", operator="!=", target_value="OPERATIONAL")
                ],
                conclusion=Conclusion(subject_param="?station", predicate="suitability", value="UNSUITABLE")
            ),

            # Rule 5: IF available_chargers == 0 THEN station suitability = UNSUITABLE
            Rule(
                id="RULE-STATION-NO-CHARGERS",
                name="Zero Available Chargers Exclusion",
                description="IF available chargers == 0 THEN station is UNSUITABLE.",
                conditions=[
                    Condition(subject_param="?station", predicate="available_chargers", operator="==", target_value=0)
                ],
                conclusion=Conclusion(subject_param="?station", predicate="suitability", value="UNSUITABLE")
            ),

            # Rule 6: IF grid loadPercentage >= 95.0 THEN grid safety = UNSAFE_OVERLOAD
            Rule(
                id="RULE-GRID-SAFETY-OVERLOAD",
                name="Grid Transformer Overload Rule",
                description="IF grid load percentage >= 95% THEN grid status is UNSAFE_OVERLOAD.",
                conditions=[
                    Condition(subject_param="?grid", predicate="load_percentage", operator=">=", target_value=95.0)
                ],
                conclusion=Conclusion(subject_param="?grid", predicate="safety_status", value="UNSAFE_OVERLOAD")
            ),

            # Rule 7: IF station operatingStatus == OPERATIONAL AND available_chargers > 0 AND grid load < 95.0 THEN can_charge_safely = TRUE
            Rule(
                id="RULE-SAFE-CHARGING-CONSENSUS",
                name="Safe Station Charging Consensus Rule",
                description="IF station is OPERATIONAL AND has available chargers AND grid load < 95% THEN safe charging is APPROVED.",
                conditions=[
                    Condition(subject_param="?station", predicate="operating_status", operator="==", target_value="OPERATIONAL"),
                    Condition(subject_param="?station", predicate="available_chargers", operator=">", target_value=0),
                    Condition(subject_param="?grid", predicate="load_percentage", operator="<", target_value=95.0)
                ],
                conclusion=Conclusion(subject_param="?station", predicate="can_charge_safely", value=True)
            )
        ]

    def sync_from_simulation(self, sim_engine):
        """Populate Knowledge Base facts from current simulation environment state."""
        if sim_engine is None:
            return
        self.fact_base.clear()

        # Grid facts
        grid = sim_engine.grid_node
        self.fact_base.assert_fact("GRID-TRANSFORMER-MAIN", "maximum_capacity_kw", grid.maximumCapacity)
        self.fact_base.assert_fact("GRID-TRANSFORMER-MAIN", "current_load_kw", grid.currentLoad)
        self.fact_base.assert_fact("GRID-TRANSFORMER-MAIN", "available_capacity_kw", grid.availableCapacity)
        self.fact_base.assert_fact("GRID-TRANSFORMER-MAIN", "load_percentage", grid.loadPercentage)
        self.fact_base.assert_fact("GRID-TRANSFORMER-MAIN", "operating_status", grid.status.value)

        # Station & Charger facts
        for station in sim_engine.stations.values():
            src = getattr(station, "dataSource", "OPEN_CHARGE_MAP")
            self.fact_base.assert_fact(station.id, "name", station.name, source=src)
            self.fact_base.assert_fact(station.id, "operating_status", station.operatingStatus.value, source=src)
            self.fact_base.assert_fact(station.id, "total_chargers", station.numberOfChargers, source=src)
            self.fact_base.assert_fact(station.id, "charging_power", station.chargingPower, source=src)
            self.fact_base.assert_fact(station.id, "data_source", src, source=src)
            
            avail_c = sum(1 for c in station.chargers if c.currentStatus.value == "AVAILABLE")
            self.fact_base.assert_fact(station.id, "available_chargers", avail_c, source="SIMULATION_ENGINE")
            self.fact_base.assert_fact(station.id, "energy_price", station.energyPrice, source="SIMULATION_ENGINE")
            self.fact_base.assert_fact(station.id, "utilization_percent", station.utilization, source="SIMULATION_ENGINE")

        # EV facts
        for ev in sim_engine.evs.values():
            self.fact_base.assert_fact(ev.id, "battery_capacity_kwh", ev.batteryCapacity)
            self.fact_base.assert_fact(ev.id, "current_battery_kwh", ev.currentBatteryLevel)
            
            soc_pct = round((ev.currentBatteryLevel / max(1.0, ev.batteryCapacity)) * 100.0, 1)
            self.fact_base.assert_fact(ev.id, "battery_soc_percent", soc_pct)
            self.fact_base.assert_fact(ev.id, "arrival_time_min", ev.arrivalTime)
            self.fact_base.assert_fact(ev.id, "departure_deadline_min", ev.departureDeadline)
            self.fact_base.assert_fact(ev.id, "priority", ev.priority.value)
            self.fact_base.assert_fact(ev.id, "is_emergency", ev.priority.value == "EMERGENCY")
            self.fact_base.assert_fact(ev.id, "status", ev.status.value)

    def run_forward_chaining(self, sim_engine=None) -> InferenceResult:
        """Run forward chaining across all active simulation entities."""
        if sim_engine is not None:
            self.sync_from_simulation(sim_engine)
            subjects = list(sim_engine.evs.keys()) + list(sim_engine.stations.keys()) + ["GRID-TRANSFORMER-MAIN"]
        else:
            # `FactBase.facts` is keyed by "subject:predicate", so the stored keys are NOT
            # entity names. Passing them straight to the rule engine meant no antecedent ever
            # resolved and forward chaining derived nothing. Recover the distinct subjects.
            subjects = sorted({fact.subject for fact in self.fact_base.facts.values()})
        return InferenceEngine.forward_chain(self.fact_base, self.rules, subjects)

    def query_why_priority(self, ev_id: str, sim_engine=None) -> InferenceResult:
        """
        Answers query: "Why was EV given priority?"
        Returns reasoning trace, facts matched, and rules applied.
        """
        if sim_engine is not None:
            self.sync_from_simulation(sim_engine)
            if ev_id not in sim_engine.evs:
                return InferenceResult(query=f"Why priority for {ev_id}", result=None, is_success=False)
            self.run_forward_chaining(sim_engine)

        # Try to prove CRITICAL, then HIGH, then STANDARD
        for target_prio in ["CRITICAL", "HIGH", "STANDARD"]:
            res = InferenceEngine.backward_chain(
                self.fact_base, self.rules, ev_id, "charging_priority", target_prio
            )
            if res.result is True:
                res.query = f"Why was {ev_id} given priority {target_prio}?"
                res.result = f"{target_prio} (Proved via rules: {res.rules_applied})"
                return res

        # Default fallback
        return InferenceResult(
            query=f"Why was {ev_id} given priority?",
            result="STANDARD (Default base priority)",
            is_success=True,
            explanation_trace=[
                ExplanationStep(
                    step_number=1,
                    step_type="FACT_MATCH",
                    description=f"EV {ev_id} battery SoC is normal (>30%) and not an emergency vehicle.",
                    supporting_facts=[str(self.fact_base.get_fact(ev_id, "battery_soc_percent"))]
                )
            ]
        )

    def query_can_charge_safely(self, ev_id: str, station_id: str, sim_engine=None) -> InferenceResult:
        """
        Answers query: "Can EV safely charge at Station?"
        Returns TRUE/FALSE, supporting facts, rules applied, and explanation trace.
        """
        if sim_engine is not None:
            self.sync_from_simulation(sim_engine)
        return InferenceEngine.backward_chain(
            self.fact_base, self.rules, station_id, "can_charge_safely", True
        )


# Global Knowledge Base instance
knowledge_base = KnowledgeBase()
