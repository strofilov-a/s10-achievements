<?php
// Recount achievements.
//   php cli/recalc.php --user=ID      one user (as an athlete, and as a coach if he is one)
//   php cli/recalc.php --all          everybody, new levels as usual (events and notifications)
//   php cli/recalc.php --history      ONCE at the launch: the whole history; events come already celebrated
//                                     and nobody gets notifications for old levels
$app = require __DIR__ . '/_boot.php';
$args = ach_args();
$t = microtime(true);
if (isset($args['user'])) {
    $uid = (int) $args['user'];
    $r = $app->recalc()->athlete($uid, 'auto');
    ach_log("athlete $uid: {$r['points']} points, rank {$r['rank']}, new levels {$r['new']}");
    if ($app->source()->isCoach($uid)) {
        $r = $app->recalc()->coach($uid, 'auto');
        ach_log("coach $uid: {$r['points']} points, rank {$r['rank']}, new levels {$r['new']}");
    }
} elseif (isset($args['all']) || isset($args['history'])) {
    $lock = ach_lock('recalc');
    $jobs = new S10Ach\Jobs($app);
    $r = isset($args['history']) ? $jobs->history('ach_log') : $app->recalc()->all('auto', 'ach_log');
    ach_log("done: {$r['athletes']} athletes, {$r['coaches']} coaches, {$r['errors']} errors, " . round(microtime(true) - $t) . ' s');
    exit($r['errors'] ? 1 : 0);
} else {
    fwrite(STDERR, "php cli/recalc.php --user=ID | --all | --history\n");
    exit(2);
}
