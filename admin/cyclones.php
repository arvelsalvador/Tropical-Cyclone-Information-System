<?php
require 'auth.php';
require 'helpers.php';

// ===========================================================================
// Historical Cyclones — list page.
//
// Paginated, searchable table of every record in the `cyclones` table — the
// same records that power the public Historical Data and Metrics pages.
// Add/edit happens in cyclone-form.php; delete posts to cyclone-delete.php.
// ===========================================================================

// Status banners passed back after save/delete redirects.
$banner = '';
if (isset($_GET['saved'])) {
    $banner = 'Cyclone added successfully.';
} elseif (isset($_GET['updated'])) {
    $banner = 'Cyclone updated successfully.';
} elseif (isset($_GET['deleted'])) {
    $banner = 'Cyclone deleted.';
}

// Search + filter + pagination state (GET only — this page never writes).
$search = trim($_GET['q'] ?? '');
$yearFilter = trim($_GET['year'] ?? '');
if ($yearFilter !== '' && !ctype_digit($yearFilter)) {
    $yearFilter = '';
}
$categoryFilter = trim($_GET['category'] ?? '');
if (!in_array($categoryFilter, array('TD', 'TS', 'STS', 'TY', 'STY'), true)) {
    $categoryFilter = '';
}
$perPage = 10; // same page size as the public Historical Data table
$page = max(1, (int) ($_GET['page'] ?? 1));

// Full display names for the category codes (also used to translate a
// category typed into the search bar into the codes stored in the DB).
$categoryLabels = [
    'TD'  => 'Tropical Depression',
    'TS'  => 'Tropical Storm',
    'STS' => 'Severe Tropical Storm',
    'TY'  => 'Typhoon',
    'STY' => 'Super Typhoon',
];

$conn = db_connect();
$db_error = '';
$rows = [];
$total = 0;
$pages = 1;

