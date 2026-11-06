<?php
// Recounts, the API and the rules around them, on the fixture site (SQLite).

use S10Ach\Check;
use S10Ach\Engine\D;
use S10Ach\Jobs;
use S10Ach\Schema;
use S10Ach\Tests\Setup;
use S10Ach\Tests\World;

// every ach_ row except the clocks
function snapshot(PDO $pdo)
{
    $out = [];
    foreach (Schema::tables() as $t => $def) {
        $cols = array_diff(array_keys($def['cols']), ['updated_at', 'created_at', 'recalc_at', 'queued_at']);
        if ($t === 'ach_meta') {
            continue; // the worker's clock lives there
        }
        $rows = $pdo->query('SELECT ' . implode(', ', $cols) . " FROM $t")->fetchAll(PDO::FETCH_ASSOC);
        $rows = array_map('json_encode', $rows);
        sort($rows);
        $out[$t] = $rows;
    }
    return $out;
}

function count_rows(PDO $pdo, $sql, array $args = [])
{
    $st = $pdo->prepare($sql);
    $st->execute($args);
    return (int) $st->fetchColumn();
}

// a small site with one athlete for the recount rules
function tiny()
{
    $w = new World();
    $w->user(1, 'Бегун');
    $w->user(9, 'Тренер', true);
    list($app, $src) = Setup::app($w);
    return [$app, $src, $w];
}

T::test('recount: running it twice changes nothing', function () {
    list($app, $src) = site(true);
    $before = snapshot($app->store()->pdo());
    $app->recalc()->all('normal');
    $app->recalc()->all('auto');
    T::ok($before === snapshot($app->store()->pdo()), 'the second pass wrote something');
});

T::test('recount: a deleted run lowers the value, never the level', function () {
    list($app, $src, $w) = tiny();
    $w->runs[1] = [
        ['id' => '1', 'source' => 'garmin', 'start' => '2026-09-01 07:00:00', 'km' => 60, 'sec' => 21000, 'track' => true],
        ['id' => '2', 'source' => 'garmin', 'start' => '2026-09-08 07:00:00', 'km' => 50, 'sec' => 17500, 'track' => true],
    ];
    $app->recalc()->athlete(1, 'normal');
    $l = $app->store()->levels(1, 'a');
    T::eq(['2026-09-08'], $l['km_total']['dates']);
    T::eq(110.0, $l['km_total']['value']);
    array_pop($w->runs[1]);
    $app->recalc()->athlete(1, 'normal');
    $l = $app->store()->levels(1, 'a');
    T::eq(['2026-09-08'], $l['km_total']['dates'], 'the level stays');
    T::eq(60.0, $l['km_total']['value'], 'the value follows the data');
    T::eq(1, count_rows($app->store()->pdo(), "SELECT COUNT(*) FROM ach_event WHERE user_id = 1 AND achievement = 'km_total'"));
});

T::test('recount: --history creates events already celebrated and no notifications', function () {
    $w = World::build();
    list($app, $src) = Setup::app($w);
    (new Jobs($app))->history();
    $pdo = $app->store()->pdo();
    T::ok(count_rows($pdo, 'SELECT COUNT(*) FROM ach_event') > 500, 'events were made');
    T::eq(0, count_rows($pdo, 'SELECT COUNT(*) FROM ach_event WHERE celebrated = 0'));
    T::eq(0, count_rows($pdo, 'SELECT COUNT(*) FROM ach_rank_event WHERE celebrated = 0'));
    T::eq(0, count_rows($pdo, 'SELECT COUNT(*) FROM ach_notification'));
    T::ok(count_rows($pdo, 'SELECT COUNT(*) FROM ach_rarity WHERE pct > 0') > 50, 'rarity counted');
});

