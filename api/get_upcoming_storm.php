<?php
require_once __DIR__ . '/../lib/config.php';

app_cors_headers();
header('Cache-Control: no-store'); // always serve the latest admin values

$conn = app_db_open();

if ($conn->connect_error) {
    app_log('get_upcoming_storm db connect failed');
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Only the ACTIVE storm profile is sent to the public site. When the admin
// has set it to "NONE" (is_active = 0) — a storm has passed with nothing
// replacing it yet — the query returns nothing and the public JS shows the
// "No active tropical cyclone" empty state.
// Explicit columns: never SELECT * (future sensitive columns stay private).
$sql = 'SELECT id, storm_name, status, max_wind, category, movement_speed, '
    . 'movement_direction, pagasa_signal, signal_area, central_pressure, '
    . 'forecast_landfall_date, forecast_landfall_note, location_note, '
    . 'advisory_notes, updated_at, is_active '
    . 'FROM upcoming_storm WHERE is_active = 1 ORDER BY id LIMIT 1';

try {
    $result = $conn->query($sql);
    if ($result === false) {
        throw new mysqli_sql_exception('query failed');
    }
    $row = $result->fetch_assoc();
} catch (mysqli_sql_exception $e) {
    app_log('get_upcoming_storm query failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Could not load upcoming storm']);
    exit;
} finally {
    $conn->close();
}

echo json_encode($row);
