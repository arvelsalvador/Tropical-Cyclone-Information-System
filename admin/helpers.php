<?php
// ===========================================================================
// Shared helpers for the admin portal pages.
//
// Extracted from edit-storm.php so every admin form page (upcoming storm,
// historical cyclones, ...) reuses the same connection and the same
// validation-display code instead of duplicating it.
// ===========================================================================

// Opens the cyclone_db connection in the exact way edit-storm.php always did:
// the connection itself is non-throwing (check $conn->connect_error), while
// statements executed after it report errors strictly.
function db_connect() {
    $conn = new mysqli('localhost', 'root', '', 'cyclone_db');
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    return $conn;
}

// After a failed validation, re-show what the user typed instead of stale DB values
function val($field) {
    global $current, $errors;
    if (!empty($errors) && array_key_exists($field, $_POST)) {
        return htmlspecialchars($_POST[$field] ?? '');
    }
    return htmlspecialchars($current[$field] ?? '');
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
    $current = val($field);
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
