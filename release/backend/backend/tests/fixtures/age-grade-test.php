<?php
// SYNTHETIC numbers for the tests only — not WMA factors. The shape is the one AgeGrade reads:
// sex => distance => [age => age-standard seconds]. Never copy into data/.
$open = ['m' => ['5' => 760, '10' => 1590, '21' => 3500, '42' => 7300], 'f' => ['5' => 840, '10' => 1760, '21' => 3900, '42' => 8100]];
$out = [];
foreach ($open as $sex => $dists) {
    foreach ($dists as $d => $sec) {
        for ($age = 15; $age <= 90; $age++) {
            $out[$sex][$d][$age] = round($sec * ($age <= 35 ? 1 : 1 + 0.0075 * ($age - 35)), 1);
        }
    }
}
return $out;
