<?php
namespace S10Ach;

// /apiweb/achievements.php: JSON in the style of the site's other /apiweb files.
// 401 + null when logged out, 400/403/404 + {ok:false, error}, 500 on a server error (logged).
final class Http
{
    const J = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

    /** @return array [status, body] — no output, for tests and the dev server */
    public static function handle(App $app, $method, array $get, array $post, array $server)
    {
        try {
            if ($method === 'POST' && !self::originOk($app, $server)) {
                return [403, ['ok' => false, 'error' => 'Чужой источник запроса']];
            }
            $viewer = $app->source()->currentUserId();
            if (!$viewer) {
                return [401, null];
            }
            $svc = $app->service();
            if ($method === 'POST') {
                return $svc->post(isset($post['action']) ? (string) $post['action'] : '', $post, (int) $viewer);
            }
            if ($method === 'GET') {
                return $svc->get(isset($get['action']) ? (string) $get['action'] : '', isset($get['id']) ? $get['id'] : null, (int) $viewer);
            }
            return [405, ['ok' => false, 'error' => 'GET или POST']];
        } catch (\Throwable $e) {
            error_log('[achievements] ' . get_class($e) . ': ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
            return [500, ['ok' => false, 'error' => 'Ошибка сервера']];
        }
    }

    public static function serve(App $app)
    {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
        list($status, $body) = self::handle($app, $method, $_GET, $_POST, $_SERVER);
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        $json = json_encode($body, self::J);
        if ($json === false) {
            error_log('[achievements] json_encode: ' . json_last_error_msg());
            http_response_code(500);
            $json = '{"ok":false,"error":"Ошибка сервера"}';
        }
        echo $json;
    }

    // a POST from another site is refused (the session cookie alone is not proof of intent)
    private static function originOk(App $app, array $server)
    {
        $origin = isset($server['HTTP_ORIGIN']) ? (string) $server['HTTP_ORIGIN'] : '';
        if ($origin === '') {
            return true;
        }
        if (in_array($origin, (array) $app->config['allowed_origins'], true)) {
            return true;
        }
        $host = isset($server['HTTP_HOST']) ? strtolower((string) $server['HTTP_HOST']) : '';
        $oh = strtolower((string) parse_url($origin, PHP_URL_HOST));
        $port = parse_url($origin, PHP_URL_PORT);
        return $host !== '' && ($oh === $host || ($port && $oh . ':' . $port === $host));
    }
}
