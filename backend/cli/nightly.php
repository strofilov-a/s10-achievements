<?php
// Cron, once a night: a full pass over everybody (streaks, months with a coach and other figures that move with the
// calendar), the rarity of every level, what optional data the site has.
$app = require __DIR__ . '/_boot.php';
$lock = ach_lock('nightly');
$t = microtime(true);
$r = (new S10Ach\Jobs($app))->nightly('ach_log');
ach_log("nightly: {$r['athletes']} athletes, {$r['coaches']} coaches, {$r['errors']} errors, " . round(microtime(true) - $t) . ' s');
exit($r['errors'] ? 1 : 0);
