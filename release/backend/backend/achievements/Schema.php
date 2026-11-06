<?php
namespace S10Ach;

// The ach_ tables, defined once. sql/achievements.sql is generated from here (php cli/schema.php > sql/achievements.sql);
// the tests create the same tables in SQLite. Column types are portable; 'AUTO' is the auto-increment key.
final class Schema
{
    public static function tables()
    {
        return [
            'ach_level' => [
                'comment' => 'Levels of each achievement per user: the dates of every reached level, the current value',
                'cols' => [
                    'user_id' => 'BIGINT NOT NULL',
                    'role' => "CHAR(1) NOT NULL", // a = athlete, c = coach
                    'achievement' => 'VARCHAR(32) NOT NULL',
                    'level' => 'TINYINT NOT NULL DEFAULT 0',
                    'dates' => 'VARCHAR(255) NOT NULL', // JSON list, one date per level
                    'value' => 'DOUBLE NULL',
                    'info' => 'MEDIUMTEXT NULL', // JSON: last, note, data, holders…
                    'updated_at' => 'DATETIME NULL',
                ],
                'pk' => ['user_id', 'role', 'achievement'],
                'index' => ['ach_level_stat' => ['role', 'achievement', 'level']],
            ],
            'ach_score' => [
                'comment' => 'Points and rank per user and role, ready for profiles and lists',
                'cols' => [
                    'user_id' => 'BIGINT NOT NULL',
                    'role' => 'CHAR(1) NOT NULL',
                    'points' => 'INT NOT NULL DEFAULT 0',
                    'rank_idx' => 'TINYINT NOT NULL DEFAULT 0',
                    'near' => 'VARCHAR(255) NULL',
                    'active_at' => 'CHAR(10) NULL',
                    'recalc_at' => 'DATETIME NULL',
                ],
                'pk' => ['user_id', 'role'],
                'index' => [],
            ],
            'ach_event' => [
                'comment' => 'Every reached level: «Последние полученные» and the level-up window',
                'cols' => [
                    'id' => 'AUTO',
                    'user_id' => 'BIGINT NOT NULL',
                    'role' => 'CHAR(1) NOT NULL',
                    'achievement' => 'VARCHAR(32) NOT NULL',
                    'level' => 'TINYINT NOT NULL',
                    'day' => 'CHAR(10) NOT NULL',
                    'celebrated' => 'TINYINT NOT NULL DEFAULT 0',
                    'created_at' => 'DATETIME NULL',
                ],
                'pk' => ['id'],
                'unique' => ['ach_event_one' => ['user_id', 'role', 'achievement', 'level']],
                'index' => ['ach_event_user' => ['user_id', 'role', 'day']],
            ],
            'ach_rank_event' => [
                'comment' => 'Every reached rank',
                'cols' => [
                    'id' => 'AUTO',
                    'user_id' => 'BIGINT NOT NULL',
                    'role' => 'CHAR(1) NOT NULL',
                    'rank_idx' => 'TINYINT NOT NULL',
                    'day' => 'CHAR(10) NOT NULL',
                    'celebrated' => 'TINYINT NOT NULL DEFAULT 0',
                    'created_at' => 'DATETIME NULL',
                ],
                'pk' => ['id'],
                'unique' => ['ach_rank_event_one' => ['user_id', 'role', 'rank_idx']],
                'index' => [],
            ],
            'ach_notification' => [
                'comment' => 'The bell',
                'cols' => [
                    'id' => 'AUTO',
                    'user_id' => 'BIGINT NOT NULL',
                    'role' => 'CHAR(1) NOT NULL',
                    'type' => 'VARCHAR(20) NOT NULL',
                    'payload' => 'TEXT NOT NULL', // JSON
                    'ref' => 'VARCHAR(64) NULL',
                    'day' => 'CHAR(10) NOT NULL',
                    'unread' => 'TINYINT NOT NULL DEFAULT 1',
                    'created_at' => 'DATETIME NULL',
                ],
                'pk' => ['id'],
                'index' => ['ach_notification_user' => ['user_id', 'role', 'id'], 'ach_notification_ref' => ['user_id', 'role', 'ref']],
            ],
            'ach_setting' => [
                'comment' => 'Who sees, the showcases, the name format in a coach showcase',
                'cols' => [
                    'user_id' => 'BIGINT NOT NULL',
                    'audience' => 'VARCHAR(10) NULL',
                    'coach_audience' => 'VARCHAR(10) NULL',
                    'showcase' => 'TEXT NULL',
                    'coach_showcase' => 'TEXT NULL',
                    'name_format' => 'VARCHAR(10) NULL',
                    'updated_at' => 'DATETIME NULL',
                ],
                'pk' => ['user_id'],
                'index' => [],
            ],
            'ach_consent' => [
                'comment' => 'A student lets his coach show his achievements: pending / yes / no',
                'cols' => [
                    'coach_id' => 'BIGINT NOT NULL',
                    'athlete_id' => 'BIGINT NOT NULL',
                    'status' => 'VARCHAR(10) NOT NULL',
                    'asked_at' => 'DATETIME NULL',
                    'answered_at' => 'DATETIME NULL',
                ],
                'pk' => ['coach_id', 'athlete_id'],
                'index' => ['ach_consent_athlete' => ['athlete_id']],
            ],
            'ach_rarity' => [
                'comment' => 'Share of active users with each level, counted at night',
                'cols' => [
                    'role' => 'CHAR(1) NOT NULL',
                    'achievement' => 'VARCHAR(32) NOT NULL',
                    'level' => 'TINYINT NOT NULL',
                    'pct' => 'DOUBLE NOT NULL',
                ],
                'pk' => ['role', 'achievement', 'level'],
                'index' => [],
            ],
            'ach_fact' => [
                'comment' => 'An athlete\'s results as the coach achievements read them (JSON), kept by the athlete recount',
                'cols' => [
                    'user_id' => 'BIGINT NOT NULL',
                    'facts' => 'MEDIUMTEXT NOT NULL',
                    'updated_at' => 'DATETIME NULL',
                ],
                'pk' => ['user_id'],
                'index' => [],
            ],
            'ach_queue' => [
                'comment' => 'Users to recount by the worker',
                'cols' => [
                    'user_id' => 'BIGINT NOT NULL',
                    'role' => 'CHAR(1) NOT NULL',
                    'queued_at' => 'DATETIME NULL',
                ],
                'pk' => ['user_id', 'role'],
                'index' => [],
            ],
            'ach_log' => [
                'comment' => 'Levels taken away by a moderator (cheating), with the reason',
                'cols' => [
                    'id' => 'AUTO',
                    'user_id' => 'BIGINT NOT NULL',
                    'role' => 'CHAR(1) NOT NULL',
                    'achievement' => 'VARCHAR(32) NOT NULL',
                    'from_level' => 'TINYINT NOT NULL',
                    'to_level' => 'TINYINT NOT NULL',
                    'reason' => 'VARCHAR(255) NOT NULL',
                    'created_at' => 'DATETIME NULL',
                ],
                'pk' => ['id'],
                'index' => ['ach_log_user' => ['user_id', 'role']],
            ],
            'ach_meta' => [
                'comment' => 'Small settings the code keeps: worker time, data seen on the site, the id key',
                'cols' => [
                    'k' => 'VARCHAR(64) NOT NULL',
                    'v' => 'TEXT NULL',
                ],
                'pk' => ['k'],
                'index' => [],
            ],
        ];
    }

