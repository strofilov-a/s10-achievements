<?php
namespace S10Ach\Tests;

use S10Ach\Engine\D;

// Synthetic S10 data for the tests and the dev server: deterministic (own random generator), no real people.
//
//   3  Атлет 3        years of runs and races, coach 12 since Feb 2026 (consent asked, pending)   → athlete-normal
//   4  Новый атлет    nothing yet                                                                  → athlete-new
//   5  Друг           a few runs; the one who looks at others                                     → friend / public
//   6  Скрытный       «Только я»                                                                   → athlete-hidden
//  12  Тренер         6 current students, 10 who left (two of them with sub-3)                    → coach-normal
//  13  Новый тренер   2 students since May and July 2026                                          → coach-few
//  14  Пустой тренер  no students                                                                 → coach-empty
//  15  Скрытый тренер «Только я»                                                                   → coach-hidden
final class World
{
    public $today = '2026-11-06';
    public $users = [];
    public $coaches = [];
    public $runs = [];
    public $splits = [];
    public $plan = [];
    public $races = [];
    public $masterPlans = [];
    public $reports = [];
    public $ownWeeks = [];
    public $intervals = [];
    public $challenges = [];
    public $rating = [];
    public $tournament = [];
    public $posts = [];
    public $likes = [];
    public $comments = [];
    public $club = [];
    public $person = [];
    public $forecast = [];
    public $stints = [];
    public $replies = [];
    public $subs = [];
    /** optional data the site "does not have": method name => true (the Source returns null) */
    public $missing = [];

    private $seed = 1;

    // ---------- random ----------

    private function rnd()
    {
        $this->seed = ($this->seed * 1103515245 + 12345) & 0x7fffffff;
        return $this->seed / 0x7fffffff;
    }

    private function between($a, $b)
    {
        return $a + ($b - $a) * $this->rnd();
    }

    private function chance($p)
    {
        return $this->rnd() < $p;
    }

    // ---------- building blocks ----------

    public function user($id, $name, $coach = false)
    {
        $this->users[$id] = ['name' => $name];
        if ($coach) {
            $this->coaches[$id] = true;
        }
        foreach (['runs', 'plan', 'races', 'masterPlans', 'reports', 'ownWeeks', 'intervals', 'challenges', 'rating', 'tournament', 'posts', 'likes', 'comments'] as $k) {
            if (!isset($this->{$k}[$id])) {
                $this->{$k}[$id] = [];
            }
        }
        if (!isset($this->splits[$id])) {
            $this->splits[$id] = [];
        }
        if (!isset($this->club[$id])) {
            $this->club[$id] = '';
        }
    }

    public function stint($coach, $athlete, $from, $to = null)
    {
        $this->stints[] = ['coach_id' => $coach, 'athlete_id' => $athlete, 'from' => $from, 'to' => $to];
    }

    private $runId = 1000;

    /** one run, optionally doubled by Strava like the real import does */
    public function run($uid, $date, $time, $km, $pace, array $o = [])
    {
        $id = (string) ($this->runId++);
        $sec = (int) round($km * $pace);
        $track = isset($o['track']) ? $o['track'] : true;
        $run = [
            'id' => $id, 'source' => $track ? 'garmin' : 'manual', 'start' => $time !== null ? "$date $time:00" : $date, 'km' => round($km, 2), 'sec' => $sec,
            'track' => $track, 'elev' => isset($o['elev']) ? $o['elev'] : ($track ? round($km * ($this->chance(0.03) ? $this->between(20, 45) : $this->between(1, 4))) : null),
            'hr_easy' => isset($o['hr']) ? $o['hr'] : ($track ? $pace > 300 : null),
        ];
        $this->runs[$uid][] = $run;
        if ($track) {
            $splits = [];
            $even = isset($o['even']) ? $o['even'] : $this->chance(0.3);
            for ($k = 0; $k < (int) floor($km); $k++) {
                $splits[] = (int) round($pace + ($even ? $this->between(-3, 3) : $this->between(-12, 12)));
            }
            if (isset($o['fast'])) {
                $splits[0] = $o['fast'];
            }
            $this->splits[$uid][$id] = $splits;
        }
        if (!empty($o['dup'])) {
            // the same run again from Strava: same start, the distance a bit different
            $copy = $run;
            $copy['id'] = 's' . $id;
            $copy['source'] = 'strava';
            $copy['km'] = round($km * 1.004, 2);
            $copy['elev'] = null;
            $this->runs[$uid][] = $copy;
        }
        return $id;
    }

