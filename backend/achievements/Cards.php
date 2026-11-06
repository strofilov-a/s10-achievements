<?php
namespace S10Ach;

use S10Ach\Engine\D;
use S10Ach\Engine\Text;

// Student cards for a coach: an athlete achievement reached while with the coach, 8 weeks after the start.
// Card: {key, athlete_id, athlete_name, achievement, name, kind, level, number, text, date}
final class Cards
{
    const FORMATS = ['full', 'initial', 'anon'];

    // the name in the format the student chose: «Иван Петров», «Иван П.», «Ученик S10»
    public static function name($name, $format)
    {
        if ($format === 'anon') {
            return 'Ученик S10';
        }
        if ($format === 'initial') {
            $w = preg_split('/\s+/u', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY) ?: [];
            if (count($w) >= 2 && preg_match('/^./u', $w[1], $m) && !preg_match('/^\d/', $w[1])) {
                return $w[0] . ' ' . Text::ucfirst($m[0]) . '.';
            }
        }
        return (string) $name;
    }

    public static function key($aid, $ach)
    {
        return $aid . '-' . $ach;
    }

    /** @return array [athlete id, achievement id] or null */
    public static function parseKey($key)
    {
        if (!is_string($key) || !preg_match('/^(\d+)-([a-z0-9_]+)$/', $key, $m)) {
            return null;
        }
        return [(int) $m[1], $m[2]];
    }

    public static function card(array $e, $aid, $name, $level, $date)
    {
        return [
            'key' => self::key($aid, $e['id']),
            'athlete_id' => (string) $aid,
            'athlete_name' => $name,
            'achievement' => $e['id'],
            'name' => $e['name'],
            'kind' => $e['kind'],
            'level' => (int) $level,
            'number' => isset($e['card_number'][$level - 1]) ? $e['card_number'][$level - 1] : '',
            'text' => isset($e['card_text'][$level - 1]) ? $e['card_text'][$level - 1] : '',
            'date' => $date,
        ];
    }

    /** windows in which a student's results count for the coach: [[from + 8 weeks, end]] */
    public static function windows(array $periods, $today)
    {
        $out = [];
        foreach ($periods as $p) {
            $end = ($p['to'] === null || $p['to'] > $today) ? $today : $p['to'];
            $from = D::add($p['from'], 56);
            if ($from <= $end) {
                $out[] = [$from, $end];
            }
        }
        return $out;
    }

    public static function inWindows($date, array $windows)
    {
        foreach ($windows as $w) {
            if ($date >= $w[0] && $date <= $w[1]) {
                return true;
            }
        }
        return false;
    }

    /**
     * The student's cards for this coach: for each achievement the highest level reached inside the windows.
     * @param array $avail  available athlete entries [id => entry]
     * @param array $levels the student's stored levels [id => ['dates' => …]]
     * @return array [achievement => card], best first
     */
    public static function forStudent(Catalog $cat, array $avail, array $levels, array $windows, $aid, $name)
    {
        $out = [];
        foreach ($avail as $id => $e) {
            if (empty($levels[$id]['dates'])) {
                continue;
            }
            $best = 0;
            $date = null;
            foreach ($levels[$id]['dates'] as $i => $d) {
                if (self::inWindows($d, $windows)) {
                    $best = $i + 1;
                    $date = $d;
                }
            }
            if ($best) {
                $out[$id] = self::card($e, $aid, $name, $best, $date);
            }
        }
        return self::sort($cat, $avail, $out);
    }

    // fresh high levels first: the level's points, then the date
    public static function sort(Catalog $cat, array $avail, array $cards)
    {
        $rank = [];
        foreach ($cards as $id => $c) {
            $e = $avail[$c['achievement']];
            $rank[$id] = [$cat->levelPoints($e, $c['level'] - 1), $c['date'], $id];
        }
        uksort($cards, function ($a, $b) use ($rank) {
            return ($rank[$b][0] - $rank[$a][0]) ?: (strcmp($rank[$b][1], $rank[$a][1]) ?: strcmp($rank[$a][2], $rank[$b][2]));
        });
        return $cards;
    }
}
