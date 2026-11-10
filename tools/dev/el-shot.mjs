// node el-shot.mjs <page.html> <out.png> <css selector> [width] [extra px below]: screenshot from an element's top
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const [,, page, out, sel, w = 1440, extra = 700] = process.argv;
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const p = spawn(chrome, ['--headless=new', '--remote-debugging-port=9341', '--user-data-dir=' + mkdtempSync(tmpdir() + '/cdp-'), `--window-size=${w},900`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9341/json')).json(); if (targets.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(targets.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {};
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +w, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: encodeURI('file://' + page) }); await sleep(1800);
const r = (await send('Runtime.evaluate', { expression: `(()=>{const b=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return {y:b.top+scrollY}})()`, returnByValue: true })).result.result.value;
const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: Math.max(0, r.y - 20), width: +w, height: +extra, scale: 1 } });
writeFileSync(out, Buffer.from(s.result.data, 'base64'));
console.log('ok'); ws.close(); p.kill();
