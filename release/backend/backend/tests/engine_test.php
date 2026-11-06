<?php
// The pure parts: dates, texts, threshold crossing, the athlete data cleaner, the athlete and coach engines.

use S10Ach\Catalog;
use S10Ach\Engine\AthleteData;
use S10Ach\Engine\AthleteEngine;
use S10Ach\Engine\Boston;
use S10Ach\Engine\CoachEngine;
use S10Ach\Engine\D;
use S10Ach\Engine\Levels;
use S10Ach\Engine\Near;
use S10Ach\Engine\Text;

function cat()
{
    static $c = null;
    return $c ?: $c = new Catalog(ACH_LIB . '/catalog');
}

function runAt($id, $start, $km, $sec, array $o = [])
{
    return $o + ['id' => (string) $id, 'source' => 'garmin', 'start' => $start, 'km' => $km, 'sec' => $sec, 'track' => true, 'elev' => null, 'hr_easy' => null];
}

/** athlete items from raw Source answers */
function athleteItems(array $raw, $today = '2026-11-06')
{
    $d = AthleteData::build($raw, $today, 7);
    $all = [];
    foreach (cat()->all('a') as $e) {
        $all[$e['id']] = $e; // the disabled ones too (bq, majors…): the engine counts them all
    }
    return AthleteEngine::compute($d, $all, cat()->units(), Boston::load(ACH_LIB . '/data/boston.php'))['items'];
}

function coachItems(array $in)
{
    return CoachEngine::compute($in + ['today' => '2026-11-06', 'names' => [], 'replies' => null], cat()->entries('c'), cat(), null, null);
}

T::test('dates: day numbers, weeks, months', function () {
    foreach (['1970-01-01', '2000-02-29', '2024-12-31', '2026-11-06', '1899-03-01'] as $d) {
        T::eq($d, D::str(D::num($d)));
    }
    T::eq(0, D::num('1970-01-01'));
    T::eq(5, D::dow('2026-11-06'), 'a Friday');
    T::eq('2026-11-02', D::monday('2026-11-08'));
    T::eq('2024-02-29', D::addMonths('2024-01-31', 1));
    T::eq('2025-01-15', D::addMonths('2024-11-15', 2));
    T::eq(28, D::months('2024-05-15', '2026-10-14'));
    T::eq(29, D::months('2024-05-15', '2026-10-15'));
    T::eq(44, D::years('1982-06-01', '2026-10-12'));
});

T::test('texts: plural, numbers, times, ranges, initials', function () {
    $wk = ['неделя', 'недели', 'недель'];
    T::eq('неделя', Text::plural(1, $wk));
    T::eq('недели', Text::plural(3, $wk));
    T::eq('недель', Text::plural(12, $wk));
    T::eq('неделя', Text::plural(21, $wk));
    T::eq('недели', Text::plural(7.8, $wk));
    T::eq("4\u{a0}212", Text::num(4212));
    T::eq('7,8', Text::num(7.8));
    T::eq('42,2', Text::num(42.195));
    T::eq('18:58', Text::time(1138));
    T::eq('4:43:53', Text::time(17033));
    T::eq('08–14.09.2025', Text::range('2025-09-08', '2025-09-14'));
    T::eq('29.09–05.10.2025', Text::range('2025-09-29', '2025-10-05'));
    T::eq('А3', Text::initials('Атлет 3'));
    T::eq('Т', Text::initials('Тренер'));
});

T::test('levels: several thresholds crossed on one day all get that day', function () {
    $s = [['2024-01-01', 50], ['2024-02-01', 600], ['2024-03-01', 1200]];
    T::eq(['2024-02-01', '2024-02-01', '2024-03-01'], Levels::cross($s, [100, 500, 1000, 2500], 1));
    // direction -1: a time is good when it is at or under the threshold; worse results later change nothing
    $s = [['2021-01-01', 1900], ['2021-02-01', 1700], ['2021-03-01', 1750], ['2021-04-01', 1500]];
    T::eq(['2021-02-01', '2021-04-01', '2021-04-01'], Levels::cross($s, [1800, 1620, 1500, 1320], -1));
});

T::test('levels: a figure above the level without enough data is held back (coach gate)', function () {
    $s = [['2025-01-01', 90, 5], ['2025-02-01', 90, 15], ['2025-03-01', 50, 40]];
    T::eq(['2025-02-01', '2025-02-01', '2025-03-01', '2025-03-01'], Levels::cross($s, [20, 30, 40, 50], 1, [10, 10, 20, 40]));
    // the figure dropped below 50 by the time the data was enough: the 4th level waits
    T::eq(3, count(Levels::cross($s, [20, 30, 40, 60], 1, [10, 10, 20, 40])));
});

