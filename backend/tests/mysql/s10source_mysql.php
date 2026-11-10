<?php
// S10Source on a real MySQL with the site's real tables (not part of run.php: needs a MySQL server and the schema dump
// of the site, which is not in this repository).
//
//   S10_SCHEMA=/path/schema.sql MYSQL_HOST=127.0.0.1 MYSQL_PORT=3407 MYSQL_USER=root php backend/tests/mysql/s10source_mysql.php
//
// It builds a stand-in of the site's web root in a temp folder (p/mysqli.php with the same MysqliDb shape as the site,
// p/jwt.php with tokengetid()), creates a scratch database from the dump, puts in a coach, athletes and their data,
// and checks every method, then cli/check.php on the athlete and on the coach, the way the developer will run it.
define('ACH_LIB', dirname(__DIR__, 2) . '/achievements');
require ACH_LIB . '/bootstrap.php';

$schema = getenv('S10_SCHEMA');
if (!$schema || !is_file($schema)) {
    fwrite(STDERR, "S10_SCHEMA=<schema.sql of the site> is required\n");
    exit(2);
}
$H = getenv('MYSQL_HOST') ?: '127.0.0.1';
$P = (int) (getenv('MYSQL_PORT') ?: 3306);
$U = getenv('MYSQL_USER') ?: 'root';
$W = getenv('MYSQL_PASSWORD') ?: '';
$DB = 's10ach_test';

$fails = 0;
$n = 0;
function ok($cond, $name, $info = '')
{
    global $fails, $n;
    $n++;
    if (!$cond) {
        $fails++;
    }
    echo ($cond ? 'PASS  ' : 'FAIL  ') . $name . ($info !== '' && !$cond ? '  (' . $info . ')' : '') . "\n";
}

