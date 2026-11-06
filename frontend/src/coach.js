/* S10 achievements: the coach's page (as the coach sees it, or anyone else: «Сильные стороны») and the block in the
   coach's profile. Drawn from GET /apiweb/achievements.php?action=coach|coach_widget (contract/API.md): the server counts
   every figure for all the time on S10 and proves each level with enough data (gates); the page shows it and sends the
   coach's choices back: the students' showcase, who sees it, a request for a student's consent. */
function coachApp(ROOT, api, me, opts) {
/*CORE*/
PLATE = ['#55688c', '#3c4c69']; // coach emblems: a navy frame instead of the athlete's gunmetal, the lit edge and the plate
const SITE = opts.site; // '' on s10.run, the site's full address elsewhere
let D, VIEW, COACH, CATS, C_RANKS, GATE, STEP, LV, A, byId, S, ACH, stById, state, earned, notEarned, secrets, totalPts, rankIdx, rankDate, dlg;
const lvName = c => (c.kind === 'tier' ? TIERS[c.level - 1].name : c.kind === 'one' ? ONE.name : LEGEND.name);
function save(action, fields, ok, undo) {
  api.post(action, fields).then(() => { if (ok) toast(ok); }, () => { if (undo) { undo(); toast('Не сохранилось. Проверьте соединение и попробуйте ещё раз'); } });
}

const OBS = { rep: U.rep, mon: ['месяц занятий', 'месяца занятий', 'месяцев занятий'], wk: ['неделя с планом', 'недели с планом', 'недель с планом'], plan: U.plan, race: U.race, stu: U.stu };
const gateOf = (a, i) => GATE[a.obs.of] * STEP[i];
const rateTier = a => a.th.filter(x => (dir(a) === 1 ? a.val >= x : a.val <= x)).length;
const held = a => !!a.obs && !a.none && rateTier(a) > tierOf(a); // the figure is there, the data not yet

/* ---------- coach formatting ---------- */
const catOf = id => CATS.find(c => c.id === id);
const catIdx = id => CATS.findIndex(c => c.id === id);
const fmtDur = m => (m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}` : `${m} мин`);
function fmtN(a, n) { if (a.fmt === 'mo') return n === Infinity ? 'никто не ушёл' : `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} мес.`; if (a.fmt === 'dur') return fmtDur(n); if (a.fmt === 'pct') return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + '%'; if (a.fmt === 'dec') return n.toLocaleString('ru-RU', { maximumFractionDigits: 1 }); return n.toLocaleString('ru-RU'); }
function remaining(a) {
  const t = tierOf(a); if (t === a.th.length) return '';
  if (held(a)) { const left = gateOf(a, t) - a.obs.n; return `нужно ещё ${left} ${plural(left, OBS[a.obs.of])}`; }
  const next = a.th[t];
  if (a.fmt === 'dur') return `быстрее на ${fmtDur(a.val - next)}`;
  const left = Math.round((next - a.val) * 10) / 10;
  if (a.fmt === 'mo') return `ещё ${left.toLocaleString('ru-RU')} мес.`;
  return a.fmt === 'pct' ? `ещё ${left.toLocaleString('ru-RU')}%` : `ещё ${fmtN(a, left)} ${plural(left, U[a.u])}`;
}
function status(a) {
  const t = tierOf(a);
  if (locked(a)) return 'Условие скрыто';
  if (VIEW === 'friend') return t ? `Получено ${fmtDate(a.d[t - 1])}` : '';
  if (a.none) return a.none;
  if (held(a)) return `Нужно больше данных: ${a.obs.n} из ${gateOf(a, t)} ${OBS[a.obs.of][2]}`;
  if (t === a.th.length) return a.kind === 'tier' ? 'Максимальный уровень' : `Получено ${fmtDate(a.d[t - 1])}`;
  const next = a.th[t];
  if (a.fmt === 'dur' || a.fmt === 'pct' || a.fmt === 'mo') return `Сейчас ${fmtN(a, a.val)} · цель ${a.lab[t]}`;
  return `${fmtN(a, a.val)} из ${fmtN(a, next)} ${gen(a.u)}`;
}

const byLevel = (x, y) => points(y) - points(x) || catIdx(x.cat) - catIdx(y.cat);
const SHOW_SLOTS = 6;

/* ---------- render ---------- */
function renderRank() {
  const R = C_RANKS, r = R[rankIdx], nx = R[rankIdx + 1];
  const inRank = nx ? (totalPts - r.from) / (nx.from - r.from) : 1;
  const fill = (rankIdx + (nx ? inRank : 0)) / (R.length - 1);
  const goal = nx ? nx.from : totalPts;
  const steps = R.map((x, i) => {
    const st = i < rankIdx ? 'got' : i === rankIdx ? 'cur' : 'lock';
    return `<div class="step ${st}" role="listitem" aria-label="${esc(x.name)}, от ${fmtInt(x.from)} ${plural(x.from, U.pt)}">${emblem(x)}<span class="sn">${esc(x.name)}</span><span class="sp">${st === 'lock' ? svg('secret', 13) : ''}от ${fmtInt(x.from)}</span>${st === 'cur' && VIEW === 'own' ? '<span class="you">Вы здесь</span>' : ''}</div>`;
  }).join('');
  $('#rank').innerHTML = `<div class="rank-top">${emblem(r)}
      <div><p class="rlab">Тренерское звание</p><p class="rname">${esc(r.name)}</p>
        <div class="rbar pgc"><span class="track"><span style="width:${(totalPts / goal * 100).toFixed(1)}%"></span></span><span class="row"><span><b>${fmtInt(totalPts)}</b>${nx ? ` / ${fmtInt(nx.from)}` : ''}</span></span></div>
      </div>
    </div>
    <div class="road-wrap" id="road-wrap"><div class="road" role="list" aria-label="Тренерские звания"><span class="rail"></span><span class="rail-fill" style="width:calc((100% - 100% / ${R.length}) * ${fill.toFixed(4)})"></span>${steps}</div></div>`;
  const wrap = $('#road-wrap'), cur = wrap.querySelector('.step.cur');
  if (wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = cur.offsetLeft - (wrap.clientWidth - cur.offsetWidth) / 2;
}

const CONSENT = { yes: 'Показ разрешён', pending: 'Ждём ответа', no: 'Показ не разрешён', none: 'Не спрашивали' };
const rankOf = s => RANKS[s.rank];
// a student's achievement, drawn as the same card it is in their own profile
function sbib(ach, tag = 'div', extra = '', who = true) { // who: the student's name under the card, left out inside their own dialog
  const lv = LV[ach.lv], s = stById[ach.sid];
  const top = ach.lv === 'Чемпион' || ach.lv === 'Элита' ? ' champ' : ach.lv === 'Легендарное' ? ' legend' : '';
  const attrs = tag === 'button' ? ` type="button" data-ach="${ach.id}" aria-label="${esc(ach.name)}: ${esc(ach.lv)}, ${esc(s.name)}"` : '';
  return `<${tag} class="bib${top}${extra}"${attrs} style="${look(lv)}">
    <span class="band">${esc(ach.lv)}</span><span class="h a"></span><span class="h b"></span><span class="h c"></span><span class="h d"></span>
    <span class="ttl">${esc(ach.name)}</span><span class="val">${esc(ach.value)}</span>
    <span class="pg"><span class="track"><span style="width:100%"></span></span><span>${who ? `${esc(s.name)} · ${ach.period ? esc(ach.period) : fmtDate(ach.date)}` : `Получено ${fmtDate(ach.date)}`}</span></span>
  </${tag}>`;
}
function renderStudents() {
  $('#st-chip').textContent = S.length;
  if (!S.length) { $('#students').innerHTML = '<div class="empty"><b>Пока нет учеников</b><p>Когда атлет выберет вас тренером, он появится здесь. Его достижения можно будет добавить в витрину, если он разрешит.</p></div>'; return; }
  $('#students').innerHTML = S.map(s => {
    const lastT = [...s.ach].sort((x, y) => y[3].localeCompare(x[3]))[0], last = lastT && ACH[lastT[4]];
    return `<div class="srow">
      <span class="sav" aria-hidden="true">${esc(s.ini)}</span>
      <span class="sn2"><b>${esc(s.name)}</b><small>занимается ${s.months} ${plural(s.months, U.mon)}</small></span>
      <span class="srk">${emblem(rankOf(s))}<span><b>${esc(rankOf(s).name)}</b><small>${fmtInt(s.pts)} ${plural(s.pts, U.pt)}</small></span></span>
      ${last ? `<span class="slast"><span class="mb lv" style="${look(LV[last.lv])}" aria-hidden="true"><i>${esc(last.lv)}</i><b>${esc(last.mini)}</b></span><span><b>${esc(last.name)}</b><small><span class="lvt">${esc(last.lv)} · </span>${fmtDate(last.date)}</small></span></span>` : '<span class="slast"><span><small>Пока ничего не получено</small></span></span>'}
      <button class="btn btn-out sopen" type="button" data-student="${s.id}">Достижения</button>
    </div>`;
  }).join('');
}
function renderShowcase() {
  $('#sh-foot').innerHTML = VIEW === 'own' ? `<button class="linkbtn" type="button" id="vis-open">Кто видит: ${VIS_C[state.vis].short}</button>` : '';
  $('#sh-chip').textContent = `${state.show.length} из ${SHOW_SLOTS}`;
  const cells = state.show.map(id => sbib(ACH[id], 'button'));
  $('#sh-h').parentNode.querySelector('.edit').hidden = !S.length || VIEW !== 'own';
  $('#sh-chip').hidden = VIEW !== 'own';
  if (VIEW === 'own' ? !S.length && !state.show.length : !state.show.length) { $('#showcase').innerHTML = '<div class="empty" style="grid-column:1/-1">Витрина заполнится, когда ученики получат достижения и разрешат их показывать.</div>'; return; } // another person sees the cards without the students list
  if (VIEW === 'own') for (let i = state.show.length; i < SHOW_SLOTS; i++) cells.push(`<button class="slot" type="button" data-edit="1">Свободное место<small>Добавить достижение ученика</small></button>`);
  $('#showcase').innerHTML = cells.join('');
}
// opened secrets in their own «Легендарные» row; then every achievement from the highest level down;
// the closed secrets close it as one strip. Another person sees the strengths only: up to five, from Gold up
function renderAll() {
  const legends = earned.filter(a => a.kind === 'secret');
  const group = (title, chip, list) => !list.length ? '' : `<div class="cgrp"><div class="ph"><h3>${title}</h3><span class="chip">${chip}</span></div><div class="bibs c5">${list.map(a => bib(a)).join('')}</div></div>`;
  if (VIEW === 'friend') {
    $('#all-h').textContent = 'Сильные стороны';
    const best = [...legends, ...earned.filter(a => a.kind === 'tier' && tierOf(a) >= 3).sort(byLevel)].slice(0, 5);
    $('#legends').innerHTML = '';
    $('#all').innerHTML = best.length ? `<div class="bibs c5">${best.map(a => bib(a)).join('')}</div>` : '<div class="empty">Пока нет достижений от Золота и выше</div>';
    return;
  }
  $('#legends').innerHTML = group('Легендарные', legends.length, legends);
  const strip = !secrets.length ? '' : `<div class="sstrip" style="${look(SECRET)}"><span class="band">Секретные · ${secrets.length}</span>
    <div class="sbody"><p class="st"><b>${secrets.length} ${plural(secrets.length, ['секретное достижение', 'секретных достижения', 'секретных достижений'])}</b>Условия скрыты · каждое откроется легендарным, +${LEGEND.pts} очков</p>
    <div class="sbibs">${secrets.map(a => `<button class="sb" type="button" data-open="${a.id}" aria-label="Секретное достижение"><span class="mb" style="${look(SECRET)}" aria-hidden="true"><i></i><b>?</b></span></button>`).join('')}</div></div></div>`;
  const tiers = A.filter(a => a.kind === 'tier');
  $('#all').innerHTML = `<div class="bibs c5">${tiers.sort(byLevel).map(a => bib(a)).join('')}</div>` + strip;
}

/* ---------- dialogs ---------- */
const closeBtn = `<button class="x" type="button" id="d-close" aria-label="Закрыть"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round" aria-hidden="true">${ICON.close}</svg></button>`;
function show(html, narrow = false) { dlg.classList.toggle('narrow', narrow); $('#dlg-body').innerHTML = html; if (!dlg.open) dlg.showModal(); }
// how the figure came about: the coach's own data, the S10 average and the value with both
function dataNote(a) {
  const o = a.obs;
  if (!o) return '';
  if (!o.n) return '<p class="dnote"><b>Пока нет данных.</b> Значение появится с первым результатом.</p>';
  const unit = OBS[o.of][2], Unit = unit[0].toUpperCase() + unit.slice(1);
  const fact = o.of === 'mon' ? `${Unit} за всё время: ${fmtInt(o.n)}, из них с продлением: ${fmtInt(o.x)}. ${o.n > o.x ? `Ученик в среднем остаётся ${fmtN(a, a.val)}` : 'Пока никто не ушёл'}`
    : o.v !== undefined ? `${Unit} за всё время: ${fmtInt(o.n)}, ${o.of === 'rep' ? 'обычное время ответа' : 'в среднем'} — ${fmtN(a, o.v)}` : `${Unit} за всё время: ${o.x} из ${o.n}, это ${fmtN(a, a.val)}`;
  const t = tierOf(a), g = held(a) ? gateOf(a, t) : 0;
  const hold = held(a) ? ` <b>По цифре это уже «${levelName(a, rateTier(a) - 1)}».</b> Чтобы подтвердить, нужно больше данных: уровень «${levelName(a, t)}» откроется, когда будет ${g} ${plural(g, OBS[o.of])}, сейчас ${o.n}.` : '';
  return `<p class="dnote">${fact.replace(/\.$/, '')}.${hold}</p>`;
}
// everyone behind a counter, newest first; a student who left stays on the list
function whoList(a) {
  if (VIEW !== 'own') return `<p class="dnote"><b>${a.count} ${plural(a.count, U.stu)}</b> за всё время</p>`;
  return `<h3 class="sdt">Выбежали из 3 часов · ${a.count}</h3><div class="ladder">${[...a.who].sort((x, y) => y.date.localeCompare(x.date)).map(w => `<div class="lr"><span class="sw" style="--tc:var(--t-leg)"></span><span class="tn">${esc(w.name)}</span><span class="th">${w.time}</span><span class="st ok">${fmtDate(w.date)}${w.left ? '<small>больше не занимается</small>' : ''}</span></div>`).join('')}</div>`;
}
// a coach achievement with its eight levels
function openAchievement(id) {
  const a = byId[id], t = tierOf(a), lock = locked(a);
  const ladder = lock ? '' : `<div class="ladder">${a.th.map((_, i) => {
    const lvi = levelAt(a, i);
    const where = `<small>у ${fmtPct(rarity(a, i))} тренеров</small>`;
    const need = VIEW === 'own' && a.obs && a.obs.n < gateOf(a, i) ? `<small>нужно ${gateOf(a, i)} ${plural(gateOf(a, i), OBS[a.obs.of])}</small>` : where;
    const st = i < t ? `<span class="st ok">${fmtDate(a.d[i])}${where}</span>` : i === t && !a.none && VIEW === 'own' ? `<span class="st nx">${esc(remaining(a))}${need}</span>` : `<span class="st">—${need}</span>`;
    const label = a.kind === 'tier' ? thLabel(a, i) : a.got;
    return `<div class="lr"><span class="sw" style="--tc:${lvi.c}"></span><span class="tn">${levelName(a, i)}</span><span class="th">${esc(label)} · +${lvi.pts}</span>${st}</div>`;
  }).join('')}</div>`;
  const pg = (VIEW === 'own' && !maxed(a) && !lock && !a.none) ? `<div class="dpg pgc"><span class="track"><span style="width:${(progress(a) * 100).toFixed(1)}%"></span></span><span class="row"><b>${Math.floor(progress(a) * 100)}%</b><span>${esc(status(a))}</span></span></div>` : '';
  show(`<div class="dl">${closeBtn}${bib(a, 'div', ' big')}<div>
      <p class="dcat">${esc(catOf(a.cat).name)}</p>
      <h2 id="dlg-t">${esc(lock ? 'Секретное достижение' : a.name)}</h2>
      <p class="dcond">${esc(lock ? 'Условие откроется вместе с достижением.' : a.cond)}</p>
      ${lock ? `<p class="dnote">Когда откроете, оно станет <b>легендарным</b> и даст +${LEGEND.pts} очков. Открыто у ${fmtPct(a.r)} тренеров S10.</p>` : `<p class="dnote">Считается по данным: ${esc(a.src)}</p>`}
      ${VIEW === 'own' ? dataNote(a) : ''}${ladder}${t && a.who ? whoList(a) : ''}${pg}${t && a.ev && !a.who ? `<p class="dev">Последний уровень: <b>${esc(a.ev)}</b></p>` : ''}
    </div></div>`);
}
// a student's achievements, as the coach sees them
function openStudent(sid) {
  const s = stById[sid], r = rankOf(s);
  const link = s.page ? `<a class="btn btn-out" href="${esc(SITE + s.page)}" style="text-decoration:none">Открыть все достижения</a>` : '';
  show(`<div class="sd">${closeBtn}
      <div class="sdh">${emblem(r)}<div><p class="dcat">Ученик · занимается ${s.months} ${plural(s.months, U.mon)}</p><h2 id="dlg-t">${esc(s.name)}</h2>
        <p class="dnote"><b>${esc(r.name)}</b> · ${fmtInt(s.pts)} ${plural(s.pts, U.pt)} · ${esc(CONSENT[s.consent])}</p></div></div>
      <h3 class="sdt">Получено за время занятий</h3>
      <div class="bibs c3">${s.ach.map(([, , , , id]) => sbib(ACH[id], 'div', '', false)).join('')}</div>
      <p class="dnote sdn"><b>На подходе:</b> ${esc(s.near)}</p>
      <div class="dact">${link}</div>
    </div>`);
}
// choose what the public profile shows; only achievements the student allowed
function openPicker() {
  const groups = S.map(s => {
    const head = s.consent === 'none'
      ? `<button class="btn btn-out ask" type="button" data-ask="${s.id}">Попросить разрешение</button>`
      : `<span class="cst ${s.consent}">${esc(CONSENT[s.consent])}</span>`;
    const rows = s.ach.map(([, , , , id]) => {
      const a = ACH[id], on = state.show.includes(id), can = s.consent === 'yes';
      const btn = !can ? '' : on ? `<button class="linkbtn" type="button" data-pick="${id}">Убрать</button>`
        : `<button class="linkbtn" type="button" data-pick="${id}"${state.show.length >= SHOW_SLOTS ? ' disabled' : ''}>Добавить</button>`;
      return `<div class="prow${can ? '' : ' off'}"><span class="mb" style="${look(LV[a.lv])}" aria-hidden="true"><i></i><b>${esc(a.mini)}</b></span><span><b>${esc(a.name)}</b><small>${esc(a.lv)} · ${esc(a.value)} · ${fmtDate(a.date)}</small></span>${btn}</div>`;
    }).join('');
    return `<div class="pgrp"><div class="pgh"><b>${esc(s.name)}</b>${head}</div>${rows}</div>`;
  }).join('');
  show(`<div class="sd">${closeBtn}<h2 id="dlg-t">Витрина учеников</h2>
      <p class="dnote">${state.show.length} из ${SHOW_SLOTS} мест · показываются только достижения, которые ученик получил у вас и разрешил показывать</p>
      <div class="plist">${groups}</div></div>`);
}
/* ---------- who sees, the moments, the profile ---------- */
const VIS_C = {
  all: { short: 'все', name: 'Все', note: 'Любой, кто откроет ваш профиль тренера' },
  students: { short: 'мои ученики', name: 'Мои ученики', note: 'Только те, кто у вас занимается' },
  me: { short: 'только я', name: 'Только я', note: 'Звание и достижения видны только вам' },
};
function openVis() {
  show(`<div class="sd">${closeBtn}
    <h2 id="dlg-t">Кто видит ваши достижения</h2>
    <p class="dnote">Звание, сильные стороны и витрина учеников в вашем профиле тренера</p>
    <fieldset class="opts"><legend class="vh">Кто видит</legend>${Object.entries(VIS_C).map(([k, v]) => `<label class="opt"><input type="radio" name="vis" value="${k}"${state.vis === k ? ' checked' : ''}><span><b>${v.name}</b><small>${v.note}</small></span></label>`).join('')}</fieldset>
    <p class="dnote">Список учеников, цифры и прогресс видите только вы.</p>
    <div class="dact"><button class="btn btn-cta" type="button" id="vis-done">Готово</button></div>
  </div>`, true);
}
// the moment a level comes: the card, its points and the rank bar moving on by them
function openLevelUp(id) {
  const a = byId[id], i = tierOf(a) - 1, lv = levelAt(a, i);
  const r = C_RANKS[rankIdx], nx = C_RANKS[rankIdx + 1], goal = nx ? nx.from : totalPts, pct = p => `${Math.min(100, p / goal * 100).toFixed(1)}%`;
  const value = (a.got || `${bibNo(a, i)} ${bibUnit(a, i).replace(/ на .*$/, '')}`).trim();
  dlg.dataset.id = id;
  show(`<div class="dl cel">${closeBtn}${bib(a, 'div', ' big')}<div>
    <p class="eb">Новый уровень · ${fmtDate(a.d[i])}</p>
    <h2 id="dlg-t">${esc(a.name)}</h2>
    <p class="dcond">${lv.name} · ${esc(value)}</p>
    <p class="pts">+${lv.pts}<small>${plural(lv.pts, U.pt)}</small></p>
    <div class="crank">${emblem(r)}<span class="pgc"><span class="row"><b>${r.name}</b><span>${fmtInt(totalPts)}${nx ? ` / ${fmtInt(nx.from)}` : ''}</span></span><span class="track"><span id="cel-bar" style="width:${pct(totalPts - lv.pts)}"></span></span></span></div>
    <p class="dnote">Этот уровень есть у ${fmtPct(rarity(a, i))} тренеров S10</p>
    <div class="dact"><button class="btn btn-cta" type="button" id="l-share">Поделиться</button><button class="btn btn-out" type="button" id="l-all">Все достижения</button></div>
  </div></div>`);
  requestAnimationFrame(() => requestAnimationFrame(() => { $('#cel-bar').style.width = pct(totalPts); }));
}
function openRankUp() {
  const r = C_RANKS[rankIdx], nx = C_RANKS[rankIdx + 1];
  show(`<div class="sd">${closeBtn}<div class="ru">${emblem(r)}
    <p class="eb">Новое тренерское звание${rankDate ? ` · ${fmtDate(rankDate)}` : ''}</p>
    <h2 id="dlg-t">${r.name}</h2>
    <p class="dcond">У вас ${fmtInt(totalPts)} ${plural(totalPts, U.pt)}.${nx ? ` До звания «${nx.name}» осталось ${fmtInt(nx.from - totalPts)}.` : ' Это высшее звание.'}</p>
    <div class="dact"><button class="btn btn-cta" type="button" id="r-share">Поделиться</button><button class="btn btn-out" type="button" id="r-road">Все звания</button></div>
  </div></div>`, true);
}
// someone else opens a coach who hid the achievements
function renderHidden(coach) {
  $('main').innerHTML = `<h1 class="vh">Достижения тренера</h1><div class="phead"><span class="cav" aria-hidden="true">${esc(coach.initials)}</span><div><p class="cn">${esc(coach.name)}</p><p class="cm">Тренер S10</p></div></div>
    <div class="state"><h2>${esc(coach.name)} скрывает свои достижения</h2><p>Звание и достижения видны только самому тренеру.</p></div>`;
}

