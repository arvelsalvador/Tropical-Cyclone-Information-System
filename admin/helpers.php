<?php
// ===========================================================================
// Shared helpers for the admin portal pages: one DB connection plus the
// validation-display code reused by every admin form page.
// ===========================================================================

require_once __DIR__ . '/../lib/config.php';

// Secure session starter: hardened cookie flags + idle timeout (30 min).
// Must be called INSTEAD of bare session_start().
function admin_session_start() {
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => $secure,
    ]);
    session_start();
    // Idle timeout: force re-login after 30 min of inactivity.
    $now = time();
    if (isset($_SESSION['admin_last_activity']) && ($now - (int) $_SESSION['admin_last_activity']) > 1800) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['admin_last_activity'] = $now;
}

// --- CSRF ---------------------------------------------------------------
function csrf_token() {
    admin_session_start();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field() {
    return '<input type="hidden" name="csrf_token" value="' . htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') . '">';
}

function csrf_check() {
    admin_session_start();
    $sent = $_POST['csrf_token'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if (!is_string($sent) || $sent === '' || !is_string($expected) || $expected === '' || !hash_equals($expected, $sent)) {
        http_response_code(419);
        exit('Session expired. Please reload the page and try again.');
    }
}

// Simple file-based throttle (no schema change): key = e.g. 'login:1.2.3.4'.
// Returns true when allowed, false when over $max attempts per $windowSecs.
function rate_limit_check($key, $max, $windowSecs) {
    $safe = preg_replace('/[^a-zA-Z0-9_:\.\-]/', '_', (string) $key);
    $file = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'weather_rl_' . md5($safe) . '.json';
    $now = time();
    $hits = [];
    if (is_file($file)) {
        $raw = @file_get_contents($file);
        $decoded = $raw !== false ? json_decode($raw, true) : null;
        if (is_array($decoded)) {
            foreach ($decoded as $t) {
                if (is_int($t) && ($now - $t) < $windowSecs) {
                    $hits[] = $t;
                }
            }
        }
    }
    if (count($hits) >= $max) {
        return false;
    }
    $hits[] = $now;
    @file_put_contents($file, json_encode($hits), LOCK_EX);
    return true;
}

// Opens the cyclone_db connection (alias of app_db_open() in lib/config.php):
// the connection itself is non-throwing (check $conn->connect_error), while
// statements executed after it report errors strictly.
function db_connect() {
    return app_db_open();
}

// After a failed validation, re-show what the user typed instead of stale DB values.
// Returns the RAW value; escape it at the output site with htmlspecialchars().
function raw_val($field) {
    global $current, $errors;
    if (!empty($errors) && array_key_exists($field, $_POST)) {
        return (string) ($_POST[$field] ?? '');
    }
    return (string) ($current[$field] ?? '');
}

// Escaped alias of raw_val() for plain text inputs / textareas.
function val($field) {
    return htmlspecialchars(raw_val($field), ENT_QUOTES, 'UTF-8');
}

function err($field) {
    global $errors;
    return isset($errors[$field]) ? '<div class="field-error">' . htmlspecialchars($errors[$field]) . '</div>' : '';
}

// Prints class="input-error" for fields that failed validation (red highlight)
function cls($field) {
    global $errors;
    return isset($errors[$field]) ? ' class="input-error"' : '';
}

// Title-Case a cyclone local name for display ("AGATON" -> "Agaton").
// Mirrors the public Historical Data toTitleCase rule; international names
// are intentionally left exactly as stored. Multibyte-safe.
function cyclone_name($name) {
    $name = (string) $name;
    if ($name === '') return $name;
    if (function_exists('mb_convert_case')) {
        return mb_convert_case(mb_strtolower($name, 'UTF-8'), MB_CASE_TITLE, 'UTF-8');
    }
    return ucwords(strtolower($name));
}

// Fixed PAGASA rainfall intensity scale. Single source of truth for the
// add/edit form, the list filter and the list page (was duplicated).
function rainfall_choices() {
    return array('Not detected', 'Light to Moderate', 'Moderate to Heavy', 'Heavy to Intense', 'Intense to Torrential');
}

// Full display names for the highest_category codes stored in the DB.
// $withCode = true appends the code in brackets ("Typhoon (TY)") for dropdowns.
function category_labels($withCode = false) {
    $labels = array(
        'TD'  => 'Tropical Depression',
        'TS'  => 'Tropical Storm',
        'STS' => 'Severe Tropical Storm',
        'TY'  => 'Typhoon',
        'STY' => 'Super Typhoon',
    );
    if (!$withCode) {
        return $labels;
    }
    $withCodeLabels = array();
    foreach ($labels as $code => $label) {
        $withCodeLabels[$code] = $label . ' (' . $code . ')';
    }
    return $withCodeLabels;
}

// Renders the <option> list for one of the form's dropdown fields.
// - A "— Select —" placeholder (empty value) shows when nothing is chosen yet.
// - The currently saved (or just-submitted) value is pre-selected.
// - If the stored value is not one of the fixed choices (e.g. legacy data
//   saved before the field became a dropdown), it is appended as an extra
//   option so saving never silently rewrites it.
// - $labels optionally maps option values to display text; the option's
//   value stays the clean string that gets saved. When omitted, the value
//   itself is displayed.
function options($field, array $choices, $placeholder = '&mdash; Select &mdash;', array $labels = null) {
    $current = raw_val($field);
    $labelFor = function ($value) use ($labels) {
        return ($labels !== null && array_key_exists($value, $labels)) ? $labels[$value] : $value;
    };
    $html = '<option value=""' . ($current === '' ? ' selected' : '') . ' disabled hidden>' . $placeholder . '</option>';
    foreach ($choices as $choice) {
        $html .= '<option value="' . htmlspecialchars($choice) . '"' . ($current === $choice ? ' selected' : '') . '>'
               . htmlspecialchars($labelFor($choice)) . '</option>';
    }
    if ($current !== '' && !in_array($current, $choices, true)) {
        $html .= '<option value="' . htmlspecialchars($current) . '" selected>' . htmlspecialchars($current) . ' (current)</option>';
    }
    return $html;
}
