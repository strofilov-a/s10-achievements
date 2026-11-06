<?php
namespace S10Ach\Engine;

use S10Ach\Catalog;

// The athlete's closest next level as one line for the coach's list:
// «Марафон: Чемпион, быстрее на 18:41», «Тысячник: Серебро, ещё 46 км». Ported from the prototype's progress() and remaining().
final class Near
{
    // progress to the next level, 0..1, or null when there is none
    public static function progress(array $e, $value, $level)
    {
        $th = $e['thresholds'];
        if ($value === null || $level >= count($th)) {
            return null;
        }
        $dir = isset($e['direction']) ? (int) $e['direction'] : 1;
        $next = $th[$level];
        if ($level) {
            $prev = $th[$level - 1];
        } elseif ($dir === 1) {
            $prev = 0;
        } elseif (isset($e['start'])) {
            $prev = $e['start'];
        } else {
            return null;
        }
        if ($next == $prev) {
            return null;
        }
        $p = $dir === 1 ? ($value - $prev) / ($next - $prev) : ($prev - $value) / ($prev - $next);
        return max(0.0, min(1.0, $p));
    }

    public static function remaining(array $e, $value, $next, array $units)
    {
        $dir = isset($e['direction']) ? (int) $e['direction'] : 1;
        if ($dir === -1) {
            if ($e['format'] === 'rank') {
                $left = (int) round($value - $next);
                return 'ещё ' . $left . ' ' . Text::plural($left, $units['place']);
            }
            if ($e['format'] === 'dur') {
                return 'быстрее на ' . Text::dur($value - $next);
            }
            return 'быстрее на ' . Text::time($value - $next);
        }
        $left = round(($next - $value) * 10) / 10;
        $u = $e['unit'] !== null && isset($units[$e['unit']]) ? ' ' . Text::plural($left, $units[$e['unit']]) : '';
        return 'ещё ' . Text::num($left) . $u;
    }

    /**
     * @param array $avail athlete entries [id => entry]
     * @param array $items [id => ['dates' => [...], 'value' => v]]
     */
    public static function text(Catalog $cat, array $avail, array $items)
    {
        $best = null;
        foreach ($avail as $id => $e) {
            if ($e['kind'] === 'secret' || !isset($items[$id])) {
                continue;
            }
            $level = count($items[$id]['dates']);
            $p = self::progress($e, $items[$id]['value'], $level);
            if ($p !== null && $p > 0 && ($best === null || $p > $best[0])) {
                $best = [$p, $e, $level, $items[$id]['value']];
            }
        }
        if ($best === null) {
            return '';
        }
        list(, $e, $level, $value) = $best;
        return $e['name'] . ': ' . $cat->levelName($e, $level) . ', ' . self::remaining($e, $value, $e['thresholds'][$level], $cat->units());
    }
}
