<?php
// Creates the 12 ach_* tables in the site's database through the site's own connection (S10Source::db()), so no
// password is needed; the existing tables are not touched. Safe to run again.   php cli/install.php
$app = require __DIR__ . '/_boot.php';
$pdo = $app->source()->db();
$n = 0;
foreach (preg_split('/;\s*\n/', S10Ach\Schema::mysql()) as $sql) {
    if (preg_match('/^\s*CREATE TABLE/mi', $sql)) {
        $pdo->exec($sql);
        $n++;
    }
}
$have = $pdo->query("SHOW TABLES LIKE 'ach\\_%'")->fetchAll(PDO::FETCH_COLUMN);
echo "ach_* tables: " . count($have) . " (" . implode(', ', $have) . ")\n";
exit(count($have) >= $n ? 0 : 1);
