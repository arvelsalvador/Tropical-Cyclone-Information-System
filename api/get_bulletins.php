<?php
require_once __DIR__ . '/../lib/config.php';

app_cors_headers();

$conn = app_db_open();

if ($conn->connect_error) {
    app_log('get_bulletins db connect failed');
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

// Per-cyclone fingerprint: bulletins change only on import, cache 5 min.
try {
    $fpStmt = $conn->prepare('SELECT COUNT(*) AS c, MAX(id) AS maxid FROM bulletins WHERE cyclone_id = ?');
    if ($fpStmt !== false) {
        $fpStmt->bind_param('i', $cycloneId);
        $fpStmt->execute();
        $fpRes = $fpStmt->get_result();
        if ($fpRes !== false) {
            $frow = $fpRes->fetch_assoc();
            $etag = '"' . md5($cycloneId . '|' . ($frow['c'] ?? '') . '|' . ($frow['maxid'] ?? '')) . '"';
            header('ETag: ' . $etag);
            if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
                http_response_code(304);
                $fpStmt->close();
                $conn->close();
                exit;
            }
        }
        $fpStmt->close();
    }
} catch (mysqli_sql_exception $e) {
    app_log('get_bulletins fingerprint failed: ' . $e->getMessage());
}

header('Cache-Control: public, max-age=300');

try {
    $stmt = $conn->prepare(
        "SELECT id, bulletin_number, r2_url FROM bulletins WHERE cyclone_id = ? ORDER BY bulletin_number ASC"
    );
    if ($stmt === false) {
        throw new mysqli_sql_exception('prepare failed');
    }
    $stmt->bind_param('i', $cycloneId);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result === false) {
        throw new mysqli_sql_exception('get_result failed');
    }
    $data = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
} catch (mysqli_sql_exception $e) {
    app_log('get_bulletins query failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Could not load bulletins']);
    exit;
} finally {
    $conn->close();
}

// A poisoned DB row must not become an open redirect / javascript: sink.
// Only allow http(s) bulletin URLs to reach the client.
$safe = [];
foreach ($data as $row) {
    $url = (string) ($row['r2_url'] ?? '');
    if ($url !== '' && !preg_match('#^https?://#i', $url)) {
        app_log('get_bulletins dropped non-http r2_url for cyclone ' . $cycloneId);
        continue;
    }
    $safe[] = $row;
}

echo json_encode($safe);
