/**
 * Classical Artificial Intelligence Decision-Support API Client.
 * Configurable API base URL through environment variables (VITE_API_BASE_URL or VITE_API_URL).
 * Defaults to the Vite dev proxy '/api' or local backend.
 */

const RAW_API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  '/api';

const BASE_URL = RAW_API_URL.replace(/\/+$/, '');

async function handleResponse(res, errorMessage) {
  if (!res.ok) {
    let detail = errorMessage;
    try {
      const errJson = await res.json();
      if (errJson && errJson.detail) {
        detail = typeof errJson.detail === 'string' ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch (_) {
      // Ignore JSON parse error on non-OK responses
    }
    throw new Error(detail);
  }
  return res.json();
}

// =============================================================================
// 1. SIMULATION & CORE ENVIRONMENT STATE
// =============================================================================

export async function fetchState() {
  try {
    const res = await fetch(`${BASE_URL}/state`);
    return await handleResponse(res, 'Unable to connect to the backend simulation service.');
  } catch (err) {
    throw new Error(err.message || 'Simulation state unavailable.');
  }
}

export async function fetchAgentLogs(limit = 50) {
  try {
    const res = await fetch(`${BASE_URL}/agents/logs?limit=${limit}`);
    return await handleResponse(res, 'Unable to fetch multi-agent communication logs.');
  } catch (err) {
    throw new Error(err.message || 'Agent logs unavailable.');
  }
}

export async function stepSimulation(ticks = 1) {
  try {
    const res = await fetch(`${BASE_URL}/tick`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticks })
    });
    return await handleResponse(res, 'Simulation tick progression failed.');
  } catch (err) {
    throw new Error(err.message || 'Simulation tick failed.');
  }
}

export async function resetSimulation(seed = 42) {
  try {
    const res = await fetch(`${BASE_URL}/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed })
    });
    return await handleResponse(res, 'Simulation reset failed.');
  } catch (err) {
    throw new Error(err.message || 'Simulation reset failed.');
  }
}

export async function addEV(evData) {
  try {
    const res = await fetch(`${BASE_URL}/ev/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evData)
    });
    return await handleResponse(res, 'Failed to inject EV request into environment.');
  } catch (err) {
    throw new Error(err.message || 'Failed to add EV.');
  }
}

export async function injectEmergencyEV(data = {}) {
  try {
    const res = await fetch(`${BASE_URL}/ev/emergency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await handleResponse(res, 'Emergency vehicle injection failed.');
  } catch (err) {
    throw new Error(err.message || 'Failed to inject emergency vehicle.');
  }
}

export async function setStrategy(strategyName) {
  try {
    const res = await fetch(`${BASE_URL}/strategy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ strategy: strategyName })
    });
    return await handleResponse(res, 'Failed to update coordination strategy.');
  } catch (err) {
    throw new Error(err.message || 'Failed to set strategy.');
  }
}

export async function toggleStationFault(stationId, isFaulty = true) {
  try {
    const res = await fetch(`${BASE_URL}/station/fault`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_id: stationId, is_faulty: isFaulty })
    });
    return await handleResponse(res, 'Failed to toggle station fault state.');
  } catch (err) {
    throw new Error(err.message || 'Failed to update station state.');
  }
}

// =============================================================================
// 2. UNIT I: FORMAL PROBLEM FORMULATION API
// =============================================================================

export async function formulateProblem(payload) {
  try {
    const res = await fetch(`${BASE_URL}/problem/formulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await handleResponse(res, 'Failed to derive formal problem formulation <S, s0, A, G, C, c>.');
  } catch (err) {
    throw new Error(err.message || 'Problem formulation service unavailable.');
  }
}

// =============================================================================
// 3. UNIT II: SEARCH & ROUTING ALGORITHM APIS
// =============================================================================

export async function fetchSearchNetwork() {
  try {
    const res = await fetch(`${BASE_URL}/search/network`);
    return await handleResponse(res, 'Unable to load topological road network graph.');
  } catch (err) {
    throw new Error(err.message || 'Search network unavailable.');
  }
}

export async function compareSearchAlgorithms(scenario) {
  try {
    const res = await fetch(`${BASE_URL}/search/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario)
    });
    return await handleResponse(res, 'Search algorithm comparison failed.');
  } catch (err) {
    throw new Error(err.message || 'Failed to run search comparison.');
  }
}