T::test('recount: a user counted for the first time celebrates only the last 7 days', function () {
    list($app, $src, $w) = tiny();
    $w->runs[1] = [
        ['id' => '1', 'source' => 'garmin', 'start' => '2026-01-01 07:00:00', 'km' => 120, 'sec' => 45000, 'track' => true],
        ['id' => '2', 'source' => 'garmin', 'start' => '2026-11-04 07:00:00', 'km' => 400, 'sec' => 150000, 'track' => true],
    ];
    $app->recalc()->athlete(1, 'auto');
    $ev = $app->store()->events(1, 'a', 100);
    $km = array_values(array_filter($ev, function ($e) {
        return $e['achievement'] === 'km_total';
    }));
    T::eq([[2, false], [1, true]], array_map(function ($e) {
        return [$e['level'], $e['celebrated']];
    }, $km));
    T::ok(count($app->store()->notifications(1, 'a')) > 0, 'the fresh level is in the bell');
});

T::test('rank: points of every level, the rank, each rank dated when the points first passed it', function () {
    list($app, $src, $w) = tiny();
    // 520 km over two days: km_total Bronze + Silver, plus the volume and record levels of those runs
    $w->runs[1] = [
        ['id' => '1', 'source' => 'garmin', 'start' => '2026-03-01 07:00:00', 'km' => 120, 'sec' => 45000, 'track' => true],
        ['id' => '2', 'source' => 'garmin', 'start' => '2026-04-01 07:00:00', 'km' => 400, 'sec' => 150000, 'track' => true],
    ];
    $app->recalc()->athlete(1, 'normal');
    $site = [$app, $src];
    list(, $body) = call($site, 1, 'GET', ['action' => 'athlete']);
    $cat = $app->catalog();
    $sum = 0;
    foreach ($body['items'] as $it) {
        if (empty($it['locked'])) {
            $sum += $cat->points($cat->entries('a')[$it['id']], count($it['dates']));
        }
    }
    T::eq($sum, $body['points']);
    T::eq($cat->rankOf('a', $sum), $body['rank']);
    T::ok($body['rank'] >= 1, 'above Bronze');
    $re = array_reverse($body['rank_events']);
    T::eq(range(1, $body['rank']), array_column($re, 'rank'));
    T::eq('2026-04-01', $re[count($re) - 1]['date'], 'the last rank came with the 400 km run');
    T::ok(in_array('rank', array_column($body['notifications'], 'type'), true));
});

T::test('secrets: closed ones leave the server without name, condition or real id; ids stable per user', function () {
    $site = site();
    list(, $a) = call($site, 3, 'GET', ['action' => 'athlete']);
    list(, $b) = call($site, 3, 'GET', ['action' => 'athlete']);
    list(, $f) = call($site, 5, 'GET', ['action' => 'athlete', 'id' => 3]);
    $locked = function ($body) {
        return array_values(array_filter($body['items'], function ($i) {
            return !empty($i['locked']);
        }));
    };
    T::eq(6, count($locked($a)));
    T::eq(array_column($locked($a), 'id'), array_column($locked($b), 'id'), 'the same ids every time');
    T::eq(array_column($locked($a), 'id'), array_column($locked($f), 'id'), 'the same ids for a friend');
    foreach ($locked($a) as $it) {
        T::eq(['id', 'kind', 'category', 'locked', 'rarity'], array_keys($it));
        T::ok(preg_match('/^s_[0-9a-f]{10}$/', $it['id']) === 1, 'opaque id ' . $it['id']);
    }
    $json = json_encode($a, JSON_UNESCAPED_UNICODE);
    foreach ($site[0]->catalog()->entries('a') as $id => $e) {
        if ($e['kind'] === 'secret') {
            T::ok(strpos($json, '"' . $id . '"') === false, "the id $id leaked");
            T::ok(strpos($json, $e['name']) === false, "the name {$e['name']} leaked");
            T::ok(strpos($json, $e['condition']) === false, "the condition of $id leaked");
        }
    }
    // another user's closed secrets have other ids
    list(, $other) = call($site, 5, 'GET', ['action' => 'athlete']);
    T::eq([], array_intersect(array_column($locked($a), 'id'), array_column($locked($other), 'id')));
    // an opened secret is shown in full (coach 12: «Саб 3»)
    list(, $c) = call($site, 12, 'GET', ['action' => 'coach']);
    $sub3 = array_values(array_filter($c['items'], function ($i) {
        return $i['id'] === 'sub3';
    }));
    T::eq('Саб 3', $sub3[0]['name']);
});

