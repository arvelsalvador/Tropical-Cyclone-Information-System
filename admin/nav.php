<?php
// ===========================================================================
// Admin header strip — the top navigation for every logged-in admin page.
// Carries the brand, the admin-only tabs (Dashboard, Upcoming Storm,
// Historical Cyclones), and the session controls. The public site nav is
// intentionally not shown on admin pages; the footer links back to the
// public pages.
// Pages include this right after auth.php:
//   require 'auth.php';
//   require 'nav.php';
// It re-checks the session defensively, then renders the strip with the
// active tab highlighted (cyclone-form.php highlights the same tab as
// cyclones.php).
// ===========================================================================

if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
    header('Location: login.php');
    exit;
}

$nav_page = basename($_SERVER['PHP_SELF']);
$nav_section = ($nav_page === 'cyclones.php' || $nav_page === 'cyclone-form.php') ? 'cyclones' : $nav_page;

function nav_is_active($section, $target) {
    return $section === $target ? ' is-active' : '';
}
?>
<header class="admin-tabs">
  <div class="admin-tabs-inner">
    <a class="admin-brand" href="dashboard.php">
      <img src="../assets/images/Logo.png" alt="Tropical Cyclone Information System logo" />
      <span class="admin-brand-text">
        <span class="admin-brand-name">Tropical Cyclone Information System</span>
        <span class="admin-brand-sub">Admin Portal</span>
      </span>
    </a>
    <nav class="admin-tabs-nav">
      <a href="dashboard.php" class="admin-tab<?php echo nav_is_active($nav_section, 'dashboard.php'); ?>">Dashboard</a>
      <a href="edit-storm.php" class="admin-tab<?php echo nav_is_active($nav_section, 'edit-storm.php'); ?>">Upcoming Storm</a>
      <a href="cyclones.php" class="admin-tab<?php echo nav_is_active($nav_section, 'cyclones'); ?>">Historical Cyclones</a>
    </nav>
    <div class="admin-tabs-session">
      <a href="logout.php">Log out</a>
    </div>
  </div>
</header>

