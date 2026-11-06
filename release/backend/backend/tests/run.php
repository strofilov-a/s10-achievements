<?php
// Tests: php backend/tests/run.php [name filter]. No PHPUnit; exit code 1 on any failure.
// Every notice or warning fails the test that caused it.

error_reporting(E_ALL);
ini_set('display_errors', '1');
set_error_handler(function ($no, $str, $file, $line) {
    if (!(error_reporting() & $no)) {
        return false;
    }
    throw new ErrorException($str, 0, $no, $file, $line);
});

require __DIR__ . '/fixtures/Setup.php';
S10Ach\Tests\Setup::load();

final class T
{
    private static $tests = [];
    public static $checks = 0;

    public static function test($name, callable $fn)
    {
        self::$tests[] = [$name, $fn];
    }

    public static function ok($cond, $msg = 'expected true')
    {
        self::$checks++;
        if (!$cond) {
            throw new RuntimeException($msg);
        }
    }

    public static function eq($want, $got, $msg = '')
    {
        self::$checks++;
        if ($want !== $got) {
            throw new RuntimeException(($msg !== '' ? $msg . ': ' : '') . 'expected ' . self::show($want) . ', got ' . self::show($got));
        }
    }

    public static function show($v)
    {
        $s = json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        return strlen($s) > 400 ? substr($s, 0, 400) . '…' : $s;
    }

    public static function run($filter)
    {
        $failed = 0;
        $passed = 0;
        $t0 = microtime(true);
        foreach (self::$tests as $t) {
            if ($filter !== null && stripos($t[0], $filter) === false) {
                continue;
            }
            try {
                $t[1]();
                $passed++;
                echo "  ok    {$t[0]}\n";
            } catch (Throwable $e) {
                $failed++;
                echo "  FAIL  {$t[0]}\n        " . get_class($e) . ': ' . $e->getMessage() . "\n        at " . basename($e->getFile()) . ':' . $e->getLine() . "\n";
            }
        }
        printf("\n%s: %d passed, %d failed, %d checks, %.1fs\n", $failed ? 'FAILED' : 'OK', $passed, $failed, self::$checks, microtime(true) - $t0);
        exit($failed ? 1 : 0);
    }
}

// a populated fixture site; $fresh = a new copy for tests that change it
function site($fresh = false)
{
    static $cut = null;
    static $shared = null;
    if ($cut === null) {
        $cut = S10Ach\Tests\Setup::cut(S10Ach\Tests\World::build());
    }
    if ($shared !== null && !$fresh) {
        return $shared;
    }
    $w = S10Ach\Tests\World::build();
    list($app, $src) = S10Ach\Tests\Setup::app($w);
    S10Ach\Tests\Setup::populate($app, $src, $cut);
    $site = [$app, $src];
    if (!$fresh) {
        $shared = $site;
    }
    return $site;
}

// GET or POST as a user, through the same code as /apiweb/achievements.php
function call(array $site, $viewer, $method, array $args)
{
    $site[1]->viewer = $viewer;
    return S10Ach\Http::handle($site[0], $method, $method === 'GET' ? $args : [], $method === 'POST' ? $args : [], []);
}

foreach (glob(__DIR__ . '/*_test.php') as $f) {
    require $f;
}

T::run(isset($argv[1]) ? $argv[1] : null);
