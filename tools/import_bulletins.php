<?php
/**
 * One-time import script — NOW LOCKED DOWN (Step 1 security).
 * Requires an admin login (admin/auth.php) and a POSTed CSRF token.
 * GET shows instructions only and performs NO database writes.
 *
 * Scans the local "Weather Data" folder, matches each PDF to a cyclone
 * in the database (by name + year), and inserts a row into `bulletins`
 * pointing to the file's public R2 URL.
 */

require_once __DIR__ . '/../admin/auth.php';
require_once __DIR__ . '/../admin/helpers.php';

header('Content-Type: text/plain'); // plain text output, easy to read

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo "Admin-only import tool.\n";
    echo "Submit a POST request with a valid CSRF token to run the import.\n";
    echo "CSRF token: " . csrf_token() . "\n";
    exit;
}

csrf_check();

// ---------------------------------------------------------------------
// CONFIG — from config.php / environment (never hardcoded secrets here)
// ---------------------------------------------------------------------
$localBasePath = (string) app_config('LOCAL_DATA_PATH', '');
$r2PublicBase = (string) app_config('R2_PUBLIC_BASE', '');

if ($localBasePath === '' || $r2PublicBase === '') {
    http_response_code(500);
    echo "Import is disabled: set LOCAL_DATA_PATH and R2_PUBLIC_BASE in config.php first.\n";
    exit;
}

// ---------------------------------------------------------------------
// DB CONNECTION
// ---------------------------------------------------------------------
$conn = app_db_open();
if ($conn->connect_error) {
    app_log('import_bulletins db connect failed');
    http_response_code(500);
    echo "Database connection failed.\n";
    exit;
}

// Load all cyclones into memory for matching: key = "lowername|year"
$cyclones = [];
$res = $conn->query("SELECT id, local_name, year FROM cyclones");
while ($row = $res->fetch_assoc()) {
    $key = strtolower(trim($row['local_name'])) . '|' . $row['year'];
    $cyclones[$key] = $row['id'];
}

echo "Loaded " . count($cyclones) . " cyclones from database.\n\n";

// ---------------------------------------------------------------------
// PREPARE INSERT STATEMENT
// ---------------------------------------------------------------------
$stmt = $conn->prepare(
    "INSERT INTO bulletins (cyclone_id, bulletin_number, r2_url) VALUES (?, ?, ?)"
);

// Prevents duplicate rows if this script is ever run more than once.
$checkStmt = $conn->prepare(
    "SELECT id FROM bulletins WHERE cyclone_id = ? AND bulletin_number = ?"
);

if ($stmt === false || $checkStmt === false || $res === false) {
    app_log('import_bulletins prepare/query failed');
    http_response_code(500);
    echo "Import failed to initialize.\n";
    $conn->close();
    exit;
}

$imported = 0;
$skipped = 0;
$skippedList = [];

// ---------------------------------------------------------------------
// WALK THE LOCAL FOLDER: Weather Data / <year> / <CycloneName> / *.pdf
// ---------------------------------------------------------------------
$yearDirs = glob($localBasePath . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR);
if ($yearDirs === false) {
    $yearDirs = [];
}

foreach ($yearDirs as $yearDir) {
    $year = basename($yearDir);
    if (!ctype_digit($year)) continue; // skip anything that isn't a year folder

    $cycloneDirs = glob($yearDir . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR);
    if ($cycloneDirs === false) {
        continue;
    }

    foreach ($cycloneDirs as $cycloneDir) {
        $cycloneName = basename($cycloneDir); // e.g. "Agaton"
        $matchKey = strtolower($cycloneName) . '|' . $year;

        if (!isset($cyclones[$matchKey])) {
            $skipped++;
            $skippedList[] = "$cycloneName ($year) — no matching cyclone in database";
            continue;
        }

        $cycloneId = $cyclones[$matchKey];

        $pdfFiles = glob($cycloneDir . DIRECTORY_SEPARATOR . '*.pdf');
        if ($pdfFiles === false) {
            continue;
        }

        foreach ($pdfFiles as $pdfPath) {
            $fileName = basename($pdfPath); // e.g. "Agaton Bulletin 1.pdf"

            // Extract the bulletin number from the filename
            if (preg_match('/Bulletin\s+(\d+)/i', $fileName, $m)) {
                $bulletinNumber = (int)$m[1];
            } else {
                $skipped++;
                $skippedList[] = "$fileName — could not find bulletin number in filename";
                continue;
            }

            // Build the public R2 URL, matching the same path structure
            // used in the bucket: <year>/<CycloneName>/<file>.pdf
            $encodedCyclone = rawurlencode($cycloneName);
            $encodedFile = rawurlencode($fileName);
            $r2Url = "$r2PublicBase/$year/$encodedCyclone/$encodedFile";

            // Skip if this cyclone + bulletin number combo already exists
            $checkStmt->bind_param('ii', $cycloneId, $bulletinNumber);
            $checkStmt->execute();
            $checkStmt->store_result();
            if ($checkStmt->num_rows > 0) {
                $checkStmt->free_result();
                continue; // already imported, skip silently
            }
            $checkStmt->free_result();

            $stmt->bind_param('iis', $cycloneId, $bulletinNumber, $r2Url);
            $stmt->execute();
            $imported++;
        }
    }
}

// ---------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------
echo "Import complete.\n";
echo "Imported: $imported bulletins\n";
echo "Skipped: $skipped\n\n";

if (count($skippedList) > 0) {
    echo "Skipped items (review these):\n";
    foreach ($skippedList as $item) {
        echo " - $item\n";
    }
}

$stmt->close();
$checkStmt->close();
$conn->close();
