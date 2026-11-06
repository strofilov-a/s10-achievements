<?php
namespace S10Ach\Engine;

// Threshold crossing: the date each level was first reached when the history is replayed in date order.
final class Levels
{
    // direction 1: the value reaches the threshold from below; -1: from above (time, place)
    public static function passes($v, $t, $dir)
    {
        if ($v === null) {
            return false;
        }
        return $dir < 0 ? $v <= $t : $v >= $t;
    }

    /**
     * @param array      $series [[date, value, n], …] in date order; value after that date's events, n = data behind it
     * @param array      $th     thresholds, lowest level first
     * @param int        $dir    1 or -1
     * @param array|null $gate   data needed for each level (coach), null = none
     * @return string[] a date per reached level; several levels on one day all get that day
     */
    public static function cross(array $series, array $th, $dir, $gate = null)
    {
        $dates = [];
        $count = count($th);
        $i = 0;
        foreach ($series as $p) {
            if ($i >= $count) {
                break;
            }
            $v = $p[1];
            if ($v === null) {
                continue;
            }
            $n = isset($p[2]) ? $p[2] : 0;
            // reaching level i implies every level below it, so one pass is enough
            while ($i < $count && self::passes($v, $th[$i], $dir) && ($gate === null || $n >= $gate[$i])) {
                $dates[] = $p[0];
                $i++;
            }
        }
        return $dates;
    }

    // keep what is stored, append newly reached levels; a date never goes before the level below it
    public static function merge(array $stored, array $computed)
    {
        $out = array_values($stored);
        for ($i = count($out); $i < count($computed); $i++) {
            $d = $computed[$i];
            if ($out && $d < $out[count($out) - 1]) {
                $d = $out[count($out) - 1];
            }
            $out[] = $d;
        }
        return $out;
    }

    // [[date, amount], …] → cumulative [[date, total], …], one point per date
    public static function cumulative(array $events, $precision = null)
    {
        usort($events, function ($a, $b) {
            return strcmp($a[0], $b[0]);
        });
        $out = [];
        $sum = 0.0;
        foreach ($events as $e) {
            $sum += $e[1];
            $v = $precision === null ? $sum : round($sum, $precision);
            $k = count($out);
            if ($k && $out[$k - 1][0] === $e[0]) {
                $out[$k - 1][1] = $v;
            } else {
                $out[] = [$e[0], $v];
            }
        }
        return $out;
    }

    // [[date, value], …] → running best (max for dir 1, min for dir -1), one point per date
    public static function best(array $events, $dir, $precision = null)
    {
        usort($events, function ($a, $b) {
            return strcmp($a[0], $b[0]);
        });
        $out = [];
        $best = null;
        foreach ($events as $e) {
            $v = $precision === null ? $e[1] : round($e[1], $precision);
            if ($best === null || ($dir < 0 ? $v < $best : $v > $best)) {
                $best = $v;
            }
            $k = count($out);
            if ($k && $out[$k - 1][0] === $e[0]) {
                $out[$k - 1][1] = $best;
            } else {
                $out[] = [$e[0], $best];
            }
        }
        return $out;
    }
}
