<?php
namespace S10Ach\Engine;

// Every athlete achievement as a metric over the history: the current value, the date each level was first
// reached (replayed in date order) and the optional captions. Pure: no database, no Source.
final class AthleteEngine
{
    // optional data an achievement needs; without it the achievement is not shown (see Features)
    const NEEDS = [
        'early' => ['run_time'], 'night' => ['run_time'], 'midnight' => ['run_time'],
        'everest' => ['elev'], 'hills' => ['elev'], 'everesting' => ['elev'],
        'recovery' => ['hr'], 'km1' => ['splits'], 'even' => ['splits'],
        'sniper' => ['intervals'], 'master' => ['masterPlans'], 'reports' => ['reports'], 'own_week' => ['ownWeeks'],
        'challenges' => ['challenges'], 'podium' => ['challenges'], 'neg_split' => ['challenge_splits'],
        'rank' => ['rating'], 'tour_king' => ['tournament'],
        'posts' => ['posts'], 'likes' => ['likes'], 'comments' => ['comments'], 'invite' => ['referrals'],
        'cities' => ['cities'], 'club' => ['club'], 'bq' => ['person', 'boston'],
        'strength' => ['strength'], 'collector' => ['strength'],
    ];

    // the six World Marathon Majors, as a race location may spell them
    const MAJORS = [
        'tokyo' => ['tokyo', 'токио'], 'boston' => ['boston', 'бостон'], 'london' => ['london', 'лондон'],
        'berlin' => ['berlin', 'берлин'], 'chicago' => ['chicago', 'чикаго'], 'nyc' => ['new york', 'nyc', 'нью-йорк', 'нью йорк'],
    ];

    private $d;
    private $e;
    private $today;
    private $boston;
    private $units;

    /**
     * @param AthleteData $d
     * @param array       $entries catalog entries keyed by id
     * @param array       $units   common.json units
     * @param Boston|null $boston
     * @return array ['items' => [id => ['value', 'dates', 'last', 'note']], 'facts' => […], 'active' => last run date|null]
     */
    public static function compute(AthleteData $d, array $entries, array $units, $boston = null)
    {
        $x = new self();
        $x->d = $d;
        $x->e = $entries;
        $x->today = $d->today;
        $x->boston = $boston;
        $x->units = $units;
        $items = [];
        foreach ($entries as $id => $entry) {
            $m = 'm_' . $id;
            if (method_exists($x, $m)) {
                $items[$id] = $x->$m($entry);
            }
        }
        $last = $d->runs ? $d->runs[count($d->runs) - 1]['date'] : null;
        return ['items' => $items, 'facts' => $x->facts(), 'active' => $last];
    }

    // ---------- helpers ----------

    private function out(array $e, array $series, $value, $last = null, $note = null)
    {
        $dates = Levels::cross($series, $e['thresholds'], isset($e['direction']) ? (int) $e['direction'] : 1);
        return ['value' => $value, 'dates' => $dates, 'last' => $last instanceof \Closure ? ($dates ? $last($dates) : null) : $last, 'note' => $note];
    }

    // one point per date: how many events so far
    private static function counts(array $dates)
    {
        $ev = [];
        foreach ($dates as $d) {
            $ev[] = [$d, 1];
        }
        return Levels::cumulative($ev);
    }

    private function countOut(array $e, array $dates, $last = null)
    {
        return $this->out($e, self::counts($dates), count($dates), $last);
    }

    // «350-я пробежка: 26.01.2025»
    private function nth(array $e, $suffix)
    {
        return function ($dates) use ($e, $suffix) {
            $i = count($dates) - 1;
            return Text::num($e['thresholds'][$i], 0) . $suffix . Text::date($dates[$i]);
        };
    }

    // a one-time thing: the first date it happened, value 1 or 0
    private function once(array $e, $date)
    {
        return ['value' => $date ? 1 : 0, 'dates' => $date ? [$date] : [], 'last' => null, 'note' => null];
    }

    private function unit($u, $n)
    {
        return Text::plural($n, isset($this->units[$u]) ? $this->units[$u] : []);
    }

    private function tracked()
    {
        $out = [];
        foreach ($this->d->runs as $r) {
            if ($r['track']) {
                $out[] = $r;
            }
        }
        return $out;
    }