T::test('levels: stored levels kept, new ones appended, never dated before the level below', function () {
    T::eq(['2024-01-05', '2024-03-01', '2024-03-01'], Levels::merge(['2024-01-05', '2024-03-01'], ['2023-12-01', '2023-12-02', '2024-02-01']));
    T::eq(['2024-01-05'], Levels::merge(['2024-01-05'], []), 'nothing is taken away');
});

T::test('dedupe: the same run from Strava and Garmin counts once', function () {
    $raw = ['runs' => [
        runAt(1, '2026-10-01 07:00:00', 10.0, 3000),
        runAt('s1', '2026-10-01 07:02:00', 10.04, 3010, ['source' => 'strava', 'elev' => 40.0]),
        runAt(2, '2026-10-01 19:00:00', 10.0, 3100), // the same distance in the evening: another run
        runAt(3, '2026-10-02', 8.0, 2600, ['source' => 'strava']),
        runAt(4, '2026-10-02', 8.1, 2620, ['source' => 'garmin']), // no start time: similar distance and time
        runAt(1, '2026-10-01 07:00:00', 10.0, 3000), // imported twice
    ]];
    $d = AthleteData::build($raw, '2026-11-06');
    T::eq(3, count($d->runs));
    T::eq(40.0, $d->runs[0]['elev'], 'the merged run keeps the data of both');
    $items = athleteItems($raw);
    T::eq(28, $items['km_total']['value']);
    T::eq(3, $items['runs']['value']);
});

T::test('a run typed in by hand is no record, no elevation, no secret; it still counts for volume', function () {
    $raw = [
        'runs' => [runAt(1, '2026-03-01 08:00:00', 5.0, 900, ['track' => false, 'elev' => 900.0]), runAt(2, '2026-03-08 08:00:00', 170, 70000, ['track' => false])],
        'plan' => [['date' => '2026-03-01', 'type' => 6, 'km' => 5]],
    ];
    $items = athleteItems($raw);
    T::eq(null, $items['pr5']['value'], 'no 15:00 five from a manual entry');
    T::eq(0, $items['everest']['value']);
    T::eq([], $items['miles100']['dates']);
    T::eq(0, $items['longest']['value']);
    T::eq(175, $items['km_total']['value']);
    // the same run from a watch on a race day is a result
    $raw['runs'][0]['track'] = true;
    $items = athleteItems($raw);
    T::eq(900, $items['pr5']['value']);
    T::eq(['2026-03-01', '2026-03-01', '2026-03-01', '2026-03-01', '2026-03-01', '2026-03-01', '2026-03-01', '2026-03-01'], $items['pr5']['dates']);
});

T::test('a training run of 5.0x km is no 5 km record; a pace faster than the world record is not believed', function () {
    $items = athleteItems(['runs' => [runAt(1, '2026-03-01 08:00:00', 5.05, 1300), runAt(2, '2026-03-02 08:00:00', 10, 1200)]]);
    T::eq(null, $items['pr5']['value']);
    T::eq(5, $items['km_total']['value'], 'a 2:00/km ten is left out');
});

T::test('athlete: km thresholds crossed on one day, streaks, plan, records', function () {
    $runs = [runAt(1, '2026-01-05 07:00:00', 90, 32400), runAt(2, '2026-01-10 07:00:00', 300, 120000), runAt(3, '2026-01-10 18:00:00', 200, 80000)];
    $items = athleteItems(['runs' => $runs]);
    T::eq(['2026-01-10', '2026-01-10'], $items['km_total']['dates'], '100 and 500 km on one day');
    T::eq('500-й километр: 10.01.2026', $items['km_total']['last']);
    T::eq(1, count($items['two_a_day']['dates']));
    // weeks in a row with 3+ runs, the current week unfinished does not break the streak
    $runs = [];
    for ($w = 0; $w < 5; $w++) {
        foreach ([0, 2, 4] as $k) {
            $runs[] = runAt("w$w$k", D::add('2026-09-28', $w * 7 + $k) . ' 07:00:00', 6, 2000);
        }
    }
    $items = athleteItems(['runs' => $runs], '2026-11-03');
    T::eq(5, $items['weeks_streak']['value']);
    T::eq(['2026-10-09', '2026-10-23'], array_slice($items['weeks_streak']['dates'], 0, 2));
    T::eq(0, $items['days_streak']['value'], 'the last run 4 days ago: the series of days is over');
    // plan: a week with every planned day done
    $plan = [['date' => '2026-10-05', 'type' => 3, 'km' => 6], ['date' => '2026-10-07', 'type' => 1, 'km' => 6]];
    $items = athleteItems(['runs' => [runAt(1, '2026-10-05 07:00:00', 6, 2000), runAt(2, '2026-10-07 07:00:00', 5, 2000)], 'plan' => $plan]);
    T::eq(['2026-10-11'], $items['week_plan']['dates']);
    T::eq(1, $items['intervals']['value']);
    // a personal best improved: the first result is no improvement
    $races = [['date' => '2025-05-01', 'km' => 10, 'sec' => 3000], ['date' => '2025-09-01', 'km' => 10, 'sec' => 2900], ['date' => '2026-03-01', 'km' => 10, 'sec' => 2950]];
    $items = athleteItems(['races' => $races]);
    T::eq(2900, $items['pr10']['value']);
    T::eq(1, $items['new_pr']['value']);
    T::eq(['2025-05-01', '2025-05-01', '2025-05-01'], $items['pr10']['dates'], '50:00 is three levels at once');
});

