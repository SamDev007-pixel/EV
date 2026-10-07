// Runs the built harness in jsdom against each screen and reports render/runtime errors.
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const API = 'http://127.0.0.1:8000/api';
const screens = (process.env.SCREENS || 'dashboard,ev_request,station_search,search_comparison,scheduling,knowledge_logic,agents,conflict_decision,explanation,evaluation').split(',');

const state = await (await fetch(`${API}/state`)).json();
const logs = await (await fetch(`${API}/agents/logs?limit=50`)).json();
const bundle = readFileSync('/tmp/smoke-dist/smoke.js', 'utf8');

let failures = 0;
for (const screen of screens) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    url: `http://localhost:5173/?screen=${screen}`,
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.process = { env: { NODE_ENV: 'production' } };
  window.global = window;
  window.__SMOKE_STATE = state;
  window.__SMOKE_LOGS = logs;

  const problems = [];
  const realFetch = globalThis.fetch;
  window.fetch = (url, opts) =>
    realFetch(typeof url === 'string' && url.startsWith('/api') ? API + url.slice(4) : url, opts);
  window.console.error = (...args) => {
    const text = args.map(String).join(' ');
    if (text.includes('not wrapped in act')) return;
    problems.push(text);
  };
  window.console.warn = () => {};
  window.addEventListener('error', (e) => problems.push('window error: ' + e.message));
  window.HTMLElement.prototype.scrollIntoView = () => {};

  try {
    window.eval(bundle);
  } catch (err) {
    problems.push('bundle threw: ' + err.message);
  }

  await new Promise((r) => setTimeout(r, 3500));

  const text = (window.document.body.textContent || '').replace(/\s+/g, ' ');
  const rootEmpty = (window.document.getElementById('root')?.childElementCount ?? 0) === 0;
  const status = problems.length === 0 && !rootEmpty ? 'OK  ' : 'FAIL';
  if (status === 'FAIL') failures += 1;
  console.log(`${status} ${screen.padEnd(18)} chars=${String(text.length).padStart(5)}  ${rootEmpty ? '(nothing rendered)' : ''}`);
  for (const p of problems.slice(0, 4)) console.log('      ! ' + p.slice(0, 700));
  dom.window.close();
}
console.log(failures === 0 ? '\nAll screens rendered without errors.' : `\n${failures} screen(s) reported errors.`);
process.exit(failures === 0 ? 0 : 1);
