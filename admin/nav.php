<?php
// ===========================================================================
// Admin header strip — the top navigation for every logged-in admin page.
// Carries the brand, the admin-only tabs (Dashboard, Historical Cyclones),
// and the session controls. The public site nav is
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

// Tells screen readers which tab is the current page (the .is-active class is
// visual only).
function nav_aria_current($section, $target) {
    return $section === $target ? ' aria-current="page"' : '';
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
    <nav class="admin-tabs-nav" id="adminTabsNav">
      <a href="dashboard.php" class="admin-tab<?php echo nav_is_active($nav_section, 'dashboard.php'); ?>"<?php echo nav_aria_current($nav_section, 'dashboard.php'); ?>>Dashboard</a>
      <a href="cyclones.php" class="admin-tab<?php echo nav_is_active($nav_section, 'cyclones'); ?>"<?php echo nav_aria_current($nav_section, 'cyclones'); ?>>Historical Cyclones</a>
    </nav>
    <div class="admin-tabs-session">
      <button type="button" class="admin-nav-toggle" id="adminNavToggle" aria-expanded="false" aria-controls="adminTabsNav">
        <i class="fa-solid fa-bars" aria-hidden="true"></i>
        <span>Menu</span>
      </button>
      <form class="admin-logout" method="POST" action="logout.php">
        <?php echo csrf_field(); ?>
        <button type="submit" class="admin-link-btn">Log out</button>
      </form>
    </div>
  </div>
</header>
<script>
  // Phone layout: shows/hides the tab strip behind the Menu button.
  (function () {
    var toggle = document.getElementById("adminNavToggle");
    var nav = document.getElementById("adminTabsNav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  })();
</script>