    // closed weeks of the plan: monday => [planned, done]
    private function planWeeks()
    {
        $w = [];
        foreach ($this->d->plan as $p) {
            $m = D::monday($p['date']);
            if (D::add($m, 6) > $this->today) {
                continue;
            }
            if (!isset($w[$m])) {
                $w[$m] = [0, 0];
            }
            $w[$m][0]++;
            $w[$m][1] += $p['done'] ? 1 : 0;
        }
        ksort($w);
        return $w;
    }

    private function doneDays($type)
    {
        $out = [];
        foreach ($this->d->plan as $p) {
            if ($p['type'] === $type && $p['done']) {
                $out[] = $p['date'];
            }
        }
        return $out;
    }

    // ---------- volume ----------

    private function m_km_total(array $e)
    {
        $ev = [];
        $sum = 0.0;
        foreach ($this->d->runs as $r) {
            $ev[] = [$r['date'], $r['km']];
            $sum += $r['km'];
        }
        return $this->out($e, Levels::cumulative($ev, 0), (int) round($sum), $this->nth($e, '-й километр: '));
    }

    private function m_km_year(array $e)
    {
        $year = [];
        $series = [];
        foreach ($this->d->runs as $r) {
            $y = D::year($r['date']);
            $year[$y] = (isset($year[$y]) ? $year[$y] : 0) + $r['km'];
            $series[] = [$r['date'], round($year[$y])];
        }
        $now = D::year($this->today);
        $note = $this->d->weekPlanKm > 0 ? 'В плане этой недели ' . Text::num($this->d->weekPlanKm, 0) . ' км' : null;
        return $this->out($e, self::collapse($series), (int) round(isset($year[$now]) ? $year[$now] : 0), function ($dates) use ($e) {
            $i = count($dates) - 1;
            return Text::num($e['thresholds'][$i], 0) . ' км за ' . substr($dates[$i], 0, 4) . ' год к ' . Text::date($dates[$i]);
        }, $note);
    }

    // several points on one date: keep the last
    private static function collapse(array $series)
    {
        $out = [];
        foreach ($series as $p) {
            $k = count($out);
            if ($k && $out[$k - 1][0] === $p[0]) {
                $out[$k - 1] = $p;
            } else {
                $out[] = $p;
            }
        }
        return $out;
    }

    // best total over periods: key($date) names the period
    private function bestPeriod(callable $key)
    {
        $sum = [];
        $best = 0;
        $bestKey = null;
        $series = [];
        foreach ($this->d->runs as $r) {
            $k = $key($r['date']);
            if ($k === null) {
                continue;
            }
            $sum[$k] = (isset($sum[$k]) ? $sum[$k] : 0) + $r['km'];
            $v = round($sum[$k]);
            if ($v > $best) {
                $best = $v;
                $bestKey = $k;
            }
            $series[] = [$r['date'], $best];
        }
        return [self::collapse($series), (int) $best, $bestKey];
    }

    private function m_week_big(array $e)
    {
        list($series, $best, $k) = $this->bestPeriod(function ($d) {
            return D::monday($d);
        });
        $last = $k ? $best . ' км за неделю ' . Text::range($k, D::add($k, 6)) : null;
        return $this->out($e, $series, $best, $last);
    }

    private function m_month_big(array $e)
    {
        list($series, $best, $k) = $this->bestPeriod(function ($d) {
            return D::ym($d) . '-01';
        });
        return $this->out($e, $series, $best, $k ? $best . ' км за ' . Text::month($k) : null);
    }

    private function m_weekend(array $e)
    {
        list($series, $best, $k) = $this->bestPeriod(function ($d) {
            $w = D::dow($d);
            return $w === 6 ? $d : ($w === 7 ? D::add($d, -1) : null);
        });
        return $this->out($e, $series, $best, $k ? $best . ' км за выходные ' . Text::range($k, D::add($k, 1)) : null);
    }

