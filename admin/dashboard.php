<?php
require 'auth.php';
require 'helpers.php';

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
      </div>
      <section class="admin-card dash-card upcoming-storm-session-card" data-upcoming-storm-card data-reveal style="--reveal-delay: 0.16s">
        <div class="upcoming-dash-heading">
          <div class="upcoming-dash-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
              <circle cx="12" cy="12" r="2.6" fill="currentColor" />
              <path d="M12 9.4c0-4 2.8-6.9 7.6-6.9-1.1 3-3.9 5-7.6 6.9z" fill="currentColor" />
              <path d="M12 14.6c0 4-2.8 6.9-7.6 6.9 1.1-3 3.9-5 7.6-6.9z" fill="currentColor" />
            </svg>
          </div>
          <div class="upcoming-dash-titlewrap">
            <h2 class="dash-card-title upcoming-dash-title">Upcoming Storm</h2>
            <p class="upcoming-dash-sub">Live preview of the visitor session profile</p>
          </div>
          <span class="upcoming-dash-badge">Session preview</span>
        </div>
        <div data-upcoming-empty class="upcoming-dash-empty">
          <div class="upcoming-dash-empty-top">
            <div class="upcoming-dash-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </div>
            <div class="upcoming-dash-empty-copy">
              <strong>No upcoming storm yet <span class="upcoming-dash-pill upcoming-dash-pill--empty">Empty</span></strong>
              <span class="upcoming-dash-empty-text">This card mirrors what a visitor enters on Analysis Comparison. It lives in this browser tab only and clears on reload.</span>
            </div>
          </div>
          <ol class="upcoming-dash-steps">
            <li><span class="upcoming-dash-stepnum">1</span><div><b>Open Analysis Comparison</b><i>Use the button below</i></div></li>
            <li><span class="upcoming-dash-stepnum">2</span><div><b>Enter name + wind</b><i>E.g. Odin, 160 km/h &rarr; Typhoon Odin</i></div></li>
            <li><span class="upcoming-dash-stepnum">3</span><div><b>Apply storm</b><i>Preview appears here instantly</i></div></li>
          </ol>
        </div>
        <div data-upcoming-details hidden class="upcoming-dash-details">
          <div class="upcoming-dash-profile">
            <div class="upcoming-dash-profile-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path d="M12 3v18M5 7l7-4 7 4M5 17l7 4 7-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="upcoming-dash-profile-copy">
              <span class="upcoming-dash-profile-label">Storm name</span>
              <strong data-upcoming-value="name"></strong>
            </div>
            <span class="upcoming-dash-status"><span class="upcoming-dash-dot" aria-hidden="true"></span>Active &middot; Ready for comparison</span>
          </div>
          <div class="upcoming-dash-facts">
            <div class="upcoming-dash-fact">
              <span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" /></svg>Max sustained wind</span>
              <strong data-upcoming-value="wind"></strong>
            </div>
            <div class="upcoming-dash-fact">
              <span><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8z" /></svg>PAGASA category</span>
              <strong data-upcoming-value="category"></strong>
            </div>
          </div>
          <p class="upcoming-dash-hint">Session-only preview &mdash; clears on reload. Run the full historical comparison on the Analysis page.</p>
        </div>
        <div class="upcoming-dash-actions">
          <a class="upcoming-dash-cta" href="../pages/analysis-comparison.html">Open Analysis Comparison <span aria-hidden="true">&rarr;</span></a>
          <a class="upcoming-dash-ghost" href="cyclones.php">Manage cyclones</a>
        </div>
      </section>
      <!-- Quick actions -->
      <div class="dash-grid">

        <section class="admin-card dash-card" data-reveal style="--reveal-delay: 0.08s">
          <h2 class="dash-card-title">Quick Actions</h2>
          <div class="dash-actions">
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
                <div class="dash-action-desc">Manage the records behind Historical Data &amp; Analysis Comparison</div>
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
<script src="../js/upcoming-storm-state.js"></script>
</body>
</html>
