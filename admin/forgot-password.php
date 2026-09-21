<?php
require_once __DIR__ . '/helpers.php';

admin_session_start();
require '../vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$message = "";
$messageKind = "error";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = trim($_POST['email'] ?? '');

    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $message = "If that email exists, a verification code was sent.";
        $messageKind = "success";
    } else {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        if (!rate_limit_check('forgot:' . $ip, 5, 3600)) {
            // Throttled: same generic message so attackers learn nothing.
            $message = "If that email exists, a verification code was sent.";
            $messageKind = "success";
        } else {
            $conn = db_connect();

            if ($conn->connect_error) {
                app_log('forgot-password db connect failed');
                $message = "If that email exists, a verification code was sent.";
                $messageKind = "success";
            } else {
                $stmt = $conn->prepare("SELECT id FROM admins WHERE email = ?");
                $stmt->bind_param("s", $email);
                $stmt->execute();
                $result = $stmt->get_result();

                // Always respond generically (no account enumeration).
                $message = "If that email exists, a verification code was sent.";
                $messageKind = "success";

                if ($result->num_rows === 1) {
                    $admin = $result->fetch_assoc();
                    $adminId = $admin['id'];

                    // Per-account throttle: max 5 codes per hour (no schema change).
                    $throttleOk = true;
                    try {
                        $tStmt = $conn->prepare("SELECT COUNT(*) AS c FROM password_resets WHERE admin_id = ? AND created_at > (NOW() - INTERVAL 1 HOUR)");
                        $tStmt->bind_param("i", $adminId);
                        $tStmt->execute();
                        $tRow = $tStmt->get_result()->fetch_assoc();
                        $tStmt->close();
                        if ($tRow && (int) $tRow['c'] >= 5) {
                            $throttleOk = false;
                        }
                    } catch (mysqli_sql_exception $e) {
                        app_log('forgot-password throttle check failed: ' . $e->getMessage());
                    }

                    if ($throttleOk) {
                        $code = strval(random_int(100000, 999999));
                        $expiresAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));

                        $insert = $conn->prepare("INSERT INTO password_resets (admin_id, code, expires_at) VALUES (?, ?, ?)");
                        $insert->bind_param("iss", $adminId, $code, $expiresAt);
                        $insert->execute();

                        $mail = new PHPMailer(true);
                        $mailSent = false;
                        try {
                            $mail->isSMTP();
                            $mail->Host       = app_config('SMTP_HOST', 'smtp.gmail.com');
                            $mail->SMTPAuth   = true;
                            $mail->Username   = app_config('SMTP_USER', '');
                            $mail->Password   = app_config('SMTP_PASS', '');
                            $mail->SMTPSecure = app_config('SMTP_SECURE', 'tls');
                            $mail->Port       = (int) app_config('SMTP_PORT', 587);

                            if ($mail->Username === '' || $mail->Password === '') {
                                // Unconfigured SMTP: skip address setup + send entirely so a
                                // blank From can't throw "Invalid address" before this guard runs.
                                app_log('forgot-password SMTP not configured; code issued but not mailed');
                            } else {
                                $from = app_config('SMTP_FROM', '');
                                if ($from === '') {
                                    $from = $mail->Username;
                                }
                                if (!filter_var($from, FILTER_VALIDATE_EMAIL)) {
                                    app_log('forgot-password SMTP_FROM invalid: ' . $from);
                                } else {
                                    $mail->setFrom($from, app_config('SMTP_FROM_NAME', 'Tropical Cyclone Info System'));
                                    $mail->addAddress($email);

                                    $mail->Subject = 'Your Password Reset Code';
                                    $mail->Body    = "Your verification code is: $code\n\nThis code expires in 15 minutes.";

                                    $mail->send();
                                    $mailSent = true;
                                }
                            }
                            if ($mailSent) {
                                $_SESSION['reset_email'] = $email;
                                $_SESSION['reset_attempts'] = 0;
                                header('Location: reset-password.php');
                                exit;
                            }
                            // Code was stored but no email went out: tell the admin
                            // plainly instead of redirecting or faking success.
                            $message = "We couldn't send the reset email right now (mail service unavailable). Please try again later or contact the site administrator.";
                            $messageKind = "error";
                        } catch (Exception $e) {
                            // Never expose SMTP internals to the browser.
                            app_log('forgot-password mail failed: ' . $mail->ErrorInfo);
                            $message = "We couldn't send the reset email right now (mail service unavailable). Please try again later or contact the site administrator.";
                            $messageKind = "error";
                        }

                        $insert->close();
                    }
                }

                $stmt->close();
                $conn->close();
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Forgot Password — Tropical Cyclone Information System</title>
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
        <i class="fa-solid fa-envelope"></i>
      </div>
      <div>
        <h1 class="admin-hero-title">Forgot Password</h1>
        <p class="admin-hero-sub">Enter your admin email and we'll send you a verification code.</p>
      </div>
    </section>

    <section class="admin-card" data-reveal style="--reveal-delay: 0.08s">
      <?php if ($message): ?>
        <div class="alert <?php echo $messageKind === 'success' ? 'alert-success' : 'alert-error'; ?>">
          <i class="fa-solid <?php echo $messageKind === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'; ?>"></i>
          <span><?php echo htmlspecialchars($message); ?></span>
        </div>
      <?php endif; ?>

      <form method="POST">
        <?php echo csrf_field(); ?>
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