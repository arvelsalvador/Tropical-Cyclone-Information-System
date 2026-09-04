<?php
// TEMPORARY test helper — creates the __flowtest admin for the automated
// HTTP flow test. Deleted right after the test run; never shipped.
$c = new mysqli('localhost', 'root', '', 'cyclone_db');

// Start clean in case a previous run left it behind
$c->query("DELETE FROM admins WHERE username = '__flowtest'");

$hash = password_hash('FlowTest#2026', PASSWORD_DEFAULT);
$stmt = $c->prepare("INSERT INTO admins (username, email, password_hash) VALUES (?, NULL, ?)");
$user = '__flowtest';
$stmt->bind_param('ss', $user, $hash);
$stmt->execute();
$stmt->close();
$c->close();
echo 'TEMP_ADMIN_CREATED';
