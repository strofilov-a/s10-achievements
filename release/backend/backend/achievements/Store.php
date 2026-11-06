<?php
namespace S10Ach;

use PDO;

// All SQL on our own ach_ tables. Portable (MySQL/MariaDB and SQLite): prepared statements only,
// upserts as select-then-insert/update inside a transaction.
final class Store
{
    const J = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    private $db;
    private $now;
    private $depth = 0;

    /** @param callable $now returns 'YYYY-MM-DD HH:MM:SS' */
    public function __construct(PDO $db, callable $now)
    {
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->db = $db;
        $this->now = $now;
    }

    public function pdo()
    {
        return $this->db;
    }

    private function now()
    {
        return call_user_func($this->now);
    }

    private function q($sql, array $args = [])
    {
        $st = $this->db->prepare($sql);
        $st->execute(array_values($args));
        return $st;
    }

    private function rows($sql, array $args = [])
    {
        return $this->q($sql, $args)->fetchAll(PDO::FETCH_ASSOC);
    }

    private function row($sql, array $args = [])
    {
        $r = $this->q($sql, $args)->fetch(PDO::FETCH_ASSOC);
        return $r === false ? null : $r;
    }

    private static function in(array $ids)
    {
        return implode(',', array_fill(0, count($ids), '?'));
    }

    // at most $n characters (UTF-8), for VARCHAR columns in strict MySQL
    private static function cut($s, $n)
    {
        $s = (string) $s;
        return strlen($s) <= $n ? $s : (preg_match('/^.{0,' . (int) $n . '}/us', $s, $m) ? $m[0] : substr($s, 0, $n));
    }

    private static function json($v)
    {
        return json_encode($v, self::J);
    }

    private static function unjson($s, $default = null)
    {
        if ($s === null || $s === '') {
            return $default;
        }
        $v = json_decode($s, true);
        return $v === null ? $default : $v;
    }

    /** run $fn in one transaction (nested calls join the outer one) */
    public function tx(callable $fn)
    {
        if ($this->depth === 0 && !$this->db->inTransaction()) {
            $this->db->beginTransaction();
            $this->depth = 1;
            try {
                $r = $fn();
                $this->db->commit();
                $this->depth = 0;
                return $r;
            } catch (\Throwable $e) {
                $this->db->rollBack();
                $this->depth = 0;
                throw $e;
            }
        }
        return $fn();
    }

    // ---------- levels ----------

    private static function levelRow(array $r)
    {
        return [
            'level' => (int) $r['level'],
            'dates' => self::unjson($r['dates'], []),
            'value' => $r['value'] === null ? null : (float) $r['value'],
            'info' => self::unjson($r['info'], []),
        ];
    }

    /** [achievement => ['level', 'dates', 'value', 'info']] */
    public function levels($uid, $role)
    {
        $out = [];
        foreach ($this->rows('SELECT achievement, level, dates, value, info FROM ach_level WHERE user_id = ? AND role = ?', [$uid, $role]) as $r) {
            $out[$r['achievement']] = self::levelRow($r);
        }
        return $out;
    }

    /** [uid => [achievement => row]] */
    public function levelsFor(array $uids, $role)
    {
        $out = [];
        foreach (array_chunk(array_values(array_unique($uids)), 500) as $chunk) {
            $args = array_merge([$role], $chunk);
            foreach ($this->rows('SELECT user_id, achievement, level, dates, value, info FROM ach_level WHERE role = ? AND user_id IN (' . self::in($chunk) . ')', $args) as $r) {
                $out[(int) $r['user_id']][$r['achievement']] = self::levelRow($r);
            }
        }
        return $out;
    }

    public function putLevel($uid, $role, $ach, array $dates, $value, array $info)
    {
        $args = [count($dates), self::json(array_values($dates)), $value, $info ? self::json($info) : null, $this->now(), $uid, $role, $ach];
        $this->tx(function () use ($uid, $role, $ach, $args) {
            if ($this->row('SELECT 1 FROM ach_level WHERE user_id = ? AND role = ? AND achievement = ?', [$uid, $role, $ach])) {
                $this->q('UPDATE ach_level SET level = ?, dates = ?, value = ?, info = ?, updated_at = ? WHERE user_id = ? AND role = ? AND achievement = ?', $args);
            } else {
                $this->q('INSERT INTO ach_level (level, dates, value, info, updated_at, user_id, role, achievement) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', $args);
            }
        });
    }

