<?php
// ===========================================================================
// lib/config.php — central runtime config + CORS helper (Step 1 security).
// Reads, in precedence order: getenv() > config.php (untracked copy of
// config.example.php) > built-in local defaults. Never contains real secrets;
// real secrets live ONLY in config.php / environment (both git-ignored).
// ===========================================================================

function app_config($key, $default = null) {
    static $cache = null;
    if ($cache === null) {
        $cache = [
            'DB_HOST' => 'localhost',
            'DB_USER' => 'root',
            'DB_PASS' => '',
            'DB_NAME' => 'cyclone_db',
            'APP_BASE_URL' => '/Weather',
            'APP_DOMAIN' => '',
            'SMTP_HOST' => 'smtp.gmail.com',
            'SMTP_PORT' => 587,
            'SMTP_SECURE' => 'tls',
            'SMTP_USER' => '',
            'SMTP_PASS' => '',
            'SMTP_FROM' => '',
            'SMTP_FROM_NAME' => 'Tropical Cyclone Info System',
            'R2_PUBLIC_BASE' => 'https://pub-d18dd40b0f164c4eab0bcc9308b66340.r2.dev',
            'LOCAL_DATA_PATH' => '',
        ];
        // Untracked local override: <root>/config.php (copy of config.example.php).
        $candidates = [
            __DIR__ . '/../config.php',
            __DIR__ . '/../../config.php',
        ];
        foreach ($candidates as $file) {
            if (is_file($file)) {
                $override = include $file;
                if (is_array($override)) {
                    foreach ($override as $k => $v) {
                        if (array_key_exists($k, $cache) && $v !== '' && $v !== null) {
                            $cache[$k] = $v;
                        } elseif (!array_key_exists($k, $cache)) {
                            $cache[$k] = $v;
                        }
                    }
                }
                break;
            }
        }
    }
    // Environment always wins when set (cPanel / Docker / CI).
    $env = getenv($key);
    if ($env !== false && $env !== '') {
        if ($key === 'SMTP_PORT') return (int) $env;
        return $env;
    }
    return array_key_exists($key, $cache) ? $cache[$key] : $default;
}

function app_db_open() {
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $conn = new mysqli(
        app_config('DB_HOST', 'localhost'),
        app_config('DB_USER', 'root'),
        app_config('DB_PASS', ''),
        app_config('DB_NAME', 'cyclone_db')
    );
    // Non-throwing connect check stays the caller's job ($conn->connect_error),
    // matching existing code; charset failure must not break the page.
    if (!$conn->connect_error) {
        @$conn->set_charset('utf8mb4');
    }
    return $conn;
}

// Sends JSON content-type + restrictive CORS. Empty APP_DOMAIN = same-origin
// only (no ACAO header). When APP_DOMAIN is set, only that exact origin
// (https + http for local dev) is echoed back with Vary: Origin.
function app_cors_headers() {
    header('Content-Type: application/json');
    $domain = trim((string) app_config('APP_DOMAIN', ''));
    if ($domain === '') {
        return; // same-origin only: no Access-Control-Allow-Origin header
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = ['https://' . $domain, 'http://' . $domain];
    if ($origin !== '' && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
    // Preflight support without opening methods to the world.
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        header('Access-Control-Allow-Methods: GET, OPTIONS');
        header('Access-Control-Max-Age: 86400');
        exit;
    }
}

function app_log($msg) {
    error_log('[weather-app] ' . $msg);
}