T::test('friend: levels and dates without values, notes, events or the bell', function () {
    $site = site();
    list(, $self) = call($site, 3, 'GET', ['action' => 'athlete']);
    list($st, $f) = call($site, 5, 'GET', ['action' => 'athlete', 'id' => 3]);
    T::eq(200, $st);
    T::eq('friend', $f['viewer']);
    T::eq(['now', 'viewer', 'user', 'levels', 'ranks', 'categories', 'points', 'rank', 'items', 'showcase'], array_keys($f));
    foreach ($f['items'] as $i => $it) {
        if (empty($it['locked'])) {
            T::eq(null, $it['value'], $it['id']);
            T::ok(!isset($it['note']), 'no note for a friend');
            T::eq($self['items'][$i]['dates'], $it['dates']);
        }
    }
    T::eq($self['points'], $f['points']);
    list(, $w) = call($site, 5, 'GET', ['action' => 'widget', 'id' => 3]);
    T::eq(null, $w['showcase'][0]['value']);
});

T::test('visibility: «Только я» and «Подписчики» answer 403 {hidden, user}; the coach always sees his students', function () {
    list($app, $src) = site(true);
    $site = [$app, $src];
    list($st, $body) = call($site, 5, 'GET', ['action' => 'athlete', 'id' => 6]);
    T::eq(403, $st);
    T::eq(['hidden' => true, 'user' => ['id' => 6, 'name' => 'Скрытный', 'initials' => 'С']], $body);
    T::eq(403, call($site, 5, 'GET', ['action' => 'widget', 'id' => 6])[0]);
    call($site, 3, 'POST', ['action' => 'visibility', 'audience' => 'subs']);
    T::eq(200, call($site, 5, 'GET', ['action' => 'athlete', 'id' => 3])[0], 'a subscriber');
    T::eq(403, call($site, 6, 'GET', ['action' => 'athlete', 'id' => 3])[0], 'not a subscriber');
    call($site, 3, 'POST', ['action' => 'visibility', 'audience' => 'me']);
    T::eq(403, call($site, 5, 'GET', ['action' => 'athlete', 'id' => 3])[0]);
    T::eq(200, call($site, 12, 'GET', ['action' => 'athlete', 'id' => 3])[0], 'his coach');
    T::eq(403, call($site, 13, 'GET', ['action' => 'athlete', 'id' => 3])[0], 'another coach');
    T::eq(400, call($site, 3, 'POST', ['action' => 'visibility', 'audience' => 'friends'])[0]);
    // the coach: «Мои ученики»
    call($site, 12, 'POST', ['action' => 'coach_visibility', 'audience' => 'students']);
    T::eq(200, call($site, 21, 'GET', ['action' => 'coach', 'id' => 12])[0], 'a student');
    list($st, $body) = call($site, 27, 'GET', ['action' => 'coach', 'id' => 12]);
    T::eq(403, $st, 'a student who left');
    T::eq(true, $body['hidden']);
    T::eq(6, $body['coach']['students']);
    T::eq(403, call($site, 3, 'POST', ['action' => 'coach_visibility', 'audience' => 'all'])[0], 'not a coach');
});

T::test('public coach: strengths from Gold, legends first, at most 5 (3 in the widget); no figures, no students', function () {
    $site = site();
    list(, $p) = call($site, 5, 'GET', ['action' => 'coach', 'id' => 12]);
    T::eq('public', $p['viewer']);
    T::ok(count($p['items']) <= 5);
    T::eq('secret', $p['items'][0]['kind']);
    $seenTier = false;
    foreach ($p['items'] as $it) {
        T::eq(null, $it['value']);
        T::ok(!isset($it['data']) && !isset($it['holders']), 'no data, no holders');
        T::ok($it['kind'] === 'secret' ? !$seenTier : count($it['dates']) >= 3, 'order and Gold rule');
        $seenTier = $seenTier || $it['kind'] !== 'secret';
    }
    T::ok(!isset($p['students']) && !isset($p['notifications']));
    list(, $wdg) = call($site, 5, 'GET', ['action' => 'coach_widget', 'id' => 12]);
    T::eq(array_slice(array_column($p['items'], 'id'), 0, 3), array_column($wdg['strengths'], 'id'));
});