    /** [achievement => [level => users with exactly that level]] for a role */
    public function levelCounts($role, $uids = null)
    {
        $out = [];
        foreach ($this->rows('SELECT user_id, achievement, level FROM ach_level WHERE role = ?', [$role]) as $r) {
            if ($uids !== null && !isset($uids[(int) $r['user_id']])) {
                continue;
            }
            $a = $r['achievement'];
            $l = (int) $r['level'];
            $out[$a][$l] = (isset($out[$a][$l]) ? $out[$a][$l] : 0) + 1;
        }
        return $out;
    }

    /** [achievement => [values…]] for the report; $uids = [uid => true] to count only them */
    public function values($role, $uids = null)
    {
        $out = [];
        foreach ($this->rows('SELECT user_id, achievement, value FROM ach_level WHERE role = ? AND value IS NOT NULL', [$role]) as $r) {
            if ($uids === null || isset($uids[(int) $r['user_id']])) {
                $out[$r['achievement']][] = (float) $r['value'];
            }
        }
        return $out;
    }

    // ---------- scores ----------

    public function score($uid, $role)
    {
        $r = $this->row('SELECT points, rank_idx, near, active_at, recalc_at FROM ach_score WHERE user_id = ? AND role = ?', [$uid, $role]);
        return $r ? ['points' => (int) $r['points'], 'rank' => (int) $r['rank_idx'], 'near' => (string) $r['near'], 'active_at' => $r['active_at'], 'recalc_at' => $r['recalc_at']] : null;
    }

    /** [uid => score] */
    public function scores(array $uids, $role)
    {
        $out = [];
        foreach (array_chunk(array_values(array_unique($uids)), 500) as $chunk) {
            foreach ($this->rows('SELECT user_id, points, rank_idx, near, active_at, recalc_at FROM ach_score WHERE role = ? AND user_id IN (' . self::in($chunk) . ')', array_merge([$role], $chunk)) as $r) {
                $out[(int) $r['user_id']] = ['points' => (int) $r['points'], 'rank' => (int) $r['rank_idx'], 'near' => (string) $r['near'], 'active_at' => $r['active_at'], 'recalc_at' => $r['recalc_at']];
            }
        }
        return $out;
    }

    /** every score of a role: [uid => score] */
    public function allScores($role)
    {
        $out = [];
        foreach ($this->rows('SELECT user_id, points, rank_idx, near, active_at, recalc_at FROM ach_score WHERE role = ?', [$role]) as $r) {
            $out[(int) $r['user_id']] = ['points' => (int) $r['points'], 'rank' => (int) $r['rank_idx'], 'near' => (string) $r['near'], 'active_at' => $r['active_at'], 'recalc_at' => $r['recalc_at']];
        }
        return $out;
    }

    public function putScore($uid, $role, $points, $rank, $near, $activeAt)
    {
        $args = [(int) $points, (int) $rank, self::cut($near, 250), $activeAt, $this->now(), $uid, $role];
        $this->tx(function () use ($uid, $role, $args) {
            if ($this->row('SELECT 1 FROM ach_score WHERE user_id = ? AND role = ?', [$uid, $role])) {
                $this->q('UPDATE ach_score SET points = ?, rank_idx = ?, near = ?, active_at = ?, recalc_at = ? WHERE user_id = ? AND role = ?', $args);
            } else {
                $this->q('INSERT INTO ach_score (points, rank_idx, near, active_at, recalc_at, user_id, role) VALUES (?, ?, ?, ?, ?, ?, ?)', $args);
            }
        });
    }

    // ---------- events ----------

