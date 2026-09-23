<?php
require 'auth.php';
require_once 'helpers.php';

// ===========================================================================
// Admin Dashboard — post-login overview.
//
// Shows the historical cyclone stats at a glance, quick links to every
// admin section, and the most recently added cyclone records.
// ===========================================================================

$conn = db_connect();
$db_error = '';

$totalCyclones = 0;
$latestYear = 0;
$stormsInLatestYear = 0;
$strongest = null;
$recent = [];

if ($conn->connect_error) {
    $db_error = 'Database connection failed. Please check that MySQL is running.';
} else {
    // Historical cyclone stats ------------------------------------------------
    $totalCyclones = (int) $conn->query('SELECT COUNT(*) AS c FROM cyclones')->fetch_assoc()['c'];

    $latestYear = (int) $conn->query('SELECT MAX(year) AS y FROM cyclones')->fetch_assoc()['y'];
    if ($latestYear > 0) {
        $stmt = $conn->prepare('SELECT COUNT(*) AS c FROM cyclones WHERE year = ?');
        $stmt->bind_param('i', $latestYear);
        $stmt->execute();
        $stormsInLatestYear = (int) $stmt->get_result()->fetch_assoc()['c'];
        $stmt->close();
    }

    // Strongest storm on record: highest sustained value, stored as "sustained/gust"
    $strongest = $conn->query(
        "SELECT local_name, international_name, year, highest_strength, highest_category
         FROM cyclones
         WHERE highest_strength IS NOT NULL AND highest_strength <> ''
         ORDER BY CAST(SUBSTRING_INDEX(highest_strength, '/', 1) AS UNSIGNED) DESC
         LIMIT 1"
    )->fetch_assoc();

    // Five most recently added records (created_at is set automatically)
    $recent = $conn->query(
        'SELECT id, local_name, international_name, year, highest_category, highest_strength, created_at
         FROM cyclones
         ORDER BY created_at DESC, id DESC
         LIMIT 5'
    )->fetch_all(MYSQLI_ASSOC);

    $conn->close();
}

$categoryLabels = [
    'TD'  => 'Tropical Depression',
    'TS'  => 'Tropical Storm',
    'STS' => 'Severe Tropical Storm',
    'TY'  => 'Typhoon',
    'STY' => 'Super Typhoon',
];

// Single cyclone artwork (assets/Icons/The icon.png) shown next to every
// cyclone in the recent-cyclones table — matches the public Historical Data
// table and the admin Historical Cyclones list (no per-category color-code).
$cycloneIcon = '../assets/Icons/The%20icon.png';

// "Opong (Bualoi)" style display name (local part Title-Cased)
function cyclone_display_name(array $row) {
    $local = cyclone_name($row['local_name']);
    return $row['international_name']
        ? $local . ' (' . $row['international_name'] . ')'
        : $local;
}

// Builds one small fact tile; $value is already-escaped HTML or '&mdash;'.
function dash_fact($label, $value) {
    return '<div class="dash-fact"><div class="dash-fact-label">' . htmlspecialchars($label)
         . '</div><div class="dash-fact-value">' . $value . '</div></div>';
}

// Escapes a scalar DB value, returning '&mdash;' for empty/null + optional suffix
function dash_value($value, $suffix = '') {
    if ($value === null || $value === '') return '&mdash;';
    return htmlspecialchars((string) $value) . $suffix;
}

