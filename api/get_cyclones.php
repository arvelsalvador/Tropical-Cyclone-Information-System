<?php
require_once __DIR__ . '/../lib/config.php';

app_cors_headers();

$conn = app_db_open();

if ($conn->connect_error) {
    app_log('get_cyclones db connect failed');
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Fingerprint for ETag (CHECKSUM TABLE: any edit to any column changes it).
try {
    $fp = $conn->query('CHECKSUM TABLE cyclones');
    if ($fp !== false) {
        $row = $fp->fetch_assoc();
        $etag = '"' . md5((string) ($row['Checksum'] ?? '')) . '"';
        header('ETag: ' . $etag);
        if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
            http_response_code(304);
            $conn->close();
            exit;
        }
    }
} catch (mysqli_sql_exception $e) {
    app_log('get_cyclones fingerprint failed: ' . $e->getMessage());
}

header('Cache-Control: public, no-cache');

// Explicit column list (never SELECT *): new sensitive columns must be
// allow-listed here before they become public.
$sql = 'SELECT id, local_name, international_name, year, date_start, date_end, '
    . 'highest_category, highest_strength, rainfall_category, '
    . 'tcws_country, tcws_slprsd_area, tcws_region5, tcws_camarines_norte '
    . 'FROM cyclones ORDER BY year, date_start';

try {
    $result = $conn->query($sql);
    if ($result === false) {
        throw new mysqli_sql_exception('query failed');
    }
    $data = $result->fetch_all(MYSQLI_ASSOC);
} catch (mysqli_sql_exception $e) {
    app_log('get_cyclones query failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Could not load cyclones']);
    exit;
} finally {
    $conn->close();
}

echo json_encode($data);
