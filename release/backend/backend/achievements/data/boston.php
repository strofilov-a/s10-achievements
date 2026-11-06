<?php
// Boston Marathon qualifying standards (B.A.A.) for the 2026 race on: qualifying window from 1 September 2024.
// Seconds, by age on race day; a result at or under the standard qualifies.
// VERIFY against baa.org before switching «Бостон» on: the B.A.A. revises them now and then.
// Used only together with the athletes' birth date and sex (S10Source::person); without them «Бостон» stays off.
return [
    'm' => [18 => 10500, 35 => 10800, 40 => 11100, 45 => 11700, 50 => 12000, 55 => 12600, 60 => 13800, 65 => 14700, 70 => 15600, 75 => 16500, 80 => 17400],
    'f' => [18 => 12300, 35 => 12600, 40 => 12900, 45 => 13500, 50 => 13800, 55 => 14400, 60 => 15600, 65 => 16500, 70 => 17400, 75 => 18300, 80 => 19200],
];
