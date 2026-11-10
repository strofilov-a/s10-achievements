// node tools/dev/states.mjs <page.html> <outdir> <width> <state[:action]>...: a full-page shot of each hash state, with errors
// action: bell, vis, dlg (the first achievement), student, picker, top, mid, or an achievement id; the page lives in #s10-achievements's shadow root
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
const [,, page, out, w = 1440, ...states] = process.argv;
mkdirSync(out, { recursive: true });
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9350 + Math.floor(Math.random() * 40);
const p = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(tmpdir() + '/cdp-'), `--window-size=${w},900`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; let logs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'assert', 'warning'].includes(m.params.type)) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await cmd('Runtime.enable'); await cmd('Page.enable');
const mobile = Number(w) < 700;
await cmd('Emulation.setDeviceMetricsOverride', { width: Number(w), height: mobile ? 844 : 900, deviceScaleFactor: 1, mobile: false }); // the fragment has no viewport meta, so a narrow desktop window stands in for the phone
const ACT = {
  top: "void 0",
  mid: "scrollTo(0, 820)",
  bell: "R.querySelector('#bell').click()",
  vis: "R.querySelector('#vis-open').click()",
  dlg: "R.querySelector('[data-open]').click()",
  student: "R.querySelector('[data-student]')?.click()",
  picker: "R.querySelector('[data-edit]')?.click()",
};
for (const st of states) {
  const [hash, act] = st.split(':');
  logs = [];
  await cmd('Page.navigate', { url: 'about:blank' }); await sleep(150);
  await cmd('Page.navigate', { url: encodeURI('file://' + page) + (hash && hash !== 'normal' ? '#' + hash : '') }); await sleep(1300);
  if (act) { await cmd('Runtime.evaluate', { expression: 'const R = document.querySelector("#s10-achievements").shadowRoot; ' + (ACT[act] ?? `R.querySelector('[data-open="${act}"]').click()`) }); await sleep(1100); }
  const dims = await cmd('Runtime.evaluate', { expression: 'JSON.stringify([document.documentElement.scrollWidth, document.documentElement.scrollHeight, innerWidth])', returnByValue: true });
  const [sw, sh, iw] = JSON.parse(dims.result.result.value);
  const dialogOpen = (await cmd('Runtime.evaluate', { expression: 'document.querySelector("#s10-achievements")?.shadowRoot?.querySelector("dialog")?.open || false', returnByValue: true })).result.result.value;
  const full = !dialogOpen && !act;
  const sy = (await cmd('Runtime.evaluate', { expression: 'scrollY', returnByValue: true })).result.result.value;
  const shot = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, clip: { x: 0, y: full ? 0 : sy, width: iw, height: full ? Math.min(sh, 4000) : (mobile ? 844 : 900), scale: 1 } });
  const name = `${out}/${(hash || 'normal')}${act ? '-' + act : ''}-${w}.png`;
  writeFileSync(name, Buffer.from(shot.result.data, 'base64'));
  console.log(`${st} @${w}: ${sw > iw ? 'H-SCROLL ' + sw : 'ok'} h=${sh}${logs.length ? '\n  ' + logs.join('\n  ') : ''}`);
}
ws.close(); p.kill();
