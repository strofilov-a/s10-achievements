// node ring-shot.mjs <url> <out prefix> <width>...: the rank road as a phone shows it (mobile, DPR 3), clipped round the current step
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const [,, url, out, ...widths] = process.argv;
const port = 9700 + Math.floor(Math.random() * 50);
const p = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(tmpdir() + '/cdp-'), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await cmd('Page.enable'); await cmd('Runtime.enable');
for (const w of widths) {
  await cmd('Emulation.setDeviceMetricsOverride', { width: +w, height: 844, deviceScaleFactor: 3, mobile: true });
  await cmd('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await cmd('Page.navigate', { url: 'about:blank' }); await sleep(100);
  await cmd('Page.navigate', { url }); await sleep(2500);
  const r = (await cmd('Runtime.evaluate', { returnByValue: true, expression: `(() => {
    const R = document.querySelector('#s10-achievements').shadowRoot, cur = R.querySelector('.step.cur'), emb = cur.querySelector('.emb'), wrap = R.querySelector('#road-wrap');
    const b = cur.getBoundingClientRect(), e = emb.getBoundingClientRect(), w = wrap.getBoundingClientRect(), ring = getComputedStyle(cur, '::before');
    return { step: [b.left, b.top, b.width, b.height], emb: [e.left, e.top, e.width, e.height], wrap: [w.left, w.top, w.width, w.height],
      ring: { top: ring.top, left: ring.left, w: ring.width, h: ring.height, ml: ring.marginLeft }, inner: innerWidth, scrollW: wrap.scrollWidth, clientW: wrap.clientWidth };
  })()` })).result.result.value;
  console.log(w, JSON.stringify(r));
  const s = await cmd('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, r.emb[0] - 70), y: r.emb[1] - 30, width: r.emb[2] + 140, height: r.emb[3] + 60, scale: 1 } });
  writeFileSync(`${out}-${w}.png`, Buffer.from(s.result.data, 'base64'));
}
ws.close(); p.kill();
