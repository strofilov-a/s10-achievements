<?php
namespace S10Ach;

use S10Ach\Engine\AthleteEngine;
use S10Ach\Engine\CoachEngine;

// Which optional data the site has. A Source method that returns null (not []) means «no such data on S10»;
// the achievements that need it are then not shown to anyone. What the recounts have seen is kept in ach_meta,
// so the pages know it without asking the Source. The nightly full pass rebuilds it from scratch.
final class Features
{
    private $store;
    private $files;
    private $seen;
    private $fresh;

    /** @param array $files ['age_table' => bool, 'boston' => bool] — tables present as files */
    public function __construct(Store $store, array $files)
    {
        $this->store = $store;
        $this->files = $files;
    }

    private function load()
    {
        if ($this->seen === null) {
            $v = json_decode((string) $this->store->meta('features', '{}'), true);
            $this->seen = is_array($v) ? $v : [];
        }
        return $this->seen;
    }

    /** remember data seen in a recount */
    public function seen(array $flags)
    {
        if ($this->fresh !== null) {
            $this->fresh += $flags;
        }
        $all = $this->load();
        $add = array_diff_key($flags, $all);
        if ($add) {
            $this->seen = $all + $add;
            ksort($this->seen);
            $this->store->putMeta('features', json_encode($this->seen));
        }
    }

    /** a full pass starts: collect afresh */
    public function begin()
    {
        $this->fresh = [];
    }

    /** a full pass ended: what it saw is now the whole truth */
    public function commit()
    {
        if ($this->fresh === null) {
            return;
        }
        ksort($this->fresh);
        $this->seen = $this->fresh;
        $this->store->putMeta('features', json_encode($this->seen));
        $this->fresh = null;
    }

    public function has($f)
    {
        if (isset($this->files[$f])) {
            return (bool) $this->files[$f];
        }
        $all = $this->load();
        return !empty($all[$f]);
    }

    public function all()
    {
        return $this->load() + array_filter($this->files);
    }

    /** enabled catalog entries the engine counts and the site has data for: [id => entry] */
    public function available($role, Catalog $cat)
    {
        $engine = $role === 'c' ? CoachEngine::class : AthleteEngine::class;
        $needs = $role === 'c' ? CoachEngine::NEEDS : AthleteEngine::NEEDS;
        $out = [];
        foreach ($cat->entries($role) as $id => $e) {
            if (!method_exists($engine, 'm_' . $id)) {
                continue;
            }
            $ok = true;
            foreach (isset($needs[$id]) ? $needs[$id] : [] as $f) {
                $ok = $ok && $this->has($f);
            }
            if ($ok) {
                $out[$id] = $e;
            }
        }
        return $out;
    }
}