    private function m_longest(array $e)
    {
        // a run typed in by hand is no record; a race result proves its distance
        $ev = [];
        $info = [];
        foreach ($this->d->runs as $r) {
            if ($r['track']) {
                $v = round($r['km'], 1);
                $ev[] = [$r['date'], $v];
                $info[] = [$r['date'], $v, false, Text::num($v) . ' км, ' . Text::date($r['date'])];
            }
        }
        foreach ($this->d->races as $r) {
            if ($r['sec'] !== null) {
                $v = round($r['km'], 1);
                $ev[] = [$r['date'], $v];
                $name = $r['dist'] === '42' ? 'Марафон' : ($r['dist'] === '21' ? 'Полумарафон' : Text::num($v) . ' км');
                $info[] = [$r['date'], $v, true, $name . ($r['loc'] ? ', ' . $r['loc'] : '') . ', ' . Text::time($r['sec']) . ', ' . Text::date($r['date'])];
            }
        }
        $series = Levels::best($ev, 1);
        $best = $series ? $series[count($series) - 1][1] : 0;
        // the caption: the first effort at the best distance, a race before a plain run of that day
        $pick = null;
        foreach ($info as $i) {
            if ($i[1] != $best) {
                continue;
            }
            if ($pick === null || $i[0] < $pick[0] || ($i[0] === $pick[0] && $i[2] && !$pick[2])) {
                $pick = $i;
            }
        }
        return $this->out($e, $series, $best, $pick ? $pick[3] : null);
    }

    private function m_hours(array $e)
    {
        $ev = [];
        $sum = 0;
        foreach ($this->d->runs as $r) {
            $ev[] = [$r['date'], $r['sec'] / 3600];
            $sum += $r['sec'];
        }
        return $this->out($e, Levels::cumulative($ev, 0), (int) round($sum / 3600), $this->nth($e, '-й час в беге: '));
    }

    private function m_runs(array $e)
    {
        $dates = [];
        foreach ($this->d->runs as $r) {
            $dates[] = $r['date'];
        }
        return $this->countOut($e, $dates, $this->nth($e, '-я пробежка: '));
    }

    // ---------- regularity ----------

    // weeks in a row with at least $min runs; returns [series, current streak, starts by date]
    private function weekStreak(array $runs, $min)
    {
        $wk = [];
        foreach ($runs as $r) {
            $wk[D::monday($r['date'])][] = $r['date'];
        }
        if (!$wk) {
            return [[], 0, []];
        }
        ksort($wk);
        $first = array_keys($wk)[0];
        $cur = D::monday($this->today);
        $streak = 0;
        $start = null;
        $series = [];
        $starts = [];
        for ($w = $first; $w <= $cur; $w = D::add($w, 7)) {
            $n = isset($wk[$w]) ? count($wk[$w]) : 0;
            if ($n >= $min) {
                if ($streak === 0) {
                    $start = $w;
                }
                $streak++;
                $date = $wk[$w][$min - 1];
                $series[] = [$date, $streak];
                $starts[$date] = $start;
            } elseif ($w !== $cur) {
                $streak = 0;
            }
        }
        return [$series, $streak, $starts];
    }

    private function m_weeks_streak(array $e)
    {
        list($series, $now, $starts) = $this->weekStreak($this->d->runs, 3);
        return $this->out($e, $series, $now, function ($dates) use ($e, $starts) {
            $i = count($dates) - 1;
            $th = $e['thresholds'][$i];
            return $th . ' ' . $this->unit('wk', $th) . ' подряд по 3+ тренировки, ' . Text::range($starts[$dates[$i]], $dates[$i]);
        });
    }

    private function m_days_streak(array $e)
    {
        $days = array_keys($this->d->byDay);
        sort($days);
        $series = [];
        $starts = [];
        $streak = 0;
        $prev = null;
        $start = null;
        foreach ($days as $d) {
            if ($prev !== null && D::diff($prev, $d) === 1) {
                $streak++;
            } else {
                $streak = 1;
                $start = $d;
            }
            $series[] = [$d, $streak];
            $starts[$d] = $start;
            $prev = $d;
        }
        $now = ($prev !== null && D::diff($prev, $this->today) <= 1) ? $streak : 0;
        return $this->out($e, $series, $now, function ($dates) use ($e, $starts) {
            $i = count($dates) - 1;
            $th = $e['thresholds'][$i];
            return $th . ' ' . $this->unit('day', $th) . ' подряд, ' . Text::range($starts[$dates[$i]], $dates[$i]);
        });
    }

