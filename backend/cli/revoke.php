<?php
// Only for a moderator, for cheating (TZ: «Снятие уровня — только вручную, с записью в журнал»). Delete the fake runs
// on the site first, otherwise the next recount gives the level back.
//   php cli/revoke.php --user=ID --achievement=km_total [--level=N] [--role=a|c] --reason="…"
//   --level=N keeps the levels below N (default: takes all of them away)
$app = require __DIR__ . '/_boot.php';
$a = ach_args();
if (empty($a['user']) || empty($a['achievement']) || empty($a['reason']) || $a['reason'] === true) {
    fwrite(STDERR, "php cli/revoke.php --user=ID --achievement=ID [--level=N] [--role=a|c] --reason=\"…\"\n");
    exit(2);
}
$role = isset($a['role']) && $a['role'] === 'c' ? 'c' : 'a';
$keep = isset($a['level']) ? max(0, (int) $a['level'] - 1) : 0;
$n = $app->store()->revoke((int) $a['user'], $role, (string) $a['achievement'], $keep, (string) $a['reason']);
$role === 'c' ? $app->recalc()->coach((int) $a['user'], 'normal') : $app->recalc()->athlete((int) $a['user'], 'normal');
ach_log("levels taken away: $n (logged in ach_log)");
