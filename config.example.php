<?php
// ===========================================================================
// config.example.php — TRACKED template. Copy to config.php (UNTRACKED) and
// fill in real values. config.php is in .gitignore and never committed.
//
//   Copy:  copy('config.example.php', 'config.php')  then edit config.php.
//
// Step 0 scaffolding only: nothing in the app reads this file yet.
// Step 1 will wire db_connect(), api/*, forgot-password.php, and
// import_bulletins.php to load config.php with getenv() fallback.
// ===========================================================================

return [
    // Database — replaces hardcoded new mysqli('localhost','root','','cyclone_db')
    // currently duplicated in: admin/helpers.php, admin/login.php,
    // admin/forgot-password.php, admin/reset-password.php,
    // api/get_cyclones.php, api/get_bulletins.php, api/get_upcoming_storm.php,
    // import_bulletins.php, scripts/__seed_admin.php
    'DB_HOST' => 'localhost',
    'DB_USER' => 'root',
    'DB_PASS' => '',
    'DB_NAME' => 'cyclone_db',

    // Public app URL + CORS allowlist.
    // CNAME currently holds "tropical_cyclone_weatherapp.com" (invalid DNS —
    // underscores don't resolve). Set APP_DOMAIN to the real production
    // domain once confirmed, e.g. 'tropical-cyclone-weatherapp.com'.
    // api/* currently send Access-Control-Allow-Origin: * (Step 1 restricts).
    'APP_BASE_URL' => '/Weather', // '' in prod if served from domain root
    'APP_DOMAIN'   => '',         // e.g. 'example.com' — empty = same-origin only

    // SMTP for admin/forgot-password.php.
    // WARNING: the app-password previously hardcoded in forgot-password.php
    // (arvelsalvador@gmail.com / xhle ...) must be REVOKED in the Google
    // account as compromised, then a fresh app-password placed ONLY in
    // config.php (never committed). Generic failure messages (Step 1) will
    // stop exposing $mail->ErrorInfo to the browser.
    'SMTP_HOST'   => 'smtp.gmail.com',
    'SMTP_PORT'   => 587,
    'SMTP_SECURE' => 'tls',
    'SMTP_USER'   => '',
    'SMTP_PASS'   => '', // fresh app-password goes here (config.php only)
    'SMTP_FROM'   => '',
    'SMTP_FROM_NAME' => 'Tropical Cyclone Info System',

    // One-time import script defaults (import_bulletins.php currently
    // hardcodes both of these; Step 1 moves them here).
    'R2_PUBLIC_BASE'  => 'https://pub-d18dd40b0f164c4eab0bcc9308b66340.r2.dev',
    'LOCAL_DATA_PATH' => '', // e.g. local folder with year subfolders; empty = disabled
];