    /** @param string $dialect 'mysql' | 'sqlite' @return string[] statements */
    public static function statements($dialect)
    {
        $out = [];
        foreach (self::tables() as $name => $t) {
            $lines = [];
            foreach ($t['cols'] as $col => $type) {
                if ($type === 'AUTO') {
                    $lines[] = $dialect === 'mysql' ? "  `$col` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT" : "  $col INTEGER PRIMARY KEY AUTOINCREMENT";
                    continue;
                }
                if ($dialect === 'sqlite') {
                    $type = str_replace('MEDIUMTEXT', 'TEXT', $type);
                }
                $lines[] = $dialect === 'mysql' ? "  `$col` $type" : "  $col $type";
            }
            $auto = in_array('AUTO', $t['cols'], true);
            if ($dialect === 'mysql' || !$auto) {
                $lines[] = '  PRIMARY KEY (' . self::cols($t['pk'], $dialect) . ')';
            }
            if ($dialect === 'mysql') {
                foreach (isset($t['unique']) ? $t['unique'] : [] as $k => $cols) {
                    $lines[] = "  UNIQUE KEY `$k` (" . self::cols($cols, $dialect) . ')';
                }
                foreach ($t['index'] as $k => $cols) {
                    $lines[] = "  KEY `$k` (" . self::cols($cols, $dialect) . ')';
                }
                $out[] = "-- {$t['comment']}\nCREATE TABLE IF NOT EXISTS `$name` (\n" . implode(",\n", $lines)
                    . "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
            } else {
                $out[] = "CREATE TABLE IF NOT EXISTS $name (\n" . implode(",\n", $lines) . "\n);";
                foreach (isset($t['unique']) ? $t['unique'] : [] as $k => $cols) {
                    $out[] = "CREATE UNIQUE INDEX IF NOT EXISTS $k ON $name (" . self::cols($cols, $dialect) . ');';
                }
                foreach ($t['index'] as $k => $cols) {
                    $out[] = "CREATE INDEX IF NOT EXISTS $k ON $name (" . self::cols($cols, $dialect) . ');';
                }
            }
        }
        return $out;
    }

    private static function cols(array $cols, $dialect)
    {
        return implode(', ', array_map(function ($c) use ($dialect) {
            return $dialect === 'mysql' ? "`$c`" : $c;
        }, $cols));
    }

    public static function mysql()
    {
        return "-- S10 achievements: tables. MySQL / MariaDB, utf8mb4, InnoDB. Safe to run again (IF NOT EXISTS).\n"
            . "-- Generated by cli/schema.php from achievements/Schema.php; edit there, not here.\n\n"
            . implode("\n\n", self::statements('mysql')) . "\n";
    }

    public static function createSqlite(\PDO $pdo)
    {
        foreach (self::statements('sqlite') as $sql) {
            $pdo->exec($sql);
        }
    }
}
