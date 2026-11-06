<?php
namespace S10Ach\Engine;

// One athlete's history from the Source, cleaned for the engine: duplicates merged, implausible runs left out,
// plan days marked done, efforts at 5/10/21.1/42.2 km collected. Pure: no database.
final class AthleteData
{
    // distance key => exact km
    const DIST = ['5' => 5.0, '10' => 10.0, '21' => 21.0975, '42' => 42.195];
    // a faster pace than this (sec/km) is not believed (world records with a margin): up to km => pace
    const PACE_FLOOR = [[3, 125], [7.5, 145], [15, 150], [30, 158], [1000, 165]];
    const SPLIT_FLOOR = 140;   // a kilometre under 2:20 is not believed
    const RESULT_FLOOR = ['5' => 740, '10' => 1540, '21' => 3380, '42' => 7150];

    public $today;
    public $strength;
    /** runs by date and start: id, src, date, min (start, minutes from midnight | null), km, sec, track, elev, hr, splits */
    public $runs = [];
    /** ids of runs left out as implausible */
    public $dropped = [];
    /** date => ['n' => runs, 'km' => km] */
    public $byDay = [];
    /** planned days up to today: date, type, km, done */
    public $plan = [];
    /** planned km of the current week (future days too), for a note */
    public $weekPlanKm = 0.0;
    /** races up to today: date, dist (key|null), km, sec|null, goal|null, loc|null, main */
    public $races = [];
    /** results at the four distances (races, and watch runs on race days): date, dist, sec, loc|null, race (bool); the best per date and distance */
    public $results = [];
    /** athlete's coach periods: coach, from, to|null */
    public $coaches = [];
    // optional data: null = none on the site
    public $masterPlans;
    public $reports;
    public $ownWeeks;
    public $intervals;
    public $challenges;
    public $rating;
    public $tournament;
    public $posts;
    public $likes;
    public $comments;
    public $referrals;
    public $cities;
    public $club;
    public $person;
    public $forecast;
    /** optional data this athlete's source returned: feature => true */
    public $features = [];

    /**
     * @param array  $raw      the Source's answers, keyed by method name (runs, splits, plan, races, masterPlans, …)
     * @param string $today    YYYY-MM-DD
     * @param int    $strength typtrain of a strength workout
     * @param int    $self     the athlete's id: a coach cannot be his own student
     */
    public static function build(array $raw, $today, $strength = 7, $self = null)
    {
        $d = new self();
        $d->today = $today;
        $d->strength = (int) $strength;
        $d->runs($raw);
        $d->plan(isset($raw['plan']) ? $raw['plan'] : []);
        $d->races(isset($raw['races']) ? $raw['races'] : []);
        $d->results();
        $d->coaches = self::periods(isset($raw['coaches']) ? $raw['coaches'] : [], 'coach_id', $today, $self);
        $d->optional($raw);
        return $d;
    }

    // ---------- runs ----------

