<?php
// Shared start of the cli scripts: command line only, the library found next to this folder (or ACH_LIB=…).
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
if (!defined('ACH_LIB')) {
    define('ACH_LIB', getenv('ACH_LIB') ?: dirname(__DIR__) . '/achievements');
}
require ACH_LIB . '/bootstrap.php';

function ach_args()
{
    $out = [];
    foreach (array_slice($GLOBALS['argv'], 1) as $a) {
        if (preg_match('/^--([a-z-]+)(?:=(.*))?$/', $a, $m)) {
            $out[$m[1]] = isset($m[2]) ? $m[2] : true;
        }
    }
    return $out;
}

function ach_log($msg)
{
    fwrite(STDERR, date('H:i:s') . ' ' . $msg . "\n");
}

// one copy at a time (cron may start the next before the last one ends)
function ach_lock($name)
{
    $f = fopen(sys_get_temp_dir() . '/s10-achievements-' . $name . '.lock', 'c');
    if (!$f || !flock($f, LOCK_EX | LOCK_NB)) {
        ach_log($name . ': already running');
        exit(0);
    }
    return $f;
}

return S10Ach\App::fromConfig();
