<?php
session_start();
require '../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$message = "";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = $_POST['email'] ?? '';

    $conn = new mysqli('localhost', 'root', '', 'cyclone_db');

    $stmt = $conn->prepare("SELECT id FROM admins WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 1) {
        $admin = $result->fetch_assoc();
        $adminId = $admin['id'];

        $code = strval(random_int(100000, 999999));
        $expiresAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));

        $insert = $conn->prepare("INSERT INTO password_resets (admin_id, code, expires_at) VALUES (?, ?, ?)");
        $insert->bind_param("iss", $adminId, $code, $expiresAt);
        $insert->execute();

        $mail = new PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'arvelsalvador@gmail.com';       // <-- edit this
            $mail->Password   = 'xhle yfrk utmt syfx'; // <-- edit this
            $mail->SMTPSecure = 'tls';
            $mail->Port       = 587;

            $mail->setFrom('arvelsalvador@gmail.com', 'Tropical Cyclone Info System');
            $mail->addAddress($email);

            $mail->Subject = 'Your Password Reset Code';
            $mail->Body    = "Your verification code is: $code\n\nThis code expires in 15 minutes.";

            $mail->send();
            $_SESSION['reset_email'] = $email;
            header('Location: reset-password.php');
            exit;
        } catch (Exception $e) {
            $message = "Email could not be sent. Error: " . $mail->ErrorInfo;
        }

        $insert->close();
    } else {
        $message = "No account found with that email.";
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
  <title>Forgot Password — Tropical Cyclone Information System</title>
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
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      </div>
      <div>
        <h1 class="admin-hero-title">Forgot Password</h1>
        <p class="admin-hero-sub">Enter your admin email and we'll send you a verification code.</p>
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
        <label for="email">Email address</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" required>

        <button type="submit" class="admin-btn">Send Code</button>
      </form>

      <p class="admin-alt"><a href="login.php">&larr; Back to login</a></p>
    </section>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script src="../js/main.js" data-root="../"></script>
</body>
</html>