    private function runs(array $raw)
    {
        $splits = isset($raw['splits']) ? $raw['splits'] : null;
        if ($splits !== null) {
            $this->features['splits'] = true;
        }
        $list = [];
        $seen = [];
        foreach (isset($raw['runs']) && is_array($raw['runs']) ? $raw['runs'] : [] as $r) {
            $start = isset($r['start']) ? (string) $r['start'] : '';
            $date = substr($start, 0, 10);
            $km = isset($r['km']) ? (float) $r['km'] : 0.0;
            if (!D::valid($date) || $date > D::add($this->today, 1) || $km <= 0) {
                continue;
            }
            $id = isset($r['id']) ? (string) $r['id'] : '';
            $src = strtolower(isset($r['source']) ? (string) $r['source'] : '');
            if ($id !== '') {
                if (isset($seen[$src . '|' . $id])) {
                    continue; // the same track twice
                }
                $seen[$src . '|' . $id] = true;
            }
            $min = null;
            if (preg_match('/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/', $start, $m)) {
                $min = (int) $m[1] * 60 + (int) $m[2];
                $this->features['run_time'] = true;
            }
            $run = [
                'id' => $id,
                'src' => $src,
                'date' => $date,
                'min' => $min,
                'km' => $km,
                'sec' => max(0, (int) (isset($r['sec']) ? $r['sec'] : 0)),
                'track' => !empty($r['track']),
                'elev' => isset($r['elev']) && $r['elev'] !== null ? max(0.0, (float) $r['elev']) : null,
                'hr' => isset($r['hr_easy']) && $r['hr_easy'] !== null ? (bool) $r['hr_easy'] : null,
                'splits' => null,
            ];
            if ($run['elev'] !== null) {
                $this->features['elev'] = true;
            }
            if ($run['hr'] !== null) {
                $this->features['hr'] = true;
            }
            if ($splits !== null && $id !== '' && isset($splits[$id]) && is_array($splits[$id])) {
                $s = array_values(array_map('floatval', $splits[$id]));
                $ok = $s && min($s) >= self::SPLIT_FLOOR;
                $run['splits'] = $ok ? $s : null;
            }
            if (!self::plausible($run['km'], $run['sec'])) {
                $this->dropped[] = $id;
                continue;
            }
            $list[] = $run;
        }
        usort($list, function ($a, $b) {
            $k = strcmp($a['date'], $b['date']);
            if ($k) {
                return $k;
            }
            $am = $a['min'] === null ? -1 : $a['min'];
            $bm = $b['min'] === null ? -1 : $b['min'];
            if ($am !== $bm) {
                return $am - $bm;
            }
            return strcmp($a['src'] . $a['id'], $b['src'] . $b['id']);
        });
        // Strava and Garmin bring the same run twice: merge them, keep the richer record
        $kept = [];
        $byDate = [];
        foreach ($list as $run) {
            $dup = null;
            foreach (isset($byDate[$run['date']]) ? $byDate[$run['date']] : [] as $k) {
                if (self::same($kept[$k], $run)) {
                    $dup = $k;
                    break;
                }
            }
            if ($dup === null) {
                $byDate[$run['date']][] = count($kept);
                $kept[] = $run;
            } else {
                $kept[$dup] = self::richer($kept[$dup], $run);
            }
        }
        $this->runs = $kept;
        foreach ($kept as $run) {
            if (!isset($this->byDay[$run['date']])) {
                $this->byDay[$run['date']] = ['n' => 0, 'km' => 0.0];
            }
            $this->byDay[$run['date']]['n']++;
            $this->byDay[$run['date']]['km'] += $run['km'];
        }
    }

    public static function plausible($km, $sec)
    {
        if ($km > 400) {
            return false;
        }
        if ($sec <= 0 || $km < 1) {
            return true;
        }
        $pace = $sec / $km;
        foreach (self::PACE_FLOOR as $f) {
            if ($km <= $f[0]) {
                return $pace >= $f[1];
            }
        }
        return true;
    }

    // the same run from two sources: same day, distance within 3%, start within 10 minutes (or similar time when no start)
    private static function same(array $a, array $b)
    {
        $tol = max(0.25, 0.03 * max($a['km'], $b['km']));
        if (abs($a['km'] - $b['km']) > $tol) {
            return false;
        }
        if ($a['min'] !== null && $b['min'] !== null) {
            return abs($a['min'] - $b['min']) <= 10;
        }
        if ($a['src'] === $b['src']) {
            return false; // two runs of one source without a start time: do not guess
        }
        if ($a['sec'] === 0 || $b['sec'] === 0) {
            return true;
        }
        return abs($a['sec'] - $b['sec']) <= max(120, 0.05 * max($a['sec'], $b['sec']));
    }

