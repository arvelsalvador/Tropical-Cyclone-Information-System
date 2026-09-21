<?php
require_once __DIR__ . '/helpers.php';

admin_session_start();

$error = "";
$notice = "";

// Status banners passed via the URL after logout or a password reset.
if (isset($_GET['reset']) && $_GET['reset'] === 'success') {
    $notice = "Password reset successful. Log in with your new password.";
} elseif (isset($_GET['loggedout']) && $_GET['loggedout'] === '1') {
    $notice = "You have been logged out.";
}

// Already signed in → skip the form.
if (isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true) {
    header('Location: dashboard.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!rate_limit_check('login:' . $ip, 10, 300)) {
        $error = "Too many login attempts. Please wait a few minutes and try again.";
    } else {
        $conn = db_connect();

        if ($conn->connect_error) {
            app_log('login db connect failed');
            $error = "Database connection failed.";
        } else {
            $stmt = $conn->prepare("SELECT id, password_hash FROM admins WHERE username = ?");
            $stmt->bind_param("s", $username);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows === 1) {
                $admin = $result->fetch_assoc();
                if (password_verify($password, $admin['password_hash'])) {
                    session_regenerate_id(true);
                    $_SESSION['admin_logged_in'] = true;
                    $_SESSION['admin_username'] = $username;
                    $_SESSION['admin_last_activity'] = time();
                    header('Location: dashboard.php');
                    exit;
                } else {
                    $error = "Incorrect username or password.";
                }
            } else {
                $error = "Incorrect username or password.";
            }

            $stmt->close();
            $conn->close();
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — Tropical Cyclone Information System</title>
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
    <section class="admin-hero admin-hero--center" data-reveal>
      <div class="admin-hero-icon">
        <i class="fa-solid fa-lock"></i>
      </div>
      <div>
        <h1 class="admin-hero-title">Admin Login</h1>
        <p class="admin-hero-sub">Sign in to manage storm data on the Tropical Cyclone Information System.</p>
      </div>
    </section>

    <section class="admin-card" data-reveal style="--reveal-delay: 0.08s">
      <?php if ($notice): ?>
        <div class="alert alert-success">
          <i class="fa-solid fa-circle-check"></i>
          <span><?php echo htmlspecialchars($notice); ?></span>
        </div>
      <?php endif; ?>
      <?php if ($error): ?>
        <div class="alert alert-error">
          <i class="fa-solid fa-circle-exclamation"></i>
          <span><?php echo htmlspecialchars($error); ?></span>
        </div>
      <?php endif; ?>

      <form method="POST">
        <?php echo csrf_field(); ?>
        <label for="username">Username</label>
        <input type="text" id="username" name="username" placeholder="Username" required>

        <label for="passwordField">Password</label>
        <div class="pw-wrap">
          <input type="password" id="passwordField" name="password" placeholder="Password" required>
          <button type="button" class="pw-toggle" onclick="togglePassword(this)">Show</button>
        </div>

        <button type="submit" class="admin-btn">Log In</button>
      </form>

      <p class="admin-alt">
        <a href="forgot-password.php">Forgot password?</a>
        <span class="admin-alt-sep" aria-hidden="true">·</span>
        <a href="../index.html">&larr; Back to Home</a>
      </p>
    </section>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script>
    function togglePassword(button) {
      const field = document.getElementById("passwordField");
      if (field.type === "password") {
        field.type = "text";
        button.textContent = "Hide";
      } else {
        field.type = "password";
        button.textContent = "Show";
      }
    }
  </script>
  <script src="../js/main.js" data-root="../"></script>
</body>
</html>