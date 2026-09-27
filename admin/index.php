<?php
// Keeps /admin/ from showing a directory listing and sends visitors straight
// to the login screen (or the dashboard when they are already signed in).
require_once __DIR__ . '/helpers.php';

admin_session_start();

$base = rtrim((string) app_config('APP_BASE_URL', '/Weather'), '/');

if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
    header('Location: ' . $base . '/admin/dashboard.php');
    exit;
}

header('Location: ' . $base . '/admin/login.php');
exit;
