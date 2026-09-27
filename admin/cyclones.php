<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/helpers.php';

// ===========================================================================
// Historical Cyclones — list page.
//
// Paginated, searchable table of every record in the `cyclones` table — the
// same records that power the public Historical Data and Analysis Comparison pages.
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
$rainfallLevels = rainfall_choices();
$rainfallFilter = trim($_GET['rainfall'] ?? '');
if (!in_array($rainfallFilter, $rainfallLevels, true)) {
    $rainfallFilter = '';
}
$perPage = 10; // same page size as the public Historical Data table
$page = max(1, (int) ($_GET['page'] ?? 1));

// Full display names for the category codes (also used to translate a
// category typed into the search bar into the codes stored in the DB).
// Shared lists (admin/helpers.php): DB codes -> full display labels.
$categoryLabels = category_labels();

// Single cyclone artwork (assets/Icons/The icon.png) shown next to every
// cyclone in the list table — the old per-category color-code was removed,
// so all categories share one icon.
$cycloneIcon = '../assets/Icons/The%20icon.png';

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
                      . ' OR CAST(year AS CHAR) LIKE ? OR highest_category LIKE ? OR rainfall_category LIKE ?' . $labelSql . ')';
        $types .= 'sssss' . str_repeat('s', count($labelMatches));
        array_push($values, $like, $like, $like, $like, $like);
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
    if ($rainfallFilter !== '') {
        $conditions[] = 'rainfall_category = ?';
        $types .= 's';
        $values[] = $rainfallFilter;
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
                   highest_strength, tcws_country, tcws_slprsd_area, tcws_region5, tcws_camarines_norte,
                   rainfall_category
            FROM cyclones' . $whereSql . ' ORDER BY year DESC, date_start DESC, local_name ASC LIMIT ? OFFSET ?');
    $stmt->bind_param($types . 'ii', ...array_merge($values, array($perPage, $offset)));
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Distinct years for the filter dropdown
    $filterYears = $conn->query('SELECT DISTINCT year FROM cyclones ORDER BY year DESC')->fetch_all(MYSQLI_ASSOC);

    $conn->close();
}

