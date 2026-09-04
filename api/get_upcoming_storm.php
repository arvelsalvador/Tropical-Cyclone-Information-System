<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store'); // always serve the latest admin values

$conn = new mysqli('localhost', 'root', '', 'cyclone_db');

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Only the ACTIVE storm profile is sent to the public site. When the admin
// has set it to "NONE" (is_active = 0) — a storm has passed with nothing
// replacing it yet — the query returns nothing and the public JS shows the
// "No active tropical cyclone" empty state.
$result = $conn->query('SELECT * FROM upcoming_storm WHERE is_active = 1 ORDER BY id LIMIT 1');
$row = $result->fetch_assoc();

echo json_encode($row);

$conn->close();
?>