    /** @return int|null the new event id, null when that level already has one */
    public function addEvent($uid, $role, $ach, $level, $day, $celebrated)
    {
        return $this->tx(function () use ($uid, $role, $ach, $level, $day, $celebrated) {
            if ($this->row('SELECT id FROM ach_event WHERE user_id = ? AND role = ? AND achievement = ? AND level = ?', [$uid, $role, $ach, $level])) {
                return null;
            }
            $this->q('INSERT INTO ach_event (user_id, role, achievement, level, day, celebrated, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [$uid, $role, $ach, $level, $day, $celebrated ? 1 : 0, $this->now()]);
            return (int) $this->db->lastInsertId();
        });
    }

    /** newest first */
    public function events($uid, $role, $limit = 30)
    {
        $out = [];
        $rows = $this->rows('SELECT id, achievement, level, day, celebrated FROM ach_event WHERE user_id = ? AND role = ? ORDER BY day DESC, id DESC LIMIT ' . (int) $limit, [$uid, $role]);
        foreach ($rows as $r) {
            $out[] = ['id' => (int) $r['id'], 'achievement' => $r['achievement'], 'level' => (int) $r['level'], 'date' => $r['day'], 'celebrated' => (bool) $r['celebrated']];
        }
        return $out;
    }

    public function addRankEvent($uid, $role, $rank, $day, $celebrated)
    {
        return $this->tx(function () use ($uid, $role, $rank, $day, $celebrated) {
            if ($this->row('SELECT id FROM ach_rank_event WHERE user_id = ? AND role = ? AND rank_idx = ?', [$uid, $role, $rank])) {
                return null;
            }
            $this->q('INSERT INTO ach_rank_event (user_id, role, rank_idx, day, celebrated, created_at) VALUES (?, ?, ?, ?, ?, ?)', [$uid, $role, $rank, $day, $celebrated ? 1 : 0, $this->now()]);
            return (int) $this->db->lastInsertId();
        });
    }

    /** [rank => date] */
    public function rankDays($uid, $role)
    {
        $out = [];
        foreach ($this->rows('SELECT rank_idx, day FROM ach_rank_event WHERE user_id = ? AND role = ?', [$uid, $role]) as $r) {
            $out[(int) $r['rank_idx']] = $r['day'];
        }
        return $out;
    }

    /** newest first */
    public function rankEvents($uid, $role)
    {
        $out = [];
        foreach ($this->rows('SELECT id, rank_idx, day, celebrated FROM ach_rank_event WHERE user_id = ? AND role = ? ORDER BY day DESC, rank_idx DESC', [$uid, $role]) as $r) {
            $out[] = ['id' => (int) $r['id'], 'rank' => (int) $r['rank_idx'], 'date' => $r['day'], 'celebrated' => (bool) $r['celebrated']];
        }
        return $out;
    }

    public function celebrate($uid, array $eventIds, array $rankIds)
    {
        $this->tx(function () use ($uid, $eventIds, $rankIds) {
            foreach (array_chunk($eventIds, 200) as $c) {
                $this->q('UPDATE ach_event SET celebrated = 1 WHERE user_id = ? AND id IN (' . self::in($c) . ')', array_merge([$uid], $c));
            }
            foreach (array_chunk($rankIds, 200) as $c) {
                $this->q('UPDATE ach_rank_event SET celebrated = 1 WHERE user_id = ? AND id IN (' . self::in($c) . ')', array_merge([$uid], $c));
            }
        });
    }

    // ---------- notifications ----------

    public function addNotification($uid, $role, $type, array $payload, $day, $ref = null)
    {
        $this->q('INSERT INTO ach_notification (user_id, role, type, payload, ref, day, unread, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)', [$uid, $role, $type, self::json($payload), $ref, $day, $this->now()]);
        return (int) $this->db->lastInsertId();
    }

    /** newest first: [['id', 'type', 'payload', 'date', 'unread']] */
    public function notifications($uid, $role, $limit = 50)
    {
        $out = [];
        foreach ($this->rows('SELECT id, type, payload, day, unread FROM ach_notification WHERE user_id = ? AND role = ? ORDER BY id DESC LIMIT ' . (int) $limit, [$uid, $role]) as $r) {
            $out[] = ['id' => (int) $r['id'], 'type' => $r['type'], 'payload' => self::unjson($r['payload'], []), 'date' => $r['day'], 'unread' => (bool) $r['unread']];
        }
        return $out;
    }

    public function dropNotifications($uid, $role, $type, $ref)
    {
        $this->q('DELETE FROM ach_notification WHERE user_id = ? AND role = ? AND type = ? AND ref = ?', [$uid, $role, $type, $ref]);
    }

    public function seen($uid, array $ids)
    {
        foreach (array_chunk($ids, 200) as $c) {
            $this->q('UPDATE ach_notification SET unread = 0 WHERE user_id = ? AND id IN (' . self::in($c) . ')', array_merge([$uid], $c));
        }
    }

    // ---------- settings ----------

    public function setting($uid)
    {
        $r = $this->row('SELECT audience, coach_audience, showcase, coach_showcase, name_format FROM ach_setting WHERE user_id = ?', [$uid]);
        return [
            'audience' => $r && $r['audience'] ? $r['audience'] : 'all',
            'coach_audience' => $r && $r['coach_audience'] ? $r['coach_audience'] : 'all',
            'showcase' => $r ? self::unjson($r['showcase'], []) : [],
            'coach_showcase' => $r ? self::unjson($r['coach_showcase'], []) : [],
            'name_format' => $r && $r['name_format'] ? $r['name_format'] : 'full',
        ];
    }

    /** [uid => setting] */
    public function settings(array $uids)
    {
        $out = [];
        foreach ($uids as $u) {
            $out[$u] = null;
        }
        foreach (array_chunk(array_values(array_unique($uids)), 500) as $chunk) {
            foreach ($this->rows('SELECT user_id, audience, coach_audience, showcase, coach_showcase, name_format FROM ach_setting WHERE user_id IN (' . self::in($chunk) . ')', $chunk) as $r) {
                $out[(int) $r['user_id']] = $r;
            }
        }
        foreach ($out as $u => $r) {
            $out[$u] = [
                'audience' => $r && $r['audience'] ? $r['audience'] : 'all',
                'coach_audience' => $r && $r['coach_audience'] ? $r['coach_audience'] : 'all',
                'showcase' => $r ? self::unjson($r['showcase'], []) : [],
                'coach_showcase' => $r ? self::unjson($r['coach_showcase'], []) : [],
                'name_format' => $r && $r['name_format'] ? $r['name_format'] : 'full',
            ];
        }
        return $out;
    }

    /** $fields: audience, coach_audience, showcase (array), coach_showcase (array), name_format */
    public function putSetting($uid, array $fields)
    {
        $cols = [];
        $args = [];
        foreach (['audience', 'coach_audience', 'showcase', 'coach_showcase', 'name_format'] as $k) {
            if (array_key_exists($k, $fields)) {
                $cols[] = $k;
                $args[] = is_array($fields[$k]) ? self::json(array_values($fields[$k])) : $fields[$k];
            }
        }
        if (!$cols) {
            return;
        }
        $this->tx(function () use ($uid, $cols, $args) {
            if ($this->row('SELECT 1 FROM ach_setting WHERE user_id = ?', [$uid])) {
                $set = implode(', ', array_map(function ($c) {
                    return "$c = ?";
                }, $cols));
                $this->q("UPDATE ach_setting SET $set, updated_at = ? WHERE user_id = ?", array_merge($args, [$this->now(), $uid]));
            } else {
                $this->q('INSERT INTO ach_setting (' . implode(', ', $cols) . ', updated_at, user_id) VALUES (' . self::in($cols) . ', ?, ?)', array_merge($args, [$this->now(), $uid]));
            }
        });
    }

    // ---------- consent ----------

    public function consent($coachId, $athleteId)
    {
        return $this->row('SELECT coach_id, athlete_id, status, asked_at, answered_at FROM ach_consent WHERE coach_id = ? AND athlete_id = ?', [$coachId, $athleteId]);
    }

    /** [athlete_id => row] */
    public function consentsOfCoach($coachId)
    {
        $out = [];
        foreach ($this->rows('SELECT coach_id, athlete_id, status, asked_at, answered_at FROM ach_consent WHERE coach_id = ?', [$coachId]) as $r) {
            $out[(int) $r['athlete_id']] = $r;
        }
        return $out;
    }

    public function putConsent($coachId, $athleteId, $status, $askedAt = null, $answeredAt = null)
    {
        $this->tx(function () use ($coachId, $athleteId, $status, $askedAt, $answeredAt) {
            $old = $this->consent($coachId, $athleteId);
            if ($old) {
                $this->q('UPDATE ach_consent SET status = ?, asked_at = ?, answered_at = ? WHERE coach_id = ? AND athlete_id = ?', [
                    $status, $askedAt !== null ? $askedAt : $old['asked_at'], $answeredAt !== null ? $answeredAt : $old['answered_at'], $coachId, $athleteId,
                ]);
            } else {
                $this->q('INSERT INTO ach_consent (coach_id, athlete_id, status, asked_at, answered_at) VALUES (?, ?, ?, ?, ?)', [$coachId, $athleteId, $status, $askedAt, $answeredAt]);
            }
        });
    }

    // ---------- rarity ----------

    /** [achievement => [pct per level]] */
    public function rarity($role)
    {
        $out = [];
        foreach ($this->rows('SELECT achievement, level, pct FROM ach_rarity WHERE role = ? ORDER BY achievement, level', [$role]) as $r) {
            $out[$r['achievement']][(int) $r['level'] - 1] = (float) $r['pct'];
        }
        return $out;
    }

    /** $map: [achievement => [pct per level]] replaces the role's rows */
    public function putRarity($role, array $map)
    {
        $this->tx(function () use ($role, $map) {
            $this->q('DELETE FROM ach_rarity WHERE role = ?', [$role]);
            foreach ($map as $ach => $pcts) {
                foreach (array_values($pcts) as $i => $p) {
                    $this->q('INSERT INTO ach_rarity (role, achievement, level, pct) VALUES (?, ?, ?, ?)', [$role, $ach, $i + 1, $p]);
                }
            }
        });
    }

    // ---------- facts for the coach ----------

    public function facts($uid)
    {
        $r = $this->row('SELECT facts FROM ach_fact WHERE user_id = ?', [$uid]);
        return $r ? self::unjson($r['facts'], null) : null;
    }

    /** [uid => facts] */
    public function factsFor(array $uids)
    {
        $out = [];
        foreach (array_chunk(array_values(array_unique($uids)), 300) as $chunk) {
            foreach ($this->rows('SELECT user_id, facts FROM ach_fact WHERE user_id IN (' . self::in($chunk) . ')', $chunk) as $r) {
                $out[(int) $r['user_id']] = self::unjson($r['facts'], []);
            }
        }
        return $out;
    }

    public function putFacts($uid, array $facts)
    {
        $json = self::json($facts);
        $this->tx(function () use ($uid, $json) {
            $old = $this->row('SELECT facts FROM ach_fact WHERE user_id = ?', [$uid]);
            if ($old && $old['facts'] === $json) {
                return;
            }
            if ($old) {
                $this->q('UPDATE ach_fact SET facts = ?, updated_at = ? WHERE user_id = ?', [$json, $this->now(), $uid]);
            } else {
                $this->q('INSERT INTO ach_fact (facts, updated_at, user_id) VALUES (?, ?, ?)', [$json, $this->now(), $uid]);
            }
        });
    }

    // ---------- queue ----------

    public function enqueue($uid, $role)
    {
        $this->tx(function () use ($uid, $role) {
            if (!$this->row('SELECT 1 FROM ach_queue WHERE user_id = ? AND role = ?', [$uid, $role])) {
                $this->q('INSERT INTO ach_queue (user_id, role, queued_at) VALUES (?, ?, ?)', [$uid, $role, $this->now()]);
            }
        });
    }

    /** [uid => queued_at] */
    public function queued($role, $limit = 5000)
    {
        $out = [];
        foreach ($this->rows('SELECT user_id, queued_at FROM ach_queue WHERE role = ? ORDER BY queued_at LIMIT ' . (int) $limit, [$role]) as $r) {
            $out[(int) $r['user_id']] = $r['queued_at'];
        }
        return $out;
    }

    public function dequeue($uid, $role)
    {
        $this->q('DELETE FROM ach_queue WHERE user_id = ? AND role = ?', [$uid, $role]);
    }

    // ---------- moderation ----------

    /** a moderator takes levels away (cheating): keep $keep levels, drop the events above, write the log */
    public function revoke($uid, $role, $ach, $keep, $reason)
    {
        return $this->tx(function () use ($uid, $role, $ach, $keep, $reason) {
            $r = $this->row('SELECT level, dates, value, info FROM ach_level WHERE user_id = ? AND role = ? AND achievement = ?', [$uid, $role, $ach]);
            if (!$r || (int) $r['level'] <= $keep) {
                return 0;
            }
            $row = self::levelRow($r);
            $dates = array_slice($row['dates'], 0, max(0, (int) $keep));
            $this->putLevel($uid, $role, $ach, $dates, $row['value'], $row['info']);
            $this->q('DELETE FROM ach_event WHERE user_id = ? AND role = ? AND achievement = ? AND level > ?', [$uid, $role, $ach, (int) $keep]);
            $this->q('INSERT INTO ach_log (user_id, role, achievement, from_level, to_level, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$uid, $role, $ach, (int) $r['level'], count($dates), self::cut($reason, 250), $this->now()]);
            return (int) $r['level'] - count($dates);
        });
    }

    // ---------- meta ----------

    public function meta($k, $default = null)
    {
        $r = $this->row('SELECT v FROM ach_meta WHERE k = ?', [$k]);
        return $r ? $r['v'] : $default;
    }

    public function putMeta($k, $v)
    {
        $this->tx(function () use ($k, $v) {
            if ($this->row('SELECT 1 FROM ach_meta WHERE k = ?', [$k])) {
                $this->q('UPDATE ach_meta SET v = ? WHERE k = ?', [$v, $k]);
            } else {
                $this->q('INSERT INTO ach_meta (k, v) VALUES (?, ?)', [$k, $v]);
            }
        });
    }
}
