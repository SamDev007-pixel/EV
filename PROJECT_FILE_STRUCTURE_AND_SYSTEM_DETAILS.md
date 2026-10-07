# Intelligent EV Charging & Resource Management System

## File Structure and System Specifications

This document is the codebase map: what every directory and module is for, the full REST surface, and
the build/test/run commands. For algorithm detail and evaluation results see
[`DOCUMENTATION.md`](DOCUMENTATION.md); for a quick start see [`README.md`](README.md).

**Version 1.0 · 62 backend modules · 21 test files (124 tests) · 22 frontend source files**

---

## Table of Contents

1. [Repository Layout](#1-repository-layout)
2. [Backend Module Inventory](#2-backend-module-inventory)
3. [Frontend Module Inventory](#3-frontend-module-inventory)
4. [REST API Surface](#4-rest-api-surface)
5. [Build, Test and Run](#5-build-test-and-run)
6. [Configuration](#6-configuration)
7. [Conventions](#7-conventions)

---

## 1. Repository Layout

```text
Intelligent EV Charging & Resource Management System/
├── README.md                                   # Quick start and overview
├── DOCUMENTATION.md                            # Technical documentation
├── PROJECT_FILE_STRUCTURE_AND_SYSTEM_DETAILS.md # This file: codebase map and API surface
├── start.bat                                   # Windows one-click launcher
├── start.ps1                                   # PowerShell launcher
├── docs/
│   └── convert_doc_to_word.py                  # Renders DOCUMENTATION.md to .docx (optional tooling)
├── backend/
│   ├── requirements.txt
│   ├── run.py                                  # Uvicorn entry point (port 8000)
│   ├── .env.example
│   ├── scripts/
│   │   └── verify_all_algorithms.py            # Standalone algorithm smoke verification
│   ├── app/
│   │   ├── main.py                             # FastAPI application factory and CORS setup
│   │   ├── api/routes.py                       # All REST endpoints under /api
│   │   ├── core/                               # PEAS spec, 8-step workflow, unified pipeline
│   │   ├── models/                             # Pydantic domain schemas
│   │   ├── problem/                            # Formal problem formulation
│   │   ├── simulation/                         # Seeded discrete-event simulation
│   │   ├── agents/                             # Multi-agent layer and message broker
│   │   ├── knowledge/                          # Facts, rules, chaining, resolution, DPLL
│   │   ├── search/                             # Graph search algorithms and station selection
│   │   ├── optimization/                       # Local search
│   │   ├── csp/                                # Constraint satisfaction scheduling
│   │   ├── game_theory/                        # Bargaining, adversarial search, utilities
│   │   ├── scenarios/                          # Injectable events
│   │   ├── evaluation/                         # Policy benchmark
│   │   ├── explanation/                        # Decision registry
│   │   └── services/                           # Static public station dataset
│   └── tests/                                  # 21 test files, 124 tests
└── frontend/
    ├── package.json
    ├── vite.config.js                          # Dev server on 5173, proxies /api to :8000
    ├── .env.example                            # VITE_API_BASE_URL
    ├── index.html
    └── src/
        ├── main.jsx                            # React entry point
        ├── App.jsx                             # Layout, hash routing, environment polling
        ├── index.css                           # Design-system layer
        ├── services/api.js                     # Single API client (env-configurable base URL)
        └── components/
            ├── index.js                        # Barrel exports
            ├── common/                         # Header, Sidebar
            ├── map/                            # Leaflet map canvas and location helper
            └── views/                          # 10 page components
```

---

## 2. Backend Module Inventory

### 2.1 `app/core/` — orchestration

| File | Purpose |
| :--- | :--- |
| `peas.py` | PEAS specification of the coordinator agent (performance measure, environment, actuators, sensors) and the metric accumulator the simulation updates. |
| `workflow.py` | The 8-step decision workflow: request → formulation → knowledge reasoning → search → CSP → conflict resolution → final decision → explanation. Every step is computed from the live environment, and the steps are asserted to agree with one another. |
| `pipeline.py` | Unified pipeline that runs the same chain and records each stage that contributed to the outcome. |
| `__init__.py` | Re-exports the public core API. |

### 2.2 `app/api/` — HTTP layer

| File | Purpose |
| :--- | :--- |
| `routes.py` | Every endpoint, grouped: environment, vehicles, network, formulation, search, CSP, knowledge, logic, agents, game theory, scenarios, evaluation, workflow, explanation, PEAS. All AI endpoints return the same `input / algorithm / result / metrics / explanation` envelope. |

### 2.3 `app/models/` — domain schemas

| File | Purpose | Key fields |
| :--- | :--- | :--- |
| `ev.py` | Electric vehicle | Capacity, current/required charge, charging rate, arrival, deadline, priority, status, assignment, measured cost/wait/travel |
| `station.py` | Charging station | Location, operator, address, coordinates, charger list, power, tariff and currency, operating status, metadata source |
| `charger.py` | Charger unit | Type (`AC_SLOW`, `DC_FAST`, `ULTRA_FAST`), maximum power, current status, assignment, active power |
| `grid.py` | Transformer node | Maximum capacity, current load, derived status thresholds |
| `energy_resource.py` | Generation/storage resource | Resource type, available power, cost, availability status |
| `session.py` | Charging session | Vehicle, charger, energy delivered, timing, cost |

Models use camelCase field names with snake_case aliases and populate-by-name, so a model can be
constructed from either naming convention while API responses stay consistent.

### 2.4 `app/search/` — search and station selection

| File | Purpose |
| :--- | :--- |
| `graph.py` | Charging network graph built from the live station list, with road waypoints and edges; each station is connected to the nearest road nodes so no station is isolated. Exposes `read_station_field()` for alias-safe field access. |
| `problem.py` | Search problem definition and state (goal test, successors, step cost, state key). |
| `algorithms.py` | BFS, DFS, UCS, Greedy Best-First and A*, each returning path, path cost, nodes explored and runtime. |
| `heuristics.py` | Admissible heuristics (straight-line distance) used by GBFS and A*. |
| `station_selector.py` | Runs all five algorithms on one scenario, compares them, and selects the station from the search result. |
| `and_or_search.py` | AND-OR graph search for contingency plans under nondeterministic outcomes. |
| `belief_search.py` | Belief-state search for partially observable settings. |
| `online_search.py` | LRTA* online search where the environment is not fully known up front. |

### 2.5 `app/csp/` — constraint satisfaction

| File | Purpose |
| :--- | :--- |
| `variables.py` | CSP variable (one per vehicle), domain value (station, charger, start, duration, power) and assignment. |
| `constraints.py` | The eight hard constraints: charger exclusivity, station power capacity, transformer capacity, departure deadline, per-vehicle power limit, connector compatibility, minimum energy availability, station operational status. |
| `solver.py` | Backtracking search with switchable MRV, LCV, forward checking and AC-3; full instrumentation (domains, checks, backtracks, prunes) and a node/time search budget. |
| `evaluator.py` | Weighted utility used to rank feasible schedules (wait, distance, cost, grid stress, utilisation, priority). |
| `scenarios.py` | Seven preset instances used to demonstrate solver behaviour, including an infeasible one that AC-3 refutes before search. |

### 2.6 `app/knowledge/` — representation and inference

| File | Purpose |
| :--- | :--- |
| `fact_base.py` | Triple store `(subject, predicate, value)` with per-fact provenance. |
| `rule.py` | Production rule representation (conditions, conclusion, description). |
| `inference_engine.py` | Forward chaining to a fixed point and backward chaining with a proof trace. |
| `kb.py` | The knowledge base: seven domain rules, fact synchronisation from the simulation, and the query helpers. |
| `resolution.py` | Propositional resolution refutation over CNF clause sets, with a derived-clause trace. |
| `propositional_dpll.py` | DPLL satisfiability with unit propagation and pure symbol elimination. |

### 2.7 `app/game_theory/` — strategic decisions

| File | Purpose |
| :--- | :--- |
| `utility_models.py` | Stakeholder utility functions expressed over decision alternatives. |
| `negotiation.py` | Nash bargaining product with Pareto filtering over the alternative set. |
| `alternatives.py` | Alternative generation for a conflict scenario. |
| `scenarios.py` | Preset conflict scenarios (immediate charging vs transformer overload, renewable vs wait, queue vs extra travel). |
| `adversarial.py` | Two-player zero-sum Minimax with alpha-beta pruning, counting alpha and beta cut-offs separately. |
| `slot_competition.py` | Charging-slot bidding as an adversarial game. Secondary demonstration; it does not feed the core charging decision. |

### 2.8 `app/agents/` — multi-agent layer

| File | Purpose |
| :--- | :--- |
| `base_agent.py` | Common agent contract: perception, decision, action and communication. |
| `ev_agent.py` | Represents a vehicle's state, deadline and priority. |
| `station_agent.py` | Charger queues, status and power allocation. |
| `grid_agent.py` | Transformer load monitoring and overload warnings. |
| `energy_agent.py` | Available generation and storage. |
| `coordinator_agent.py` | Arbitrates between the other agents' proposals. |
| `message_broker.py` | Message routing and the communication log, with ACL-style performatives. |

### 2.9 `app/simulation/` — environment

| File | Purpose |
| :--- | :--- |
| `engine.py` | Seeded discrete-event simulation: builds the 450 kW transformer, the 22-station/76-charger catalogue, the initial vehicle set; advances time; enforces the four scheduling policies; updates the PEAS metric counters. |

### 2.10 Supporting packages

| File | Purpose |
| :--- | :--- |
| `app/problem/formulation.py` | Builds the formal problem model: initial state, actions, goal test, step cost. |
| `app/optimization/local_search.py` | Hill climbing with random restarts and simulated annealing. |
| `app/scenarios/scenario_engine.py` | Five injectable events; each reports the measured state before and after and only claims effects the code actually produces. |
| `app/evaluation/benchmark.py` | Runs the four scheduling policies on identical seeded environments and measures wait, travel, cost, utilisation, overloads, peak load, completions and unit price. |
| `app/explanation/service.py` | Decision registry: stores a decision with its inputs, alternatives, metrics, reasoning and derivation trace, retrievable by decision id. |
| `app/services/custom_station_dataset.py` | Bundled static snapshot of public station metadata (19 stations) plus the documented INR→USD conversion used for tariffs. |

### 2.11 `tests/`

21 files, 124 tests. Beyond per-module tests, two files are notable:

| File | Purpose |
| :--- | :--- |
| `test_audit_regressions.py` | Regression spine: each test corresponds to a defect that was reproduced and fixed (search state key, forward-chaining subjects, workflow consistency, CSP budgets, route deduplication, data provenance). |
| `test_evaluation.py` | Asserts measured invariants of the benchmark (policies differ, metrics are not constants, the same seed reproduces the run) rather than superiority claims. |

---

## 3. Frontend Module Inventory

`frontend/src/` — 22 source files.

| Path | Purpose |
| :--- | :--- |
| `main.jsx` | React entry point. |
| `App.jsx` | Layout, hash-based routing for the 10 pages, environment polling, global error banner. |
| `index.css` | Design-system layer: light theme tokens, card/table/badge primitives. |
| `services/api.js` | The only place network calls are made. Base URL from `VITE_API_BASE_URL`; errors are converted to messages from the HTTP response so no stack trace reaches the user. |
| `components/index.js` | Barrel exports. |
| `components/common/Header.jsx` | Title bar and environment clock/state. |
| `components/common/Sidebar.jsx` | Navigation for the 10 pages, with a methodology note. |
| `components/map/MapView.jsx` | Leaflet map canvas: stations, vehicles, user pins. |
| `components/map/CurrentLocation.jsx` | Browser geolocation helper (user input; no external service). |
| `components/views/DashboardView.jsx` | Environment snapshot, the eight workflow stages, algorithm inventory. |
| `components/views/EVRequestView.jsx` | Request form; executes the full workflow and renders each step. |
| `components/views/StationSearchView.jsx` | Station network view composed with the map. |
| `components/views/LiveNetworkMap.jsx` | Map plus a station/charger table read from `/api/state`. |
| `components/views/SearchComparisonView.jsx` | Side-by-side comparison of all five search algorithms. |
| `components/views/CSPSchedulerView.jsx` | CSP scenario selector, solver metrics and the resulting schedule. |
| `components/views/LogicReasoningView.jsx` | Facts, rules, forward/backward chaining, resolution and DPLL. |
| `components/views/AgentActivityView.jsx` | Agent roles, action log and the PEAS panel. |
| `components/views/PEASMatrixView.jsx` | PEAS specification and measured metrics from `/api/peas`. |
| `components/views/AgentNegotiationLogView.jsx` | Conflict alternatives, Nash product and the game decision. |
| `components/views/DecisionExplanationView.jsx` | Stored decision trace by decision id. |
| `components/views/SystemEvaluationView.jsx` | Measured policy comparison and the scenario runner. |

**Design rules applied:** light theme, flat surfaces, no decorative gradients or glassmorphism, no
gauges or cockpit styling, no fabricated telemetry. Every data-driven page implements loading, empty,
error and success states.

---

## 4. REST API Surface

All endpoints are mounted under `/api`; 56 operations are registered. Interactive documentation is
available at `/docs` while the server runs.

| Group | Endpoints |
| :--- | :--- |
| **Environment** | `GET /state`, `GET /health`, `POST /tick`, `POST /reset`, `POST /strategy` |
| **Vehicles** | `POST /ev/add`, `POST /ev/emergency`, `GET /evs`, `POST /evs`, `GET /evs/{ev_id}`, `PUT /evs/{ev_id}` |
| **Network** | `GET /stations`, `GET /stations/{station_id}`, `GET /chargers`, `GET /grid`, `GET /resources`, `GET /sessions`, `POST /station/fault` |
| **Formulation** | `POST /problem/formulate` |
| **Search** | `POST /search/solve`, `POST /search/compare`, `GET /search/network`, `POST /search/and-or-plan`, `POST /search/belief-state`, `POST /search/lrta-step` |
| **CSP** | `POST /csp/solve`, `GET /csp/scenarios` |
| **Knowledge** | `GET /kb/facts`, `GET /kb/rules`, `POST /kb/forward_chain`, `POST /kb/query/priority`, `POST /kb/query/safe_charging` |
| **Logic** | `POST /logic/forward-chain`, `POST /logic/backward-chain`, `POST /logic/resolution-prove`, `POST /logic/dpll/solve`, `POST /logic/dpll-verify` |
| **Agents** | `GET /agents`, `POST /agents/decision`, `GET /agents/logs`, `GET /agents/station-master/details` |
| **Game theory** | `POST /negotiation/resolve`, `GET /negotiation/scenarios`, `POST /game/decision`, `POST /game/slot-competition` |
| **Scenarios** | `GET /scenarios/list`, `POST /scenarios/run` |
| **Evaluation** | `GET /evaluation/benchmark` |
| **Optimisation** | `POST /optimization/schedule` |
| **Workflow** | `POST /workflow/execute`, `POST /workflow/why-selected`, `POST /pipeline/decide` |
| **Explanation** | `GET /explanation/{decision_id}`, `GET /explanation` |
| **Reference** | `GET /peas` |

**Alias routes.** `POST /search/solve` and `POST /search/recommend-station` are the same handler, as are
`POST /search/compare` and `POST /search/compare-algorithms`, and `POST /logic/resolution-prove` and
`POST /logic/resolution/prove`. A test asserts that alias paths return the same payload as their
canonical route, because duplicates handing out different response shapes was a real defect.

**Response envelope** for AI endpoints:

```json
{
  "input":      { "...": "the request as received" },
  "algorithm":  "name of the algorithm that ran",
  "result":     { "...": "the decision or proof" },
  "metrics":    { "...": "node counts, constraint checks, runtime - measured this run" },
  "explanation": "plain-language summary derived from the measured values"
}
```

---

## 5. Build, Test and Run

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m pytest tests/ -v                           # 124 tests
python -m uvicorn app.main:app --reload --port 8000  # or: python run.py
```

Optional standalone verification of the algorithm suite:

```bash
python scripts/verify_all_algorithms.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # dev server on http://localhost:5173
npm run build      # production bundle in dist/
```

### Windows launcher

`start.bat` (or `start.ps1`) installs dependencies if needed and starts the backend and frontend
together.

### Optional: Word export

`docs/convert_doc_to_word.py` renders `DOCUMENTATION.md` to a `.docx` file. It needs `python-docx`,
which is deliberately not part of `backend/requirements.txt` because the application does not depend on
it:

```bash
pip install python-docx
python docs/convert_doc_to_word.py
```

---

## 6. Configuration

| Variable | File | Default | Effect |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `frontend/.env` | `/api` | API base URL used by the client. Components never hardcode a host. |
| `SIMULATION_SEED` | `backend/.env` | `42` | Default seed for the simulation; the same seed reproduces a run. |

No API keys are required and no outbound network calls are made. Station metadata is bundled with the
repository. See `backend/.env.example` and `frontend/.env.example`.

---

## 7. Conventions

**Data naming.** Models expose camelCase names with snake_case aliases. Because `model_dump()` emits the
alias form, any code reading a serialised model uses `read_station_field()` (search graph) or the
equivalent helper rather than assuming one naming convention. This class of mismatch was the cause of a
defect where station attributes silently read as `None`.

**Measured, not asserted.** Metric fields are populated from an algorithm's own instrumentation for that
run. Where a value cannot be measured (for example, average travel distance for a policy that assigned
no station), the field is `null` and the interface shows "n/a" rather than inventing a number.

**Honest failure.** A bounded search that runs out of budget reports the instance as *unknown*, not
infeasible. A request that cannot be satisfied reports `FAILED` constraint verdicts and a score of zero.
An effect that the code does not compute is not described in an explanation.

**Provenance.** Every fact and every dataset field is tagged with its origin: static public metadata,
simulated data, user input, or classical AI computation.

**No machine learning.** No learned weights, no model-serving dependencies, no generative AI. Every
output is traceable to an algorithm whose steps can be printed and re-executed.
