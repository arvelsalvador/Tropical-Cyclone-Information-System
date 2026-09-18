<?php
/**
 * One-time import script.
 * Scans the local "Weather Data" folder, matches each PDF to a cyclone
 * in the database (by name + year), and inserts a row into `bulletins`
 * pointing to the file's public R2 URL.
 *
 * HOW TO RUN:
 * 1. Save this file inside C:\xampp\htdocs\Weather\  (e.g. as import_bulletins.php)
 * 2. Open your browser and go to: http://localhost/Weather/import_bulletins.php
 * 3. Read the output — it will list what was imported and flag anything
 *    that couldn't be matched.
 * 4. Delete this file afterwards (or move it out of htdocs) since it's a
 *    one-time tool, not something that should stay live on your site.
 */

header('Content-Type: text/plain'); // plain text output, easy to read

// ---------------------------------------------------------------------
// CONFIG — adjust these two values if needed
// ---------------------------------------------------------------------

// Local folder that contains the year folders (2022, 2023, 2024, 2025...)
$localBasePath = 'C:\Users\Arvel\Desktop\Weather Data';

// Your R2 public URL prefix (bucket root — object keys are
// <year>/<CycloneName>/<file>.pdf, no extra prefix).
// Public URL pattern:
$r2PublicBase = 'https://pub-d18dd40b0f164c4eab0bcc9308b66340.r2.dev';

// ---------------------------------------------------------------------
// DB CONNECTION
// ---------------------------------------------------------------------
$conn = new mysqli('localhost', 'root', '', 'cyclone_db');
if ($conn->connect_error) {
    die("Database connection failed: " . $conn->connect_error);
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

$imported = 0;
$skipped = 0;
$skippedList = [];

// ---------------------------------------------------------------------
// WALK THE LOCAL FOLDER: Weather Data / <year> / <CycloneName> / *.pdf
// ---------------------------------------------------------------------
$yearDirs = glob($localBasePath . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR);

foreach ($yearDirs as $yearDir) {
    $year = basename($yearDir);
    if (!ctype_digit($year)) continue; // skip anything that isn't a year folder

    $cycloneDirs = glob($yearDir . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR);

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
