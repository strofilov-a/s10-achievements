<?php
namespace S10Ach\Engine;

// Russian texts for the few captions the server writes («last», «note», «near»). Ported from the prototypes.
// No mbstring needed.
final class Text
{
    const NBSP = "\xC2\xA0";
    const DASH = "\xE2\x80\x93"; // en dash

    const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

    // the prototype's plural(): one form, or one / few / many
    public static function plural($n, $forms)
    {
        if (!$forms) {
            return '';
        }
        if (count($forms) === 1) {
            return $forms[0];
        }
        if (floor($n) != $n) {
            return $forms[1];
        }
        $a = abs((int) $n) % 100;
        $b = $a % 10;
        if ($a > 10 && $a < 20) {
            return $forms[2];
        }
        if ($b === 1) {
            return $forms[0];
        }
        if ($b > 1 && $b < 5) {
            return $forms[1];
        }
        return $forms[2];
    }

    // 4212 → «4 212», 7.8 → «7,8» (like toLocaleString('ru-RU'), no-break space in thousands)
    public static function num($n, $frac = 1)
    {
        $s = sprintf('%.' . (int) $frac . 'F', round((float) $n, $frac));
        $neg = $s[0] === '-';
        if ($neg) {
            $s = substr($s, 1);
        }
        $parts = explode('.', $s);
        $int = number_format((float) $parts[0], 0, '', self::NBSP);
        $dec = isset($parts[1]) ? rtrim($parts[1], '0') : '';
        $out = $int . ($dec !== '' ? ',' . $dec : '');
        return ($neg && $out !== '0') ? '-' . $out : $out;
    }

    // 1138 → «18:58», 17033 → «4:43:53»
    public static function time($sec)
    {
        $sec = (int) round($sec);
        $h = intdiv($sec, 3600);
        $m = intdiv($sec % 3600, 60);
        $s = $sec % 60;
        return $h ? sprintf('%d:%02d:%02d', $h, $m, $s) : sprintf('%d:%02d', $m, $s);
    }

    // minutes → «2 ч 10 мин», «45 мин»
    public static function dur($min)
    {
        $min = (int) round($min);
        if ($min >= 60) {
            return intdiv($min, 60) . ' ч' . ($min % 60 ? ' ' . ($min % 60) . ' мин' : '');
        }
        return $min . ' мин';
    }

    public static function date($ymd)
    {
        return substr($ymd, 8, 2) . '.' . substr($ymd, 5, 2) . '.' . substr($ymd, 0, 4);
    }

    // «08–14.09.2025», «29.09–05.10.2025», «29.12.2025–04.01.2026»
    public static function range($a, $b)
    {
        if ($a === $b) {
            return self::date($a);
        }
        if (substr($a, 0, 4) !== substr($b, 0, 4)) {
            return self::date($a) . self::DASH . self::date($b);
        }
        if (substr($a, 5, 2) !== substr($b, 5, 2)) {
            return substr($a, 8, 2) . '.' . substr($a, 5, 2) . self::DASH . self::date($b);
        }
        return substr($a, 8, 2) . self::DASH . self::date($b);
    }

    // «сентябрь 2025»
    public static function month($ymd)
    {
        return self::MONTHS[(int) substr($ymd, 5, 2) - 1] . ' ' . substr($ymd, 0, 4);
    }

    // «мая 2024»
    public static function monthGen($ymd)
    {
        return self::MONTHS_GEN[(int) substr($ymd, 5, 2) - 1] . ' ' . substr($ymd, 0, 4);
    }

    public static function ucfirst($s)
    {
        if (!preg_match('/^(.)(.*)$/us', $s, $m)) {
            return $s;
        }
        $up = ['а' => 'А', 'б' => 'Б', 'в' => 'В', 'г' => 'Г', 'д' => 'Д', 'е' => 'Е', 'ё' => 'Ё', 'ж' => 'Ж', 'з' => 'З', 'и' => 'И', 'й' => 'Й', 'к' => 'К', 'л' => 'Л', 'м' => 'М', 'н' => 'Н', 'о' => 'О', 'п' => 'П', 'р' => 'Р', 'с' => 'С', 'т' => 'Т', 'у' => 'У', 'ф' => 'Ф', 'х' => 'Х', 'ц' => 'Ц', 'ч' => 'Ч', 'ш' => 'Ш', 'щ' => 'Щ', 'ъ' => 'Ъ', 'ы' => 'Ы', 'ь' => 'Ь', 'э' => 'Э', 'ю' => 'Ю', 'я' => 'Я'];
        $first = isset($up[$m[1]]) ? $up[$m[1]] : strtoupper($m[1]);
        return $first . $m[2];
    }

    // «Атлет 3» → «А3», «Тренер» → «Т», «Иван Петров» → «ИП»
    public static function initials($name)
    {
        $out = '';
        $words = preg_split('/\s+/u', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY);
        foreach (array_slice($words ?: [], 0, 2) as $w) {
            if (preg_match('/^./u', $w, $m)) {
                $out .= self::ucfirst($m[0]);
            }
        }
        return $out !== '' ? $out : 'S';
    }

    // a distance key ('5', '10', '21', '42') as a card text
    public static function distance($key)
    {
        $map = ['5' => '5 км', '10' => '10 км', '21' => '21,1 км', '42' => '42,2 км'];
        return isset($map[$key]) ? $map[$key] : $key . ' км';
    }

    // the same in a sentence: «марафон», «полумарафон», «10 км»
    public static function distanceWord($key)
    {
        $map = ['5' => '5 км', '10' => '10 км', '21' => 'полумарафон', '42' => 'марафон'];
        return isset($map[$key]) ? $map[$key] : $key . ' км';
    }
}
