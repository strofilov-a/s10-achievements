/* S10 achievements: the shared core of both pages (each page runs it in its own scope, see build.mjs).
   Levels and rank emblems, the bib card, number formatting, the toast. Names and points come from the server's answer. */
const TIERS = [
  { name: 'Бронза',  pts: 10,  c: 'var(--t-b)', ci: 'var(--t-b-ink)' },
  { name: 'Серебро', pts: 25,  c: 'var(--t-s)', ci: 'var(--t-s-ink)' },
  { name: 'Золото',  pts: 50,  c: 'var(--t-g)', ci: 'var(--t-g-ink)' },
  { name: 'Платина', pts: 100, c: 'var(--t-p)', ci: 'var(--t-p-ink)' },
  { name: 'Титан',   pts: 150, c: 'var(--t-t)', ci: 'var(--t-t-ink)' },
  { name: 'Мастер',  pts: 200, c: 'var(--t-m)', ci: 'var(--t-m-ink)' },
  { name: 'Чемпион', pts: 300, c: 'var(--t-c)', ci: 'var(--t-c-ink)' },
  { name: 'Элита',   pts: 400, c: 'var(--t-e)', ci: 'var(--t-e-ink)' },
];
const ONE = { name: 'Получено', pts: 25, c: 'var(--t-one)', ci: 'var(--on-brand)' };
const LEGEND = { name: 'Легендарное', pts: 500, c: 'var(--t-leg)', ci: 'var(--t-leg-ink)' };   // a secret once it opens
const SECRET = { name: 'Секретное', c: 'var(--t-sec)', ci: 'var(--t-sec-ink)' };               // a secret still closed
const NONE = { name: 'Не получено', c: 'var(--t-none)', ci: 'var(--t-none-ink)' };

// Ranks by total points. Each threshold sits just under a typical profile:
// 2-3 months of running ~400, a regular year ~1 900, three years ~4 300, five seasons ~7 500, the top 5% ~13 500, the top 1% ~21 500, Элита ~33 500
// (a profile is the average level it holds across the 40 tiered achievements plus its share of the one-level ones)
// Emblems in the game-ladder manner: a grey plate with a lit edge, a thin rim with pale bars, a cut gem whose facets take
// flat tone steps by the way they face (light from the top right), a darker table, a white sparkle, two small ones on the sides.
// g: gem tones [highlight, lit, base, shade, table], then the thin rim and the pale bars
const RANKS = [
  { name: 'Бронза',  from: 0,     art: 'tri',     g: ['#f3c78f', '#dda464', '#b9773a', '#8c5324', '#6c3b14'], rim: '#c88b45', bar: '#f1efe9' },
  { name: 'Серебро', from: 300,   art: 'rhomb',   g: ['#ffffff', '#eef0f2', '#cacfd4', '#a3a9b0', '#868d94'], rim: '#cfeee2', bar: '#e3f5ed' },
  { name: 'Золото',  from: 1500,  art: 'penta',   g: ['#ffeb8f', '#ffd24c', '#f7a21f', '#e2820c', '#c46604'], rim: '#f5b733', bar: '#f6f0d6' },
  { name: 'Платина', from: 3500,  art: 'hexa',    g: ['#8ae9f7', '#43d1ea', '#17aacb', '#0c86a6', '#08627f'], rim: '#26b2cc', bar: '#ace5df' },
  { name: 'Титан',   from: 6500,  art: 'octa',    g: ['#d6cbff', '#b19dff', '#8b70f0', '#6b4fd6', '#4930ad'], rim: '#9479f2', bar: '#ddd3ff' },
  { name: 'Мастер',  from: 12000, art: 'leaf',    g: ['#8ef3b8', '#40dd85', '#16b462', '#0b8f48', '#06602e'], rim: '#5fc994', bar: '#c2efdc' },
  { name: 'Чемпион', from: 20000, art: 'star',    g: ['#ffab84', '#ff7656', '#f03a4f', '#cc1b45', '#86103f'], rim: '#e2e2e2', bar: '#ececec' },
  { name: 'Элита',   from: 32000, art: 'radiant', g: ['#fff2b0', '#ffdb5e', '#f6b620', '#db920f', '#a96a00'], rim: '#e7d79c', bar: '#f7f1d8' },
];

let PLATE = ['#5b5f63', '#4a4d51']; // the lit edge and the plate; the coach page frames its emblems in navy
let embSeq = 0; // every emblem on the page needs its own clip ids

