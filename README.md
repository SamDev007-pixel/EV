# Intelligent EV Charging & Resource Management System

A decision-support platform that assigns electric vehicles to charging stations, schedules charging
sessions, and explains every decision it makes. All reasoning is symbolic and deterministic: graph
search, constraint satisfaction, rule-based inference and game theory. There is no machine learning
anywhere in the system.

**Status:** backend 124 automated tests passing · frontend production build passing

---

## 1. Overview

When many EVs charge at once, the practical problems are: the local transformer can be overloaded,
drivers queue at the most convenient hub while other hubs sit idle, and the four parties involved
(driver, station operator, grid operator, energy supplier) want different things.

This system answers a single question — *given a vehicle's state, deadline and priority, where should
it charge, when, and at what power?* — and then shows the full chain of reasoning that produced the
answer. Every stage is a classical algorithm that can be re-run and inspected, so the output is
reproducible and auditable rather than a black-box score.

---

## 2. What the system does

Pipeline, in execution order:

1. **Problem formulation** — the request becomes a formal model: states, actions, goal test, step cost.
2. **Knowledge reasoning** — facts about the request, the grid and the stations are asserted into a
   rule base; forward chaining derives conclusions, backward chaining proves the priority.
3. **Search** — BFS, DFS, UCS, Greedy Best-First and A* all run on the same live network graph and are
   compared on path cost, nodes expanded and runtime; the selected station comes from the search
   result, not from a preference list.
4. **Constraint satisfaction** — a backtracking CSP assigns station, charger and time slot for the
   requesting vehicle while other vehicles compete for the same chargers. MRV, LCV, forward checking
   and AC-3 are switchable so their effect can be measured.
5. **Conflict resolution** — when two vehicles are scheduled onto the same resource, the competing
   options are evaluated with agent utilities and the Nash bargaining product.
6. **Final decision** — station, route, slot, expected wait and duration, plus an explicit PASSED or
   FAILED verdict for each hard constraint.
7. **Explanation** — facts, fired rules, search result, constraint verdicts and the derivation chain
   are stored under a decision id and can be retrieved later.

A second, independent use of the same modules is **scheduling policy comparison**: four policies
(FCFS, nearest-station, priority, and the grid-safe policy) are each run in an identical seeded
simulation and measured against one another.

---

## 3. PEAS specification

| Component | Description |
| :--- | :--- |
| **Performance measure** | Minimise average waiting time; keep modelled transformer load below its rating; maximise charger utilisation; serve emergency-priority vehicles first; meet departure deadlines. All five are counted from the running simulation. |
| **Environment** | 22 stations / 76 chargers on a road-network graph. Station metadata is a static public-dataset snapshot; occupancy, faults, queue state and grid load are simulated. |
| **Actuators** | Station and charger assignment; charging time slot; session power limit (kW); emergency queue pre-emption; deferral when transformer headroom runs out. |
| **Sensors** | Request fields (state of charge, deadline, priority, connector, location) as user input; charger and station status; transformer load; and the knowledge base built from those facts. No physical sensor or vehicle hardware exists — all inputs are form data and simulation state. |

The environment is partially observable (future arrivals and station faults are unknown when the agent
plans), sequential, dynamic and discrete. The simulation is seeded, so a given seed reproduces a run
exactly; that reproducibility is covered by a test.

---

## 4. Architecture

```text
├── backend/
│   ├── app/
│   │   ├── core/           # PEAS specification, 8-step workflow engine, unified pipeline
│   │   ├── models/         # Pydantic domain schemas (EV, Station, Charger, Grid, Energy)
│   │   ├── problem/        # Formal problem formulation <S, s0, A, G, C, c>
│   │   ├── simulation/     # Seeded discrete-event simulation of the charging network
│   │   ├── agents/         # Multi-agent layer (EV, Station, Grid, Energy, Coordinator) + message broker
│   │   ├── knowledge/      # Fact base, production rules, forward/backward chaining, resolution, DPLL
│   │   ├── search/         # BFS, DFS, UCS, GBFS, A*, AND-OR, belief-state and online search
│   │   ├── optimization/   # Hill climbing and simulated annealing
│   │   ├── csp/            # Backtracking CSP: MRV, LCV, forward checking, AC-3, 8 hard constraints
│   │   ├── game_theory/    # Nash bargaining, Minimax with alpha-beta pruning, slot competition
│   │   ├── scenarios/      # Five injectable events with measured before/after state
│   │   ├── evaluation/     # Policy benchmark measured from seeded simulation runs
│   │   └── api/            # REST API (/api/...)
│   └── tests/              # 124 automated tests
└── frontend/               # React (Vite) decision-support interface, 10 pages
```

---

## 5. Algorithms

**Problem formulation** — request to formal model: initial state, action set, goal test, step cost
`c(s, a, s')`.

**Multi-agent layer** — agents with explicit roles communicate through a message broker using ACL-style
performatives (`REQUEST`, `INFORM`, `PROPOSE`, `ACCEPT_PROPOSAL`, `REJECT_PROPOSAL`, `CFP`, `FAILURE`).
The coordinator combines proposals into a schedule.

- `EV Agent`: battery state, budget, deadline.
- `Station Agent`: charger queues, `OPERATIONAL`/`FAULT` status, power allocation.
- `Grid Agent`: transformer load and overload warnings.
- `Energy Agent`: available generation and storage.
- `Coordinator Agent`: arbitrates between the above.

