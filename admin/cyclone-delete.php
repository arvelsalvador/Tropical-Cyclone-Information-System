<?php
require 'auth.php';
require_once 'helpers.php';

// ===========================================================================
// Delete a historical cyclone.
// POST with id = actually delete (bulletins first, then the cyclone, in one
// transaction), then redirect with banner. The admin must type AGREE into
// the confirmation box — the server denies anything else.
// GET with ?id=N = confirmation page with a Back button (no deletion yet).
// No id = back to the list.
// ===========================================================================

$confirmError = '';

// --- POST: perform the deletion -------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['id'])) {
    csrf_check();
    $id = (int) $_POST['id'];
    $confirmText = trim($_POST['confirm_text'] ?? '');

    if ($id <= 0) {
        header('Location: cyclones.php');
        exit;
    }

    $conn = db_connect();

    if ($conn->connect_error) {
        // Fall through to the confirm page with the connection error shown.
        $db_error = 'Database connection failed. Please check that MySQL is running.';
    } else {
        // Server-side gate: exact "AGREE" or nothing is deleted.
        if ($confirmText !== 'AGREE') {
            $confirmError = 'You must type AGREE to confirm deletion.';
        } else {
            try {
                $conn->begin_transaction();

                $stmt = $conn->prepare('DELETE FROM bulletins WHERE cyclone_id = ?');
                $stmt->bind_param('i', $id);
                $stmt->execute();
                $stmt->close();

                $stmt = $conn->prepare('DELETE FROM cyclones WHERE id = ?');
                $stmt->bind_param('i', $id);
                $stmt->execute();
                $stmt->close();

                $conn->commit();
                $conn->close();

                header('Location: cyclones.php?deleted=1');
                exit;
            } catch (mysqli_sql_exception $e) {
                $conn->rollback();
                $confirmError = 'Could not delete this cyclone. Please try again.';
            }
            $conn->close();
        }
    }

    // Denied or failed → fall through and re-render the confirmation
    // page below with the error (record is re-fetched there).
    // Keep the posted id so the page can reload the record.
    $_GET['id'] = $id;
}

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
if ($id <= 0) {
    header('Location: cyclones.php');
    exit;
}

$conn = db_connect();
$record = null;
$bulletinCount = 0;
if (!isset($db_error)) $db_error = '';

if ($conn->connect_error) {
    $db_error = 'Database connection failed. Please check that MySQL is running.';
} else {
    try {
        $stmt = $conn->prepare('SELECT id, local_name, international_name, year FROM cyclones WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $record = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($record) {
            $stmt = $conn->prepare('SELECT COUNT(*) AS c FROM bulletins WHERE cyclone_id = ?');
            $stmt->bind_param('i', $id);
            $stmt->execute();
            $bulletinCount = (int) $stmt->get_result()->fetch_assoc()['c'];
            $stmt->close();
        }
    } catch (mysqli_sql_exception $e) {
        $db_error = 'Could not load this cyclone. Please try again.';
        $record = null;
    }
    $conn->close();

    if (!$record && $db_error === '' && $confirmError === '') {
        header('Location: cyclones.php');
        exit;
    }
}

$displayName = $record
    ? ($record['international_name']
        ? cyclone_name($record['local_name']) . ' (' . $record['international_name'] . ')'
        : cyclone_name($record['local_name']))
    : '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delete Cyclone — Admin — Tropical Cyclone Information System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
  <link rel="stylesheet" href="../css/base.css" />
  <link rel="stylesheet" href="../assets/vendor/fontawesome/css/all.min.css" />
  <link rel="stylesheet" href="../css/components/footer.css" />
  <link rel="stylesheet" href="../css/admin.css" />
</head>
<body>
  <?php require 'nav.php'; ?>

  <main class="admin-main">
    <a class="admin-back" href="cyclones.php">
      <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
      Back to Historical Cyclones
    </a>

    <section class="admin-hero" data-reveal>
      <div class="admin-hero-icon admin-hero-icon--red">
        <i class="fa-solid fa-trash"></i>
      </div>
      <div>
        <h1 class="admin-hero-title">Delete Cyclone</h1>
        <p class="admin-hero-sub">
          <?php if ($record): ?>
            You are about to delete <strong><?php echo htmlspecialchars($displayName); ?> (<?php echo htmlspecialchars((string) $record['year']); ?>)</strong> — this cannot be undone.
          <?php else: ?>
            You are about to delete this cyclone — this cannot be undone.
          <?php endif; ?>
        </p>
      </div>
    </section>

    <section class="admin-card admin-card--form" data-reveal style="--reveal-delay: 0.08s">
      <?php if ($db_error !== ''): ?>
        <div class="alert alert-error">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span><?php echo htmlspecialchars($db_error); ?></span>
        </div>
        <a class="admin-btn admin-btn--inline" href="cyclones.php">Back to list</a>
      <?php elseif ($record): ?>
        <?php if ($confirmError !== ''): ?>
          <div class="alert alert-error">
            <i class="fa-solid fa-circle-exclamation"></i>
            <span><?php echo htmlspecialchars($confirmError); ?></span>
          </div>
        <?php endif; ?>
        <p class="admin-hero-sub" style="margin-bottom: 8px;">
          Deleting removes this record from the public Historical Data and Analysis Comparison pages immediately.
          <?php if ($bulletinCount > 0): ?>
            This will also permanently delete <strong><?php echo $bulletinCount; ?> archived bulletin<?php echo $bulletinCount === 1 ? '' : 's'; ?></strong>.
          <?php endif; ?>
        </p>
        <form method="POST" action="cyclone-delete.php" id="deleteConfirmForm" novalidate>
          <?php echo csrf_field(); ?>
          <input type="hidden" name="id" value="<?php echo (int) $record['id']; ?>">
          <div>
            <label for="f_confirm">Type <strong>AGREE</strong> to confirm</label>
            <input type="text" id="f_confirm" name="confirm_text" autocomplete="off"
                   placeholder="AGREE" value="">
          </div>
          <button type="submit" class="admin-btn admin-btn--inline admin-btn--danger" id="deleteConfirmBtn" disabled>
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
            Delete Cyclone
          </button>
          <a href="cyclones.php" class="form-cancel">Back</a>
        </form>
      <?php endif; ?>
    </section>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script>
    // The delete button stays disabled until the box reads exactly "AGREE".
    // The server re-checks on POST, so this is convenience, not security.
    (function () {
      var form = document.getElementById("deleteConfirmForm");
      if (!form) return;
      var input = document.getElementById("f_confirm");
      var btn = document.getElementById("deleteConfirmBtn");
      function sync() {
        btn.disabled = input.value !== "AGREE";
      }
      input.addEventListener("input", sync);
      sync();
    })();
  </script>
  <script src="../js/main.js" data-root="../"></script>
</body>
</html>
