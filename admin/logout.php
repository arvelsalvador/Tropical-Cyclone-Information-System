<?php
require_once __DIR__ . '/helpers.php';

admin_session_start();

// Logging out must be a POST carrying a valid CSRF token: a plain GET link
// would let any third-party page force a logout (CSRF). A GET request only
// shows a small confirmation screen, so the action still works with
// JavaScript disabled.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        header('Location: login.php?loggedout=1');
        exit;
    }
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Log Out — Tropical Cyclone Information System</title>
  <meta name="robots" content="noindex, nofollow">
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

  <main class="admin-main admin-main--auth">
    <section class="admin-hero admin-hero--center">
      <div class="admin-hero-icon admin-hero-icon--red">
        <i class="fa-solid fa-right-from-bracket"></i>
      </div>
      <div>
        <h1 class="admin-hero-title">Log out</h1>
        <p class="admin-hero-sub">You are signed in as <strong><?php echo htmlspecialchars((string) ($_SESSION['admin_username'] ?? 'admin')); ?></strong>. Do you want to end this session?</p>
      </div>
    </section>

    <section class="admin-card">
      <form method="POST" action="logout.php">
        <?php echo csrf_field(); ?>
        <button type="submit" class="admin-btn admin-btn--inline">Yes, log me out</button>
        <a href="dashboard.php" class="form-cancel">Back to dashboard</a>
      </form>
    </section>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script src="../js/main.js"></script>
</body>
</html>
    <?php
    exit;
}

csrf_check();

// Clear every admin-related session value (login state, username, and any
// leftover password-reset state), then invalidate the session cookie.
$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params['path'],
        $params['domain'],
        $params['secure'],
        $params['httponly']
    );
}

session_destroy();

header('Location: login.php?loggedout=1');
exit;