    private static function richer(array $a, array $b)
    {
        $score = function ($r) {
            return ($r['track'] ? 8 : 0) + ($r['splits'] !== null ? 4 : 0) + ($r['elev'] !== null ? 2 : 0) + ($r['hr'] !== null ? 1 : 0);
        };
        $keep = $score($b) > $score($a) ? $b : $a;
        $other = $keep === $a ? $b : $a;
        foreach (['min', 'elev', 'hr', 'splits'] as $f) {
            if ($keep[$f] === null && $other[$f] !== null) {
                $keep[$f] = $other[$f];
            }
        }
        $keep['track'] = $keep['track'] || $other['track'];
        return $keep;
    }

    // ---------- plan ----------

    private function plan(array $raw)
    {
        $mon = D::monday($this->today);
        $sun = D::add($mon, 6);
        $days = [];
        foreach ($raw as $p) {
            $date = isset($p['date']) ? substr((string) $p['date'], 0, 10) : '';
            if (!D::valid($date)) {
                continue;
            }
            $type = (int) (isset($p['type']) ? $p['type'] : 0);
            $km = max(0.0, (float) (isset($p['km']) ? $p['km'] : 0));
            if ($type <= 0 && $km <= 0) {
                continue; // nothing planned
            }
            if ($date >= $mon && $date <= $sun) {
                $this->weekPlanKm += $km;
            }
            if ($date > $this->today) {
                continue;
            }
            $days[] = ['date' => $date, 'type' => $type, 'km' => $km, 'done' => isset($p['done']) && $p['done'] !== null ? (bool) $p['done'] : null];
            if ($type === $this->strength) {
                $this->features['strength'] = true;
            }
        }
        usort($days, function ($a, $b) {
            return strcmp($a['date'], $b['date']) ?: $a['type'] - $b['type'];
        });
        $plannedKm = [];
        foreach ($days as $p) {
            $plannedKm[$p['date']] = (isset($plannedKm[$p['date']]) ? $plannedKm[$p['date']] : 0) + $p['km'];
        }
        foreach ($days as $i => $p) {
            if ($p['done'] !== null) {
                continue;
            }
            $ran = isset($this->byDay[$p['date']]) ? $this->byDay[$p['date']]['km'] : 0.0;
            if ($p['km'] > 0) {
                $days[$i]['done'] = $ran >= 0.8 * $plannedKm[$p['date']] - 1e-9;
            } elseif ($p['type'] === $this->strength) {
                $days[$i]['done'] = false; // a strength day is done only when the site says so
            } else {
                $days[$i]['done'] = $ran > 0;
            }
        }
        $this->plan = $days;
    }

    // ---------- races and results ----------

    public static function distKey($km, $exactRun = false)
    {
        $km = (float) $km;
        foreach (self::DIST as $k => $d) {
            if ($exactRun) {
                if ($km >= $d * 0.998 && $km <= $d * 1.03) {
                    return (string) $k;
                }
            } else {
                $lo = ['5' => 4.95, '10' => 9.9, '21' => 21.0, '42' => 42.0][$k];
                $hi = ['5' => 5.1, '10' => 10.2, '21' => 21.3, '42' => 42.5][$k];
                if ($km >= $lo && $km <= $hi) {
                    return (string) $k;
                }
            }
        }
        return null;
    }

    private function races(array $raw)
    {
        $out = [];
        foreach ($raw as $r) {
            $date = isset($r['date']) ? substr((string) $r['date'], 0, 10) : '';
            if (!D::valid($date) || $date > $this->today) {
                continue;
            }
            $km = (float) (isset($r['km']) ? $r['km'] : 0);
            $dist = self::distKey($km);
            $exact = $dist !== null ? self::DIST[$dist] : $km;
            $sec = isset($r['sec']) && $r['sec'] !== null && (int) $r['sec'] > 0 ? (int) $r['sec'] : null;
            if ($sec !== null && ($exact <= 0 || !self::plausible($exact, $sec) || ($dist !== null && $sec < self::RESULT_FLOOR[$dist]))) {
                $sec = null; // not believed
            }
            $goal = isset($r['goal']) && $r['goal'] !== null && (int) $r['goal'] > 0 ? (int) $r['goal'] : null;
            $loc = isset($r['location']) && trim((string) $r['location']) !== '' ? self::place((string) $r['location']) : null;
            $out[] = ['date' => $date, 'dist' => $dist, 'km' => $exact, 'sec' => $sec, 'goal' => $goal, 'loc' => $loc, 'main' => !empty($r['main'])];
        }
        usort($out, function ($a, $b) {
            return strcmp($a['date'], $b['date']);
        });
        $this->races = $out;
    }