    public function race($uid, $date, $km, $sec, $loc, $goal = null, $main = false)
    {
        $this->races[$uid][] = ['id' => count($this->races[$uid]) + 1, 'date' => $date, 'km' => $km, 'sec' => $sec, 'goal' => $goal, 'location' => $loc, 'main' => $main];
        $exact = ['5' => 5.0, '10' => 10.0, '21' => 21.0975, '42' => 42.195];
        $d = isset($exact[(string) $km]) ? $exact[(string) $km] : (float) $km;
        if ($sec !== null) {
            // the watch recorded it too
            $this->run($uid, $date, '09:00', $d * 1.006, $sec / $d + 1, ['hr' => false, 'even' => false]);
        }
        $this->plan[$uid][] = ['date' => $date, 'type' => 6, 'km' => $d, 'done' => null];
    }

    /**
     * Training from $from to $to: about $perWeek runs a week; plan days and reports while $coached says so.
     * @param array $p perWeek, km, long, pace, longPace, early, night, two, manual, dup, plan (bool), from plan date, reports
     */
    public function train($uid, $from, $to, array $p)
    {
        $per = isset($p['perWeek']) ? $p['perWeek'] : 3;
        $km = isset($p['km']) ? $p['km'] : 7;
        $long = isset($p['long']) ? $p['long'] : 14;
        $pace = isset($p['pace']) ? $p['pace'] : 340;
        $planFrom = isset($p['planFrom']) ? $p['planFrom'] : null;
        for ($w = D::monday($from); $w <= $to; $w = D::add($w, 7)) {
            $n = max(0, (int) round($per + $this->between(-1.4, 1.4)));
            $days = [2, 4, 7, 6, 3, 5, 1];
            $days = array_slice($days, 0, min(7, $n));
            foreach ($days as $dow) {
                $date = D::add($w, $dow - 1);
                if ($date < $from || $date > $to) {
                    continue;
                }
                $isLong = $dow === 7;
                $dist = $isLong ? $long * $this->between(0.85, 1.15) : $km * $this->between(0.7, 1.3);
                $pc = ($isLong ? $pace + 15 : $pace) + $this->between(-25, 20);
                $time = '07:' . sprintf('%02d', (int) $this->between(0, 59));
                if ($this->chance(isset($p['early']) ? $p['early'] : 0.1)) {
                    $time = '06:' . sprintf('%02d', (int) $this->between(0, 50));
                } elseif ($this->chance(isset($p['night']) ? $p['night'] : 0.03)) {
                    $time = '21:' . sprintf('%02d', (int) $this->between(0, 30));
                    $dist = min($dist, 10);
                }
                $manual = $this->chance(isset($p['manual']) ? $p['manual'] : 0.04);
                $this->run($uid, $date, $time, $dist, $pc, ['track' => !$manual, 'dup' => !$manual && $this->chance(isset($p['dup']) ? $p['dup'] : 0.15)]);
                if ($this->chance(isset($p['two']) ? $p['two'] : 0.02)) {
                    $this->run($uid, $date, '19:30', 4 + $this->between(0, 3), $pc + 20);
                }
                if ($planFrom !== null && $date >= $planFrom) {
                    $type = [1 => 7, 2 => 3, 3 => 4, 4 => 2, 5 => 1, 6 => 1, 7 => 5][$dow];
                    $plannedKm = $type === 7 ? 0 : round($dist * $this->between(0.85, 1.12), 1);
                    $this->plan[$uid][] = ['date' => $date, 'type' => $type, 'km' => $plannedKm, 'done' => $type === 7 ? $this->chance(0.85) : null];
                    if ($type === 3 && $this->chance(0.5)) {
                        $plan = $pc - 40;
                        $laps = [];
                        $tight = $this->chance(0.4);
                        for ($i = 0; $i < 6; $i++) {
                            $laps[] = $plan + ($tight ? $this->between(-2.5, 2.5) : $this->between(-8, 8));
                        }
                        $this->intervals[$uid][] = ['date' => $date, 'plan_pace' => $plan, 'laps' => $laps];
                    }
                    if ($this->chance(isset($p['reports']) ? $p['reports'] : 0.6)) {
                        $this->reports[$uid][] = $date;
                    }
                }
            }
            if ($planFrom !== null && $w >= $planFrom) {
                // a missed planned day now and then, a strength session most weeks
                $miss = isset($p['miss']) ? $p['miss'] : 0.5;
                foreach ([3, 5] as $dow) {
                    $date = D::add($w, $dow - 1);
                    if ($date <= $to && $this->chance($miss / 2)) {
                        $this->plan[$uid][] = ['date' => $date, 'type' => 4, 'km' => 8, 'done' => null];
                    }
                }
                $mon = $w;
                if ($mon >= $from && $mon <= $to && $this->chance(0.6)) {
                    $this->plan[$uid][] = ['date' => $mon, 'type' => 7, 'km' => 0, 'done' => $this->chance(0.8)];
                }
            }
        }
    }