// "Apr 12 – Apr 15" style date range (year lives in its own column)
function format_date_range($start, $end) {
    if (!$start) return '&mdash;';
    $s = date('M j', strtotime($start));
    if (!$end) return htmlspecialchars($s);
    return htmlspecialchars($s . ' – ' . date('M j', strtotime($end)));
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
function page_link($p, $search, $yearFilter, $categoryFilter, $rainfallFilter = '') {
    $params = array();
    if ($search !== '') $params['q'] = $search;
    if ($yearFilter !== '') $params['year'] = $yearFilter;
    if ($categoryFilter !== '') $params['category'] = $categoryFilter;
    if ($rainfallFilter !== '') $params['rainfall'] = $rainfallFilter;
    if ($p > 1) $params['page'] = $p;
    $qs = http_build_query($params);
    return 'cyclones.php' . ($qs !== '' ? '?' . $qs : '');
}

// One readable signal label. Each cyclone holds up to four signal levels
// (Camarines Norte -> Region 5 -> SLPRSD Area -> National); showing the most
// area-specific one on record keeps the table clean. Plain text, no color
// chip — matches the Category column treatment.
// '—' marks "no signal recorded".
function signal_chip(array $row) {
    foreach (['tcws_camarines_norte', 'tcws_region5', 'tcws_slprsd_area', 'tcws_country'] as $field) {
        $v = $row[$field] ?? null;
        if ($v !== null && $v !== '') {
            $level = (int) $v;
            return 'Signal No. ' . $level;
        }
    }
    return '&mdash;';
}

// Fragment mode for the live search: the toolbar script requests this page
// with ?ajax=1 and swaps the returned #cycloneResults block in place, so the
// search box keeps focus, the filter panel stays open and nothing reloads.
if (isset($_GET['ajax']) && $_GET['ajax'] === '1') {
    header('Content-Type: text/html; charset=utf-8');
    require __DIR__ . '/partials/cyclones-results.php';
    exit;
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
  <link rel="stylesheet" href="../assets/vendor/fontawesome/css/all.min.css" />
  <link rel="stylesheet" href="../css/components/footer.css" />
  <link rel="stylesheet" href="../css/admin.css" />
  <script>
    // Reveal guard: if js/main.js never runs (blocked, offline or errored) the
    // [data-reveal] blocks below would stay invisible. js/main.js marks the
    // document when it starts; without that mark, keep the content readable.
    window.addEventListener("load", function () {
      if (!document.documentElement.hasAttribute("data-js-ready")) {
        document.documentElement.classList.add("no-js");
      }
    });
  </script>
</head>
<body>
  <?php require 'nav.php'; ?>

  <main class="admin-main">
    <?php if ($banner !== ''): ?>
      <div class="alert alert-success" role="status">
        <i class="fa-solid fa-circle-check"></i>
        <span><?php echo htmlspecialchars($banner); ?></span>
      </div>
    <?php endif; ?>

    <?php if ($db_error !== ''): ?>
      <div class="alert alert-error" role="alert">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span><?php echo htmlspecialchars($db_error); ?></span>
      </div>
    <?php else: ?>

    <section class="admin-hero" data-reveal>
      <div class="admin-hero-icon admin-hero-icon--navy">
        <i class="fa-solid fa-box-archive"></i>
      </div>
      <div>
        <h1 class="admin-hero-title">Historical Cyclones</h1>
        <p class="admin-hero-sub">These records power the public Historical Data and Analysis Comparison pages.</p>
      </div>
      <a href="cyclone-form.php" class="admin-btn admin-btn--inline admin-hero-action">
        <i class="fa-solid fa-plus"></i>
        Add Cyclone
      </a>
    </section>

      <form class="admin-toolbar-card" method="GET" action="cyclones.php" data-reveal>
        <div class="admin-search">
          <span class="admin-search-icon">
            <i class="fa-solid fa-magnifying-glass"></i>
          </span>
          <input type="text" name="q" value="<?php echo htmlspecialchars($search); ?>" placeholder="Search by name, year, category, or rainfall" aria-label="Search cyclones by name, year, category, or rainfall" autocomplete="off">
          <?php if ($search !== ''): ?>
            <a class="admin-search-clear" href="cyclones.php<?php echo ($yearFilter !== '' || $categoryFilter !== '' || $rainfallFilter !== '') ? '?' . http_build_query(array_filter(array('year' => $yearFilter, 'category' => $categoryFilter, 'rainfall' => $rainfallFilter))) : ''; ?>" title="Clear search">&times;</a>
          <?php endif; ?>
        </div>

        <details class="admin-filter">
          <summary class="admin-filter-btn">
            <i class="fa-solid fa-filter"></i>
            Filter
            <?php if ($yearFilter !== '' || $categoryFilter !== '' || $rainfallFilter !== ''): ?><span class="admin-filter-dot" title="Filters active"></span><?php endif; ?>
            <i class="fa-solid fa-chevron-down"></i>
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

            <label for="filter_rainfall">Rainfall Intensity</label>
            <select id="filter_rainfall" name="rainfall">
              <option value="">All rainfall levels</option>
              <?php foreach ($rainfallLevels as $level): ?>
                <option value="<?php echo htmlspecialchars($level); ?>"<?php echo $rainfallFilter === $level ? ' selected' : ''; ?>><?php echo htmlspecialchars($level); ?></option>
              <?php endforeach; ?>
            </select>

            <div class="admin-filter-actions">
              <a href="cyclones.php" class="admin-filter-reset">Reset</a>
              <button type="submit" class="admin-btn admin-btn--inline">Apply</button>
            </div>
          </div>
        </details>
      </form>

      <?php require __DIR__ . '/partials/cyclones-results.php'; ?>


      <?php endif; ?>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script src="../js/main.js"></script>

  <script>
    // Live toolbar: typing in the search box or picking a filter fetches this
    // same page with ?ajax=1 and swaps only the #cycloneResults block, so the
    // page never reloads — the search box keeps focus and the filter panel
    // stays open. Enter and the Apply button still work normally.
    (function () {
      var form = document.querySelector(".admin-toolbar-card");
      var results = document.getElementById("cycloneResults");
      if (!form || !results) return;

      var timer = null;
      var inFlight = null;

      function buildUrl() {
        var clean = new URLSearchParams();
        new FormData(form).forEach(function (value, key) {
          if (String(value) !== "") clean.set(key, value);
        });
        clean.set("ajax", "1");
        return form.getAttribute("action") + "?" + clean.toString();
      }

      function cleanUrl(url) {
        return url.replace(/([?&])ajax=1&?/, "$1").replace(/[?&]$/, "");
      }

      function onReplaced(pushState, url) {
        // Keep the address bar (and the back button) in sync without a reload.
        if (pushState && window.history && history.pushState) {
          history.pushState({ cyclones: cleanUrl(url) }, "", cleanUrl(url));
        }
        if (window.tcisInitRowMenus) window.tcisInitRowMenus();
      }

      function load(pushState) {
        var url = buildUrl();
        if (inFlight) inFlight.abort();
        inFlight = ("AbortController" in window) ? new AbortController() : null;

        results.classList.add("is-loading");
        fetch(url, {
          credentials: "same-origin",
          signal: inFlight ? inFlight.signal : undefined
        })
          .then(function (response) {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.text();
          })
          .then(function (html) {
            var holder = document.getElementById("cycloneResults");
            if (holder) holder.outerHTML = html;
            onReplaced(pushState, url);
          })
          .catch(function (error) {
            if (error && error.name === "AbortError") return;
            // Anything unexpected: fall back to a plain page load so the admin
            // still gets results instead of a dead search box.
            window.location.href = cleanUrl(url);
          });
      }

      function schedule() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { load(true); }, 300);
      }

      // Search-as-you-type
      form.querySelectorAll("input[name='q']").forEach(function (input) {
        input.addEventListener("input", schedule);
      });

      // Filters apply instantly on selection (selects fire "change", not "input")
      form.querySelectorAll("select").forEach(function (select) {
        select.addEventListener("change", function () {
          if (timer) clearTimeout(timer);
          load(true);
        });
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (timer) clearTimeout(timer);
        load(true);
      });

      window.addEventListener("popstate", function () {
        window.location.reload();
      });
    })();

    // 3-dot row menus: click toggles Edit/Delete, closes on outside-click or
    // Escape. Re-runnable — the live search replaces the table rows, so the
    // freshly inserted menus must be wired up again after every swap (hence
    // the data-menu-wired guard instead of binding the document handlers
    // more than once).
    window.tcisInitRowMenus = (function () {
      function closeAll(except) {
        document.querySelectorAll(".row-menu").forEach(function (menu) {
          if (menu === except) return;
          var btn = menu.querySelector(".row-menu-btn");
          var list = menu.querySelector(".row-menu-list");
          if (list) list.hidden = true;
          if (btn) btn.setAttribute("aria-expanded", "false");
          menu.classList.remove("is-open");
        });
      }

      document.addEventListener("click", function () { closeAll(null); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeAll(null);
      });

      return function initRowMenus() {
        var menus = Array.prototype.slice.call(document.querySelectorAll(".row-menu"));
        if (!menus.length) return;

        // Last two rows open upward so the menu is never clipped.
        menus.forEach(function (m) { m.classList.remove("is-up"); });
        menus.slice(-2).forEach(function (m) { m.classList.add("is-up"); });

        menus.forEach(function (menu) {
          if (menu.dataset.menuWired === "1") return;
          var btn = menu.querySelector(".row-menu-btn");
          var list = menu.querySelector(".row-menu-list");
          if (!btn || !list) return;

          menu.dataset.menuWired = "1";
          btn.addEventListener("click", function (e) {
            e.stopPropagation();
            var willOpen = list.hidden;
            closeAll(menu);
            list.hidden = !willOpen;
            btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
            menu.classList.toggle("is-open", willOpen);
          });
          list.addEventListener("click", function (e) { e.stopPropagation(); });
        });
      };
    })();

    window.tcisInitRowMenus();
  </script>
</body>
</html>
