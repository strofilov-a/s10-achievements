<?php
namespace S10Ach\Tests;

use S10Ach\App;
use S10Ach\Engine\D;
use S10Ach\Schema;

// Builds the fixture site the way the real one will be launched: the history counted once (celebrated, no
// notifications), then the last weeks as ordinary recounts (events and notifications), then what people set by hand.
final class Setup
{
    public static function load()
    {
        if (!defined('ACH_LIB')) {
            define('ACH_LIB', dirname(__DIR__, 2) . '/achievements');
        }
        require_once ACH_LIB . '/bootstrap.php';
        require_once __DIR__ . '/World.php';
        require_once __DIR__ . '/FixtureSource.php';
    }

    /** @return array [App, FixtureSource] over a fresh SQLite database */
    public static function app(World $w, $file = ':memory:', array $config = [])
    {
        $pdo = new \PDO('sqlite:' . $file);
        $pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        Schema::createSqlite($pdo);
        $src = new FixtureSource($w, $pdo);
        $app = new App($src, $config + [
            'today' => $w->today,
            'secret' => 'fixture-secret',
            'age_grade_file' => __DIR__ . '/age-grade-test.php',
        ]);
        return [$app, $src];
    }

    /** the day before the last rank-up of each user that must get a rank notification (and at least 30 days back) */
    public static function cut(World $w, array $config = [])
    {
        list($probe) = self::app($w, ':memory:', $config);
        $probe->recalc()->all('history');
        $cut = D::add($w->today, -30);
        foreach ([[3, 'a'], [12, 'c'], [13, 'c']] as $x) {
            $days = $probe->store()->rankDays($x[0], $x[1]);
            if ($days) {
                $cut = min($cut, D::add(max($days), -1));
            }
        }
        return $cut;
    }

    public static function populate(App $app, FixtureSource $src, $cut = null)
    {
        $w = $src->w;
        $cut = $cut !== null ? $cut : self::cut($w, ['age_grade_file' => $app->config['age_grade_file']]);
        $store = $app->store();

        // the launch: history up to the cut
        $src->asOf = $cut;
        $app->setToday($cut);
        $app->recalc()->all('history');
        // then the site lives on: ordinary recounts with everything since
        $src->asOf = null;
        $app->setToday($w->today);
        $app->recalc()->all('normal');

        // what people chose
        $store->putSetting(6, ['audience' => 'me']);
        $store->putSetting(15, ['coach_audience' => 'me']);
        $store->putSetting(31, ['audience' => 'subs']);
        $store->putSetting(32, ['audience' => 'subs']);
        $store->putSetting(3, ['showcase' => ['pr10', 'longest', 'rank']]);
        foreach ([21 => 'yes', 22 => 'yes', 24 => 'yes', 25 => 'no', 27 => 'yes', 28 => 'yes'] as $aid => $st) {
            $store->putConsent(12, $aid, $st, '2026-06-01 10:00:00', '2026-06-02 10:00:00');
        }
        $store->putConsent(13, 31, 'no', '2026-08-01 10:00:00', '2026-08-02 10:00:00');
        $svc = $app->service();
        $svc->post('consent_request', ['athlete' => '3'], 12);
        $keys = [];
        $levels = $store->levelsFor([21, 22, 24], 'a');
        foreach ([[21, 'sub3'], [21, 'pr42'], [22, 'pr5'], [22, 'pr10'], [24, 'longest']] as $k) {
            if (!empty($levels[$k[0]][$k[1]]['dates'])) {
                $keys[] = $k[0] . '-' . $k[1];
            }
        }
        $r = $svc->post('coach_showcase', ['keys' => json_encode($keys)], 12);
        if ($r[0] !== 200) {
            throw new \RuntimeException('fixture showcase: ' . json_encode($r[1], JSON_UNESCAPED_UNICODE));
        }

        // every window seen; the bell read but for the two newest
        $pdo = $store->pdo();
        $pdo->exec('UPDATE ach_event SET celebrated = 1');
        $pdo->exec('UPDATE ach_rank_event SET celebrated = 1');
        $pdo->exec('UPDATE ach_notification SET unread = 0 WHERE id NOT IN (SELECT id FROM ach_notification n WHERE '
            . '(SELECT COUNT(*) FROM ach_notification m WHERE m.user_id = n.user_id AND m.role = n.role AND m.id > n.id) < 2)');

        $app->recalc()->rarity();
        return $cut;
    }

    /** states of the contract: normal, levelup (the newest level not celebrated), rankup (the newest rank) */
    public static function state(App $app, $uid, $role, $state)
    {
        $pdo = $app->store()->pdo();
        $st = $pdo->prepare('UPDATE ach_event SET celebrated = 1 WHERE user_id = ? AND role = ?');
        $st->execute([$uid, $role]);
        $st = $pdo->prepare('UPDATE ach_rank_event SET celebrated = 1 WHERE user_id = ? AND role = ?');
        $st->execute([$uid, $role]);
        if ($state === 'levelup') {
            $st = $pdo->prepare('UPDATE ach_event SET celebrated = 0 WHERE id = (SELECT id FROM ach_event WHERE user_id = ? AND role = ? ORDER BY day DESC, id DESC LIMIT 1)');
            $st->execute([$uid, $role]);
        } elseif ($state === 'rankup') {
            $st = $pdo->prepare('UPDATE ach_rank_event SET celebrated = 0 WHERE id = (SELECT id FROM ach_rank_event WHERE user_id = ? AND role = ? ORDER BY rank_idx DESC LIMIT 1)');
            $st->execute([$uid, $role]);
        }
    }
}
