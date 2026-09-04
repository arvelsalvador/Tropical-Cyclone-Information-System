<?php
require 'auth.php';
require 'helpers.php';

// Historical Cyclones — add / edit form (no ?id= = add, ?id=N = edit).
// PHP is the validation authority; the client script re-checks the same rules.
// Data written here feeds the public Historical Data and Metrics pages.

$id = isset($_GET['id']) ? (int) $_GET['id'] : 0; // >0 = edit mode

$errors = [];
$current = null;

$conn = db_connect();
$db_error = '';

if ($conn->connect_error) {
    $db_error = 'Database connection failed. Please check that MySQL is running.';
} else {
    if ($id > 0) {
        $stmt = $conn->prepare('SELECT * FROM cyclones WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $current = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$current) {
            // Unknown id → back to the list instead of an empty edit form.
            $conn->close();
            header('Location: cyclones.php');
            exit;
        }
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $local_name = trim($_POST['local_name'] ?? '');
        $international_name = trim($_POST['international_name'] ?? '');
        $year = trim($_POST['year'] ?? '');
        $date_start = trim($_POST['date_start'] ?? '');
        $date_end = trim($_POST['date_end'] ?? '');
        $highest_category = $_POST['highest_category'] ?? '';
        $highest_strength = trim($_POST['highest_strength'] ?? '');
        $tcws_country = $_POST['tcws_country'] ?? '';
        $tcws_slprsd_area = $_POST['tcws_slprsd_area'] ?? '';
        $tcws_region5 = $_POST['tcws_region5'] ?? '';
        $tcws_camarines_norte = $_POST['tcws_camarines_norte'] ?? '';

        // Validation — PHP is the authority
        if ($local_name === '') {
            $errors['local_name'] = 'Local name is required.';
        }
        if ($year === '' || !ctype_digit($year) || (int) $year < 1901 || (int) $year > 2155) {
            $errors['year'] = 'Enter a valid year (1901-2155).';
        }
        foreach (['date_start', 'date_end'] as $dateField) {
            $v = $$dateField;
            if ($v !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
                $errors[$dateField] = 'Use the date picker (YYYY-MM-DD).';
            }
        }
        if (!isset($errors['date_start']) && !isset($errors['date_end'])
            && $date_start !== '' && $date_end !== '' && $date_end < $date_start) {
            $errors['date_end'] = 'End date cannot be before the start date.';
        }
        // Stored as "sustained/gust", e.g. "185/230" (same format as existing rows)
        if ($highest_strength !== '' && !preg_match('/^\d{1,3}\s*\/\s*\d{1,3}$/', $highest_strength)) {
            $errors['highest_strength'] = 'Use the format sustained/gust, e.g. 185/230.';
        }
        $signalFields = [
            'tcws_country'         => 'National',
            'tcws_slprsd_area'     => 'SLPRSD Area',
            'tcws_region5'         => 'Region 5',
            'tcws_camarines_norte' => 'Camarines Norte',
        ];
        foreach ($signalFields as $sigField => $sigLabel) {
            $v = $$sigField;
            if ($v !== '' && (!ctype_digit($v) || (int) $v < 1 || (int) $v > 5)) {
                $errors[$sigField] = 'Choose a signal number between 1 and 5, or None.';
            }
        }

        if (empty($errors)) {
            // Blank optional fields save as NULL, matching the table columns.
            $international_name = $international_name !== '' ? $international_name : null;
            $date_start = $date_start !== '' ? $date_start : null;
            $date_end = $date_end !== '' ? $date_end : null;
            $highest_category = $highest_category !== '' ? $highest_category : null;
            $highest_strength = $highest_strength !== '' ? preg_replace('/\s+/', '', $highest_strength) : null;
            foreach ($signalFields as $sigField => $sigLabel) {
                $$sigField = $$sigField !== '' ? (int) $$sigField : null;
            }

            // Field list + types + values in ONE place so the bind string can
            // never drift out of sync (same pattern as edit-storm.php).
            $fields = [
                'local_name'           => ['s', $local_name],
                'international_name'   => ['s', $international_name],
                'year'                 => ['i', (int) $year],
                'date_start'           => ['s', $date_start],
                'date_end'             => ['s', $date_end],
                'highest_category'     => ['s', $highest_category],
                'highest_strength'     => ['s', $highest_strength],
                'tcws_country'         => ['i', $tcws_country],
                'tcws_slprsd_area'     => ['i', $tcws_slprsd_area],
                'tcws_region5'         => ['i', $tcws_region5],
                'tcws_camarines_norte' => ['i', $tcws_camarines_norte],
            ];
            $columns = array_keys($fields);
            $types = implode('', array_column($fields, 0));
            $values = array_column($fields, 1);

            if ($id > 0) {
                $setClause = implode('=?, ', $columns) . '=?';
                $stmt = $conn->prepare("UPDATE cyclones SET $setClause WHERE id=?");
                $types .= 'i';           // for id
                $values[] = $id;         // append id last
            } else {
                $placeholders = implode(', ', array_fill(0, count($columns), '?'));
                $columnList = implode(', ', $columns);
                $stmt = $conn->prepare("INSERT INTO cyclones ($columnList) VALUES ($placeholders)");
            }

            $stmt->bind_param($types, ...$values);
            $stmt->execute();
            $stmt->close();
            $conn->close();

            // Redirect-after-POST: the list page shows the result banner.
            header('Location: cyclones.php?' . ($id > 0 ? 'updated=1' : 'saved=1'));
            exit;
        }
        // Validation failed → fall through and re-render with what was typed.
    }
}

