<?php
// S10 achievements API: GET ?action=athlete|coach|widget|coach_widget&id=, POST FormData action=… (contract/API.md).
// Put this file into /apiweb/. The library folder «achievements» goes outside the web root (its catalog holds the
// secret achievements); if it lives elsewhere, change the path below. The database and the logged-in user come from
// the site itself (p/mysqli.php, p/jwt.php): nothing else to set.
define('ACH_LIB', dirname(__DIR__, 2) . '/achievements');
define('S10_SITE_ROOT', dirname(__DIR__));   // this file is <site root>/apiweb/achievements.php

require ACH_LIB . '/bootstrap.php';

S10Ach\Http::serve(S10Ach\App::fromConfig());
