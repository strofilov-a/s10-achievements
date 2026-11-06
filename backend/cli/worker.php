<?php
// Cron, every 5–10 minutes: recount the users whose data changed, then the coaches of those students.
$app = require __DIR__ . '/_boot.php';
$lock = ach_lock('worker');
$r = (new S10Ach\Jobs($app))->worker('ach_log');
if ($r['athletes'] || $r['coaches'] || $r['errors']) {
    ach_log("worker: {$r['athletes']} athletes, {$r['coaches']} coaches, {$r['errors']} errors");
}
exit($r['errors'] ? 1 : 0);
