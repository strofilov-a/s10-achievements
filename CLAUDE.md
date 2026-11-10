# S10 achievements and ranks — context for Claude Code

Achievements («достижения») and ranks («звания») for s10.run, a Russian running-coaching site: an athlete's page, a
coach's page and a block in each profile. Finished code, not a spec: the S10 developers install it with as little work
of their own as possible (the owner's goal, 06.11.2026; quality over speed, everything counted on the server).

The owner talks Russian: answer him in Russian, plainly. The UI and the developer briefs are Russian; code comments and
this file are English.

## Links

- Demo (GitHub Pages from `main`, the repo root): https://strofilov-a.github.io/s10-achievements/ — the very code that
  goes on the site, on the contract's examples; the bar bottom left switches the page and its state (`#new`, `#levelup`, …).
- Repo: https://github.com/strofilov-a/s10-achievements (public). Push:
  `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push` (needs `gh auth login`).
- The TZ (spec): a Claude Docs doc https://claude.ai/artifact/KWWTeSFtMyFQm44st8uxFk (rev 37), a copy in `docs/TZ.md`
  and `docs/TZ.pdf` (both go into the archives). The rules there are binding; how-to lives in the code and the briefs.
- Retired: the HTML prototypes (Claude artifacts 4eCfzvZtCqvRx6wqi1iJQx athlete v44, 4tWXEi62YhBrZJ8C2vy7oW coach v16).
  Their catalog and states were moved into `catalog/` and `contract/mock/` (`tools/export-prototype.mjs`, one time).
- Sister project with the same site conventions: «Моя неделя» (S10 Solo), `~/Projects/s10-week` — its `CLAUDE.md` has
  the map of the site's existing API; the header and the S10 menu here are copied from its `solo.js`.

## Where it stands (10.11.2026)

The owner has the two archives to send to the S10 developers: backend `s10-achievements-backend-943c40f.zip`,
frontend `s10-achievements-frontend-70b3860.zip` (`sh tools/zip.sh <dir>` rebuilds them from `release/`).

Waiting for, from the S10 backend developer:
1. the level distribution after the history recount (`php cli/report.php`, a .md and a .csv);
2. a link to the test server;
3. answers: is the coach ↔ student history kept with dates and payments (every coach achievement depends on it); the
   typtrain code of a strength workout (assumed 7, `backend/achievements/config.php` `strength_type`).

Then: tune the thresholds from the distribution (edit `catalog/*.json`, copy to `backend/achievements/catalog/` — a
meta test fails when they differ), check the pages on the test server, adapt the code if their data differ from what
the adapter assumes, rebuild, all tests, and a release with only what changed (a backend-only release is the usual case:
the thresholds live in the server's catalog). The developer's filled `S10Source.php` must survive a release.

Not verified: a real MySQL/MariaDB (the tests run on SQLite), a real PHP 7.4 (tests on PHP 8.5; a token scan blocks
anything newer). No WMA age-grading table yet, so the coach's «Уровень учеников» is off; the Boston standards in
`backend/achievements/data/boston.php` are marked «verify».

## Who does what

- Backend developer: run `sql/achievements.sql` (12 `ach_*` tables, no existing table changes), copy `apiweb/achievements.php`
  and the `achievements/` + `cli/` folders, fill ONE file `achievements/S10Source.php` (SQL against their tables; required:
  `db, currentUserId, users, isCoach, athleteIds, coachIds, changedUserIds, runs, plan, races, coaches, students`; the rest
  optional, `null` = no such data → those achievements are not shown), `cli/check.php --user=ID`, `cli/recalc.php --history`
  once, two cron lines (`worker.php` every 5 min, `nightly.php`), `cli/report.php` back to us. Brief: `backend/README.md`.
- Frontend developer, about an hour: `/t5/achievements/achievements.js`, routes `/achievements/athlete` and
  `/achievements/coach` serving `achievements.html` (`Cache-Control: no-cache`), `<div data-s10-achievements="widget"
  data-id="ID">` in an athlete's profile and `"coach-widget"` in a coach's, a menu item. Brief: `frontend/ЗАДАНИЕ.md`.
- Everything else is ours.

## Files

| Path | What |
| --- | --- |
| `catalog/athlete.json`, `coach.json`, `common.json` | The catalog (56 + 14), levels and points, both rank ladders, categories, units, coach gates. The single source. `enabled: false` hides an achievement: invite, cities, majors and the athlete's bq for now |
| `contract/API.md`, `contract/mock/*.json` | The API both sides keep to; one mock per state (athlete normal/new/friend/hidden/levelup/rankup/profile, coach normal/few/empty/public/hidden/levelup/rankup/profile). The demo's data and the backend's contract test |
| `frontend/src/shell.js` | Mounting (shadow root per host, a MutationObserver for hosts that appear later), the site header with the S10 menu, `api.get/post`, `whoAmI` (`/apiweb/student/self/info/`), the demo block |
| `frontend/src/core.js` | Shared by both pages: levels, rank emblems (`emblem()`, `PLATE`), the bib card, formatting, `fromItem` (API item → card fields), `useLevels`. `tierOf(a) = a.d.length`: the server decides the level |
| `frontend/src/athlete.js`, `coach.js` | `athleteApp` / `coachApp(ROOT, api, me, opts)`: each runs the core in its own scope (`/*CORE*/`), may override helpers (the coach's `fmtN`, `status`, `remaining`); `boot(D)`, `load()`, `celebrate()`, `renderWidget()` |
| `frontend/src/style.css`, `achievements.html` | Styles (tokens on `:host`); the page shell for s10.run (from s10-week's `solo.html`) |
| `frontend/build.mjs` | → `release/frontend` (no demo: `/*<demo>*/…/*</demo>*/` cut and checked, `?v=` stamp), `dist/achievements.js`, `index.html`, `coach.html` |
| `backend/` | PHP: `achievements/` (Source/S10Source, Engine/* pure, Store, Service, Recalc, …), `apiweb/`, `cli/`, `sql/`, `dev/router.php`, `tests/` |
| `release/frontend`, `release/backend` | What the developers get; `tools/release-backend.sh` builds the backend one and runs its tests inside it |
| `tests/frontend.mjs`, `tests/live.mjs`, `tests/live/*.html` | The demo in Chrome (149 checks); the release build against the real backend on its fixture users (95) |
| `tools/dev/` | Helpers: `states.mjs` (a shot per hash state and action, with errors), `el-shot.mjs`, `ring-shot.mjs` (the rank road on a phone, DPR 3), `montage.mjs` (shots on one sheet), `rep.py` (exact, unique replacements) |
| `assets/` | Rank emblems as SVG and level colours, for slides and mock-ups |

## Commands

```
node frontend/build.mjs                       # the release, the demo
node tests/frontend.mjs                       # 149 checks; Chrome at the macOS path or $CHROME
php backend/tests/run.php                     # 59 tests, 1 042 checks (needs pdo_sqlite: brew install php)
php -S 127.0.0.1:8090 backend/dev/router.php  # the real API on SQLite fixtures: /dev/ lists users and states, ?as=ID logs in
node tests/live.mjs                           # 95 checks against that server
sh tools/release-backend.sh && sh tools/zip.sh ~/Desktop
```

Run the three suites before every push and every archive. Push after a change the owner wants to see: the demo updates
about a minute later.

## Rules the code keeps

- Levels never go down; each level has its date; several at once each dated. Points: Бронза 10, Серебро 25, Золото 50,
  Платина 100, Титан 150, Мастер 200, Чемпион 300, Элита 400; «Получено» 25; an opened secret («Легендарное») 500.
- Athlete ranks from 0 / 300 / 1 500 / 3 500 / 6 500 / 12 000 / 20 000 / 32 000 points; coach ranks 0 / 100 / 300 / 800 /
  1 600 / 3 000 / 5 000 / 8 000 (to check against the distribution). The coach's rank counts all 10 tier achievements and
  the opened secrets.
- Coach maths (owner 06.11.2026, «честно для всех»): every figure for all time, raw; a level counts only with data ≥
  base × step (`coach_gates`: base per unit, step 1,1,1,2,4,6,8,10); a student's result counts after 8 weeks with the coach;
  «Удержание» = n / (n − x) months; «Саб 3» is a lifetime counter 1×, 2×, 3× of students under 3:00, kept when they
  leave, +500 once.
- Secrets never leave the server closed (an opaque id and the rarity only). Another person sees earned levels and dates,
  no figures; a coach's public view: the rank, the students' showcase (consent `yes` only), up to 5 strengths from Gold.
- Notifications: the newest 10 in the bell; opening it marks every unread one read. The level-up and rank-up windows
  show once (`celebrated`). The history recount creates no notifications.

## Design decisions (from the owner; keep them)

- Neutral names in the demo: «Тренер», «Атлет 1…6». Level names are neutral nouns (a low level must not read as an insult).
- «Лучший прирост» removed, «Точная цель» added for the coach; the athlete's «Из трёх» renamed «Саб 3».
- Students two to a row; the level written in the plate's band with the date beside it; no «На подходе» in the student
  cards; a faint ground (`--panel`) under the rank and the last achievement.
- The rank road: no circle round the current rank (10.11.2026) — a larger emblem, the end of the blue line and «Вы здесь».
  On a phone the emblems take their size from the road (container units), so nothing overlaps at 320–640 px.
- Light theme only, the s10 blue header, Roboto + Roboto Condensed for the cards, the red s10 button as on the site.
- The four achievements without data on S10 are hidden, not shown as «скоро».

## Safety

Never put the owner's real data (or anyone's) on the public repo or GitHub Pages without his explicit yes. Never ask for
or accept passwords, server access or keys: the developers fill the adapter themselves. Read-only checks on the live site
only with the owner's yes, as in s10-week's `s10-live-check` skill.
