<?php
namespace S10Ach;

use S10Ach\Engine\AthleteData;
use S10Ach\Engine\D;
use S10Ach\Engine\Text;

// The API of contract/API.md: GET athlete | coach | widget | coach_widget, POST showcase | visibility | consent |
// coach_showcase | coach_visibility | consent_request | celebrated | seen. Every method returns [http status, body].
final class Service
{
    const ATHLETE_SKIP = ['enabled' => 1, 'data' => 1];
    const COACH_SKIP = ['enabled' => 1, 'data' => 1, 'data_unit' => 1, 'none_text' => 1, 'counter' => 1];
    const REASK_DAYS = 30;

    private $app;
    private $users = [];

    public function __construct(App $app)
    {
        $this->app = $app;
    }

    // ---------- small helpers ----------

    private static function err($status, $msg)
    {
        return [$status, ['ok' => false, 'error' => $msg]];
    }

    private function user($id)
    {
        $id = (int) $id;
        if (!array_key_exists($id, $this->users)) {
            $u = $this->app->source()->users([$id]);
            $this->users[$id] = isset($u[$id]) ? (string) $u[$id]['name'] : null;
        }
        return $this->users[$id];
    }

    private function names(array $ids)
    {
        $want = array_values(array_diff(array_unique(array_map('intval', $ids)), array_keys($this->users)));
        if ($want) {
            $u = $this->app->source()->users($want);
            foreach ($want as $id) {
                $this->users[$id] = isset($u[$id]) ? (string) $u[$id]['name'] : null;
            }
        }
        $out = [];
        foreach ($ids as $id) {
            $out[(int) $id] = $this->users[(int) $id];
        }
        return $out;
    }

    private function person($id, $name, $stringId = false)
    {
        return ['id' => $stringId ? (string) $id : (int) $id, 'name' => (string) $name, 'initials' => Text::initials($name)];
    }

    /** periods with coaches / students, cleaned: [['coach'|'athlete', 'from', 'to']] */
    private function coachPeriods($athleteId)
    {
        return AthleteData::periods($this->app->source()->coaches($athleteId) ?: [], 'coach_id', $this->app->today(), $athleteId);
    }

    private function studentPeriods($coachId)
    {
        return AthleteData::periods($this->app->source()->students($coachId) ?: [], 'athlete_id', $this->app->today(), $coachId);
    }

    private function isCurrent(array $p)
    {
        return $p['to'] === null || $p['to'] >= $this->app->today();
    }

    private function currentCoach($athleteId)
    {
        $best = null;
        foreach ($this->coachPeriods($athleteId) as $p) {
            if ($this->isCurrent($p) && ($best === null || $p['from'] >= $best['from'])) {
                $best = $p;
            }
        }
        return $best ? $best['coach'] : null;
    }

    private function isCurrentStudent($coachId, $athleteId)
    {
        foreach ($this->coachPeriods($athleteId) as $p) {
            if ($p['coach'] === (int) $coachId && $this->isCurrent($p)) {
                return true;
            }
        }
        return false;
    }

    private function secretId($role, $uid, $ach)
    {
        return 's_' . substr(hash_hmac('sha256', $role . ':' . $uid . ':' . $ach, $this->app->secret()), 0, 10);
    }

