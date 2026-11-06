// node tests/frontend.mjs — the demo pages in headless Chrome: every state draws without an error and shows what it must,
// and every choice the user makes is sent to the API with the fields contract/API.md names. Exit code 1 on a failure.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9600 + Math.floor(Math.random() * 50);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'cdp-')), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0, errors = []; const pend = {};
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(m.params.type)) errors.push(m.params.args.map(a => a.value ?? a.description).join(' ')); };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await cmd('Runtime.enable'); await cmd('Page.enable');
const run = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval'); return r.result.result.value; };
// the demo answers every POST with ok, sends nothing and keeps what it would have sent in window.S10_DEMO_POSTS
const R = 'document.querySelector("#s10-achievements").shadowRoot';
let failed = 0, passed = 0;
const check = (name, ok, more = '') => { if (ok) passed++; else { failed++; console.log(`FAIL ${name} ${more}`); } };
async function open(file, hash, width = 1440) {
  errors = [];
  await cmd('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: 'about:blank' }); await sleep(80);
  await cmd('Page.navigate', { url: encodeURI('file://' + join(ROOT, file)) + (hash ? '#' + hash : '') }); await sleep(900);
}
const text = sel => run(`(${R}.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
const count = sel => run(`${R}.querySelectorAll(${JSON.stringify(sel)}).length`);
const click = sel => run(`${R}.querySelector(${JSON.stringify(sel)}).click(), true`);

// ---------- every state draws, at the desktop and the phone width ----------
const STATES = {
  'index.html': { '': ['#rank .rname', '#almost .rowc', '#showcase .shw', '#recent .rcard', '#all .bib', '.sstrip'], new: ['#rank .rname', '#almost .empty'], levelup: ['dialog[open] .cel'], rankup: ['dialog[open] .ru'],
    friend: ['.who', '#all .bib'], hidden: ['.state h2'], profile: ['.pfa .pfa-rank', '.pfa .shw'], error: ['#retry'], loading: ['.sk'] },
  'coach.html': { '': ['#rank .rname', '#students .srow', '#showcase .bib', '#all .bib'], few: ['#students .srow', '#showcase .slot'], empty: ['#students .empty'], levelup: ['dialog[open] .cel'], rankup: ['dialog[open] .ru'],
    public: ['#showcase .bib', '#all .bib'], hidden: ['.state h2'], profile: ['.pfa .pfa-rank', '.pfa .shw'], error: ['#retry'] },
};
for (const [file, states] of Object.entries(STATES)) for (const [hash, must] of Object.entries(states)) for (const w of [1440, 390]) {
  await open(file, hash, w);
  const name = `${file}#${hash || 'normal'} @${w}`;
  check(`${name}: no errors`, !errors.length, errors.join(' | ').slice(0, 300));
  for (const sel of must) check(`${name}: ${sel}`, await count(sel) > 0);
  const scroll = await run('document.documentElement.scrollWidth > innerWidth');
  check(`${name}: no sideways scroll`, !scroll);
}
// a friend sees no figures and no «На подходе»; another person sees no students list
await open('index.html', 'friend');
check('friend: no progress bars on the cards', await count('#all .bib .track') === 0);
check('friend: «На подходе» hidden', await run(`${R}.querySelector('#almost').closest('section').hidden`));
await open('coach.html', 'public');
check('public: students hidden', await run(`${R}.querySelector('#students').closest('section').hidden`));
check('public: no bell', await run(`${R}.querySelector('#bell').hidden`));

// ---------- the user's choices reach the API ----------
const posts = () => run('window.S10_DEMO_POSTS || []');
async function act(file, hash, steps) { await open(file, hash); await run('window.S10_DEMO_POSTS = []'); for (const s of steps) { await s(); await sleep(250); } return posts(); }
let p = await act('index.html', '', [() => click('#ask-yes')]);
check('consent: yes is sent', p.some(x => x.action === 'consent' && x.answer === 'yes'), JSON.stringify(p));
p = await act('index.html', '', [() => click('#all [data-open="km_total"]'), () => click('#d-pin')]);
check('showcase: the pinned id is sent', p.some(x => x.action === 'showcase' && JSON.parse(x.ids).includes('km_total')), JSON.stringify(p));
p = await act('index.html', '', [() => click('#vis-open'), () => run(`(() => { const r = ${R}.querySelector('input[name=vis][value=me]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`)]);
check('visibility: «только я» is sent', p.some(x => x.action === 'visibility' && x.audience === 'me'), JSON.stringify(p));
p = await act('index.html', '', [() => click('#bell'), () => click('#bell')]);
check('bell: the unread are marked seen', p.some(x => x.action === 'seen' && JSON.parse(x.notifications).length > 0), JSON.stringify(p));
p = await act('coach.html', '', [() => click('[data-edit]'), () => click('[data-ask]')]);
check('coach: consent request is sent', p.some(x => x.action === 'consent_request' && x.athlete), JSON.stringify(p));
p = await act('coach.html', '', [() => click('[data-edit]'), () => click('[data-pick]')]);
check('coach: the showcase is sent', p.some(x => x.action === 'coach_showcase' && Array.isArray(JSON.parse(x.keys))), JSON.stringify(p));
p = await act('coach.html', '', [() => click('#vis-open'), () => run(`(() => { const r = ${R}.querySelector('input[name=vis][value=students]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`)]);
check('coach: visibility is sent', p.some(x => x.action === 'coach_visibility' && x.audience === 'students'), JSON.stringify(p));
// celebrated: sent on load, once the windows are open
await open('index.html', 'levelup'); await sleep(300); p = await posts();
check('levelup: celebrated is sent with the event id', p.some(x => x.action === 'celebrated' && JSON.parse(x.events).length === 1), JSON.stringify(p));
await open('coach.html', 'rankup'); await sleep(300); p = await posts();
check('coach rankup: celebrated is sent with the rank event', p.some(x => x.action === 'celebrated' && JSON.parse(x.rank_events).length === 1), JSON.stringify(p));

console.log(`${failed ? 'FAILED' : 'ok'}: ${passed} passed, ${failed} failed`);
ws.close(); chrome.kill(); process.exit(failed ? 1 : 0);
