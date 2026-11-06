<?php
namespace S10Ach\Engine;

// Age grading: a result as a percentage of the world-class time for the runner's age and sex (WMA road tables).
// The table is a PHP file (config 'age_grade_file', by default data/age-grade.php) that returns
//   ['m' => ['5' => [age => seconds, …], '10' => […], '21' => […], '42' => […]], 'f' => […]]
// where seconds = the age standard (open standard ÷ the WMA age factor) for that age, sex and distance.
// We ship no numbers: build the file from the current WMA / Alan Jones road tables. Without the file,
// «Уровень учеников» is off and «Прогресс команды» uses the plain personal-best rule.
final class AgeGrade
{
    private $t;

    public function __construct(array $table)
    {
        $this->t = $table;
        foreach ($this->t as $sex => $dists) {
            foreach ($dists as $k => $rows) {
                ksort($this->t[$sex][$k]);
            }
        }
    }

    /** @return AgeGrade|null */
    public static function load($file)
    {
        if (!$file || !is_file($file)) {
            return null;
        }
        $t = include $file;
        return is_array($t) && !empty($t['m']) && !empty($t['f']) ? new self($t) : null;
    }

    /** percent (one decimal) or null when the table has no such row */
    public function pct($dist, $sec, $age, $sex)
    {
        if ($sec <= 0 || !isset($this->t[$sex][(string) $dist])) {
            return null;
        }
        $std = null;
        foreach ($this->t[$sex][(string) $dist] as $a => $s) {
            if ($std === null || $age >= $a) {
                $std = (float) $s;
            }
        }
        return $std ? round($std / $sec * 100, 1) : null;
    }
}