const U = {
  km: ['км'], h: ['ч'], m: ['м'], spk: ['с/км'],
  wk: ['неделя', 'недели', 'недель'], day: ['день', 'дня', 'дней'], run: ['пробежка', 'пробежки', 'пробежек'],
  mon: ['месяц', 'месяца', 'месяцев'], tr: ['тренировка', 'тренировки', 'тренировок'], rep: ['отчёт', 'отчёта', 'отчётов'],
  typ: ['тип', 'типа', 'типов'], tim: ['раз', 'раза', 'раз'], st: ['старт', 'старта', 'стартов'],
  win: ['победа', 'победы', 'побед'], place: ['место', 'места', 'мест'], post: ['пост', 'поста', 'постов'],
  like: ['отметка', 'отметки', 'отметок'], com: ['комментарий', 'комментария', 'комментариев'],
  fr: ['друг', 'друга', 'друзей'], dist: ['дистанция', 'дистанции', 'дистанций'], club: ['клуб', 'клуба', 'клубов'], city: ['город', 'города', 'городов'],
  cn: ['страна', 'страны', 'стран'], cont: ['континент', 'континента', 'континентов'],
  pt: ['очко', 'очка', 'очков'], lvl: ['уровень', 'уровня', 'уровней'],
  min: ['минута', 'минуты', 'минут'], stu: ['ученик', 'ученика', 'учеников'],
  race: ['целевой старт', 'целевых старта', 'целевых стартов'], plan: ['мастер-план', 'мастер-плана', 'мастер-планов'],
};

const ICON = {
  vol: '<path d="M7 3 4 21M17 3l3 18M12 4v3M12 10.5v3M12 17v3"/>',
  reg: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  plan: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 13l2 2 4-4"/>',
  type: '<path d="m12 4 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/>',
  speed: '<circle cx="12" cy="13" r="7.5"/><path d="M12 13V9M10 3h4M18 6l1.5-1.5"/>',
  race: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  comm: '<circle cx="9" cy="9" r="3.5"/><path d="M3 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5M15.5 5.6a3.5 3.5 0 0 1 0 6.8M17.5 14.8c2 .7 3.2 2.5 3.5 5.2"/>',
  geo: '<path d="m3 20 6.5-11 4 6.5 2.5-3.5L21 20Z"/>',
  secret: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};


/* ---------- helpers ---------- */
const $ = (s, r = ROOT) => r.querySelector(s); // ROOT: this page's shadow root
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svg = (k, px = 16) => `<svg viewBox="0 0 24 24" aria-hidden="true" style="width:${px}px;height:${px}px;flex:none;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round">${ICON[k]}</svg>`;

function plural(n, f) {
  if (!f) return '';
  if (f.length === 1) return f[0];
  if (!Number.isInteger(n)) return f[1];
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return f[2];
  if (b === 1) return f[0];
  if (b > 1 && b < 5) return f[1];
  return f[2];
}
const gen = u => (U[u] ? (U[u][2] || U[u][0]) : '');
const pad = n => String(n).padStart(2, '0');
function fmtTime(s) { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; }
function fmtN(a, n) { if (a.fmt === 'time') return fmtTime(n); if (a.fmt === 'dec') return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }); return n.toLocaleString('ru-RU'); }
const fmtInt = n => n.toLocaleString('ru-RU');
const fmtDate = iso => iso.split('-').reverse().join('.');
const fmtPct = p => (p < 1 ? p.toLocaleString('ru-RU', { maximumFractionDigits: p < 0.1 ? 2 : 1 }) : Math.round(p)) + '%';
const look = lv => `--bc:${lv.c};--bci:${lv.ci}`;

