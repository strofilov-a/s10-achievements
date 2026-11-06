<?php
namespace S10Ach;

use S10Ach\Engine\AthleteData;
use S10Ach\Engine\AthleteEngine;
use S10Ach\Engine\CoachEngine;
use S10Ach\Engine\D;
use S10Ach\Engine\Levels;
use S10Ach\Engine\Near;
use S10Ach\Engine\Text;

// A recount of one user: read the Source, run the engine, keep the stored levels and append the new ones,
// write events, ranks and notifications. Running it twice changes nothing.
//
// Modes:
//   'normal'  — new levels are events to celebrate, with notifications;
//   'history' — the first launch over the whole history: events are created already celebrated, no notifications;
//   'auto'    — 'normal', except a user's very first recount: then only levels of the last 7 days are celebrated.
final class Recalc
{
    const FRESH_DAYS = 7;

    private $app;

    public function __construct(App $app)
    {
        $this->app = $app;
    }

    private function mode($mode, $score)
    {
        if ($mode === 'auto') {
            return $score ? 'normal' : 'first';
        }
        return $mode === 'history' ? 'history' : 'normal';
    }

    private function celebrated($mode, $date)
    {
        if ($mode === 'history') {
            return true;
        }
        if ($mode === 'first') {
            return $date < D::add($this->app->today(), -self::FRESH_DAYS);
        }
        return false;
    }

    /** what the Source says about one athlete */
    public static function loadAthlete(Source $src, $uid)
    {
        $raw = [];
        foreach (['runs', 'splits', 'plan', 'races', 'masterPlans', 'reports', 'ownWeeks', 'intervals', 'challenges', 'rating',
            'tournament', 'posts', 'likes', 'comments', 'referrals', 'cities', 'clubSince', 'person', 'forecast', 'coaches'] as $m) {
            $raw[$m] = $src->$m($uid);
        }
        return $raw;
    }

    // ---------- athlete ----------

    public function athlete($uid, $mode = 'auto')
    {
        $uid = (int) $uid;
        $app = $this->app;
        $store = $app->store();
        $cat = $app->catalog();
        $today = $app->today();

        $data = AthleteData::build(self::loadAthlete($app->source(), $uid), $today, $app->config['strength_type'], $uid);
        $app->features()->seen($data->features);
        $res = AthleteEngine::compute($data, $cat->entries('a'), $cat->units(), $app->boston());
        $avail = $app->features()->available('a', $cat);
        $mode = $this->mode($mode, $store->score($uid, 'a'));

        return $store->tx(function () use ($uid, $app, $store, $cat, $today, $data, $res, $avail, $mode) {
            list($merged, $new) = $this->merge($uid, 'a', $avail, $res['items'], function ($r) {
                return array_filter(['last' => $r['last'], 'note' => $r['note']], function ($v) {
                    return $v !== null;
                });
            });
            $fresh = $this->events($uid, 'a', $new, $mode);
            list($points, $rank) = $this->ranks($uid, 'a', $avail, $merged, $mode);

            // the coach hears about a new level of his student (8 weeks after the start)
            if ($fresh) {
                $name = null;
                foreach ($data->coaches as $p) {
                    if ($p['to'] !== null && $p['to'] < $today) {
                        continue;
                    }
                    foreach ($fresh as $id => $f) {
                        if (!Cards::inWindows($f['date'], Cards::windows([$p], $today))) {
                            continue;
                        }
                        if ($name === null) {
                            $u = $app->source()->users([$uid]);
                            $name = Cards::name(isset($u[$uid]['name']) ? $u[$uid]['name'] : '', $store->setting($uid)['name_format']);
                        }
                        $card = Cards::card($avail[$id], $uid, $name, $f['level'], $f['date']);
                        $store->addNotification($p['coach'], 'c', 'student_level', ['card' => $card], $f['date']);
                    }
                }
            }

            $near = Near::text($cat, $avail, $merged);
            $store->putScore($uid, 'a', $points, $rank, $near, $res['active']);
            $store->putFacts($uid, $res['facts']);
            foreach ($data->coaches as $p) {
                $store->enqueue($p['coach'], 'c');
            }
            return ['points' => $points, 'rank' => $rank, 'new' => count($new)];
        });
    }

    // ---------- coach ----------

