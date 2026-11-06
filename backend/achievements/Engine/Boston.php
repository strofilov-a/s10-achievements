<?php
namespace S10Ach\Engine;

// Boston qualifying standards from data/boston.php: sex => [age from => seconds].
final class Boston
{
    private $t;

    public function __construct(array $table)
    {
        $this->t = $table;
        foreach ($this->t as $sex => $rows) {
            ksort($this->t[$sex]);
        }
    }

    /** @return Boston|null */
    public static function load($file)
    {
        if (!$file || !is_file($file)) {
            return null;
        }
        $t = include $file;
        return is_array($t) && !empty($t['m']) && !empty($t['f']) ? new self($t) : null;
    }

    /** seconds to qualify, or null under the youngest age group */
    public function standard($sex, $age)
    {
        if (!isset($this->t[$sex])) {
            return null;
        }
        $std = null;
        foreach ($this->t[$sex] as $from => $sec) {
            if ($age >= $from) {
                $std = (int) $sec;
            }
        }
        return $std;
    }
}
