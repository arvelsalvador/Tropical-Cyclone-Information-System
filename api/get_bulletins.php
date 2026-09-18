<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$conn = new mysqli('localhost', 'root', '', 'cyclone_db');

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Expecting a cyclone_id in the query string, e.g.
// get_bulletins.php?cyclone_id=5
if (!isset($_GET['cyclone_id']) || !ctype_digit($_GET['cyclone_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid cyclone_id']);
    exit;
}

$cycloneId = (int) $_GET['cyclone_id'];

$stmt = $conn->prepare(
    "SELECT id, bulletin_number, r2_url FROM bulletins WHERE cyclone_id = ? ORDER BY bulletin_number ASC"
);
$stmt->bind_param('i', $cycloneId);
$stmt->execute();
$result = $stmt->get_result();
$data = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode($data);

$stmt->close();
$conn->close();
