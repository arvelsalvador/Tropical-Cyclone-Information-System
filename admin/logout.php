<?php
session_start();

// Clear every admin-related session value (login state, username, and any
// leftover password-reset state), then invalidate the session cookie.
$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

session_destroy();

header('Location: login.php?loggedout=1');
exit;