    public function coach($cid, $mode = 'auto')
    {
        $cid = (int) $cid;
        $app = $this->app;
        $src = $app->source();
        $store = $app->store();
        $cat = $app->catalog();
        $today = $app->today();

        $stints = [];
        foreach ($src->students($cid) ?: [] as $s) {
            if (isset($s['athlete_id']) && (int) $s['athlete_id'] !== $cid) {
                $stints[] = $s; // a coach cannot be his own student
            }
        }
        $ids = [];
        foreach (AthleteData::periods($stints, 'athlete_id', $today) as $p) {
            $ids[$p['athlete']] = true;
        }
        $ids = array_keys($ids);
        $facts = $store->factsFor($ids);
        foreach ($ids as $aid) {
            if (!isset($facts[$aid])) {
                $this->athlete($aid, $mode === 'history' ? 'history' : 'auto');
                $f = $store->facts($aid);
                if ($f !== null) {
                    $facts[$aid] = $f;
                }
            }
        }
        $names = [];
        foreach ($ids ? $src->users($ids) : [] as $id => $u) {
            $names[(int) $id] = isset($u['name']) ? $u['name'] : '';
        }
        $replies = $src->replies($cid);
        if ($replies !== null) {
            $app->features()->seen(['replies' => true]);
        }
        $res = CoachEngine::compute(['today' => $today, 'stints' => $stints, 'facts' => $facts, 'names' => $names, 'replies' => $replies],
            $cat->entries('c'), $cat, $app->ageGrade(), $app->boston());
        $avail = $app->features()->available('c', $cat);
        $mode = $this->mode($mode, $store->score($cid, 'c'));

        return $store->tx(function () use ($cid, $store, $avail, $res, $mode, $stints, $today) {
            $old = $store->levels($cid, 'c');
            foreach ($avail as $id => $e) {
                if (!empty($e['counter']) && isset($res[$id])) {
                    $res[$id]['holders'] = self::keepHolders(isset($old[$id]['info']['holders']) ? $old[$id]['info']['holders'] : [], (array) $res[$id]['holders']);
                }
            }
            list($merged, $new) = $this->merge($cid, 'c', $avail, $res, function ($r) {
                $info = [];
                foreach (['last', 'who', 'tail', 'data', 'holders'] as $k) {
                    if ($r[$k] !== null) {
                        $info[$k] = $r[$k];
                    }
                }
                if ($r['infinite']) {
                    $info['infinite'] = true;
                }
                return $info;
            });
            $this->events($cid, 'c', $new, $mode);
            list($points, $rank) = $this->ranks($cid, 'c', $avail, $merged, $mode);

            // «Саб 3: теперь 3×» — one more student on a counter card
            foreach ($avail as $id => $e) {
                if (empty($e['counter']) || empty($res[$id]['holders'])) {
                    continue;
                }
                $before = isset($old[$id]['info']['holders']) ? count($old[$id]['info']['holders']) : 0;
                foreach ($res[$id]['holders'] as $i => $h) {
                    if ($i >= $before && !$this->celebrated($mode, $h['date'])) {
                        $store->addNotification($cid, 'c', 'counter', ['achievement' => $id, 'count' => $i + 1, 'name' => $h['name'], 'time' => $h['time']], $h['date']);
                    }
                }
            }

            $active = null;
            foreach (AthleteData::periods($stints, 'athlete_id', $today) as $p) {
                $end = ($p['to'] === null || $p['to'] > $today) ? $today : $p['to'];
                $active = $active === null ? $end : max($active, $end);
            }
            $store->putScore($cid, 'c', $points, $rank, '', $active);
            $store->dequeue($cid, 'c');
            return ['points' => $points, 'rank' => $rank, 'new' => count($new)];
        });
    }

    // a counter never goes down: a holder the data no longer shows stays, as one who left
    private static function keepHolders(array $old, array $new)
    {
        $by = [];
        foreach ($new as $h) {
            $by[$h['athlete']] = $h;
        }
        foreach ($old as $h) {
            if (!isset($by[$h['athlete']])) {
                $h['left'] = true;
                $by[$h['athlete']] = $h;
            }
        }
        $list = array_values($by);
        usort($list, function ($a, $b) {
            return strcmp($a['date'], $b['date']) ?: $a['athlete'] - $b['athlete'];
        });
        return $list;
    }

    // ---------- shared ----------

    // keep stored dates, append new levels; returns [[id => ['dates', 'value']], [[id, level, date], …]]
    private function merge($uid, $role, array $avail, array $results, callable $info)
    {
        $store = $this->app->store();
        $stored = $store->levels($uid, $role);
        $merged = [];
        $new = [];
        foreach ($avail as $id => $e) {
            if (!isset($results[$id])) {
                continue;
            }
            $r = $results[$id];
            $old = isset($stored[$id]) ? $stored[$id] : null;
            $before = $old ? $old['dates'] : [];
            $dates = Levels::merge($before, $r['dates']);
            $value = self::number($r['value']);
            $inf = $info($r);
            if (!$old || $old['dates'] !== $dates || !self::sameNumber($old['value'], $value) || $old['info'] != $inf) {
                $store->putLevel($uid, $role, $id, $dates, $value, $inf);
            }
            for ($i = count($before); $i < count($dates); $i++) {
                $new[] = [$id, $i + 1, $dates[$i]];
            }
            $merged[$id] = ['dates' => $dates, 'value' => $value];
        }
        return [$merged, $new];
    }