export async function recommendStation(scenario) {
  try {
    const res = await fetch(`${BASE_URL}/search/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scenario)
    });
    return await handleResponse(res, 'Station search optimization failed.');
  } catch (err) {
    throw new Error(err.message || 'Failed to find optimal station.');
  }
}

// =============================================================================
// 4. UNIT III: CONSTRAINT SATISFACTION (CSP) SCHEDULING APIS
// =============================================================================

export async function fetchCSPScenarios() {
  try {
    const res = await fetch(`${BASE_URL}/csp/scenarios`);
    return await handleResponse(res, 'Unable to fetch CSP contention scenarios.');
  } catch (err) {
    throw new Error(err.message || 'CSP scenarios unavailable.');
  }
}

export async function solveCSPSchedule(config) {
  try {
    const res = await fetch(`${BASE_URL}/csp/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return await handleResponse(res, 'CSP Backtracking solver failed.');
  } catch (err) {
    throw new Error(err.message || 'Failed to solve CSP schedule.');
  }
}

// =============================================================================
// 5. UNIT III: GAME THEORY & CONFLICT RESOLUTION APIS
// =============================================================================

export async function fetchNegotiationScenarios() {
  try {
    const res = await fetch(`${BASE_URL}/negotiation/scenarios`);
    return await handleResponse(res, 'Unable to load game-theoretic negotiation scenarios.');
  } catch (err) {
    throw new Error(err.message || 'Negotiation scenarios unavailable.');
  }
}

export async function resolveNegotiation(scenarioId) {
  try {
    const res = await fetch(`${BASE_URL}/negotiation/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId })
    });
    return await handleResponse(res, 'Multi-agent conflict resolution failed.');
  } catch (err) {
    throw new Error(err.message || 'Failed to resolve negotiation.');
  }
}

export async function runMinimaxCompetition(maxRounds = 2) {
  try {
    const res = await fetch(`${BASE_URL}/game/slot-competition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ max_rounds: maxRounds })
    });
    return await handleResponse(res, 'Minimax slot competition solver failed.');
  } catch (err) {
    throw new Error(err.message || 'Failed to solve Minimax game tree.');
  }
}

// =============================================================================
// 6. UNIT IV: KNOWLEDGE BASE & LOGICAL INFERENCE APIS
// =============================================================================

export async function fetchFacts() {
  try {
    const res = await fetch(`${BASE_URL}/kb/facts`);
    return await handleResponse(res, 'Unable to retrieve Knowledge Base facts.');
  } catch (err) {
    throw new Error(err.message || 'Facts repository unavailable.');
  }
}

export async function fetchRules() {
  try {
    const res = await fetch(`${BASE_URL}/kb/rules`);
    return await handleResponse(res, 'Unable to retrieve First-Order production rules.');
  } catch (err) {
    throw new Error(err.message || 'Rules repository unavailable.');
  }
}

export async function queryPriority(evId) {
  try {
    const res = await fetch(`${BASE_URL}/kb/query/priority`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ev_id: evId })
    });
    return await handleResponse(res, `Failed to derive priority for vehicle ${evId}.`);
  } catch (err) {
    throw new Error(err.message || 'Priority query failed.');
  }
}

