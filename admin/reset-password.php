<?php
session_start();

if (!isset($_SESSION['reset_email'])) {
    header('Location: forgot-password.php');
    exit;
}

$email = $_SESSION['reset_email'];
$message = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $code = $_POST['code'] ?? '';
    $newPassword = $_POST['new_password'] ?? '';

    $conn = new mysqli('localhost', 'root', '', 'cyclone_db');

    $stmt = $conn->prepare("SELECT id FROM admins WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $admin = $result->fetch_assoc();
        $adminId = $admin['id'];

        $checkStmt = $conn->prepare("SELECT id FROM password_resets WHERE admin_id = ? AND code = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1");
        $checkStmt->bind_param("is", $adminId, $code);
        $checkStmt->execute();
        $checkResult = $checkStmt->get_result();

        if ($checkResult->num_rows === 1) {
            $resetRow = $checkResult->fetch_assoc();
            $resetId = $resetRow['id'];

            $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
            $update = $conn->prepare("UPDATE admins SET password_hash = ? WHERE id = ?");
            $update->bind_param("si", $hashedPassword, $adminId);
            $update->execute();
            $update->close();

            $markUsed = $conn->prepare("UPDATE password_resets SET used = 1 WHERE id = ?");
            $markUsed->bind_param("i", $resetId);
            $markUsed->execute();
            $markUsed->close();

            unset($_SESSION['reset_email']);
            header('Location: login.php?reset=success');
            exit;
        } else {
            $message = "Invalid or expired code.";
        }

        $checkStmt->close();
    } else {
        $message = "Something went wrong. Please try again.";
    }

    $stmt->close();
    $conn->close();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password — Tropical Cyclone Information System</title>
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
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
      </div>
      <div>
        <h1 class="admin-hero-title">Reset Password</h1>
        <p class="admin-hero-sub">We sent a 6-digit code to <?php echo htmlspecialchars($email); ?>. Enter it below with your new password.</p>
      </div>
    </section>

    <section class="admin-card" data-reveal style="--reveal-delay: 0.08s">
      <?php if ($message): ?>
        <div class="alert alert-error">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 11v5M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span><?php echo htmlspecialchars($message); ?></span>
        </div>
      <?php endif; ?>

      <form method="POST">
        <label for="code">Verification code</label>
        <input type="text" id="code" name="code" placeholder="6-digit code" maxlength="6" required>

        <label for="new_password">New password</label>
        <input type="password" id="new_password" name="new_password" placeholder="New password" required>

        <button type="submit" class="admin-btn">Reset Password</button>
      </form>

      <p class="admin-alt"><a href="login.php">&larr; Back to login</a></p>
    </section>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script src="../js/main.js" data-root="../"></script>
</body>
</html>