<?php
namespace S10Ach\Engine;

use S10Ach\Catalog;

// Coach achievements. Rules (TZ «Правила честного расчёта»):
//  - every figure is for all the time on S10, raw, no corrections;
//  - level i counts only with enough data: n ≥ base[data_unit] × step[i] (common.json coach_gates);
//  - a student's result counts for the coach only after 8 weeks with him (results: records, races, plans, secrets);
//  - «Удержание»: student-months n, renewals x, value n / (n − x); nobody left = infinite;
//  - «Саб 3» and the other secrets: each student once, kept after he leaves.
// Input: the coach's periods with students and each student's facts (AthleteEngine::facts). Pure.
final class CoachEngine
{
    const NEEDS = [
        'reply' => ['replies'], 'finish' => ['masterPlans'], 'grade' => ['person', 'age_table'],
        'bq' => ['person', 'boston'], 'podium' => ['challenges'], 'tour' => ['tournament'],
    ];
    const WAIT_DAYS = 56;       // 8 weeks
    const UNANSWERED = 10080;   // a report left without an answer for 72 h counts as a week
    const MONTH_DAYS = 30.4375;

    private $today;
    private $stints = [];
    private $facts = [];
    private $names = [];
    private $win = [];
    private $current = [];
    private $replies;
    private $ageGrade;
    private $boston;

    /**
     * @param array $in ['today' => d, 'stints' => [['athlete_id', 'from', 'to'], …], 'facts' => [aid => facts],
     *                   'names' => [aid => name], 'replies' => null|[['report_at', 'reply_at'], …]]
     * @return array [id => ['value', 'dates', 'data', 'infinite', 'last', 'who', 'tail', 'holders']]
     */
    public static function compute(array $in, array $entries, Catalog $cat, $ageGrade = null, $boston = null)
    {
        $x = new self();
        $x->today = $in['today'];
        $x->facts = isset($in['facts']) ? $in['facts'] : [];
        $x->names = isset($in['names']) ? $in['names'] : [];
        $x->replies = isset($in['replies']) ? $in['replies'] : null;
        $x->ageGrade = $ageGrade;
        $x->boston = $boston;
        foreach (AthleteData::periods(isset($in['stints']) ? $in['stints'] : [], 'athlete_id', $x->today) as $s) {
            $s['end'] = ($s['to'] === null || $s['to'] > $x->today) ? $x->today : $s['to'];
            $s['current'] = $s['to'] === null || $s['to'] >= $x->today;
            $x->stints[] = $s;
            $from = D::add($s['from'], self::WAIT_DAYS);
            if ($from <= $s['end']) {
                $x->win[$s['athlete']][] = [$from, $s['end']];
            }
            if ($s['current']) {
                $x->current[$s['athlete']] = true;
            }
        }
        $out = [];
        foreach ($entries as $id => $e) {
            $m = 'm_' . $id;
            if (!method_exists($x, $m)) {
                continue;
            }
            $r = $x->$m($e);
            if (!isset($r['dates'])) {
                $r['dates'] = Levels::cross($r['series'], $e['thresholds'], isset($e['direction']) ? (int) $e['direction'] : 1, $cat->gateFor($e));
            }
            unset($r['series']);
            $out[$id] = $r + ['data' => null, 'infinite' => false, 'last' => null, 'who' => null, 'tail' => null, 'holders' => null];
        }
        return $out;
    }

    // ---------- helpers ----------

    private function athletes()
    {
        $out = [];
        foreach ($this->stints as $s) {
            $out[$s['athlete']] = true;
        }
        return array_keys($out);
    }

    // the date counts for the coach: inside a period with him, 8 weeks after its start
    private function in($aid, $date)
    {
        foreach (isset($this->win[$aid]) ? $this->win[$aid] : [] as $w) {
            if ($date >= $w[0] && $date <= $w[1]) {
                return true;
            }
        }
        return false;
    }

    private function name($aid)
    {
        return isset($this->names[$aid]) ? $this->names[$aid] : 'Ученик S10';
    }

    private function fact($aid, $k)
    {
        return isset($this->facts[$aid][$k]) && is_array($this->facts[$aid][$k]) ? $this->facts[$aid][$k] : [];
    }