T::test('athlete: secrets open on the right facts', function () {
    $items = athleteItems(['races' => [['date' => '2026-04-26', 'km' => 42, 'sec' => 10790, 'location' => 'BERLIN']], 'runs' => [runAt(1, '2026-05-01 23:40:00', 10, 3000)]]);
    T::eq(['2026-04-26'], $items['sub3']['dates']);
    T::eq(['2026-05-01'], $items['midnight']['dates']);
    T::eq([], $items['bq']['dates'], 'no birth date and sex: no Boston');
    $items = athleteItems(['races' => [['date' => '2026-04-26', 'km' => 42, 'sec' => 10900]], 'person' => ['birth' => '1980-01-01', 'sex' => 'm']]);
    T::eq([], $items['sub3']['dates'], '3:01:40 is not a sub-3');
    T::eq(['2026-04-26'], $items['bq']['dates'], '3:01:40 at 46 qualifies (3:15)');
});

T::test('near: the closest next level as a line for the coach', function () {
    $avail = cat()->entries('a');
    T::eq('Тысячник: Серебро, ещё 46 км', Near::text(cat(), ['km_year' => $avail['km_year']], ['km_year' => ['dates' => ['2026-06-14'], 'value' => 954]]));
    T::eq('Марафон: Чемпион, быстрее на 18:41', Near::text(cat(), ['pr42' => $avail['pr42']], ['pr42' => ['dates' => array_fill(0, 6, '2025-10-12'), 'value' => 10721]]));
    T::eq('Неделя по плану: Титан, ещё 3 недели', Near::text(cat(), ['week_plan' => $avail['week_plan']], ['week_plan' => ['dates' => array_fill(0, 4, '2026-01-01'), 'value' => 23]]));
});

T::test('coach: «Удержание» = student-months ÷ leaves; nobody left = infinite', function () {
    $c = coachItems(['stints' => [
        ['athlete_id' => 1, 'from' => '2025-01-01', 'to' => '2025-07-01'],  // 6 months, left: 6 months, 5 renewals
        ['athlete_id' => 2, 'from' => '2025-03-01', 'to' => null],          // still here: 20 months, 20 renewals
    ]]);
    T::eq(['n' => 26, 'x' => 25], $c['tenure']['data']);
    T::eq(26.0, (float) $c['tenure']['value']);
    T::eq(false, $c['tenure']['infinite']);
    $c = coachItems(['stints' => [['athlete_id' => 2, 'from' => '2025-03-01', 'to' => null], ['athlete_id' => 3, 'from' => '2026-05-01', 'to' => null]]]);
    T::eq(true, $c['tenure']['infinite']);
    T::eq(null, $c['tenure']['value']);
    T::eq(['n' => 26, 'x' => 26], $c['tenure']['data']);
    // infinite passes every threshold, the data decides: 26 months → base 6 × [1, 1, 1, 2, 4] → 5 levels
    T::eq(5, count($c['tenure']['dates']));
    // a student who stayed 40 days paid for a second month
    $c = coachItems(['stints' => [['athlete_id' => 1, 'from' => '2025-01-01', 'to' => '2025-02-10']]]);
    T::eq(['n' => 2, 'x' => 1], $c['tenure']['data']);
});

