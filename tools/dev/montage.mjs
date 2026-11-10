// node montage.mjs <out.png> <png>...: the shots side by side on one sheet, through headless Chrome
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
const [,, out, ...files] = process.argv;
const imgs = files.map(f => `<figure><img src="data:image/png;base64,${readFileSync(f).toString('base64')}"><figcaption>${f.split('/').pop()}</figcaption></figure>`).join('');
const html = `<style>body{margin:0;display:flex;gap:12px;padding:12px;background:#888;align-items:flex-start}figure{margin:0}img{width:390px;display:block}figcaption{font:12px sans-serif;color:#fff}</style>${imgs}`;
const tmp = mkdtempSync(tmpdir() + '/mtg-'); writeFileSync(tmp + '/m.html', html);
const w = files.length * 402 + 12;
const p = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--screenshot=${out}`, `--window-size=${w},880`, '--hide-scrollbars', 'file://' + tmp + '/m.html'], { stdio: 'ignore' });
p.on('exit', () => console.log('montage', out));
