/* S10 achievements: one file for the athlete's page, the coach's page and the two blocks in a profile.
     /achievements/athlete[?id=ID], /achievements/coach[?id=ID] — achievements.html with <div id="s10-achievements"></div>
     a profile — <div data-s10-achievements="widget" data-id="ID"></div>, or "coach-widget" in a coach's profile
   Each is drawn in its own shadow root, so the site's styles and these never meet. The data come from
   /apiweb/achievements.php (contract/API.md) with the session cookie; the page counts nothing itself.
   Off s10.run the source runs on the contract's example answers and sends nothing; the release has none of that. */
(() => {
  /*<demo>*/const LIVE = /(^|\.)s10\.run$/.test(location.hostname) && !window.S10_FORCE_DEMO;/*</demo>*/
  const SITE = /*<demo>*/!LIVE ? 'https://s10.run' : /*</demo>*/'';
  const API = '/apiweb/achievements.php';
  const CSS = `@@CSS@@`;
  const FONTS = 'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@700;800&family=Roboto:ital,wght@0,400;0,500;0,700;1,900&display=swap';
  const LOGO = '<svg class="logo" viewBox="0 0 89 27" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M23 17.9L22.6 17.6L22.5 17.7L22.4 17.5L22 17.7L21.6 17.3L21.2 17.5L20.7 17.3L20.1 16.8L20.2 16.1L20.6 15L20.7 14.1L21.2 14.1L21.4 13.9L21.4 13.5L21.2 13.1L21.5 12.3L22.6 11.5L22.5 11.3L22.9 10.9L22.7 10.7L23.3 10.3L23.6 9.7L23.6 9.6L23.2 10L22.5 10.2L22.1 10.8L22.1 10.4L22.7 8.9L23.1 7L23.3 6.8L24 4.6L24.8 3L24.7 2.5L25.6 1L25.6 .7L25.4 .4L25.8 0L26.3 .2L26.9 .1L28.8 1.4L28.9 2.1L28.4 3.3L28.5 3.4L28.4 3.8L28.6 3.9L27.5 6L27.4 6.3L27.6 6.3L27.3 7L27.2 7.8L26.8 8.3L26.8 8.8L26.3 9.2L26.3 10.6L26 10.9L26 11.1L25.1 13.2L25.2 14.2L24.9 14.9L24.7 15.5L24.9 15.9L24.4 17.6L23.9 18.3L23.2 18.1L23 17.9ZM20.6 15.3L20.7 15.6L20.8 15.3L20.6 15.3ZM20.8 15.1L21 15.1L21.1 14.9L20.9 14.8L20.8 15.1ZM21.7 11.6L21.9 11.4L22.1 11.4L21.9 11.8L21.7 11.9L21.7 11.6ZM22.1 12.7L21.8 13L21.8 13.3L22.3 13L22.5 13L22.5 13.2L22.9 12.8L22.1 12.7ZM22.3 12.5L22.8 12.4L23 11.7L22.3 12.5ZM24.6 16L24.2 16.2L24.6 16.1L24.6 16Z" fill="white"/><path d="M37.1 16.9L36.7 17.1L34.6 17L33.1 16.5L32.2 15.9L31.7 15.2L31.6 14.5L31.4 14.4L31.4 14.2L31.2 14.4L31.6 13.2L31.5 13.1L31.3 13.2L31.3 13.1L31.4 12.6L31.3 12.5L31.3 12.6L31.3 11.8L31.6 11.4L31.3 11.5L31.6 10.9L31.8 9.6L32 9.4L31.9 9.6L32.3 9.4L32.2 9.2L32.6 7.9L32.7 7.6L32.5 7.7L32.7 7L34.1 5L34 4.6L34.3 4.5L34.5 3.3L35.7 1.8L36.7 1.5L36.7 1.8L37.6 1.7L38 1.4L38.4 1.5L41.4 2.1L43 3.5L43.1 3.9L43.3 4L43.4 5.2L43.9 5.9L43.7 6.6L43.8 7L43.9 9L43.8 9.4L43.7 9.5L43.6 9.3L43.4 9.6L43.3 10.3L43.1 10.6L43.3 11.1L42.7 12.2L42.4 12.3L42.1 13.5L41.9 13.4L41.9 13.9L41.3 14.3L41.2 14.2L41.2 14.6L40.7 14.8L40.6 15.2L38.9 16.7L37.6 17.1L37.1 16.9ZM32.4 8.2L32.2 8.7L31.8 9.1L32.1 8.4L32.4 8.2ZM32.2 11L32.1 11.5L32.4 11.2L32.2 11ZM34.5 13.3L34.7 14.2L35.1 14.8L35.7 15L36.4 14.9L37.1 14.6L37.9 13.9L39.2 11.8L39.6 9.9L40.3 7.8L40.4 5.5L40.6 5L40 4.2L39.9 4.3L39.5 4.2L39.5 3.8L39.4 3.7L38.6 3.7L38.2 3.9L36.5 6.5L35.8 8.4L35.6 8.6L34.9 11.2L34.5 12L34.6 12.1L34.5 12.3L34.5 13.3ZM38.2 3.2L39.5 3.3L39.3 3.1L38.7 2.9L38.6 3.1L38.2 3.2ZM41 14L41.3 14L41.3 13.6L41 14ZM43.3 7.5L43.5 7.8L43.6 7.5L43.4 6.9L43.3 7.5Z" fill="white"/><path d="M43.4 18.1L43.6 16.2L45.3 15.5L46.5 15.7L47 16L47 16.6L46.7 17.6L46.7 18.8L46.1 19.3L45.3 19.5L44.2 19.4L43.6 18.8L43.4 18.1Z" fill="white"/><path d="M53.6 14.3L53.7 15.2L53.6 15.6L53.4 17.2L52.6 17.3L52.6 17.1L52.5 17.6L51.3 17.3L50.7 17.3L50.7 17L50.4 16.3L50 16.1L50.2 15.4L50.1 13.9L50.4 13.6L50.3 13.2L50.5 12.8L50.5 11.3L50.8 7L51.5 6.9L52.9 7.4L54 9L56.1 7.7L58.6 6.4L59.8 6.9L60.5 7.6L60.1 8.3L59.6 8.5L59.5 8.8L59.3 8.9L58.4 9.1L58.3 9.2L55.9 10.1L53.7 11.9L53.6 12.3L53.9 12.6L53.6 14.3ZM55.1 8.9L54.2 9.5L55.3 8.9L55.3 8.7L55.1 8.9ZM57.1 8L55.8 8.7L57.6 8L57.1 8Z" fill="white"/><path d="M70.8 9.4L71 9L71.1 9.6L71.3 9.6L71.6 8.8L71.6 8.6L71.3 8.7L71.2 8.1L71.6 7.1L71.6 6.6L71.9 6.5L74.2 6.5L75.2 7.3L75.4 7.7L75.5 8L74.6 10.8L74.1 13.7L74 13.7L73.8 14L73.6 15.2L73.8 16.5L73.7 17.1L72.3 17.3L71.6 17.5L71.1 17.5L69.9 16.7L69.9 15.5L68.4 16.4L66.2 16.7L66 16.5L64.7 16.3L63.6 15.4L63.2 14.8L62.9 13.6L63.6 9.5L64 8.7L64.2 7.7L64.4 7.3L65 7.3L65.6 7.7L66.4 8.4L66.7 9.1L65.8 13.4L66.1 14.3L66.3 14.5L67.6 14.4L68.9 13.9L69.9 13.1L70.2 12.4L70.4 12.4L71.1 11.9L71 11.7L70.4 11.7L70.9 10.8L70.4 10.6L70.9 10L70.8 9.4ZM70.9 10.3L70.7 10.4L70.8 10.5L70.9 10.3ZM71 11.5L71.2 11.4L71.5 10.7L71 11.5ZM71.2 10.2L71.2 10L71.2 10.2Z" fill="white"/><path d="M78.1 12.6L78.5 11.7L78.5 10.9L78.8 10.1L80.1 7.6L80.3 7.4L81.3 7.6L82.2 8.2L82.8 8.9L82.8 9.5L85.6 8.3L86.6 8.1L88.5 9L88.5 9.6L88.3 9.7L88.5 9.9L88.5 10.9L88.3 11.6L88 12.1L88.2 12.1L88.2 12.6L87.7 14.7L87.7 15.4L87.5 15.9L87.5 16.4L86.8 17L85.8 16.9L85.2 15.8L85.1 13.3L85.3 11.2L85.2 10.3L83.1 11.3L82.2 12.3L82 13L82 13.8L82.3 13.6L82.2 13.9L81.6 14.9L81.9 16L81.8 16.9L80.9 17.2L79.3 17L77.9 16.4L78.2 16L77.9 16L78 15.7L78.1 15.9L78.2 15.8L78.7 15.1L78.6 15L78.4 15.1L78 15L78.3 14.1L77.8 13.9L78.2 13.2L78.1 12.6ZM78.2 13.6L78.1 13.7L78.2 13.8L78.2 13.6ZM78.3 14.6L78.3 14.4L78.3 14.6ZM78.5 13.5L78.5 13.3L78.5 13.5ZM78.6 14.7L78.7 14.7L78.8 14L78.6 14.3L78.6 14.7Z" fill="white"/><path d="M5.4 2.8L5.7 2.2L5.4 2.3L5.4 2.8Z" fill="#FF6F61"/><path d="M5 4.3L5.2 3.3L4.9 4.1L5 4.3Z" fill="#FF6F61"/><path d="M15.3 9L15 8.7L14.4 8.5L14.1 8.1L14.7 8.2L15.2 8.5L15.4 8.7L15.3 9Z" fill="white"/><path d="M10.3 14.8L10.3 14.6L10.7 14.5L10.3 14.8Z" fill="white"/><path d="M19.4 1.5L17.5 .4L16.6 .3L12.6 .1L9.9 .4L7.4 .8L6.7 1.2L5.7 2.5L4.7 5.8L4.2 6.3L4.2 6.9L4 7.3L4.1 7.9L5.1 9.6L6.4 10.3L8.4 10.9L9.7 11.1L12.2 10.7L12.6 10.1L12.2 9.7L10.4 9.1L9.8 9.1L9.3 8.7L8.2 8.4L7.9 8.1L7.6 7.6L7.6 7L8 5.7L8.5 4.6L9.9 3.7L12.4 3.2L14.5 3.3L16.4 3.1L18.1 3.6L18.6 3.6L19.1 3.4L19.4 2.9L19.4 2.1L19.6 1.8L19.4 1.5ZM12.9 2.6L10.8 2.9L12.4 2.5L12.9 2.6ZM17.2 2.6L16.7 2.4L15.5 2.4L16.4 2.2L17.4 2.5L17.2 2.6Z" fill="#F9625A"/><path d="M16.1 9.2L15.8 8.7L15.2 8.1L14.2 7.6L11.4 7.2L9.3 7.2L8.7 7.7L8.8 7.9L10.4 8.6L12.3 9L12.9 9.3L13.2 9.7L13.3 11.8L11.7 13.8L11.2 14.1L9.7 14.5L3.8 14.2L1.8 13.8L.9 13.8L.4 14.1L.4 15.8L0 15.9L.2 16.1L0 16.3L3.8 17L8.4 17.3L11.5 17L13.1 16.5L13.9 15.9L16.2 13.1L16.4 11.2L16.1 9.2ZM.8 16.2L.7 15.9L1 16.1L.8 16.2ZM1.1 16.5L1.1 16.3L1.1 16.5ZM1.7 14.6L1.6 14.4L1 14.6L1.3 14.2L2 14.2L1.7 14.6ZM15.7 9.2L15.6 9.4L15.4 9.1L15.5 9L15.7 9.2Z" fill="white"/><path d="M6.2 19.1L5.8 19.1L6 19.3L5.3 19.1L6.1 19.9L5.8 19.9L9.6 22.7L13.4 25L15.4 25.9L17.5 26.5L19.7 26.9L21.8 27L23.9 26.8L26.1 26.3L28.3 25.5L30.5 24.4L32.7 22.9L34.7 21.3L34.7 21.1L33.3 22L35.3 20.3L35.1 20.4L35.3 20.2L35.3 19.7L34.9 19.9L36.1 18.8L31.9 21.7L28.2 23.5L25 24.4L23 24.7L21.1 24.8L17.7 24.5L15.6 24L13.8 23.4L11.5 22.3L8.2 20.1L8.2 20.3L6.2 19.1ZM34.3 21.5L34.1 21.6L34.3 21.5Z" fill="#F9625A"/><path d="M10.4 22.7L9.8 22.6L8.3 21.5L10.4 22.7Z" fill="white"/><path d="M26 25.9L26.8 25.7L27 25.3L26 25.9Z" fill="white"/><path d="M27.6 25.3L28.9 24.7L29.4 24.3L27.6 25.3Z" fill="white"/><path d="M10.6 23L10.8 23.2L11.1 23.2L10.6 23Z" fill="white"/><path d="M31 22.4L31.5 22.2L31 22.4Z" fill="white"/></svg>';
  const BELL = '<button class="bell" type="button" id="bell" hidden aria-label="Уведомления" aria-expanded="false" aria-controls="nmenu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg><span class="dot" id="bell-dot" hidden></span></button>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- the API ---------- */
  class ApiError extends Error { constructor(status, body) { super(`HTTP ${status}`); this.status = status; this.body = body; } }
  const api = {
    async get(action, id) {
      /*<demo>*/if (!LIVE) return demoGet(action);/*</demo>*/
      const q = new URLSearchParams({ action }); if (id) q.set('id', id);
      const r = await fetch(`${API}?${q}`, { credentials: 'include' });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new ApiError(r.status, body);
      return body;
    },
    async post(action, fields = {}) {
      /*<demo>*/if (!LIVE) return demoPost(action, fields);/*</demo>*/
      const fd = new FormData(); fd.set('action', action);
      Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
      const r = await fetch(API, { method: 'POST', body: fd, credentials: 'include' });
      const body = await r.json().catch(() => null);
      if (!r.ok || !body || body.ok === false) throw new ApiError(r.status, body);
      return body;
    },
  };
  // the logged-in user, for the header (the same request as calc3 and «Моя неделя»); null when logged out
  async function whoAmI() {
    /*<demo>*/if (!LIVE) return demoMe();/*</demo>*/
    const r = await fetch('/apiweb/student/self/info/', { credentials: 'include' });
    return r.ok ? r.json() : null;
  }

  /* ---------- the site's header: the S10 menu, the logo, the bell, the profile ---------- */
  const MENU_ICON = '<svg viewBox="0 0 24 27" aria-hidden="true"><rect y="0" width="24" height="3"/><rect y="12" width="24" height="3"/><rect y="24" width="24" height="3"/></svg>';
  const CLOSE_ICON = '<svg viewBox="0 0 24 27" aria-hidden="true" style="fill:none;stroke:currentColor;stroke-width:3;stroke-linecap:round"><path d="M4 5.5l16 16M20 5.5l-16 16"/></svg>';
  function header(me, open) {
    const name = me ? `${me.firstName || ''} ${me.lastName || ''}`.trim() : '';
    const ini = (name.split(/\s+/).map(w => w.charAt(0)).join('').slice(0, 2) || 'S').toUpperCase();
    return `<header class="bar"><div class="bar-in">
      <button class="menu" type="button" data-act="menu" aria-expanded="${open}" aria-label="${open ? 'Закрыть меню' : 'Меню S10'}">${open ? CLOSE_ICON : MENU_ICON}</button>
      <a class="mark" href="${SITE}/" aria-label="S10.run, главная">${LOGO}</a>
      <div class="tools">${open ? '' : `${BELL}<div class="nmenu" id="nmenu" hidden></div>`}
        ${me ? `<a class="ava" href="${SITE}/profile?${esc(me.id)}" aria-label="Мой профиль${name ? `, ${esc(name)}` : ''}"><span aria-hidden="true">${esc(ini)}</span>${me.avatarUrl ? `<img src="${esc(me.avatarUrl)}" alt="">` : ''}</a>` : `<a class="ava" href="${SITE}/login" aria-label="Войти">S</a>`}
      </div></div></header>`;
  }
  // the same links as the s10.run header, by role (as on «Моя неделя»)
  function menuLinks(me) {
    const CH = 'https://challenges.s10.run', L = [];
    if (me) {
      const athlete = me.role !== 'trainer';
      if (me.currentTrainerId) L.push([`${SITE}/profile?${me.currentTrainerId}`, 'Мой тренер']);
      else if (athlete) L.push([`${SITE}/trainerlist`, 'Выбрать тренера']);
      if (athlete) L.push([`${SITE}/student?${me.id}&v2=1`, 'Задачи']); else L.push([`${SITE}/students`, 'Студенты']);
      if (!me.isPremium) L.push([`${SITE}/premium`, 'Премиум']);
      L.push([`${SITE}/achievements/athlete`, 'Достижения']);
      if (!athlete) L.push([`${SITE}/achievements/coach`, 'Достижения тренера']);
    }
    L.push(null, [`${CH}/tournament/?utm_source=s10header&utm_campaign=tournament&utm_content=btn`, 'Турнир'], [`${CH}/newrace`, 'Ближайший челендж'], [`${CH}/rating`, 'Рейтинг'], ['https://s10.run/answers', 'Вопросы и ответы']);
    if (me) L.push(null, [`${SITE}/money`, 'Платежи'], [`${SITE}/profile?${me.id}`, 'Мой профиль'], [`${SITE}/logout`, 'Выйти']);
    else L.push(null, [`${SITE}/login`, 'Войти']);
    return L.map(l => (l ? `<li><a href="${esc(l[0])}">${l[1]}</a></li>` : '<li class="sep" aria-hidden="true"></li>')).join('');
  }
  // the menu covers the page: the page under it does not scroll, the focus goes to its button and back
  function toggleMenu(root, me, open) {
    const app = root.querySelector('.app'), wrap = root.querySelector('.navwrap');
    if (!open) { if (wrap) wrap.remove(); document.documentElement.style.overflow = ''; app.querySelector('.bar .menu').focus({ preventScroll: true }); return; }
    if (wrap) return;
    app.insertAdjacentHTML('beforeend', `<div class="navwrap" role="dialog" aria-modal="true" aria-label="Меню S10">${header(me, true)}<nav class="sitemenu" aria-label="Меню S10"><ul>${menuLinks(me)}</ul></nav></div>`);
    document.documentElement.style.overflow = 'hidden';
    root.querySelector('.navwrap .menu').focus({ preventScroll: true });
  }

  /* ---------- drawing ---------- */
  /*@@PAGES@@*/
  function draw(host, view, id, me) {
    const widget = view.endsWith('widget'), coach = view.startsWith('coach');
    const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><div class="app${widget ? ' widget' : ''}">${widget ? '' : header(me, false)}<main></main>
      <dialog id="dlg" aria-labelledby="dlg-t"><div id="dlg-body"></div></dialog><div class="toast" id="toast" role="status" hidden></div></div>`;
    if (!widget) {
      root.addEventListener('click', e => { const b = e.target.closest('[data-act="menu"]'); if (b) toggleMenu(root, me, b.getAttribute('aria-expanded') !== 'true'); });
      root.addEventListener('keydown', e => { if (e.key === 'Escape' && root.querySelector('.navwrap')) toggleMenu(root, me, false); });
      root.querySelectorAll('.ava img').forEach(img => img.addEventListener('error', () => img.remove())); // a photo that does not load leaves the initials
    }
    const main = root.querySelector('main');
    if (!me && !widget) {
      main.innerHTML = `<h1 class="vh">Достижения</h1><div class="state"><h2>Войдите в S10</h2><p>Достижения и звание видны после входа.</p>
        <a class="btn btn-cta" href="${SITE}/login?back=${encodeURIComponent(location.pathname + location.search)}">Войти</a></div>`;
      return;
    }
    const app = (coach ? coachApp : athleteApp)(root, api, me, { site: SITE, id, widget });
    app.load();
  }
  // every place to draw that is on the page now or appears later (the profile is drawn by the site's own scripts)
  let mePromise = null;
  function mountAll() {
    const hosts = [...document.querySelectorAll('#s10-achievements, [data-s10-achievements]')].filter(h => !h.shadowRoot);
    if (!hosts.length) return;
    if (!document.querySelector(`link[href="${FONTS}"]`)) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="${FONTS}">`); // @font-face does not work inside a shadow root
    hosts.forEach(h => h.attachShadow({ mode: 'open' })); // taken at once, so a second pass does not draw them twice
    mePromise = mePromise || whoAmI().catch(() => null);
    mePromise.then(me => hosts.forEach(host => {
      const view = host.dataset.s10Achievements || (/\/coach\b/.test(location.pathname) ? 'coach' : 'athlete');
      draw(host, view, host.dataset.id || new URLSearchParams(location.search).get('id') || '', me);
    }));
  }
  let watching = false;
  function start() {
    mountAll();
    if (watching) return;
    watching = true;
    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; mountAll(); }); } }).observe(document.documentElement, { childList: true, subtree: true });
    window.S10Achievements = { mount: mountAll }; // for a page that wants to say «draw now»
  }

  /*<demo>*/
  // the demo: the answers are the contract's examples (contract/mock/*.json), the hash picks the state, nothing is sent
  const MOCK = @@MOCK@@;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const demoState = () => location.hash.slice(1) || 'normal';
  const demoPage = () => (/\/coach\b/.test(location.pathname) ? 'coach' : 'athlete');
  function demoMe() { return demoPage() === 'coach' && !['public', 'hidden'].includes(demoState()) ? { id: 12, firstName: 'Тренер', lastName: '', role: 'trainer', isPremium: true } : { id: 3, firstName: 'Атлет', lastName: '3', role: 'student', isPremium: true, currentTrainerId: 12 }; }
  async function demoGet(action) {
    const st = demoState();
    if (st === 'loading') return new Promise(() => {});
    await wait(120);
    if (st === 'error') throw new ApiError(500, null);
    const body = MOCK[`${action.startsWith('coach') ? 'coach' : 'athlete'}-${action.endsWith('widget') ? 'profile' : st}`] || MOCK[`${demoPage()}-normal`];
    if (body.hidden) throw new ApiError(403, body);
    return JSON.parse(JSON.stringify(body));
  }
  async function demoPost(action, fields) { (window.S10_DEMO_POSTS = window.S10_DEMO_POSTS || []).push({ action, ...fields }); await wait(120); return { ok: true }; } // kept for the checks (tests/frontend.mjs)
  // the profile state shows the block the way the profile will hold it; another state redraws the page
  const demoStart = start;
  start = () => {
    const host = document.querySelector('#s10-achievements');
    if (host && demoState() === 'profile') host.dataset.s10Achievements = `${demoPage() === 'coach' ? 'coach-' : ''}widget`;
    else if (host) delete host.dataset.s10Achievements;
    demoStart();
  };
  addEventListener('hashchange', () => { const host = document.querySelector('#s10-achievements'); if (!host) return; const fresh = host.cloneNode(false); host.replaceWith(fresh); start(); });
  /*</demo>*/
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
