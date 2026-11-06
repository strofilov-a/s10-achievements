<?php
// The distribution to send us: users per level of every achievement and per rank, athletes and coaches.
//   php cli/report.php [--out=achievements-report]   → achievements-report.md and achievements-report.csv
$app = require __DIR__ . '/_boot.php';
$args = ach_args();
$base = isset($args['out']) && $args['out'] !== true ? $args['out'] : 'achievements-report-' . $app->today();
list($md, $csv) = (new S10Ach\Jobs($app))->report();
file_put_contents($base . '.md', $md);
file_put_contents($base . '.csv', $csv);
ach_log("written $base.md and $base.csv");