    /** the athlete kept to the plan in these weeks: every planned day done */
    public function stick($uid, $from, $to)
    {
        foreach ($this->plan[$uid] as $i => $p) {
            if ($p['date'] >= D::monday($from) && $p['date'] <= $to) {
                $this->plan[$uid][$i]['done'] = true;
            }
        }
    }

    /** the coach answers the reports of his students (minutes: about the median given) */
    public function answer($coach, $median, $unanswered = 0.03)
    {
        foreach ($this->stints as $s) {
            if ($s['coach_id'] !== $coach) {
                continue;
            }
            $to = $s['to'] !== null ? $s['to'] : $this->today;
            foreach ($this->reports[$s['athlete_id']] as $d) {
                if ($d < $s['from'] || $d > $to) {
                    continue;
                }
                $at = D::num($d) * 1440 + 20 * 60;
                $min = (int) round($median * exp($this->between(-1.2, 1.2)));
                $this->replies[$coach][] = [
                    'report_at' => self::dt($at),
                    'reply_at' => $this->chance($unanswered) ? null : self::dt($at + $min),
                ];
            }
        }
    }

    private static function dt($minutes)
    {
        return D::str(intdiv($minutes, 1440)) . ' ' . sprintf('%02d:%02d:00', intdiv($minutes % 1440, 60), $minutes % 60);
    }

    private function social($uid, $from, $posts, $likesPer, $comments)
    {
        $span = D::diff($from, $this->today);
        for ($i = 0; $i < $posts; $i++) {
            $d = D::add($from, (int) ($span * $this->rnd()));
            $this->posts[$uid][] = $d;
            for ($j = 0; $j < $likesPer * $this->between(0.5, 1.5); $j++) {
                $this->likes[$uid][] = min($this->today, D::add($d, (int) $this->between(0, 3)));
            }
        }
        for ($i = 0; $i < $comments; $i++) {
            $this->comments[$uid][] = D::add($from, (int) ($span * $this->rnd()));
        }
    }

    // ---------- the world ----------