T::test('coach: a share above the level without enough data is held back', function () {
    $facts = [1 => ['tgt' => [['2026-06-01', '10', 2700, 2750]]]];
    $c = coachItems(['stints' => [['athlete_id' => 1, 'from' => '2026-01-01', 'to' => null]], 'facts' => $facts]);
    T::eq(100.0, (float) $c['goal']['value']);
    T::eq(['n' => 1, 'x' => 1], $c['goal']['data']);
    T::eq([], $c['goal']['dates'], 'one target race proves nothing: base 2');
    $facts[1]['tgt'][] = ['2026-09-01', '10', 2650, 2700];
    $c = coachItems(['stints' => [['athlete_id' => 1, 'from' => '2026-01-01', 'to' => null]], 'facts' => $facts]);
    T::eq(3, count($c['goal']['dates']), '2 races: Bronze to Gold (Platinum needs 4)');
    T::eq(['2026-09-01', '2026-09-01', '2026-09-01'], $c['goal']['dates']);
});

T::test('coach: a result counts only 8 weeks after the student came', function () {
    $facts = [1 => ['res' => [['2025-10-01', '10', 3000, null], ['2026-02-10', '10', 2900, null], ['2026-03-15', '10', 2850, null]],
        'tgt' => [['2026-02-10', '10', 2900, 3000], ['2026-03-15', '10', 2850, 2900]]]];
    $c = coachItems(['stints' => [['athlete_id' => 1, 'from' => '2026-01-01', 'to' => null]], 'facts' => $facts]);
    T::eq(['n' => 1, 'x' => 1], $c['goal']['data'], 'the race on day 40 is not the coach\'s');
    T::eq(['n' => 1, 'x' => 1], $c['pb']['data']);
    T::eq('2026-03-15', $c['pb']['dates'][0], 'the personal best of day 40 does not count, the one of day 73 does');
});

T::test('coach: «Саб 3» counts each student once, keeps those who left, not before 8 weeks', function () {
    $sub3 = function ($date, $sec) {
        return ['res' => [[$date, '42', $sec, null]]];
    };
    $c = coachItems(['stints' => [
        ['athlete_id' => 1, 'from' => '2024-03-01', 'to' => '2025-01-10'],
        ['athlete_id' => 2, 'from' => '2025-01-01', 'to' => null],
        ['athlete_id' => 3, 'from' => '2026-09-01', 'to' => null],
    ], 'facts' => [
        1 => ['res' => [['2024-10-13', '42', 10752, null], ['2024-12-01', '42', 10600, null]]],
        2 => $sub3('2026-10-12', 10721),
        3 => $sub3('2026-10-01', 10500), // 30 days with the coach: not his
    ], 'names' => [1 => 'Атлет 8', 2 => 'Атлет 1', 3 => 'Атлет 9']]);
    T::eq(2, count($c['sub3']['holders']));
    T::eq(['athlete' => 1, 'name' => 'Атлет 8', 'time' => '2:59:12', 'date' => '2024-10-13', 'left' => true], $c['sub3']['holders'][0]);
    T::eq(false, isset($c['sub3']['holders'][1]['left']));
    T::eq(['2024-10-13'], $c['sub3']['dates']);
    T::eq('Атлет 1, 2:58:41, 12.10.2026', $c['sub3']['last']);
});

T::test('coach: reply median, record period, months with students', function () {
    $c = coachItems(['stints' => [['athlete_id' => 1, 'from' => '2024-05-15', 'to' => null], ['athlete_id' => 2, 'from' => '2023-01-01', 'to' => '2023-03-01']],
        'names' => [1 => 'Атлет 1'], 'replies' => [
            ['report_at' => '2026-01-01 10:00:00', 'reply_at' => '2026-01-01 10:10:00'],
            ['report_at' => '2026-01-02 10:00:00', 'reply_at' => '2026-01-02 10:20:00'],
            ['report_at' => '2026-01-03 10:00:00', 'reply_at' => '2026-01-03 13:00:00'],
        ]]);
    T::eq(['n' => 3, 'v' => 20], $c['reply']['data']);
    T::eq(29, $c['longest']['value']);
    T::eq('Атлет 1, с мая 2024', $c['longest']['last']);
    T::eq(['2023-03-01', '2024-08-15'], array_slice($c['longest']['dates'], 0, 2), 'two months in 2023, three in 2024');
    T::eq(31, $c['exp']['value']);
    // nobody yet
    $c = coachItems(['stints' => []]);
    T::eq(null, $c['exp']['value']);
    T::eq(['n' => 0], $c['tenure']['data']);
});