T::test('coach page: current students only, their cards from 8 weeks on', function () {
    $site = site();
    list(, $c) = call($site, 12, 'GET', ['action' => 'coach']);
    $ids = array_column($c['students'], 'id');
    sort($ids, SORT_STRING);
    T::eq(['21', '22', '24', '25', '26', '3'], $ids);
    foreach ($c['students'] as $s) {
        foreach ($s['achievements'] as $card) {
            T::ok($card['date'] >= D::add('2024-05-15', 56) || $s['id'] !== '21', 'a card from before 8 weeks');
            T::eq($s['id'] . '-' . $card['achievement'], $card['key']);
        }
    }
    $three = array_values(array_filter($c['students'], function ($s) {
        return $s['id'] === '3';
    }))[0];
    T::eq('pending', $three['consent']);
    T::eq('/achievements/athlete?id=3', $three['page']);
});

T::test('consent: request, answer, showcase only with yes, no removes the cards at once, 30 days before asking again', function () {
    list($app, $src) = site(true);
    $site = [$app, $src];
    $store = $app->store();
    // no consent yet: the showcase refuses the card
    $cards = $store->levelsFor([26], 'a')[26];
    $ach = null;
    foreach ($cards as $id => $row) {
        if ($row['dates'] && end($row['dates']) >= '2026-08-26') {
            $ach = $id;
            break;
        }
    }
    T::ok($ach !== null, 'student 26 has a card');
    list($st, $b) = call($site, 12, 'POST', ['action' => 'coach_showcase', 'keys' => json_encode(['26-' . $ach])]);
    T::eq(400, $st);
    T::ok(strpos($b['error'], 'согласия') !== false, $b['error']);
    // the coach asks
    T::eq(200, call($site, 12, 'POST', ['action' => 'consent_request', 'athlete' => '26'])[0]);
    list(, $a) = call($site, 26, 'GET', ['action' => 'athlete']);
    T::eq('pending', $a['coach']['consent']);
    T::eq('consent_request', $a['notifications'][0]['type']);
    T::eq(['id' => 12, 'name' => 'Тренер', 'initials' => 'Т'], $a['notifications'][0]['coach']);
    list(, $c) = call($site, 12, 'GET', ['action' => 'coach']);
    T::eq('consent_pending', $c['notifications'][0]['type']);
    T::eq('26', $c['notifications'][0]['athlete']['id']);
    T::eq(403, call($site, 12, 'POST', ['action' => 'consent_request', 'athlete' => '4'])[0], 'not his student');
    // yes: the card may go up, in the student's name format
    T::eq(200, call($site, 26, 'POST', ['action' => 'consent', 'answer' => 'yes', 'name_format' => 'initial'])[0]);
    list(, $c) = call($site, 12, 'GET', ['action' => 'coach']);
    T::eq('consent_answer', $c['notifications'][0]['type']);
    T::eq('yes', $c['notifications'][0]['answer']);
    T::eq([], array_values(array_filter($c['notifications'], function ($n) {
        return $n['type'] === 'consent_pending' && $n['athlete']['id'] === '26';
    })), 'the pending one is gone');
    $keys = array_column($c['showcase'], 'key');
    $keys[] = '26-' . $ach;
    T::eq(200, call($site, 12, 'POST', ['action' => 'coach_showcase', 'keys' => json_encode($keys)])[0]);
    list(, $pub) = call($site, 5, 'GET', ['action' => 'coach', 'id' => 12]);
    $card = array_values(array_filter($pub['showcase'], function ($x) use ($ach) {
        return $x['key'] === '26-' . $ach;
    }));
    T::eq('Атлет 6', $card[0]['athlete_name'], 'one word: nothing to shorten');
    // no: gone at once, from the stored list too
    T::eq(200, call($site, 26, 'POST', ['action' => 'consent', 'answer' => 'no'])[0]);
    list(, $pub) = call($site, 5, 'GET', ['action' => 'coach', 'id' => 12]);
    T::ok(!in_array('26-' . $ach, array_column($pub['showcase'], 'key'), true));
    T::ok(!in_array('26-' . $ach, $store->setting(12)['coach_showcase'], true));
    // asking again: not before 30 days
    list($st, $b) = call($site, 12, 'POST', ['action' => 'consent_request', 'athlete' => '26']);
    T::eq(400, $st);
    T::eq('Повторный запрос можно отправить с 06.12.2026', $b['error']);
    $app->setToday(D::add('2026-11-06', 31));
    T::eq(200, call($site, 12, 'POST', ['action' => 'consent_request', 'athlete' => '26'])[0]);
    $app->setToday('2026-11-06');
    T::eq(400, call($site, 26, 'POST', ['action' => 'consent', 'answer' => 'maybe'])[0]);
    T::eq(400, call($site, 4, 'POST', ['action' => 'consent', 'answer' => 'yes'])[0], 'no coach');
});

