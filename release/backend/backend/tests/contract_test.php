<?php
// The contract: for every example answer in contract/mock, the answer of the matching fixture state has the same
// keys at every level (objects recursively, arrays: the union of their elements' keys) and the same JSON types.

use S10Ach\Tests\Setup;

// path => sorted list of JSON types seen there
function shape($v, $path = '$', array &$out = [])
{
    if (is_object($v)) {
        $out[$path]['object'] = true;
        foreach (get_object_vars($v) as $k => $x) {
            shape($x, $path . '.' . $k, $out);
        }
    } elseif (is_array($v)) {
        $out[$path]['list'] = true;
        foreach ($v as $x) {
            shape($x, $path . '[]', $out);
        }
    } elseif ($v === null) {
        $out[$path]['null'] = true;
    } elseif (is_bool($v)) {
        $out[$path]['boolean'] = true;
    } elseif (is_int($v) || is_float($v)) {
        $out[$path]['number'] = true;
    } else {
        $out[$path]['string'] = true;
    }
    return $out;
}

function shapeDiff($mock, $got)
{
    $a = shape(json_decode(json_encode($mock)));
    $b = shape(json_decode(json_encode($got)));
    $diff = [];
    foreach (array_unique(array_merge(array_keys($a), array_keys($b))) as $p) {
        $ta = isset($a[$p]) ? array_keys($a[$p]) : [];
        $tb = isset($b[$p]) ? array_keys($b[$p]) : [];
        sort($ta);
        sort($tb);
        if ($ta !== $tb) {
            $diff[] = $p . ' mock ' . ($ta ? implode('|', $ta) : '—') . ' / ours ' . ($tb ? implode('|', $tb) : '—');
        }
    }
    return $diff;
}

$mocks = [
    // mock => [viewer, action, id, status, state user/role/state]
    'athlete-normal' => [3, 'athlete', null, 200, null],
    'athlete-new' => [4, 'athlete', null, 200, null],
    'athlete-friend' => [5, 'athlete', 3, 200, null],
    'athlete-hidden' => [5, 'athlete', 6, 403, null],
    'athlete-levelup' => [3, 'athlete', null, 200, [3, 'a', 'levelup']],
    'athlete-rankup' => [3, 'athlete', null, 200, [3, 'a', 'rankup']],
    'athlete-profile' => [3, 'widget', null, 200, null],
    'coach-normal' => [12, 'coach', null, 200, null],
    'coach-few' => [13, 'coach', null, 200, null],
    'coach-empty' => [14, 'coach', null, 200, null],
    'coach-public' => [5, 'coach', 12, 200, null],
    'coach-hidden' => [5, 'coach', 15, 403, null],
    'coach-levelup' => [12, 'coach', null, 200, [12, 'c', 'levelup']],
    'coach-rankup' => [12, 'coach', null, 200, [12, 'c', 'rankup']],
    'coach-profile' => [5, 'coach_widget', 12, 200, null],
];

$dir = dirname(__DIR__, 2) . '/contract/mock';
foreach ($mocks as $name => $m) {
    T::test("contract: $name", function () use ($dir, $name, $m) {
        $file = "$dir/$name.json";
        T::ok(is_file($file), "mock file $file");
        $mock = json_decode(file_get_contents($file));
        $site = site();
        if ($m[4]) {
            Setup::state($site[0], $m[4][0], $m[4][1], $m[4][2]);
        }
        list($status, $body) = call($site, $m[0], 'GET', ['action' => $m[1], 'id' => $m[2]]);
        if ($m[4]) {
            Setup::state($site[0], $m[4][0], $m[4][1], 'normal');
        }
        T::eq($m[3], $status, 'status');
        $diff = shapeDiff($mock, $body);
        T::ok(!$diff, "differs from the mock:\n          " . implode("\n          ", $diff));
        if ($m[4]) {
            $key = $m[4][2] === 'levelup' ? 'events' : 'rank_events';
            $open = array_values(array_filter($body[$key], function ($e) {
                return !$e['celebrated'];
            }));
            T::eq(1, count($open), "one $key to celebrate");
        }
    });
}
