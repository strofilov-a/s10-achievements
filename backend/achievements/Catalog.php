<?php
namespace S10Ach;

// The catalog: athlete.json, coach.json and common.json, read once per request.
// Roles: 'a' = athlete, 'c' = coach.
final class Catalog
{
    private static $cache = [];
    private $dir;

    public function __construct($dir)
    {
        $this->dir = rtrim($dir, '/');
    }

    private function load($name)
    {
        $file = $this->dir . '/' . $name . '.json';
        if (!isset(self::$cache[$file])) {
            $raw = @file_get_contents($file);
            $data = $raw === false ? null : json_decode($raw, true);
            if (!is_array($data)) {
                throw new \RuntimeException('Catalog file is missing or broken: ' . $file);
            }
            self::$cache[$file] = $data;
        }
        return self::$cache[$file];
    }

    public function common()
    {
        return $this->load('common');
    }

    // every entry of a role, in catalog order, the disabled ones included
    public function all($role)
    {
        return $this->load($role === 'c' ? 'coach' : 'athlete');
    }

    // enabled entries only, keyed by id, in catalog order
    public function entries($role)
    {
        $out = [];
        foreach ($this->all($role) as $e) {
            if (!array_key_exists('enabled', $e) || $e['enabled']) {
                $out[$e['id']] = $e;
            }
        }
        return $out;
    }

    public function ranks($role)
    {
        $c = $this->common();
        return $role === 'c' ? $c['coach_ranks'] : $c['athlete_ranks'];
    }

    public function categories($role)
    {
        $c = $this->common();
        return $role === 'c' ? $c['coach_categories'] : $c['athlete_categories'];
    }

    public function categoryIndex($role)
    {
        $out = [];
        foreach ($this->categories($role) as $i => $c) {
            $out[$c['id']] = $i;
        }
        return $out;
    }

    public function levels()
    {
        $l = $this->common()['levels'];
        return ['tiers' => $l['tiers'], 'one' => $l['one'], 'legend' => $l['legend']];
    }

    public function gates()
    {
        $g = $this->common()['coach_gates'];
        return ['base' => $g['base'], 'step' => $g['step']];
    }

    public function units()
    {
        return $this->common()['units'];
    }

    // data needed for each level of a coach entry, or null when it needs none
    public function gateFor(array $e)
    {
        if (empty($e['data_unit'])) {
            return null;
        }
        $g = $this->common()['coach_gates'];
        $base = isset($g['base'][$e['data_unit']]) ? $g['base'][$e['data_unit']] : 0;
        $out = [];
        foreach ($e['thresholds'] as $i => $t) {
            $out[] = $base * (isset($g['step'][$i]) ? $g['step'][$i] : end($g['step']));
        }
        return $out;
    }

    // points for level index $i (0-based) of an entry
    public function levelPoints(array $e, $i)
    {
        $l = $this->common()['levels'];
        if ($e['kind'] === 'tier') {
            return (int) $l['tiers'][$i]['points'];
        }
        return (int) ($e['kind'] === 'secret' ? $l['legend']['points'] : $l['one']['points']);
    }

    // points for having $level levels
    public function points(array $e, $level)
    {
        $sum = 0;
        for ($i = 0; $i < $level && $i < count($e['thresholds']); $i++) {
            $sum += $this->levelPoints($e, $i);
        }
        return $sum;
    }

    public function levelName(array $e, $i)
    {
        $l = $this->common()['levels'];
        if ($e['kind'] === 'tier') {
            return $l['tiers'][$i]['name'];
        }
        return $e['kind'] === 'secret' ? $l['legend']['name'] : $l['one']['name'];
    }

    // the largest rank whose threshold is not above the points
    public function rankOf($role, $points)
    {
        $idx = 0;
        foreach ($this->ranks($role) as $i => $r) {
            if ($points >= $r['from']) {
                $idx = $i;
            }
        }
        return $idx;
    }
}
