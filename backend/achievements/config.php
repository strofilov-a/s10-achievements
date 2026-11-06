<?php
// Settings. The defaults work as they are: nothing here has to be filled in.
// The database connection and the session user live in S10Source.php.

return [
    // the site counts days in Moscow time
    'timezone' => 'Europe/Moscow',

    // catalog JSON files (athlete.json, coach.json, common.json); keep them out of the web root: secrets are inside
    'catalog_dir' => __DIR__ . '/catalog',

    // key for the opaque ids of closed secrets; empty = generated once and kept in ach_meta
    'secret' => '',

    // link to a student's achievements page in the coach's list ({id} = athlete id)
    'student_page' => '/achievements/athlete?id={id}',

    // typtrain code of a strength workout in the plan (to confirm on S10; 0..6 are known)
    'strength_type' => 7,

    // a coach whose student changed is recounted at most this often by the worker, seconds
    'coach_min_interval' => 3600,

    // how many notifications the bell gets
    'notifications_limit' => 50,

    // POST from other origins is refused; list extra allowed origins here, e.g. 'https://s10.run'
    'allowed_origins' => [],

    // optional tables; when a file is missing the dependent achievements switch off
    'age_grade_file' => __DIR__ . '/data/age-grade.php',
    'boston_file' => __DIR__ . '/data/boston.php',

    // fixed "today" (YYYY-MM-DD) for tests; leave null
    'today' => null,
];