if ($conn->connect_error) {
    $db_error = 'Database connection failed. Please check that MySQL is running.';
} else {
    // Build the WHERE clause from the search term + optional filters
    $conditions = array();
    $types = '';
    $values = array();
    if ($search !== '') {
        $like = '%' . $search . '%';
        // Match EVERY kind of record: local/international name, year, or
        // category. Category labels ("Typhoon", "Severe Tropical Storm"…)
        // are translated to their stored codes, so typing a type also
        // shows its results.
        $labelMatches = array();
        foreach ($categoryLabels as $code => $label) {
            if (stripos($label, $search) !== false) {
                $labelMatches[] = $code;
            }
        }
        $labelSql = $labelMatches
            ? ' OR highest_category IN (' . implode(',', array_fill(0, count($labelMatches), '?')) . ')'
            : '';
        $conditions[] = '(local_name LIKE ? OR international_name LIKE ?'
                      . ' OR CAST(year AS CHAR) LIKE ? OR highest_category LIKE ?' . $labelSql . ')';
        $types .= 'ssss' . str_repeat('s', count($labelMatches));
        array_push($values, $like, $like, $like, $like);
        foreach ($labelMatches as $code) {
            $values[] = $code;
        }
    }
    if ($yearFilter !== '') {
        $conditions[] = 'year = ?';
        $types .= 'i';
        $values[] = (int) $yearFilter;
    }
    if ($categoryFilter !== '') {
        $conditions[] = 'highest_category = ?';
        $types .= 's';
        $values[] = $categoryFilter;
    }
    $whereSql = $conditions ? (' WHERE ' . implode(' AND ', $conditions)) : '';

    $stmt = $conn->prepare('SELECT COUNT(*) AS c FROM cyclones' . $whereSql);
    if ($types !== '') {
        $stmt->bind_param($types, ...$values);
    }
    $stmt->execute();
    $total = (int) $stmt->get_result()->fetch_assoc()['c'];
    $stmt->close();

    $pages = max(1, (int) ceil($total / $perPage));
    $page = min($page, $pages);
    $offset = ($page - 1) * $perPage;

    $stmt = $conn->prepare('SELECT id, local_name, international_name, year, date_start, date_end, highest_category,
                   highest_strength, tcws_country, tcws_slprsd_area, tcws_region5, tcws_camarines_norte
            FROM cyclones' . $whereSql . ' ORDER BY year DESC, date_start DESC, local_name ASC LIMIT ? OFFSET ?');
    $stmt->bind_param($types . 'ii', ...array_merge($values, array($perPage, $offset)));
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Distinct years for the filter dropdown
    $filterYears = $conn->query('SELECT DISTINCT year FROM cyclones ORDER BY year DESC')->fetch_all(MYSQLI_ASSOC);

    $conn->close();
}

// "Apr 12 – Apr 15, 2022" style date range (matches the public pages)
function format_date_range($start, $end) {
    if (!$start) return '&mdash;';
    $s = date('M j', strtotime($start));
    if (!$end) return htmlspecialchars($s . ', ' . date('Y', strtotime($start)));
    return htmlspecialchars($s . ' – ' . date('M j', strtotime($end)) . ', ' . date('Y', strtotime($start)));
}

// "185/230" is stored as sustained/gust — render as "185 / 230 km/h"
// (sustained dark, gust muted — matches the admin table mock)
function strength_text($value) {
    if ($value === null || $value === '') return '&mdash;';
    $parts = explode('/', $value);
    $sustained = htmlspecialchars(trim($parts[0]));
    if (isset($parts[1])) {
        $gust = htmlspecialchars(trim($parts[1]));
        return '<span class="strength-sustained">' . $sustained . '</span>'
             . ' <span class="strength-sep">/</span> '
             . '<span class="strength-gust">' . $gust . ' km/h</span>';
    }
    return '<span class="strength-sustained">' . $sustained . '</span> <span class="strength-gust">km/h</span>';
}

// Pagination link that preserves the search term and active filters
function page_link($p, $search, $yearFilter, $categoryFilter) {
    $params = array();
    if ($search !== '') $params['q'] = $search;
    if ($yearFilter !== '') $params['year'] = $yearFilter;
    if ($categoryFilter !== '') $params['category'] = $categoryFilter;
    if ($p > 1) $params['page'] = $p;
    $qs = http_build_query($params);
    return 'cyclones.php' . ($qs !== '' ? '?' . $qs : '');
}

// One readable signal chip. Each cyclone holds up to four signal levels
// (Camarines Norte -> Region 5 -> SLPRSD Area -> National); showing the most
// area-specific one on record keeps the table clean. The "Signal No. X" label
// borrows the exact format used by the Add/Edit form dropdowns.
// '—' marks "no signal recorded".
function signal_chip(array $row) {
    foreach (['tcws_camarines_norte', 'tcws_region5', 'tcws_slprsd_area', 'tcws_country'] as $field) {
        $v = $row[$field] ?? null;
        if ($v !== null && $v !== '') {
            $level = (int) $v;
            return '<span class="sig-chip sig-chip--level-' . $level . '">Signal No. ' . $level . '</span>';
        }
    }
    return '<span class="sig-chip sig-chip--none">&mdash;</span>';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Historical Cyclones — Admin — Tropical Cyclone Information System</title>
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
    <?php if ($banner !== ''): ?>
      <div class="alert alert-success">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span><?php echo htmlspecialchars($banner); ?></span>
      </div>
    <?php endif; ?>

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
      <div class="admin-hero-icon admin-hero-icon--navy">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      </div>
      <div>
        <h1 class="admin-hero-title">Historical Cyclones</h1>
        <p class="admin-hero-sub">These records power the public Historical Data and Metrics pages.</p>
      </div>
      <a href="cyclone-form.php" class="admin-btn admin-btn--inline admin-hero-action">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        Add Cyclone
      </a>
    </section>

      <form class="admin-toolbar-card" method="GET" action="cyclones.php" data-reveal>
        <div class="admin-search">
          <span class="admin-search-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input type="text" name="q" value="<?php echo htmlspecialchars($search); ?>" placeholder="Search by name, year, or category type">
          <?php if ($search !== ''): ?>
            <a class="admin-search-clear" href="cyclones.php<?php echo ($yearFilter !== '' || $categoryFilter !== '') ? '?' . http_build_query(array_filter(array('year' => $yearFilter, 'category' => $categoryFilter))) : ''; ?>" title="Clear search">&times;</a>
          <?php endif; ?>
        </div>

        <details class="admin-filter">
          <summary class="admin-filter-btn">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
            <?php if ($yearFilter !== '' || $categoryFilter !== ''): ?><span class="admin-filter-dot" title="Filters active"></span><?php endif; ?>
            <svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div class="admin-filter-menu">
            <label for="filter_year">Year</label>
            <select id="filter_year" name="year">
              <option value="">All years</option>
              <?php foreach ($filterYears as $fy): ?>
                <option value="<?php echo (int) $fy['year']; ?>"<?php echo $yearFilter === (string) $fy['year'] ? ' selected' : ''; ?>><?php echo (int) $fy['year']; ?></option>
              <?php endforeach; ?>
            </select>

            <label for="filter_category">Category</label>
            <select id="filter_category" name="category">
              <option value="">All categories</option>
              <?php foreach ($categoryLabels as $code => $label): ?>
                <option value="<?php echo $code; ?>"<?php echo $categoryFilter === $code ? ' selected' : ''; ?>><?php echo htmlspecialchars($label); ?></option>
              <?php endforeach; ?>
            </select>

            <div class="admin-filter-actions">
              <a href="cyclones.php" class="admin-filter-reset">Reset</a>
              <button type="submit" class="admin-btn admin-btn--inline">Apply</button>
            </div>
          </div>
        </details>
      </form>

      <div class="admin-table-wrap" data-reveal>
        <table class="admin-table">
          <thead>
            <tr>
              <th>Cyclone</th>
              <th>Year</th>
              <th>Dates</th>
              <th>Category</th>
              <th>Strength (Sustained / Gust)</th>
              <th>Signal</th>
              <th style="text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <?php if (!$rows): ?>
            <tr>
              <td colspan="7"><div class="admin-empty">No cyclones found<?php echo $search !== '' ? ' for &ldquo;' . htmlspecialchars($search) . '&rdquo;' : ''; echo ($yearFilter !== '' || $categoryFilter !== '') ? ' with the current filters' : ''; ?>.</div></td>
            </tr>
            <?php else: ?>
            <?php foreach ($rows as $row): ?>
            <tr>
              <td>
                <div class="cell-strong"><?php echo htmlspecialchars($row['local_name']); ?></div>
                <?php if ($row['international_name']): ?>
                  <div class="cell-sub"><?php echo htmlspecialchars($row['international_name']); ?></div>
                <?php endif; ?>
              </td>
              <td><?php echo htmlspecialchars((string) $row['year']); ?></td>
              <td><?php echo format_date_range($row['date_start'], $row['date_end']); ?></td>
              <td>
                <?php $cat = $row['highest_category']; ?>
                <span class="pill <?php echo isset($categoryLabels[$cat]) ? 'pill--' . htmlspecialchars($cat) : 'pill--muted'; ?>">
                  <?php echo htmlspecialchars($categoryLabels[$cat] ?? '&mdash;'); ?>
                </span>
              </td>
              <td><?php echo strength_text($row['highest_strength']); ?></td>
              <td>
                <div class="sig-cell">
                  <?php echo signal_chip($row); ?>
                </div>
              </td>
              <td>
                <div class="row-actions" style="justify-content: flex-end;">
                  <a class="admin-btn-sm" href="cyclone-form.php?id=<?php echo (int) $row['id']; ?>">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Edit
                  </a>
                  <form method="POST" action="cyclone-delete.php"
                        onsubmit="return confirm('Delete <?php echo htmlspecialchars(addslashes($row['local_name'] . ' (' . $row['year'] . ')'), ENT_QUOTES); ?>? This cannot be undone.');">
                    <input type="hidden" name="id" value="<?php echo (int) $row['id']; ?>">
                    <button type="submit" class="admin-btn-sm admin-btn-sm--danger">
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                      Delete
                    </button>
                  </form>
                </div>
              </td>
            </tr>
            <?php endforeach; ?>
            <?php endif; ?>
          </tbody>
        </table>
      </div>

      <?php if ($pages > 1): ?>
      <div class="admin-pagination">
        <a class="admin-page-link<?php echo $page <= 1 ? ' admin-page-link--disabled' : ''; ?>"
           href="<?php echo page_link(max(1, $page - 1), $search, $yearFilter, $categoryFilter); ?>">&lsaquo; Prev</a>
        <?php
        if ($pages <= 9) {
            $pageNumbers = range(1, $pages);
        } else {
            $pageNumbers = [1];
            $start = max(2, $page - 1);
            $end = min($pages - 1, $page + 1);
            if ($start > 2) $pageNumbers[] = '...';
            for ($p = $start; $p <= $end; $p++) $pageNumbers[] = $p;
            if ($end < $pages - 1) $pageNumbers[] = '...';
            $pageNumbers[] = $pages;
        }
        foreach ($pageNumbers as $p):
            if ($p === '...'):
        ?>
          <span class="admin-page-ellipsis">&hellip;</span>
        <?php else: ?>
          <a class="admin-page-link<?php echo $p === $page ? ' admin-page-link--active' : ''; ?>"
             href="<?php echo page_link($p, $search, $yearFilter, $categoryFilter); ?>"><?php echo $p; ?></a>
        <?php endif; endforeach; ?>
        <a class="admin-page-link<?php echo $page >= $pages ? ' admin-page-link--disabled' : ''; ?>"
           href="<?php echo page_link(min($pages, $page + 1), $search, $yearFilter, $categoryFilter); ?>">Next &rsaquo;</a>
      </div>
      <?php endif; ?>

      <p class="admin-page-info">
        <?php echo $total; ?> cyclone<?php echo $total === 1 ? '' : 's'; ?> on record
        &middot; page <?php echo $page; ?> of <?php echo $pages; ?>
      </p>

      <?php endif; ?>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script src="../js/main.js" data-root="../"></script>

  <script>
    // Live toolbar: results update as you type in the search box or pick a
    // filter (year / category "type") — no need to press Enter or "Apply".
    // The Apply button still works as a fallback.
    // Slight debounce so each keystroke doesn't reload the page immediately
    // — it waits until the admin pauses typing, then submits and shows results.
    (function () {
      var form = document.querySelector(".admin-toolbar-card");
      if (!form) return;

      var timer = null;
      function scheduleSubmit() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { form.submit(); }, 350);
      }

      // Search-as-you-type
      form.querySelectorAll("input[name='q']").forEach(function (input) {
        input.addEventListener("input", scheduleSubmit);
      });

      // Filters apply instantly on selection (selects fire "change", not "input")
      form.querySelectorAll("select").forEach(function (select) {
        select.addEventListener("change", scheduleSubmit);
      });
    })();
  </script>
</body>
</html>
