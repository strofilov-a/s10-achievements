/* S10 achievements · release f829a58aad: one file for the athlete's page, the coach's page and the two blocks in a profile.
     /achievements/athlete[?id=ID], /achievements/coach[?id=ID] — achievements.html with <div id="s10-achievements"></div>
     a profile — <div data-s10-achievements="widget" data-id="ID"></div>, or "coach-widget" in a coach's profile
   Each is drawn in its own shadow root, so the site's styles and these never meet. The data come from
   /apiweb/achievements.php (contract/API.md) with the session cookie; the page counts nothing itself.
   Off s10.run the source runs on the contract's example answers and sends nothing; the release has none of that. */
(() => {
  const SITE = '';
  const API = '/apiweb/achievements.php';
  const CSS = `/* Layout: the s10 blue bar over a centred 1100px column on a 12-column grid (77px columns, 16px gutters):
   the rank scale at 12, tiles 3/3/3/3, then 9/3, then six recent cards at 2 each, then all bibs at 2 each
   (6 x 170 + 5 x 16 = 1100), sorted earned, not earned, secret.
   Style: editorial-greeting (taste-skill app sheet, seed 2042406334), brand palette and Roboto kept.
   Levels are flat metal colours. The page is light only, like s10.run itself. */
/* the page lives in a shadow root (shell.js): the tokens sit on the host, nothing leaks into the site or in from it */
:host {
  color-scheme: light;
  --ground: #ffffff;
  --panel: #f2f5f9;        /* tonal panel, one step off white toward the brand blue */
  --surface: #ffffff;
  --border: #e1e6ee;
  --control: #c5cdd9;
  --track: #dfe5ee;
  --track-soft: #e8edf3;
  --text: #14171c;
  --muted: #586070;
  --faint: #636b7a;
  --brand: #004aad;        /* s10 header, links, the one data hue */
  --brand-line: rgba(0, 74, 173, 0.5);
  --on-brand: #ffffff;
  --cta: #ff6259;          /* s10 contained button */
  --hole: rgba(20, 23, 28, 0.16);
  --shadow: rgba(15, 23, 42, 0.22);
  --scrim: rgba(20, 23, 28, 0.45);

  /* levels: metal and gem colours, Мастер in the green of its rank gem, Чемпион ruby, Элита black with gold ink, both top levels with a gold edge; each band text at 4.5:1 or better */
  --t-b: #985a2c;   --t-b-ink: #ffffff;
  --t-s: #c9d1da;   --t-s-ink: #1d232b;
  --t-g: #ffc83d;   --t-g-ink: #2b2000;
  --t-p: #43d1ea;   --t-p-ink: #0e3138;
  --t-m: #16b462;   --t-m-ink: #05301a;
  --t-c: #b0123a;   --t-c-ink: #ffffff;
  --t-c-line: #d4ad45;
  --t-t: #6a4bd1;   --t-t-ink: #ffffff;
  --t-e: #1d2027;   --t-e-ink: #f6d36b;
  --t-one: #3d4452;
  --t-sec: #283461; --t-sec-ink: #e8ebf7; --t-sec-solid: #283461;
  --t-leg: #ff8a1f; --t-leg-ink: #2a1100;
  --t-leg-line: #f08a2c;
  --t-none: #eceff4; --t-none-ink: #586070;

  --pos: #247b50;

  --font: "Roboto", system-ui, -apple-system, "Segoe UI", Arial, sans-serif;
  --bib: "Roboto Condensed", "Roboto", "Arial Narrow", sans-serif;
  --r-card: 8px; --r-row: 6px; --r-ctl: 4px; --gap: 16px;
}
* { box-sizing: border-box; }
.app { background: var(--ground); color: var(--text); font: 400 14px/20px var(--font); -webkit-text-size-adjust: 100%; }
.app.widget { background: none; }
.app.widget main { max-width: none; padding: 0; }
.app.widget .pfa { margin-top: 0; }
a { color: var(--brand); }
button { font: inherit; color: inherit; }
:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

/* s10 bar */
.bar { background: var(--brand); color: var(--on-brand); }
.bar-in {
  height: 48px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; /* offsets as measured on the site */
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(12px, env(safe-area-inset-right, 0px));
}
.bar a { color: var(--on-brand); text-decoration: none; }
.menu { justify-self: start; width: 24px; height: 27px; display: block; margin-top: 8.5px; appearance: none; border: 0; padding: 0; background: none; color: var(--on-brand); cursor: pointer; }
.menu svg { display: block; width: 24px; height: 27px; fill: currentColor; }
.mark { justify-self: center; display: flex; margin-top: 10px; }
.mark .logo { display: block; width: 132px; height: 32px; }
.tools { justify-self: end; display: flex; align-items: center; gap: 4px; margin-top: 8px; }
.bell { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; }
.bell:hover { background: rgba(255, 255, 255, 0.12); }
.bell svg { width: 24px; height: 24px; fill: currentColor; }
.ava { width: 32px; height: 32px; border-radius: 50%; background: #bdbdbd; font: 400 14px/32px var(--font); text-align: center; }
.bar .ava { color: #ffffff; }

/* column */
main {
  max-width: 1132px; margin: 0 auto;
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: 40px 72px;
}
.vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

.grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: var(--gap); margin-top: 24px; }
.grid.first { margin-top: 0; }
.s3 { grid-column: span 3; } .s9 { grid-column: span 9; } .s12 { grid-column: 1 / -1; }

/* rank: a game-style road of emblems; the rail runs through the emblem centres (8 columns, centres at 1/16 + k/8) */
.rank { background: var(--panel); border-radius: var(--r-card); padding: 24px 24px 20px; }
.rank-top { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 8px 20px; align-items: center; }
.emb { display: block; overflow: visible; }
.rank-top .emb { width: 84px; height: 90px; }
.rank .rname { font: 700 24px/30px var(--font); margin: 0; }
.rank .rbar { margin-top: 10px; }
.rank .rbar .row { font-size: 16px; line-height: 22px; }
.road-wrap { margin-top: 10px; overflow-x: auto; overflow-y: hidden; padding-bottom: 4px; }
.road { position: relative; display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); min-width: 660px; padding-top: 18px; }
.road .rail, .road .rail-fill { position: absolute; top: 50px; left: calc(100% / 16); height: 4px; border-radius: 2px; }
.road .rail { right: calc(100% / 16); background: var(--track); }
.road .rail-fill { background: var(--brand); }
.step { display: flex; flex-direction: column; align-items: center; gap: 4px; position: relative; z-index: 1; text-align: center; min-width: 0; }
.step .emb { width: 64px; height: 68px; }
.step.cur .emb { transform: scale(1.15); } /* the current rank: the larger emblem where the blue line ends, and «Вы здесь» */
.step .sn { font-size: 13px; line-height: 18px; font-weight: 500; color: var(--text); white-space: nowrap; margin-top: 18px; }
.step .sp { font-size: 12px; line-height: 16px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.step.lock .sn { color: var(--muted); font-weight: 400; }
.step .sp svg { vertical-align: -2px; margin-right: 3px; }
.step .you { margin-top: 2px; font: 500 12px/20px var(--font); color: var(--on-brand); background: var(--text); border-radius: 999px; padding: 0 8px; white-space: nowrap; }

/* panels */
.panel { background: var(--panel); border-radius: var(--r-card); padding: 20px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.ph { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ph h2 { font: 500 16px/22px var(--font); margin: 0; }
.chip { flex: none; white-space: nowrap; font-size: 12px; line-height: 20px; color: var(--muted); background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 0 8px; font-variant-numeric: tabular-nums; }
.act:hover, .linkbtn:hover { text-decoration: underline; }
.foot { margin-top: auto; display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--muted); }
.stack { display: flex; flex-direction: column; gap: 8px; }

/* row cards */
.rowc { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-row); min-height: 63px; padding: 10px 14px 10px 10px; display: grid; align-items: center; gap: 14px; }
.rowc.al { grid-template-columns: 52px minmax(0, 1fr) 176px 132px; }
.rowc .t { min-width: 0; }
.rowc .t .n { display: block; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rowc .t .m { display: block; font-size: 13px; line-height: 18px; color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.linkbtn { appearance: none; background: none; border: 0; padding: 0; cursor: pointer; text-align: left; font-weight: 500; max-width: 100%; }
.pgc { display: flex; flex-direction: column; gap: 6px; }
.pgc .row { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; line-height: 18px; color: var(--muted); font-variant-numeric: tabular-nums; }
.pgc .row b { color: var(--text); font-weight: 500; }
.act { justify-self: end; font: 500 13px/20px var(--font); color: var(--text); text-decoration: none; white-space: nowrap; }

.track { height: 6px; border-radius: 999px; background: var(--track); overflow: hidden; }
.track > span { display: block; height: 100%; background: var(--brand); border-radius: 999px; }

/* mini bib: the badge's own thumbnail */
.mb { width: 52px; height: 42px; flex: none; border: 1px solid var(--border); border-radius: 4px; background: var(--surface); overflow: hidden; display: flex; flex-direction: column; }
.mb i { height: 9px; background: var(--bc); }
.mb b { flex: 1; display: grid; place-items: center; font: 800 13px/1 var(--bib); font-variant-numeric: tabular-nums; white-space: nowrap; letter-spacing: -0.01em; }
.mb.next { border-style: dashed; }

/* showcase */
.shw { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 12px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-row); padding: 10px; text-align: left; width: 100%; cursor: pointer; appearance: none; transition: border-color .15s, transform .15s; }
.shw:hover { border-color: var(--control); transform: translateY(-1px); }
.shw .mb { width: 78px; height: 64px; }
.shw .mb i { height: 12px; }
.shw .mb b { font-size: 16px; }
.shw .n { font-weight: 500; display: block; }
.shw .m { font-size: 13px; line-height: 18px; color: var(--muted); display: block; margin-top: 2px; }
.empty { border: 1px dashed var(--control); border-radius: var(--r-row); padding: 12px; font-size: 13px; color: var(--muted); }

/* recent: six cards in a row */
.rgrid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; }
.rcard { appearance: none; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-row); padding: 12px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; min-width: 0; transition: border-color .15s, transform .15s; }
.rcard:hover { border-color: var(--control); transform: translateY(-1px); }
.rcard .n { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rcard .m { font-size: 13px; line-height: 18px; color: var(--muted); font-variant-numeric: tabular-nums; }
.rcard .m b { color: var(--text); font-weight: 500; }
.rcard .e { font-size: 13px; line-height: 18px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* all achievements */
.allh { text-align: center; margin-top: 56px; }
.allh h2 { font: 700 24px/30px var(--font); margin: 0; }
#legends:not(:empty) { margin-top: 24px; padding-bottom: 16px; }
#legends .ph { margin-bottom: 12px; }
#legends h3 { font: 500 16px/22px var(--font); margin: 0; }
#legends .bibs { margin-top: 0; }
.bibs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gap); margin-top: 24px; }

/* the bib: an achievement drawn as a race number, pinned at four corners */
.bib { appearance: none; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-row); padding: 0; overflow: hidden; position: relative; display: flex; flex-direction: column; cursor: pointer; min-width: 0; transition: transform .15s, border-color .15s; }
button.bib:hover { transform: translateY(-2px); border-color: var(--control); }
.bib.champ, button.bib.champ:hover { border-color: var(--t-c-line); }
.bib.legend, button.bib.legend:hover { border-color: var(--t-leg-line); }
.bib .band { height: 24px; background: var(--bc); color: var(--bci); font: 500 12px/24px var(--font); letter-spacing: 0.02em; text-align: center; padding: 0 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bib .h { position: absolute; width: 6px; height: 6px; border-radius: 50%; background: var(--ground); border: 1px solid var(--hole); }
.bib .h.a { top: 9px; left: 7px; } .bib .h.b { top: 9px; right: 7px; }
.bib .h.c { bottom: 7px; left: 7px; } .bib .h.d { bottom: 7px; right: 7px; }
.bib .ttl { font: 800 24px/26px var(--bib); letter-spacing: -0.01em; padding: 14px 14px 0; overflow-wrap: break-word; }
.bib .val { font: 500 14px/18px var(--font); padding: 6px 14px 0; font-variant-numeric: tabular-nums; }
.bib .pg { padding: 8px 14px 18px; margin-top: auto; display: flex; flex-direction: column; gap: 6px; font-size: 13px; line-height: 18px; color: var(--muted); font-variant-numeric: tabular-nums; }
.bib .pg > span:last-child { min-height: 36px; }
.bib.off .ttl, .bib.off .val { color: var(--muted); }
.bib.lock .ttl { color: var(--t-sec-solid); }
.sstrip { grid-column: 1 / -1; margin-top: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-row); overflow: hidden; }
.sstrip .band { display: block; height: 24px; background: var(--bc); color: var(--bci); font: 500 12px/24px var(--font); text-align: center; }
.sstrip .sbody { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; flex-wrap: wrap; padding: 16px; }
.sstrip .st { margin: 0; font-size: 13px; line-height: 18px; color: var(--muted); }
.sstrip .st b { display: block; font: 500 14px/20px var(--font); color: var(--text); }
.sbibs { display: grid; grid-template-columns: repeat(8, minmax(0, 52px)); gap: 8px; } /* one row of eight, two rows of four on a phone */
.sb .mb { width: 100%; }
.sb { appearance: none; background: none; border: 0; padding: 0; cursor: pointer; border-radius: 4px; }
.sb .mb b { color: var(--t-sec-solid); font-size: 16px; }
.sb:hover .mb { border-color: var(--control); }
.bib.big { width: 100%; cursor: default; align-self: start; }
.bib.big .ttl { font-size: 34px; line-height: 36px; padding-top: 22px; }
.bib.big .band { height: 30px; line-height: 30px; font-size: 13px; }
.bib.big .h.a, .bib.big .h.b { top: 12px; }
.bib.big .val { font-size: 16px; line-height: 22px; padding-bottom: 26px; }
.bib .mult { position: absolute; top: 34px; right: 12px; padding: 4px 9px; border-radius: 999px; background: var(--bc); color: var(--bci); font: 800 16px/1 var(--bib); font-variant-numeric: tabular-nums; letter-spacing: .01em; }
.bib.big .mult { top: 44px; right: 14px; font-size: 20px; padding: 5px 11px; }

/* dialog */
dialog { border: 0; border-radius: 10px; padding: 0; width: calc(100% - 32px); max-width: 780px; box-shadow: 0 20px 50px var(--shadow); color: var(--text); background: var(--surface); }
dialog::backdrop { background: var(--scrim); }
.dl { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 28px; padding: 28px; position: relative; }
.x { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border: 0; background: none; border-radius: var(--r-ctl); cursor: pointer; display: grid; place-items: center; color: var(--muted); }
.x:hover { background: var(--panel); color: var(--text); }
.dcat { margin: 0; font-size: 13px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
.dl h2 { font: 700 24px/30px var(--font); margin: 6px 40px 0 0; }
.dcond { margin: 8px 0 0; font-size: 15px; line-height: 22px; }
.dnote { margin: 6px 0 0; color: var(--muted); font-size: 13px; line-height: 18px; }
.dnote b { color: var(--text); font-weight: 500; }
.ladder { margin-top: 18px; border-top: 1px solid var(--track-soft); }
.lr { display: grid; grid-template-columns: 14px 86px minmax(0, 1fr) auto; gap: 10px; align-items: center; min-height: 38px; border-bottom: 1px solid var(--track-soft); font-size: 13px; }
.sw { width: 14px; height: 14px; border-radius: 4px; background: var(--tc); border: 1px solid var(--hole); }
.lr .tn { font-weight: 500; }
.lr .th { color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lr .st { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--muted); }
.lr .st.ok { color: var(--pos); font-weight: 500; }
.lr .st.nx { color: var(--text); font-weight: 500; }
.lr .st small { display: block; font-weight: 400; color: var(--faint); font-size: 12px; line-height: 16px; }
.dpg { margin-top: 16px; }
.dev { margin: 14px 0 0; font-size: 13px; line-height: 18px; color: var(--muted); }
.dev b { color: var(--text); font-weight: 500; }
.dact { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; margin-top: 22px; }
.btn { height: 36px; padding: 0 16px; border-radius: var(--r-ctl); font: 500 14px/36px var(--font); text-transform: uppercase; letter-spacing: 0.02em; cursor: pointer; white-space: nowrap; transition: transform .1s, filter .15s; }
.btn:active { transform: translateY(1px); }
.btn-cta { background: var(--cta); color: var(--on-brand); border: 0; }
.btn-cta:hover { filter: brightness(0.95); }
.btn-out { background: var(--surface); color: var(--text); border: 1px solid var(--control); }
.btn-out:hover { border-color: var(--muted); }

.toast { position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%); background: var(--text); color: var(--surface); padding: 10px 14px; border-radius: 6px; font-size: 13px; z-index: 30; max-width: calc(100% - 32px); box-shadow: 0 8px 24px var(--shadow); }

[hidden] { display: none !important; }

/* notifications: the bell opens a menu under the bar */
.tools { position: relative; }
button.bell { appearance: none; border: 0; padding: 0; background: none; color: inherit; cursor: pointer; position: relative; }
.bell .dot { position: absolute; top: 5px; right: 4px; min-width: 16px; height: 16px; padding: 0 4px; border-radius: 999px; background: var(--cta); color: var(--on-brand); font: 500 11px/16px var(--font); font-variant-numeric: tabular-nums; }
.nmenu { position: absolute; top: 44px; right: 0; z-index: 40; width: 380px; max-width: calc(100vw - 24px); max-height: min(560px, calc(100vh - 72px)); overflow-y: auto; background: var(--surface); color: var(--text); border-radius: var(--r-card); box-shadow: 0 14px 36px var(--shadow); }
.nmenu h2 { font: 500 16px/22px var(--font); margin: 0; padding: 14px 16px 10px; }
.ni { appearance: none; width: 100%; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 12px; align-items: center; padding: 12px 16px; border: 0; border-top: 1px solid var(--track-soft); background: none; text-align: left; cursor: pointer; }
.ni:hover { background: var(--panel); }
.ni.new { background: #f4f7fd; }
.ni.new:hover { background: var(--panel); }
.ni .nt b { display: block; font-weight: 500; }
.ni .nt small { display: block; margin-top: 2px; font-size: 13px; line-height: 18px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ni .emb { width: 44px; height: 47px; justify-self: center; }
.ni .ava { justify-self: center; width: 40px; height: 40px; font-size: 16px; line-height: 40px; color: var(--on-brand); }
.nmenu .nempty { margin: 0; padding: 4px 16px 18px; font-size: 13px; line-height: 18px; color: var(--muted); }

/* a request from the coach, above the rank */
.ask { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 16px 20px; align-items: center; background: var(--panel); border-radius: var(--r-card); padding: 20px 24px; margin-bottom: 24px; }
.ask:focus { outline: none; }
.ask:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
.ask .ava { width: 40px; height: 40px; font-size: 16px; line-height: 40px; color: var(--on-brand); align-self: start; }
.ask .eb { margin: 0; font-size: 13px; line-height: 18px; color: var(--brand); font-weight: 500; }
.ask h2 { font: 500 16px/22px var(--font); margin: 2px 0 0; }
.ask p:not(.eb) { margin: 4px 0 0; font-size: 13px; line-height: 18px; color: var(--muted); max-width: 72ch; }
.ask .dact { margin: 0; flex-wrap: nowrap; }

/* someone else's profile: whose achievements these are */
.who { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.who .ava { width: 48px; height: 48px; font-size: 16px; line-height: 48px; color: var(--on-brand); flex: none; }
.who .n { font: 700 24px/30px var(--font); margin: 0; }
.who .m { margin: 2px 0 0; font-size: 14px; line-height: 20px; color: var(--muted); }
.side.wide { grid-column: 1 / -1; }
.side.wide .stack { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }

/* small dialogs: visibility, a new rank */
.sd { padding: 28px; position: relative; }
.sd h2 { font: 700 24px/30px var(--font); margin: 6px 40px 0 0; }
dialog.narrow { max-width: 520px; }
.opts { border: 0; margin: 18px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.opt { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 12px; align-items: start; padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--r-row); cursor: pointer; }
.opt:has(input:checked) { border-color: var(--brand); background: #f4f7fd; }
.opt input { width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--brand); }
.opt b, .swrow b { display: block; font-weight: 500; }
.opt small, .swrow small { display: block; margin-top: 2px; font-size: 13px; line-height: 18px; color: var(--muted); }
.swrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--track-soft); }
.switch { appearance: none; position: relative; width: 44px; height: 26px; border-radius: 999px; border: 0; background: var(--control); cursor: pointer; transition: background .15s; }
.switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--surface); transition: transform .15s; }
.switch[aria-checked="true"] { background: var(--brand); }
.switch[aria-checked="true"]::after { transform: translateX(18px); }
.switch:disabled { opacity: .5; cursor: default; }
.foot .linkbtn { font-size: 13px; color: var(--text); }

/* the moment of a new level or rank */
.cel .eb, .ru .eb { margin: 0; font-size: 13px; line-height: 18px; color: var(--brand); font-weight: 500; }
.cel .pts { margin: 16px 0 0; font: 700 32px/36px var(--font); font-variant-numeric: tabular-nums; }
.cel .pts small { font: 400 15px/22px var(--font); color: var(--muted); margin-left: 6px; }
.cel .crank { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 12px; align-items: center; margin-top: 14px; padding: 12px 14px; background: var(--panel); border-radius: var(--r-row); }
.cel .crank .emb { width: 40px; height: 43px; }
.cel .crank b { font-weight: 500; }
.cel .crank .track > span { transition: width .9s cubic-bezier(.2, .8, .2, 1) .25s; }
.cel .bib.big { animation: pop .45s cubic-bezier(.2, .9, .3, 1.3) both; }
.ru { text-align: center; padding: 8px 0 0; }
.ru .emb { width: 132px; height: 141px; margin: 0 auto 14px; animation: pop .5s cubic-bezier(.2, .9, .3, 1.3) both; }
.ru h2 { margin: 4px 0 0; }
.ru .dcond { margin-left: auto; margin-right: auto; max-width: 40ch; }
.ru .dact { justify-content: center; }
@keyframes pop { from { transform: scale(.8); opacity: 0; } to { transform: none; opacity: 1; } }

/* states with nothing to show yet */
.empty b { display: block; font: 500 14px/20px var(--font); color: var(--text); margin-bottom: 2px; }
.empty .btn { margin-top: 12px; display: inline-block; text-decoration: none; }
.empty p { margin: 0; }
.rgrid .empty { grid-column: 1 / -1; }
.state { background: var(--panel); border-radius: var(--r-card); padding: 56px 24px; text-align: center; }
.state h2 { font: 500 18px/24px var(--font); margin: 0; }
.state p { margin: 6px auto 0; max-width: 46ch; color: var(--muted); }
.state .btn { margin-top: 20px; }
.sk { display: block; border-radius: var(--r-row); background: var(--track-soft); animation: pulse 1.4s ease-in-out infinite; }
.sk-panel { min-height: 72px; }
.sk-line { height: 14px; border-radius: 4px; }
.sk-bib { min-height: 160px; }
.sk-emb { width: 84px; height: 90px; border-radius: 50%; }
.sk-rank { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 20px; align-items: center; }
.sk-col { display: flex; flex-direction: column; gap: 12px; }
.sk-w1 { width: 160px; height: 24px; }
.sk-w2 { width: 120px; }
@keyframes pulse { 50% { opacity: .5; } }

/* the profile page, with the rank and the showcase */
.pf { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; gap: 8px 16px; font-size: 16px; line-height: 21px; }
.pf-av { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.pf-ph { position: relative; width: 80px; height: 80px; border-radius: 50%; background: #bdbdbd; color: var(--on-brand); font: 400 24px/80px var(--font); text-align: center; }
.pf-ph .emb { position: absolute; right: -10px; bottom: -8px; width: 34px; height: 36px; }
.pf-rt { margin-top: 12px; font: 700 20px/24px var(--font); color: #e53935; }
.pf-rl { font-size: 13px; line-height: 18px; }
.pf-n { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font: 500 18px/24px var(--font); margin: 0; }
.pf-btn { border: 1px solid var(--brand-line); border-radius: var(--r-ctl); padding: 0 10px; font: 500 13px/29px var(--font); color: var(--brand); text-transform: uppercase; letter-spacing: .02em; }
.pf-dl { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 8px 12px; margin: 12px 0 0; }
.pf-dl dt { color: var(--brand); }
.pf-dl dd { margin: 0; }
.pf-subs { display: flex; height: 31px; }
.pf-subs span { border: 1px solid var(--brand); padding: 0 12px; font: 400 13px/29px var(--font); color: var(--brand); white-space: nowrap; }
.pf-subs span:first-child { background: var(--brand); color: var(--on-brand); border-radius: var(--r-ctl) 0 0 var(--r-ctl); }
.pf-subs span:last-child { border-radius: 0 var(--r-ctl) var(--r-ctl) 0; border-left: 0; }
.pfa { margin-top: 28px; background: var(--panel); border-radius: var(--r-card); padding: 20px; display: grid; grid-template-columns: minmax(240px, 1fr) minmax(0, 2fr); gap: 16px; align-items: stretch; }
.pfa .ph { grid-column: 1 / -1; }
.pfa .ph .act { margin-left: auto; }
.pfa-rank { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 14px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-row); padding: 14px; color: var(--text); text-decoration: none; }
.pfa-rank:hover { border-color: var(--control); }
.pfa-rank .emb { width: 64px; height: 68px; }
.pfa-rank .rn { display: block; font: 700 20px/26px var(--font); margin-bottom: 8px; }
.pfa .stack { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.pf-rest { margin-top: 28px; display: flex; flex-direction: column; gap: 22px; color: var(--faint); font-size: 16px; }
.pf-rest b { color: var(--brand); font-weight: 500; font-size: 18px; opacity: .55; }
.pf-note { margin: 32px 0 0; padding-top: 16px; border-top: 1px dashed var(--control); font-size: 13px; line-height: 18px; color: var(--muted); }

@media (max-width: 1040px) {
  .s3 { grid-column: span 6; }
  .s9, .side { grid-column: 1 / -1; }
  .side .stack { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .rgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .rowc.al { grid-template-columns: 52px minmax(0, 1fr); row-gap: 8px; }
  .rowc.al .pgc { grid-column: 2; }
  .rowc.al .act { grid-column: 2; justify-self: start; }
  .side .stack { grid-template-columns: minmax(0, 1fr); }
  .dl { grid-template-columns: minmax(0, 1fr); gap: 20px; padding: 24px 20px; }
  .dl .bib.big { max-width: 220px; }
  .rank { padding: 18px; }
  .rank-top { grid-template-columns: auto minmax(0, 1fr); }
  .rank-top .emb { width: 64px; height: 68px; }
}
@media (max-width: 720px) {
  .road { min-width: 0; padding-block: 10px; } /* room for the current emblem, a little larger than the rest */
  .road .rail, .road .rail-fill { top: 26px; }
  .step .emb { width: 34px; height: 36px; }
  .step .sn, .step .sp, .step .you { display: none; }
  /* a phone gives each rank 31–45px: the emblems take their size from the road (container units), so even the larger
     current one keeps clear of its neighbours. --e is substituted where it is used, so its cqw are the road's */
  @supports (width: 1cqw) {
    .road { container-type: inline-size; --e: min(9.2cqw, 34px); }
    .step .emb { width: var(--e); height: calc(var(--e) * 68 / 64); }
    .road .rail, .road .rail-fill { top: calc(10px + var(--e) * 34 / 64 - 2px); } /* through the emblems' centres */
  }
}
@media (max-width: 640px) {
  main { padding-block: 24px 56px; }
  .bibs, .rgrid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .bibs > .bib.odd-last { grid-column: 1 / -1; }
  .sbibs { grid-template-columns: repeat(4, minmax(0, 52px)); }
  .bib .ttl { font-size: 20px; line-height: 22px; }
  .allh { margin-top: 40px; }
  dialog { width: 100%; max-width: none; margin: auto 0 0; border-radius: 12px 12px 0 0; max-height: 92vh; }
  .dl { padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
  .btn { flex: 1 1 auto; }
}
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; }
  button.bib:hover, .rcard:hover, .shw:hover { transform: none; }
}
@media (max-width: 760px) {
  .ask { grid-template-columns: 40px minmax(0, 1fr); padding: 18px; }
  .ask .dact { grid-column: 1 / -1; }
  .side.wide .stack { grid-template-columns: minmax(0, 1fr); }
  .pf { grid-template-columns: 80px minmax(0, 1fr); }
  .pf-subs { grid-column: 1 / -1; }
  .pfa { grid-template-columns: minmax(0, 1fr); padding: 16px; }
  .pfa .stack { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 640px) {
  .sd { padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px)); }
  .ask .dact .btn { flex: 1 1 0; }
  .nmenu { position: fixed; top: 52px; left: 12px; right: 12px; width: auto; max-width: none; }
  .cel .pts { font-size: 28px; line-height: 32px; }
}
@media (prefers-reduced-motion: reduce) { .sk, .cel .bib.big, .ru .emb { animation: none; } }

/* coach page */
.phead { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; }
.cav, .sav { flex: none; border-radius: 50%; background: #bdbdbd; color: #fff; text-align: center; }
.cav { width: 48px; height: 48px; font: 400 16px/48px var(--font); }
.phead .cn { font: 700 24px/30px var(--font); margin: 0; }
.phead .cm { margin: 2px 0 0; font-size: 14px; line-height: 20px; color: var(--muted); }
.rank .rlab { margin: 0 0 2px; font-size: 13px; line-height: 18px; color: var(--muted); }
.rank .rnote { margin: 2px 0 0; font-size: 13px; line-height: 18px; color: var(--muted); }
.ph .edit { margin-left: auto; color: var(--text); }
/* students two to a row: name and the button on top, rank and the last achievement side by side, what is close at the foot */
.slist { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.srow { display: grid; grid-template-columns: 40px minmax(0, 1fr) minmax(0, 1fr) auto; grid-template-areas: "av name name btn" "rk rk last last"; gap: 10px 14px; align-items: center; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-row); padding: 12px 14px; }
.srow .sav { grid-area: av; } .srow .sn2 { grid-area: name; min-width: 0; } .srow .sopen { grid-area: btn; }
.srow .srk { grid-area: rk; } .srow .slast { grid-area: last; }
/* the rank and the last achievement each sit on a faint ground, so a plate and its words read as one */
.srow .srk, .srow .slast { align-self: stretch; background: var(--panel); border-radius: var(--r-row); padding: 8px 10px; }
/* the last achievement: its level in the plate band, the date alone beside it */
.srow .slast .mb.lv { width: 80px; height: 46px; }
.srow .slast .mb.lv i { height: 17px; font: 500 10.5px/17px var(--font); font-style: normal; color: var(--bci); text-align: center; white-space: nowrap; overflow: hidden; padding: 0 3px; }
.srow .slast .mb.lv b { font-size: 14px; }
.srow .lvt { display: none; }
.sav { width: 40px; height: 40px; font: 400 14px/40px var(--font); }
.srow b { font-weight: 500; }
.srow small, .snear small { display: block; font-size: 13px; line-height: 18px; color: var(--muted); }
.srk, .slast { display: flex; align-items: center; gap: 10px; min-width: 0; }
.srk .emb { width: 34px; height: 36px; flex: none; }
.snear { font-size: 13px; line-height: 18px; }
.bibs.c6 { grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: 0; }
.bibs.c5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.bibs.c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 0; }
.slot { appearance: none; min-height: 150px; display: grid; place-content: center; gap: 4px; padding: 12px; text-align: center; cursor: pointer; background: var(--surface); border: 1px dashed var(--control); border-radius: var(--r-row); color: var(--muted); font: 500 14px/20px var(--font); }
.slot small { font-size: 13px; line-height: 18px; font-weight: 400; }
.slot:hover { border-color: var(--muted); color: var(--text); }
.sd { padding: 28px; position: relative; }
.sd h2 { font: 700 24px/30px var(--font); margin: 6px 40px 0 0; }
.sdh { display: flex; align-items: center; gap: 16px; }
.sdh .emb { width: 64px; height: 68px; flex: none; }
.sdt { font: 500 16px/22px var(--font); margin: 22px 0 12px; }
.sdn { margin-top: 14px; }
.plist { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.pgrp { border-top: 1px solid var(--track-soft); padding-top: 12px; }
.pgh { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.pgh b { font-weight: 500; }
.cst { font-size: 13px; line-height: 18px; color: var(--muted); }
.cst.yes { color: var(--pos); }
.prow { display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 6px 0; }
.prow b { font-weight: 500; }
.prow small { display: block; font-size: 13px; line-height: 18px; color: var(--muted); }
.prow.off b { color: var(--muted); }
.btn.ask { line-height: 30px; padding: 0 12px; font-size: 13px; }
.linkbtn[disabled] { color: var(--faint); cursor: default; text-decoration: none; }
.cgrp { margin-top: 24px; }
#legends .cgrp { margin-top: 0; }
.cgrp .ph { margin-bottom: 12px; }
.cgrp h3 { font: 500 16px/22px var(--font); margin: 0; }
.cgrp .bibs { margin-top: 0; }
@media (max-width: 1040px) {
  .bibs.c6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .bibs.c5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .bibs.c6, .bibs.c3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .slist { gap: 8px; }
  .srow { grid-template-columns: 32px minmax(0, 1fr); grid-template-areas: "av name" "rk rk" "last last" "btn btn"; gap: 10px; padding: 10px; }
  .srow .sav { width: 32px; height: 32px; font-size: 12px; line-height: 32px; }
  .srow .sopen { justify-self: stretch; padding: 0 8px; font-size: 13px; }
  .srow .srk .emb { width: 24px; height: 26px; }
  .srow .srk small { white-space: nowrap; }
  .srow .srk, .srow .slast { padding: 6px 8px; gap: 8px; }
  .srow .srk small, .srow .slast small { font-size: 12px; }
  .srow .slast .mb { display: none; }
  .srow .lvt { display: inline; } /* no plate on a phone, so the level goes back into the line */
  .slot { min-height: 96px; }
  .sd { padding: 24px 20px calc(24px + env(safe-area-inset-bottom, 0px)); }
}

/* the site's own menu over the page, the same links as the s10.run header (as on «Моя неделя») */
.bar .ava { position: relative; overflow: hidden; display: block; }
.bar .ava img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.navwrap { position: fixed; inset: 0; z-index: 2147483001; background: var(--brand); overflow: auto; overscroll-behavior: contain; }
.sitemenu ul { list-style: none; max-width: 1160px; margin: 0 auto; padding: 8px 0 40px; }
.sitemenu a { display: block; padding: 12px max(20px, env(safe-area-inset-left, 0px)); color: var(--on-brand); font-size: 16px; text-decoration: none; }
.sitemenu a:hover { text-decoration: underline; }
.sitemenu .sep { height: 1px; margin: 8px 0; background: rgba(255, 255, 255, 0.5); }
.bar :focus-visible, .navwrap :focus-visible { outline-color: #ffffff; }
`;
  const FONTS = 'https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@700;800&family=Roboto:ital,wght@0,400;0,500;0,700;1,900&display=swap';
  const LOGO = '<svg class="logo" viewBox="0 0 89 27" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M23 17.9L22.6 17.6L22.5 17.7L22.4 17.5L22 17.7L21.6 17.3L21.2 17.5L20.7 17.3L20.1 16.8L20.2 16.1L20.6 15L20.7 14.1L21.2 14.1L21.4 13.9L21.4 13.5L21.2 13.1L21.5 12.3L22.6 11.5L22.5 11.3L22.9 10.9L22.7 10.7L23.3 10.3L23.6 9.7L23.6 9.6L23.2 10L22.5 10.2L22.1 10.8L22.1 10.4L22.7 8.9L23.1 7L23.3 6.8L24 4.6L24.8 3L24.7 2.5L25.6 1L25.6 .7L25.4 .4L25.8 0L26.3 .2L26.9 .1L28.8 1.4L28.9 2.1L28.4 3.3L28.5 3.4L28.4 3.8L28.6 3.9L27.5 6L27.4 6.3L27.6 6.3L27.3 7L27.2 7.8L26.8 8.3L26.8 8.8L26.3 9.2L26.3 10.6L26 10.9L26 11.1L25.1 13.2L25.2 14.2L24.9 14.9L24.7 15.5L24.9 15.9L24.4 17.6L23.9 18.3L23.2 18.1L23 17.9ZM20.6 15.3L20.7 15.6L20.8 15.3L20.6 15.3ZM20.8 15.1L21 15.1L21.1 14.9L20.9 14.8L20.8 15.1ZM21.7 11.6L21.9 11.4L22.1 11.4L21.9 11.8L21.7 11.9L21.7 11.6ZM22.1 12.7L21.8 13L21.8 13.3L22.3 13L22.5 13L22.5 13.2L22.9 12.8L22.1 12.7ZM22.3 12.5L22.8 12.4L23 11.7L22.3 12.5ZM24.6 16L24.2 16.2L24.6 16.1L24.6 16Z" fill="white"/><path d="M37.1 16.9L36.7 17.1L34.6 17L33.1 16.5L32.2 15.9L31.7 15.2L31.6 14.5L31.4 14.4L31.4 14.2L31.2 14.4L31.6 13.2L31.5 13.1L31.3 13.2L31.3 13.1L31.4 12.6L31.3 12.5L31.3 12.6L31.3 11.8L31.6 11.4L31.3 11.5L31.6 10.9L31.8 9.6L32 9.4L31.9 9.6L32.3 9.4L32.2 9.2L32.6 7.9L32.7 7.6L32.5 7.7L32.7 7L34.1 5L34 4.6L34.3 4.5L34.5 3.3L35.7 1.8L36.7 1.5L36.7 1.8L37.6 1.7L38 1.4L38.4 1.5L41.4 2.1L43 3.5L43.1 3.9L43.3 4L43.4 5.2L43.9 5.9L43.7 6.6L43.8 7L43.9 9L43.8 9.4L43.7 9.5L43.6 9.3L43.4 9.6L43.3 10.3L43.1 10.6L43.3 11.1L42.7 12.2L42.4 12.3L42.1 13.5L41.9 13.4L41.9 13.9L41.3 14.3L41.2 14.2L41.2 14.6L40.7 14.8L40.6 15.2L38.9 16.7L37.6 17.1L37.1 16.9ZM32.4 8.2L32.2 8.7L31.8 9.1L32.1 8.4L32.4 8.2ZM32.2 11L32.1 11.5L32.4 11.2L32.2 11ZM34.5 13.3L34.7 14.2L35.1 14.8L35.7 15L36.4 14.9L37.1 14.6L37.9 13.9L39.2 11.8L39.6 9.9L40.3 7.8L40.4 5.5L40.6 5L40 4.2L39.9 4.3L39.5 4.2L39.5 3.8L39.4 3.7L38.6 3.7L38.2 3.9L36.5 6.5L35.8 8.4L35.6 8.6L34.9 11.2L34.5 12L34.6 12.1L34.5 12.3L34.5 13.3ZM38.2 3.2L39.5 3.3L39.3 3.1L38.7 2.9L38.6 3.1L38.2 3.2ZM41 14L41.3 14L41.3 13.6L41 14ZM43.3 7.5L43.5 7.8L43.6 7.5L43.4 6.9L43.3 7.5Z" fill="white"/><path d="M43.4 18.1L43.6 16.2L45.3 15.5L46.5 15.7L47 16L47 16.6L46.7 17.6L46.7 18.8L46.1 19.3L45.3 19.5L44.2 19.4L43.6 18.8L43.4 18.1Z" fill="white"/><path d="M53.6 14.3L53.7 15.2L53.6 15.6L53.4 17.2L52.6 17.3L52.6 17.1L52.5 17.6L51.3 17.3L50.7 17.3L50.7 17L50.4 16.3L50 16.1L50.2 15.4L50.1 13.9L50.4 13.6L50.3 13.2L50.5 12.8L50.5 11.3L50.8 7L51.5 6.9L52.9 7.4L54 9L56.1 7.7L58.6 6.4L59.8 6.9L60.5 7.6L60.1 8.3L59.6 8.5L59.5 8.8L59.3 8.9L58.4 9.1L58.3 9.2L55.9 10.1L53.7 11.9L53.6 12.3L53.9 12.6L53.6 14.3ZM55.1 8.9L54.2 9.5L55.3 8.9L55.3 8.7L55.1 8.9ZM57.1 8L55.8 8.7L57.6 8L57.1 8Z" fill="white"/><path d="M70.8 9.4L71 9L71.1 9.6L71.3 9.6L71.6 8.8L71.6 8.6L71.3 8.7L71.2 8.1L71.6 7.1L71.6 6.6L71.9 6.5L74.2 6.5L75.2 7.3L75.4 7.7L75.5 8L74.6 10.8L74.1 13.7L74 13.7L73.8 14L73.6 15.2L73.8 16.5L73.7 17.1L72.3 17.3L71.6 17.5L71.1 17.5L69.9 16.7L69.9 15.5L68.4 16.4L66.2 16.7L66 16.5L64.7 16.3L63.6 15.4L63.2 14.8L62.9 13.6L63.6 9.5L64 8.7L64.2 7.7L64.4 7.3L65 7.3L65.6 7.7L66.4 8.4L66.7 9.1L65.8 13.4L66.1 14.3L66.3 14.5L67.6 14.4L68.9 13.9L69.9 13.1L70.2 12.4L70.4 12.4L71.1 11.9L71 11.7L70.4 11.7L70.9 10.8L70.4 10.6L70.9 10L70.8 9.4ZM70.9 10.3L70.7 10.4L70.8 10.5L70.9 10.3ZM71 11.5L71.2 11.4L71.5 10.7L71 11.5ZM71.2 10.2L71.2 10L71.2 10.2Z" fill="white"/><path d="M78.1 12.6L78.5 11.7L78.5 10.9L78.8 10.1L80.1 7.6L80.3 7.4L81.3 7.6L82.2 8.2L82.8 8.9L82.8 9.5L85.6 8.3L86.6 8.1L88.5 9L88.5 9.6L88.3 9.7L88.5 9.9L88.5 10.9L88.3 11.6L88 12.1L88.2 12.1L88.2 12.6L87.7 14.7L87.7 15.4L87.5 15.9L87.5 16.4L86.8 17L85.8 16.9L85.2 15.8L85.1 13.3L85.3 11.2L85.2 10.3L83.1 11.3L82.2 12.3L82 13L82 13.8L82.3 13.6L82.2 13.9L81.6 14.9L81.9 16L81.8 16.9L80.9 17.2L79.3 17L77.9 16.4L78.2 16L77.9 16L78 15.7L78.1 15.9L78.2 15.8L78.7 15.1L78.6 15L78.4 15.1L78 15L78.3 14.1L77.8 13.9L78.2 13.2L78.1 12.6ZM78.2 13.6L78.1 13.7L78.2 13.8L78.2 13.6ZM78.3 14.6L78.3 14.4L78.3 14.6ZM78.5 13.5L78.5 13.3L78.5 13.5ZM78.6 14.7L78.7 14.7L78.8 14L78.6 14.3L78.6 14.7Z" fill="white"/><path d="M5.4 2.8L5.7 2.2L5.4 2.3L5.4 2.8Z" fill="#FF6F61"/><path d="M5 4.3L5.2 3.3L4.9 4.1L5 4.3Z" fill="#FF6F61"/><path d="M15.3 9L15 8.7L14.4 8.5L14.1 8.1L14.7 8.2L15.2 8.5L15.4 8.7L15.3 9Z" fill="white"/><path d="M10.3 14.8L10.3 14.6L10.7 14.5L10.3 14.8Z" fill="white"/><path d="M19.4 1.5L17.5 .4L16.6 .3L12.6 .1L9.9 .4L7.4 .8L6.7 1.2L5.7 2.5L4.7 5.8L4.2 6.3L4.2 6.9L4 7.3L4.1 7.9L5.1 9.6L6.4 10.3L8.4 10.9L9.7 11.1L12.2 10.7L12.6 10.1L12.2 9.7L10.4 9.1L9.8 9.1L9.3 8.7L8.2 8.4L7.9 8.1L7.6 7.6L7.6 7L8 5.7L8.5 4.6L9.9 3.7L12.4 3.2L14.5 3.3L16.4 3.1L18.1 3.6L18.6 3.6L19.1 3.4L19.4 2.9L19.4 2.1L19.6 1.8L19.4 1.5ZM12.9 2.6L10.8 2.9L12.4 2.5L12.9 2.6ZM17.2 2.6L16.7 2.4L15.5 2.4L16.4 2.2L17.4 2.5L17.2 2.6Z" fill="#F9625A"/><path d="M16.1 9.2L15.8 8.7L15.2 8.1L14.2 7.6L11.4 7.2L9.3 7.2L8.7 7.7L8.8 7.9L10.4 8.6L12.3 9L12.9 9.3L13.2 9.7L13.3 11.8L11.7 13.8L11.2 14.1L9.7 14.5L3.8 14.2L1.8 13.8L.9 13.8L.4 14.1L.4 15.8L0 15.9L.2 16.1L0 16.3L3.8 17L8.4 17.3L11.5 17L13.1 16.5L13.9 15.9L16.2 13.1L16.4 11.2L16.1 9.2ZM.8 16.2L.7 15.9L1 16.1L.8 16.2ZM1.1 16.5L1.1 16.3L1.1 16.5ZM1.7 14.6L1.6 14.4L1 14.6L1.3 14.2L2 14.2L1.7 14.6ZM15.7 9.2L15.6 9.4L15.4 9.1L15.5 9L15.7 9.2Z" fill="white"/><path d="M6.2 19.1L5.8 19.1L6 19.3L5.3 19.1L6.1 19.9L5.8 19.9L9.6 22.7L13.4 25L15.4 25.9L17.5 26.5L19.7 26.9L21.8 27L23.9 26.8L26.1 26.3L28.3 25.5L30.5 24.4L32.7 22.9L34.7 21.3L34.7 21.1L33.3 22L35.3 20.3L35.1 20.4L35.3 20.2L35.3 19.7L34.9 19.9L36.1 18.8L31.9 21.7L28.2 23.5L25 24.4L23 24.7L21.1 24.8L17.7 24.5L15.6 24L13.8 23.4L11.5 22.3L8.2 20.1L8.2 20.3L6.2 19.1ZM34.3 21.5L34.1 21.6L34.3 21.5Z" fill="#F9625A"/><path d="M10.4 22.7L9.8 22.6L8.3 21.5L10.4 22.7Z" fill="white"/><path d="M26 25.9L26.8 25.7L27 25.3L26 25.9Z" fill="white"/><path d="M27.6 25.3L28.9 24.7L29.4 24.3L27.6 25.3Z" fill="white"/><path d="M10.6 23L10.8 23.2L11.1 23.2L10.6 23Z" fill="white"/><path d="M31 22.4L31.5 22.2L31 22.4Z" fill="white"/></svg>';
  const BELL = '<button class="bell" type="button" id="bell" hidden aria-label="Уведомления" aria-expanded="false" aria-controls="nmenu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg><span class="dot" id="bell-dot" hidden></span></button>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- the API ---------- */
  class ApiError extends Error { constructor(status, body) { super(`HTTP ${status}`); this.status = status; this.body = body; } }
  const api = {
    async get(action, id) {
      const q = new URLSearchParams({ action }); if (id) q.set('id', id);
      const r = await fetch(`${API}?${q}`, { credentials: 'include' });
      const body = await r.json().catch(() => null);
      if (!r.ok) throw new ApiError(r.status, body);
      return body;
    },
    async post(action, fields = {}) {
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
  /* S10 achievements: the athlete's page (their own or another athlete's) and the block in their profile.
   Everything is drawn from GET /apiweb/achievements.php?action=athlete|widget (contract/API.md): the server counts the
   levels, the points and the rank, the page only shows them and sends the athlete's choices back. */
function athleteApp(ROOT, api, me, opts) {
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

/* S10 achievements: the coach's page (as the coach sees it, or anyone else: «Сильные стороны») and the block in the
   coach's profile. Drawn from GET /apiweb/achievements.php?action=coach|coach_widget (contract/API.md): the server counts
   every figure for all the time on S10 and proves each level with enough data (gates); the page shows it and sends the
   coach's choices back: the students' showcase, who sees it, a request for a student's consent. */
function coachApp(ROOT, api, me, opts) {
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
