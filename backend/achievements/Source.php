<?php
namespace S10Ach;

/**
 * Everything the achievements need from the site. S10Source.php implements it with SQL on the site's tables;
 * the tests and the dev server implement it on fixture data.
 *
 * Conventions for every method:
 *  - dates are 'YYYY-MM-DD' strings, date-times 'YYYY-MM-DD HH:MM:SS', both in Moscow time like the rest of the site;
 *  - user ids are the site's profile ids (int);
 *  - optional data: return null when S10 has no such data at all. The achievements that need it then switch off
 *    for everyone. Return [] when the data exists but this user has none.
 *  - order of the returned lists does not matter, the engine sorts.
 */
interface Source
{
    // ---------- site ----------

    /** PDO to the site's database; the ach_ tables live there too. */
    public function db();

    /** int|null — the logged-in user of this request (the same session as /apiweb/*.php), null when logged out. */
    public function currentUserId();

    /** [id => ['name' => 'Имя Фамилия']] for the ids that exist; missing ids are left out. */
    public function users(array $ids);

    /** bool — the user is a coach (has a coach profile, even without students). */
    public function isCoach($userId);

    /** bool — $viewerId follows $ownerId (for «Подписчики»). No subscriptions on the site: return false. */
    public function isSubscriber($viewerId, $ownerId);

    /** int[] — every athlete to count (users with any runs, results or plan). */
    public function athleteIds();

    /** int[] — every coach. */
    public function coachIds();

    /** int[] — users whose runs, plan, results, reports, coach links, posts… changed after unix time $since. */
    public function changedUserIds($since);

    // ---------- athlete ----------

    /**
     * Runs (only running: no rides or hikes), Strava, Garmin and manual alike; duplicates are merged by the engine.
     * [[
     *   'id'     => '123',                  // the site's track id
     *   'source' => 'strava',               // strava | garmin | manual | …
     *   'start'  => '2025-03-16 09:05:00',  // local start; 'YYYY-MM-DD' alone when the time is unknown
     *   'km'     => 42.4,
     *   'sec'    => 17033,                  // moving time
     *   'track'  => true,                   // has a GPS track / device file; false = typed in by hand
     *   'elev'   => 120.0,                  // optional: elevation gain, m (null = unknown)
     *   'hr_easy'=> true,                   // optional: the whole run in heart-rate zones 1–2 (null = unknown)
     * ], …]
     */
    public function runs($userId);

    /** Optional. [trackId => [sec of km 1, sec of km 2, …]] — full kilometres only. null = no splits on S10. */
    public function splits($userId);

    /**
     * Planned days from the diary. [['date' => 'YYYY-MM-DD', 'type' => typtrain, 'km' => planned km, 'done' => null], …]
     * typtrain: 0 none · 1 recovery · 2 development · 3 interval · 4 repeat · 5 long · 6 race · strength (config).
     * 'done': true/false when the site knows it, null = the engine decides (runs that day ≥ 80% of the planned km).
     */
    public function plan($userId);

    /**
     * Races (planresults). [[
     *   'id' => 723890, 'date' => '2026-10-11', 'km' => 21 (as stored: 5, 10, 21, 42 or exact),
     *   'sec' => 5890 (result, null = not run yet), 'goal' => 6000 (goal time, null = none),
     *   'location' => 'LISBON', 'main' => true (the target race of a master plan),
     * ], …]
     */
    public function races($userId);

    /** Optional. Master plans: [['from' => 'YYYY-MM-DD', 'to' => race day 'YYYY-MM-DD'], …]. */
    public function masterPlans($userId);

    /** Optional. Dates of the workout reports the athlete sent: ['YYYY-MM-DD', …]. */
    public function reports($userId);

    /** Optional. Mondays of the weeks the athlete built in «Создать неделю»: ['YYYY-MM-DD', …]. */
    public function ownWeeks($userId);

    /** Optional. Interval sessions: [['date' => …, 'plan_pace' => sec/km, 'laps' => [sec/km of each work lap]], …]. */
    public function intervals($userId);

    /** Optional. S10 challenges: [['date' => …, 'name' => 'Осенний сплит', 'place' => 12|null, 'neg_split' => true|false|null], …]. */
    public function challenges($userId);

    /** Optional. Overall S10 rating, the place in each season: [['season' => 'Осень 2026', 'date' => …, 'place' => 119], …]. */
    public function rating($userId);

    /** Optional. S10 tournament seasons: [['season' => …, 'date' => …, 'place' => 1], …]. */
    public function tournament($userId);

    /** Optional. Dates of the user's posts: ['YYYY-MM-DD', …]. */
    public function posts($userId);

    /** Optional. Dates of the «Нравится» marks the user's posts received. */
    public function likes($userId);

    /** Optional. Dates of the comments the user left on posts and workouts. */
    public function comments($userId);

    /** Optional. Dates when friends signed up with the user's link. */
    public function referrals($userId);

    /** Optional. Cities run in: [['date' => first run there, 'city' => 'Москва'], …]. */
    public function cities($userId);

    /** Optional. string 'YYYY-MM-DD' = in an S10 club since; '' = not in a club; null = no clubs on S10. */
    public function clubSince($userId);

    /** Optional. ['birth' => 'YYYY-MM-DD'|null, 'sex' => 'm'|'f'|null]. */
    public function person($userId);

    /** Optional. S10 forecast for the athlete, seconds: [5 => 1300, 10 => 2700, 21 => 6000, 42 => 12400] (any of them). */
    public function forecast($userId);

    // ---------- coach ↔ athlete ----------

    /** Paid periods with coaches: [['coach_id' => 12, 'from' => 'YYYY-MM-DD', 'to' => 'YYYY-MM-DD'|null (still with him)], …]. */
    public function coaches($athleteId);

    /** The same periods seen from the coach: [['athlete_id' => 3, 'from' => …, 'to' => …|null], …]. */
    public function students($coachId);

    /**
     * Optional. The students' workout reports and the coach's answers (an answer = his comment of 20+ characters):
     * [['report_at' => 'YYYY-MM-DD HH:MM:SS', 'reply_at' => 'YYYY-MM-DD HH:MM:SS'|null], …], all time.
     */
    public function replies($coachId);
}