    // «LISBON» → «Lisbon»; other spellings as they are
    public static function place($s)
    {
        $s = trim($s);
        if (preg_match('/^[A-Z0-9 \-\.\']+$/', $s) && preg_match('/[A-Z]{2}/', $s)) {
            return ucwords(strtolower($s), " -");
        }
        return $s;
    }

    private function results()
    {
        $best = [];
        foreach ($this->races as $r) {
            if ($r['sec'] !== null && $r['dist'] !== null) {
                $this->addResult($best, $r['date'], $r['dist'], $r['sec'], $r['loc'], true);
            }
        }
        // a watch run counts as a result only on a race day (a race in the results or in the plan);
        // ordinary training runs of 5.0x km would make every easy run a «record»
        $raceDay = [];
        foreach ($this->races as $r) {
            $raceDay[$r['date']] = true;
        }
        foreach ($this->plan as $p) {
            if ($p['type'] === 6) {
                $raceDay[$p['date']] = true;
            }
        }
        foreach ($this->runs as $run) {
            if (!$run['track'] || $run['sec'] <= 0 || !isset($raceDay[$run['date']])) {
                continue; // a run typed in by hand is no record
            }
            $dist = self::distKey($run['km'], true);
            if ($dist !== null && $run['sec'] >= self::RESULT_FLOOR[$dist]) {
                $this->addResult($best, $run['date'], $dist, $run['sec'], null, false);
            }
        }
        $out = array_values($best);
        usort($out, function ($a, $b) {
            return strcmp($a['date'], $b['date']) ?: strcmp($a['dist'], $b['dist']);
        });
        $this->results = $out;
    }

    private function addResult(array &$best, $date, $dist, $sec, $loc, $race)
    {
        $k = $date . '|' . $dist;
        if (!isset($best[$k]) || $sec < $best[$k]['sec'] || ($sec === $best[$k]['sec'] && $race)) {
            $best[$k] = ['date' => $date, 'dist' => $dist, 'sec' => $sec, 'loc' => $loc, 'race' => $race];
        }
    }

    // ---------- periods with a coach ----------

    /**
     * @param int|null $self the user on the other side: a period with himself is left out (no coaching oneself)
     * @return array [['coach'|'athlete' => id, 'from' => d, 'to' => d|null], …] by start
     */
    public static function periods(array $raw, $key, $today, $self = null)
    {
        $out = [];
        foreach ($raw as $p) {
            if (!isset($p[$key]) || ($self !== null && (int) $p[$key] === (int) $self)) {
                continue;
            }
            $from = isset($p['from']) ? substr((string) $p['from'], 0, 10) : '';
            if (!D::valid($from) || $from > $today) {
                continue;
            }
            $to = isset($p['to']) && $p['to'] !== null && $p['to'] !== '' ? substr((string) $p['to'], 0, 10) : null;
            if ($to !== null && (!D::valid($to) || $to < $from)) {
                continue;
            }
            $out[] = [$key === 'coach_id' ? 'coach' : 'athlete' => (int) $p[$key], 'from' => $from, 'to' => $to];
        }
        usort($out, function ($a, $b) {
            return strcmp($a['from'], $b['from']);
        });
        return $out;
    }

    // ---------- optional data ----------