    // [[date, hit], …] → series of shares in percent, n, x
    private static function share(array $ev)
    {
        usort($ev, function ($a, $b) {
            return strcmp($a[0], $b[0]);
        });
        $n = 0;
        $x = 0;
        $series = [];
        foreach ($ev as $e) {
            $n += isset($e[2]) ? $e[2] : 1;
            $x += $e[1] ? 1 : 0;
            $p = [$e[0], $n ? round($x / $n * 100, 1) : null, $n];
            $k = count($series);
            if ($k && $series[$k - 1][0] === $e[0]) {
                $series[$k - 1] = $p;
            } else {
                $series[] = $p;
            }
        }
        return [$series, $n, $x];
    }

    private function shareOut(array $ev)
    {
        list($series, $n, $x) = self::share($ev);
        return [
            'series' => $series,
            'value' => $n ? round($x / $n * 100, 1) : null,
            'data' => $n ? ['n' => $n, 'x' => $x] : ['n' => 0],
        ];
    }

    private static function minutes($dt)
    {
        $dt = (string) $dt;
        if (!D::valid(substr($dt, 0, 10))) {
            return null;
        }
        $h = 0;
        $m = 0;
        if (preg_match('/[ T](\d{2}):(\d{2})/', $dt, $x)) {
            $h = (int) $x[1];
            $m = (int) $x[2];
        }
        return D::num(substr($dt, 0, 10)) * 1440 + $h * 60 + $m;
    }

    // ---------- care ----------

    // «На связи»: the median time to answer a report, minutes
    private function m_reply(array $e)
    {
        if ($this->replies === null) {
            return ['series' => [], 'value' => null, 'data' => ['n' => 0]];
        }
        $end = (D::num($this->today) + 1) * 1440;
        $items = [];
        foreach ($this->replies as $r) {
            $rep = self::minutes(isset($r['report_at']) ? $r['report_at'] : '');
            if ($rep === null) {
                continue;
            }
            $rp = isset($r['reply_at']) && $r['reply_at'] ? self::minutes($r['reply_at']) : null;
            if ($rp !== null && $rp >= $rep) {
                $items[] = [D::str(intdiv($rp, 1440)), $rp - $rep];
            } elseif ($rep + 72 * 60 <= $end) {
                $items[] = [D::str(intdiv($rep + 72 * 60, 1440)), self::UNANSWERED];
            }
        }
        usort($items, function ($a, $b) {
            return strcmp($a[0], $b[0]);
        });
        $sorted = [];
        $series = [];
        $med = null;
        foreach ($items as $it) {
            // insert keeping the list sorted
            $lo = 0;
            $hi = count($sorted);
            while ($lo < $hi) {
                $mid = ($lo + $hi) >> 1;
                if ($sorted[$mid] < $it[1]) {
                    $lo = $mid + 1;
                } else {
                    $hi = $mid;
                }
            }
            array_splice($sorted, $lo, 0, [$it[1]]);
            $n = count($sorted);
            $med = $n % 2 ? $sorted[($n - 1) >> 1] : ($sorted[$n / 2 - 1] + $sorted[$n / 2]) / 2;
            $p = [$it[0], (int) round($med), $n];
            $k = count($series);
            if ($k && $series[$k - 1][0] === $it[0]) {
                $series[$k - 1] = $p;
            } else {
                $series[] = $p;
            }
        }
        $n = count($sorted);
        $v = $n ? (int) round($med) : null;
        return ['series' => $series, 'value' => $v, 'data' => $n ? ['n' => $n, 'v' => $v] : ['n' => 0]];
    }

    // ---------- keeping students ----------

