<?php
namespace S10Ach;

/**
 * Where each piece of data lives on S10: filled in by us from the site's schema (export of 10.11.2026), nothing to edit.
 *
 * The connection and the logged-in user come from the site's own files, so there is no password to copy:
 *  - db(): the settings of the site's MysqliDb ($db from p/mysqli.php), opened as PDO in utf8mb4;
 *  - currentUserId(): tokengetid() from p/jwt.php, the same apptoken cookie every /apiweb/*.php reads.
 * The site root is found by itself (see root()); set 'site_root' in config.php only if it is not.
 *
 * Shapes are in Source.php. Optional methods returning null = «no such data on S10»: those achievements stay hidden.
 * Check: php cli/check.php --user=ID (prints what each method returned, writes nothing).
 */
final class S10Source implements Source
{
    /** a coaching period ends after this many days with no planned day by that coach */
    const GAP_DAYS = 62;

    private $pdo;
    private $root;

    public function __construct($siteRoot = null)
    {
        $this->root = $siteRoot;
    }

    // ---------- helpers ----------

    private function rows($sql, array $args = [])
    {
        $st = $this->db()->prepare($sql);
        $st->execute($args);
        return $st->fetchAll(\PDO::FETCH_ASSOC);
    }

    private function col($sql, array $args = [])
    {
        $st = $this->db()->prepare($sql);
        $st->execute($args);
        return $st->fetchAll(\PDO::FETCH_COLUMN);
    }

    private static function ids(array $list)
    {
        return array_values(array_unique(array_map('intval', $list)));
    }

    /**
     * The site's web root: S10_SITE_ROOT (set by apiweb/achievements.php, which lives in <root>/apiweb), else
     * config 'site_root', else the env S10_SITE, else the one folder next to this library holding apiweb/achievements.php.
     */
    public function root()
    {
        if ($this->root) {
            return rtrim($this->root, '/');
        }
        if (defined('S10_SITE_ROOT')) {
            return $this->root = S10_SITE_ROOT;
        }
        if (getenv('S10_SITE')) {
            return $this->root = rtrim(getenv('S10_SITE'), '/');
        }
        $found = glob(dirname(__DIR__) . '/*/apiweb/achievements.php') ?: [];
        if (count($found) === 1) {
            return $this->root = dirname(dirname($found[0]));
        }
        throw new \RuntimeException("S10 site root not found: set 'site_root' in achievements/config.php");
    }

    // ---------- site ----------

