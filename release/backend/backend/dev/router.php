<?php
// Local backend on fixture data, for the frontend:
//   cd <project root> && php -S 127.0.0.1:8090 backend/dev/router.php
// then http://127.0.0.1:8090/dev/ lists the fixture users and states.
//   /apiweb/achievements.php      the real endpoint code on SQLite (backend/dev/var/dev.sqlite) and fixture data
//   ?as=ID (once, kept in a cookie) whose session it is; ?as=0 logs out
//   /apiweb/student/self/info/    a stand-in for the site's own endpoint (the header of the page asks it)
//   /dev/state?user=3&role=a&set=levelup|rankup|normal   flip a fixture user into a contract state
//   /dev/reset                    rebuild the database from scratch
// Any other path is a static file of the project root (the frontend), so the pages can run on the same origin.

$root = dirname(__DIR__);
define('ACH_LIB', $root . '/achievements');
require $root . '/tests/fixtures/Setup.php';
S10Ach\Tests\Setup::load();

use S10Ach\Tests\Setup;
use S10Ach\Tests\World;

$path = parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$isApi = $path === '/apiweb/achievements.php' || strpos($path, '/apiweb/student/self/info') === 0 || strpos($path, '/dev') === 0;
if (!$isApi) {
    return false; // a file of the project root
}

// other local origins (a frontend dev server on another port) may call with the cookie
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$localOrigin = $origin !== '' && preg_match('#^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$#', $origin);
if ($localOrigin) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    return true;
}

$var = __DIR__ . '/var';
if (!is_dir($var)) {
    mkdir($var, 0777, true);
}
$file = $var . '/dev.sqlite';
if ($path === '/dev/reset' && is_file($file)) {
    unlink($file);
}
$fresh = !is_file($file);
$w = World::build();
list($app, $src) = Setup::app($w, $file);
if ($localOrigin) {
    $app->config['allowed_origins'] = [$origin];
}
if ($fresh) {
    Setup::populate($app, $src);
}

// whose session
$as = isset($_GET['as']) ? $_GET['as'] : (isset($_COOKIE['ach_as']) ? $_COOKIE['ach_as'] : '3');
if (isset($_GET['as'])) {
    setcookie('ach_as', (string) $as, 0, '/');
}
$src->viewer = (int) $as > 0 ? (int) $as : null;

if ($path === '/apiweb/achievements.php') {
    S10Ach\Http::serve($app);
    return true;
}

if (strpos($path, '/apiweb/student/self/info') === 0) {
    header('Content-Type: application/json; charset=utf-8');
    $id = $src->viewer;
    if ($id === null || !isset($w->users[$id])) {
        echo 'null';
        return true;
    }
    $coach = null;
    foreach ($w->stints as $s) {
        if ($s['athlete_id'] === $id && $s['to'] === null) {
            $coach = $s['coach_id'];
        }
    }
    $parts = explode(' ', $w->users[$id]['name'], 2);
    echo json_encode(['id' => $id, 'firstName' => $parts[0], 'lastName' => isset($parts[1]) ? $parts[1] : '', 'role' => isset($w->coaches[$id]) ? 'trainer' : 'student',
        'isPremium' => true, 'currentTrainerId' => $coach, 'nowmsk' => strtotime($w->today . ' 12:00:00')], JSON_UNESCAPED_UNICODE);
    return true;
}

if ($path === '/dev/state') {
    $user = isset($_GET['user']) ? (int) $_GET['user'] : 3;
    $role = isset($_GET['role']) && $_GET['role'] === 'c' ? 'c' : 'a';
    $set = isset($_GET['set']) ? (string) $_GET['set'] : 'normal';
    Setup::state($app, $user, $role, $set);
    header('Location: /dev/');
    http_response_code(303);
    return true;
}

// /dev/ — the index
$h = function ($s) {
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
};
$rows = [
    [3, 'athlete', null, 'athlete-normal (self)'], [3, 'widget', null, 'athlete-profile (self)'], [4, 'athlete', null, 'athlete-new'],
    [5, 'athlete', 3, 'athlete-friend (5 views 3)'], [5, 'athlete', 6, 'athlete-hidden (5 views 6) → 403'], [12, 'coach', null, 'coach-normal'],
    [13, 'coach', null, 'coach-few'], [14, 'coach', null, 'coach-empty'], [5, 'coach', 12, 'coach-public (5 views 12)'],
    [5, 'coach', 15, 'coach-hidden (5 views 15) → 403'], [5, 'coach_widget', 12, 'coach-profile (5 views 12)'],
];
header('Content-Type: text/html; charset=utf-8');
echo '<!doctype html><meta charset="utf-8"><title>S10 achievements dev</title><style>body{font:15px/1.5 system-ui;margin:24px;max-width:900px}code{background:#f2f2f2;padding:1px 4px}td{padding:3px 10px 3px 0}</style>';
echo '<h1>S10 achievements, local backend</h1><p>Today on the fixture site: <b>' . $h($w->today) . '</b>. Session now: <b>' . $h($src->viewer === null ? 'logged out' : $src->viewer . ' ' . $w->users[$src->viewer]['name']) . '</b>. Database: <code>backend/dev/var/dev.sqlite</code> (<a href="/dev/reset">rebuild</a>).</p>';
echo '<h2>Contract states</h2><table>';
foreach ($rows as $r) {
    $q = 'action=' . $r[1] . ($r[2] ? '&id=' . $r[2] : '') . '&as=' . $r[0];
    echo '<tr><td>' . $h($r[3]) . '</td><td><a href="/apiweb/achievements.php?' . $h($q) . '"><code>/apiweb/achievements.php?' . $h($q) . '</code></a></td></tr>';
}
echo '</table><p>Level-up / rank-up windows: <a href="/dev/state?user=3&role=a&set=levelup">athlete 3 levelup</a> · <a href="/dev/state?user=3&role=a&set=rankup">athlete 3 rankup</a> · '
    . '<a href="/dev/state?user=12&role=c&set=levelup">coach 12 levelup</a> · <a href="/dev/state?user=12&role=c&set=rankup">coach 12 rankup</a> · '
    . '<a href="/dev/state?user=3&role=a&set=normal">athlete 3 normal</a> · <a href="/dev/state?user=12&role=c&set=normal">coach 12 normal</a></p>';
echo '<h2>Users</h2><table>';
foreach ($w->users as $id => $u) {
    echo '<tr><td>' . $id . '</td><td>' . $h($u['name']) . (isset($w->coaches[$id]) ? ' (coach)' : '') . '</td><td><a href="/dev/?as=' . $id . '">log in as</a></td></tr>';
}
echo '</table><p><a href="/dev/?as=0">log out</a> (the API answers 401).</p>';
return true;