    // «Удержание»: every month a student stays is a renewal; leaving ends it. A newcomer adds months, never a leave.
    private function m_tenure(array $e)
    {
        $ev = [];
        foreach ($this->stints as $s) {
            $ended = $s['to'] !== null && $s['to'] < $this->today;
            $limit = $ended ? $s['to'] : $this->today;
            $c = 0;
            for ($k = 1;; $k++) {
                $d = D::addMonths($s['from'], $k);
                if ($d > $limit) {
                    break;
                }
                $ev[] = [$d, 1, 1];
                $c++;
            }
            if ($ended) {
                // months paid: a month begun is a month renewed (a few days over the date do not count)
                $rest = D::diff(D::addMonths($s['from'], $c), $s['to']);
                $months = max(1, $c + ($rest > 3 ? 1 : 0));
                $ev[] = [$s['to'], $months - $c, $months - 1 - $c];
            }
        }
        usort($ev, function ($a, $b) {
            return strcmp($a[0], $b[0]);
        });
        $n = 0;
        $x = 0;
        $series = [];
        foreach ($ev as $p) {
            $n += $p[1];
            $x += $p[2];
            $v = $n > 0 ? ($n === $x ? INF : round($n / ($n - $x), 1)) : null;
            $k = count($series);
            if ($k && $series[$k - 1][0] === $p[0]) {
                $series[$k - 1] = [$p[0], $v, $n];
            } else {
                $series[] = [$p[0], $v, $n];
            }
        }
        $inf = $n > 0 && $n === $x;
        return [
            'series' => $series,
            'value' => $n > 0 && !$inf ? round($n / ($n - $x), 1) : null,
            'infinite' => $inf,
            'data' => $n ? ['n' => $n, 'x' => $x] : ['n' => 0],
        ];
    }

    // «Вместе долго»: the longest period of one student, months
    private function m_longest(array $e)
    {
        if (!$this->stints) {
            return ['dates' => [], 'value' => null];
        }
        $dates = [];
        foreach ($e['thresholds'] as $th) {
            $best = null;
            foreach ($this->stints as $s) {
                $d = D::addMonths($s['from'], (int) $th);
                if ($d <= $s['end'] && ($best === null || $d < $best)) {
                    $best = $d;
                }
            }
            if ($best === null) {
                break;
            }
            $dates[] = $best;
        }
        $top = null;
        $topM = -1;
        foreach ($this->stints as $s) {
            $m = D::months($s['from'], $s['end']);
            if ($m > $topM || ($m === $topM && $s['current'] && !$top['current'])) {
                $top = $s;
                $topM = $m;
            }
        }
        $tail = ', с ' . Text::monthGen($top['from']) . ($top['current'] ? '' : ' по ' . Text::month($top['to']));
        return [
            'dates' => $dates,
            'value' => $topM,
            'last' => $this->name($top['athlete']) . $tail,
            'who' => $top['athlete'],
            'tail' => $tail,
        ];
    }

    // «Стаж»: months with at least one student
    private function m_exp(array $e)
    {
        if (!$this->stints) {
            return ['dates' => [], 'value' => null];
        }
        $parts = [];
        $list = $this->stints;
        usort($list, function ($a, $b) {
            return strcmp($a['from'], $b['from']);
        });
        foreach ($list as $s) {
            $k = count($parts);
            if ($k && $s['from'] <= D::add($parts[$k - 1][1], 1)) {
                $parts[$k - 1][1] = max($parts[$k - 1][1], $s['end']);
            } else {
                $parts[] = [$s['from'], $s['end']];
            }
        }
        $total = 0;
        foreach ($parts as $p) {
            $total += D::diff($p[0], $p[1]);
        }
        $dates = [];
        foreach ($e['thresholds'] as $th) {
            $need = (int) ceil($th * self::MONTH_DAYS);
            $cum = 0;
            $date = null;
            foreach ($parts as $p) {
                $len = D::diff($p[0], $p[1]);
                if ($cum + $len >= $need) {
                    $date = D::add($p[0], $need - $cum);
                    break;
                }
                $cum += $len;
            }
            if ($date === null) {
                break;
            }
            $dates[] = $date;
        }
        return ['dates' => $dates, 'value' => (int) floor($total / self::MONTH_DAYS)];
    }

    // ---------- method ----------