const dir = a => a.dir || 1;
function tierOf(a) { return a.d.length; } // the server decides the level: one date per level reached, and it never goes down whatever the value does later
const maxed = a => tierOf(a) === a.th.length;
const locked = a => a.kind === 'secret' && tierOf(a) === 0;
function progress(a) {
  if (a.capProg !== undefined) return Math.min(1, a.capProg); // a level waiting for data: how much of it is in
  const t = tierOf(a); if (t === a.th.length) return 1;
  const next = a.th[t], prev = t ? a.th[t - 1] : (dir(a) === 1 ? 0 : a.start);
  const p = dir(a) === 1 ? (a.val - prev) / (next - prev) : (prev - a.val) / (prev - next);
  return Math.max(0, Math.min(1, p));
}
const levelAt = (a, i) => (a.kind === 'tier' ? TIERS[i] : a.kind === 'one' ? ONE : LEGEND);
function levelOf(a, t) { return t ? levelAt(a, t - 1) : (a.kind === 'secret' ? SECRET : NONE); }
const levelName = (a, i) => (a.kind === 'tier' ? TIERS[i].name : a.kind === 'one' ? 'Один уровень' : LEGEND.name);
function thLabel(a, i) { return a.lab ? a.lab[i] : `${fmtN(a, a.th[i])} ${plural(a.th[i], U[a.u])}`; }
function bibNo(a, i) { return a.lab ? a.lab[i] : fmtN(a, a.th[i]); }
function bibUnit(a, i) { return a.lab ? a.bu : plural(a.th[i], U[a.u]); }
function points(a) { const t = tierOf(a); if (a.kind === 'tier') return TIERS.slice(0, t).reduce((s, x) => s + x.pts, 0); return t ? levelAt(a, 0).pts : 0; }
function nextPoints(a) { const t = tierOf(a); return t === a.th.length ? 0 : levelAt(a, t).pts; }
function levelPoints(a) { const t = tierOf(a); return t ? levelAt(a, t - 1).pts : 0; }
function rarity(a, i) { return a.rar[i] !== undefined ? a.rar[i] : a.rar[0]; } // the share of users with this level, counted by the server every night