$categoryLabels = [
    'TD'  => 'Tropical Depression (TD)',
    'TS'  => 'Tropical Storm (TS)',
    'STS' => 'Severe Tropical Storm (STS)',
    'TY'  => 'Typhoon (TY)',
    'STY' => 'Super Typhoon (STY)',
];
$signalChoices = ['1', '2', '3', '4', '5'];
$signalLabels = [
    '1' => 'Signal No. 1',
    '2' => 'Signal No. 2',
    '3' => 'Signal No. 3',
    '4' => 'Signal No. 4',
    '5' => 'Signal No. 5',
];

if ($db_error === '') {
    $conn->close();
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?php echo $id > 0 ? 'Edit' : 'Add'; ?> Historical Cyclone — Admin — Tropical Cyclone Information System</title>
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
    <section class="admin-hero" data-reveal>
      <div class="admin-hero-icon admin-hero-icon--purple">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      </div>
      <div>
        <h1 class="admin-hero-title"><?php echo $id > 0 ? 'Edit Historical Cyclone' : 'Add Historical Cyclone'; ?></h1>
        <p class="admin-hero-sub">
          <?php if ($id > 0): ?>
            Updating <strong><?php echo htmlspecialchars($current['local_name']); ?> (<?php echo htmlspecialchars((string) $current['year']); ?>)</strong> — this record appears on the public Historical Data and Metrics pages.
          <?php else: ?>
            New records appear immediately on the public Historical Data and Metrics pages.
          <?php endif; ?>
        </p>
      </div>
    </section>

    <section class="admin-card admin-card--form" data-reveal style="--reveal-delay: 0.08s">
      <?php if ($db_error !== ''): ?>
        <div class="alert alert-error">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 11v5M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span><?php echo htmlspecialchars($db_error); ?></span>
        </div>
        <a class="admin-btn admin-btn--inline" href="cyclones.php">Back to list</a>
      <?php else: ?>

      <form method="POST" novalidate>
        <div class="form-section-title">Identity</div>
        <div class="form-grid">
          <div>
            <label for="f_local">Local Name *</label>
            <input type="text" id="f_local" name="local_name"<?php echo cls('local_name'); ?>
                   value="<?php echo val('local_name'); ?>" placeholder="e.g. Opong">
            <?php echo err('local_name'); ?>
          </div>
          <div>
            <label for="f_intl">International Name</label>
            <input type="text" id="f_intl" name="international_name"
                   value="<?php echo val('international_name'); ?>" placeholder="e.g. Bualoi">
          </div>
        </div>

        <div class="form-section-title">Period &amp; Peak</div>
        <div class="form-grid">
          <div>
            <label for="f_year">Year *</label>
            <input type="number" id="f_year" name="year" min="1901" max="2155"<?php echo cls('year'); ?>
                   value="<?php echo val('year'); ?>" placeholder="e.g. 2025">
            <?php echo err('year'); ?>
          </div>
          <div>
            <label for="f_cat">Highest Category</label>
            <select id="f_cat" name="highest_category"<?php echo cls('highest_category'); ?>>
              <?php echo options('highest_category', array_keys($categoryLabels), 'Select category', $categoryLabels); ?>
            </select>
          </div>
          <div>
            <label for="f_start">Start Date</label>
            <input type="date" id="f_start" name="date_start"<?php echo cls('date_start'); ?>
                   value="<?php echo val('date_start'); ?>">
            <?php echo err('date_start'); ?>
          </div>
          <div>
            <label for="f_end">End Date</label>
            <input type="date" id="f_end" name="date_end"<?php echo cls('date_end'); ?>
                   value="<?php echo val('date_end'); ?>">
            <?php echo err('date_end'); ?>
          </div>
          <div>
            <label for="f_strength">Highest Strength — Sustained/Gust (km/h)</label>
            <input type="text" id="f_strength" name="highest_strength"<?php echo cls('highest_strength'); ?>
                   value="<?php echo val('highest_strength'); ?>" placeholder="e.g. 185/230">
            <div class="field-hint">Format: sustained/gust — e.g. 185/230.</div>
            <?php echo err('highest_strength'); ?>
          </div>
        </div>
        <div class="form-section-title">Highest Signals Raised</div>
        <div class="form-grid">
          <?php foreach (['tcws_country' => 'National', 'tcws_slprsd_area' => 'SLPRSD Area', 'tcws_region5' => 'Region 5', 'tcws_camarines_norte' => 'Camarines Norte'] as $sigField => $sigLabel): ?>
          <div>
            <label for="f_<?php echo $sigField; ?>"><?php echo htmlspecialchars($sigLabel); ?> Signal</label>
            <select id="f_<?php echo $sigField; ?>" name="<?php echo $sigField; ?>"<?php echo cls($sigField); ?>>
              <?php echo options($sigField, $signalChoices, 'None', $signalLabels); ?>
            </select>
            <?php echo err($sigField); ?>
          </div>
          <?php endforeach; ?>
        </div>

        <button type="submit" class="admin-btn admin-btn--inline">Save Cyclone</button>
        <a href="cyclones.php" class="form-cancel">Cancel</a>
      </form>
      <?php endif; ?>
    </section>
  </main>

  <?php require 'partials/site-footer.php'; ?>

  <script>
    // Client-side validation mirroring the PHP rules: Local Name + Year are
    // required, strength must look like sustained/gust, and the end date
    // cannot precede the start date. The PHP checks remain the authority.
    (function () {
      var form = document.querySelector("form");
      if (!form) return;

      function showError(input, message) {
        removeError(input);
        input.classList.add("input-error");
        var note = document.createElement("div");
        note.className = "field-error";
        note.textContent = message;
        input.insertAdjacentElement("afterend", note);
      }

      function removeError(input) {
        input.classList.remove("input-error");
        var next = input.nextElementSibling;
        if (next && next.classList.contains("field-error")) next.remove();
      }

      form.addEventListener("submit", function (e) {
        var valid = true;
        Array.prototype.forEach.call(form.querySelectorAll(".input-error"), removeError);

        var localName = form.elements["local_name"];
        if (localName && localName.value.trim() === "") {
          showError(localName, "Local name is required.");
          valid = false;
        }

        var year = form.elements["year"];
        var yearVal = year ? year.value.trim() : "";
        if (year && (yearVal === "" || !/^\d{4}$/.test(yearVal) || +yearVal < 1901 || +yearVal > 2155)) {
          showError(year, "Enter a valid year (1901-2155).");
          valid = false;
        }

        var strength = form.elements["highest_strength"];
        if (strength && strength.value.trim() !== "" && !/^\d{1,3}\s*\/\s*\d{1,3}$/.test(strength.value.trim())) {
          showError(strength, "Use the format sustained/gust, e.g. 185/230.");
          valid = false;
        }

        var start = form.elements["date_start"], end = form.elements["date_end"];
        if (start && end && start.value && end.value && end.value < start.value) {
          showError(end, "End date cannot be before the start date.");
          valid = false;
        }

        if (!valid) {
          e.preventDefault();
          var first = form.querySelector(".input-error");
          if (first) first.focus();
        }
      });

      // Clear a field's red state as soon as the admin edits it again.
      Array.prototype.forEach.call(
        form.querySelectorAll("input, select, textarea"),
        function (input) {
          input.addEventListener("input", function () { removeError(input); });
          input.addEventListener("change", function () { removeError(input); });
        }
      );
    })();
  </script>
  <script src="../js/main.js" data-root="../"></script>
</body>
</html>
