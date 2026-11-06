// node tests/live.mjs — the release build (no demo) against the real backend on its fixture users:
//   php -S 127.0.0.1:8090 backend/dev/router.php   (in another terminal), then this.
// Every page draws without an error for every kind of user, and what a user changes is stored on the server: it is still
// there after a reload, and other people see the change. Exit code 1 on a failure.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const B = process.env.BASE || 'http://127.0.0.1:8090';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9660 + Math.floor(Math.random() * 50);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'cdp-')), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => { ws.onopen = r; });
let id = 0, errors = []; const pend = {};
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(m.params.type)) errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon|fonts\.g/.test(m.params.entry.url || '') && !/status of 403/.test(m.params.entry.text)) errors.push(m.params.entry.text + ' ' + (m.params.entry.url || '')); };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await cmd('Runtime.enable'); await cmd('Page.enable'); await cmd('Log.enable');
const run = async expr => { const r = await cmd('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval'); return r.result.result.value; };
let failed = 0, passed = 0;
const check = (name, ok, more = '') => { if (ok) passed++; else { failed++; console.log(`FAIL ${name} ${more}`); } };
const R = sel => `(document.querySelector(${JSON.stringify(sel)}) || {}).shadowRoot`;
async function open(path, as, width = 1440) {
  errors = [];
  await cmd('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url: `${B}/dev/?as=${as}` }); await sleep(150); // the dev server keeps the user in a cookie
  await cmd('Page.navigate', { url: B + path }); await sleep(1400);
}
const q = (sel, host = '#s10-achievements') => run(`(${R(host)} ? ${R(host)}.querySelectorAll(${JSON.stringify(sel)}).length : -1)`);
const txt = (sel, host = '#s10-achievements') => run(`((${R(host)} || document).querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
const click = sel => run(`${R('#s10-achievements')}.querySelector(${JSON.stringify(sel)}).click(), true`);
const api = (action, as) => run(`fetch('/apiweb/achievements.php?action=${action}', { credentials: 'include' }).then(r => r.json())`);
await fetch(`${B}/dev/reset`);

// ---------- every kind of user, both widths ----------
const PAGES = [
  ['athlete own (3)', '/tests/live/athlete.html', 3, ['#rank .rname', '#almost .rowc', '#showcase .shw', '#recent .rcard', '#all .bib']],
  ['new athlete (4)', '/tests/live/athlete.html', 4, ['#rank .rname', '#almost .empty', '#all .bib']],
  ['friend (5 → 3)', '/tests/live/athlete.html?id=3', 5, ['.who', '#all .bib']],
  ['hidden (5 → 6)', '/tests/live/athlete.html?id=6', 5, ['.state h2']],
  ['coach own (12)', '/tests/live/coach.html', 12, ['#rank .rname', '#students .srow', '#showcase .bib', '#all .bib']],
  ['new coach (13)', '/tests/live/coach.html', 13, ['#students .srow']],
  ['coach, no students (14)', '/tests/live/coach.html', 14, ['#students .empty']],
  ['coach public (5 → 12)', '/tests/live/coach.html?id=12', 5, ['#showcase .bib', '#all .bib']],
  ['coach hidden (5 → 15)', '/tests/live/coach.html?id=15', 5, ['.state h2']],
];
for (const [name, path, as, must] of PAGES) for (const w of [1440, 390]) {
  await open(path, as, w);
  check(`${name} @${w}: no errors`, !errors.length, errors.join(' | ').slice(0, 400));
  for (const sel of must) check(`${name} @${w}: ${sel}`, await q(sel) > 0, `(${await q(sel)})`);
  check(`${name} @${w}: no sideways scroll`, !(await run('document.documentElement.scrollWidth > innerWidth')));
}
await open('/tests/live/athlete.html?id=3', 5);
check('friend: no progress bars', await q('#all .bib .track') === 0);
check('friend: no bell', await run(`${R('#s10-achievements')}.querySelector('#bell').hidden`));
await open('/tests/live/athlete.html?id=6', 5);
check('hidden: the owner named', /скрывает/.test(await txt('.state h2')));

// ---------- the profile blocks, the second drawn later as React would ----------
await open('/tests/live/profile.html', 5);
await sleep(800);
check('profile: no errors', !errors.length, errors.join(' | ').slice(0, 300));
check('profile: athlete block', await q('.pfa .pfa-rank', '[data-s10-achievements="widget"]') > 0);
check('profile: coach block that came later', await q('.pfa .pfa-rank', '[data-s10-achievements="coach-widget"]') > 0);
check('profile: the site page is not restyled', await run('getComputedStyle(document.querySelector("h1")).fontFamily.includes("system-ui")'));

// ---------- what the user changes stays on the server ----------
await open('/tests/live/athlete.html', 3);
const before = (await api('athlete')).showcase;
await click('#all [data-open="km_total"]'); await sleep(200); await click('#d-pin'); await sleep(500);
await open('/tests/live/athlete.html', 3);
const after = (await api('athlete')).showcase;
check('showcase: the pin is stored', after.includes('km_total') && after.length <= 3, `${before} → ${after}`);
check('showcase: drawn after a reload', /Километраж/.test(await txt('#showcase')));

await click('#vis-open'); await sleep(200);
await run(`(() => { const r = ${R('#s10-achievements')}.querySelector('input[name=vis][value=me]'); r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await sleep(500);
await open('/tests/live/athlete.html?id=3', 5);
check('visibility «только я»: a friend now gets the hidden page', /скрывает/.test(await txt('.state h2')));
await open('/tests/live/athlete.html', 3);
check('visibility: the owner still sees everything', await q('#all .bib') > 0);
await run(`fetch('/apiweb/achievements.php', { method: 'POST', credentials: 'include', body: (() => { const f = new FormData(); f.set('action', 'visibility'); f.set('audience', 'all'); return f; })() }).then(r => r.json())`);

const unread = (await api('athlete')).notifications.filter(n => n.unread).length;
await click('#bell'); await sleep(500);
const unreadAfter = (await api('athlete')).notifications.filter(n => n.unread).length;
check('bell: opening it marks the unread as read', unread > 0 && unreadAfter === 0, `${unread} → ${unreadAfter}`);

const consent = (await api('athlete')).coach;
if (consent && consent.consent === 'pending') {
  await click('#ask-yes'); await sleep(500);
  check('consent: yes is stored', (await api('athlete')).coach.consent === 'yes');
} else check('consent: athlete 3 has a pending request in the fixture', false, JSON.stringify(consent));

// a new level since the last visit: the window opens once, then never again
await fetch(`${B}/dev/state?user=3&role=a&set=levelup`);
await open('/tests/live/athlete.html', 3);
check('levelup: the window opens', await q('dialog[open] .cel') > 0);
await open('/tests/live/athlete.html', 3);
check('levelup: not again after a reload', await q('dialog[open]') === 0);
await fetch(`${B}/dev/state?user=12&role=c&set=rankup`);
await open('/tests/live/coach.html', 12);
check('coach rankup: the window opens', await q('dialog[open] .ru') > 0 || await q('dialog[open] .cel') > 0);

// the coach: showcase, who sees, a consent request
await open('/tests/live/coach.html', 12);
const shBefore = (await api('coach')).showcase.length;
await click('[data-edit]'); await sleep(300);
const pick = await run(`(() => { const b = [...${R('#s10-achievements')}.querySelectorAll('[data-pick]')].find(b => b.textContent === 'Убрать'); if (b) b.click(); return !!b; })()`); await sleep(500);
const shAfter = (await api('coach')).showcase.length;
check('coach showcase: removing a card is stored', pick && shAfter === shBefore - 1, `${shBefore} → ${shAfter}`);
const ask = await run(`(() => { const b = ${R('#s10-achievements')}.querySelector('[data-ask]'); if (b) b.click(); return b ? b.dataset.ask : null; })()`); await sleep(500);
if (ask) check('coach: the request is stored as pending', (await api('coach')).students.find(s => String(s.id) === String(ask))?.consent === 'pending', ask);
await open('/tests/live/coach.html?id=12', 5);
check('coach public: the showcase follows the change', await q('#showcase .bib') === shAfter, `${await q('#showcase .bib')} vs ${shAfter}`);

await fetch(`${B}/dev/reset`);
console.log(`${failed ? 'FAILED' : 'ok'}: ${passed} passed, ${failed} failed`);
ws.close(); chrome.kill(); process.exit(failed ? 1 : 0);