T::test('consent: a student who left keeps his card with the period until he withdraws', function () {
    list($app, $src) = site(true);
    $site = [$app, $src];
    $lv = $app->store()->levelsFor([27], 'a')[27];
    T::ok(!empty($lv['sub3']['dates']), 'student 27 ran a sub-3 with the coach');
    list(, $c) = call($site, 12, 'GET', ['action' => 'coach']);
    $keys = array_column($c['showcase'], 'key');
    $keys[] = '27-sub3';
    T::eq(200, call($site, 12, 'POST', ['action' => 'coach_showcase', 'keys' => json_encode($keys)])[0]);
    list(, $pub) = call($site, 5, 'GET', ['action' => 'coach', 'id' => 12]);
    $card = array_values(array_filter($pub['showcase'], function ($x) {
        return $x['key'] === '27-sub3';
    }))[0];
    T::eq('занимался в 2024–2025', $card['period']);
    T::eq('Саб 3', $card['name']);
    T::eq(400, call($site, 27, 'POST', ['action' => 'consent', 'answer' => 'no'])[0], 'no current coach: the coach must be named');
    T::eq(200, call($site, 27, 'POST', ['action' => 'consent', 'answer' => 'no', 'coach' => '12'])[0]);
    list(, $pub) = call($site, 5, 'GET', ['action' => 'coach', 'id' => 12]);
    T::ok(!in_array('27-sub3', array_column($pub['showcase'], 'key'), true));
    // a former student is not in the list and does not count among the students
    list(, $c) = call($site, 12, 'GET', ['action' => 'coach']);
    T::ok(!in_array('27', array_column($c['students'], 'id'), true));
});

T::test('showcase: up to 3 earned achievements only', function () {
    list($app, $src) = site(true);
    $site = [$app, $src];
    T::eq(200, call($site, 3, 'POST', ['action' => 'showcase', 'ids' => '["pr5","km_total"]'])[0]);
    list(, $a) = call($site, 3, 'GET', ['action' => 'athlete']);
    T::eq(['pr5', 'km_total'], $a['showcase']);
    T::eq(400, call($site, 3, 'POST', ['action' => 'showcase', 'ids' => '["pr5","km_total","pr10","rank"]'])[0], 'four');
    T::eq(400, call($site, 3, 'POST', ['action' => 'showcase', 'ids' => '["podium"]'])[0], 'not earned');
    T::eq(400, call($site, 3, 'POST', ['action' => 'showcase', 'ids' => '["sub3"]'])[0], 'a closed secret');
    $locked = array_values(array_filter($a['items'], function ($i) {
        return !empty($i['locked']);
    }));
    T::eq(400, call($site, 3, 'POST', ['action' => 'showcase', 'ids' => json_encode([$locked[0]['id']])])[0], 'an opaque id');
    T::eq(400, call($site, 3, 'POST', ['action' => 'showcase', 'ids' => 'nope'])[0]);
    T::eq(200, call($site, 3, 'POST', ['action' => 'showcase', 'ids' => '[]'])[0]);
});

