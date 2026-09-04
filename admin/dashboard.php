<?php
require 'auth.php';
require 'helpers.php';

// ===========================================================================
// Admin Dashboard — post-login overview.
//
// Shows the historical cyclone stats at a glance, the current upcoming storm
// profile (the single row edited via edit-storm.php), quick links to every
// admin section, and the most recently added cyclone records.
// ===========================================================================

$conn = db_connect();
$db_error = '';

$totalCyclones = 0;
$latestYear = 0;
$stormsInLatestYear = 0;
$strongest = null;
$recent = [];
$storm = null;

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

    // Current upcoming storm profile (single row, edited via edit-storm.php)
    $storm = $conn->query('SELECT * FROM upcoming_storm ORDER BY id LIMIT 1')->fetch_assoc();

    $conn->close();
}

$categoryLabels = [
    'TD'  => 'Tropical Depression',
    'TS'  => 'Tropical Storm',
    'STS' => 'Severe Tropical Storm',
    'TY'  => 'Typhoon',
    'STY' => 'Super Typhoon',
];

// Colored status pills for the upcoming-storm card (classes live in admin.css)
$statusPillMap = [
    'Approaching'      => 'pill--status-approaching',
    'Getting Stronger' => 'pill--status-strengthening',
    'Active'           => 'pill--status-active',
    'Getting Weaker'   => 'pill--status-weakening',
    'Gone'             => 'pill--status-gone',
];

