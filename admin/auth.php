<?php
require_once __DIR__ . '/helpers.php';

admin_session_start();

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    // Absolute path so this works from /admin/ AND /tools/import_bulletins.php
    // (a relative 'login.php' would resolve to /tools/login.php and 404).
    $base = rtrim((string) app_config('APP_BASE_URL', '/Weather'), '/');
    header('Location: ' . $base . '/admin/login.php');
    exit;
}
?>