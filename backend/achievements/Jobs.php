<?php
namespace S10Ach;

use S10Ach\Engine\Text;

// What the cron lines run (cli/worker.php, cli/nightly.php, cli/recalc.php --history) and the report.
final class Jobs
{
    private $app;

    public function __construct(App $app)
    {
        $this->app = $app;
    }

    /**
     * Every few minutes: athletes whose data changed (S10Source::changedUserIds) or who are queued, then the coaches
     * queued by their students' recounts (each coach at most once per coach_min_interval).
     */
    public function worker($log = null)
    {
        $app = $this->app;
        $store = $app->store();
        $src = $app->source();
        $now = time();
        $since = (int) $store->meta('worker_at', (string) ($now - 3600));
        $store->putMeta('worker_at', (string) $now); // changes made while we run are seen next time
        $changed = [];
        foreach ($src->changedUserIds($since) ?: [] as $id) {
            $changed[(int) $id] = true;
        }
        $athletes = $changed + $store->queued('a');
        $stat = ['athletes' => 0, 'coaches' => 0, 'errors' => 0];
        foreach (array_keys($athletes) as $uid) {
            try {
                $app->recalc()->athlete($uid, 'auto');
                $store->dequeue($uid, 'a');
                $stat['athletes']++;
                if (isset($changed[$uid]) && $src->isCoach($uid)) {
                    $store->enqueue($uid, 'c'); // his students may have changed
                }
            } catch (\Throwable $e) {
                $stat['errors']++;
                self::say($log, 'athlete ' . $uid . ': ' . $e->getMessage());
            }
        }
        $wait = (int) $app->config['coach_min_interval'];
        foreach ($store->queued('c') as $cid => $at) {
            $score = $store->score($cid, 'c');
            $recent = $score && $score['recalc_at'] && strtotime($score['recalc_at']) > strtotime($app->now()) - $wait;
            if ($recent && !isset($changed[$cid])) {
                continue; // later: a coach is not urgent
            }
            try {
                $app->recalc()->coach($cid, 'auto');
                $stat['coaches']++;
            } catch (\Throwable $e) {
                $stat['errors']++;
                self::say($log, 'coach ' . $cid . ': ' . $e->getMessage());
            }
        }
        return $stat;
    }

    /** every night: everybody, then rarity */
    public function nightly($log = null)
    {
        $stat = $this->app->recalc()->all('auto', $log);
        $this->app->recalc()->rarity();
        return $stat;
    }

    /** once, at the launch: the whole history, events already celebrated, no notifications */
    public function history($log = null)
    {
        $stat = $this->app->recalc()->all('history', $log);
        $this->app->recalc()->rarity();
        $this->app->store()->putMeta('worker_at', (string) time());
        return $stat;
    }

    private static function say($log, $msg)
    {
        error_log('[achievements] ' . $msg);
        if (is_callable($log)) {
            $log($msg);
        }
    }

    // ---------- the report for the owner ----------

    /** @return array [markdown, csv] — users per level of every achievement and per rank, athletes and coaches */
    public function report()
    {
        $app = $this->app;
        $store = $app->store();
        $cat = $app->catalog();
        $features = $app->features();
        $md = [];
        $csv = ["role,achievement,level,level_name,users"];
        $md[] = '# Распределение достижений S10, ' . Text::date($app->today());
        $md[] = '';
        $md[] = 'Посчитано на сервере после пересчёта истории. В каждой ячейке: сколько пользователей сейчас ровно на этом уровне. '
            . 'Считаются атлеты хотя бы с одной пробежкой и тренеры хотя бы с одним учеником; активные — за последний год.';
        foreach (['a' => 'атлеты', 'c' => 'тренеры'] as $role => $title) {
            $scores = array_filter($store->allScores($role), function ($s) {
                return $s['active_at'] !== null; // an empty profile tells nothing about the thresholds
            });
            $active = 0;
            $since = Engine\D::add($app->today(), -365);
            foreach ($scores as $s) {
                $active += ($s['active_at'] !== null && $s['active_at'] >= $since) ? 1 : 0;
            }
            $md[] = '';
            $md[] = '## ' . Text::ucfirst($title) . ': ' . count($scores) . ', активных ' . $active;
            $md[] = '';
            $md[] = '### Звания';
            $md[] = '';
            $md[] = '| Звание | От очков | Пользователей | Доля |';
            $md[] = '| --- | ---: | ---: | ---: |';
            $byRank = [];
            foreach ($scores as $s) {
                $byRank[$s['rank']] = (isset($byRank[$s['rank']]) ? $byRank[$s['rank']] : 0) + 1;
            }
            foreach ($cat->ranks($role) as $i => $r) {
                $n = isset($byRank[$i]) ? $byRank[$i] : 0;
                $md[] = '| ' . $r['name'] . ' | ' . $r['from'] . ' | ' . $n . ' | ' . self::pct($n, count($scores)) . ' |';
                $csv[] = "$role,rank,$i," . $r['name'] . ",$n";
            }
            $who = array_fill_keys(array_keys($scores), true);
            $counts = $store->levelCounts($role, $who);
            $values = $store->values($role, $who);
            $avail = $features->available($role, $cat);
            $md[] = '';
            $md[] = '### Достижения';
            $md[] = '';
            $md[] = '| Достижение | id | Нет | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | Значение: медиана · 90% · 99% |';
            $md[] = '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |';
            foreach ($cat->entries($role) as $id => $e) {
                if (!isset($avail[$id])) {
                    continue;
                }
                $row = ['| ' . $e['name'] . ' | ' . $id];
                for ($l = 0; $l <= 8; $l++) {
                    $n = isset($counts[$id][$l]) ? $counts[$id][$l] : 0;
                    $row[] = $l < count($e['thresholds']) + 1 ? (string) $n : '';
                    if ($l <= count($e['thresholds'])) {
                        $name = $l === 0 ? 'нет' : $cat->levelName($e, $l - 1);
                        $csv[] = "$role,$id,$l,$name,$n";
                    }
                }
                $v = isset($values[$id]) ? $values[$id] : [];
                sort($v);
                $fmt = function ($x) use ($e) {
                    return $e['format'] === 'time' ? Text::time($x) : ($e['format'] === 'dur' ? Text::dur($x) : Text::num($x, 1));
                };
                $row[] = $v ? $fmt(self::q($v, 0.5)) . ' · ' . $fmt(self::q($v, 0.9)) . ' · ' . $fmt(self::q($v, 0.99)) : '—';
                $md[] = implode(' | ', $row) . ' |';
            }
            $off = array_diff_key($cat->entries($role), $avail);
            if ($off) {
                $md[] = '';
                $md[] = 'Выключены (нет данных на сайте или в каталоге стоит enabled: false): ' . implode(', ', array_keys($off)) . '.';
            }
        }
        $md[] = '';
        $md[] = '## Какие данные нашлись на сайте';
        $md[] = '';
        $seen = $features->all();
        ksort($seen);
        $md[] = $seen ? implode(', ', array_keys($seen)) : 'только обязательные';
        $md[] = '';
        return [implode("\n", $md), implode("\n", $csv) . "\n"];
    }

    private static function pct($n, $total)
    {
        return $total ? Text::num($n / $total * 100, 1) . '%' : '—';
    }

    private static function q(array $sorted, $p)
    {
        return $sorted[(int) floor($p * (count($sorted) - 1))];
    }
}
