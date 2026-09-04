<?php
require 'auth.php';
require 'helpers.php';

// ===========================================================================
// Delete a historical cyclone. POST-only so a stray GET link can never wipe
// a record; the list page confirms with the admin before submitting.
// ===========================================================================

if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !isset($_POST['id'])) {
    header('Location: cyclones.php');
    exit;
}

$id = (int) $_POST['id'];

$conn = db_connect();

if (!$conn->connect_error && $id > 0) {
    $stmt = $conn->prepare('DELETE FROM cyclones WHERE id = ?');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->close();
}

$conn->close();

header('Location: cyclones.php?deleted=1');
exit;
