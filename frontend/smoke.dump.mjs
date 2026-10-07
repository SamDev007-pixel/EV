import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
const API = 'http://127.0.0.1:8000/api';
const screen = process.argv[2];
const state = await (await fetch(`${API}/state`)).json();
const logs = await (await fetch(`${API}/agents/logs?limit=50`)).json();
const bundle = readFileSync('/tmp/smoke-dist/smoke.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: `http://localhost:5173/?screen=${screen}`, pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
window.process = { env: {} }; window.global = window;
window.__SMOKE_STATE = state; window.__SMOKE_LOGS = logs;
const rf = globalThis.fetch;
window.fetch = (u, o) => rf(typeof u === 'string' && u.startsWith('/api') ? API + u.slice(4) : u, o);
window.console.error = () => {}; window.console.warn = () => {};
window.eval(bundle);
await new Promise((r) => setTimeout(r, 4000));
const text = (window.document.body.textContent || '').replace(/\s+/g, ' ').trim();
console.log(text.slice(0, 2600));
console.log('\n--- table rows:', window.document.querySelectorAll('tbody tr').length,
            '| stat tiles:', window.document.querySelectorAll('.stat').length,
            '| cards:', window.document.querySelectorAll('.ai-card').length,
            '| tabs:', window.document.querySelectorAll('.tab').length,
            '| empty states:', window.document.querySelectorAll('.state').length);