**Search** — uninformed (BFS, DFS, UCS) and informed (Greedy Best-First, A* with an admissible
straight-line heuristic) over the station graph. AND-OR graph search for contingency plans,
belief-state search for partial observability, and LRTA* for online search.

**Local search** — hill climbing with random restarts and simulated annealing.

**Constraint satisfaction** — variables are (station, charger, start time, power) tuples. The eight
hard constraints are `NoChargerOverlap`, `StationPowerCapacity`, `GridTransformerCapacity`,
`DepartureDeadline`, `EVMaxPowerLimit`, `ChargerCompatibility`, `EnergyAvailability`,
`OperationalStation`. Solutions are ranked by a weighted utility over waiting time, travel distance,
energy cost, grid stress and priority, so the solver returns the best schedule found rather than the
first one.

**Game theory** — cooperative: Nash bargaining product `N(a) = Π max(0, U_i(a) − d_i)` with Pareto
filtering. Adversarial: two-player Minimax with alpha-beta pruning for contested charging slots.

**Knowledge representation and inference** — a fact base of `(subject, predicate, value)` triples, seven
production rules, forward chaining to a fixed point, backward chaining with a proof trace,
propositional resolution refutation, and a DPLL satisfiability checker with unit propagation and pure
symbol elimination.

---

## 6. Setup

**Prerequisites:** Python 3.10+, Node.js 18+.

```bash
# Backend
cd backend
pip install -r requirements.txt
python -m pytest tests/ -v            # 124 tests
python -m uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`; interactive API documentation at `http://localhost:8000/docs`.

```bash
# Frontend
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`. The dev server proxies `/api` to the backend; for other
deployments set `VITE_API_BASE_URL` (see `frontend/.env.example`).

---

## 7. Injectable events

Five scenarios, each runnable with an explicit seed, each reporting the measured state before and
after:

1. **Peak demand spike** — 15 extra vehicles arrive at once; forward chaining is re-run and a candidate
   CSP schedule is computed from the live post-spike state.
2. **Station failure** — a station is set to `FAULT`; vehicles assigned there are re-assigned by the
   search-based selector using the live network, so the failed station is no longer a candidate.
3. **Grid capacity restriction** — the transformer rating is lowered while the simulation is running;
   the scenario controller throttles standard-priority sessions and leaves priority sessions untouched.
4. **Emergency arrival** — an emergency vehicle is added; forward chaining fires the priority rules and
   an occupied ultra-fast charger is pre-empted if one exists.
5. **Renewable availability** — the modelled solar resource is raised. This changes availability only;
   no source-switching or cost re-optimisation is claimed for this path.

---

## 8. Measured evaluation

Four policies are each run in a fresh, identically seeded simulation (seed 42, 180 simulated minutes,
12 synthetic vehicles added to the 4 seeded ones):

| Policy | Avg wait (min) | Avg travel (km) | Avg cost ($/EV) | Utilisation (%) | Overload incidents | Peak load (kW) | Completed |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FCFS | 1.0 | 3.41 | 8.22 | 4.7 | 29 | 1232 | 16/16 |
| Nearest station | 1.0 | 1.38 | 7.80 | 6.2 | 47 | 782 | 16/16 |
| Simple priority | 1.0 | 3.34 | 8.24 | 4.7 | 32 | 1192 | 16/16 |
| **Grid-safe policy** | 19.1 | 1.40 | 7.84 | 7.4 | **0** | **414** | 15/16 |

Reading this honestly: the grid-safe policy is the only one that records **zero** transformer overload
incidents, and it has the lowest energy price per kWh, but it **does not dominate**. Its cost is a much
longer average wait (sessions are deferred rather than admitted) and, at this horizon, one fewer
completed vehicle. The baselines look fast only because they admit everything immediately and let the
transformer overload.

These figures are produced by `GET /api/evaluation/benchmark` and are reproducible for a fixed seed.
Station metadata in the simulation is a static snapshot of public station records; occupancy, faults
and battery levels are simulated, not field telemetry.

---

## 9. Limitations

1. **Simulated occupancy and faults.** The dynamic state is generated by a seeded simulation; only the
   station metadata (location, operator, ports, published tariff) comes from public records.
2. **Static graph weights.** Road edges carry fixed distance/time costs; live traffic is not modelled.
3. **Policy benchmark scope.** The four-policy comparison measures scheduling policies in the
   simulation. The search, CSP, logic and game-theory modules are demonstrated and measured on their own
   pages — they are not what produces the benchmark table.
4. **Bounded CSP search.** The solver has a node and wall-clock budget. If an instance exhausts the
   budget it reports the instance as unknown rather than claiming it is infeasible.
5. **No vehicle-to-grid.** Discharging is out of scope; the CSP power domain is charging only.

---

## 10. Scope: no machine learning

This system contains **no machine learning, deep learning, neural networks, LLM or generative AI**, and
the project does not depend on PyTorch, TensorFlow, scikit-learn or any model-serving API.

Every decision is produced by an algorithm whose steps can be printed and re-executed: search expands
named nodes, the CSP reports its assignment and constraint checks, the rule engine reports which rules
fired, and the game-theory modules report the utilities and the chosen alternative. Nothing is inferred
from training data.