    // events for new levels; returns the uncelebrated ones, the highest level per achievement
    private function events($uid, $role, array $new, $mode)
    {
        $store = $this->app->store();
        $fresh = [];
        foreach ($new as $n) {
            list($id, $level, $date) = $n;
            $c = $this->celebrated($mode, $date);
            $eid = $store->addEvent($uid, $role, $id, $level, $date, $c);
            if ($eid && !$c) {
                $fresh[$id] = ['level' => $level, 'event' => $eid, 'date' => $date];
            }
        }
        foreach ($fresh as $id => $f) {
            $store->addNotification($uid, $role, 'level', ['event' => $f['event'], 'achievement' => $id, 'level' => $f['level']], $f['date']);
        }
        return $fresh;
    }

    // points, rank, and an event for every rank reached, dated when the points first passed it
    private function ranks($uid, $role, array $avail, array $merged, $mode)
    {
        $cat = $this->app->catalog();
        $store = $this->app->store();
        $points = 0;
        $timeline = [];
        foreach ($merged as $id => $m) {
            $points += $cat->points($avail[$id], count($m['dates']));
            foreach ($m['dates'] as $i => $d) {
                $timeline[] = [$d, $cat->levelPoints($avail[$id], $i)];
            }
        }
        $rank = $cat->rankOf($role, $points);
        usort($timeline, function ($a, $b) {
            return strcmp($a[0], $b[0]);
        });
        $ranks = $cat->ranks($role);
        $when = [];
        $sum = 0;
        $r = 1;
        foreach ($timeline as $t) {
            $sum += $t[1];
            while ($r < count($ranks) && $sum >= $ranks[$r]['from']) {
                $when[$r] = $t[0];
                $r++;
            }
        }
        $have = $store->rankDays($uid, $role);
        $prev = null;
        for ($i = 1; $i <= $rank; $i++) {
            if (isset($have[$i])) {
                $prev = $have[$i];
                continue;
            }
            $d = isset($when[$i]) ? $when[$i] : $this->app->today();
            if ($prev !== null && $d < $prev) {
                $d = $prev;
            }
            $c = $this->celebrated($mode, $d);
            $rid = $store->addRankEvent($uid, $role, $i, $d, $c);
            if ($rid && !$c) {
                $store->addNotification($uid, $role, 'rank', ['rank' => $i], $d);
            }
            $prev = $d;
        }
        return [$points, $rank];
    }

    public static function number($v)
    {
        if ($v === null || is_bool($v)) {
            return $v === null ? null : (int) $v;
        }
        if (is_float($v) && (is_infinite($v) || is_nan($v))) {
            return null;
        }
        $f = (float) $v;
        return floor($f) == $f && abs($f) < 1e15 ? (int) $f : round($f, 3);
    }

    private static function sameNumber($a, $b)
    {
        if ($a === null || $b === null) {
            return $a === $b;
        }
        return abs((float) $a - (float) $b) < 1e-9;
    }

    // ---------- passes over many users ----------

    /** recount every athlete, then every coach; $log receives progress lines */
    public function all($mode, $log = null)
    {
        $src = $this->app->source();
        $features = $this->app->features();
        $features->begin();
        $done = ['athletes' => 0, 'coaches' => 0, 'errors' => 0];
        $ath = $src->athleteIds();
        foreach ($ath as $i => $uid) {
            try {
                $this->athlete($uid, $mode);
                $done['athletes']++;
            } catch (\Throwable $e) {
                $done['errors']++;
                error_log('[achievements] athlete ' . $uid . ': ' . $e->getMessage());
                if ($log) {
                    $log('athlete ' . $uid . ': ' . $e->getMessage());
                }
            }
            if ($log && ($i + 1) % 500 === 0) {
                $log('athletes: ' . ($i + 1) . ' / ' . count($ath));
            }
        }
        foreach ($src->coachIds() as $cid) {
            try {
                $this->coach($cid, $mode);
                $done['coaches']++;
            } catch (\Throwable $e) {
                $done['errors']++;
                error_log('[achievements] coach ' . $cid . ': ' . $e->getMessage());
                if ($log) {
                    $log('coach ' . $cid . ': ' . $e->getMessage());
                }
            }
        }
        if ($done['errors'] === 0) {
            $features->commit();
        }
        return $done;
    }

    /** share of active users (a run or a student in the last year) with each level; written to ach_rarity */
    public function rarity()
    {
        $store = $this->app->store();
        $cat = $this->app->catalog();
        $since = D::add($this->app->today(), -365);
        foreach (['a', 'c'] as $role) {
            $active = [];
            foreach ($store->allScores($role) as $uid => $s) {
                if ($s['active_at'] !== null && $s['active_at'] >= $since) {
                    $active[$uid] = true;
                }
            }
            $counts = $store->levelCounts($role, $active);
            $map = [];
            $total = count($active);
            foreach ($cat->entries($role) as $id => $e) {
                $pcts = [];
                for ($l = 1; $l <= count($e['thresholds']); $l++) {
                    $n = 0;
                    foreach (isset($counts[$id]) ? $counts[$id] : [] as $lv => $c) {
                        if ($lv >= $l) {
                            $n += $c;
                        }
                    }
                    $pcts[] = $total ? round($n / $total * 100, 2) : 0;
                }
                $map[$id] = $pcts;
            }
            $store->putRarity($role, $map);
        }
    }
}