    private function m_early(array $e)
    {
        $dates = [];
        foreach ($this->d->runs as $r) {
            if ($r['min'] !== null && $r['min'] < 7 * 60) {
                $dates[] = $r['date'];
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_night(array $e)
    {
        $dates = [];
        foreach ($this->d->runs as $r) {
            if ($r['min'] !== null && $r['min'] >= 21 * 60) {
                $dates[] = $r['date'];
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_year_round(array $e)
    {
        $months = [];
        $series = [];
        foreach ($this->d->runs as $r) {
            $y = D::year($r['date']);
            $months[$y][substr($r['date'], 5, 2)] = true;
            $series[] = [$r['date'], count($months[$y])];
        }
        $now = D::year($this->today);
        return $this->out($e, self::collapse($series), isset($months[$now]) ? count($months[$now]) : 0, function ($dates) {
            return substr($dates[0], 0, 4) . ' год: все 12 месяцев';
        });
    }

    private function m_two_a_day(array $e)
    {
        $dates = [];
        foreach ($this->d->byDay as $d => $x) {
            if ($x['n'] >= 2) {
                $dates[] = $d;
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_jan1(array $e)
    {
        $dates = [];
        foreach ($this->d->byDay as $d => $x) {
            if (substr($d, 5) === '01-01') {
                $dates[] = $d;
            }
        }
        sort($dates);
        return $this->countOut($e, $dates, function ($lv) {
            return '1 января ' . substr($lv[0], 0, 4) . ', ' . Text::num($this->d->byDay[$lv[0]]['km'], 0) . ' км';
        });
    }

    // ---------- plan ----------

    private function m_week_plan(array $e)
    {
        $dates = [];
        foreach ($this->planWeeks() as $m => $w) {
            if ($w[0] > 0 && $w[1] === $w[0]) {
                $dates[] = D::add($m, 6);
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_month_plan(array $e)
    {
        $mon = [];
        foreach ($this->d->plan as $p) {
            $end = D::monthEnd($p['date']);
            if ($end > $this->today) {
                continue;
            }
            if (!isset($mon[$end])) {
                $mon[$end] = [0, 0];
            }
            $mon[$end][0]++;
            $mon[$end][1] += $p['done'] ? 1 : 0;
        }
        ksort($mon);
        $dates = [];
        foreach ($mon as $end => $m) {
            if ($m[0] >= 4 && $m[1] >= 0.9 * $m[0] - 1e-9) {
                $dates[] = $end;
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_sniper(array $e)
    {
        $dates = [];
        foreach ($this->d->intervals ?: [] as $s) {
            $laps = is_array($s['laps']) ? $s['laps'] : [];
            $plan = (float) $s['plan_pace'];
            if (!$laps || $plan <= 0) {
                continue;
            }
            $ok = true;
            foreach ($laps as $l) {
                if (abs((float) $l - $plan) > 3) {
                    $ok = false;
                    break;
                }
            }
            if ($ok) {
                $dates[] = $s['date'];
            }
        }
        return $this->countOut($e, $dates, $this->nth($e, '-я точная интервальная: '));
    }

    private function m_reports(array $e)
    {
        return $this->countOut($e, $this->d->reports ?: []);
    }

    private function m_own_week(array $e)
    {
        return $this->countOut($e, $this->d->ownWeeks ?: [], function ($dates) {
            $m = D::monday($dates[0]);
            return 'Неделя ' . Text::range($m, D::add($m, 6));
        });
    }

    // master plans: weeks done at 80%+, finished or not
    private function masterPlans()
    {
        $weeks = [];
        foreach ($this->d->plan as $p) {
            $m = D::monday($p['date']);
            if (!isset($weeks[$m])) {
                $weeks[$m] = [0, 0];
            }
            $weeks[$m][0]++;
            $weeks[$m][1] += $p['done'] ? 1 : 0;
        }
        $out = [];
        foreach ($this->d->masterPlans ?: [] as $mp) {
            $n = 0;
            $planned = 0;
            $row = 0;
            $broken = false;
            $all = true;
            for ($w = D::monday($mp['from']); $w <= $mp['to']; $w = D::add($w, 7)) {
                $n++;
                $closed = D::add($w, 6) <= $this->today || ($mp['to'] <= $this->today && $w === D::monday($mp['to']));
                if (!$closed) {
                    continue;
                }
                $x = isset($weeks[$w]) ? $weeks[$w] : [0, 0];
                if ($x[0] === 0) {
                    continue; // no plan laid that week
                }
                $planned++;
                $ok = $x[1] >= 0.8 * $x[0] - 1e-9;
                $all = $all && $ok;
                if ($ok && !$broken) {
                    $row++;
                } else {
                    $broken = true;
                }
            }
            $ended = $mp['to'] <= $this->today;
            $out[] = ['from' => $mp['from'], 'to' => $mp['to'], 'weeks' => $n, 'row' => $row, 'ended' => $ended, 'finished' => $ended && $planned > 0 && $all];
        }
        return $out;
    }

    private function m_master(array $e)
    {
        $plans = $this->masterPlans();
        $first = null;
        $value = 0;
        $note = null;
        foreach ($plans as $p) {
            if ($p['finished'] && ($first === null || $p['to'] < $first)) {
                $first = $p['to'];
            }
            if ($p['from'] <= $this->today && !$p['ended']) {
                $value = $p['row'];
                $note = 'Текущий мастер-план: ' . $p['weeks'] . ' ' . $this->unit('wk', $p['weeks']);
            } elseif ($note === null) {
                $value = $p['finished'] ? $p['weeks'] : $p['row'];
            }
        }
        return ['value' => $value, 'dates' => $first ? [$first] : [], 'last' => null, 'note' => $note];
    }

    private function m_goal(array $e)
    {
        $dates = [];
        $last = null;
        foreach ($this->d->races as $r) {
            if ($r['main'] && $r['goal'] !== null && $r['sec'] !== null && $r['sec'] <= $r['goal']) {
                $dates[] = $r['date'];
                if ($last === null) {
                    $last = Text::time($r['sec']) . ' при цели ' . Text::time($r['goal']) . ', ' . Text::date($r['date']);
                }
            }
        }
        $out = $this->countOut($e, $dates);
        $out['last'] = $out['dates'] ? $last : null;
        return $out;
    }

    // ---------- workout types ----------

    private function m_collector(array $e)
    {
        $types = [1, 2, 3, 4, 5, 6, $this->d->strength];
        $month = [];
        $series = [];
        foreach ($this->d->plan as $p) {
            if ($p['done'] && in_array($p['type'], $types, true)) {
                $k = D::ym($p['date']);
                $month[$k][$p['type']] = true;
                $series[] = [$p['date'], count($month[$k])];
            }
        }
        $now = D::ym($this->today);
        $note = Text::ucfirst(Text::month($this->today));
        return $this->out($e, self::collapse($series), isset($month[$now]) ? count($month[$now]) : 0, null, $note);
    }

    private function m_intervals(array $e)
    {
        return $this->countOut($e, $this->doneDays(3), $this->nth($e, '-я интервальная: '));
    }

    private function m_long_runs(array $e)
    {
        $race = [];
        foreach ($this->d->plan as $p) {
            if ($p['type'] === 6) {
                $race[$p['date']] = true;
            }
        }
        foreach ($this->d->races as $r) {
            $race[$r['date']] = true;
        }
        $dates = [];
        foreach ($this->d->runs as $r) {
            if ($r['km'] >= 25 && !isset($race[$r['date']])) {
                $dates[] = $r['date'];
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_recovery(array $e)
    {
        $hr = [];
        foreach ($this->d->runs as $r) {
            if ($r['hr'] !== null) {
                $hr[$r['date']] = (isset($hr[$r['date']]) ? $hr[$r['date']] : true) && $r['hr'];
            }
        }
        $dates = [];
        foreach ($this->doneDays(1) as $d) {
            if (!empty($hr[$d])) {
                $dates[] = $d;
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_strength(array $e)
    {
        return $this->countOut($e, $this->doneDays($this->d->strength));
    }

    // ---------- speed and records ----------

    private function pr(array $e, $dist)
    {
        $ev = [];
        $bestR = null;
        foreach ($this->d->results as $r) {
            if ($r['dist'] === $dist) {
                $ev[] = [$r['date'], $r['sec']];
                if ($bestR === null || $r['sec'] < $bestR['sec']) {
                    $bestR = $r;
                }
            }
        }
        $series = Levels::best($ev, -1);
        $last = $bestR ? Text::time($bestR['sec']) . ($bestR['loc'] ? ', ' . $bestR['loc'] : '') . ', ' . Text::date($bestR['date']) : null;
        $note = isset($this->d->forecast[$dist]) ? 'Прогноз по ПАНО: ' . Text::time($this->d->forecast[$dist]) : null;
        return $this->out($e, $series, $bestR ? $bestR['sec'] : null, $last, $note);
    }

    private function m_pr5(array $e)
    {
        return $this->pr($e, '5');
    }

    private function m_pr10(array $e)
    {
        return $this->pr($e, '10');
    }

    private function m_pr21(array $e)
    {
        return $this->pr($e, '21');
    }

    private function m_pr42(array $e)
    {
        return $this->pr($e, '42');
    }

    // personal best improved (the first result at a distance is not an improvement)
    private function improvements()
    {
        $best = [];
        $dates = [];
        foreach ($this->d->results as $r) {
            $k = $r['dist'];
            if (isset($best[$k]) && $r['sec'] < $best[$k]) {
                $dates[] = $r['date'];
            }
            if (!isset($best[$k]) || $r['sec'] < $best[$k]) {
                $best[$k] = $r['sec'];
            }
        }
        return $dates;
    }

    private function m_new_pr(array $e)
    {
        return $this->countOut($e, $this->improvements());
    }

    private function m_km1(array $e)
    {
        $ev = [];
        $bestDate = null;
        $best = null;
        foreach ($this->tracked() as $r) {
            if ($r['splits']) {
                $v = (int) round(min($r['splits']));
                $ev[] = [$r['date'], $v];
                if ($best === null || $v < $best) {
                    $best = $v;
                    $bestDate = $r['date'];
                }
            }
        }
        return $this->out($e, Levels::best($ev, -1), $best, $best !== null ? Text::time($best) . ', ' . Text::date($bestDate) : null);
    }

    private function m_even(array $e)
    {
        $dates = [];
        foreach ($this->tracked() as $r) {
            if (!$r['splits'] || $r['km'] < 10 || count($r['splits']) < 10 || $r['sec'] <= 0) {
                continue;
            }
            $avg = $r['sec'] / $r['km'];
            $ok = true;
            foreach ($r['splits'] as $s) {
                if (abs($s - $avg) > 5) {
                    $ok = false;
                    break;
                }
            }
            if ($ok) {
                $dates[] = $r['date'];
            }
        }
        return $this->countOut($e, $dates);
    }

    // ---------- races and rating ----------

    private function m_challenges(array $e)
    {
        $dates = [];
        foreach ($this->d->challenges ?: [] as $c) {
            $dates[] = $c['date'];
        }
        return $this->countOut($e, $dates);
    }

    private function m_neg_split(array $e)
    {
        $dates = [];
        foreach ($this->d->challenges ?: [] as $c) {
            if ($c['neg_split'] === true || $c['neg_split'] === 1 || $c['neg_split'] === '1') {
                $dates[] = $c['date'];
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_podium(array $e)
    {
        $dates = [];
        foreach ($this->d->challenges ?: [] as $c) {
            if ($c['place'] !== null && (int) $c['place'] >= 1 && (int) $c['place'] <= 3) {
                $dates[] = $c['date'];
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_rank(array $e)
    {
        $ev = [];
        $best = null;
        foreach ($this->d->rating ?: [] as $r) {
            $p = (int) $r['place'];
            if ($p < 1) {
                continue;
            }
            $ev[] = [$r['date'], $p];
            if ($best === null || $p < $best['p']) {
                $best = ['p' => $p, 'season' => (string) $r['season']];
            }
        }
        $last = $best ? $best['p'] . '-е место' . ($best['season'] !== '' ? ', сезон «' . $best['season'] . '»' : '') : null;
        return $this->out($e, Levels::best($ev, -1), $best ? $best['p'] : null, $last);
    }

    private function m_full_set(array $e)
    {
        $first = [];
        foreach ($this->d->results as $r) {
            if (!isset($first[$r['dist']])) {
                $first[$r['dist']] = $r;
            }
        }
        $list = array_values($first);
        usort($list, function ($a, $b) {
            return strcmp($a['date'], $b['date']) ?: strcmp($a['dist'], $b['dist']);
        });
        $dates = [];
        foreach ($list as $r) {
            $dates[] = $r['date'];
        }
        $out = $this->countOut($e, $dates);
        if ($out['dates'] && count($list) >= 4) {
            $r = $list[3];
            $out['last'] = 'Последней стала ' . Text::distance($r['dist']) . ': ' . ($r['loc'] ? $r['loc'] . ', ' : '') . Text::date($r['date']);
        }
        return $out;
    }

    // ---------- community ----------

    private function m_posts(array $e)
    {
        return $this->countOut($e, $this->d->posts ?: []);
    }

    private function m_likes(array $e)
    {
        return $this->countOut($e, $this->d->likes ?: []);
    }

    private function m_comments(array $e)
    {
        return $this->countOut($e, $this->d->comments ?: []);
    }

    private function m_invite(array $e)
    {
        return $this->countOut($e, $this->d->referrals ?: []);
    }

    private function m_club(array $e)
    {
        if (is_string($this->d->club) && $this->d->club !== '') {
            return ['value' => 1, 'dates' => [$this->d->club], 'last' => null, 'note' => null];
        }
        return ['value' => 0, 'dates' => [], 'last' => null, 'note' => $this->d->club === '' ? 'В профиле клуб не выбран' : null];
    }

    // months in a row with an S10 coach: periods that touch are one run of months
    private function m_coach(array $e)
    {
        $runs = [];
        foreach ($this->d->coaches as $p) {
            $to = ($p['to'] === null || $p['to'] > $this->today) ? $this->today : $p['to'];
            $k = count($runs);
            if ($k && $p['from'] <= D::add($runs[$k - 1]['to'], 3)) {
                $runs[$k - 1]['to'] = max($runs[$k - 1]['to'], $to);
                $runs[$k - 1]['open'] = $runs[$k - 1]['open'] || $p['to'] === null || $p['to'] >= $this->today;
            } else {
                $runs[] = ['from' => $p['from'], 'to' => $to, 'open' => $p['to'] === null || $p['to'] >= $this->today];
            }
        }
        $dates = [];
        foreach ($e['thresholds'] as $i => $th) {
            $best = null;
            foreach ($runs as $r) {
                $d = D::addMonths($r['from'], (int) $th);
                if ($d <= $r['to'] && ($best === null || $d < $best)) {
                    $best = $d;
                }
            }
            if ($best === null) {
                break;
            }
            $dates[] = $best;
        }
        $value = 0;
        $open = false;
        foreach ($runs as $r) {
            if ($r['open']) {
                $value = D::months($r['from'], $this->today);
                $open = true;
            }
        }
        return ['value' => $value, 'dates' => $dates, 'last' => null, 'note' => $open ? null : 'Тренер не выбран'];
    }

    // ---------- geography and elevation ----------

    private function m_cities(array $e)
    {
        $seen = [];
        $dates = [];
        foreach ($this->d->cities ?: [] as $c) {
            $k = strtolower(trim((string) $c['city']));
            if ($k !== '' && !isset($seen[$k])) {
                $seen[$k] = true;
                $dates[] = $c['date'];
            }
        }
        return $this->countOut($e, $dates);
    }

    private function m_everest(array $e)
    {
        $ev = [];
        $sum = 0.0;
        foreach ($this->tracked() as $r) {
            if ($r['elev'] !== null) {
                $ev[] = [$r['date'], $r['elev']];
                $sum += $r['elev'];
            }
        }
        return $this->out($e, Levels::cumulative($ev, 0), (int) round($sum), function ($dates) use ($e) {
            $i = count($dates) - 1;
            return Text::num($e['thresholds'][$i], 0) . ' м набрано к ' . Text::date($dates[$i]);
        });
    }

    private function m_hills(array $e)
    {
        $dates = [];
        foreach ($this->tracked() as $r) {
            if ($r['elev'] !== null && $r['elev'] > 500) {
                $dates[] = $r['date'];
            }
        }
        return $this->countOut($e, $dates);
    }

    // ---------- secrets: tracked runs and results only ----------

    private function m_sub3(array $e)
    {
        foreach ($this->d->results as $r) {
            if ($r['dist'] === '42' && $r['sec'] < 3 * 3600) {
                return $this->once($e, $r['date']);
            }
        }
        return $this->once($e, null);
    }

    private function m_miles100(array $e)
    {
        $first = null;
        foreach ($this->tracked() as $r) {
            if ($r['km'] >= 160.9) {
                $first = $r['date'];
                break;
            }
        }
        foreach ($this->d->races as $r) {
            if ($r['sec'] !== null && $r['km'] >= 160.9 && ($first === null || $r['date'] < $first)) {
                $first = $r['date'];
            }
        }
        return $this->once($e, $first);
    }

    private function m_majors(array $e)
    {
        $got = [];
        foreach ($this->d->races as $r) {
            if ($r['dist'] !== '42' || $r['sec'] === null || !$r['loc']) {
                continue;
            }
            $loc = strtolower($r['loc']);
            foreach (self::MAJORS as $k => $names) {
                foreach ($names as $n) {
                    if (strpos($loc, $n) !== false && !isset($got[$k])) {
                        $got[$k] = $r['date'];
                    }
                }
            }
        }
        $date = count($got) >= 6 ? max($got) : null;
        return ['value' => count($got), 'dates' => $date ? [$date] : [], 'last' => null, 'note' => null];
    }

    private function m_everesting(array $e)
    {
        foreach ($this->tracked() as $r) {
            if ($r['elev'] !== null && $r['elev'] >= 8848) {
                return $this->once($e, $r['date']);
            }
        }
        return $this->once($e, null);
    }

    private function m_streak365(array $e)
    {
        list($series) = $this->weekStreak($this->tracked(), 6);
        foreach ($series as $p) {
            if ($p[1] >= 52) {
                return $this->once($e, $p[0]);
            }
        }
        return $this->once($e, null);
    }

    private function m_tour_king(array $e)
    {
        foreach ($this->d->tournament ?: [] as $t) {
            if ((int) $t['place'] === 1) {
                return $this->once($e, $t['date']);
            }
        }
        return $this->once($e, null);
    }

    private function m_bq(array $e)
    {
        $p = $this->d->person;
        if (!$this->boston || !$p || !$p['birth'] || !$p['sex']) {
            return $this->once($e, null);
        }
        foreach ($this->d->results as $r) {
            if ($r['dist'] === '42') {
                $std = $this->boston->standard($p['sex'], D::years($p['birth'], $r['date']));
                if ($std !== null && $r['sec'] <= $std) {
                    return $this->once($e, $r['date']);
                }
            }
        }
        return $this->once($e, null);
    }

    private function m_midnight(array $e)
    {
        foreach ($this->tracked() as $r) {
            if ($r['min'] !== null && $r['min'] * 60 + $r['sec'] > 86400) {
                return $this->once($e, $r['date']);
            }
        }
        return $this->once($e, null);
    }

    // ---------- what the coach's achievements read ----------

    private function facts()
    {
        $res = [];
        foreach ($this->d->results as $r) {
            $res[] = [$r['date'], $r['dist'], $r['sec'], $r['loc']];
        }
        $tgt = [];
        foreach ($this->d->races as $r) {
            if ($r['main'] && $r['goal'] !== null && $r['sec'] !== null) {
                $tgt[] = [$r['date'], $r['dist'] !== null ? $r['dist'] : (string) round($r['km'], 1), $r['sec'], $r['goal']];
            }
        }
        $wk = [];
        foreach ($this->planWeeks() as $m => $w) {
            if ($w[0] > 0) {
                $wk[] = [$m, $w[0], $w[1]];
            }
        }
        $mp = [];
        foreach ($this->masterPlans() as $p) {
            if ($p['ended']) {
                $mp[] = [$p['from'], $p['to'], $p['finished'] ? 1 : 0];
            }
        }
        $pod = [];
        foreach ($this->d->challenges ?: [] as $c) {
            if ($c['place'] !== null && (int) $c['place'] >= 1 && (int) $c['place'] <= 3) {
                $pod[] = [$c['date'], (int) $c['place']];
            }
        }
        $tour = [];
        foreach ($this->d->tournament ?: [] as $t) {
            if ((int) $t['place'] === 1) {
                $tour[] = $t['date'];
            }
        }
        $person = $this->d->person && $this->d->person['birth'] && $this->d->person['sex'] ? [$this->d->person['birth'], $this->d->person['sex']] : null;
        return ['v' => 1, 'res' => $res, 'tgt' => $tgt, 'wk' => $wk, 'mp' => $mp, 'pod' => $pod, 'tour' => $tour, 'person' => $person];
    }
}
