<?php
// S10 achievements: library bootstrap. Include it, then use S10Ach\App::fromConfig().
// PHP 7.4+, PDO (MySQL/MariaDB on the site, SQLite in the tests). No Composer.

if (!defined('ACH_LIB')) {
    define('ACH_LIB', __DIR__);
}

spl_autoload_register(function ($class) {
    if (strpos($class, 'S10Ach\\') !== 0) {
        return;
    }
    $file = ACH_LIB . '/' . str_replace('\\', '/', substr($class, 7)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});
