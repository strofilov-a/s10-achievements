<?php
// The package itself: every file parses, nothing newer than PHP 7.4, generated files in sync, the adapter complete.

function phpFiles()
{
    $out = [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(dirname(__DIR__), FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if ($f->getExtension() === 'php' && strpos($f->getPathname(), '/dev/var/') === false) {
            $out[] = $f->getPathname();
        }
    }
    sort($out);
    return $out;
}

T::test('meta: php -l on every file', function () {
    foreach (phpFiles() as $f) {
        exec(escapeshellarg(PHP_BINARY) . ' -l ' . escapeshellarg($f) . ' 2>&1', $out, $code);
        T::eq(0, $code, $f . ': ' . implode(' ', $out));
    }
});

// PHP 7.4 on the server: no syntax or functions from 8.x, no mbstring
function compatProblems($file)
{
    $bad = [];
    $toks = token_get_all(file_get_contents($file));
    $sig = [];
    foreach ($toks as $i => $t) {
        if (is_array($t) && in_array($t[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT], true)) {
            continue;
        }
        $sig[] = $t;
    }
    $name = function ($t) {
        return is_array($t) ? token_name($t[0]) : $t;
    };
    $text = function ($t) {
        return is_array($t) ? $t[1] : $t;
    };
    $line = function ($t) {
        return is_array($t) ? $t[2] : 0;
    };
    $newer = ['T_MATCH' => 'match', 'T_NULLSAFE_OBJECT_OPERATOR' => '?->', 'T_ENUM' => 'enum', 'T_READONLY' => 'readonly', 'T_ATTRIBUTE' => '#[…]'];
    $funcs = ['str_contains', 'str_starts_with', 'str_ends_with', 'array_is_list', 'get_debug_type', 'fdiv', 'array_find', 'array_any', 'array_all'];
    $n = count($sig);
    $depth = 0;
    $inParams = false;
    $ctor = false;
    for ($i = 0; $i < $n; $i++) {
        $t = $sig[$i];
        $nm = $name($t);
        if (isset($newer[$nm])) {
            $bad[] = $newer[$nm] . ' at line ' . $line($t);
        }
        if ($nm === 'T_STRING') {
            $low = strtolower($text($t));
            $next = $i + 1 < $n ? $sig[$i + 1] : null;
            $prev = $i > 0 ? $sig[$i - 1] : null;
            if ($next === '(' && (in_array($low, $funcs, true) || strpos($low, 'mb_') === 0) && !($prev && in_array($name($prev), ['T_OBJECT_OPERATOR', 'T_DOUBLE_COLON', 'T_FUNCTION'], true))) {
                $bad[] = $low . '() at line ' . $line($t);
            }
            // named argument: name: inside a call
            if ($next === ':' && $prev !== null && ($prev === '(' || $prev === ',') && !($i + 2 < $n && $sig[$i + 2] === ':')) {
                $bad[] = 'named argument ' . $text($t) . ': at line ' . $line($t);
            }
        }
        if ($nm === 'T_FUNCTION' || $nm === 'T_FN') {
            // the parameter list
            $j = $i + 1;
            while ($j < $n && $sig[$j] !== '(') {
                if ($name($sig[$j]) === 'T_STRING') {
                    $ctor = strtolower($text($sig[$j])) === '__construct';
                }
                $j++;
            }
            $d = 0;
            for ($k = $j; $k < $n; $k++) {
                $x = $sig[$k];
                if ($x === '(') {
                    $d++;
                } elseif ($x === ')') {
                    $d--;
                    if ($d === 0) {
                        if ($sig[$k - 1] === ',') {
                            $bad[] = 'trailing comma in parameters at line ' . $line($t);
                        }
                        break;
                    }
                } elseif ($d === 1 && $x === '|') {
                    $bad[] = 'union type at line ' . $line($t);
                } elseif ($d === 1 && $ctor && in_array($name($x), ['T_PUBLIC', 'T_PRIVATE', 'T_PROTECTED'], true)) {
                    $bad[] = 'constructor promotion at line ' . $line($t);
                } elseif ($d === 1 && $x === '=' && $k + 1 < $n && strtolower($text($sig[$k + 1])) === 'null' && $k >= 2
                    && $name($sig[$k - 1]) === 'T_VARIABLE' && in_array($name($sig[$k - 2]), ['T_ARRAY', 'T_STRING', 'T_CALLABLE', 'T_NAME_QUALIFIED', 'T_NAME_FULLY_QUALIFIED'], true)) {
                    $bad[] = 'implicitly nullable typed parameter at line ' . $line($t);
                }
            }
        }
        if ($nm === 'T_CATCH') {
            $k = $i + 1;
            $var = false;
            while ($k < $n && $sig[$k] !== ')') {
                $var = $var || $name($sig[$k]) === 'T_VARIABLE';
                $k++;
            }
            if (!$var) {
                $bad[] = 'catch without a variable at line ' . $line($t);
            }
        }
        if ($nm === 'T_VARIABLE' && $i + 2 < $n && $name($sig[$i + 1]) === 'T_DOUBLE_COLON' && $name($sig[$i + 2]) === 'T_CLASS') {
            $bad[] = '$object::class at line ' . $line($t);
        }
        if ($t === '(' && $i + 2 < $n && $name($sig[$i + 1]) === 'T_ELLIPSIS' && $sig[$i + 2] === ')') {
            $bad[] = 'first-class callable at line ' . $line($t);
        }
    }
    return $bad;
}

T::test('meta: nothing newer than PHP 7.4 (match, ?->, named arguments, str_contains…, mbstring)', function () {
    T::ok(compatProblems(__FILE__) === [], 'the scanner flags itself');
    $probe = tempnam(sys_get_temp_dir(), 'ach');
    file_put_contents($probe, '<?php $a = match ($x) { 1 => 2 }; $b = $o?->p; f(name: 1); if (str_contains($a, "b")) {} mb_strlen($a); function g(int|string $x, array $y = null) {} try {} catch (E) {}');
    $found = compatProblems($probe);
    unlink($probe);
    T::eq(8, count($found), 'the scanner finds what it should: ' . implode('; ', $found));
    foreach (phpFiles() as $f) {
        $p = compatProblems($f);
        T::ok(!$p, basename($f) . ': ' . implode('; ', $p));
    }
});

T::test('meta: sql/achievements.sql is the generated schema', function () {
    T::eq(S10Ach\Schema::mysql(), file_get_contents(dirname(__DIR__) . '/sql/achievements.sql'), 'run: php backend/cli/schema.php > backend/sql/achievements.sql');
    foreach (S10Ach\Schema::statements('mysql') as $sql) {
        T::ok(preg_match('/^(-- .*\n)?CREATE TABLE IF NOT EXISTS `ach_[a-z_]+`/', $sql) === 1, 'ach_ prefix');
        T::ok(strpos($sql, 'utf8mb4') !== false && strpos($sql, 'InnoDB') !== false);
        T::ok(stripos($sql, '`rank`') === false, 'RANK is reserved in MySQL 8');
    }
});

T::test('meta: the catalog in the package is the catalog of the project', function () {
    $root = dirname(__DIR__, 2) . '/catalog';
    foreach (['athlete.json', 'coach.json', 'common.json'] as $f) {
        T::ok(is_file("$root/$f"), "$root/$f");
        T::eq(json_decode(file_get_contents("$root/$f"), true), json_decode(file_get_contents(ACH_LIB . "/catalog/$f"), true), "copy backend/achievements/catalog/$f from catalog/");
    }
    $cat = new S10Ach\Catalog(ACH_LIB . '/catalog');
    T::eq(56, count($cat->all('a')));
    T::eq(14, count($cat->all('c')));
    foreach (['a' => S10Ach\Engine\AthleteEngine::class, 'c' => S10Ach\Engine\CoachEngine::class] as $role => $engine) {
        foreach ($cat->entries($role) as $id => $e) {
            T::ok(method_exists($engine, 'm_' . $id), "an enabled $role achievement without a metric: $id");
            T::eq(count($e['thresholds']), count($e['card_number']), "$id card_number");
        }
    }
});

T::test('meta: the contract check itself sees an extra key and a changed type', function () {
    $mock = json_decode('{"a": 1, "items": [{"id": "x", "v": null}, {"id": "y", "v": 2}]}');
    T::eq([], shapeDiff($mock, ['a' => 5, 'items' => [['id' => 'z', 'v' => 3], ['id' => 'q', 'v' => null]]]));
    $d = shapeDiff($mock, ['a' => 5, 'items' => [['id' => 'z', 'v' => 3, 'extra' => true]]]);
    sort($d);
    T::eq(['$.items[].extra mock — / ours boolean', '$.items[].v mock null|number / ours number'], $d, 'an extra key, a type missing');
    T::ok(count(shapeDiff($mock, ['a' => '5', 'items' => []])) >= 2, 'a string for a number, no items');
});

T::test('meta: S10Source implements every Source method; the required ones say TODO until filled', function () {
    $r = new ReflectionClass(S10Ach\S10Source::class);
    T::ok($r->implementsInterface(S10Ach\Source::class));
    foreach ((new ReflectionClass(S10Ach\Source::class))->getMethods() as $m) {
        T::ok($r->hasMethod($m->getName()), $m->getName());
    }
    $s = new S10Ach\S10Source();
    foreach (['db', 'currentUserId', 'runs', 'plan', 'races', 'coaches', 'students', 'athleteIds', 'coachIds', 'changedUserIds', 'isCoach'] as $m) {
        try {
            $s->$m(1);
            T::ok(false, "$m should say TODO");
        } catch (RuntimeException $e) {
            T::ok(strpos($e->getMessage(), 'not filled in yet') !== false, $e->getMessage());
        }
    }
    foreach (['splits', 'masterPlans', 'reports', 'ownWeeks', 'intervals', 'challenges', 'rating', 'tournament', 'posts', 'likes', 'comments',
        'referrals', 'cities', 'clubSince', 'person', 'forecast', 'replies'] as $m) {
        T::eq(null, $s->$m(1), "$m is optional: null by default");
    }
    T::eq(false, $s->isSubscriber(1, 2));
    T::eq([], $s->users([]));
});
