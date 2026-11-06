/* S10 achievements: the athlete's page (their own or another athlete's) and the block in their profile.
   Everything is drawn from GET /apiweb/achievements.php?action=athlete|widget (contract/API.md): the server counts the
   levels, the points and the rank, the page only shows them and sends the athlete's choices back. */
function athleteApp(ROOT, api, me, opts) {
/*CORE*/
const SITE = opts.site; // '' on s10.run, the site's full address elsewhere
let D, VIEW, ATHLETE, CATS, A, byId, state, earned, notEarned, secrets, almost, totalPts, rankIdx, rankDate, NEW, dlg;
const catOf = id => CATS.find(c => c.id === id);
const catIdx = id => CATS.findIndex(c => c.id === id);
// a write: the page changes at once; if the server refuses, undo puts it back and the athlete is told
function save(action, fields, ok, undo) {
  api.post(action, fields).then(() => { if (ok) toast(ok); }, () => { if (undo) { undo(); toast('Не сохранилось. Проверьте соединение и попробуйте ещё раз'); } });
}

function remaining(a) {
  const t = tierOf(a); if (t === a.th.length || a.none) return '';
  const next = a.th[t];
  if (dir(a) === -1) return a.fmt === 'rank' ? `ещё ${a.val - next} ${plural(a.val - next, U.place)}` : `быстрее на ${fmtTime(a.val - next)}`;
  const left = Math.round((next - a.val) * 10) / 10;
  return `ещё ${fmtN(a, left)} ${plural(left, U[a.u])}`;
}
function status(a) {
  const t = tierOf(a);
  if (locked(a)) return 'Условие скрыто';
  if (VIEW === 'friend') return t ? `Получено ${fmtDate(a.d[t - 1])}` : '';
  if (a.none) return 'Пока нет результата';
  if (t === a.th.length) return a.kind === 'tier' ? 'Максимальный уровень' : `Получено ${fmtDate(a.d[t - 1])}`;
  const next = a.th[t];
  if (dir(a) === -1) return a.fmt === 'rank' ? `${a.val}-е место · цель ${a.lab[t]}` : `Сейчас ${fmtTime(a.val)} · цель ${a.lab[t]}`;
  if (next === 1 && a.val === 0) return 'Ещё не было';
  return `${fmtN(a, a.val)} из ${fmtN(a, next)} ${gen(a.u)}`;
}



/* ---------- render ---------- */
function renderRank() {
  const r = RANKS[rankIdx], nx = RANKS[rankIdx + 1];
  const inRank = nx ? (totalPts - r.from) / (nx.from - r.from) : 1;
  const fill = (rankIdx + (nx ? inRank : 0)) / (RANKS.length - 1);
  const goal = nx ? nx.from : totalPts; // the bar and the figure under it both read points / the next rank
  const steps = RANKS.map((x, i) => {
    const st = i < rankIdx ? 'got' : i === rankIdx ? 'cur' : 'lock';
    return `<div class="step ${st}" role="listitem" aria-label="${esc(x.name)}, от ${fmtInt(x.from)} ${plural(x.from, U.pt)}">${emblem(x)}<span class="sn">${esc(x.name)}</span><span class="sp">${st === 'lock' ? svg('secret', 13) : ''}от ${fmtInt(x.from)}</span>${st === 'cur' && VIEW === 'own' ? '<span class="you">Вы здесь</span>' : ''}</div>`;
  }).join('');
  $('#rank').innerHTML = `<div class="rank-top">${emblem(r)}
      <div><p class="rname">${esc(r.name)}</p>
        <div class="rbar pgc"><span class="track"><span style="width:${(totalPts / goal * 100).toFixed(1)}%"></span></span><span class="row"><span><b>${fmtInt(totalPts)}</b>${nx ? ` / ${fmtInt(nx.from)}` : ''}</span></span></div>
      </div>
    </div>
    <div class="road-wrap" id="road-wrap"><div class="road" role="list" aria-label="Звания"><span class="rail"></span><span class="rail-fill" style="width:calc((100% - 100% / ${RANKS.length}) * ${fill.toFixed(4)})"></span>${steps}</div></div>`;
  const wrap = $('#road-wrap'), cur = wrap.querySelector('.step.cur');
  if (wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = cur.offsetLeft - (wrap.clientWidth - cur.offsetWidth) / 2;
}

const ALMOST_SHOWN = 4; // as many rows as keep the panel level with the three showcase cards
function renderAlmost() {
  if (!almost.length) {
    $('#al-chip').textContent = 0; $('#al-foot').innerHTML = '';
    $('#almost').innerHTML = NEW
      ? '<div class="empty"><b>Достижения начнут считаться после первой пробежки</b><p>Подключите Strava или Garmin: прошлые тренировки тоже засчитаются, и первые уровни придут сразу.</p><a class="btn btn-out" href="https://s10.run/profile">Подключить часы</a></div>'
      : '<div class="empty">Сейчас нет достижений, до следующего уровня которых осталось меньше 30%.</div>';
    return;
  }
  const list = state.showAllAlmost ? almost : almost.slice(0, ALMOST_SHOWN);
  $('#al-chip').textContent = almost.length;
  $('#almost').innerHTML = list.map(a => {
    const t = tierOf(a), lvName = a.kind === 'tier' ? TIERS[t].name : 'Один уровень';
    const act = a.act ? `<a class="act" href="${esc(SITE + a.act[1])}">${esc(a.act[0])}</a>` : `<span></span>`;
    return `<div class="rowc al">
      ${miniBib(a, t, true)}
      <span class="t"><button class="linkbtn n" type="button" data-open="${a.id}">${esc(a.name)}</button><span class="m">${esc(lvName)} · +${nextPoints(a)} ${plural(nextPoints(a), U.pt)} · ${esc(a.note || status(a))}</span></span>
      <span class="pgc"><span class="track"><span style="width:${(progress(a) * 100).toFixed(1)}%"></span></span><span class="row"><b>${Math.floor(progress(a) * 100)}%</b><span>${esc(remaining(a))}</span></span></span>
      ${act}
    </div>`;
  }).join('');
  const rest = almost.length - ALMOST_SHOWN;
  $('#al-foot').innerHTML = rest > 0
    ? `<button class="linkbtn" type="button" id="al-more">${state.showAllAlmost ? 'Свернуть' : `Показать ещё ${rest}`}</button>`
    : '';
}

function showcaseRows() {
  return state.pinned.map(id => byId[id]).map(a => {
    const t = tierOf(a);
    return `<button class="shw" type="button" data-open="${a.id}">${miniBib(a, t - 1)}<span><span class="n">${esc(a.name)}</span><span class="m">${esc(levelOf(a, t).name)} · ${fmtDate(a.d[t - 1])}</span></span></button>`;
  });
}
function renderShowcase() {
  $('#sh-chip').textContent = `${state.pinned.length} из 3`;
  $('#sh-chip').hidden = VIEW === 'friend';
  const rows = showcaseRows();
  if (VIEW === 'own') for (let i = state.pinned.length; i < 3; i++) rows.push(`<div class="empty">Свободное место</div>`);
  else if (!rows.length) rows.push('<div class="empty">Пока ничего не закреплено</div>');
  $('#showcase').innerHTML = rows.join('');
  $('#sh-foot').innerHTML = VIEW === 'own' ? `<button class="linkbtn" type="button" id="vis-open">Кто видит: ${VIS[state.vis].short}</button>` : '';
}

function renderRecent() {
  const ev = [];
  A.forEach(a => a.d.forEach((d, i) => ev.push({ a, i, d })));
  ev.sort((x, y) => y.d.localeCompare(x.d));
  if (!ev.length) { $('#recent').innerHTML = '<div class="empty">Пока ничего не получено. Первые уровни появятся здесь сразу после первой пробежки.</div>'; return; }
  $('#recent').innerHTML = ev.slice(0, 6).map(({ a, i, d }) => {
    const lv = levelAt(a, i), isLast = i === a.d.length - 1;
    return `<button class="rcard" type="button" data-open="${a.id}">
      <span class="mb" style="${look(lv)}" aria-hidden="true"><i></i><b>${esc(bibNo(a, i))}</b></span>
      <span class="n">${esc(a.name)}</span>
      <span class="m"><b>${lv.name}</b> · ${fmtDate(d)}</span>
      <span class="e">${esc(isLast && a.ev ? a.ev : a.cond)}</span>
    </button>`;
  }).join('');
}

// opened secrets in their own «Легендарные» row; the grid: earned levels (highest first, down to Бронза), then the one-level «Получено», then not earned (closest first);
// the closed secrets close the grid as one strip, and the strip goes once none is left
function renderAll() {
  const byCat = (x, y) => catIdx(x.cat) - catIdx(y.cat);
  const legends = earned.filter(a => a.kind === 'secret');
  const odd = (arr, i) => (arr.length % 2 && i === arr.length - 1 ? ' odd-last' : '');
  $('#legends').innerHTML = legends.length ? `<div class="ph"><h3>Легендарные</h3><span class="chip">${legends.length}</span></div><div class="bibs">${legends.map((a, i) => bib(a, 'button', odd(legends, i))).join('')}</div>` : '';
  const list = [
    ...earned.filter(a => a.kind !== 'secret').sort((x, y) => (x.kind === 'one') - (y.kind === 'one') || levelPoints(y) - levelPoints(x) || byCat(x, y)), // every level, Бронза included, before the one-level «Получено»
    ...[...notEarned].sort((x, y) => progress(y) - progress(x) || byCat(x, y)),
  ];
  const strip = !secrets.length ? '' : `<div class="sstrip" style="${look(SECRET)}"><span class="band">Секретные · ${secrets.length}</span>
    <div class="sbody"><p class="st"><b>${secrets.length} ${plural(secrets.length, ['секретное достижение', 'секретных достижения', 'секретных достижений'])}</b>Условия скрыты · каждое откроется легендарным, +${LEGEND.pts} очков</p>
    <div class="sbibs">${secrets.map(a => `<button class="sb" type="button" data-open="${a.id}" aria-label="Секретное достижение"><span class="mb" style="${look(SECRET)}" aria-hidden="true"><i></i><b>?</b></span></button>`).join('')}</div></div></div>`;
  $('#all').innerHTML = list.map((a, i) => bib(a, 'button', odd(list, i))).join('') + strip;
}

/* ---------- dialog ---------- */
let openId = null, dlgMode = 'ach'; // ach, cel (a new level), rank, vis
const closeX = `<button class="x" type="button" id="d-close" aria-label="Закрыть"><svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round" aria-hidden="true">${ICON.close}</svg></button>`;
function renderDialog(a) {
  const t = tierOf(a), lock = locked(a), cat = catOf(a.cat);
  const ladder = lock ? '' : `<div class="ladder">${a.th.map((_, i) => {
    const lvi = levelAt(a, i);
    let st;
    if (i < t) st = `<span class="st ok">${fmtDate(a.d[i])}<small>у ${fmtPct(rarity(a, i))} бегунов</small></span>`;
    else if (i === t && VIEW === 'own') st = `<span class="st nx">${esc(remaining(a))}<small>у ${fmtPct(rarity(a, i))} бегунов</small></span>`;
    else st = `<span class="st">—<small>у ${fmtPct(rarity(a, i))} бегунов</small></span>`;
    const label = a.kind === 'tier' ? thLabel(a, i) : (a.got || (a.lab ? `${a.lab[0]} ${a.bu}` : thLabel(a, i)));
    return `<div class="lr"><span class="sw" style="--tc:${lvi.c}"></span><span class="tn">${levelName(a, i)}</span><span class="th">${esc(label)} · +${lvi.pts}</span>${st}</div>`;
  }).join('')}</div>`;
  const pg = (VIEW === 'own' && !maxed(a) && !lock) ? `<div class="dpg pgc"><span class="track"><span style="width:${(progress(a) * 100).toFixed(1)}%"></span></span><span class="row"><b>${Math.floor(progress(a) * 100)}%</b><span>${esc(status(a))}</span></span></div>` : '';
  const ev = (t && a.ev) ? `<p class="dev">Последний уровень: <b>${esc(a.ev)}</b></p>` : '';
  const secretNote = lock ? `<p class="dnote">Когда откроете, оно станет <b>легендарным</b> и даст +${LEGEND.pts} очков. Открыто у ${fmtPct(a.r)} бегунов S10.</p>` : '';
  const pinned = state.pinned.includes(a.id);
  const acts = VIEW === 'friend' ? '' : t
    ? `<button class="btn btn-cta" type="button" id="d-share">Поделиться</button><button class="btn btn-out" type="button" id="d-pin">${pinned ? 'Убрать из витрины' : 'Закрепить в профиле'}</button>`
    : `${a.act ? `<a class="btn btn-out" href="${a.act[1]}" target="_blank" rel="noopener" style="text-decoration:none">${esc(a.act[0])}</a>` : ''}`;
  $('#dlg-body').innerHTML = `<div class="dl">
    ${closeX}
    ${bib(a, 'div', ' big')}
    <div>
      <p class="dcat">${svg(a.cat)}${cat.name}</p>
      <h2 id="dlg-t">${esc(lock ? 'Секретное достижение' : a.name)}</h2>
      <p class="dcond">${esc(lock ? 'Условие откроется вместе с достижением.' : a.cond)}</p>
      ${a.note && !lock ? `<p class="dnote">${esc(a.note)}</p>` : ''}
      ${secretNote}${ladder}${pg}${ev}
      <div class="dact">${acts}</div>
    </div>
  </div>`;
}
function openDialog(id) {
  openId = id; dlgMode = 'ach'; dlg.classList.remove('narrow'); renderDialog(byId[id]);
  if (!dlg.open) dlg.showModal();
}
function togglePin(id) {
  const was = [...state.pinned];
  const i = state.pinned.indexOf(id);
  if (i >= 0) { state.pinned.splice(i, 1); toast(`«${byId[id].name}» убрано из витрины`); }
  else {
    if (state.pinned.length >= 3) { const out = state.pinned.shift(); toast(`В витрине три места: «${byId[out].name}» заменено на «${byId[id].name}»`); }
    else toast(`«${byId[id].name}» теперь в витрине профиля`);
    state.pinned.push(id);
  }
  renderShowcase();
  save('showcase', { ids: JSON.stringify(state.pinned) }, null, () => { state.pinned = was; renderShowcase(); });
  if (dlgMode === 'cel') $('#d-pin').textContent = state.pinned.includes(id) ? 'Убрать из витрины' : 'Закрепить в профиле'; else renderDialog(byId[id]);
}
function share(a) { copy(`Моё достижение на S10.run: «${a.name}», ${levelOf(a, tierOf(a)).name.toLowerCase()}`); }

/* ---------- notifications ---------- */
let bellSeen = false;
const BELL_MAX = 10; // the newest; opening the bell marks every unread one as read
function notes() {
  if (VIEW !== 'own') return [];
  return (D.notifications || []).map(x => {
    if (x.type === 'consent_request') return state.consent !== 'pending' ? null : { id: x.id, key: 'ask', fresh: x.unread, html: `<span class="ava" aria-hidden="true">${esc(x.coach.initials)}</span><span class="nt"><b>${esc(x.coach.name)} просит показывать ваши достижения</b><small>В профиле тренера · ${fmtDate(x.date)}</small></span>` };
    if (x.type === 'rank') { const r = RANKS[x.rank]; return { id: x.id, key: 'rank', fresh: x.unread, html: `${emblem(r)}<span class="nt"><b>Новое звание: ${esc(r.name)}</b><small>от ${fmtInt(r.from)} ${plural(r.from, U.pt)} · ${fmtDate(x.date)}</small></span>` }; }
    const a = byId[x.achievement];
    if (x.type !== 'level' || !a || x.level > a.d.length) return null;
    const lv = levelAt(a, x.level - 1);
    return { id: x.id, key: `lv:${a.id}`, fresh: x.unread, html: `${miniBib(a, x.level - 1)}<span class="nt"><b>${a.kind === 'secret' ? 'Открыто секретное' : 'Новый уровень'}: «${esc(a.name)}»</b><small>${esc(lv.name)} · +${lv.pts} ${plural(lv.pts, U.pt)} · ${fmtDate(x.date)}</small></span>` };
  }).filter(Boolean).slice(0, BELL_MAX);
}
function renderBell() {
  const n = notes(), fresh = bellSeen ? 0 : n.filter(x => x.fresh).length;
  const dot = $('#bell-dot'), open = !$('#nmenu').hidden;
  dot.hidden = !fresh || open; dot.textContent = fresh;
  $('#bell').setAttribute('aria-label', fresh ? `Уведомления, новых: ${fresh}` : 'Уведомления');
  $('#nmenu').innerHTML = `<h2>Уведомления</h2>${n.length
    ? n.map(x => `<button class="ni${x.fresh && !bellSeen ? ' new' : ''}" type="button" data-note="${x.key}">${x.html}</button>`).join('')
    : '<p class="nempty">Пока нет уведомлений. Здесь появятся новые уровни, звания и запросы тренера.</p>'}`;
}
function toggleBell(open) {
  const m = $('#nmenu'); open = open ?? m.hidden;
  if (open === !m.hidden) return;
  m.hidden = !open; $('#bell').setAttribute('aria-expanded', open);
  if (open) { $('#bell-dot').hidden = true; const ids = (D.notifications || []).filter(x => x.unread).map(x => x.id); if (ids.length) save('seen', { notifications: JSON.stringify(ids) }); }
  else { bellSeen = true; renderBell(); }
}

/* ---------- the top of the page: the coach's request, or whose page this is ---------- */
const VIS = {
  all: { short: 'все', name: 'Все', note: 'Любой, кто откроет ваш профиль' },
  subs: { short: 'подписчики', name: 'Подписчики', note: 'Только те, кто на вас подписан' },
  me: { short: 'только я', name: 'Только я', note: 'Звание, витрина и достижения видны только вам' },
};
const CONSENT_NOTE = { yes: 'Тренер может показать до 6 ваших полученных достижений', pending: 'Тренер ждёт ответа на запрос', no: 'Тренер не видит ваших достижений', none: 'У вас пока нет тренера' };
const who = () => `<div class="who"><span class="ava" aria-hidden="true">${esc(ATHLETE.ini)}</span><div><p class="n">${esc(ATHLETE.first)}</p><p class="m">Достижения · получено ${earned.length} из ${A.length}</p></div></div>`;
function renderTop() {
  if (VIEW === 'friend') {
    $('#top').innerHTML = who();
    $('#almost').closest('section').hidden = true;
    $('#showcase').closest('section').classList.add('wide');
    return;
  }
  $('#top').innerHTML = state.consent !== 'pending' ? '' : `<section class="ask" id="ask" tabindex="-1" aria-labelledby="ask-h">
    <span class="ava" aria-hidden="true">${esc(D.coach.initials)}</span>
    <div><p class="eb">Запрос от тренера</p><h2 id="ask-h">${esc(D.coach.name)} хочет показывать ваши достижения в своём профиле</h2>
      <p>Он выберет до 6 полученных достижений: будут видны название, уровень и дата. Тренировки, прогресс и «На подходе» останутся только у вас. Разрешение можно отозвать в любой момент.</p></div>
    <div class="dact"><button class="btn btn-cta" type="button" id="ask-yes">Разрешить</button><button class="btn btn-out" type="button" id="ask-no">Отклонить</button></div>
  </section>`;
}
function answerCoach(yes) {
  state.consent = yes ? 'yes' : 'no';
  renderTop(); renderBell();
  save('consent', { answer: state.consent }, yes ? 'Тренер может показывать ваши достижения. Отозвать можно в «Кто видит»' : 'Запрос отклонён. Тренер не увидит ваших достижений', () => { state.consent = 'pending'; renderTop(); renderBell(); });
}

/* ---------- small dialogs ---------- */
function openVis() {
  dlgMode = 'vis'; dlg.classList.add('narrow');
  $('#dlg-body').innerHTML = `<div class="sd">${closeX}
    <h2 id="dlg-t">Кто видит ваши достижения</h2>
    <p class="dnote">Звание, витрина и полученные достижения в вашем профиле</p>
    <fieldset class="opts"><legend class="vh">Кто видит</legend>${Object.entries(VIS).map(([k, v]) => `<label class="opt"><input type="radio" name="vis" value="${k}"${state.vis === k ? ' checked' : ''}><span><b>${v.name}</b><small>${v.note}</small></span></label>`).join('')}</fieldset>
    <div class="swrow"><span><b>Показ в профиле тренера</b><small>${CONSENT_NOTE[state.consent]}</small></span><button class="switch" type="button" role="switch" id="coach-sw" aria-checked="${state.consent === 'yes'}" aria-label="Показ в профиле тренера"${state.consent === 'none' ? ' disabled' : ''}></button></div>
    <p class="dnote">«На подходе», прогресс и условия секретных достижений видите только вы.</p>
    <div class="dact"><button class="btn btn-cta" type="button" id="vis-done">Готово</button></div>
  </div>`;
  if (!dlg.open) dlg.showModal();
}
// the moment a level comes: the card, its points and the rank bar moving on by them
function openLevelUp(id) {
  const a = byId[id], i = tierOf(a) - 1, lv = levelAt(a, i);
  const r = RANKS[rankIdx], nx = RANKS[rankIdx + 1], goal = nx ? nx.from : totalPts, pct = p => `${Math.min(100, p / goal * 100).toFixed(1)}%`;
  const value = a.got || `${bibNo(a, i)} ${bibUnit(a, i).replace(/ на .*$/, '')}`;
  openId = id; dlgMode = 'cel'; dlg.classList.remove('narrow');
  $('#dlg-body').innerHTML = `<div class="dl cel">${closeX}${bib(a, 'div', ' big')}<div>
    <p class="eb">Новый уровень · ${fmtDate(a.d[i])}</p>
    <h2 id="dlg-t">${esc(a.name)}</h2>
    <p class="dcond">${lv.name} · ${esc(value)}</p>
    <p class="pts">+${lv.pts}<small>${plural(lv.pts, U.pt)}</small></p>
    <div class="crank">${emblem(r)}<span class="pgc"><span class="row"><b>${r.name}</b><span>${fmtInt(totalPts)}${nx ? ` / ${fmtInt(nx.from)}` : ''}</span></span><span class="track"><span id="cel-bar" style="width:${pct(totalPts - lv.pts)}"></span></span></span></div>
    <p class="dnote">Этот уровень есть у ${fmtPct(rarity(a, i))} бегунов S10</p>
    <div class="dact"><button class="btn btn-cta" type="button" id="d-share">Поделиться</button><button class="btn btn-out" type="button" id="d-pin">${state.pinned.includes(id) ? 'Убрать из витрины' : 'Закрепить в профиле'}</button></div>
  </div></div>`;
  if (!dlg.open) dlg.showModal();
  requestAnimationFrame(() => requestAnimationFrame(() => { $('#cel-bar').style.width = pct(totalPts); }));
}
function openRankUp() {
  const r = RANKS[rankIdx], nx = RANKS[rankIdx + 1];
  dlgMode = 'rank'; dlg.classList.add('narrow');
  $('#dlg-body').innerHTML = `<div class="sd">${closeX}<div class="ru">${emblem(r)}
    <p class="eb">Новое звание${rankDate ? ` · ${fmtDate(rankDate)}` : ''}</p>
    <h2 id="dlg-t">${r.name}</h2>
    <p class="dcond">У вас ${fmtInt(totalPts)} ${plural(totalPts, U.pt)}.${nx ? ` До звания «${nx.name}» осталось ${fmtInt(nx.from - totalPts)}.` : ' Это высшее звание.'}</p>
    <div class="dact"><button class="btn btn-cta" type="button" id="r-share">Поделиться</button><button class="btn btn-out" type="button" id="r-road">Все звания</button></div>
  </div></div>`;
  if (!dlg.open) dlg.showModal();
}

/* ---------- whole-page states ---------- */
function renderLoading() {
  $('main').setAttribute('aria-busy', 'true');
  $('main').innerHTML = `<h1 class="vh">Достижения</h1><p class="vh" role="status">Загружаем достижения</p>
    <div class="grid first"><div class="rank s12 sk-rank"><span class="sk sk-emb"></span><span class="sk-col"><span class="sk sk-line sk-w1"></span><span class="sk sk-line"></span><span class="sk sk-line sk-w2"></span></span></div></div>
    <div class="grid"><div class="panel s9">${'<span class="sk sk-panel"></span>'.repeat(4)}</div><div class="panel s3 side">${'<span class="sk sk-panel"></span>'.repeat(3)}</div></div>
    <div class="bibs">${'<span class="sk sk-bib"></span>'.repeat(8)}</div>`;
}
function renderError() {
  $('main').innerHTML = `<h1 class="vh">Достижения</h1><div class="state" role="alert"><h2>Не удалось загрузить достижения</h2>
    <p>Проверьте соединение и попробуйте ещё раз. Уровни и очки сохранены, они никуда не делись.</p>
    <button class="btn btn-cta" type="button" id="retry">Повторить</button></div>`;
}
function renderHidden(user) {
  $('main').innerHTML = `<h1 class="vh">Достижения</h1><div class="who"><span class="ava" aria-hidden="true">${esc(user.initials)}</span><div><p class="n">${esc(user.name)}</p><p class="m">Достижения</p></div></div>
    <div class="state"><h2>${esc(user.name)} скрывает свои достижения</h2><p>Звание, витрина и достижения видны только владельцу профиля.</p></div>`;
}
/* ---------- the page ---------- */
const MAIN = `  <h1 class="vh">Достижения</h1>
  <div id="top"></div>

  <div class="grid first">
    <section class="rank s12" id="rank" aria-label="Звание"></section>
  </div>

  <div class="grid">
    <section class="panel s9" aria-labelledby="al-h">
      <div class="ph"><h2 id="al-h">На подходе</h2><span class="chip" id="al-chip"></span></div>
      <div class="stack" id="almost"></div>
      <div class="foot" id="al-foot"></div>
    </section>
    <section class="panel s3 side" aria-labelledby="sh-h">
      <div class="ph"><h2 id="sh-h">Витрина профиля</h2><span class="chip" id="sh-chip"></span></div>
      <div class="stack" id="showcase"></div>
      <div class="foot" id="sh-foot"></div>
    </section>
  </div>

  <div class="grid">
    <section class="panel s12" aria-labelledby="rc-h">
      <div class="ph"><h2 id="rc-h">Последние полученные</h2></div>
      <div class="rgrid" id="recent"></div>
    </section>
  </div>

  <section aria-labelledby="all-h">
    <div class="allh"><h2 id="all-h">Все достижения</h2></div>
    <div id="legends"></div>
    <div class="bibs" id="all"></div>
  </section>`;
function boot(data) {
  D = data; VIEW = D.viewer === 'self' ? 'own' : 'friend';
  useLevels(D, D.ranks);
  ATHLETE = { first: D.user.name, ini: D.user.initials, id: D.user.id };
  CATS = D.categories || [];
  A = (D.items || D.showcase || []).map(fromItem);
  A.forEach(a => { if (a.noValue && dir(a) === -1 && VIEW === 'own') a.none = true; }); // no result yet for a time or a place
  byId = Object.fromEntries(A.map(a => [a.id, a]));
  const pins = D.items ? D.showcase || [] : A.map(a => a.id); // the widget sends the showcase as whole items
  state = { pinned: pins.filter(id => byId[id] && tierOf(byId[id])), showAllAlmost: false, consent: D.coach ? D.coach.consent : 'none', vis: D.visibility ? D.visibility.audience : 'all' };
  earned = A.filter(a => tierOf(a) > 0);
  notEarned = A.filter(a => tierOf(a) === 0 && a.kind !== 'secret');
  secrets = A.filter(locked);
  almost = VIEW === 'own' ? A.filter(a => !maxed(a) && !locked(a) && progress(a) >= 0.7).sort((x, y) => progress(y) - progress(x)) : [];
  totalPts = D.points; rankIdx = D.rank;
  const re = (D.rank_events || []).find(r => r.rank === rankIdx); rankDate = re ? re.date : null;
  NEW = !earned.length;
}
let wired = false;
function wire() {
  if (wired) return;
  wired = true; dlg = $('#dlg');
  dlg.addEventListener('click', e => {
    if (e.target === dlg || e.target.closest('#d-close')) { dlg.close(); return; }
    if (e.target.closest('#d-pin')) togglePin(openId);
    if (e.target.closest('#d-share')) share(byId[openId]);
    if (e.target.closest('#vis-done')) dlg.close();
    if (e.target.closest('#r-share')) copy(`Моё звание на S10.run: ${RANKS[rankIdx].name}`);
    if (e.target.closest('#r-road')) { dlg.close(); $('#rank').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (e.target.closest('#coach-sw')) {
      const was = state.consent;
      state.consent = state.consent === 'yes' ? 'no' : 'yes';
      renderTop(); renderBell(); openVis();
      save('consent', { answer: state.consent }, state.consent === 'yes' ? 'Тренер может показывать ваши достижения' : 'Тренер больше не показывает ваши достижения', () => { state.consent = was; renderTop(); openVis(); });
    }
  });
  dlg.addEventListener('change', e => {
    if (e.target.name !== 'vis') return;
    const was = state.vis;
    state.vis = e.target.value; renderShowcase();
    save('visibility', { audience: state.vis }, `Достижения видят: ${VIS[state.vis].short}`, () => { state.vis = was; renderShowcase(); });
  });


  ROOT.addEventListener('click', e => {
    const nt = e.target.closest('[data-note]');
    if (nt) {
      toggleBell(false);
      const k = nt.dataset.note;
      if (k === 'ask') { const c = $('#ask'); if (c) { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.focus({ preventScroll: true }); } }
      else if (k === 'rank') openRankUp();
      else openDialog(k.slice(3));
      return;
    }
    if (e.target.closest('#bell')) { toggleBell(); return; }
    if (!e.target.closest('#nmenu')) toggleBell(false);
    if (e.target.closest('#ask-yes')) { answerCoach(true); return; }
    if (e.target.closest('#ask-no')) { answerCoach(false); return; }
    if (e.target.closest('#vis-open')) { openVis(); return; }
    if (e.target.closest('#retry')) { load(); return; }
    if (e.target.closest('#al-more')) { state.showAllAlmost = !state.showAllAlmost; renderAlmost(); return; }
    const o = e.target.closest('[data-open]');
    if (o && !dlg.contains(o)) openDialog(o.dataset.open);
  });
}
async function load() {
  wire();
  if (!opts.widget) renderLoading();
  let data;
  try { data = await api.get(opts.widget ? 'widget' : 'athlete', opts.id); }
  catch (e) {
    if (opts.widget) { $('main').innerHTML = ''; return; } // the profile goes on without the block
    if (e.body && e.body.hidden) { renderHidden(e.body.user); return; }
    renderError(); return;
  }
  boot(data);
  if (opts.widget) { renderWidget(); return; }
  $('main').removeAttribute('aria-busy');
  $('main').innerHTML = MAIN;
  $('#bell').hidden = VIEW !== 'own';
  renderBell(); renderTop(); renderRank(); renderAlmost(); renderShowcase(); renderRecent(); renderAll();
  celebrate();
}
// what came since the last visit: the most valuable new level first, the new rank after it; then both are marked as shown
function celebrate() {
  if (VIEW !== 'own') return;
  const ev = (D.events || []).filter(e => !e.celebrated && byId[e.achievement]);
  const rk = (D.rank_events || []).filter(e => !e.celebrated && e.rank === rankIdx);
  if (!ev.length && !rk.length) return;
  const best = ev.map(e => ({ e, pts: levelAt(byId[e.achievement], e.level - 1).pts })).sort((x, y) => y.pts - x.pts)[0];
  if (best) { openLevelUp(best.e.achievement); if (rk.length) dlg.addEventListener('close', () => openRankUp(), { once: true }); }
  else openRankUp();
  save('celebrated', { events: JSON.stringify(ev.map(e => e.id)), rank_events: JSON.stringify(rk.map(e => e.id)) });
}
// the block in the athlete's profile, between their details and «Планы»: the rank with its bar, the showcase, a link to the page
function renderWidget() {
  const r = RANKS[rankIdx], nx = RANKS[rankIdx + 1], goal = nx ? nx.from : totalPts;
  const page = `${SITE}/achievements/athlete${VIEW === 'own' ? '' : `?id=${encodeURIComponent(ATHLETE.id)}`}`;
  $('main').innerHTML = `<section class="pfa" aria-labelledby="pfa-h">
      <div class="ph"><h2 id="pfa-h">Достижения</h2><span class="chip">${D.earned} из ${D.total}</span><a class="act" href="${esc(page)}">Все достижения</a></div>
      <a class="pfa-rank" href="${esc(page)}">${emblem(r)}<span><span class="rn">${esc(r.name)}</span><span class="pgc"><span class="track"><span style="width:${(totalPts / goal * 100).toFixed(1)}%"></span></span><span class="row"><span><b>${fmtInt(totalPts)}</b>${nx ? ` / ${fmtInt(nx.from)}` : ''}</span>${nx ? `<span>до «${esc(nx.name)}»</span>` : ''}</span></span></span></a>
      <div class="stack">${state.pinned.length ? showcaseRows().join('') : '<div class="empty">Витрина пока пустая</div>'}</div>
    </section>`;
}
return { load };
}