function miniBib(a, i, next = false) {
  const lv = levelAt(a, i);
  return `<span class="mb${next ? ' next' : ''}" style="${look(lv)}" aria-hidden="true"><i></i><b>${esc(bibNo(a, i))}</b></span>`;
}
const fit = (name, extra) => { if (!extra.includes('big')) return ''; const w = Math.max(...name.split(' ').map(x => x.length)), px = Math.min(34, Math.floor(190 / (w * 0.54))); return px < 34 ? ` style="font-size:${px}px;line-height:${px + 2}px"` : ''; };
function bib(a, tag = 'button', extra = '') {
  const t = tierOf(a), lv = levelOf(a, t), i = t ? t - 1 : 0, lock = locked(a);
  // «из 20 минут»: the number with its unit; the distance in the unit («на 5 км») goes, the name already says it
  const value = lock ? 'откроется легендарным' : a.got || `${bibNo(a, i)} ${bibUnit(a, i).replace(/ на .*$/, '')}`;
  const name = lock ? 'Секретное достижение' : a.name;
  const fill = lock ? 0 : progress(a) * 100; // a full track at the top level, an empty one on a closed secret
  const bar = VIEW === 'friend' ? '' : `<span class="track"><span style="width:${fill.toFixed(1)}%"></span></span>`;
  const top = a.kind === 'tier' && t >= TIERS.length - 1 ? ' champ' : a.kind === 'secret' && t ? ' legend' : '';
  const attrs = tag === 'button' ? ` type="button" data-open="${a.id}" aria-label="${esc(name)}${t && a.count ? `, ${a.count}×` : ''}: ${esc(lv.name)}. ${esc(status(a))}"` : '';
  return `<${tag} class="bib${t || lock ? '' : ' off'}${lock ? ' lock' : ''}${top}${extra}"${attrs} style="${look(lv)}">
    <span class="band">${esc(lv.name)}</span><span class="h a"></span><span class="h b"></span><span class="h c"></span><span class="h d"></span>
    ${t && a.count ? `<span class="mult">${a.count}×</span>` : ''}<span class="ttl"${fit(name, extra)}>${esc(name)}</span><span class="val">${esc(value)}</span>
    <span class="pg">${bar}<span>${esc(status(a))}</span></span>
  </${tag}>`;
}
function emblem(r) {
  const id = 'em' + (++embSeq), g = r.g;
  const pt = ([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`;
  const P = V => V.map(pt).join(' ');
  const poly = (V, c) => `<polygon points="${P(V)}" fill="${c}"/>`;
  const ngon = (n, rad, rot, c) => Array.from({ length: n }, (_, k) => {
    const a = (rot + k * 360 / n) * Math.PI / 180;
    return [c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)];
  });
  const scale = (V, s, c) => V.map(([x, y]) => [c[0] + (x - c[0]) * s, c[1] + (y - c[1]) * s]);
  const facing = (a, b, c) => { const mx = (a[0] + b[0]) / 2 - c[0], my = (a[1] + b[1]) / 2 - c[1]; return (0.6 * mx - 0.8 * my) / Math.hypot(mx, my); };
  const tone = d => g[d > 0.8 ? 0 : d > 0.1 ? 1 : d > -0.5 ? 2 : 3];
  // the plate: a lighter edge all round, then the plate itself
  const plate = (V, c) => `<polygon points="${P(V)}" fill="${PLATE[0]}" stroke="${PLATE[0]}" stroke-width="7" stroke-linejoin="round"/>`
    + `<polygon points="${P(scale(V, 0.955, c))}" fill="${PLATE[1]}" stroke="${PLATE[1]}" stroke-width="5" stroke-linejoin="round"/>`;
  // a thin rim in the rank colour, with thick pale bars on its top and bottom runs and gaps at the sides
  const rim = (R, c) => {
    const n = R.length, E = R.map((v, i) => { const w = R[(i + 1) % n], mx = (v[0] + w[0]) / 2 - c[0], my = (v[1] + w[1]) / 2 - c[1]; return [v, w, my / Math.hypot(mx, my)]; });
    const cls = E.map(e => (e[2] < -0.45 ? 'T' : e[2] > 0.45 ? 'B' : '-'));
    let s0 = cls.findIndex((k, i) => k !== cls[(i + n - 1) % n]); if (s0 < 0) s0 = 0;
    const runs = [];
    for (let j = 0; j < n; j++) { const i = (s0 + j) % n; if (!runs.length || runs[runs.length - 1].k !== cls[i]) runs.push({ k: cls[i], pts: [E[i][0]] }); runs[runs.length - 1].pts.push(E[i][1]); }
    const cut = (a, b, d) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [a[0] + (b[0] - a[0]) * Math.min(d, l / 3) / l, a[1] + (b[1] - a[1]) * Math.min(d, l / 3) / l]; };
    return `<polygon points="${P(R)}" fill="none" stroke="${r.rim}" stroke-width="1.1" stroke-linejoin="round"/>`
      + runs.filter(u => u.k !== '-').map(({ pts }) => {
        const q = [cut(pts[0], pts[1], 4), ...pts.slice(1, -1), cut(pts[pts.length - 1], pts[pts.length - 2], 4)];
        return `<polyline points="${P(q)}" fill="none" stroke="${r.bar}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
      }).join('');
  };
  // a cut gem: crown facets between the girdle and the table, each in the tone of its face, a darker split table,
  // and a small glint on the lit side
  const cutGem = (G, c, table = 0.48, tc = c) => {
    const T = scale(G, table, tc);
    const facets = G.map((v, i) => { const j = (i + 1) % G.length; return poly([v, G[j], T[j], T[i]], tone(facing(v, G[j], c))); }).join('');
    const k = `${id}t${embSeq++}`;
    const tab = `<clipPath id="${k}"><polygon points="${P(T)}"/></clipPath><g clip-path="url(#${k})">${poly(T, g[4])}<rect x="${tc[0]}" y="0" width="40" height="68" fill="${g[3]}"/></g>`;
    const top = G.reduce((a, b) => (b[1] < a[1] ? b : a));
    const gl = [top[0] + (tc[0] + 20 - top[0]) * 0.18, top[1] + (tc[1] - top[1]) * 0.3];
    return facets + tab + poly([[gl[0], gl[1] - 2.2], [gl[0] + 1.6, gl[1]], [gl[0], gl[1] + 2.2], [gl[0] - 1.6, gl[1]]], '#ffffff');
  };
  // a four-point sparkle with curved sides; the half of every point turned from the light is shaded
  const spark = (rad, c, edge = false) => {
    const q = rad * 0.15, [x, y] = c, k = `${id}s${embSeq++}`;
    const d = `M${pt([x, y - rad])} Q${pt([x + q, y - q])} ${pt([x + rad, y])} Q${pt([x + q, y + q])} ${pt([x, y + rad])} Q${pt([x - q, y + q])} ${pt([x - rad, y])} Q${pt([x - q, y - q])} ${pt([x, y - rad])} Z`;
    const shade = [[[x, y - rad], [x - rad, y - rad]], [[x + rad, y], [x + rad, y + rad]], [[x, y + rad], [x - rad, y + rad]], [[x - rad, y], [x - rad, y - rad]]]
      .map(([a, b], i) => `<polygon points="${P([c, a, b])}" fill="${i % 2 ? '#c9cdd2' : '#dfe2e5'}"/>`).join('');
    return `<clipPath id="${k}"><path d="${d}"/></clipPath><path d="${d}" fill="#fff"${edge ? ` stroke="${PLATE[1]}" stroke-width="1"` : ''}/><g clip-path="url(#${k})">${shade}</g>`;
  };
  const sides = (x0, x1, y, rad = 5.4) => spark(rad, [x0, y], true) + spark(rad, [x1, y], true);
  const badge = (V, c, o) => {
    const R = scale(V, o.rim ?? 0.86, c), xs = R.map(v => v[0]);
    return plate(V, c) + rim(R, c) + cutGem(scale(V, o.gem ?? 0.68, c), c, o.table, o.tc) + spark(o.spark, o.sc || c) + sides(Math.min(...xs), Math.max(...xs), c[1]);
  };

  const art = {
    // Бронза: a triangle on its point
    tri: () => badge([[8, 10], [56, 10], [32, 61]], [32, 26], { gem: 0.66, rim: 0.84, table: 0.5, tc: [32, 25], spark: 10.5 }),
    // Серебро: a rhombus
    rhomb: () => badge([[32, 5], [59.5, 34], [32, 63], [4.5, 34]], [32, 34], { spark: 11 }),
    // Золото: a pentagon on its point
    penta: () => badge([[9, 9], [55, 9], [57.5, 36], [32, 61], [6.5, 36]], [32, 33], { table: 0.46, tc: [32, 31], spark: 11 }),
    // Платина: a hexagon with points to the sides
    hexa: () => badge([[18, 7], [46, 7], [59, 34], [46, 61], [18, 61], [5, 34]], [32, 34], { table: 0.5, spark: 11 }),
    // Титан: an octagon
    octa: () => badge(ngon(8, 28.5, -112.5, [32, 34]), [32, 34], { table: 0.5, spark: 11 }),
    // Мастер: a leaf with a chevron cut inside
    leaf: () => {
      const V = [[32, 3], [54, 22], [54, 46], [32, 65], [10, 46], [10, 22]], c = [32, 36];
      const L = [[32, 8], [47, 28], [47, 41], [32, 58], [17, 41], [17, 29]];
      return plate(V, [32, 34]) + rim(scale(V, 0.86, [32, 34]), [32, 34]) + cutGem(L, c, 0.52, [32, 39])
        + `<polyline points="${P([[19.5, 37], [32, 23], [44.5, 37]])}" fill="none" stroke="${g[0]}" stroke-width="2.2" stroke-linejoin="miter"/>`
        + spark(9.5, [32, 40]) + sides(12.5, 51.5, 34);
    },
    // Чемпион: a round plate, crossed blades and a big four-point star, each point split into a lit and a shaded half
    star: () => {
      const c = [32, 37], rad = 26, q = rad * 0.3;
      const tips = [[32, c[1] - rad], [32 + rad, c[1]], [32, c[1] + rad], [32 - rad, c[1]]];
      const mids = [[32 + q, c[1] - q], [32 + q, c[1] + q], [32 - q, c[1] + q], [32 - q, c[1] - q]];
      // each point: from the centre to its tip, then down to the waist on either side
      const halves = tips.map((tp, i) => {
        const a = mids[i], b = mids[(i + 3) % 4];
        return [poly([c, tp, a], tone(facing(tp, a, c))), poly([c, b, tp], tone(facing(b, tp, c)))].join('');
      }).join('');
      const inner = tips.map((tp, i) => [c[0] + (tp[0] - c[0]) * 0.5, c[1] + (tp[1] - c[1]) * 0.5]);
      const innerM = mids.map(m => [c[0] + (m[0] - c[0]) * 0.5, c[1] + (m[1] - c[1]) * 0.5]);
      const core = poly(inner.flatMap((v, i) => [v, innerM[i]]), g[4]);
      const blade = (x0, y0, x1, y1) => `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="${r.bar}" stroke-width="2" stroke-linecap="round"/>`;
      return `<circle cx="32" cy="${c[1]}" r="27.5" fill="${PLATE[0]}"/><circle cx="32" cy="${c[1]}" r="26.2" fill="${PLATE[1]}"/>` + rim(ngon(40, 23, -90, c), c)
        + blade(14.5, 19.5, 22, 27) + blade(49.5, 19.5, 42, 27) + blade(14.5, 54.5, 22, 47) + blade(49.5, 54.5, 42, 47)
        + [[13.4, 18.4], [50.6, 18.4], [13.4, 55.6], [50.6, 55.6]].map(([x, y]) => poly([[x, y - 1.8], [x + 1.8, y], [x, y + 1.8], [x - 1.8, y]], r.bar)).join('')
        + halves + core + spark(9.5, c) + sides(8.5, 55.5, c[1]);
    },
    // Элита: a double pale frame round a gold shield gem, a gold diamond on top and below
    radiant: () => {
      const c = [32, 35], O = [[32, 0.5], [62.5, 35], [32, 67.5], [1.5, 35]], I = [[32, 9.5], [54, 35], [32, 60.5], [10, 35]];
      const SH = [[32, 17], [44.5, 22.5], [44.5, 39], [32, 52], [19.5, 39], [19.5, 22.5]];
      const gem4 = (x, y, s, col, edge) => `<polygon points="${P([[x, y - s], [x + s * 0.8, y], [x, y + s], [x - s * 0.8, y]])}" fill="${col}" stroke="${edge}" stroke-width=".9"/>`;
      return `<polygon points="${P(O)}" fill="#efe5bf" stroke="#b9a76a" stroke-width=".8" stroke-linejoin="round"/>`
        + `<polygon points="${P(scale(O, 0.9, c))}" fill="#fffbea"/><polygon points="${P(scale(O, 0.84, c))}" fill="none" stroke="${g[3]}" stroke-width="1"/>`
        + plate(I, c) + rim(scale(I, 0.86, c), c) + cutGem(SH, [32, 34], 0.5, [32, 34])
        + spark(9.5, [32, 34]) + gem4(32, 8.5, 4, g[1], g[4]) + gem4(32, 61.5, 3.2, g[2], g[4]) + sides(13.5, 50.5, 35, 4.8);
    },
  }[r.art]();
  return `<svg class="emb" viewBox="0 0 64 68" aria-hidden="true">${art}</svg>`;
}

