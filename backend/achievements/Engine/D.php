<?php
namespace S10Ach\Engine;

// Calendar dates as 'YYYY-MM-DD' strings. Day numbers are days since 1970-01-01 (proleptic Gregorian).
final class D
{
    public static function num($ymd)
    {
        $y = (int) substr($ymd, 0, 4);
        $m = (int) substr($ymd, 5, 2);
        $d = (int) substr($ymd, 8, 2);
        if ($m <= 2) {
            $y--;
        }
        $era = intdiv($y >= 0 ? $y : $y - 399, 400);
        $yoe = $y - $era * 400;
        $doy = intdiv(153 * ($m + ($m > 2 ? -3 : 9)) + 2, 5) + $d - 1;
        $doe = $yoe * 365 + intdiv($yoe, 4) - intdiv($yoe, 100) + $doy;
        return $era * 146097 + $doe - 719468;
    }

    public static function str($z)
    {
        $z += 719468;
        $era = intdiv($z >= 0 ? $z : $z - 146096, 146097);
        $doe = $z - $era * 146097;
        $yoe = intdiv($doe - intdiv($doe, 1460) + intdiv($doe, 36524) - intdiv($doe, 146096), 365);
        $y = $yoe + $era * 400;
        $doy = $doe - (365 * $yoe + intdiv($yoe, 4) - intdiv($yoe, 100));
        $mp = intdiv(5 * $doy + 2, 153);
        $d = $doy - intdiv(153 * $mp + 2, 5) + 1;
        $m = $mp + ($mp < 10 ? 3 : -9);
        if ($m <= 2) {
            $y++;
        }
        return sprintf('%04d-%02d-%02d', $y, $m, $d);
    }

    public static function valid($s)
    {
        if (!is_string($s) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $s, $m)) {
            return false;
        }
        return checkdate((int) $m[2], (int) $m[3], (int) $m[1]);
    }

    public static function add($ymd, $days)
    {
        return self::str(self::num($ymd) + $days);
    }

    // days from $a to $b
    public static function diff($a, $b)
    {
        return self::num($b) - self::num($a);
    }

    // 1 = Monday … 7 = Sunday
    public static function dow($ymd)
    {
        $n = self::num($ymd);
        return ((($n + 3) % 7) + 7) % 7 + 1;
    }

    public static function monday($ymd)
    {
        return self::add($ymd, 1 - self::dow($ymd));
    }

    public static function daysInMonth($y, $m)
    {
        return (int) [31, ($y % 4 === 0 && ($y % 100 !== 0 || $y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][$m - 1];
    }

    // calendar months later; the day is clamped to the month's length (31.01 + 1 = 28/29.02)
    public static function addMonths($ymd, $k)
    {
        $y = (int) substr($ymd, 0, 4);
        $m = (int) substr($ymd, 5, 2) - 1 + $k;
        $d = (int) substr($ymd, 8, 2);
        $y += (int) floor($m / 12);
        $m = (($m % 12) + 12) % 12 + 1;
        return sprintf('%04d-%02d-%02d', $y, $m, min($d, self::daysInMonth($y, $m)));
    }

    // completed calendar months from $a to $b (0 if $b < $a)
    public static function months($a, $b)
    {
        if ($b < $a) {
            return 0;
        }
        $k = ((int) substr($b, 0, 4) - (int) substr($a, 0, 4)) * 12 + (int) substr($b, 5, 2) - (int) substr($a, 5, 2);
        while ($k > 0 && self::addMonths($a, $k) > $b) {
            $k--;
        }
        return max(0, $k);
    }

    // completed years (age)
    public static function years($birth, $at)
    {
        $y = (int) substr($at, 0, 4) - (int) substr($birth, 0, 4);
        if (substr($at, 5, 5) < substr($birth, 5, 5)) {
            $y--;
        }
        return $y;
    }

    public static function monthEnd($ymd)
    {
        $y = (int) substr($ymd, 0, 4);
        $m = (int) substr($ymd, 5, 2);
        return sprintf('%04d-%02d-%02d', $y, $m, self::daysInMonth($y, $m));
    }

    public static function ym($ymd)
    {
        return substr($ymd, 0, 7);
    }

    public static function year($ymd)
    {
        return (int) substr($ymd, 0, 4);
    }
}
