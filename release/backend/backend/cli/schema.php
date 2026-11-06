<?php
// Prints the MySQL tables: php cli/schema.php > sql/achievements.sql (no database needed).
if (PHP_SAPI !== 'cli') {
    exit;
}
define('ACH_LIB', getenv('ACH_LIB') ?: dirname(__DIR__) . '/achievements');
require ACH_LIB . '/bootstrap.php';
echo S10Ach\Schema::mysql();