export async function querySafeCharging(evId, stationId) {
  try {
    const res = await fetch(`${BASE_URL}/kb/query/safe_charging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ev_id: evId, station_id: stationId })
    });
    return await handleResponse(res, 'Safe charging verification query failed.');
  } catch (err) {
    throw new Error(err.message || 'Safe charging query failed.');
  }
}

export async function triggerForwardChaining() {
  try {
    const res = await fetch(`${BASE_URL}/kb/forward_chain`, {
      method: 'POST'
    });
    return await handleResponse(res, 'Forward chaining inference cycle failed.');
  } catch (err) {
    throw new Error(err.message || 'Forward chaining failed.');
  }
}

export async function runResolutionProver(theoremPreset = 'EMERGENCY_PREEMPTION') {
  try {
    const res = await fetch(`${BASE_URL}/logic/resolution-prove`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theorem_preset: theoremPreset })
    });
    return await handleResponse(res, 'Resolution refutation theorem prover failed.');
  } catch (err) {
    throw new Error(err.message || 'Theorem proving failed.');
  }
}

export async function runPropositionalDPLL(clauses = null) {
  try {
    const res = await fetch(`${BASE_URL}/logic/dpll/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clauses })
    });
    return await handleResponse(res, 'DPLL SAT solver failed.');
  } catch (err) {
    throw new Error(err.message || 'DPLL solver failed.');
  }
}

// =============================================================================
// 7. UNIT I: MULTI-AGENT ACTIONS & DELIBERATION
// =============================================================================

export async function runAgentDecision(decisionRequest) {
  try {
    const res = await fetch(`${BASE_URL}/agents/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(decisionRequest)
    });
    return await handleResponse(res, 'Agent deliberation action failed.');
  } catch (err) {
    throw new Error(err.message || 'Agent action failed.');
  }
}

// =============================================================================
// 8. UNIT V: FLEET BENCHMARKING & EVALUATION
// =============================================================================

export async function fetchBenchmarkResults(seed = 42) {
  try {
    const res = await fetch(`${BASE_URL}/evaluation/benchmark?seed=${seed}`);
    return await handleResponse(res, 'Empirical fleet benchmark evaluation failed.');
  } catch (err) {
    throw new Error(err.message || 'Evaluation service unavailable.');
  }
}

// =============================================================================
// 9. PRIMARY 8-STEP DECISION WORKFLOW & EXPLANATION PIPELINE
// =============================================================================

export async function executePrimaryWorkflow(workflowRequest) {
  try {
    const res = await fetch(`${BASE_URL}/workflow/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflowRequest)
    });
    return await handleResponse(res, 'Primary AI decision workflow execution failed.');
  } catch (err) {
    throw new Error(err.message || 'Workflow execution failed.');
  }
}

export async function fetchWorkflowExplanation(workflowRequest) {
  try {
    const res = await fetch(`${BASE_URL}/workflow/why-selected`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflowRequest)
    });
    return await handleResponse(res, 'Interactive decision explanation retrieval failed.');
  } catch (err) {
    throw new Error(err.message || 'Decision explanation failed.');
  }
}

export async function fetchDecisionExplanation(decisionId) {
  try {
    const res = await fetch(`${BASE_URL}/explanation/${decisionId}`);
    return await handleResponse(res, `Explanation for decision '${decisionId}' not found.`);
  } catch (err) {
    throw new Error(err.message || 'Explanation record unavailable.');
  }
}

export async function listRecentExplanations(limit = 20) {
  try {
    const res = await fetch(`${BASE_URL}/explanation?limit=${limit}`);
    return await handleResponse(res, 'Failed to retrieve recent decision explanations.');
  } catch (err) {
    throw new Error(err.message || 'Recent explanations unavailable.');
  }
}

// =============================================================================
// 10. DYNAMIC SCENARIO INJECTION
// =============================================================================

export async function fetchDynamicScenarios() {
  try {
    const res = await fetch(`${BASE_URL}/scenarios/list`);
    return await handleResponse(res, 'Failed to fetch dynamic scenarios.');
  } catch (err) {
    throw new Error(err.message || 'Scenarios unavailable.');
  }
}

export async function injectDynamicScenario(scenarioId, seed = 42) {
  try {
    const res = await fetch(`${BASE_URL}/scenarios/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId, seed })
    });
    return await handleResponse(res, `Failed to execute dynamic scenario '${scenarioId}'.`);
  } catch (err) {
    throw new Error(err.message || 'Dynamic scenario injection failed.');
  }
}

