// node frontend/build.mjs — builds the achievements frontend from frontend/src:
//   release/frontend/t5/achievements/achievements.js   the production file for s10.run, the demo cut out
//   release/frontend/achievements.html                 the page shell for /achievements/athlete and /achievements/coach
//   dist/achievements.js, index.html, coach.html        the demo on GitHub Pages (the same code on the contract's examples)
// One JS file, no dependencies, no build step on the site. Exit code 1 if a check fails.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'frontend/src');
const read = f => readFileSync(join(SRC, f), 'utf8');
const fail = m => { console.error('build: ' + m); process.exit(1); };
const inTemplate = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${'); // text placed inside a JS template literal

// each page runs the shared core in its own scope: a page may redefine a helper (the coach's fmtN, status, remaining)
const core = read('core.js');
const page = f => { const s = read(f); if (!s.includes('/*CORE*/')) fail(`${f}: no /*CORE*/ mark`); return s.replace('/*CORE*/', () => core); };
const mock = Object.fromEntries(readdirSync(join(ROOT, 'contract/mock')).filter(f => f.endsWith('.json')).sort()
  .map(f => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(ROOT, 'contract/mock', f), 'utf8'))]));
let src = read('shell.js')
  .replace('@@CSS@@', () => inTemplate(read('style.css')))
  .replace('/*@@PAGES@@*/', () => page('athlete.js') + '\n' + page('coach.js'))
  .replace('@@MOCK@@', () => JSON.stringify(mock));
if (/@@[A-Z]+@@/.test(src)) fail('a placeholder is left: ' + src.match(/@@[A-Z]+@@/)[0]);

// the release: every /*<demo>*/ … /*</demo>*/ block goes
const opens = (src.match(/\/\*<demo>\*\//g) || []).length, closes = (src.match(/\/\*<\/demo>\*\//g) || []).length;
if (!opens || opens !== closes) fail(`demo markers do not pair: ${opens} open, ${closes} close`);
let js = src.replace(/\/\*<demo>\*\/[\s\S]*?\/\*<\/demo>\*\//g, '').replace(/^[ \t]+\n/gm, '');
const left = js.match(/.*\b(LIVE|MOCK|S10_FORCE_DEMO|demo\w*)\b.*/g);
if (left) fail('demo left in the release:\n' + left.slice(0, 5).join('\n').slice(0, 600));
const stamp = createHash('sha256').update(js).digest('hex').slice(0, 10);
js = js.replace(/^\/\* S10 achievements:/, `/* S10 achievements · release ${stamp}:`);

const REL = join(ROOT, 'release/frontend');
rmSync(REL, { recursive: true, force: true });
mkdirSync(join(REL, 't5/achievements'), { recursive: true });
const relJs = join(REL, 't5/achievements/achievements.js');
writeFileSync(relJs, js);
writeFileSync(join(REL, 'achievements.html'), read('achievements.html').replace('?v=0', `?v=${stamp}`));
// the brief for the S10 frontend developer, and the contract it rests on
writeFileSync(join(REL, 'README.md'), readFileSync(join(ROOT, 'frontend/ЗАДАНИЕ.md'), 'utf8').replaceAll('{{release}}', stamp));
writeFileSync(join(REL, 'API.md'), readFileSync(join(ROOT, 'contract/API.md'), 'utf8').replace('Примеры ответов на каждое состояние лежат в [`mock/`](mock).', 'Примеры ответов на каждое состояние: https://github.com/strofilov-a/s10-achievements/tree/main/contract/mock.'));
mkdirSync(join(ROOT, 'dist'), { recursive: true });
writeFileSync(join(ROOT, 'dist/achievements.js'), src);
for (const f of [relJs, join(ROOT, 'dist/achievements.js')]) {
  try { execFileSync(process.execPath, ['--check', f]); } catch (e) { fail(`${f} does not parse:\n${e.stderr}`); }
}

// the demo pages: the same file on the examples, with a bar in the corner to switch the page and its state
const STATES = {
  athlete: [['', 'Обычное'], ['new', 'Новый атлет'], ['levelup', 'Новый уровень'], ['rankup', 'Новое звание'], ['friend', 'Глазами друга'], ['hidden', 'Достижения скрыты'], ['profile', 'Блок в профиле'], ['loading', 'Загрузка'], ['error', 'Ошибка']],
  coach: [['', 'Обычное'], ['few', 'Новый тренер'], ['empty', 'Нет учеников'], ['levelup', 'Новый уровень'], ['rankup', 'Новое звание'], ['public', 'Глазами атлета'], ['hidden', 'Достижения скрыты'], ['profile', 'Блок в профиле'], ['loading', 'Загрузка'], ['error', 'Ошибка']],
};
const demo = (active, title) => `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<style>
html, body { margin: 0; background: #ffffff; }
/* the profile block on its own, in a column as the profile will hold it */
#s10-achievements[data-s10-achievements] { display: block; max-width: 1100px; margin: 40px auto 96px; padding: 0 16px; }
.demo-bar { position: fixed; left: 16px; bottom: 16px; z-index: 50; display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 12px; background: #14171c; color: #c9ced6; border-radius: 10px; font: 500 13px/1 Roboto, system-ui, sans-serif; box-shadow: 0 6px 20px rgba(0, 0, 0, .25); }
.demo-bar > span { margin-right: 6px; }
.demo-bar a { color: #c9ced6; text-decoration: none; padding: 9px 12px; border-radius: 7px; }
.demo-bar a.on { background: #ffffff; color: #14171c; }
.demo-bar a:not(.on):hover { color: #ffffff; }
.demo-st select { appearance: none; margin-left: 4px; height: 31px; padding: 0 28px 0 10px; border: 0; border-radius: 7px; background: #2a2f37 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23c9ced6' stroke-width='1.5'/%3E%3C/svg%3E") no-repeat right 10px center; color: #ffffff; font: inherit; cursor: pointer; }
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 640px) { .demo-bar { left: 8px; right: 8px; bottom: 8px; justify-content: space-between; } .demo-bar > span { display: none; } }
@media print { .demo-bar { display: none; } }
</style>
</head>
<body>
<div id="s10-achievements"></div>
<script src="dist/achievements.js?v=${stamp}"></script>
<nav class="demo-bar" aria-label="Демо">
  <span>Демо</span>
  <a href="index.html"${active === 'athlete' ? ' class="on" aria-current="page"' : ''}>Атлет</a>
  <a href="coach.html"${active === 'coach' ? ' class="on" aria-current="page"' : ''}>Тренер</a>
  <label class="demo-st"><span class="vh">Состояние</span><select id="demo-st">${STATES[active].map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
</nav>
<script>
(() => { const sel = document.getElementById('demo-st'); const sync = () => { sel.value = location.hash.slice(1); if (sel.selectedIndex < 0) sel.value = ''; }; sync(); addEventListener('hashchange', sync); sel.addEventListener('change', () => { location.hash = sel.value; }); })();
</script>
</body>
</html>
`;
writeFileSync(join(ROOT, 'index.html'), demo('athlete', 'Достижения · S10.run, демо'));
writeFileSync(join(ROOT, 'coach.html'), demo('coach', 'Достижения тренера · S10.run, демо'));
console.log(`release ${stamp}: achievements.js ${(js.length / 1024).toFixed(0)} KB; demo ${(src.length / 1024).toFixed(0)} KB`);