/* ---------- notifications ---------- */
let bellSeen = false;
const BELL_MAX = 10; // the newest; opening the bell marks every unread one as read
function notes() {
  if (VIEW !== 'own') return [];
  const mb = (lv, n) => `<span class="mb" style="${look(lv)}" aria-hidden="true"><i></i><b>${esc(n)}</b></span>`;
  return (D.notifications || []).map(x => {
    const fresh = x.unread;
    if (x.type === 'consent_pending') return { id: x.id, key: `st:${x.athlete.id}`, fresh, html: `<span class="ava" aria-hidden="true">${esc(x.athlete.initials)}</span><span class="nt"><b>Ждём ответа: ${esc(x.athlete.name)}</b><small>Запрос на показ достижений отправлен</small></span>` };
    if (x.type === 'consent_answer') return { id: x.id, key: `st:${x.athlete.id}`, fresh, html: `<span class="ava" aria-hidden="true">${esc(x.athlete.initials)}</span><span class="nt"><b>${esc(x.athlete.name)} ${x.answer === 'yes' ? 'разрешает' : 'не разрешает'} показывать достижения</b><small>${x.answer === 'yes' ? 'Добавьте их в витрину учеников' : 'Его карточек не будет в витрине'} · ${fmtDate(x.date)}</small></span>` };
    if (x.type === 'student_level') { const c = x.card, lv = LV[lvName(c)]; return { id: x.id, key: `ach:${c.key}`, fresh, html: `${mb(lv, c.number)}<span class="nt"><b>Новое у ученика: «${esc(c.name)}»</b><small>${esc(c.athlete_name)} · ${esc(lv.name)} · ${fmtDate(c.date)}</small></span>` }; }
    if (x.type === 'counter') return { id: x.id, key: `lv:${x.achievement}`, fresh, html: `${mb(LEGEND, `${x.count}×`)}<span class="nt"><b>«${esc(byId[x.achievement] ? byId[x.achievement].name : '')}»: теперь ${x.count}×</b><small>${esc(x.name)} · ${esc(x.time)} · ${fmtDate(x.date)}</small></span>` };
    if (x.type === 'rank') { const r = C_RANKS[x.rank]; return { id: x.id, key: 'rank:', fresh, html: `${emblem(r)}<span class="nt"><b>Новое звание: ${esc(r.name)}</b><small>от ${fmtInt(r.from)} ${plural(r.from, U.pt)} · ${fmtDate(x.date)}</small></span>` }; }
    const a = byId[x.achievement];
    if (x.type !== 'level' || !a || x.level > a.d.length) return null;
    const lv = levelAt(a, x.level - 1);
    return { id: x.id, key: `lv:${a.id}`, fresh, html: `${miniBib(a, x.level - 1)}<span class="nt"><b>Новый уровень: «${esc(a.name)}»</b><small>${esc(lv.name)} · +${lv.pts} ${plural(lv.pts, U.pt)} · ${fmtDate(x.date)}</small></span>` };
  }).filter(x => x && (x.key.slice(0, 4) !== 'ach:' || ACH[x.key.slice(4)])).slice(0, BELL_MAX);
}
function renderBell() {
  const n = notes(), fresh = bellSeen ? 0 : n.filter(x => x.fresh).length;
  const dot = $('#bell-dot');
  dot.hidden = !fresh || !$('#nmenu').hidden; dot.textContent = fresh;
  $('#bell').setAttribute('aria-label', fresh ? `Уведомления, новых: ${fresh}` : 'Уведомления');
  $('#nmenu').innerHTML = `<h2>Уведомления</h2>${n.length
    ? n.map(x => `<button class="ni${x.fresh && !bellSeen ? ' new' : ''}" type="button" data-note="${x.key}">${x.html}</button>`).join('')
    : '<p class="nempty">Пока нет уведомлений. Здесь появятся ваши новые уровни, достижения учеников и ответы на запросы.</p>'}`;
}
function toggleBell(open) {
  const m = $('#nmenu'); if (!m) return; open = open ?? m.hidden;
  if (open === !m.hidden) return;
  m.hidden = !open; $('#bell').setAttribute('aria-expanded', open);
  if (open) { $('#bell-dot').hidden = true; const ids = (D.notifications || []).filter(x => x.unread).map(x => x.id); if (ids.length) save('seen', { notifications: JSON.stringify(ids) }); }
  else { bellSeen = true; renderBell(); }
}
/* ---------- whole-page states ---------- */
function renderLoading() {
  $('main').setAttribute('aria-busy', 'true');
  $('main').innerHTML = `<h1 class="vh">Достижения тренера</h1><p class="vh" role="status">Загружаем достижения</p>
    <div class="phead"><span class="cav" aria-hidden="true">Т</span><span class="sk-col"><span class="sk sk-line sk-w1"></span><span class="sk sk-line sk-w2"></span></span></div>
    <div class="grid first"><div class="rank s12 sk-rank"><span class="sk sk-emb"></span><span class="sk-col"><span class="sk sk-line sk-w1"></span><span class="sk sk-line"></span><span class="sk sk-line sk-w2"></span></span></div></div>
    <div class="grid"><div class="panel s12">${'<span class="sk sk-panel"></span>'.repeat(4)}</div></div>
    <div class="bibs c5">${'<span class="sk sk-bib"></span>'.repeat(5)}</div>`;
}
function renderError() {
  $('main').innerHTML = `<h1 class="vh">Достижения тренера</h1><div class="state" role="alert"><h2>Не удалось загрузить достижения</h2>
    <p>Проверьте соединение и попробуйте ещё раз. Уровни и очки сохранены, они никуда не делись.</p>
    <button class="btn btn-cta" type="button" id="retry">Повторить</button></div>`;
}