    public function db()
    {
        if ($this->pdo === null) {
            // the site's own MysqliDb when the site is already loaded in this process, else p/mysqli.php read alone
            $m = isset($GLOBALS['db']) && is_a($GLOBALS['db'], 'MysqliDb') ? $GLOBALS['db'] : null;
            if (!$m) {
                $m = (static function ($file) {
                    require $file;          // p/mysqli.php: $db = new MysqliDb([...]) (connects lazily)
                    return isset($db) ? $db : null;
                })($this->root() . '/p/mysqli.php');
            }
            if (!is_a($m, 'MysqliDb')) {
                throw new \RuntimeException('S10 p/mysqli.php gave no MysqliDb $db');
            }
            $get = function ($name) use ($m) {
                $p = new \ReflectionProperty($m, $name);
                if (PHP_VERSION_ID < 80100) {
                    $p->setAccessible(true);   // needed before 8.1, deprecated in 8.5
                }
                return $p->getValue($m);
            };
            $host = (string) $get('host');
            $dsn = 'mysql:dbname=' . $get('db') . ';charset=utf8mb4;'
                . ($host !== '' && $host[0] === '/' ? 'unix_socket=' . $host : 'host=' . $host . ($get('port') ? ';port=' . (int) $get('port') : ''));
            $this->pdo = new \PDO($dsn, $get('username'), $get('password'), [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        }
        return $this->pdo;
    }

    public function currentUserId()
    {
        if (!function_exists('tokengetid')) {
            $jwt = (static function ($file) {
                require_once $file;         // p/jwt.php: $jwt and tokenset()/tokengetid(), which read global $jwt
                return isset($jwt) ? $jwt : null;
            })($this->root() . '/p/jwt.php');
            if ($jwt && !isset($GLOBALS['jwt'])) {
                $GLOBALS['jwt'] = $jwt;
            }
        }
        $id = function_exists('tokengetid') ? (int) \tokengetid() : 0;
        return $id > 0 ? $id : null;
    }

    public function users(array $ids)
    {
        $ids = self::ids($ids);
        if (!$ids) {
            return [];
        }
        $out = [];
        $in = implode(',', array_fill(0, count($ids), '?'));
        foreach ($this->rows("SELECT id, firstname, lastname FROM stravauser WHERE id IN ($in)", $ids) as $r) {
            $out[(int) $r['id']] = ['name' => trim(trim((string) $r['firstname']) . ' ' . trim((string) $r['lastname']))];
        }
        return $out;
    }

    public function isCoach($userId)
    {
        return (bool) ($this->col('SELECT istrainer FROM stravauser WHERE id = ?', [(int) $userId])[0] ?? 0);
    }

    public function isSubscriber($viewerId, $ownerId)
    {
        // socialsubscribe: id1 follows id2 (typ one | dbl), apiapp/social_lib.php:4
        return (bool) $this->col('SELECT 1 FROM socialsubscribe WHERE id1 = ? AND id2 = ? LIMIT 1', [(int) $viewerId, (int) $ownerId]);
    }

    public function athleteIds()
    {
        return self::ids($this->col(
            'SELECT stravauser FROM stravadata GROUP BY stravauser
             UNION SELECT stravauser FROM taskbytrainer GROUP BY stravauser
             UNION SELECT stravauser FROM planresults GROUP BY stravauser'
        ));
    }

    public function coachIds()
    {
        return self::ids($this->col('SELECT id FROM stravauser WHERE istrainer = 1'));
    }

    public function changedUserIds($since)
    {
        // indexed columns only (stravadata.ts is an invisible index): stravats = when a run came in
        $t = (int) $since;
        return self::ids($this->col(
            'SELECT stravauser FROM stravadata WHERE stravats > FROM_UNIXTIME(?)
             UNION SELECT stravauser FROM taskbytrainer WHERE ts > FROM_UNIXTIME(?)
             UNION SELECT stravauser FROM report WHERE ts > FROM_UNIXTIME(?)',
            [$t, $t, $t]
        ));
    }

    // ---------- athlete: required ----------

    public function runs($userId)
    {
        // stravadata holds runs only (Strava Run/Wheelchair, Garmin and Polar running types; the rest goes to activity2):
        // distance in metres, moving_time in seconds, start_date local, elevation = gain in m. Ids: Strava numeric,
        // Garmin «g…», Polar «p…», COROS «c…». Every run comes from a device or service, so all have a track.
        $src = ['g' => 'garmin', 'p' => 'polar', 'c' => 'coros'];
        $out = [];
        foreach ($this->rows('SELECT id, start_date, distance, moving_time, elevation FROM stravadata WHERE stravauser = ?', [(int) $userId]) as $r) {
            $id = (string) $r['id'];
            $out[] = [
                'id' => $id,
                'source' => preg_match('/^\\d+$/', $id) ? 'strava' : ($src[strtolower($id[0] ?? '')] ?? 'other'),
                'start' => (string) $r['start_date'],
                'km' => round($r['distance'] / 1000, 3),
                'sec' => (int) $r['moving_time'],
                'track' => true,
                'elev' => $r['elevation'] === null ? null : (float) $r['elevation'],
                'hr_easy' => null,
            ];
        }
        return $out;
    }

    public function plan($userId)
    {
        // taskbytrainer: one row per (athlete, day); prekm is text («10», «10.5», «»)
        $out = [];
        foreach ($this->rows('SELECT d, typtrain, prekm FROM taskbytrainer WHERE stravauser = ?', [(int) $userId]) as $r) {
            $km = (float) str_replace(',', '.', (string) $r['prekm']);
            $type = (int) $r['typtrain'];
            if ($type > 0 || $km > 0) {
                $out[] = ['date' => (string) $r['d'], 'type' => $type, 'km' => $km, 'done' => null];
            }
        }
        return $out;
    }

    public function races($userId)
    {
        // planresults typ 'manu' = races (entered or built from the race day's task and report); 'auto' = best efforts
        // found in runs, not races. off = 1 hidden by the athlete. distance 1/5/10/21/42, realhms/prehms seconds.
        // The target race is the day with main6 = 1 in the plan.
        $out = [];
        foreach ($this->rows(
            "SELECT p.i, p.d, p.distance, p.realhms, p.prehms, p.location, t.main6
             FROM planresults p LEFT JOIN taskbytrainer t ON t.stravauser = p.stravauser AND t.d = p.d
             WHERE p.stravauser = ? AND p.typ = 'manu' AND p.off = 0",
            [(int) $userId]
        ) as $r) {
            $out[] = [
                'id' => (int) $r['i'],
                'date' => (string) $r['d'],
                'km' => (float) $r['distance'],
                'sec' => (int) $r['realhms'] > 0 ? (int) $r['realhms'] : null,
                'goal' => (int) $r['prehms'] > 0 ? (int) $r['prehms'] : null,
                'location' => (string) $r['location'],
                'main' => (int) $r['main6'] === 1,
            ];
        }
        return $out;
    }

    /**
     * S10 keeps only the current coach (stravauser.curtrainer), no history of links. The history is rebuilt from the
     * plan: taskbytrainer.trainer is the athlete's coach at the time each day was written (apiweb/task.php:39), so the
     * days a coach planned for an athlete are their time together. A gap of more than GAP_DAYS ends a period; the last
     * period of the current link stays open (to = null). A current link with no planned day yet starts when the coach
     * accepted the request (reqtrainer.ansdt). Payments are not required: coaches are often paid outside S10.
     * Rows: [other id, day], ordered by other id, then day.
     */
    private function periods(array $rows, array $current, $key)
    {
        $out = [];
        $by = [];
        foreach ($rows as $r) {
            $by[(int) $r['other']][] = (string) $r['d'];
        }
        $today = date('Y-m-d');
        foreach ($by as $other => $days) {
            $from = $prev = $days[0];
            foreach (array_slice($days, 1) as $d) {
                if ((strtotime($d) - strtotime($prev)) / 86400 > self::GAP_DAYS) {
                    $out[] = [$key => $other, 'from' => $from, 'to' => $prev];
                    $from = $d;
                }
                $prev = $d;
            }
            $open = array_key_exists($other, $current) && (strtotime($today) - strtotime($prev)) / 86400 <= self::GAP_DAYS;
            $out[] = [$key => $other, 'from' => $from, 'to' => $open ? null : $prev];
            unset($current[$other]);
        }
        foreach ($current as $other => $since) {
            if ($since) {
                $out[] = [$key => $other, 'from' => substr($since, 0, 10), 'to' => null];
            }
        }
        return $out;
    }

    private function accepted($athleteId, $coachId)
    {
        return $this->col('SELECT MAX(ansdt) FROM reqtrainer WHERE stravauser = ? AND trainer = ? AND ansdt IS NOT NULL', [(int) $athleteId, (int) $coachId])[0] ?? null;
    }

    public function coaches($athleteId)
    {
        $a = (int) $athleteId;
        $current = [];
        $c = (int) ($this->col('SELECT curtrainer FROM stravauser WHERE id = ?', [$a])[0] ?? 0);
        if ($c > 0 && $c !== $a) {
            $current[$c] = $this->accepted($a, $c);
        }
        $rows = $this->rows('SELECT trainer AS other, d FROM taskbytrainer WHERE stravauser = ? AND trainer <> ? AND trainer > 0 ORDER BY trainer, d', [$a, $a]);
        return $this->periods($rows, $current, 'coach_id');
    }

    public function students($coachId)
    {
        $c = (int) $coachId;
        $current = [];
        foreach ($this->col('SELECT id FROM stravauser WHERE curtrainer = ? AND id <> ?', [$c, $c]) as $a) {
            $current[(int) $a] = null;
        }
        $rows = $this->rows('SELECT stravauser AS other, d FROM taskbytrainer WHERE trainer = ? AND stravauser <> ? ORDER BY stravauser, d', [$c, $c]);
        $planned = [];
        foreach ($rows as $r) {
            $planned[(int) $r['other']] = true;
        }
        foreach ($current as $a => $_) {
            if (!isset($planned[$a])) {
                $current[$a] = $this->accepted($a, $c);
            }
        }
        return $this->periods($rows, $current, 'athlete_id');
    }

    // ---------- athlete: optional ----------

    public function splits($userId)
    {
        return null;    // splits live in stravastreams per track; not read yet
    }

    public function masterPlans($userId)
    {
        // planrun: a master plan applied to the athlete (plan_set.php), startdate … stopdate (race week)
        $out = [];
        foreach ($this->rows('SELECT startdate, stopdate FROM planrun WHERE stravauser = ?', [(int) $userId]) as $r) {
            if ($r['startdate'] && $r['stopdate']) {
                $out[] = ['from' => (string) $r['startdate'], 'to' => (string) $r['stopdate']];
            }
        }
        return $out;
    }

    public function reports($userId)
    {
        return array_map('strval', $this->col('SELECT d FROM report WHERE stravauser = ?', [(int) $userId]));
    }

    public function ownWeeks($userId)
    {
        return null;    // calc3 writes through task.php like a coach: not told apart in taskbytrainer
    }

    public function intervals($userId)
    {
        return null;
    }

    public function challenges($userId)
    {
        return null;    // challenges.s10.run, another database
    }

    public function rating($userId)
    {
        return null;
    }

    public function tournament($userId)
    {
        return null;
    }

    public function posts($userId)
    {
        return array_map('strval', $this->col('SELECT d FROM blog WHERE stravauser = ?', [(int) $userId]));
    }

    public function likes($userId)
    {
        // «Нравится» on S10 is put on workouts (socialuserlike.activity0 = md5 id of the run or other activity)
        $u = (int) $userId;
        return array_map('strval', $this->col(
            'SELECT DATE(l.created) FROM socialuserlike l JOIN stravadata s ON s.id0 = l.activity0 WHERE s.stravauser = ? AND l.stravauser <> ?
             UNION ALL
             SELECT DATE(l.created) FROM socialuserlike l JOIN activity2 a ON a.id0 = l.activity0 WHERE a.stravauser = ? AND l.stravauser <> ?',
            [$u, $u, $u, $u]
        ));
    }

    public function comments($userId)
    {
        return array_map('strval', $this->col('SELECT DATE(dt) FROM socialcomment WHERE stravauser = ?', [(int) $userId]));
    }

    public function referrals($userId)
    {
        return null;
    }

    public function cities($userId)
    {
        return null;
    }

    public function clubSince($userId)
    {
        return null;    // clubs live on challenges.s10.run; stravauser.clubid has no join date
    }

    public function person($userId)
    {
        $r = $this->rows('SELECT bday, sex FROM stravauser WHERE id = ?', [(int) $userId])[0] ?? null;
        if (!$r) {
            return ['birth' => null, 'sex' => null];
        }
        $sex = strtolower((string) $r['sex']);
        $birth = (string) $r['bday'];
        return [
            'birth' => $birth !== '' && $birth !== '0000-00-00' && $birth > '1900-01-01' ? $birth : null,
            'sex' => in_array($sex, ['m', 'f'], true) ? $sex : null,
        ];
    }

    public function forecast($userId)
    {
        return null;
    }

    // ---------- coach: optional ----------

    public function replies($coachId)
    {
        return null;
    }
}
