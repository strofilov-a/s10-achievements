<?php
namespace S10Ach;

use S10Ach\Engine\AgeGrade;
use S10Ach\Engine\Boston;

// Wiring: the Source, our tables, the catalog, the settings, the clock.
final class App
{
    public $config;
    private $source;
    private $store;
    private $catalog;
    private $features;
    private $ageGrade = false;
    private $boston = false;
    private $tz;

    /** the site: S10Source and config.php */
    public static function fromConfig(array $override = [])
    {
        $config = array_merge(require ACH_LIB . '/config.php', $override);
        return new self(new S10Source(isset($config['site_root']) ? $config['site_root'] : null), $override);
    }

    public function __construct(Source $source, array $config = [])
    {
        $defaults = require ACH_LIB . '/config.php';
        $this->config = array_merge($defaults, $config);
        $this->source = $source;
        $this->tz = new \DateTimeZone($this->config['timezone']);
    }

    public function source()
    {
        return $this->source;
    }

    public function store()
    {
        if ($this->store === null) {
            $db = $this->source->db();
            if (!$db instanceof \PDO) {
                throw new \RuntimeException('S10Source::db() must return a PDO');
            }
            $this->store = new Store($db, function () {
                return $this->now();
            });
        }
        return $this->store;
    }

    public function catalog()
    {
        if ($this->catalog === null) {
            $this->catalog = new Catalog($this->config['catalog_dir']);
        }
        return $this->catalog;
    }

    public function features()
    {
        if ($this->features === null) {
            $this->features = new Features($this->store(), ['age_table' => $this->ageGrade() !== null, 'boston' => $this->boston() !== null]);
        }
        return $this->features;
    }

    public function ageGrade()
    {
        if ($this->ageGrade === false) {
            $this->ageGrade = AgeGrade::load($this->config['age_grade_file']);
        }
        return $this->ageGrade;
    }

    public function boston()
    {
        if ($this->boston === false) {
            $this->boston = Boston::load($this->config['boston_file']);
        }
        return $this->boston;
    }

    /** today in Moscow, YYYY-MM-DD */
    public function today()
    {
        if (!empty($this->config['today'])) {
            return $this->config['today'];
        }
        return (new \DateTime('now', $this->tz))->format('Y-m-d');
    }

    /** now in Moscow, YYYY-MM-DD HH:MM:SS (on a fixed «today» the clock still runs) */
    public function now()
    {
        $t = (new \DateTime('now', $this->tz))->format('H:i:s');
        return $this->today() . ' ' . $t;
    }

    /** let tests and the fixture set-up move the clock */
    public function setToday($ymd)
    {
        $this->config['today'] = $ymd;
    }

    /** key for the opaque ids of closed secrets */
    public function secret()
    {
        if (!empty($this->config['secret'])) {
            return (string) $this->config['secret'];
        }
        $s = $this->store()->meta('secret');
        if (!$s) {
            $s = bin2hex(random_bytes(16));
            $this->store()->putMeta('secret', $s);
        }
        return $s;
    }

    public function recalc()
    {
        return new Recalc($this);
    }

    public function service()
    {
        return new Service($this);
    }
}