    private static function catalogPart(array $e, array $skip)
    {
        $out = [];
        foreach ($e as $k => $v) {
            if (!isset($skip[$k])) {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    private static function rarity(array $rar, array $e)
    {
        $out = [];
        foreach ($e['thresholds'] as $i => $t) {
            $out[] = isset($rar[$e['id']][$i]) ? Recalc::number($rar[$e['id']][$i]) : 0;
        }
        return $out;
    }

    private function notificationsOut($uid, $role, array $avail)
    {
        $out = [];
        foreach ($this->app->store()->notifications($uid, $role, (int) $this->app->config['notifications_limit']) as $n) {
            if (isset($n['payload']['achievement']) && $n['type'] === 'level' && !isset($avail[$n['payload']['achievement']])) {
                continue;
            }
            $out[] = ['id' => $n['id'], 'type' => $n['type']] + $n['payload'] + ['date' => $n['date'], 'unread' => $n['unread']];
        }
        return $out;
    }

    private function eventsOut($uid, $role, array $avail)
    {
        $out = [];
        foreach ($this->app->store()->events($uid, $role, 90) as $e) {
            if (isset($avail[$e['achievement']]) && count($out) < 30) {
                $out[] = $e;
            }
        }
        return $out;
    }

    // ---------- access ----------

    private function canSeeAthlete($viewer, $owner)
    {
        if ($viewer === $owner) {
            return true;
        }
        $aud = $this->app->store()->setting($owner)['audience'];
        if ($aud === 'all' || $this->isCurrentStudent($viewer, $owner)) {
            return true; // the coach always sees his current students
        }
        return $aud === 'subs' && $this->app->source()->isSubscriber($viewer, $owner);
    }

    private function canSeeCoach($viewer, $coach)
    {
        if ($viewer === $coach) {
            return true;
        }
        $aud = $this->app->store()->setting($coach)['coach_audience'];
        if ($aud === 'all') {
            return true;
        }
        return $aud === 'students' && $this->isCurrentStudent($coach, $viewer);
    }

    // a user seen for the first time is counted on the spot
    private function ensure($uid, $role)
    {
        if ($this->app->store()->score($uid, $role)) {
            return;
        }
        try {
            if ($role === 'a') {
                $this->app->recalc()->athlete($uid, 'auto');
            } else {
                $this->app->recalc()->coach($uid, 'auto');
            }
        } catch (\Throwable $e) {
            error_log('[achievements] first recount of ' . $uid . ': ' . $e->getMessage());
        }
    }

    // ---------- reads ----------

    public function get($action, $id, $viewer)
    {
        $viewer = (int) $viewer;
        $id = ($id === null || $id === '') ? $viewer : (int) $id;
        if ($id <= 0) {
            return self::err(400, 'Неверный id');
        }
        switch ($action) {
            case 'athlete':
                return $this->athletePage($id, $viewer, false);
            case 'widget':
                return $this->athletePage($id, $viewer, true);
            case 'coach':
                return $this->coachPage($id, $viewer, false);
            case 'coach_widget':
                return $this->coachPage($id, $viewer, true);
        }
        return self::err(400, 'Неизвестное действие');
    }

    /** athlete items as the viewer may see them, plus points */
    private function athleteItems($owner, $self, array $avail)
    {
        $store = $this->app->store();
        $cat = $this->app->catalog();
        $levels = $store->levels($owner, 'a');
        $rar = $store->rarity('a');
        $items = [];
        $locked = [];
        $points = 0;
        $earned = 0;
        foreach ($avail as $id => $e) {
            $row = isset($levels[$id]) ? $levels[$id] : null;
            $dates = $row ? $row['dates'] : [];
            if ($e['kind'] === 'secret' && !$dates) {
                // closed secret: no name, no condition, no real id
                $locked[] = ['id' => $this->secretId('a', $owner, $id), 'kind' => 'secret', 'category' => $e['category'], 'locked' => true, 'rarity' => self::rarity($rar, $e)];
                continue;
            }
            $points += $cat->points($e, count($dates));
            $earned += $dates ? 1 : 0;
            $it = self::catalogPart($e, self::ATHLETE_SKIP);
            if ($self) {
                $it['value'] = $row ? Recalc::number($row['value']) : ((isset($e['direction']) && (int) $e['direction'] === -1) ? null : 0);
            } else {
                $it['value'] = null;
            }
            $it['dates'] = $dates;
            if ($dates && isset($row['info']['last'])) {
                $it['last'] = $row['info']['last']; // the caption of the last reached level
            }
            if ($self && $row && isset($row['info']['note'])) {
                $it['note'] = $row['info']['note'];
            }
            $it['rarity'] = self::rarity($rar, $e);
            $items[$id] = $it;
        }
        usort($locked, function ($a, $b) {
            return strcmp($a['id'], $b['id']);
        });
        return [$items, $locked, $points, $earned];
    }

    private function athletePage($owner, $viewer, $widget)
    {
        $app = $this->app;
        $store = $app->store();
        $cat = $app->catalog();
        $name = $this->user($owner);
        if ($name === null) {
            return self::err(404, 'Нет такого пользователя');
        }
        $self = $owner === $viewer;
        $user = $this->person($owner, $name);
        if (!$self && !$this->canSeeAthlete($viewer, $owner)) {
            return [403, ['hidden' => true, 'user' => $user]];
        }
        if ($self) {
            $this->ensure($owner, 'a');
        }
        $avail = $app->features()->available('a', $cat);
        list($items, $locked, $points, $earned) = $this->athleteItems($owner, $self, $avail);
        $setting = $store->setting($owner);
        $showcase = [];
        foreach ($setting['showcase'] as $sid) {
            if (isset($items[$sid]) && $items[$sid]['dates'] && count($showcase) < 3) {
                $showcase[] = $sid;
            }
        }
        $out = ['now' => $app->today(), 'viewer' => $self ? 'self' : 'friend', 'user' => $user, 'levels' => $cat->levels(), 'ranks' => $cat->ranks('a'),
            'categories' => $cat->categories('a'), 'points' => $points, 'rank' => $cat->rankOf('a', $points)];
        if ($widget) {
            $out['earned'] = $earned;
            $out['total'] = count($items) + count($locked);
            $out['showcase'] = [];
            foreach ($showcase as $sid) {
                $it = $items[$sid];
                unset($it['note']);
                $out['showcase'][] = $it;
            }
            return [200, $out];
        }
        $out['items'] = array_merge(array_values($items), $locked);
        $out['showcase'] = $showcase;
        if (!$self) {
            return [200, $out];
        }
        $out['events'] = $this->eventsOut($owner, 'a', $avail);
        $out['rank_events'] = $store->rankEvents($owner, 'a');
        $out['visibility'] = ['audience' => $setting['audience']];
        $coachId = $this->currentCoach($owner);
        $out['coach'] = null;
        if ($coachId !== null) {
            $cn = $this->user($coachId);
            $c = $store->consent($coachId, $owner);
            $out['coach'] = $this->person($coachId, $cn !== null ? $cn : 'Тренер') + ['consent' => $c ? $c['status'] : 'none'];
        }
        $out['notifications'] = $this->notificationsOut($owner, 'a', $avail);
        return [200, $out];
    }

    // ---------- coach ----------

    /** the coach's strongest: earned legends first, then tier levels from Gold up by points */
    private function strengths(array $avail, array $levels, $max)
    {
        $cat = $this->app->catalog();
        $cidx = $cat->categoryIndex('c');
        $pick = [];
        $order = 0;
        foreach ($avail as $id => $e) {
            $n = isset($levels[$id]) ? count($levels[$id]['dates']) : 0;
            $order++;
            if (($e['kind'] === 'secret' && $n >= 1) || ($e['kind'] !== 'secret' && $n >= 3)) {
                $pick[] = [$e['kind'] === 'secret' ? 1 : 0, $cat->points($e, $n), isset($cidx[$e['category']]) ? $cidx[$e['category']] : 99, $order, $id];
            }
        }
        usort($pick, function ($a, $b) {
            return ($b[0] - $a[0]) ?: (($b[1] - $a[1]) ?: (($a[2] - $b[2]) ?: ($a[3] - $b[3])));
        });
        $out = [];
        foreach (array_slice($pick, 0, $max) as $p) {
            $out[] = $p[4];
        }
        return $out;
    }

    private function coachItem(array $e, $row, $coachId, $self, array $rar, array $consents, array $formats)
    {
        $it = self::catalogPart($e, self::COACH_SKIP);
        $info = $row ? $row['info'] : [];
        $it['value'] = $self && $row ? Recalc::number($row['value']) : null;
        if ($self && !empty($info['infinite'])) {
            $it['infinite'] = true;
        }
        $it['dates'] = $row ? $row['dates'] : [];
        if ($self && !empty($e['data_unit'])) {
            $it['data'] = isset($info['data']) ? $info['data'] : ['n' => 0];
        }
        if (isset($info['last']) && $it['dates']) {
            if ($self || empty($info['who'])) {
                $it['last'] = $info['last'];
            } elseif (isset($consents[$info['who']]) && $consents[$info['who']]['status'] === 'yes') {
                // a student's name in public only with his consent, in his format
                $n = $this->user($info['who']);
                $it['last'] = Cards::name($n !== null ? $n : '', isset($formats[$info['who']]) ? $formats[$info['who']] : 'full') . (isset($info['tail']) ? $info['tail'] : '');
            }
        }
        if (!empty($e['counter'])) {
            $holders = isset($info['holders']) ? $info['holders'] : [];
            $it['count'] = count($holders);
            if ($self) {
                $it['holders'] = [];
                foreach ($holders as $h) {
                    $x = ['name' => $h['name'], 'time' => $h['time'], 'date' => $h['date']];
                    if (!empty($h['left'])) {
                        $x['left'] = true;
                    }
                    $it['holders'][] = $x;
                }
            }
        }
        $it['rarity'] = self::rarity($rar, $e);
        return $it;
    }

    private function coachPage($coach, $viewer, $widget)
    {
        $app = $this->app;
        $store = $app->store();
        $cat = $app->catalog();
        $name = $this->user($coach);
        if ($name === null || !$app->source()->isCoach($coach)) {
            return self::err(404, 'Нет такого тренера');
        }
        $self = $coach === $viewer;
        $periods = $this->studentPeriods($coach);
        $current = [];
        foreach ($periods as $p) {
            if ($this->isCurrent($p)) {
                $current[$p['athlete']] = isset($current[$p['athlete']]) ? min($current[$p['athlete']], $p['from']) : $p['from'];
            }
        }
        $coachObj = $this->person($coach, $name) + ['students' => count($current)];
        if (!$self && !$this->canSeeCoach($viewer, $coach)) {
            return [403, ['hidden' => true, 'coach' => $coachObj]];
        }
        if ($self) {
            $this->ensure($coach, 'c');
        }
        $avail = $app->features()->available('c', $cat);
        $levels = $store->levels($coach, 'c');
        $rar = $store->rarity('c');
        $consents = $store->consentsOfCoach($coach);
        $points = 0;
        foreach ($avail as $id => $e) {
            $points += $cat->points($e, isset($levels[$id]) ? count($levels[$id]['dates']) : 0);
        }
        $out = ['now' => $app->today(), 'viewer' => $self ? 'self' : 'public', 'coach' => $coachObj, 'levels' => $cat->levels(),
            'ranks' => $cat->ranks('c'), 'athlete_ranks' => $cat->ranks('a'), 'categories' => $cat->categories('c'),
            'points' => $points, 'rank' => $cat->rankOf('c', $points), 'gates' => $cat->gates()];

        // names in public captions follow each student's chosen format
        $whos = [];
        foreach ($levels as $row) {
            if (!empty($row['info']['who'])) {
                $whos[] = (int) $row['info']['who'];
            }
        }
        $formats = [];
        foreach ($whos ? $store->settings($whos) : [] as $u => $s) {
            $formats[$u] = $s['name_format'];
        }

        if ($widget || !$self) {
            $ids = $this->strengths($avail, $levels, $widget ? 3 : 5);
            $list = [];
            foreach ($ids as $id) {
                $it = $this->coachItem($avail[$id], $levels[$id], $coach, false, $rar, $consents, $formats);
                if ($self) {
                    $it['value'] = Recalc::number($levels[$id]['value']);
                }
                $list[] = $it;
            }
            if ($widget) {
                $out['months'] = isset($levels['exp']) && $levels['exp']['value'] !== null ? (int) $levels['exp']['value'] : 0;
                $out['strengths'] = $list;
                return [200, $out];
            }
            $out['items'] = $list;
            $out['showcase'] = $this->coachShowcase($coach, $periods, $consents);
            return [200, $out];
        }

        $items = [];
        $locked = [];
        foreach ($avail as $id => $e) {
            $row = isset($levels[$id]) ? $levels[$id] : null;
            if ($e['kind'] === 'secret' && (!$row || !$row['dates'])) {
                $locked[] = ['id' => $this->secretId('c', $coach, $id), 'kind' => 'secret', 'category' => $e['category'], 'locked' => true, 'rarity' => self::rarity($rar, $e)];
                continue;
            }
            $items[] = $this->coachItem($e, $row, $coach, true, $rar, $consents, $formats);
        }
        usort($locked, function ($a, $b) {
            return strcmp($a['id'], $b['id']);
        });
        $out['items'] = array_merge($items, $locked);
        $out['students'] = $this->students($coach, $periods, $current, $consents);
        $out['showcase'] = $this->coachShowcase($coach, $periods, $consents);
        $out['events'] = $this->eventsOut($coach, 'c', $avail);
        $out['rank_events'] = $store->rankEvents($coach, 'c');
        $out['visibility'] = ['audience' => $store->setting($coach)['coach_audience']];
        $out['notifications'] = $this->notificationsOut($coach, 'c', $avail);
        return [200, $out];
    }

    /** every student's cards for this coach: [aid => [ach => card]] */
    private function cardsByStudent(array $periods, array $aids)
    {
        $app = $this->app;
        $cat = $app->catalog();
        $availA = $app->features()->available('a', $cat);
        $levels = $aids ? $app->store()->levelsFor($aids, 'a') : [];
        $settings = $aids ? $app->store()->settings($aids) : [];
        $names = $this->names($aids);
        $by = [];
        foreach ($periods as $p) {
            $by[$p['athlete']][] = $p;
        }
        $out = [];
        foreach ($aids as $aid) {
            $windows = Cards::windows(isset($by[$aid]) ? $by[$aid] : [], $app->today());
            $name = Cards::name($names[$aid] !== null ? $names[$aid] : '', $settings[$aid]['name_format']);
            $out[$aid] = Cards::forStudent($cat, $availA, isset($levels[$aid]) ? $levels[$aid] : [], $windows, $aid, $name);
        }
        return $out;
    }

    private function students($coach, array $periods, array $current, array $consents)
    {
        $app = $this->app;
        $aids = array_keys($current);
        if (!$aids) {
            return [];
        }
        $names = $this->names($aids);
        $scores = $app->store()->scores($aids, 'a');
        $settings = $app->store()->settings($aids);
        $cards = $this->cardsByStudent($periods, $aids);
        $list = [];
        foreach ($aids as $aid) {
            $n = $names[$aid] !== null ? $names[$aid] : 'Ученик S10';
            $s = isset($scores[$aid]) ? $scores[$aid] : ['points' => 0, 'rank' => 0, 'near' => ''];
            $st = ['id' => (string) $aid, 'name' => $n, 'initials' => Text::initials($n), 'months' => D::months($current[$aid], $app->today()),
                'rank' => $s['rank'], 'points' => $s['points'], 'consent' => isset($consents[$aid]) ? $consents[$aid]['status'] : 'none',
                'near' => $s['near']];
            if ($settings[$aid]['audience'] === 'all') {
                $st['page'] = str_replace('{id}', (string) $aid, $app->config['student_page']);
            }
            $st['achievements'] = array_values($cards[$aid]);
            $list[] = $st;
        }
        usort($list, function ($a, $b) {
            return ($b['months'] - $a['months']) ?: strcmp($a['name'], $b['name']);
        });
        return $list;
    }

    /** the stored showcase, only pairs with the student's consent and a card that still exists */
    private function coachShowcase($coach, array $periods, array $consents)
    {
        $keys = $this->app->store()->setting($coach)['coach_showcase'];
        $resolved = $this->resolveKeys($coach, $keys, $periods, $consents);
        $out = [];
        foreach ($keys as $k) {
            if (isset($resolved[$k]) && count($out) < 6) {
                $out[] = $resolved[$k];
            }
        }
        return $out;
    }

    /** [key => card] for the keys that may be shown; a former student's card carries its period */
    private function resolveKeys($coach, array $keys, array $periods, array $consents)
    {
        $want = [];
        foreach ($keys as $k) {
            $p = Cards::parseKey($k);
            if ($p && isset($consents[$p[0]]) && $consents[$p[0]]['status'] === 'yes') {
                $want[$p[0]][] = [$k, $p[1]];
            }
        }
        if (!$want) {
            return [];
        }
        $cards = $this->cardsByStudent($periods, array_keys($want));
        $out = [];
        foreach ($want as $aid => $list) {
            $mine = [];
            foreach ($periods as $p) {
                if ($p['athlete'] === $aid) {
                    $mine[] = $p;
                }
            }
            $left = true;
            foreach ($mine as $p) {
                $left = $left && !$this->isCurrent($p);
            }
            foreach ($list as $x) {
                if (!isset($cards[$aid][$x[1]])) {
                    continue;
                }
                $card = $cards[$aid][$x[1]];
                if ($left && $mine) {
                    $y1 = substr($mine[0]['from'], 0, 4);
                    $y2 = substr((string) $mine[count($mine) - 1]['to'], 0, 4);
                    $card['period'] = 'занимался в ' . ($y1 === $y2 ? $y1 : $y1 . Text::DASH . $y2);
                }
                $out[$x[0]] = $card;
            }
        }
        return $out;
    }

    // ---------- writes ----------

    private static function jsonList($v)
    {
        if (is_array($v)) {
            return $v;
        }
        if (!is_string($v) || $v === '') {
            return null;
        }
        $d = json_decode($v, true);
        return is_array($d) ? array_values($d) : null;
    }

    private static function intList($v)
    {
        $l = self::jsonList($v);
        if ($l === null) {
            return [];
        }
        $out = [];
        foreach ($l as $x) {
            if (is_int($x) || (is_string($x) && ctype_digit($x))) {
                $out[] = (int) $x;
            }
        }
        return array_values(array_unique($out));
    }

    public function post($action, array $f, $viewer)
    {
        $viewer = (int) $viewer;
        switch ($action) {
            case 'showcase':
                return $this->postShowcase($f, $viewer);
            case 'visibility':
                return $this->postVisibility($f, $viewer, 'audience', ['all', 'subs', 'me']);
            case 'coach_visibility':
                if (!$this->app->source()->isCoach($viewer)) {
                    return self::err(403, 'Только для тренера');
                }
                return $this->postVisibility($f, $viewer, 'coach_audience', ['all', 'students', 'me']);
            case 'consent':
                return $this->postConsent($f, $viewer);
            case 'coach_showcase':
                return $this->postCoachShowcase($f, $viewer);
            case 'consent_request':
                return $this->postConsentRequest($f, $viewer);
            case 'celebrated':
                $this->app->store()->celebrate($viewer, self::intList(isset($f['events']) ? $f['events'] : null), self::intList(isset($f['rank_events']) ? $f['rank_events'] : null));
                return [200, ['ok' => true]];
            case 'seen':
                $this->app->store()->seen($viewer, self::intList(isset($f['notifications']) ? $f['notifications'] : null));
                return [200, ['ok' => true]];
        }
        return self::err(400, 'Неизвестное действие');
    }

    private function postShowcase(array $f, $viewer)
    {
        $ids = self::jsonList(isset($f['ids']) ? $f['ids'] : null);
        if ($ids === null) {
            return self::err(400, 'ids: нужен JSON-массив');
        }
        if (count($ids) > 3) {
            return self::err(400, 'На витрине до 3 достижений');
        }
        $avail = $this->app->features()->available('a', $this->app->catalog());
        $levels = $this->app->store()->levels($viewer, 'a');
        $clean = [];
        foreach ($ids as $id) {
            if (!is_string($id) || !isset($avail[$id]) || empty($levels[$id]['dates'])) {
                return self::err(400, 'На витрину можно поставить только полученные достижения');
            }
            if (in_array($id, $clean, true)) {
                return self::err(400, 'Достижение уже на витрине');
            }
            $clean[] = $id;
        }
        $this->app->store()->putSetting($viewer, ['showcase' => $clean]);
        return [200, ['ok' => true]];
    }

    private function postVisibility(array $f, $viewer, $field, array $allowed)
    {
        $a = isset($f['audience']) ? (string) $f['audience'] : '';
        if (!in_array($a, $allowed, true)) {
            return self::err(400, 'audience: ' . implode(' | ', $allowed));
        }
        $this->app->store()->putSetting($viewer, [$field => $a]);
        return [200, ['ok' => true]];
    }

    // the student answers his coach, or changes his mind later (any of his coaches, now or before)
    private function postConsent(array $f, $viewer)
    {
        $store = $this->app->store();
        $answer = isset($f['answer']) ? (string) $f['answer'] : '';
        if (!in_array($answer, ['yes', 'no'], true)) {
            return self::err(400, 'answer: yes | no');
        }
        if (isset($f['name_format']) && $f['name_format'] !== '') {
            if (!in_array($f['name_format'], Cards::FORMATS, true)) {
                return self::err(400, 'name_format: full | initial | anon');
            }
            $store->putSetting($viewer, ['name_format' => $f['name_format']]);
        }
        $coaches = [];
        foreach ($this->coachPeriods($viewer) as $p) {
            $coaches[$p['coach']] = true;
        }
        $coach = isset($f['coach']) && $f['coach'] !== '' ? (int) $f['coach'] : $this->currentCoach($viewer);
        if ($coach === null || !isset($coaches[$coach])) {
            return self::err(400, 'Нет такого тренера');
        }
        $old = $store->consent($coach, $viewer);
        $was = $old ? $old['status'] : 'none';
        $store->tx(function () use ($store, $coach, $viewer, $answer, $was) {
            $store->putConsent($coach, $viewer, $answer, null, $this->app->now());
            if ($answer === 'no') {
                // the athlete's cards leave the coach's showcase at once
                $keys = $store->setting($coach)['coach_showcase'];
                $keep = [];
                foreach ($keys as $k) {
                    $p = Cards::parseKey($k);
                    if (!$p || $p[0] !== $viewer) {
                        $keep[] = $k;
                    }
                }
                if (count($keep) !== count($keys)) {
                    $store->putSetting($coach, ['coach_showcase' => $keep]);
                }
            }
            if ($was !== $answer) {
                $name = $this->user($viewer);
                $store->dropNotifications($coach, 'c', 'consent_pending', 'consent:' . $viewer);
                $store->addNotification($coach, 'c', 'consent_answer', ['athlete' => $this->person($viewer, (string) $name, true), 'answer' => $answer], $this->app->today(), 'consent:' . $viewer);
            }
        });
        return [200, ['ok' => true]];
    }

    private function postCoachShowcase(array $f, $viewer)
    {
        if (!$this->app->source()->isCoach($viewer)) {
            return self::err(403, 'Только для тренера');
        }
        $keys = self::jsonList(isset($f['keys']) ? $f['keys'] : null);
        if ($keys === null) {
            return self::err(400, 'keys: нужен JSON-массив');
        }
        if (count($keys) > 6) {
            return self::err(400, 'На витрине до 6 карточек');
        }
        foreach ($keys as $k) {
            if (!is_string($k)) {
                return self::err(400, 'keys: строки');
            }
        }
        if (count(array_unique($keys)) !== count($keys)) {
            return self::err(400, 'Карточка уже на витрине');
        }
        $consents = $this->app->store()->consentsOfCoach($viewer);
        $resolved = $this->resolveKeys($viewer, $keys, $this->studentPeriods($viewer), $consents);
        foreach ($keys as $k) {
            if (!isset($resolved[$k])) {
                $p = Cards::parseKey($k);
                if ($p && (!isset($consents[$p[0]]) || $consents[$p[0]]['status'] !== 'yes')) {
                    return self::err(400, 'Нет согласия ученика на показ: ' . $k);
                }
                return self::err(400, 'Нет такой карточки: ' . $k);
            }
        }
        $this->app->store()->putSetting($viewer, ['coach_showcase' => array_values($keys)]);
        return [200, ['ok' => true]];
    }

    private function postConsentRequest(array $f, $viewer)
    {
        $app = $this->app;
        $store = $app->store();
        if (!$app->source()->isCoach($viewer)) {
            return self::err(403, 'Только для тренера');
        }
        $athlete = isset($f['athlete']) ? (int) $f['athlete'] : 0;
        if ($athlete <= 0 || !$this->isCurrentStudent($viewer, $athlete)) {
            return self::err(403, 'Это не ваш ученик');
        }
        $old = $store->consent($viewer, $athlete);
        $status = $old ? $old['status'] : 'none';
        if ($status === 'pending' || $status === 'yes') {
            return [200, ['ok' => true]];
        }
        if ($status === 'no' && $old['answered_at']) {
            $next = D::add(substr($old['answered_at'], 0, 10), self::REASK_DAYS);
            if ($app->today() < $next) {
                return self::err(400, 'Повторный запрос можно отправить с ' . Text::date($next));
            }
        }
        $store->tx(function () use ($store, $app, $viewer, $athlete) {
            $store->putConsent($viewer, $athlete, 'pending', $app->now(), null);
            $coach = $this->person($viewer, (string) $this->user($viewer));
            $ath = $this->person($athlete, (string) $this->user($athlete), true);
            $store->dropNotifications($athlete, 'a', 'consent_request', 'consent:' . $viewer);
            $store->addNotification($athlete, 'a', 'consent_request', ['coach' => $coach], $app->today(), 'consent:' . $viewer);
            $store->dropNotifications($viewer, 'c', 'consent_pending', 'consent:' . $athlete);
            $store->addNotification($viewer, 'c', 'consent_pending', ['athlete' => $ath], $app->today(), 'consent:' . $athlete);
        });
        return [200, ['ok' => true]];
    }
}