// "Opong (Bualoi)" style display name
function cyclone_display_name(array $row) {
    return $row['international_name']
        ? $row['local_name'] . ' (' . $row['international_name'] . ')'
        : $row['local_name'];
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
  <link rel="stylesheet" href="../css/components/footer.css" />
  <link rel="stylesheet" href="../css/admin.css" />
</head>
<body>
  <?php require 'nav.php'; ?>

  <main class="admin-main">
    <?php if ($db_error !== ''): ?>
      <div class="alert alert-error">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
          <path d="M12 11v5M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <span><?php echo htmlspecialchars($db_error); ?></span>
      </div>
    <?php else: ?>

    <section class="admin-hero" data-reveal>
      <div class="admin-hero-icon">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
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
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <circle cx="12" cy="12" r="2.6" fill="#fff" />
              <path d="M12 9.4c0-4 2.8-6.9 7.6-6.9-1.1 3-3.9 5-7.6 6.9z" fill="#fff" />
              <path d="M12 14.6c0 4-2.8 6.9-7.6 6.9 1.1-3 3.9-5 7.6-6.9z" fill="#fff" />
            </svg>
          </div>
          <div class="stat-label">Cyclones tracked</div>
          <div class="stat-value"><?php echo $totalCyclones; ?></div>
          <div class="stat-sub">Historical records in the database</div>
        </div>
        <div class="stat-card" data-reveal style="--reveal-delay: 0.06s">
          <div class="stat-icon stat-icon--purple">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div class="stat-label">Storms in <?php echo $latestYear > 0 ? $latestYear : '&mdash;'; ?></div>
          <div class="stat-value"><?php echo $stormsInLatestYear; ?></div>
          <div class="stat-sub">Most recent season on record</div>
        </div>
        <div class="stat-card" data-reveal style="--reveal-delay: 0.12s">
          <div class="stat-icon stat-icon--red">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
            </svg>
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
        <div class="stat-card" data-reveal style="--reveal-delay: 0.18s">
          <div class="stat-icon stat-icon--green">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5l3 2" />
            </svg>
          </div>
          <div class="stat-label">Profile last updated</div>
          <div class="stat-value stat-value--small">
            <?php echo ($storm && !empty($storm['updated_at'])) ? htmlspecialchars(date('M j, Y, g:i A', strtotime($storm['updated_at']))) : '&mdash;'; ?>
          </div>
          <div class="stat-sub">Upcoming storm profile changes</div>
        </div>
      </div>
      <!-- Current storm + quick actions -->
      <div class="dash-grid">
        <section class="admin-card dash-card" data-reveal>
          <h2 class="dash-card-title">Current Upcoming Storm</h2>
          <?php if ($storm && empty($storm['is_active'])): ?>
            <p class="dash-empty">The upcoming storm is set to <strong>NONE</strong> — the profile is hidden from the public site while no storm is active.</p>
            <a href="edit-storm.php" class="admin-btn admin-btn--inline">Edit / Re-enable Storm</a>
          <?php elseif ($storm): ?>
            <div class="dash-storm-head">
              <span class="dash-storm-name"><?php echo htmlspecialchars(($storm['storm_name'] !== null && $storm['storm_name'] !== '') ? $storm['storm_name'] : 'Unnamed storm'); ?></span>
              <?php if (!empty($storm['status'])): ?><span class="pill <?php echo $statusPillMap[$storm['status']] ?? 'pill--muted'; ?>"><?php echo htmlspecialchars($storm['status']); ?></span><?php endif; ?>
              <?php if (!empty($storm['category'])): ?><span class="pill pill--muted"><?php echo htmlspecialchars($storm['category']); ?></span><?php endif; ?>
            </div>
            <div class="dash-facts">
              <?php
              echo dash_fact('Max Wind', dash_value($storm['max_wind'], ' km/h'));

              // Movement speed + direction combined into one tile
              $movement = '&mdash;';
              if (!empty($storm['movement_speed']) || !empty($storm['movement_direction'])) {
                  $movement = trim(
                      (!empty($storm['movement_speed']) ? htmlspecialchars($storm['movement_speed']) . ' km/h' : '')
                      . ' ' . (!empty($storm['movement_direction']) ? htmlspecialchars($storm['movement_direction']) : '')
                  );
              }
              echo dash_fact('Movement', $movement);

              echo dash_fact('Central Pressure', dash_value($storm['central_pressure'], ' hPa'));
              echo dash_fact('PAGASA Signal', dash_value($storm['pagasa_signal']));

              $landfall = '&mdash;';
              if (!empty($storm['forecast_landfall_date'])) {
                  $landfall = htmlspecialchars(date('M j, Y', strtotime($storm['forecast_landfall_date'])));
                  if (!empty($storm['forecast_landfall_note'])) {
                      $landfall .= ' <span class="dash-fact-note">' . htmlspecialchars($storm['forecast_landfall_note']) . '</span>';
                  }
              }
              echo dash_fact('Forecast Landfall', $landfall);

              echo dash_fact('Location', dash_value($storm['location_note']));
              ?>
            </div>
            <p class="dash-updated">Last saved: <?php echo htmlspecialchars(date('M j, Y, g:i A', strtotime($storm['updated_at']))); ?></p>
            <a href="edit-storm.php" class="admin-btn admin-btn--inline">Edit Upcoming Storm</a>
          <?php else: ?>
            <p class="dash-empty">No upcoming storm has been saved yet. Set one up so the public home page shows the current profile.</p>
            <a href="edit-storm.php" class="admin-btn admin-btn--inline">Set Up Upcoming Storm</a>
          <?php endif; ?>
        </section>

        <section class="admin-card dash-card" data-reveal style="--reveal-delay: 0.08s">
          <h2 class="dash-card-title">Quick Actions</h2>
          <div class="dash-actions">
            <a class="dash-action" href="edit-storm.php">
              <div class="dash-action-icon dash-action-icon--blue">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div class="dash-action-text">
                <div class="dash-action-title">Upcoming Storm</div>
                <div class="dash-action-desc">Update the live profile shown on the home page</div>
              </div>
              <span class="dash-action-arrow">&rarr;</span>
            </a>
            <a class="dash-action" href="cyclones.php">
              <div class="dash-action-icon dash-action-icon--purple">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="21 8 21 21 3 21 3 8" />
                  <rect x="1" y="3" width="22" height="5" />
                  <line x1="10" y1="12" x2="14" y2="12" />
                </svg>
              </div>
              <div class="dash-action-text">
                <div class="dash-action-title">Historical Cyclones</div>
                <div class="dash-action-desc">Manage the records behind Historical Data &amp; Metrics</div>
              </div>
              <span class="dash-action-arrow">&rarr;</span>
            </a>
            <a class="dash-action" href="cyclone-form.php">
              <div class="dash-action-icon dash-action-icon--green">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>
              <div class="dash-action-text">
                <div class="dash-action-title">Add New Cyclone</div>
                <div class="dash-action-desc">Record a storm from the latest PAGASA season</div>
              </div>
              <span class="dash-action-arrow">&rarr;</span>
            </a>
            <a class="dash-action" href="../index.html" target="_blank" rel="noopener">
              <div class="dash-action-icon dash-action-icon--navy">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div class="dash-action-text">
                <div class="dash-action-title">View Public Site</div>
                <div class="dash-action-desc">Open the public site in a new tab</div>
              </div>
              <span class="dash-action-arrow">&rarr;</span>
            </a>
          </div>
        </section>
      </div>
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
              <tr>
                <td>
                  <div class="cell-strong"><?php echo htmlspecialchars($row['local_name']); ?></div>
                  <?php if ($row['international_name']): ?>
                    <div class="cell-sub"><?php echo htmlspecialchars($row['international_name']); ?></div>
                  <?php endif; ?>
                </td>
                <td><?php echo htmlspecialchars((string) $row['year']); ?></td>
                <td>
                  <?php $cat = $row['highest_category']; ?>
                  <span class="pill <?php echo isset($categoryLabels[$cat]) ? 'pill--' . htmlspecialchars($cat) : 'pill--muted'; ?>">
                    <?php echo htmlspecialchars($categoryLabels[$cat] ?? '&mdash;'); ?>
                  </span>
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