$strongestSustained = 0;
if ($strongest) {
    $parts = explode('/', (string) $strongest['highest_strength']);
    $strongestSustained = (int) trim($parts[0]);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Admin — Tropical Cyclone Information System</title>
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
    <?php if ($db_error !== ''): ?>
      <div class="alert alert-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span><?php echo htmlspecialchars($db_error); ?></span>
      </div>
    <?php else: ?>

    <section class="admin-hero" data-reveal>
      <div class="admin-hero-icon">
        <i class="fa-solid fa-table-cells-large"></i>
      </div>
      <div>
        <h1 class="admin-hero-title">Dashboard</h1>
        <p class="admin-hero-sub">A quick overview of the platform's storm data and everything you can manage from the admin portal.</p>
      </div>
    </section>

      <!-- Stat cards -->
      <div class="stat-grid">
        <div class="stat-card" data-reveal>
          <div class="stat-icon stat-icon--blue">
            <i class="fa-solid fa-hurricane"></i>
          </div>
          <div class="stat-label">Cyclones tracked</div>
          <div class="stat-value"><?php echo $totalCyclones; ?></div>
          <div class="stat-sub">Historical records in the database</div>
        </div>
        <div class="stat-card" data-reveal style="--reveal-delay: 0.06s">
          <div class="stat-icon stat-icon--purple">
            <i class="fa-solid fa-calendar-days"></i>
          </div>
          <div class="stat-label">Storms in <?php echo $latestYear > 0 ? $latestYear : '&mdash;'; ?></div>
          <div class="stat-value"><?php echo $stormsInLatestYear; ?></div>
          <div class="stat-sub">Most recent season on record</div>
        </div>
        <div class="stat-card" data-reveal style="--reveal-delay: 0.12s">
          <div class="stat-icon stat-icon--red">
            <i class="fa-solid fa-wind"></i>
          </div>
          <div class="stat-label">Strongest on record</div>
          <div class="stat-value"><?php echo $strongest ? $strongestSustained . ' km/h' : '&mdash;'; ?></div>
          <div class="stat-sub">
            <?php if ($strongest): ?>
              <?php echo htmlspecialchars(cyclone_display_name($strongest)); ?>, <?php echo htmlspecialchars((string) $strongest['year']); ?>
            <?php else: ?>
              No strength data yet
            <?php endif; ?>
          </div>
        </div>
      </div>
      <!-- Quick actions -->
        <section class="admin-card dash-card" data-reveal style="--reveal-delay: 0.08s">
          <h2 class="dash-card-title">Quick Actions</h2>
          <div class="dash-actions">
            <a class="dash-action" href="cyclones.php">
              <div class="dash-action-icon dash-action-icon--purple">
                <i class="fa-solid fa-box-archive"></i>
              </div>
              <div class="dash-action-text">
                <div class="dash-action-title">Historical Cyclones</div>
                <div class="dash-action-desc">Manage the records behind Historical Data &amp; Analysis Comparison</div>
              </div>
              <span class="dash-action-arrow">&rarr;</span>
            </a>
            <a class="dash-action" href="cyclone-form.php">
              <div class="dash-action-icon dash-action-icon--green">
                <i class="fa-solid fa-circle-plus"></i>
              </div>
              <div class="dash-action-text">
                <div class="dash-action-title">Add New Cyclone</div>
                <div class="dash-action-desc">Record a storm from the latest PAGASA season</div>
              </div>
              <span class="dash-action-arrow">&rarr;</span>
            </a>
          </div>
        </section>
      <!-- Recently added records -->
      <section class="admin-card admin-card--page" data-reveal>
        <div class="dash-card-row">
          <h2 class="dash-card-title" style="margin-bottom: 0;">Recently added cyclones</h2>
          <a href="cyclones.php" class="dash-link">Manage all &rarr;</a>
        </div>
        <?php if ($recent): ?>
        <div class="admin-table-wrap admin-table-wrap--flush">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Cyclone</th>
                <th>Year</th>
                <th>Category</th>
                <th>Strength (Sustained / Gust)</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($recent as $row): ?>
              <?php $cat = $row['highest_category']; ?>
              <tr>
                <td>
                  <div class="admin-cyclone-cell">
                    <span class="admin-cyclone-icon"><img src="<?php echo $cycloneIcon; ?>" alt="" width="36" height="36" loading="lazy" decoding="async"></span>
                    <div>
                      <div class="cell-strong"><?php echo htmlspecialchars(cyclone_name($row['local_name'])); ?></div>
                      <?php if ($row['international_name']): ?>
                        <div class="cell-sub"><?php echo htmlspecialchars($row['international_name']); ?></div>
                      <?php endif; ?>
                    </div>
                  </div>
                </td>
                <td><?php echo htmlspecialchars((string) $row['year']); ?></td>
                <td>
                  <?php echo htmlspecialchars($categoryLabels[$cat] ?? '—'); ?>
                </td>
                <td><?php echo ($row['highest_strength'] !== null && $row['highest_strength'] !== '')
                    ? htmlspecialchars(str_replace('/', ' / ', $row['highest_strength'])) . ' km/h' : '&mdash;'; ?></td>
                <td><?php echo !empty($row['created_at']) ? htmlspecialchars(date('M j, Y, g:i A', strtotime($row['created_at']))) : '&mdash;'; ?></td>
              </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
        <?php else: ?>
        <p class="dash-empty" style="margin-top: 14px;">No cyclones recorded yet.</p>
        <?php endif; ?>
      </section>

      <?php endif; ?>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script src="../js/main.js" data-root="../"></script>
</body>
</html>
