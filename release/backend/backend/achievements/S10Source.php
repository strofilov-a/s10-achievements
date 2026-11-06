<?php
namespace S10Ach;

/**
 * THE file to fill in: where each piece of data lives on S10. Everything else is ready.
 *
 * Rules (the shapes are in Source.php, next to this file):
 *  - required methods throw TODO until filled: delete the throw line and write the SQL;
 *  - optional methods return null = «S10 has no such data»; the achievements that need it are then not shown.
 *    Fill one later and its achievements appear after the next nightly run;
 *  - return [] (not null) when the data exists but this user has none;
 *  - dates 'YYYY-MM-DD', date-times 'YYYY-MM-DD HH:MM:SS', Moscow time, as the site keeps them.
 * Check your work on the test server: php cli/check.php --user=ID (prints what each method returned).
 */
final class S10Source implements Source
{
    private $pdo;

    private static function todo($method)
    {
        return new \RuntimeException('S10Source::' . $method . '() is not filled in yet (achievements/S10Source.php)');
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

    // ---------- site ----------

    public function db()
    {
        if ($this->pdo === null) {
            // TODO: the site's PDO (the same database; our tables are ach_*), connection in utf8mb4. For example:
            //   require_once '/var/www/s10/config/db.php'; $this->pdo = $pdo;
            //   $this->pdo = new \PDO('mysql:host=localhost;dbname=s10;charset=utf8mb4', 'user', 'password');
            throw self::todo(__FUNCTION__);
        }
        return $this->pdo;
    }

    public function currentUserId()
    {
        // TODO: the logged-in user exactly as the other /apiweb/*.php files get him (the session cookie);
        // /apiweb/student/self/info/ answers null for the same visitor. For example:
        //   if (session_status() !== PHP_SESSION_ACTIVE) { session_start(); }
        //   return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
        throw self::todo(__FUNCTION__);
    }

    public function users(array $ids)
    {
        // TODO: display names as the site shows them (firstName + lastName of /apiweb/student/self/info/).
        //   $in = implode(',', array_fill(0, count($ids), '?'));
        //   foreach ($this->rows("SELECT id, first_name, last_name FROM users WHERE id IN ($in)", array_values($ids)) as $r) {
        //       $out[(int) $r['id']] = ['name' => trim($r['first_name'] . ' ' . $r['last_name'])];
        //   }
        if (!$ids) {
            return [];
        }
        throw self::todo(__FUNCTION__);
    }

    public function isCoach($userId)
    {
        // TODO: the user is a coach (role 'trainer' in /apiweb/student/self/info/, listed on /trainerlist).
        throw self::todo(__FUNCTION__);
    }

    public function isSubscriber($viewerId, $ownerId)
    {
        // TODO if S10 has subscriptions (followers); without them «Подписчики» means: only the athlete's coach.
        return false;
    }

    public function athleteIds()
    {
        // TODO: everybody with any runs, races or plan, e.g. SELECT DISTINCT user_id FROM <tracks>.
        throw self::todo(__FUNCTION__);
    }

    public function coachIds()
    {
        // TODO: every coach (the /trainerlist people).
        throw self::todo(__FUNCTION__);
    }

    public function changedUserIds($since)
    {
        // TODO: users whose data changed after unix time $since: new or edited tracks, diary days, planresults,
        // reports, coach links, payments… e.g. SELECT DISTINCT user_id FROM <tracks> WHERE updated_at > FROM_UNIXTIME(?)
        // UNION … Returning [] works too: then only the nightly run counts (once a day).
        throw self::todo(__FUNCTION__);
    }

    // ---------- athlete: required ----------

    public function runs($userId)
    {
        // TODO: the tracks behind the diary (/student → days[].tracks), running only (type 'run'; no rides, hikes).
        // Strava and Garmin copies of one run are fine: the engine merges them. Manual entries: 'track' => false.
        //   foreach ($this->rows('SELECT id, source, start_local, km, moving_sec, has_gps, elev_gain FROM <tracks>
        //                         WHERE user_id = ? AND type = ?', [$userId, 'run']) as $r) {
        //       $out[] = ['id' => $r['id'], 'source' => $r['source'], 'start' => $r['start_local'], 'km' => (float) $r['km'],
        //                 'sec' => (int) $r['moving_sec'], 'track' => (bool) $r['has_gps'],
        //                 'elev' => $r['elev_gain'] === null ? null : (float) $r['elev_gain'], 'hr_easy' => null];
        //   }
        // 'elev' (gain, m) and 'hr_easy' (the whole run in HR zones 1–2): null when unknown.
        throw self::todo(__FUNCTION__);
    }

    public function plan($userId)
    {
        // TODO: the diary days with a plan (/student → days[]: date, type = typtrain, target = planned km).
        // 'done' => null lets the engine decide (runs that day ≥ 80% of the planned km); give true/false if the site
        // marks a day done itself — needed for strength days, which have no km.
        //   SELECT d AS date, typtrain AS type, prekm AS km FROM <tasks> WHERE user_id = ? AND (typtrain > 0 OR prekm > 0)
        throw self::todo(__FUNCTION__);
    }

    public function races($userId)
    {
        // TODO: planresults (/apiweb/planresults.php?action=list): d → date, distance → km, realhms → sec (null when
        // not run yet), prehms → goal, location, 'main' => true for the target race of a master plan
        // (studentMainStart / main6 = 1).
        throw self::todo(__FUNCTION__);
    }

    public function coaches($athleteId)
    {
        // TODO: the athlete's paid periods with coaches: coach_id, from, to (null while he is still with him).
        // A student counts only after payment (TZ). History matters: «С тренером», and the coach's achievements.
        throw self::todo(__FUNCTION__);
    }

    public function students($coachId)
    {
        // TODO: the same periods seen from the coach: athlete_id, from, to|null. All of them, also those who left.
        throw self::todo(__FUNCTION__);
    }

    // ---------- athlete: optional (null = no such data on S10) ----------

    public function splits($userId)
    {
        // Optional: seconds of each full kilometre per track id. «Быстрый километр», «Ровный темп».
        return null;
    }

    public function masterPlans($userId)
    {
        // Optional: master plans [['from' => …, 'to' => race day], …] (studentPlans<ID> versions in userparam).
        // «Цикл до конца», the coach's «До конца».
        return null;
    }

    public function reports($userId)
    {
        // Optional: dates of the workout reports the athlete sent. «Отчёт о тренировке».
        return null;
    }

    public function ownWeeks($userId)
    {
        // Optional: Mondays of the weeks built by the athlete in «Создать неделю» (calc3 writes, task.php update).
        return null;
    }

    public function intervals($userId)
    {
        // Optional: interval sessions with the planned pace and each work lap's pace. «Снайпер».
        return null;
    }

    public function challenges($userId)
    {
        // Optional: S10 challenges (challenges.s10.run): date, name, place, neg_split. «Челленджи», «Пьедестал»,
        // «Негативный сплит» (neg_split null when the protocol has no splits).
        return null;
    }

    public function rating($userId)
    {
        // Optional: the overall S10 rating (challenges.s10.run/rating), the place in each season. «Топ рейтинга».
        return null;
    }

    public function tournament($userId)
    {
        // Optional: S10 tournament seasons and places. «Король турнира».
        return null;
    }

    public function posts($userId)
    {
        // Optional: dates of the user's posts in the feed. «Автор».
        return null;
    }

    public function likes($userId)
    {
        // Optional: dates of the likes the user's posts received. «Нравится».
        return null;
    }

    public function comments($userId)
    {
        // Optional: dates of the comments the user left. «Комментатор».
        return null;
    }

    public function referrals($userId)
    {
        // Optional: dates friends signed up by the user's link. «Привёл друга» (off in the catalog for now).
        return null;
    }

    public function cities($userId)
    {
        // Optional: cities run in (needs geocoding). «Города» (off in the catalog for now).
        return null;
    }

    public function clubSince($userId)
    {
        // Optional: 'YYYY-MM-DD' when the user joined an S10 club (profile), '' when he is in none.
        return null;
    }

    public function person($userId)
    {
        // Optional: ['birth' => 'YYYY-MM-DD'|null, 'sex' => 'm'|'f'|null] from the profile. «Бостон»,
        // the coach's «Уровень учеников» (also needs data/age-grade.php).
        return null;
    }

    public function forecast($userId)
    {
        // Optional: the S10 forecast in seconds [5 => …, 10 => …, 21 => …, 42 => …] (planresults t: paces per
        // distance × distance). Only a hint under the records.
        return null;
    }

    // ---------- coach: optional ----------

    public function replies($coachId)
    {
        // Optional: every report of the coach's students with the time of the coach's first answer of 20+ characters
        // (null if none): [['report_at' => …, 'reply_at' => …|null], …]. «На связи».
        return null;
    }
}
