<?php
// Checks S10Source on one user: what each method returns, against the shapes in Source.php, and what the engine
// counts from it. Writes nothing.   php cli/check.php --user=ID
$app = require __DIR__ . '/_boot.php';
$args = ach_args();
if (empty($args['user'])) {
    fwrite(STDERR, "php cli/check.php --user=ID\n");
    exit(2);
}
list($bad, $lines) = (new S10Ach\Check($app))->user((int) $args['user']);
echo implode("\n", $lines), "\n";
exit($bad ? 1 : 0);