/* ---------- the page ---------- */
const MAIN = () => `  <h1 class="vh">Достижения тренера</h1>
  <div class="phead">
    <span class="cav" aria-hidden="true">${esc(COACH.initials)}</span>
    <div><p class="cn">${esc(COACH.name)}</p><p class="cm" id="cm"></p></div>
  </div>

  <div class="grid first">
    <section class="rank s12" id="rank" aria-label="Тренерское звание"></section>
  </div>

  <div class="grid">
    <section class="panel s12" aria-labelledby="st-h">
      <div class="ph"><h2 id="st-h">Ученики</h2><span class="chip" id="st-chip"></span></div>
      <div class="slist" id="students"></div>
    </section>
  </div>

  <div class="grid">
    <section class="panel s12" aria-labelledby="sh-h">
      <div class="ph"><h2 id="sh-h">Витрина учеников</h2><span class="chip" id="sh-chip"></span><button class="linkbtn edit" type="button" data-edit="1">Изменить</button></div>
      <div class="bibs c6" id="showcase"></div>
      <div class="foot" id="sh-foot"></div>
    </section>
  </div>

  <section aria-labelledby="all-h">
    <div class="allh"><h2 id="all-h">Достижения тренера</h2></div>
    <div id="legends"></div>
    <div id="all"></div>
  </section>`;