    private function optional(array $raw)
    {
        $dates = function ($v) {
            $out = [];
            foreach ($v as $d) {
                $d = substr((string) $d, 0, 10);
                if (D::valid($d) && $d <= $this->today) {
                    $out[] = $d;
                }
            }
            sort($out);
            return $out;
        };
        $rows = function ($v, array $fields) {
            $out = [];
            foreach ($v as $r) {
                $d = isset($r['date']) ? substr((string) $r['date'], 0, 10) : '';
                if (!D::valid($d) || $d > $this->today) {
                    continue;
                }
                $row = ['date' => $d];
                foreach ($fields as $f) {
                    $row[$f] = isset($r[$f]) ? $r[$f] : null;
                }
                $out[] = $row;
            }
            usort($out, function ($a, $b) {
                return strcmp($a['date'], $b['date']);
            });
            return $out;
        };
        foreach (['reports', 'ownWeeks', 'posts', 'likes', 'comments', 'referrals'] as $k) {
            if (isset($raw[$k]) && is_array($raw[$k])) {
                $this->$k = $dates($raw[$k]);
                $this->features[$k] = true;
            }
        }
        if (isset($raw['masterPlans']) && is_array($raw['masterPlans'])) {
            $this->masterPlans = [];
            foreach ($raw['masterPlans'] as $p) {
                $from = isset($p['from']) ? substr((string) $p['from'], 0, 10) : '';
                $to = isset($p['to']) ? substr((string) $p['to'], 0, 10) : '';
                if (D::valid($from) && D::valid($to) && $to >= $from && $from <= $this->today) {
                    $this->masterPlans[] = ['from' => $from, 'to' => $to];
                }
            }
            usort($this->masterPlans, function ($a, $b) {
                return strcmp($a['from'], $b['from']);
            });
            $this->features['masterPlans'] = true;
        }
        if (isset($raw['intervals']) && is_array($raw['intervals'])) {
            $this->intervals = $rows($raw['intervals'], ['plan_pace', 'laps']);
            $this->features['intervals'] = true;
        }
        if (isset($raw['challenges']) && is_array($raw['challenges'])) {
            $this->challenges = $rows($raw['challenges'], ['name', 'place', 'neg_split']);
            $this->features['challenges'] = true;
            foreach ($this->challenges as $c) {
                if ($c['neg_split'] !== null) {
                    $this->features['challenge_splits'] = true;
                }
            }
        }
        if (isset($raw['rating']) && is_array($raw['rating'])) {
            $this->rating = $rows($raw['rating'], ['season', 'place']);
            $this->features['rating'] = true;
        }
        if (isset($raw['tournament']) && is_array($raw['tournament'])) {
            $this->tournament = $rows($raw['tournament'], ['season', 'place']);
            $this->features['tournament'] = true;
        }
        if (isset($raw['cities']) && is_array($raw['cities'])) {
            $this->cities = $rows($raw['cities'], ['city']);
            $this->features['cities'] = true;
        }
        if (array_key_exists('clubSince', $raw) && $raw['clubSince'] !== null) {
            $c = substr((string) $raw['clubSince'], 0, 10);
            $this->club = D::valid($c) ? min($c, $this->today) : '';
            $this->features['club'] = true;
        }
        if (isset($raw['person']) && is_array($raw['person'])) {
            $b = isset($raw['person']['birth']) ? substr((string) $raw['person']['birth'], 0, 10) : '';
            $s = isset($raw['person']['sex']) ? strtolower((string) $raw['person']['sex']) : '';
            $this->person = ['birth' => D::valid($b) ? $b : null, 'sex' => in_array($s, ['m', 'f'], true) ? $s : null];
            $this->features['person'] = true;
        }
        if (isset($raw['forecast']) && is_array($raw['forecast'])) {
            $this->forecast = [];
            foreach ($raw['forecast'] as $k => $sec) {
                $key = self::distKey((float) $k);
                if ($key !== null && (int) $sec > 0) {
                    $this->forecast[$key] = (int) $sec;
                }
            }
        }
    }
}
