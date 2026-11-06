<?php
namespace S10Ach\Tests;

use S10Ach\Source;

// The Source over a World: what S10Source does with SQL, done on arrays. $asOf hides everything later.
final class FixtureSource implements Source
{
    public $w;
    public $viewer;
    public $asOf;
    public $changed = [];
    private $db;

    public function __construct(World $w, \PDO $db)
    {
        $this->w = $w;
        $this->db = $db;
    }

    public function db()
    {
        return $this->db;
    }

    public function currentUserId()
    {
        return $this->viewer;
    }

    public function users(array $ids)
    {
        $out = [];
        foreach ($ids as $id) {
            if (isset($this->w->users[(int) $id])) {
                $out[(int) $id] = $this->w->users[(int) $id];
            }
        }
        return $out;
    }

    public function isCoach($userId)
    {
        return isset($this->w->coaches[(int) $userId]);
    }

    public function isSubscriber($viewerId, $ownerId)
    {
        return !empty($this->w->subs[(int) $viewerId][(int) $ownerId]);
    }

    public function athleteIds()
    {
        $out = [];
        foreach ($this->w->users as $id => $u) {
            if (!isset($this->w->coaches[$id])) {
                $out[] = $id;
            }
        }
        return $out;
    }

    public function coachIds()
    {
        return array_keys($this->w->coaches);
    }

    public function changedUserIds($since)
    {
        return $this->changed;
    }

    private function get($k, $uid, $field = 'date')
    {
        if (!empty($this->w->missing[$k])) {
            return null;
        }
        $v = isset($this->w->{$k}[(int) $uid]) ? $this->w->{$k}[(int) $uid] : [];
        return $this->w->filter($v, $this->asOf, $field);
    }

    public function runs($userId)
    {
        return $this->get('runs', $userId, 'start');
    }

    public function splits($userId)
    {
        if (!empty($this->w->missing['splits'])) {
            return null;
        }
        return isset($this->w->splits[(int) $userId]) ? $this->w->splits[(int) $userId] : [];
    }

    public function plan($userId)
    {
        return $this->get('plan', $userId);
    }

    public function races($userId)
    {
        $out = [];
        foreach ($this->get('races', $userId) as $r) {
            $out[] = $r;
        }
        // a race planned but not run yet
        if ($this->asOf !== null) {
            foreach (isset($this->w->races[(int) $userId]) ? $this->w->races[(int) $userId] : [] as $r) {
                if ($r['date'] > $this->asOf) {
                    $r['sec'] = null;
                    $out[] = $r;
                }
            }
        }
        return $out;
    }

    public function masterPlans($userId)
    {
        return $this->get('masterPlans', $userId, 'from');
    }

    public function reports($userId)
    {
        return $this->get('reports', $userId);
    }

    public function ownWeeks($userId)
    {
        return $this->get('ownWeeks', $userId);
    }

    public function intervals($userId)
    {
        return $this->get('intervals', $userId);
    }

    public function challenges($userId)
    {
        return $this->get('challenges', $userId);
    }

    public function rating($userId)
    {
        return $this->get('rating', $userId);
    }

    public function tournament($userId)
    {
        return $this->get('tournament', $userId);
    }

    public function posts($userId)
    {
        return $this->get('posts', $userId);
    }

    public function likes($userId)
    {
        return $this->get('likes', $userId);
    }

    public function comments($userId)
    {
        return $this->get('comments', $userId);
    }

    public function referrals($userId)
    {
        return null; // no referral links on S10 yet
    }

    public function cities($userId)
    {
        return null; // no geocoding yet
    }

    public function clubSince($userId)
    {
        if (!empty($this->w->missing['clubSince'])) {
            return null;
        }
        $c = isset($this->w->club[(int) $userId]) ? $this->w->club[(int) $userId] : '';
        return ($c !== '' && $this->asOf !== null && $c > $this->asOf) ? '' : $c;
    }

    public function person($userId)
    {
        if (!empty($this->w->missing['person'])) {
            return null;
        }
        return isset($this->w->person[(int) $userId]) ? $this->w->person[(int) $userId] : ['birth' => null, 'sex' => null];
    }

    public function forecast($userId)
    {
        return isset($this->w->forecast[(int) $userId]) ? $this->w->forecast[(int) $userId] : null;
    }

    private function periods($key, $id)
    {
        $out = [];
        foreach ($this->w->stints as $s) {
            if ($s[$key] !== (int) $id || ($this->asOf !== null && $s['from'] > $this->asOf)) {
                continue;
            }
            if ($this->asOf !== null && $s['to'] !== null && $s['to'] > $this->asOf) {
                $s['to'] = null; // on that day he was still with the coach
            }
            $out[] = $s;
        }
        return $out;
    }

    public function coaches($athleteId)
    {
        return $this->periods('athlete_id', $athleteId);
    }

    public function students($coachId)
    {
        return $this->periods('coach_id', $coachId);
    }

    public function replies($coachId)
    {
        if (!empty($this->w->missing['replies'])) {
            return null;
        }
        $out = [];
        foreach (isset($this->w->replies[(int) $coachId]) ? $this->w->replies[(int) $coachId] : [] as $r) {
            if ($this->asOf !== null && substr($r['report_at'], 0, 10) > $this->asOf) {
                continue;
            }
            if ($this->asOf !== null && $r['reply_at'] !== null && substr($r['reply_at'], 0, 10) > $this->asOf) {
                $r['reply_at'] = null;
            }
            $out[] = $r;
        }
        return $out;
    }
}
