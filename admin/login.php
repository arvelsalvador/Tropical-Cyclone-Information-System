<?php
session_start();

$error = "";
$notice = "";

// Status banners passed via the URL after logout or a password reset.
if (isset($_GET['reset']) && $_GET['reset'] === 'success') {
    $notice = "Password reset successful. Log in with your new password.";
} elseif (isset($_GET['loggedout']) && $_GET['loggedout'] === '1') {
    $notice = "You have been logged out.";
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';

    $conn = new mysqli('localhost', 'root', '', 'cyclone_db');

    if ($conn->connect_error) {
        $error = "Database connection failed.";
    } else {
        $stmt = $conn->prepare("SELECT id, password_hash FROM admins WHERE username = ?");
        $stmt->bind_param("s", $username);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 1) {
            $admin = $result->fetch_assoc();
            if (password_verify($password, $admin['password_hash'])) {
                $_SESSION['admin_logged_in'] = true;
                $_SESSION['admin_username'] = $username;
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
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login — Tropical Cyclone Information System</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
  <link rel="stylesheet" href="../css/base.css" />
  <link rel="stylesheet" href="../css/components/footer.css" />
  <link rel="stylesheet" href="../css/admin.css" />
</head>
<body>

  <main class="admin-main admin-main--auth">
    <section class="admin-hero admin-hero--center" data-reveal>
      <div class="admin-hero-icon">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <div>
        <h1 class="admin-hero-title">Admin Login</h1>
        <p class="admin-hero-sub">Sign in to manage storm data on the Tropical Cyclone Information System.</p>
      </div>
    </section>

    <section class="admin-card" data-reveal style="--reveal-delay: 0.08s">
      <?php if ($notice): ?>
        <div class="alert alert-success">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span><?php echo htmlspecialchars($notice); ?></span>
        </div>
      <?php endif; ?>
      <?php if ($error): ?>
        <div class="alert alert-error">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 11v5M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span><?php echo htmlspecialchars($error); ?></span>
        </div>
      <?php endif; ?>

      <form method="POST">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" placeholder="Username" required>

        <label for="passwordField">Password</label>
        <div class="pw-wrap">
          <input type="password" id="passwordField" name="password" placeholder="Password" required>
          <button type="button" class="pw-toggle" onclick="togglePassword(this)">Show</button>
        </div>

        <button type="submit" class="admin-btn">Log In</button>
      </form>

      <p class="admin-alt"><a href="forgot-password.php">Forgot password?</a></p>
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