function boot(data) {
  D = data; VIEW = D.viewer === 'self' ? 'own' : 'friend';
  useLevels(D, D.athlete_ranks); // the students' ranks are athlete ranks
  C_RANKS = RANKS.map((r, i) => ({ ...r, name: D.ranks[i].name, from: D.ranks[i].from }));
  COACH = D.coach; CATS = D.categories || []; GATE = D.gates.base; STEP = D.gates.step;
  LV = Object.fromEntries([...TIERS, ONE, LEGEND].map(l => [l.name, l]));
  A = (D.items || D.strengths || []).map(x => {
    const a = fromItem(x);
    if (x.data_unit && x.data) a.obs = { of: x.data_unit, ...x.data };
    if (a.noValue) { a.none = x.none_text || 'Пока нет данных'; a.val = dir(a) === -1 ? a.start : 0; }
    // a figure already above its level, the data not yet enough to prove it: the bar fills with the data still needed
    if (a.obs && !a.none && tierOf(a) < a.th.length && rateTier(a) > tierOf(a)) a.capProg = a.obs.n / gateOf(a, tierOf(a));
    return a;
  });
  byId = Object.fromEntries(A.map(a => [a.id, a]));
  const card = c => ({ id: c.key, sid: c.athlete_id, name: c.name, lv: lvName(c), value: c.text, date: c.date, mini: c.number, period: c.period }); // period: «занимался в 2024–2025», a student who left
  S = (D.students || []).map(s => ({ id: s.id, name: s.name, ini: s.initials, months: s.months, rank: s.rank, pts: s.points, consent: s.consent, near: s.near, page: s.page,
    ach: s.achievements.map(c => [c.name, lvName(c), c.text, c.date, c.key, c.number]) }));
  ACH = {}; S.forEach(s => s.ach.forEach(([name, lv, value, date, id, mini]) => { ACH[id] = { id, sid: s.id, name, lv, value, date, mini }; }));
  stById = Object.fromEntries(S.map(s => [s.id, s]));
  (D.showcase || []).forEach(c => { // a card of a student who left, or the public view with no students list
    if (!ACH[c.key]) ACH[c.key] = card(c);
    if (!stById[c.athlete_id]) stById[c.athlete_id] = { id: c.athlete_id, name: c.athlete_name, gone: true, ach: [] };
  });
  state = { show: (D.showcase || []).map(c => c.key), vis: D.visibility ? D.visibility.audience : 'all' };
  earned = A.filter(a => tierOf(a) > 0);
  notEarned = A.filter(a => tierOf(a) === 0 && a.kind !== 'secret');
  secrets = A.filter(locked);
  totalPts = D.points; rankIdx = D.rank;
  const re = (D.rank_events || []).find(r => r.rank === rankIdx); rankDate = re ? re.date : null;
}
let wired = false;
function wire() {
  if (wired) return;
  wired = true; dlg = $('#dlg');
  dlg.addEventListener('click', e => {
    if (e.target === dlg || e.target.closest('#d-close')) { dlg.close(); return; }
    const p = e.target.closest('[data-pick]');
    if (p) {
      const id = p.dataset.pick, i = state.show.indexOf(id), was = [...state.show];
      if (i >= 0) state.show.splice(i, 1); else if (state.show.length < SHOW_SLOTS) state.show.push(id);
      renderShowcase(); openPicker();
      save('coach_showcase', { keys: JSON.stringify(state.show) }, null, () => { state.show = was; renderShowcase(); if (dlg.open) openPicker(); });
      return;
    }
    const k = e.target.closest('[data-ask]');
    if (k) { const s = stById[k.dataset.ask]; s.consent = 'pending'; openPicker(); save('consent_request', { athlete: s.id }, `${s.name} получит запрос на показ своих достижений`, () => { s.consent = 'none'; if (dlg.open) openPicker(); }); }
  });

  dlg.addEventListener('click', e => {
    if (e.target.closest('#vis-done')) dlg.close();
    if (e.target.closest('#l-share')) copy(`Новый уровень на S10.run: «${byId[dlg.dataset.id].name}»`);
    if (e.target.closest('#r-share')) copy(`Моё тренерское звание на S10.run: ${C_RANKS[rankIdx].name}`);
    const go = e.target.closest('#l-all') ? '#all-h' : e.target.closest('#r-road') ? '#rank' : '';
    if (go) { dlg.close(); $(go).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  dlg.addEventListener('change', e => {
    if (e.target.name !== 'vis') return;
    const was = state.vis;
    state.vis = e.target.value; renderShowcase();
    save('coach_visibility', { audience: state.vis }, `Достижения видят: ${VIS_C[state.vis].short}`, () => { state.vis = was; renderShowcase(); });
  });
  ROOT.addEventListener('click', e => {
    if (dlg.contains(e.target)) return;
    const o = e.target.closest('[data-open]'); if (o) { openAchievement(o.dataset.open); return; }
    const st = e.target.closest('[data-student]'); if (st) { openStudent(st.dataset.student); return; }
    const ed = e.target.closest('[data-edit]'); if (ed) { openPicker(); return; }
    const ac = e.target.closest('[data-ach]'); if (ac && VIEW === 'own' && !stById[ACH[ac.dataset.ach].sid].gone) openStudent(ACH[ac.dataset.ach].sid); // a student who left has no dialog
  });

  ROOT.addEventListener('click', e => {
    const nt = e.target.closest('[data-note]');
    if (nt) {
      toggleBell(false);
      const [k, v] = nt.dataset.note.split(':');
      if (k === 'lv') openAchievement(v); else if (k === 'st') openStudent(v); else if (k === 'rank') openRankUp(); else openStudent(ACH[v].sid);
      return;
    }
    if (e.target.closest('#bell')) { toggleBell(); return; }
    if (!e.target.closest('#nmenu')) toggleBell(false);
    if (e.target.closest('#retry')) load();
    if (e.target.closest('#vis-open')) openVis();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#nmenu') && !$('#nmenu').hidden) { toggleBell(false); $('#bell').focus(); } });
}
async function load() {
  wire();
  if (!opts.widget) renderLoading();
  let data;
  try { data = await api.get(opts.widget ? 'coach_widget' : 'coach', opts.id); }
  catch (e) {
    if (opts.widget) { $('main').innerHTML = ''; return; }
    if (e.body && e.body.hidden) { renderHidden(e.body.coach); return; }
    renderError(); return;
  }
  boot(data);
  if (opts.widget) { renderWidget(); return; }
  $('main').removeAttribute('aria-busy');
  $('main').innerHTML = MAIN();
  $('#bell').hidden = VIEW !== 'own';
  $('#cm').textContent = `Тренер S10 · ${COACH.students} ${plural(COACH.students, U.stu)}`;
  if (VIEW === 'friend') $('#students').closest('section').hidden = true; // the students are the coach's own business
  renderBell(); renderRank(); renderStudents(); renderShowcase(); renderAll();
  celebrate();
}
// what came since the last visit: the most valuable new level first, the new rank after it; then both are marked as shown
function celebrate() {
  if (VIEW !== 'own') return;
  const ev = (D.events || []).filter(e => !e.celebrated && byId[e.achievement] && byId[e.achievement].kind === 'tier');
  const rk = (D.rank_events || []).filter(e => !e.celebrated && e.rank === rankIdx);
  if (!ev.length && !rk.length) return;
  const best = ev.map(e => ({ e, pts: levelAt(byId[e.achievement], e.level - 1).pts })).sort((x, y) => y.pts - x.pts)[0];
  if (best) { openLevelUp(best.e.achievement); if (rk.length) dlg.addEventListener('close', () => openRankUp(), { once: true }); }
  else openRankUp();
  save('celebrated', { events: JSON.stringify((D.events || []).filter(e => !e.celebrated).map(e => e.id)), rank_events: JSON.stringify(rk.map(e => e.id)) });
}
// the block in the coach's profile, as anyone who opens it sees it: the rank with its bar, three strengths, a link to them all
function renderWidget() {
  const r = C_RANKS[rankIdx], nx = C_RANKS[rankIdx + 1], goal = nx ? nx.from : totalPts;
  const page = `${SITE}/achievements/coach?id=${encodeURIComponent(COACH.id)}`;
  $('main').innerHTML = `<section class="pfa" aria-labelledby="pfa-h">
      <div class="ph"><h2 id="pfa-h">Достижения тренера</h2><a class="act" href="${esc(page)}">Все достижения</a></div>
      <a class="pfa-rank" href="${esc(page)}">${emblem(r)}<span><span class="rn">${esc(r.name)}</span><span class="pgc"><span class="track"><span style="width:${(totalPts / goal * 100).toFixed(1)}%"></span></span><span class="row"><span><b>${fmtInt(totalPts)}</b>${nx ? ` / ${fmtInt(nx.from)}` : ''}</span></span></span></span></a>
      <div class="stack">${A.length ? A.map(a => { const t = tierOf(a); return `<button class="shw" type="button" data-open="${a.id}">${miniBib(a, t - 1)}<span><span class="n">${esc(a.name)}${a.count ? ` · ${a.count}×` : ''}</span><span class="m">${esc(levelOf(a, t).name)} · ${fmtDate(a.d[t - 1])}</span></span></button>`; }).join('') : '<div class="empty">Пока нет достижений от Золота и выше</div>'}</div>
    </section>`;
}
return { load };
}