T::test('celebrated and seen touch only the viewer\'s own rows', function () {
    list($app, $src) = site(true);
    $site = [$app, $src];
    Setup::state($app, 3, 'a', 'levelup');
    list(, $a) = call($site, 3, 'GET', ['action' => 'athlete']);
    $open = array_values(array_filter($a['events'], function ($e) {
        return !$e['celebrated'];
    }));
    T::eq(1, count($open));
    T::eq(200, call($site, 5, 'POST', ['action' => 'celebrated', 'events' => json_encode([$open[0]['id']])])[0]);
    list(, $a) = call($site, 3, 'GET', ['action' => 'athlete']);
    T::eq(1, count(array_filter($a['events'], function ($e) {
        return !$e['celebrated'];
    })), 'someone else cannot mark it');
    call($site, 3, 'POST', ['action' => 'celebrated', 'events' => json_encode([$open[0]['id']]), 'rank_events' => '[]']);
    list(, $a) = call($site, 3, 'GET', ['action' => 'athlete']);
    T::eq(0, count(array_filter($a['events'], function ($e) {
        return !$e['celebrated'];
    })));
    $unread = array_column(array_filter($a['notifications'], function ($n) {
        return $n['unread'];
    }), 'id');
    T::ok($unread !== [], 'something unread');
    call($site, 3, 'POST', ['action' => 'seen', 'notifications' => json_encode($unread)]);
    list(, $a) = call($site, 3, 'GET', ['action' => 'athlete']);
    T::eq([], array_column(array_filter($a['notifications'], function ($n) {
        return $n['unread'];
    }), 'id'));
});

T::test('http: 401 when logged out, 400 on an unknown action, 404 on nobody, 403 for a foreign origin', function () {
    $site = site();
    T::eq([401, null], call($site, null, 'GET', ['action' => 'athlete']));
    T::eq(400, call($site, 3, 'GET', ['action' => 'everything'])[0]);
    T::eq(404, call($site, 3, 'GET', ['action' => 'athlete', 'id' => 999])[0]);
    T::eq(404, call($site, 3, 'GET', ['action' => 'coach', 'id' => 3])[0], 'not a coach');
    $site[1]->viewer = 3;
    $r = S10Ach\Http::handle($site[0], 'POST', [], ['action' => 'seen', 'notifications' => '[]'], ['HTTP_ORIGIN' => 'https://evil.example', 'HTTP_HOST' => 's10.run']);
    T::eq(403, $r[0]);
    $r = S10Ach\Http::handle($site[0], 'POST', [], ['action' => 'seen', 'notifications' => '[]'], ['HTTP_ORIGIN' => 'https://s10.run', 'HTTP_HOST' => 's10.run']);
    T::eq(200, $r[0]);
});

T::test('no such data on the site: the achievements that need it are not shown', function () {
    $w = World::build();
    $w->missing = ['splits' => true, 'replies' => true, 'person' => true];
    list($app, $src) = Setup::app($w);
    $app->recalc()->all('history');
    $site = [$app, $src];
    list(, $a) = call($site, 3, 'GET', ['action' => 'athlete']);
    $ids = array_column($a['items'], 'id');
    T::ok(!in_array('km1', $ids, true) && !in_array('even', $ids, true), 'no splits: no «Быстрый километр», no «Ровный темп»');
    T::ok(in_array('km_total', $ids, true));
    list(, $c) = call($site, 12, 'GET', ['action' => 'coach']);
    $ids = array_column($c['items'], 'id');
    T::ok(!in_array('reply', $ids, true) && !in_array('grade', $ids, true), 'no replies, no birth dates');
    T::eq(11, count($c['items']), '14 minus «На связи», «Уровень учеников» and «Бостон» (it needs the birth date too)');
});

T::test('worker: changed users are recounted, their coaches follow', function () {
    list($app, $src) = site(true);
    $w = $src->w;
    $store = $app->store();
    $w->runs[22][] = ['id' => 'new1', 'source' => 'garmin', 'start' => '2026-11-06 07:00:00', 'km' => 30, 'sec' => 9000, 'track' => true];
    $src->changed = [22];
    $pdo = $store->pdo();
    $pdo->exec('DELETE FROM ach_queue');
    $before = $store->levels(22, 'a')['km_total']['value'];
    $r = (new Jobs($app))->worker();
    T::eq(1, $r['athletes']);
    T::eq($before + 30, $store->levels(22, 'a')['km_total']['value']);
    T::eq(0, $r['coaches'], 'coach 12 was counted minutes ago: he waits (coach_min_interval)');
    T::eq([12], array_keys($store->queued('c')), 'but stays in the queue');
    $src->changed = [];
    $app->config['coach_min_interval'] = 0;
    $r = (new Jobs($app))->worker();
    T::eq(['athletes' => 0, 'coaches' => 1, 'errors' => 0], $r);
    T::eq([], $store->queued('c'));
    T::eq(['athletes' => 0, 'coaches' => 0, 'errors' => 0], (new Jobs($app))->worker(), 'nothing left');
});

