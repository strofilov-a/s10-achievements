<?php
// S10 achievements API: GET ?action=athlete|coach|widget|coach_widget&id=, POST FormData action=… (contract/API.md).
// Put this file into /apiweb/. The library folder «achievements» goes outside the web root (its catalog holds the
// secret achievements); if it lives elsewhere, change the path below. Nothing else to set here.
define('ACH_LIB', dirname(__DIR__, 2) . '/achievements');

require ACH_LIB . '/bootstrap.php';

S10Ach\Http::serve(S10Ach\App::fromConfig());
