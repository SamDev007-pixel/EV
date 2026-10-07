# Intelligent EV Charging & Resource Management System

## Technical Documentation

A decision-support platform for allocating electric vehicles to charging stations and scheduling their
charging sessions. All reasoning is classical and symbolic — graph search, constraint satisfaction,
rule-based inference and game theory — and every decision is reproducible and explainable. The system
contains no machine learning of any kind.

**Version 1.0 · backends: FastAPI (Python 3.10+) · frontend: React + Vite · tests: 124 passing**

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [PEAS Environment Specification](#3-peas-environment-specification)
4. [Architecture](#4-architecture)
5. [Algorithms](#5-algorithms)
6. [Data Model, Sources and Provenance](#6-data-model-sources-and-provenance)
7. [API Reference](#7-api-reference)
8. [Frontend](#8-frontend)
9. [Simulation and Injectable Events](#9-simulation-and-injectable-events)
10. [Evaluation](#10-evaluation)
11. [Setup and Deployment](#11-setup-and-deployment)
12. [Testing and Verification](#12-testing-and-verification)
13. [Limitations and Scope](#13-limitations-and-scope)
14. [Glossary](#14-glossary)

---

## 1. Executive Summary

Urban fast-charging creates three coupled problems: the local transformer can be overloaded when many
vehicles charge at once; drivers crowd the most convenient hub while other hubs sit idle; and the four
parties involved — driver, station operator, grid operator and energy supplier — want different things.

The system takes one vehicle request (state of charge, target charge, deadline, priority, connector,
location) and produces a decision: **which station, which charger, which time slot, at what power**,
together with a route and an explicit verdict for each hard constraint. It then stores the full
reasoning trace so the decision can be inspected or retrieved later by decision id.

Everything is deterministic. A fixed random seed reproduces a run exactly, and a fixed request
reproduces a decision exactly; both properties are covered by tests. There are no learned weights,
no probability distributions fitted to data, and no model-serving dependencies.

---

## 2. Problem Statement

Given a network of charging stations with a shared transformer capacity, a set of vehicles each with a
battery state, a deadline and a priority, and a set of hard physical and electrical constraints,
produce an assignment and schedule that:

- satisfies every hard constraint (charger exclusivity, station power capacity, transformer capacity,
  deadline, per-vehicle power limit, connector compatibility, minimum delivered energy, station
  operational status);
- does not exceed the transformer rating;
- meets deadlines where physically possible; and
- can be justified step by step.

Naive policies fail in specific, measurable ways: First-Come-First-Served and nearest-station
assignment both admit every vehicle immediately and let the modelled transformer overload, which is why
they record many overload incidents in the benchmark despite looking fast (§10).

---

## 3. PEAS Environment Specification

The PEAS description is served by `GET /api/peas` (source: `backend/app/core/peas.py`) alongside the
metrics the running system actually measures.

| Component | Description |
| :--- | :--- |
| **Performance measure** | Minimise average queuing/charging wait; keep modelled transformer load below its rating; maximise charger utilisation; serve emergency-priority vehicles first; meet deadlines. Each is counted from the simulation, not assumed. |
| **Environment** | 22 stations / 76 chargers on a road-network graph. Station metadata is a static snapshot of public station records; occupancy, faults, queue state and grid load are simulated. |
| **Actuators** | Station and charger assignment; charging time slot; session power (kW); emergency queue pre-emption; deferral when transformer headroom is exhausted. |
| **Sensors** | User-input request fields; charger/station status and transformer load from the environment snapshot; and the knowledge-base facts derived from those by the rule engine. |

**Environment classification** (as returned by the endpoint):

| Property | Value |
| :--- | :--- |
| Observability | Partially observable — future arrivals and station faults are unknown when the agent plans |
| Determinism | Deterministic for a fixed seed; treated as nondeterministic by the agent because future arrivals and faults are unknown in advance |
| Episodicity | Sequential — each scheduling decision changes the state later decisions see |
| Dynamism | Dynamic — the environment keeps changing while the agent deliberates |
| Agents | Multi-agent (EV, station, grid, energy, coordinator) |
| Continuity | Discrete — integer-minute ticks, 15-minute charging slots |

**Hardware note:** this is a software agent. There is no physical sensor, vehicle telemetry unit or
charging hardware anywhere in the system. The "sensors" are form input and simulation state, and the
"actuators" are decisions written into that simulation state.

---

## 4. Architecture

```text
backend/app/
├── core/           PEAS specification; PEAS metrics; 8-step workflow engine; unified pipeline
├── models/         Pydantic schemas: EV, Charger, Station, Grid, EnergyResource, ChargingSession
├── problem/        Formal problem formulation <S, s0, A, G, C, c>
├── simulation/     Seeded discrete-event simulation of the charging network
├── agents/         Agent layer (base, EV, station, grid, energy, coordinator) + message broker
├── knowledge/      Fact base, production rules, forward/backward chaining, resolution, DPLL
├── search/         BFS, DFS, UCS, GBFS, A*, station graph, AND-OR, belief-state, LRTA*
├── optimization/   Hill climbing, simulated annealing
├── csp/            Variables, 8 hard constraints, backtracking solver, utility evaluator, scenarios
├── game_theory/    Nash bargaining, Minimax + alpha-beta, slot competition, utility models
├── scenarios/      Five injectable events with measured before/after state
├── evaluation/     Policy benchmark measured from seeded simulation runs
├── explanation/    Decision registry (explanation records retrievable by decision id)
└── api/            REST endpoints, mounted under /api
```

The **8-step workflow** (`core/workflow.py`) is the main entry point and runs, in order: request
intake → formal formulation → knowledge reasoning → search → CSP scheduling → conflict resolution →
final decision → explanation. Each step's output is derived from the live environment; the steps are
mutually consistent (a test asserts that the station named in step 4 is the station scheduled in step 5
and reported in step 7).

---

## 5. Algorithms

### 5.1 Problem formulation
The request becomes a formal model: initial state, action set, goal test and step cost `c(s, a, s')`.
Served by `POST /api/problem/formulate`; implemented in `app/problem/formulation.py`.

### 5.2 Multi-agent layer
Distinct agents with explicit roles communicate through a message broker using ACL-style performatives
(`REQUEST`, `INFORM`, `PROPOSE`, `ACCEPT_PROPOSAL`, `REJECT_PROPOSAL`, `CFP`, `FAILURE`). The coordinator
arbitrates between proposals.

- **EV agent** — battery state, budget, deadline.
- **Station agent** — charger queues, `OPERATIONAL`/`FAULT` status, power allocation.
- **Grid agent** — transformer load, overload warnings.
- **Energy agent** — available generation and storage.
- **Coordinator agent** — combines proposals into a schedule.

### 5.3 Search
Uninformed and informed search over the station graph: BFS, DFS, UCS, Greedy Best-First and A* with an
admissible straight-line heuristic. All five run on the same live problem and are compared on path cost,
nodes expanded and runtime. A* returns the same cost as UCS on the same instance while expanding fewer
nodes, which is asserted in the test suite.

Additional search modes: AND-OR graph search (contingency plans for nondeterministic outcomes),
belief-state search (partial observability) and LRTA* (online search).

### 5.4 Local search
Hill climbing with random restarts and simulated annealing, exposed through
`POST /api/optimization/schedule` (`app/optimization/local_search.py`).

### 5.5 Constraint satisfaction
A backtracking CSP. Variables are (station, charger, start time, duration, power) tuples.

The **eight hard constraints** are: `NoChargerOverlap`, `StationPowerCapacity`, `GridTransformerCapacity`,
`DepartureDeadline`, `EVMaxPowerLimit`, `ChargerCompatibility`, `EnergyAvailability`, `OperationalStation`.

Heuristics, each individually switchable so its effect can be measured: **MRV** variable ordering with a
degree tie-break, **LCV** value ordering, **forward checking**, and **AC-3** arc consistency before
search. Feasible solutions are ranked by a weighted utility over waiting time, travel distance, energy
cost, grid stress, station utilisation and priority, so the solver returns the best schedule found rather
than the first one.

Search is **bounded** by a node budget and a wall-clock budget. If the budget is exhausted the solver
reports the instance as *unknown* rather than claiming it is infeasible.

Measured behaviour on the seven shipped scenarios (`POST /api/csp/solve`):

| Scenario | Feasible | Backtracks | Constraint checks | Domain values | AC-3 pruned | FC prunes |
| :--- | :---: | ---: | ---: | ---: | ---: | ---: |
| NORMAL_DEMAND | yes | 0 | 5270 | 48 | 0 | 6 |
| CHARGER_SHORTAGE | yes | 0 | 5399 | 42 | 0 | 6 |
| PROPAGATION_INFEASIBLE | **no** | 0 | 142 | 14 | 6 | 0 |
| TIGHT_WINDOW_BACKTRACKING | yes | 0 | 156 | 9 | 6 | 0 |

Note that AC-3 prunes nothing on the first two scenarios — the constraints are already satisfiable
without propagation. `PROPAGATION_INFEASIBLE` is the scenario where AC-3 does the work, eliminating all
values for some variable before search begins.

### 5.6 Game theory
**Cooperative:** Nash bargaining product `N(a) = Π max(0, U_i(a) − d_i)` with Pareto filtering, over
explicit utility functions for the competing stakeholders.

**Adversarial:** two-player zero-sum Minimax with alpha-beta pruning for contested charging slots.
Alpha and beta cut-offs are counted separately and their sum equals the reported total, which is asserted
in the test suite. This module is a secondary demonstration and does not feed the core charging decision.

### 5.7 Knowledge representation and inference
A fact base of `(subject, predicate, value)` triples, seven production rules, and four inference
mechanisms:

- **Forward chaining** — data-driven inference to a fixed point over the live facts.
- **Backward chaining** — goal-driven proof with an explicit trace, used for priority queries.
- **Resolution refutation** — premises converted to CNF, resolution applied, empty clause derived to
  prove a safety theorem.
- **DPLL** — satisfiability checking with unit propagation and pure symbol elimination.

Facts come from four origins, and every fact records which: user request fields, the simulated
environment, geometry (distances computed from coordinates), and conclusions derived by the rules
themselves.

---

## 6. Data Model, Sources and Provenance

Every value in the system belongs to exactly one of four categories, and the API tags them.

| Category | Meaning | Examples |
| :--- | :--- | :--- |
| **Static public metadata** | A snapshot of public station records bundled with the repository. No external API is called at runtime. | Station name, operator, address, coordinates, connector types, port count, published tariff |
| **Simulated data** | Produced by the seeded `SimulationEngine`. | Occupancy, charger status, faults, queue length, transformer load, modelled solar availability, battery levels of non-requesting vehicles |
| **User input** | Supplied by the requesting user. | State of charge, target charge, deadline, priority, connector requirement, location |
| **Classical AI computation** | Derived by an algorithm at request time. | Search paths and costs, CSP assignments and constraint checks, fired rules, inferred facts, Nash products, Minimax values |

**Currency.** Dataset tariffs are published in Indian Rupees per kWh. The simulation uses a single
accounting unit (USD), and the conversion happens once at load time using an explicitly documented fixed
rate (`custom_station_dataset.py`, 1 USD = 85 INR). This prevents mixing units inside a cost
calculation.

**Station catalogue.** 22 stations / 76 chargers: three seed hubs defined in the simulation engine, plus
19 stations from the bundled public-metadata dataset.

**No external services.** The system performs no network calls to map, geocoding, routing or
charging-POI providers. It runs fully offline.

---

## 7. API Reference

All endpoints are mounted under `/api`. Interactive documentation is available at `/docs` when the
server is running. 56 operations are registered.

| Group | Endpoints | Purpose |
| :--- | :--- | :--- |
| Environment | `GET /state`, `GET /health`, `POST /tick`, `POST /reset`, `POST /strategy` | Read and advance the simulation; switch scheduling policy |
| Requests | `POST /ev/add`, `POST /ev/emergency`, `GET|POST /evs`, `GET|PUT /evs/{id}` | Inject and inspect vehicles |
| Network | `GET /stations`, `GET /stations/{id}`, `GET /chargers`, `GET /grid`, `GET /resources`, `GET /sessions` | Read the station/charger/grid/resource inventory |
| Formulation | `POST /problem/formulate` | Build the formal problem model |
| Search | `POST /search/solve`, `POST /search/compare`, `GET /search/network`, `POST /search/and-or-plan`, `POST /search/belief-state`, `POST /search/lrta-step` | Station selection, algorithm comparison and the extended search modes |
| CSP | `POST /csp/solve`, `GET /csp/scenarios` | Schedule vehicles under the eight hard constraints |
| Knowledge | `GET /kb/facts`, `GET /kb/rules`, `POST /kb/forward_chain`, `POST /kb/query/priority`, `POST /kb/query/safe_charging` | Inspect and query the rule base |
| Logic | `POST /logic/forward-chain`, `POST /logic/backward-chain`, `POST /logic/resolution-prove`, `POST /logic/dpll/solve` | Inference, theorem proving and satisfiability |
| Agents | `GET /agents`, `POST /agents/decision`, `GET /agents/logs`, `GET /agents/station-master/details` | Multi-agent decisions and message log |
| Game theory | `POST /negotiation/resolve`, `GET /negotiation/scenarios`, `POST /game/decision`, `POST /game/slot-competition` | Conflict resolution and adversarial slot competition |
| Scenarios | `GET /scenarios/list`, `POST /scenarios/run` | Run an injectable event |
| Evaluation | `GET /evaluation/benchmark` | Measure the four scheduling policies |
| Workflow | `POST /workflow/execute`, `POST /workflow/why-selected`, `POST /pipeline/decide` | The full 8-step chain and its explanation |
| Explanation | `GET /explanation/{decision_id}`, `GET /explanation` | Retrieve a stored decision and its reasoning |
| Reference | `GET /peas` | PEAS specification and measured metrics |

Every AI endpoint returns the same envelope: `input`, `algorithm`, `result`, `metrics`, `explanation`.
Metrics are read from the algorithm's own instrumentation for that run, never from constants.

---

## 8. Frontend

React 18 with Vite and Tailwind, plus a small custom design-system layer (`src/index.css`).

**Design standard:** light theme — near-white background (`#F8FAFC`), white cards, dark navy/slate text,
blue and teal accents. Flat borders and subtle elevation; no gradients as decoration, no glassmorphism,
no glow effects, no gauges or cockpit styling. The interface is a decision-support tool, not a vehicle
dashboard.

**Ten pages** (sidebar navigation):

| # | Page | What it shows |
| :--- | :--- | :--- |
| 1 | Dashboard | Environment snapshot, the eight workflow stages, algorithm inventory |
| 2 | EV Request | Request form; runs the full workflow and shows the per-step result |
| 3 | Station Search | Network map, station/charger table, reachability |
| 4 | Search Comparison | All five algorithms side by side: path cost, nodes expanded, runtime, result |
| 5 | Scheduling (CSP) | Variables, domains, constraint list, solver metrics, schedule timeline |
| 6 | Knowledge & Logic | Facts, rules, forward/backward chaining traces, resolution and DPLL |
| 7 | Agent System | Agent roles and actions, message log, PEAS panel from `/api/peas` |
| 8 | Conflict / Game Decision | Negotiation alternatives, Nash product, game decision |
| 9 | Decision Explanation | The stored decision trace for a decision id |
| 10 | Evaluation | Measured policy comparison and the scenario runner |

**API access:** the base URL comes from `VITE_API_BASE_URL` (default `/api`, proxied by the dev
server). No component hardcodes a host.

**State handling:** every data-driven page implements loading, empty, error and success states. Backend
errors surface as messages derived from the HTTP response; internal stack traces are never exposed.

---

## 9. Simulation and Injectable Events

The simulation is a seeded discrete-event model: a 450 kW transformer, the station catalogue, and
vehicles with battery levels, deadlines and priorities. All five scenarios run against a fresh engine
with an explicit seed and report the measured state before and after.

| Scenario | Event | What is measured |
| :--- | :--- | :--- |
| `SCENARIO_1_PEAK_SPIKE` | 15 additional vehicles arrive at tick 0 | Grid load, queue, wait; forward chaining over the live facts; a CSP schedule computed from the post-spike state (the schedule is reported for inspection, not applied to the running simulation) |
| `SCENARIO_2_STATION_FAILURE` | One station set to `FAULT` | Operational station count; how many vehicles were assigned there and how many were re-assigned by the search-based selector **using the live network** so the failed station is no longer a candidate |
| `SCENARIO_3_GRID_OVERLOAD` | Transformer rating restricted while running | Measured load before/after; the scenario controller throttles standard-priority sessions to 25 kW and leaves priority sessions untouched |
| `SCENARIO_4_EMERGENCY_EV` | Emergency vehicle added (5% battery, 30 min deadline) | Which rules actually fired; whether an occupied ultra-fast charger was available to pre-empt |
| `SCENARIO_5_RENEWABLE_AVAILABILITY` | Modelled solar resource raised | The resource change only. No source-switching or cost re-optimisation is claimed on this path |

Scenario explanations are generated from the measured values. Where an effect is *not* computed, the
explanation says so rather than describing an outcome the code does not produce.

---

## 10. Evaluation

Four scheduling policies are executed one after another in an identical seeded simulation
(`GET /api/evaluation/benchmark`, default seed 42, 180 simulated minutes, 12 synthetic vehicles on top of
the 4 seeded ones):

| Policy | Avg wait (min) | Avg travel (km) | Avg cost ($/EV) | Utilisation (%) | Overloads | Peak load (kW) | Completed | Unit price ($/kWh) |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| FCFS | 1.0 | 3.41 | 8.22 | 4.7 | 29 | 1232 | 16/16 | 0.209 |
| Nearest station | 1.0 | 1.38 | 7.80 | 6.2 | 47 | 782 | 16/16 | 0.199 |
| Simple priority | 1.0 | 3.34 | 8.24 | 4.7 | 32 | 1192 | 16/16 | 0.209 |
| **Grid-safe policy** | 19.1 | 1.40 | 7.84 | 7.4 | **0** | **414** | 15/16 | 0.202 |

**How to read this.** The grid-safe policy is the only one that records zero transformer overload
incidents and it achieves the lowest energy price per kWh, but **it does not dominate the baselines**.
Its cost is a much longer average wait — it defers and throttles sessions instead of admitting
everything — and at this horizon one fewer completed vehicle. The baselines' low wait times are a
consequence of admitting every vehicle immediately and overloading the transformer.

**Scope.** This table compares *scheduling policies* executed inside the simulation. The search, CSP,
logic and game-theory modules are demonstrated and measured on their own pages; they are not what
produces this table, and the benchmark documentation says so.

**Reproducibility.** Policy runs are deterministic for a fixed seed, so the same seed reproduces the
table. Measurements are taken from the running simulation: waiting time per vehicle from the simulation
clock, cost from billed energy, travel distance recorded at assignment time, utilisation sampled every
simulated minute, overload incidents from the grid model.

Two measurement details worth recording, because both were previously wrong:

- Travel distance is captured **at assignment time**. A completed session clears the vehicle's assigned
  station, so a post-run measurement could not recover how far the vehicle drove and silently reported
  zero for the baselines.
- Waiting time is measured per vehicle by the simulation clock. All synthetic vehicles arrive at tick 0,
  so policies that admit on arrival record ~1 minute; the grid-safe policy's deferrals are what produce
  its longer wait.

---

## 11. Setup and Deployment

**Prerequisites:** Python 3.10+, Node.js 18+.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m pytest tests/ -v       # 124 tests
python -m uvicorn app.main:app --reload --port 8000
```

Serves on `http://localhost:8000`; API documentation at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
npm run build                    # production bundle in dist/
```

### Configuration

| Variable | Where | Default | Effect |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `frontend/.env` | `/api` | API base URL used by the client |
| `SIMULATION_SEED` | `backend/.env` | `42` | Default seed for the simulation |

No API keys are required. The application makes no outbound network calls: the station catalogue is
bundled with the repository. See `backend/.env.example` and `frontend/.env.example`.

---

## 12. Testing and Verification

**124 automated tests**, run with `python -m pytest tests/`.

Coverage of the main claims:

| Area | What is asserted |
| :--- | :--- |
| Search soundness | A* returns the same cost as UCS on the same instance while expanding fewer nodes; DFS finds solutions that exist (the state key includes battery and time) |
| CSP | Instrumentation is populated from real runs; `enable_lcv` genuinely changes behaviour; the bounded search reports "unknown" rather than "infeasible" when the budget runs out |
| Workflow | Steps 3–8 agree with each other; faulting the selected station changes the decision; an impossible request scores zero instead of being dressed up |
| Knowledge base | Forward chaining fires rules on live facts; backward chaining returns a proof trace |
| Game theory | Alpha plus beta cut-offs equals the reported total |
| Evaluation | Metrics are measured, not constant; policies behave differently from one another |
| Scenarios | Before/after snapshots are populated; the failed station is never in a reroute target |
| Data integrity | Dataset tariffs are converted once from INR to the accounting unit |
| API surface | Alias paths return the same payload as their canonical route; removed routes are gone |

---

## 13. Limitations and Scope

1. **Simulated dynamic state.** Occupancy, faults, queue state and battery levels are generated by a
   seeded simulation. Only the station metadata is real-world data, and it is a static snapshot.
2. **Static graph weights.** Road edges carry fixed distance and time costs; live traffic is not modelled.
3. **Policy benchmark scope.** The evaluation table measures scheduling policies inside the simulation, not
   the search/CSP/logic modules.
4. **Bounded CSP search.** Very large infeasible instances exhaust the search budget and are reported as
   unknown rather than solved to a conclusion.
5. **No vehicle-to-grid.** Discharging is out of scope; the power domain is charging only.
6. **Single-node server.** The explanation registry is in-memory; decisions do not survive a restart.

**No machine learning.** The system contains no machine learning, deep learning, neural networks, LLM or
generative AI, and does not depend on PyTorch, TensorFlow, scikit-learn or any model-serving API. Every
decision comes from an algorithm whose steps can be printed and re-executed: search expands named nodes,
the CSP reports its assignment and constraint checks, the rule engine reports which rules fired, and the
game-theory modules report the utilities and the chosen alternative. Nothing is inferred from training
data, and no output is generated by a language model.

---

## 14. Glossary

| Term | Meaning |
| :--- | :--- |
| **AC-3** | Arc consistency algorithm 3; removes domain values with no support in a neighbouring variable's domain |
| **Admissible heuristic** | A heuristic that never overestimates the true cost to the goal; required for A* optimality |
| **CSP** | Constraint satisfaction problem — variables, domains and constraints |
| **Decision id** | Identifier under which a decision and its reasoning trace are stored |
| **Forward checking** | Pruning values from unassigned variables' domains immediately after each assignment |
| **GBFS** | Greedy Best-First Search — expands the node that looks closest to the goal |
| **LCV** | Least Constraining Value — value ordering that rules out the fewest options for other variables |
| **MRV** | Minimum Remaining Values — variable ordering that picks the most constrained variable first |
| **Nash product** | Product of the agents' gains over their disagreement points; the alternative maximising it is selected |
| **PEAS** | Performance measure, Environment, Actuators, Sensors — a way of specifying an agent |
| **Transformer headroom** | Difference between the modelled load and the transformer rating |
| **UCS** | Uniform Cost Search — expands the lowest path-cost node; optimal for non-negative costs |

---

*Intelligent EV Charging & Resource Management System — Technical Documentation*
