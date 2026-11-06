// node tools/export-prototype.mjs <athlete prototype.html> <coach prototype.html>
// One-time migration: takes the agreed catalogs and every demo state out of the two prototypes and writes
//   catalog/athlete.json, catalog/coach.json, catalog/common.json  — the catalogs the server reads (the single source from now on)
//   contract/mock/*.json                                            — what /apiweb/achievements.php answers in each state
// The prototypes' example data become the demo; the backend's own tests run on their own fixtures.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [,, athleteFile, coachFile] = process.argv;
const NOW = '2026-11-06'; // the prototypes' «today»
mkdirSync(join(ROOT, 'catalog'), { recursive: true });
mkdirSync(join(ROOT, 'contract/mock'), { recursive: true });

const port = 9520 + Math.floor(Math.random() * 30);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(tmpdir() + '/cdp-'), 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let t; for (let i = 0; i < 40; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.length) break; } catch {} await sleep(250); }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = {}; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; } };
const cmd = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
await cmd('Page.enable'); await cmd('Runtime.enable');
const evalIn = async (file, hash, fn, arg) => {
  await cmd('Page.navigate', { url: 'about:blank' }); await sleep(100);
  await cmd('Page.navigate', { url: encodeURI('file://' + file) + (hash ? '#' + hash : '') }); await sleep(1500);
  const r = await cmd('Runtime.evaluate', { expression: `JSON.stringify((${fn})(${JSON.stringify(arg ?? null)}))`, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(hash + ': ' + (r.result.exceptionDetails.exception?.description || 'eval'));
  return JSON.parse(r.result.result.value);
};
const W = (f, o) => writeFileSync(join(ROOT, f), JSON.stringify(o, null, 2) + '\n');

// ---------- what both pages share: a catalog entry and the levels ----------
// Runs inside the page. Long, plain field names: this is what the backend developer stores and reads.
const SHARED = `
  const entry = a => ({
    id: a.id, category: a.cat, kind: a.kind, name: a.name, condition: a.cond,
    thresholds: a.th, direction: a.dir || 1, ...(a.start !== undefined ? { start: a.start } : {}),
    unit: a.u || null, format: a.fmt || 'number',
    ...(a.lab ? { labels: a.lab } : {}), ...(a.bu !== undefined ? { label_unit: a.bu } : {}),
    ...(a.got ? { opened_text: a.got } : {}),
    ...(a.act ? { action: { text: a.act[0], url: a.act[1].replace('https://s10.run', '') } } : {}),
    // ready-made card texts for each level, so the server never formats numbers: «из 20» and «из 20 минут»
    card_number: a.th.map((_, i) => bibNo(a, i)),
    card_text: a.th.map((_, i) => a.got || (bibNo(a, i) + ' ' + bibUnit(a, i).replace(/ на .*$/, '')).trim()),
    source: a.src,
  });
  const levels = { tiers: TIERS.map(x => ({ name: x.name, points: x.pts })), one: { name: ONE.name, points: ONE.pts }, legend: { name: LEGEND.name, points: LEGEND.pts } };
  const rar = a => a.th.map((_, i) => +rarity(a, i).toFixed(2));
  // a closed secret leaves the server with nothing but an opaque id and how rare it is
  const closed = (a, k) => ({ id: 's_' + (k + 1), kind: 'secret', category: 'secret', locked: true, rarity: [a.r] });
  // the date each rank came: the levels in date order until their points pass its threshold
  const rankDates = (list, ranks) => { const ev = list.flatMap(a => a.d.map((d, i) => ({ d, p: levelAt(a, i).pts }))).sort((x, y) => x.d.localeCompare(y.d)); let s = 0, r = 0; const out = []; for (const e of ev) { s += e.p; while (r + 1 < ranks.length && s >= ranks[r + 1].from) { r++; out.push({ rank: r, date: e.d }); } } return out; };
`;

// ---------- athlete ----------
const athlete = await evalIn(athleteFile, '', new Function(`return () => { ${SHARED}
  return {
    catalog: A.map(a => ({ ...entry(a), enabled: a.ready !== 'new', data: a.ready })),
    levels, ranks: RANKS.map(r => ({ name: r.name, from: r.from })), categories: CATS, units: U,
  };
}`)());
const athleteState = hash => evalIn(athleteFile, hash, new Function('NOW', `${SHARED}
  const H = location.hash.slice(1), friend = VIEW === 'friend';
  const user = { id: 3, name: ATHLETE.first, initials: ATHLETE.ini };
  if (H === 'hidden') return { hidden: true, user };
  const live = A.filter(a => a.ready !== 'new');
  let k = 0;
  const items = live.map(a => {
    if (locked(a)) return closed(a, k++);
    const value = friend || a.none || a.val === Infinity ? null : a.val;
    return { ...entry(a), value, dates: a.d, ...(a.ev ? { last: a.ev } : {}), ...(a.note && !friend ? { note: a.note } : {}), rarity: rar(a) };
  });
  const pts = live.reduce((s, a) => s + points(a), 0), rk = RANKS.reduce((n, r, i) => (pts >= r.from ? i : n), 0);
  const base = { now: NOW, viewer: friend ? 'friend' : 'self', user, levels, ranks: RANKS.map(r => ({ name: r.name, from: r.from })), categories: CATS, points: pts, rank: rk };
  if (H === 'profile') return { ...base, earned: live.filter(a => tierOf(a) > 0).length, total: live.length, showcase: state.pinned.map(p => items.find(x => x.id === p)) };
  if (friend) return { ...base, items, showcase: state.pinned };
  const ev = live.flatMap(a => a.d.map((d, i) => ({ a, i, d }))).sort((x, y) => y.d.localeCompare(x.d) || x.a.id.localeCompare(y.a.id));
  const events = ev.slice(0, 30).map((e, n) => ({ id: 1000 - n, achievement: e.a.id, level: e.i + 1, date: e.d, celebrated: !(H === 'levelup' && n === 0) }));
  const rankEvents = rankDates(live, RANKS).map((r, n) => ({ id: 100 + n, rank: r.rank, date: r.date, celebrated: !(H === 'rankup' && r.rank === rk) })).reverse();
  const coach = state.consent === 'none' ? null : { id: 12, name: 'Тренер', initials: 'Т', consent: state.consent };
  const notifications = [
    ...(coach && coach.consent === 'pending' ? [{ id: 59, type: 'consent_request', coach: { id: 12, name: 'Тренер', initials: 'Т' }, date: NOW, unread: true }] : []),
    ...events.slice(0, 3).map((e, n) => ({ id: 58 - n, type: 'level', event: e.id, achievement: e.achievement, level: e.level, date: e.date, unread: n === 0 })),
    ...rankEvents.slice(0, 1).map(r => ({ id: 50, type: 'rank', rank: r.rank, date: r.date, unread: false })),
  ].sort((x, y) => (y.type === 'consent_request') - (x.type === 'consent_request') || y.date.localeCompare(x.date));
  return { ...base, items, showcase: state.pinned, events, rank_events: rankEvents, visibility: { audience: state.vis }, coach, notifications };
`), NOW);

W('catalog/athlete.json', athlete.catalog);
const athleteStates = { normal: '', new: 'new', friend: 'friend', hidden: 'hidden', levelup: 'levelup', rankup: 'rankup', profile: 'profile' };
for (const [name, hash] of Object.entries(athleteStates)) W(`contract/mock/athlete-${name}.json`, await athleteState(hash));
const nameToId = Object.fromEntries(athlete.catalog.map(a => [a.name, a.id]));

// ---------- coach ----------
const coach = await evalIn(coachFile, '', new Function(`return () => { ${SHARED}
  return {
    catalog: A.map(a => ({ ...entry(a), ...(a.obs ? { data_unit: a.obs.of } : {}), ...(a.who ? { counter: true } : {}),
      none_text: { longest: 'Пока нет учеников', exp: 'Меньше месяца на S10', grade: 'Пока нет результата' }[a.id] || 'Пока нет данных', enabled: true })),
    ranks: C_RANKS.map(r => ({ name: r.name, from: r.from })), categories: CATS, units: U,
    gates: { base: GATE, step: STEP, units: Object.fromEntries(Object.entries(OBS).map(([k, v]) => [k, v])) },
  };
}`)());
const coachState = hash => evalIn(coachFile, hash, new Function('arg', `${SHARED}
  const { NOW, nameToId } = arg;
  const H = location.hash.slice(1), pub = VIEW === 'friend';
  const who = { id: 12, name: COACH.name, initials: COACH.initials, students: S.length };
  if (H === 'hidden') return { hidden: true, coach: who };
  const CR = C_RANKS.map(r => ({ name: r.name, from: r.from }));
  const lvIndex = n => { const i = TIERS.findIndex(x => x.name === n); return i >= 0 ? i + 1 : 1; };
  const kindOf = n => (n === LEGEND.name ? 'secret' : n === ONE.name ? 'one' : 'tier');
  const card = x => ({ key: x.id, athlete_id: x.sid, athlete_name: stById[x.sid].name, achievement: nameToId[x.name], name: x.name, kind: kindOf(x.lv), level: lvIndex(x.lv), number: x.mini, text: x.value, date: x.date });
  let k = 0;
  const full = a => {
    if (locked(a)) return closed(a, k++);
    const o = a.obs, value = a.none || a.val === Infinity ? null : a.val;
    return { ...entry(a), value, ...(a.val === Infinity ? { infinite: true } : {}), dates: a.d,
      ...(o ? { data: { n: o.n, ...(o.x !== undefined ? { x: o.x } : {}), ...(o.v !== undefined ? { v: o.v } : {}) } } : {}),
      ...(a.ev ? { last: a.ev } : {}), ...(a.who ? { count: a.count, holders: a.who.map(w => ({ name: w.name, time: w.time, date: w.date, ...(w.left ? { left: true } : {}) })) } : {}),
      rarity: rar(a) };
  };
  const base = { now: NOW, viewer: pub ? 'public' : 'self', coach: who, levels, ranks: CR, athlete_ranks: RANKS.map(r => ({ name: r.name, from: r.from })), categories: CATS, points: totalPts, rank: rankIdx,
    gates: { base: GATE, step: STEP } };
  const strengths = n => [...earned.filter(a => a.kind === 'secret'), ...earned.filter(a => a.kind === 'tier' && tierOf(a) >= 3).sort(byLevel)].slice(0, n)
    .map(a => { const f = full(a); delete f.data; f.value = null; if (f.holders) delete f.holders; return f; });
  if (H === 'profile') return { ...base, months: byId.exp.val, strengths: strengths(3) };
  const showcase = state.show.map(key => card(ACH[key]));
  if (pub) return { ...base, items: strengths(5), showcase };
  const ev = A.flatMap(a => a.d.map((d, i) => ({ a, i, d }))).sort((x, y) => y.d.localeCompare(x.d) || x.a.id.localeCompare(y.a.id));
  const events = ev.slice(0, 30).map((e, n) => ({ id: 2000 - n, achievement: e.a.id, level: e.i + 1, date: e.d, celebrated: !(H === 'levelup' && n === 0) }));
  const rankEvents = rankDates(A, C_RANKS).map((r, n) => ({ id: 300 + n, rank: r.rank, date: r.date, celebrated: !(H === 'rankup' && r.rank === rankIdx) })).reverse();
  const students = S.map(s => ({ id: s.id, name: s.name, initials: s.ini, months: s.months, rank: s.rank, points: s.pts, consent: s.consent, near: s.near,
    ...(s.page ? { page: '/achievements/athlete?id=' + s.id } : {}), achievements: s.ach.map(([, , , , key]) => card(ACH[key])) }));
  const fromStudents = Object.values(ACH).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 2);
  const counter = A.filter(a => a.count).map(a => { const w = [...a.who].sort((x, y) => y.date.localeCompare(x.date))[0]; return { achievement: a.id, count: a.count, name: w.name, time: w.time, date: w.date }; });
  const notifications = [
    ...S.filter(s => s.consent === 'pending').map((s, n) => ({ id: 90 - n, type: 'consent_pending', athlete: { id: s.id, name: s.name, initials: s.ini }, date: NOW, unread: false })),
    ...events.slice(0, 2).filter(e => !counter.some(c => c.achievement === e.achievement)).map((e, n) => ({ id: 80 - n, type: 'level', event: e.id, achievement: e.achievement, level: e.level, date: e.date, unread: n === 0 })),
    ...fromStudents.map((x, n) => ({ id: 70 - n, type: 'student_level', card: card(x), date: x.date, unread: false })),
    ...counter.map((c, n) => ({ id: 65 - n, type: 'counter', ...c, unread: false })),
    ...rankEvents.slice(0, 1).map(r => ({ id: 60, type: 'rank', rank: r.rank, date: r.date, unread: false })),
  ];
  return { ...base, items: A.map(full), students, showcase, events, rank_events: rankEvents, visibility: { audience: state.vis }, notifications };
`), { NOW, nameToId });

W('catalog/coach.json', coach.catalog);
W('catalog/common.json', {
  note: 'Уровни, звания, категории и единицы. Атлет и тренер делят уровни и очки, у тренера свои пороги званий и правило подтверждения данными.',
  levels: athlete.levels, athlete_ranks: athlete.ranks, coach_ranks: coach.ranks,
  athlete_categories: athlete.categories, coach_categories: coach.categories,
  units: { ...athlete.units, ...coach.units }, coach_gates: coach.gates,
});
const coachStates = { normal: '', few: 'few', empty: 'empty', public: 'public', hidden: 'hidden', levelup: 'levelup', rankup: 'rankup', profile: 'profile' };
for (const [name, hash] of Object.entries(coachStates)) W(`contract/mock/coach-${name}.json`, await coachState(hash));
console.log('athlete catalog', athlete.catalog.length, 'coach catalog', coach.catalog.length);
ws.close(); chrome.kill();