function copy(text) {
  try {
    navigator.clipboard.writeText(text).then(() => toast('Текст для публикации скопирован'), () => toast(text));
  } catch { toast(text); }
}
let toastTimer;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

/* ---------- from the server's answer to the cards' own shape ---------- */
// the names and points of the levels and the rank thresholds are the server's (the catalog may change them without a release)
function useLevels(D, athleteRanks) {
  D.levels.tiers.forEach((x, i) => { TIERS[i].name = x.name; TIERS[i].pts = x.points; });
  ONE.name = D.levels.one.name; ONE.pts = D.levels.one.points;
  LEGEND.name = D.levels.legend.name; LEGEND.pts = D.levels.legend.points;
  athleteRanks.forEach((r, i) => { RANKS[i].name = r.name; RANKS[i].from = r.from; });
}
// an achievement as the API sends it (see contract/API.md) → the fields the cards read; a closed secret has nothing but its rarity
function fromItem(x) {
  if (x.locked) return { id: x.id, cat: 'secret', kind: 'secret', name: 'Секретное достижение', cond: '', th: [1], val: 0, d: [], r: x.rarity[0], rar: x.rarity };
  const a = { id: x.id, cat: x.category, kind: x.kind, name: x.name, cond: x.condition, th: x.thresholds, d: x.dates || [], r: x.rarity[0], rar: x.rarity, src: x.source };
  if (x.direction === -1) { a.dir = -1; a.start = x.start; }
  if (x.unit) a.u = x.unit;
  if (x.format && x.format !== 'number') a.fmt = x.format;
  if (x.labels) a.lab = x.labels;
  if (x.label_unit !== undefined) a.bu = x.label_unit;
  if (x.opened_text) a.got = x.opened_text;
  if (x.action) a.act = [x.action.text, x.action.url];
  if (x.last) a.ev = x.last;
  if (x.note) a.note = x.note;
  if (x.count !== undefined) a.count = x.count;
  if (x.holders) a.who = x.holders;
  // no value yet: «Пока нет результата» for a time or a place, zero for a count
  a.val = x.infinite ? Infinity : x.value !== null && x.value !== undefined ? x.value : a.dir === -1 ? (a.start !== undefined ? a.start : Infinity) : 0;
  a.noValue = !x.infinite && (x.value === null || x.value === undefined);
  return a;
}
