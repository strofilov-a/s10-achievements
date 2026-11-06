<?php
namespace S10Ach;

use S10Ach\Engine\AthleteData;
use S10Ach\Engine\AthleteEngine;
use S10Ach\Engine\CoachEngine;
use S10Ach\Engine\D;

// cli/check.php --user=ID: what S10Source returns for one user, checked against the shapes, and what the engine
// would count from it. Writes nothing. Output in Russian, for the developer who fills S10Source.
final class Check
{
    private $app;
    private $out = [];
    private $bad = 0;

    public function __construct(App $app)
    {
        $this->app = $app;
    }

    private function line($s)
    {
        $this->out[] = $s;
    }

    private function problem($method, $msg)
    {
        $this->bad++;
        $this->line("  !! $method: $msg");
    }

    private static function dateOk($v, $time = false)
    {
        $v = (string) $v;
        return D::valid(substr($v, 0, 10)) && (!$time || strlen($v) === 10 || preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/', $v));
    }

    private function call($m, $uid)
    {
        $t = microtime(true);
        try {
            $v = $this->app->source()->$m($uid);
        } catch (\Throwable $e) {
            $this->problem($m, $e->getMessage());
            return [false, null];
        }
        $ms = (int) round((microtime(true) - $t) * 1000);
        return [true, $v, $ms];
    }

    private function dates($m, $v)
    {
        if (!is_array($v)) {
            return $this->problem($m, 'нужен массив дат или null');
        }
        foreach ($v as $i => $d) {
            if (!self::dateOk($d)) {
                return $this->problem($m, "элемент $i: не дата «" . (is_scalar($d) ? $d : gettype($d)) . '»');
            }
        }
        $s = $v;
        sort($s);
        $this->line(sprintf('  %-12s %d, %s', $m, count($v), $s ? $s[0] . ' … ' . $s[count($s) - 1] : 'пусто'));
    }

    private function rows($m, $v, array $need)
    {
        if (!is_array($v)) {
            return $this->problem($m, 'нужен массив или null');
        }
        foreach ($v as $i => $r) {
            foreach ($need as $k) {
                if (!is_array($r) || !array_key_exists($k, $r)) {
                    return $this->problem($m, "строка $i: нет поля «{$k}»");
                }
            }
            foreach (['date', 'from'] as $k) {
                if (isset($r[$k]) && !self::dateOk($r[$k])) {
                    return $this->problem($m, "строка $i: $k не дата «{$r[$k]}»");
                }
            }
            if (array_key_exists('to', $r) && $r['to'] !== null && !self::dateOk($r['to'])) {
                return $this->problem($m, "строка $i: to не дата и не null");
            }
        }
        $this->line(sprintf('  %-12s %d', $m, count($v)));
    }

    public function user($uid)
    {
        $app = $this->app;
        $src = $app->source();
        $u = $src->users([$uid]);
        $coach = $src->isCoach($uid);
        $this->line("Пользователь $uid: «" . (isset($u[$uid]['name']) ? $u[$uid]['name'] : '— нет в users() —') . '»' . ($coach ? ', тренер' : ''));
        $this->line('Сегодня по Москве: ' . $app->today());
        $this->line('');
        $this->line('Что вернул S10Source:');

        list($ok, $runs) = $this->call('runs', $uid);
        if ($ok) {
            if (!is_array($runs)) {
                $this->problem('runs', 'нужен массив');
                $runs = [];
            }
            $src_ = [];
            $time = 0;
            $track = 0;
            $elev = 0;
            $hr = 0;
            foreach ($runs as $i => $r) {
                if (!isset($r['start']) || !self::dateOk($r['start'], true)) {
                    $this->problem('runs', "пробежка $i: start не 'YYYY-MM-DD HH:MM:SS'");
                    break;
                }
                if (!isset($r['km']) || !is_numeric($r['km']) || $r['km'] <= 0 || !isset($r['sec']) || !is_numeric($r['sec'])) {
                    $this->problem('runs', "пробежка $i: km и sec — числа, km > 0");
                    break;
                }
                $s = isset($r['source']) ? (string) $r['source'] : '?';
                $src_[$s] = (isset($src_[$s]) ? $src_[$s] : 0) + 1;
                $time += strlen((string) $r['start']) >= 16 ? 1 : 0;
                $track += !empty($r['track']) ? 1 : 0;
                $elev += isset($r['elev']) && $r['elev'] !== null ? 1 : 0;
                $hr += isset($r['hr_easy']) && $r['hr_easy'] !== null ? 1 : 0;
            }
            $n = max(1, count($runs));
            $parts = [];
            foreach ($src_ as $k => $c) {
                $parts[] = "$k $c";
            }
            $this->line(sprintf('  %-12s %d (%s); со временем старта %d%%, с треком %d%%, с набором высоты %d%%, с пульсом %d%%',
                'runs', count($runs), implode(', ', $parts), $time * 100 / $n, $track * 100 / $n, $elev * 100 / $n, $hr * 100 / $n));
        }
        $req = ['plan' => ['date', 'type', 'km'], 'races' => ['date', 'km', 'sec'], 'coaches' => ['coach_id', 'from', 'to']];
        foreach ($req as $m => $need) {
            list($ok, $v) = $this->call($m, $uid);
            if ($ok) {
                $this->rows($m, $v, $need);
            }
        }
        $this->line('');
        $this->line('Необязательные (null = на сайте таких данных нет, достижения выключены):');
        foreach (['reports', 'ownWeeks', 'posts', 'likes', 'comments', 'referrals'] as $m) {
            list($ok, $v) = $this->call($m, $uid);
            if ($ok) {
                $v === null ? $this->line(sprintf('  %-12s null', $m)) : $this->dates($m, $v);
            }
        }
        $opt = ['masterPlans' => ['from', 'to'], 'intervals' => ['date', 'plan_pace', 'laps'], 'challenges' => ['date', 'place'],
            'rating' => ['date', 'place'], 'tournament' => ['date', 'place'], 'cities' => ['date', 'city']];
        foreach ($opt as $m => $need) {
            list($ok, $v) = $this->call($m, $uid);
            if ($ok) {
                $v === null ? $this->line(sprintf('  %-12s null', $m)) : $this->rows($m, $v, $need);
            }
        }
        foreach (['splits', 'clubSince', 'person', 'forecast'] as $m) {
            list($ok, $v) = $this->call($m, $uid);
            if ($ok) {
                $this->line(sprintf('  %-12s %s', $m, $v === null ? 'null' : (is_array($v) ? count($v) . ' шт.' : json_encode($v, JSON_UNESCAPED_UNICODE))));
            }
        }

        // what the engine makes of it (nothing is written)
        if ($this->bad === 0) {
            $raw = Recalc::loadAthlete($src, $uid);
            $data = AthleteData::build($raw, $app->today(), $app->config['strength_type'], $uid);
            $cat = $app->catalog();
            $res = AthleteEngine::compute($data, $cat->entries('a'), $cat->units(), $app->boston());
            $this->line('');
            $this->line('Пробежек после склейки дублей: ' . count($data->runs) . ', отброшено как неправдоподобные: ' . count($data->dropped)
                . ', результатов на 5/10/21,1/42,2 км: ' . count($data->results));
            $this->line('Достижения атлета (значение · уровней):');
            foreach ($res['items'] as $id => $r) {
                $this->line(sprintf('  %-12s %s · %d', $id, $r['value'] === null ? '—' : json_encode($r['value']), count($r['dates'])));
            }
        }
        if ($coach) {
            $this->line('');
            $this->line('Тренер:');
            list($ok, $st) = $this->call('students', $uid);
            if ($ok) {
                $this->rows('students', $st, ['athlete_id', 'from', 'to']);
            }
            list($ok, $rp) = $this->call('replies', $uid);
            if ($ok) {
                $rp === null ? $this->line(sprintf('  %-12s null', 'replies')) : $this->rows('replies', $rp, ['report_at', 'reply_at']);
            }
            if ($this->bad === 0 && $ok) {
                $cat = $app->catalog();
                $facts = $app->store()->factsFor(array_map(function ($s) {
                    return (int) $s['athlete_id'];
                }, $st ?: []));
                $res = CoachEngine::compute(['today' => $app->today(), 'stints' => $st ?: [], 'facts' => $facts, 'names' => [], 'replies' => $rp],
                    $cat->entries('c'), $cat, $app->ageGrade(), $app->boston());
                $this->line('Достижения тренера по уже посчитанным ученикам (' . count($facts) . '):');
                foreach ($res as $id => $r) {
                    $this->line(sprintf('  %-12s %s · %d%s', $id, $r['value'] === null ? '—' : json_encode($r['value']), count($r['dates']), $r['data'] ? ' · ' . json_encode($r['data']) : ''));
                }
            }
        }
        $this->line('');
        $this->line($this->bad ? "Ошибок: {$this->bad}" : 'Ошибок нет');
        return [$this->bad, $this->out];
    }
}