// ---- the database: the dump, then the data ----
$root = new PDO("mysql:host=$H;port=$P;charset=utf8mb4", $U, $W, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$root->exec("DROP DATABASE IF EXISTS $DB");
$root->exec("CREATE DATABASE $DB CHARACTER SET utf8mb4");
$cmd = sprintf('mysql -h%s -P%d -u%s %s %s < %s 2>&1', escapeshellarg($H), $P, escapeshellarg($U), $W !== '' ? '-p' . escapeshellarg($W) : '', $DB, escapeshellarg($schema));
exec($cmd, $out, $code);
ok($code === 0, 'the site schema loads', implode(' ', $out));

$db = new PDO("mysql:host=$H;port=$P;dbname=$DB;charset=utf8mb4", $U, $W, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

$COACH = 1000000101;
$A = 1000000201;        // athlete with a history
$B = 5000000301;        // an id above 2^32 (such accounts exist on S10)
$NEWC = 2000000001;     // a coach whose current student has no planned day yet
$NEWA = 2000000002;
$ins = function ($table, array $row) use ($db) {
    $cols = array_keys($row);
    $st = $db->prepare('INSERT INTO ' . $table . ' (`' . implode('`,`', $cols) . '`) VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')');
    $st->execute(array_values($row));
};
$ins('stravauser', ['id' => $COACH, 'firstname' => 'Тренер', 'lastname' => 'Первый', 'istrainer' => 1, 'curtrainer' => 0]);
$ins('stravauser', ['id' => $A, 'firstname' => ' Атлет ', 'lastname' => 'Один', 'istrainer' => 0, 'curtrainer' => $COACH, 'bday' => '1985-05-01', 'sex' => 'M']);
$ins('stravauser', ['id' => $B, 'firstname' => 'Атлет', 'lastname' => 'Большой', 'istrainer' => 0, 'curtrainer' => 0, 'sex' => '']);
$ins('stravauser', ['id' => $NEWC, 'firstname' => 'Тренер', 'lastname' => 'Новый', 'istrainer' => 1, 'curtrainer' => 0]);
$ins('stravauser', ['id' => $NEWA, 'firstname' => 'Ученик', 'lastname' => 'Новый', 'istrainer' => 0, 'curtrainer' => $NEWC]);
$ins('reqtrainer', ['stravauser' => $NEWA, 'trainer' => $NEWC, 'reqdt' => '2026-10-01 10:00:00', 'ansdt' => '2026-10-02 12:00:00', 'ans' => 2]);

$run = function ($user, $id, $start, $m, $sec, $elev) use ($ins) {
    $ins('stravadata', ['stravauser' => $user, 'id' => $id, 'id0' => md5($id), 'name' => 'Бег', 'distance' => $m, 'moving_time' => $sec,
        'elapsed_time' => $sec + 60, 'pace' => round($sec / 60 / ($m / 1000), 2), 'start_date' => $start, 'elevation' => $elev,
        'stravats' => '2026-11-10 08:00:00', 'json' => json_encode(['type' => 'run'])]);
};
$run($A, '16400000001', '2026-10-11 09:05:00', 21300, 5890, 120);      // Strava
$run($A, 'g20000001', '2026-10-11 09:05:10', 21290, 5885, 118);        // the same run from Garmin
$run($A, 'p30000001', '2026-11-01 06:30:00', 10000, 2950, 40);         // Polar, early morning
$run($B, '16400000099', '2026-11-02 19:00:00', 5000, 1500, 0);
$ins('activity2', ['stravauser' => $A, 'id' => 'g20000002', 'id0' => md5('g20000002'), 'typ' => 'ride', 'name' => 'Вело', 'distance' => 40000,
    'moving_time' => 4800, 'elapsed_time' => 5000, 'pace' => 2, 'start_date' => '2026-11-03 10:00:00']);

// the coach planned Jan–Mar, then a gap of 3+ months, then Jul–Nov (still with him); the athlete wrote one day himself
foreach (['2026-01-05', '2026-01-12', '2026-02-02', '2026-03-01', '2026-07-01', '2026-08-10', '2026-11-08'] as $d) {
    $ins('taskbytrainer', ['trainer' => $COACH, 'stravauser' => $A, 'd' => $d, 'task' => 'Интервалы 5×1 км', 'prekm' => '10', 'typtrain' => 3]);
}
$ins('taskbytrainer', ['trainer' => $A, 'stravauser' => $A, 'd' => '2026-06-01', 'task' => 'Легко', 'prekm' => '8,5', 'typtrain' => 1]);
$ins('taskbytrainer', ['trainer' => $COACH, 'stravauser' => $A, 'd' => '2026-10-11', 'task' => 'Полумарафон', 'prekm' => '21.1', 'typtrain' => 6, 'main6' => 1, 'prediction' => '1:40:00', 'location' => 'LISBON']);
$ins('taskbytrainer', ['trainer' => $COACH, 'stravauser' => $A, 'd' => '2026-09-01', 'task' => '', 'prekm' => '', 'typtrain' => 0]);   // empty day
$ins('taskbytrainer', ['trainer' => $COACH, 'stravauser' => $A, 'd' => '2026-09-02', 'task' => 'Силовая', 'prekm' => '', 'typtrain' => 7]);
// an athlete who left the coach in 2025
$ins('taskbytrainer', ['trainer' => $COACH, 'stravauser' => $B, 'd' => '2025-03-01', 'task' => 'Темп', 'prekm' => '12', 'typtrain' => 2]);
$ins('taskbytrainer', ['trainer' => $COACH, 'stravauser' => $B, 'd' => '2025-04-01', 'task' => 'Темп', 'prekm' => '12', 'typtrain' => 2]);

$ins('planresults', ['stravauser' => $A, 'typ' => 'manu', 'typ2' => 26, 'd' => '2026-10-11', 'distance' => 21, 'realhms' => 5890, 'prehms' => 6000, 'location' => 'LISBON']);
$ins('planresults', ['stravauser' => $A, 'typ' => 'manu', 'typ2' => 26, 'd' => '2026-12-06', 'distance' => 42, 'realhms' => null, 'prehms' => 12000, 'location' => 'VALENCIA']);
$ins('planresults', ['stravauser' => $A, 'typ' => 'auto', 'typ2' => 26, 'd' => '2026-11-01', 'distance' => 10, 'realhms' => 2950]);       // a best effort, not a race
$ins('planresults', ['stravauser' => $A, 'typ' => 'manu', 'typ2' => 25, 'd' => '2025-05-05', 'distance' => 5, 'realhms' => 1300, 'off' => 1]);   // hidden
$ins('report', ['stravauser' => $A, 'd' => '2026-10-11', 'report' => 'Отлично']);
$ins('blog', ['stravauser' => $A, 'd' => '2026-10-12', 'txt' => 'Мой полумарафон']);
$ins('socialuserlike', ['stravauser' => $B, 'activity' => '16400000001', 'activity0' => md5('16400000001'), 'created' => '2026-10-11 12:00:00', 'km' => 21]);
$ins('socialuserlike', ['stravauser' => $B, 'activity' => 'g20000002', 'activity0' => md5('g20000002'), 'created' => '2026-11-03 12:00:00', 'km' => 40]);
$ins('socialuserlike', ['stravauser' => $A, 'activity' => '16400000001', 'activity0' => md5('16400000001'), 'created' => '2026-10-11 13:00:00', 'km' => 21]);   // own like
$ins('socialcomment', ['stravauser' => $A, 'activity' => '16400000099', 'activity0' => md5('16400000099'), 'id' => 1, 'parent' => 0, 'parentuser' => $B, 'dt' => '2026-11-02 21:00:00', 'txt' => 'Молодец!']);
$ins('socialsubscribe', ['id1' => $B, 'id2' => $A, 'created' => '2026-10-01 00:00:00', 'typ' => 'one']);
$ins('planrun', ['stravauser' => $A, 'planid' => 1, 'plantmpl' => '', 'startdate' => '2026-07-01', 'stopdate' => '2026-10-11', 'startweek' => 1, 'totalweeks' => 15, 'onoff' => 1, 'plan' => '', 'weeksdate' => '']);

// ---- the stand-in of the site's web root ----
$site = sys_get_temp_dir() . '/s10site-' . getmypid();
@mkdir("$site/p", 0777, true);
@mkdir("$site/l", 0777, true);
file_put_contents("$site/l/MysqliDb.php", '<?php
class MysqliDb {   // the fields and constructor of the site\'s l/MysqliDb.php
    protected $host; protected $username; protected $password; protected $db; protected $port; protected $charset;
    public function __construct($host = null, $username = null, $password = null, $db = null, $port = null, $charset = "utf8") {
        if (is_array($host)) { foreach ($host as $key => $val) { $$key = $val; } }
        $this->host = $host; $this->username = $username; $this->password = $password; $this->db = $db; $this->port = $port; $this->charset = $charset;
    }
}');
file_put_contents("$site/p/mysqli.php", '<?php  // the site writes <? (short_open_tag is on there)
  require_once substr(dirname(__FILE__), 0, -1).\'l/MysqliDb.php\';
  $db=new MysqliDb([\'host\'=>' . var_export($H, true) . ', \'port\'=>' . $P . ', \'username\'=>' . var_export($U, true) . ', \'password\'=>' . var_export($W, true) . ', \'db\'=>\'' . $DB . '\', \'charset\'=>\'utf8mb4\']);
  function dbe () {}');
file_put_contents("$site/p/jwt.php", '<?php
  $jwt = new stdClass();
  function tokengetid () { global $jwt; return $jwt ? (int) @$_COOKIE[\'apptoken\'] : 0; }');
@mkdir("$site/apiweb", 0777, true);
copy(dirname(__DIR__, 1) . '/../apiweb/achievements.php', "$site/apiweb/achievements.php");

$s = new S10Ach\S10Source($site);
ok($s->db() instanceof PDO, 'db(): PDO from the site\'s own MysqliDb settings');
$_COOKIE['apptoken'] = (string) $A;
ok($s->currentUserId() === $A, 'currentUserId(): tokengetid() of the site', var_export($s->currentUserId(), true));
$_COOKIE['apptoken'] = '';
ok($s->currentUserId() === null, 'currentUserId(): null when logged out');

$u = $s->users([$A, $B, 999]);
ok(($u[$A]['name'] ?? '') === 'Атлет Один' && ($u[$B]['name'] ?? '') === 'Атлет Большой' && !isset($u[999]), 'users(): names, trimmed; ids above 2^32; missing left out', json_encode($u, JSON_UNESCAPED_UNICODE));
ok($s->isCoach($COACH) === true && $s->isCoach($A) === false && $s->isCoach(999) === false, 'isCoach()');
ok($s->isSubscriber($B, $A) === true && $s->isSubscriber($A, $B) === false, 'isSubscriber(): socialsubscribe id1 → id2');
$ath = $s->athleteIds();
ok(in_array($A, $ath, true) && in_array($B, $ath, true) && !in_array($NEWC, $ath, true), 'athleteIds(): with runs, plan or races', json_encode($ath));
ok(array_diff([$COACH, $NEWC], $s->coachIds()) === [], 'coachIds()');
$ch = $s->changedUserIds(strtotime('2026-11-10 07:00:00'));
ok(in_array($A, $ch, true), 'changedUserIds(): a run that came in after $since', json_encode($ch));

$runs = $s->runs($A);
$bySrc = array_column($runs, 'source', 'id');
ok(count($runs) === 3 && $bySrc === ['16400000001' => 'strava', 'g20000001' => 'garmin', 'p30000001' => 'polar'], 'runs(): runs only (the ride in activity2 left out), source from the id', json_encode($bySrc));
$r0 = array_values(array_filter($runs, function ($r) { return $r['id'] === '16400000001'; }))[0];
ok($r0['km'] === 21.3 && $r0['sec'] === 5890 && $r0['start'] === '2026-10-11 09:05:00' && $r0['elev'] === 120.0 && $r0['track'] === true, 'runs(): km from metres, moving time, local start, elevation', json_encode($r0));

$plan = $s->plan($A);
$pd = array_column($plan, null, 'date');
ok(!isset($pd['2026-09-01']), 'plan(): an empty day is not a plan');
ok(($pd['2026-06-01']['km'] ?? 0) === 8.5 && ($pd['2026-06-01']['type'] ?? 0) === 1, 'plan(): prekm text «8,5» → 8.5');
ok(($pd['2026-09-02']['type'] ?? 0) === 7 && ($pd['2026-09-02']['km'] ?? -1) === 0.0, 'plan(): a strength day without km kept (type 7)');
ok(($pd['2026-10-11']['type'] ?? 0) === 6, 'plan(): the race day');

$races = $s->races($A);
$rd = array_column($races, null, 'date');
ok(count($races) === 2 && isset($rd['2026-10-11'], $rd['2026-12-06']), 'races(): manu only, the auto best effort and the hidden one left out', json_encode(array_keys($rd)));
ok($rd['2026-10-11']['sec'] === 5890 && $rd['2026-10-11']['goal'] === 6000 && $rd['2026-10-11']['km'] === 21.0 && $rd['2026-10-11']['main'] === true && $rd['2026-10-11']['location'] === 'LISBON', 'races(): result, goal, distance, main6 from the plan');
ok($rd['2026-12-06']['sec'] === null && $rd['2026-12-06']['main'] === false, 'races(): a race not run yet has no result');

$co = $s->coaches($A);
ok($co === [
    ['coach_id' => $COACH, 'from' => '2026-01-05', 'to' => '2026-03-01'],
    ['coach_id' => $COACH, 'from' => '2026-07-01', 'to' => null],
], 'coaches(): periods rebuilt from the planned days, a gap over 62 days splits them, the current one open', json_encode($co));
$st = $s->students($COACH);
$byA = [];
foreach ($st as $p) {
    $byA[$p['athlete_id']][] = [$p['from'], $p['to']];
}
ok(($byA[$A] ?? null) === [['2026-01-05', '2026-03-01'], ['2026-07-01', null]], 'students(): the same periods seen from the coach', json_encode($byA[$A] ?? null));
ok(($byA[$B] ?? null) === [['2025-03-01', '2025-04-01']], 'students(): one who left is kept, closed', json_encode($byA[$B] ?? null));
ok($s->students($NEWC) === [['athlete_id' => $NEWA, 'from' => '2026-10-02', 'to' => null]], 'students(): a current student with no plan yet starts at the accepted request', json_encode($s->students($NEWC)));
ok($s->coaches($NEWA) === [['coach_id' => $NEWC, 'from' => '2026-10-02', 'to' => null]], 'coaches(): the same from the athlete', json_encode($s->coaches($NEWA)));

ok($s->masterPlans($A) === [['from' => '2026-07-01', 'to' => '2026-10-11']], 'masterPlans(): planrun');
ok($s->reports($A) === ['2026-10-11'], 'reports()');
ok($s->posts($A) === ['2026-10-12'], 'posts(): blog');
$likes = $s->likes($A);
sort($likes);
ok($likes === ['2026-10-11', '2026-11-03'], 'likes(): on the athlete\'s runs and other workouts, not his own', json_encode($likes));
ok($s->comments($A) === ['2026-11-02'], 'comments(): the ones he left');
ok($s->person($A) === ['birth' => '1985-05-01', 'sex' => 'm'] && $s->person($B) === ['birth' => null, 'sex' => null], 'person(): birth, sex m/f, unknown → null', json_encode($s->person($B)));
ok($s->runs(999) === [] && $s->plan(999) === [] && $s->races(999) === [] && $s->coaches(999) === [] && $s->students(999) === [], 'nobody: empty lists, not null');

// ---- the brief, step by step: the tables through the site's own connection, then the checks ----
$o = [];
exec('S10_SITE=' . escapeshellarg($site) . ' php ' . escapeshellarg(dirname(__DIR__, 2) . '/cli/install.php') . ' 2>&1', $o, $c);
ok($c === 0 && strpos(implode(' ', $o), 'ach_* tables: 12') !== false, 'cli/install.php: the 12 ach_* tables, no password needed', implode(' | ', $o));
exec('S10_SITE=' . escapeshellarg($site) . ' php ' . escapeshellarg(dirname(__DIR__, 2) . '/cli/install.php') . ' 2>&1', $o, $c);
ok($c === 0, 'cli/install.php again: nothing breaks');
$o = [];
exec(str_replace(escapeshellarg($schema), escapeshellarg(dirname(__DIR__, 2) . '/sql/achievements.sql'), $cmd), $o, $code);
ok($code === 0, 'sql/achievements.sql runs too (the same tables, for those who prefer SQL)', implode(' ', $o));
// ---- the developer's own check, as in the brief: cli/check.php with the site root in the env ----
$cli = dirname(__DIR__, 2) . '/cli/check.php';
foreach ([$A => 'athlete', $COACH => 'coach'] as $id => $who) {
    $o = [];
    exec('S10_SITE=' . escapeshellarg($site) . ' php ' . escapeshellarg($cli) . ' --user=' . $id . ' 2>&1', $o, $c);
    ok($c === 0 && strpos(implode("\n", $o), 'Ошибок нет') !== false, "cli/check.php --user=<$who>: «Ошибок нет»", implode(' | ', array_slice($o, -6)));
}

// ---- the rest of the brief on MySQL: history recount, the worker, the nightly run, the report ----
$tmp = sys_get_temp_dir() . '/s10rep-' . getmypid();
@mkdir($tmp);
foreach (['recalc.php --history', 'recalc.php --history', 'worker.php', 'nightly.php', 'report.php'] as $step) {
    $o = [];
    exec('cd ' . escapeshellarg($tmp) . ' && S10_SITE=' . escapeshellarg($site) . ' php ' . escapeshellarg(dirname(__DIR__, 2) . '/cli/' . strtok($step, ' ')) . ' ' . (string) substr($step, strlen(strtok($step, ' '))) . ' 2>&1', $o, $c);
    ok($c === 0 && !preg_match('/Fatal|Exception|SQLSTATE/', implode("\n", $o)), "cli/$step", implode(' | ', array_slice($o, -4)));
}
$lv = (int) $db->query('SELECT COUNT(*) FROM ach_level')->fetchColumn();
ok($lv > 0, 'levels written for the history (ach_level)', (string) $lv);
ok((int) $db->query('SELECT COUNT(*) FROM ach_notification')->fetchColumn() === 0, 'the history recount sends no notifications');
ok(count(glob($tmp . '/achievements-report-*')) === 2, 'report.php: the .md and the .csv', implode(' ', glob($tmp . '/*')));
array_map('unlink', glob($tmp . '/*'));

$root->exec("DROP DATABASE IF EXISTS $DB");
array_map('unlink', glob("$site/*/*"));
echo "\nmysql: " . ($n - $fails) . " passed, $fails failed\n";
exit($fails ? 1 : 0);