    public static function build()
    {
        $w = new self();
        $t = $w->today;

        // Атлет 3: years of running, races, a coach since February
        $w->user(3, 'Атлет 3');
        $w->train(3, '2021-06-01', $t, ['perWeek' => 3.4, 'km' => 7.5, 'long' => 15, 'pace' => 335, 'planFrom' => '2026-02-01', 'early' => 0.12, 'night' => 0.03, 'two' => 0.03]);
        $w->train(3, '2023-01-02', '2023-01-12', ['perWeek' => 7, 'km' => 5, 'long' => 8, 'pace' => 345]); // a run every day
        foreach ([['2021-09-12', 5, 1650, 'MOSCOW'], ['2022-04-17', 10, 3150, 'MOSCOW'], ['2022-10-09', 21, 6950, 'KAZAN'], ['2023-04-23', 5, 1420, 'SOCHI'],
            ['2023-09-17', 10, 2950, 'MOSCOW'], ['2024-04-14', 5, 1290, 'MOSCOW'], ['2024-11-17', 21, 6380, 'MOSCOW'], ['2025-03-16', 42, 17033, 'BARCELONA'],
            ['2025-10-12', 10, 2700, 'MOSCOW'], ['2026-02-15', 5, 1138, 'SYDNEY'], ['2026-03-08', 21, 5890, 'LISBON'], ['2026-10-12', 10, 2618, 'LISBON']] as $r) {
            $w->race(3, $r[0], $r[1], $r[2], $r[3]);
        }
        $w->race(3, '2026-12-06', 42, null, 'VALENCIA', 11999, true);
        $w->masterPlans[3][] = ['from' => '2026-08-17', 'to' => '2026-12-06'];
        $w->ownWeeks[3][] = '2026-09-21';
        $w->forecast[3] = [5 => 1130, 10 => 2600, 21 => 5800, 42 => 12365];
        $w->person[3] = ['birth' => '1985-04-10', 'sex' => 'm'];
        foreach (['2023-11-30' => ['Осень 2023', 640], '2024-06-30' => ['Весна 2024', 410], '2025-09-01' => ['Лето 2025', 260], '2026-11-02' => ['Осень 2026', 119]] as $d => $r) {
            $w->rating[3][] = ['season' => $r[0], 'date' => $d, 'place' => $r[1]];
        }
        for ($i = 0; $i < 11; $i++) {
            $w->challenges[3][] = ['date' => D::add('2022-05-01', $i * 150), 'name' => 'Челлендж ' . ($i + 1), 'place' => 20 + $i * 7, 'neg_split' => $i % 3 === 0];
        }
        $w->social(3, '2022-01-10', 26, 26, 73);

        // Новый атлет: nothing at all
        $w->user(4, 'Новый атлет');

        // Друг: a few runs, looks at the others
        $w->user(5, 'Друг');
        $w->train(5, '2026-06-01', $t, ['perWeek' => 2, 'km' => 5, 'long' => 8, 'pace' => 380]);
        $w->subs[5][3] = true;

        // Скрытный: «Только я»
        $w->user(6, 'Скрытный');
        $w->train(6, '2025-01-01', $t, ['perWeek' => 3, 'km' => 8, 'long' => 14, 'pace' => 320]);

        // Тренер 12 and his students
        $w->user(12, 'Тренер', true);
        $students = [
            [21, 'Атлет 1', '2024-05-15', null, ['perWeek' => 5.5, 'km' => 12, 'long' => 26, 'pace' => 285], ['1982-06-01', 'm']],
            [22, 'Атлет 2', '2025-05-01', null, ['perWeek' => 4.5, 'km' => 9, 'long' => 18, 'pace' => 300], ['1990-02-11', 'f']],
            [24, 'Атлет 4', '2025-12-01', null, ['perWeek' => 4, 'km' => 9, 'long' => 20, 'pace' => 330], ['1988-08-20', 'm']],
            [25, 'Атлет 5', '2026-05-01', null, ['perWeek' => 6.5, 'km' => 14, 'long' => 30, 'pace' => 300], ['1979-03-02', 'm']],
            [26, 'Атлет 6', '2026-07-01', null, ['perWeek' => 4, 'km' => 8, 'long' => 16, 'pace' => 320], ['1995-12-24', 'f']],
            [27, 'Атлет 7', '2024-06-01', '2025-09-01', ['perWeek' => 5.5, 'km' => 12, 'long' => 26, 'pace' => 280], ['1987-01-15', 'm']],
            [28, 'Атлет 8', '2024-03-01', '2025-01-10', ['perWeek' => 5.5, 'km' => 12, 'long' => 26, 'pace' => 285], ['1984-05-05', 'm']],
        ];
        $left = [[41, '2024-04-01', '2024-07-20'], [42, '2024-07-01', '2024-11-15'], [43, '2024-09-10', '2025-01-05'], [44, '2025-01-15', '2025-05-20'],
            [45, '2025-03-01', '2025-06-10'], [46, '2025-06-01', '2025-10-25'], [47, '2025-09-01', '2026-01-20'], [48, '2026-01-10', '2026-05-30'],
            [49, '2025-02-01', '2025-03-20'], [50, '2026-03-01', '2026-04-10']]; // the last two left within 8 weeks
        foreach ($left as $i => $l) {
            $students[] = [$l[0], 'Атлет ' . (9 + $i), $l[1], $l[2], ['perWeek' => 3.5, 'km' => 8, 'long' => 15, 'pace' => 330 + $i * 4], [(1975 + $i * 3) . '-07-01', $i % 2 ? 'f' : 'm']];
        }
        foreach ($students as $s) {
            list($id, $name, $from, $to, $p, $person) = $s;
            $w->user($id, $name);
            $w->person[$id] = ['birth' => $person[0], 'sex' => $person[1]];
            $begin = D::add($from, -300);
            $end = $to !== null ? min($t, D::add($to, 120)) : $t;
            $w->train($id, $begin, $end, $p + ['planFrom' => $from]);
            $w->stint(12, $id, $from, $to);
        }
        $w->stint(12, 3, '2026-02-01');
        // results that matter for the coach
        $w->race(21, '2023-10-08', 42, 11900, 'MOSCOW');
        $w->race(21, '2024-04-21', 21, 5280, 'MOSCOW');
        $w->race(21, '2025-04-27', 21, 5040, 'MOSCOW', 5100, true);
        $w->race(21, '2025-10-12', 42, 11280, 'MOSCOW', 11400, true);
        $w->race(21, '2026-10-12', 42, 10721, 'CHICAGO', 10800, true);
        $w->masterPlans[21][] = ['from' => '2025-06-23', 'to' => '2025-10-12'];
        $w->masterPlans[21][] = ['from' => '2026-06-22', 'to' => '2026-10-12'];
        $w->stick(21, '2026-06-22', '2026-10-12');
        $w->race(22, '2025-03-02', 5, 1260, 'MOSCOW');
        $w->race(22, '2025-10-12', 10, 2490, 'MOSCOW', 2580, true);
        $w->race(22, '2026-03-08', 5, 1180, 'MOSCOW', 1190, true);
        $w->masterPlans[22][] = ['from' => '2025-07-07', 'to' => '2025-10-12'];
        $w->race(24, '2025-11-02', 10, 2950, 'MOSCOW');
        $w->race(24, '2026-02-22', 5, 1400, 'MOSCOW');
        $w->race(24, '2026-03-29', 21, 6500, 'MOSCOW');
        $w->race(24, '2026-04-26', 42, 13900, 'KAZAN', 13500, true);
        $w->masterPlans[24][] = ['from' => '2026-01-05', 'to' => '2026-04-26'];
        $w->stick(24, '2026-01-05', '2026-04-26');
        $w->race(25, '2026-09-20', 21, 5700, 'MOSCOW', 5500, true);
        $w->race(27, '2024-04-14', 42, 11100, 'MOSCOW');
        $w->race(27, '2025-04-27', 42, 10590, 'LONDON', 10620, true);
        $w->masterPlans[27][] = ['from' => '2025-01-06', 'to' => '2025-04-27'];
        $w->stick(27, '2025-01-06', '2025-04-27');
        $w->race(28, '2023-10-08', 42, 11400, 'MOSCOW');
        $w->race(28, '2024-10-13', 42, 10752, 'BERLIN', 10800, true);
        $w->masterPlans[28][] = ['from' => '2024-06-24', 'to' => '2024-10-13'];
        foreach ([41 => ['2024-03-10', '2024-06-30', 10, 3000, 2900], 42 => ['2024-05-05', '2024-10-20', 21, 6600, 6700], 43 => ['2024-06-02', '2024-12-08', 10, 2900, 2950],
            44 => ['2024-10-06', '2025-04-20', 21, 6900, 6500], 45 => ['2024-12-01', '2025-05-25', 5, 1420, 1400], 46 => ['2025-03-02', '2025-09-28', 10, 3100, 3000],
            47 => ['2025-05-04', '2025-12-07', 21, 6100, 6350], 48 => ['2025-09-07', '2026-04-19', 10, 2800, 2780]] as $id => $r) {
            // half of them ran faster before they came: no new personal best with this coach
            $w->race($id, $r[0], $r[2], (int) round($r[3] * ($id % 2 ? 0.98 : 1.03)), 'MOSCOW');
            $w->race($id, $r[1], $r[2], $r[3], 'MOSCOW', $r[4], true);
        }
        for ($i = 0; $i < 6; $i++) {
            $w->challenges[21][] = ['date' => D::add('2024-06-01', $i * 120), 'name' => 'Челлендж', 'place' => 8 + $i, 'neg_split' => true];
        }
        $w->answer(12, 95);

        // Новый тренер 13: two students since May and July
        $w->user(13, 'Новый тренер', true);
        foreach ([[31, 'Атлет 31', '2026-05-01', ['1986-09-09', 'm']], [32, 'Атлет 32', '2026-07-01', ['1992-04-04', 'f']]] as $s) {
            $w->user($s[0], $s[1]);
            $w->person[$s[0]] = ['birth' => $s[3][0], 'sex' => $s[3][1]];
            $w->train($s[0], D::add($s[2], -200), $t, ['perWeek' => 4, 'km' => 8, 'long' => 16, 'pace' => 320, 'planFrom' => $s[2], 'reports' => 0.4]);
            $w->stint(13, $s[0], $s[2]);
        }
        $w->race(31, '2026-03-15', 10, 2700, 'MOSCOW');
        $w->race(31, '2026-09-27', 10, 2727, 'MOSCOW', 2700, true);
        $w->answer(13, 420, 0.0);

        // Пустой тренер and Скрытый тренер
        $w->user(14, 'Пустой тренер', true);
        $w->user(15, 'Скрытый тренер', true);
        return $w;
    }

    /** cut everything after $asOf: what the site knew that day */
    public function filter($list, $asOf, $field = 'date')
    {
        if ($asOf === null) {
            return $list;
        }
        $out = [];
        foreach ($list as $x) {
            $d = is_array($x) ? substr((string) $x[$field], 0, 10) : substr((string) $x, 0, 10);
            if ($d <= $asOf) {
                $out[] = $x;
            }
        }
        return $out;
    }
}