    // «Исполнение»: the mean share of planned workouts done, over every student-week with a plan
    private function m_exec(array $e)
    {
        $ev = [];
        $seen = [];
        foreach ($this->stints as $s) {
            foreach ($this->fact($s['athlete'], 'wk') as $w) {
                $sun = D::add($w[0], 6);
                $k = $s['athlete'] . '|' . $w[0];
                if ($w[1] > 0 && $w[0] >= $s['from'] && $sun <= $s['end'] && !isset($seen[$k])) {
                    $seen[$k] = true;
                    $ev[] = [$sun, min(1, $w[2] / $w[1])];
                }
            }
        }
        usort($ev, function ($a, $b) {
            return strcmp($a[0], $b[0]);
        });
        $sum = 0.0;
        $n = 0;
        $series = [];
        foreach ($ev as $p) {
            $sum += $p[1];
            $n++;
            $q = [$p[0], round($sum / $n * 100, 1), $n];
            $k = count($series);
            if ($k && $series[$k - 1][0] === $p[0]) {
                $series[$k - 1] = $q;
            } else {
                $series[] = $q;
            }
        }
        $v = $n ? round($sum / $n * 100, 1) : null;
        return ['series' => $series, 'value' => $v, 'data' => $n ? ['n' => $n, 'v' => $v] : ['n' => 0]];
    }

    // «До конца»: master plans that reached the race with every week at 80%+
    private function m_finish(array $e)
    {
        $ev = [];
        foreach ($this->athletes() as $aid) {
            foreach ($this->fact($aid, 'mp') as $p) {
                if ($this->in($aid, $p[1])) {
                    $ev[] = [$p[1], (bool) $p[2]];
                }
            }
        }
        return $this->shareOut($ev);
    }

    // target races with a goal and a result, in the coach's time
    private function targets()
    {
        $out = [];
        foreach ($this->athletes() as $aid) {
            foreach ($this->fact($aid, 'tgt') as $t) {
                if ($this->in($aid, $t[0]) && $t[3] > 0) {
                    $out[] = ['a' => $aid, 'date' => $t[0], 'dist' => (string) $t[1], 'sec' => (int) $t[2], 'goal' => (int) $t[3]];
                }
            }
        }
        return $out;
    }

    private function m_goal(array $e)
    {
        $ev = [];
        foreach ($this->targets() as $t) {
            $ev[] = [$t['date'], $t['sec'] <= $t['goal']];
        }
        return $this->shareOut($ev);
    }

    // «Точная цель»: the result within 2% of the goal either way
    private function m_precise(array $e)
    {
        $ev = [];
        $last = null;
        foreach ($this->targets() as $t) {
            $hit = abs($t['sec'] - $t['goal']) <= 0.02 * $t['goal'];
            $ev[] = [$t['date'], $hit];
            if ($hit && ($last === null || $t['date'] >= $last['date'])) {
                $last = $t;
            }
        }
        $out = $this->shareOut($ev);
        if ($last) {
            $out['tail'] = ', ' . Text::distanceWord($last['dist']) . ': цель ' . Text::time($last['goal']) . ', результат ' . Text::time($last['sec']);
            $out['who'] = $last['a'];
            $out['last'] = $this->name($last['a']) . $out['tail'];
        }
        return $out;
    }

    // ---------- results ----------

    private function strong($aid, $dist, $sec, $date)
    {
        $p = isset($this->facts[$aid]['person']) ? $this->facts[$aid]['person'] : null;
        if (!$this->ageGrade || !$p) {
            return false;
        }
        $pct = $this->ageGrade->pct($dist, $sec, D::years($p[0], $date), $p[1]);
        return $pct !== null && $pct >= 80;
    }

    // the first personal best in the coach's time; a strong runner (80%+ age grade) also by a result within 1% of it
    private function firstPb($aid)
    {
        $best = [];
        foreach ($this->fact($aid, 'res') as $r) {
            list($date, $dist, $sec) = $r;
            if (isset($best[$dist])) {
                $b = $best[$dist];
                $pb = $sec < $b[0] || ($sec <= $b[0] * 1.01 && $this->strong($aid, $dist, $b[0], $b[1]));
                if ($pb && $this->in($aid, $date)) {
                    return $date;
                }
            }
            if (!isset($best[$dist]) || $sec < $best[$dist][0]) {
                $best[$dist] = [$sec, $date];
            }
        }
        return null;
    }

    // «Прогресс команды»: the share of students who improved a personal best while with the coach
    private function m_pb(array $e)
    {
        $ev = [];
        foreach ($this->athletes() as $aid) {
            $from = null;
            foreach (isset($this->win[$aid]) ? $this->win[$aid] : [] as $w) {
                if ($from === null || $w[0] < $from) {
                    $from = $w[0];
                }
            }
            if ($from === null) {
                continue; // never 8 weeks with the coach
            }
            $ev[] = [$from, false, 1];
            $pb = $this->firstPb($aid);
            if ($pb !== null) {
                $ev[] = [$pb, true, 0];
            }
        }
        return $this->shareOut($ev);
    }