T::test('report: users per level of every achievement and per rank, as markdown and CSV', function () {
    $site = site();
    list($md, $csv) = (new Jobs($site[0]))->report();
    T::ok(strpos($md, '## Атлеты') !== false && strpos($md, '## Тренеры') !== false);
    T::ok(strpos($md, '| Километраж | km_total |') !== false);
    T::ok(strpos($md, '| Удержание | tenure |') !== false);
    T::ok(preg_match('/^a,rank,0,Бронза,\d+$/m', $csv) === 1);
    T::ok(preg_match('/^c,sub3,1,Легендарное,1$/m', $csv) === 1);
});

T::test('check: the developer\'s self-test reads every Source method without errors', function () {
    $site = site();
    list($bad, $lines) = (new Check($site[0]))->user(3);
    T::eq(0, $bad, implode("\n", $lines));
    list($bad, $lines) = (new Check($site[0]))->user(12);
    T::eq(0, $bad, implode("\n", $lines));
    T::ok(strpos(implode("\n", $lines), 'Ошибок нет') !== false);
});

T::test('a coach cannot be his own student', function () {
    list($app, $src, $w) = tiny();
    $w->stint(9, 9, '2024-01-01');
    $w->stint(9, 1, '2026-06-01');
    $app->recalc()->athlete(9, 'normal');
    $app->recalc()->coach(9, 'normal');
    $c = $app->store()->levels(9, 'c');
    T::eq(5.0, $c['longest']['value'], 'only the real student: June to November');
    T::eq(0.0, $app->store()->levels(9, 'a')['coach']['value'], 'no «С тренером» with himself');
    list(, $page) = call([$app, $src], 9, 'GET', ['action' => 'coach']);
    T::eq(['1'], array_column($page['students'], 'id'));
});

T::test('a moderator takes a level away, with the reason in ach_log', function () {
    list($app, $src, $w) = tiny();
    $w->runs[1] = [['id' => '1', 'source' => 'manual', 'start' => '2026-09-01', 'km' => 390, 'sec' => 150000, 'track' => false]];
    $app->recalc()->athlete(1, 'normal');
    T::eq(1, count($app->store()->levels(1, 'a')['km_total']['dates']));
    $w->runs[1] = []; // the fake run is deleted on the site first
    T::eq(1, $app->store()->revoke(1, 'a', 'km_total', 0, 'накрутка: 390 км вручную'));
    $app->recalc()->athlete(1, 'normal');
    T::eq([], $app->store()->levels(1, 'a')['km_total']['dates']);
    $pdo = $app->store()->pdo();
    T::eq(0, count_rows($pdo, "SELECT COUNT(*) FROM ach_event WHERE user_id = 1 AND achievement = 'km_total'"));
    T::eq(1, count_rows($pdo, "SELECT COUNT(*) FROM ach_log WHERE user_id = 1 AND reason LIKE 'накрутка%'"));
});

T::test('«Саб 3»: the counter never goes down, even if the site forgets the period', function () {
    list($app, $src) = site(true);
    $before = $app->store()->levels(12, 'c')['sub3']['info']['holders'];
    T::eq(3, count($before));
    $w = $src->w;
    $w->stints = array_values(array_filter($w->stints, function ($s) {
        return $s['athlete_id'] !== 28; // the old period of Атлет 8 vanished from the site
    }));
    $app->recalc()->coach(12, 'normal');
    $after = $app->store()->levels(12, 'c')['sub3']['info']['holders'];
    T::eq(array_column($before, 'athlete'), array_column($after, 'athlete'));
    T::eq(true, $after[0]['left']);
    list(, $c) = call([$app, $src], 12, 'GET', ['action' => 'coach']);
    $sub3 = array_values(array_filter($c['items'], function ($i) {
        return $i['id'] === 'sub3';
    }))[0];
    T::eq(3, $sub3['count']);
});