    // «Уровень учеников»: the best age-graded result
    private function m_grade(array $e)
    {
        if (!$this->ageGrade) {
            return ['dates' => [], 'value' => null];
        }
        $ev = [];
        $top = null;
        foreach ($this->athletes() as $aid) {
            $p = isset($this->facts[$aid]['person']) ? $this->facts[$aid]['person'] : null;
            if (!$p) {
                continue;
            }
            foreach ($this->fact($aid, 'res') as $r) {
                if (!$this->in($aid, $r[0])) {
                    continue;
                }
                $age = D::years($p[0], $r[0]);
                $pct = $this->ageGrade->pct($r[1], $r[2], $age, $p[1]);
                if ($pct === null) {
                    continue;
                }
                $ev[] = [$r[0], $pct];
                if ($top === null || $pct > $top['pct'] || ($pct == $top['pct'] && $r[0] < $top['date'])) {
                    $top = ['pct' => $pct, 'a' => $aid, 'date' => $r[0], 'dist' => $r[1], 'sec' => $r[2], 'age' => $age];
                }
            }
        }
        $out = ['series' => Levels::best($ev, 1), 'value' => $top ? $top['pct'] : null];
        if ($top) {
            $out['tail'] = ', ' . Text::distanceWord($top['dist']) . ' ' . Text::time($top['sec']) . ' в ' . $top['age'] . ' ' . Text::plural($top['age'], ['год', 'года', 'лет']);
            $out['who'] = $top['a'];
            $out['last'] = $this->name($top['a']) . $out['tail'];
        }
        return $out;
    }

    // ---------- secrets: every student once, for good ----------

    private function holders($key, callable $pick, callable $caption)
    {
        $list = [];
        foreach ($this->athletes() as $aid) {
            foreach ($this->fact($aid, $key) as $f) {
                $date = is_array($f) ? $f[0] : $f;
                if ($this->in($aid, $date) && $pick($aid, $f)) {
                    $h = ['athlete' => $aid, 'name' => $this->name($aid), 'time' => $caption($f), 'date' => $date];
                    if (empty($this->current[$aid])) {
                        $h['left'] = true;
                    }
                    $list[] = $h;
                    break;
                }
            }
        }
        usort($list, function ($a, $b) {
            return strcmp($a['date'], $b['date']) ?: $a['athlete'] - $b['athlete'];
        });
        $series = [];
        foreach ($list as $i => $h) {
            $series[] = [$h['date'], $i + 1];
        }
        $out = ['series' => $series, 'value' => $list ? 1 : 0, 'holders' => $list];
        if ($list) {
            $h = $list[count($list) - 1];
            $out['tail'] = ($h['time'] !== '' ? ', ' . $h['time'] : '') . ', ' . Text::date($h['date']);
            $out['who'] = $h['athlete'];
            $out['last'] = $h['name'] . $out['tail'];
        }
        return $out;
    }

    private function m_sub3(array $e)
    {
        return $this->holders('res', function ($aid, $r) {
            return $r[1] === '42' && $r[2] < 3 * 3600;
        }, function ($r) {
            return Text::time($r[2]);
        });
    }

    private function m_bq(array $e)
    {
        return $this->holders('res', function ($aid, $r) {
            $p = isset($this->facts[$aid]['person']) ? $this->facts[$aid]['person'] : null;
            if (!$this->boston || !$p || $r[1] !== '42') {
                return false;
            }
            $std = $this->boston->standard($p[1], D::years($p[0], $r[0]));
            return $std !== null && $r[2] <= $std;
        }, function ($r) {
            return Text::time($r[2]);
        });
    }

    private function m_podium(array $e)
    {
        return $this->holders('pod', function ($aid, $p) {
            return true;
        }, function ($p) {
            return $p[1] . '-е место';
        });
    }

    private function m_tour(array $e)
    {
        return $this->holders('tour', function ($aid, $d) {
            return true;
        }, function ($d) {
            return '';
        });
    }
}
