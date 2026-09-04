<?php
require 'auth.php'; // blocks access unless logged in
require 'helpers.php'; // shared db_connect() + val()/err()/cls()/options()

$conn = db_connect();
$message = "";
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $storm_name = $_POST['storm_name'] ?? '';
    $status = $_POST['status'] ?? '';
    // "None mode": when the "No active storm right now" box is checked the
    // checkbox is present in the POST (value=0) → is_active = 0 (hidden from
    // the public site). Unchecked (absent from POST) → is_active = 1 (shown).
    $is_active = isset($_POST['is_active']) ? 0 : 1;
    $max_wind = $_POST['max_wind'] ?? null;
    $category = $_POST['category'] ?? '';
    $movement_speed = $_POST['movement_speed'] ?? null;
    $movement_direction = $_POST['movement_direction'] ?? '';
    $pagasa_signal = $_POST['pagasa_signal'] ?? '';
    $central_pressure = $_POST['central_pressure'] ?? null;
    $forecast_landfall_date = $_POST['forecast_landfall_date'] ?: null;
    $forecast_landfall_note = $_POST['forecast_landfall_note'] ?? '';
    $location_note = $_POST['location_note'] ?? '';
    $advisory_notes = $_POST['advisory_notes'] ?? '';

    if ($is_active === 1) {
    // Validate fields
    if (trim($storm_name) === '') {
        $errors['storm_name'] = "Storm name is required.";
    }
    if (trim($status) === '') {
        $errors['status'] = "Status is required.";
    }

    // Max Wind / Movement Speed / Central Pressure are required: they cannot
    // be blank and cannot be 0 (a 0 value would render as "0 km/h" / "0 hPa"
    // on the public site and is never a meaningful storm measurement)
    $numberFields = [
        'max_wind'         => 'Max wind',
        'movement_speed'   => 'Movement speed',
        'central_pressure' => 'Central pressure',
    ];
    foreach ($numberFields as $numField => $numLabel) {
        $raw = $$numField;
        if ($raw === '' || $raw === null) {
            $errors[$numField] = "This field cannot be 0 or empty";
        } elseif (!is_numeric($raw)) {
            $errors[$numField] = "$numLabel must be a number.";
        } elseif ((int)$raw === 0) {
            // Also catches decimals that would be stored as 0 (e.g. "0.4")
            $errors[$numField] = "This field cannot be 0 or empty";
        }
    }
    } // end if ($is_active === 1) — the required-field rules are skipped when
      // the storm is set to "NONE"; the profile is hidden from the public site.

    // Blank number fields save as NULL, not 0
    $max_wind = ($max_wind !== '' && is_numeric($max_wind)) ? (int)$max_wind : null;
    $movement_speed = ($movement_speed !== '' && is_numeric($movement_speed)) ? (int)$movement_speed : null;
    $central_pressure = ($central_pressure !== '' && is_numeric($central_pressure)) ? (int)$central_pressure : null;

    // Keep field list + values together in ONE place, so the type
    // string can never drift out of sync with the variable list again.
    $fields = [
        'is_active'               => ['i', $is_active],
        'storm_name'              => ['s', $storm_name],
        'status'                  => ['s', $status],
        'max_wind'                => ['i', $max_wind],
        'category'                => ['s', $category],
        'movement_speed'          => ['i', $movement_speed],
        'movement_direction'      => ['s', $movement_direction],
        'pagasa_signal'           => ['s', $pagasa_signal],
        'central_pressure'        => ['i', $central_pressure],
        'forecast_landfall_date'  => ['s', $forecast_landfall_date],
        'forecast_landfall_note'  => ['s', $forecast_landfall_note],
        'location_note'           => ['s', $location_note],
        'advisory_notes'          => ['s', $advisory_notes],
    ];

    if (empty($errors)) {
    $existing = $conn->query("SELECT id FROM upcoming_storm LIMIT 1");

    $columns = array_keys($fields);
    $types = implode('', array_column($fields, 0));
    $values = array_column($fields, 1);

    if ($existing->num_rows > 0) {
        $row = $existing->fetch_assoc();
        $setClause = implode('=?, ', $columns) . '=?';
        $stmt = $conn->prepare("UPDATE upcoming_storm SET $setClause WHERE id=?");

        $types .= 'i';           // for id
        $values[] = $row['id'];  // append id last
    } else {
        $placeholders = implode(', ', array_fill(0, count($columns), '?'));
        $columnList = implode(', ', $columns);
        $stmt = $conn->prepare("INSERT INTO upcoming_storm ($columnList) VALUES ($placeholders)");
    }

    $stmt->bind_param($types, ...$values);

    if ($stmt->execute()) {
        $message = "Saved successfully!";
    } else {
        $message = "Error: " . $stmt->error;
    }
    $stmt->close();
    } else {
        $message = "Please fix the errors below.";
    }
}

// Load current values to pre-fill the form
$current = $conn->query("SELECT * FROM upcoming_storm LIMIT 1")->fetch_assoc();
$conn->close();

// Checkbox state: checked means "No active storm right now" (is_active = 0).
// On GET it reflects the saved DB value; after a failed POST it keeps the
// admin's submitted choice so the form doesn't flip back on them.
$isActiveChecked = $_SERVER['REQUEST_METHOD'] === 'POST'
    ? isset($_POST['is_active'])
    : ((int) ($current['is_active'] ?? 1) === 0);

// val()/err()/cls()/options() now live in helpers.php, shared with the
// historical cyclone pages so the validation display stays identical.
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Edit Upcoming Storm — Tropical Cyclone Information System</title>
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
      <div class="admin-hero-icon admin-hero-icon--navy">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div>
        <h1 class="admin-hero-title">Upcoming Storm</h1>
        <p class="admin-hero-sub">These details appear in the Upcoming Storm Profile on the public site.</p>
      </div>
    </section>

    <?php if ($message): ?>
      <div class="alert <?php echo (strpos($message, 'Error') === 0) ? 'alert-error' : 'alert-success'; ?>">
        <?php echo (strpos($message, 'Error') === 0)
          ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" /><path d="M12 11v5M12 7.5v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>'
          : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>'; ?>
        <span><?php echo htmlspecialchars($message); ?></span>
      </div>
    <?php endif; ?>

    <form id="stormForm" method="POST" novalidate>
      <!-- None-mode toggle: checked = hide the storm from the public site -->
      <section class="admin-card admin-card--section none-mode-card" data-reveal style="--reveal-delay: 0.02s">
        <label class="none-toggle">
          <input type="checkbox" name="is_active" value="0"<?php echo $isActiveChecked ? ' checked' : ''; ?>>
          <span class="none-toggle-text">
            <strong>No active storm right now</strong>
            <small>Hide the upcoming-storm profile from the public site. Your details stay saved so you can re-enable this storm later.</small>
          </span>
        </label>
      </section>

      <!-- Card 1: Storm details -->
      <section class="admin-card admin-card--section" data-reveal style="--reveal-delay: 0.08s">
        <div class="form-card-header">
          <span class="form-card-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </span>
          <h2 class="form-card-title">Storm details</h2>
        </div>
        <div class="form-grid">
          <div>
            <label for="f_storm_name">Storm Name</label>
            <input type="text" id="f_storm_name" name="storm_name"<?php echo cls('storm_name'); ?> value="<?php echo val('storm_name'); ?>" placeholder="e.g. TY ODIN">
            <?php echo err('storm_name'); ?>
          </div>
          <div>
            <label for="f_max_wind">Max Wind (km/h)</label>
            <input type="number" id="f_max_wind" name="max_wind"<?php echo cls('max_wind'); ?> value="<?php echo val('max_wind'); ?>">
            <?php echo err('max_wind'); ?>
          </div>
          <div>
            <label for="f_movement_speed">Movement Speed (km/h)</label>
            <input type="number" id="f_movement_speed" name="movement_speed"<?php echo cls('movement_speed'); ?> value="<?php echo val('movement_speed'); ?>">
            <?php echo err('movement_speed'); ?>
          </div>
          <div>
            <label for="f_central_pressure">Central Pressure (hPa)</label>
            <input type="number" id="f_central_pressure" name="central_pressure"<?php echo cls('central_pressure'); ?> value="<?php echo val('central_pressure'); ?>">
            <?php echo err('central_pressure'); ?>
          </div>
        </div>
      </section>

      <!-- Card 2: Classification (Category auto-suggests from Max Wind) -->
      <section class="admin-card admin-card--section" data-reveal style="--reveal-delay: 0.12s">
        <div class="form-card-header">
          <span class="form-card-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </span>
          <h2 class="form-card-title">Classification</h2>
        </div>
        <div class="form-grid">
          <div>
            <label for="f_category">Category</label>
            <select id="f_category" name="category"<?php echo cls('category'); ?>>
              <?php echo options('category', ['Tropical Depression (TD)', 'Tropical Storm (TS)', 'Severe Tropical Storm (STS)', 'Typhoon (TY)', 'Super Typhoon (STY)'], 'Select category'); ?>
            </select>
          </div>
          <div>
            <label for="f_status">Status</label>
            <select id="f_status" name="status"<?php echo cls('status'); ?>>
              <?php echo options('status', ['Approaching', 'Getting Stronger', 'Active', 'Getting Weaker', 'Gone']); ?>
            </select>
            <?php echo err('status'); ?>
          </div>
        </div>
      </section>

      <!-- Card 3: Forecast information -->
      <section class="admin-card admin-card--section" data-reveal style="--reveal-delay: 0.16s">
        <div class="form-card-header">
          <span class="form-card-icon">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          </span>
          <h2 class="form-card-title">Forecast information</h2>
        </div>
        <div class="form-grid">
          <div>
            <label for="f_forecast_landfall_note">Forecast Landfall Note</label>
            <select id="f_forecast_landfall_note" name="forecast_landfall_note"<?php echo cls('forecast_landfall_note'); ?>>
              <?php echo options('forecast_landfall_note', ['Early Morning', 'Morning', 'Noon', 'Afternoon', 'Evening', 'Night', 'Midnight']); ?>
            </select>
          </div>
          <div>
            <label for="f_movement_direction">Movement Direction</label>
            <select id="f_movement_direction" name="movement_direction"<?php echo cls('movement_direction'); ?>>
              <?php echo options('movement_direction', ['North (N)', 'North-Northeast (NNE)', 'Northeast (NE)', 'East-Northeast (ENE)', 'East (E)', 'East-Southeast (ESE)', 'Southeast (SE)', 'South-Southeast (SSE)', 'South (S)', 'South-Southwest (SSW)', 'Southwest (SW)', 'West-Southwest (WSW)', 'West (W)', 'West-Northwest (WNW)', 'Northwest (NW)', 'North-Northwest (NNW)']); ?>
            </select>
          </div>
          <div>
            <label for="f_pagasa_signal">PAGASA Signal</label>
            <select id="f_pagasa_signal" name="pagasa_signal"<?php echo cls('pagasa_signal'); ?>>
              <?php echo options('pagasa_signal', ['Signal No. 1', 'Signal No. 2', 'Signal No. 3', 'Signal No. 4', 'Signal No. 5']); ?>
            </select>
          </div>
          <div>
            <label for="f_forecast_landfall_date">Forecast Landfall Date</label>
            <input type="date" id="f_forecast_landfall_date" name="forecast_landfall_date"<?php echo cls('forecast_landfall_date'); ?> value="<?php echo val('forecast_landfall_date'); ?>">
          </div>
          <div class="form-full">
            <label for="f_location_note">Location Note</label>
            <input type="text" id="f_location_note" name="location_note"<?php echo cls('location_note'); ?> value="<?php echo val('location_note'); ?>" placeholder="e.g. 420 km E of Catanduanes">
          </div>
          <div class="form-full">
            <label for="f_advisory_notes">Advisory Notes</label>
            <textarea id="f_advisory_notes" name="advisory_notes"<?php echo cls('advisory_notes'); ?> rows="4" placeholder="One advisory per line — each line becomes a bullet on the public site."><?php echo val('advisory_notes'); ?></textarea>
          </div>
        </div>
      </section>
    </form>
  </main>

  <!-- Sticky action bar: Cancel + Save Changes (right-aligned, like the mock) -->
  <div class="storm-actions">
    <div class="storm-actions-inner">
      <a href="dashboard.php" class="admin-btn admin-btn--inline admin-btn--cancel">Cancel</a>
      <button type="submit" form="stormForm" class="admin-btn admin-btn--inline">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        Save Changes
      </button>
    </div>
  </div>

  <?php require 'partials/site-footer.php'; ?>

  <script>
    // Client-side validation: mirrors the PHP rules above. Empty Storm Name /
    // Status turn their field red instantly and the form is NOT submitted;
    // numeric fields must also be filled in and cannot be 0. The PHP checks
    // remain the authority in case JS is disabled or bypassed. Max Wind also
    // auto-suggests the Category dropdown (PAGASA wind ranges, see below).
    (function () {
      var form = document.querySelector("form");
      if (!form) return;

      var requiredMsg = {
        storm_name: "Storm name is required.",
        status: "Status is required."
      };
      // Numeric fields: required, must be a number, and must not be 0 —
      // same rules and messages as the PHP validation above.
      var zeroMsg = "This field cannot be 0 or empty";
      var numericMsg = {
        max_wind: "Max wind must be a number.",
        movement_speed: "Movement speed must be a number.",
        central_pressure: "Central pressure must be a number."
      };

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

        // When "No active storm right now" is checked (none mode), skip the
        // required-field rules — the admin is intentionally clearing the form
        // and the profile is hidden from the public site anyway. The PHP
        // checks skip the same rules when is_active = 0.
        var noneMode = form.elements["is_active"] && form.elements["is_active"].checked;

        if (!noneMode) {
        Object.keys(requiredMsg).forEach(function (name) {
          var input = form.elements[name];
          if (input && input.value.trim() === "") {
            showError(input, requiredMsg[name]);
            valid = false;
          }
        });

        Object.keys(numericMsg).forEach(function (name) {
          var input = form.elements[name];
          if (!input) return;
          var v = input.value.trim();
          if (v === "" || Number(v) === 0) {
            showError(input, zeroMsg);
            valid = false;
          } else if (isNaN(Number(v))) {
            showError(input, numericMsg[name]);
            valid = false;
          }
        });
        }

        if (!valid) {
          e.preventDefault();
          var first = form.querySelector(".input-error");
          if (first) first.focus();
        }
      });

      // Clear a field's red state as soon as the user edits it again.
      // Text/number fields fire "input" on every keystroke; dropdowns
      // (select) only fire "change", so both events are watched.
      Array.prototype.forEach.call(
        form.querySelectorAll("input, select, textarea"),
        function (input) {
          input.addEventListener("input", function () { removeError(input); });
          input.addEventListener("change", function () { removeError(input); });
        }
      );

      // ------------------------------------------------------------------
      // Category auto-suggest from Max Wind (PAGASA wind ranges):
      //   61-88 TD | 89-117 TS | 118-148 STS | 149-184 TY | 185+ STY
      // Below 61 / empty / invalid wind resets Category to its placeholder.
      // The suggestion tags the matching option's DISPLAY TEXT with
      // " (current)" — the option's value stays the clean category string,
      // so exactly that value is saved. Picking a category manually strips
      // the tag (manual override); editing Max Wind re-applies the tag.
      // Nothing fires on page load, so a saved category is never rewritten
      // before the admin actually edits the wind.
      // ------------------------------------------------------------------
      var categorySelect = form.elements["category"];
      var windField = form.elements["max_wind"];
      var windTag = " (current)";

      function categoryForWind(value) {
        if (value === "") return null;
        var n = Number(value);
        if (isNaN(n) || n < 61) return null;
        if (n <= 88)  return "Tropical Depression (TD)";
        if (n <= 117) return "Tropical Storm (TS)";
        if (n <= 148) return "Severe Tropical Storm (STS)";
        if (n <= 184) return "Typhoon (TY)";
        return "Super Typhoon (STY)";
      }

      function clearWindTags() {
        Array.prototype.forEach.call(categorySelect.options, function (opt) {
          if (opt.text.length > windTag.length &&
              opt.text.slice(-windTag.length) === windTag) {
            opt.text = opt.text.slice(0, -windTag.length);
          }
        });
      }

      function autoSuggestCategory() {
        clearWindTags();
        var cat = categoryForWind(windField.value.trim());
        if (!cat) {
          categorySelect.value = ""; // back to "Select category"
          return;
        }
        Array.prototype.forEach.call(categorySelect.options, function (opt) {
          if (opt.value === cat) {
            opt.text = opt.text + windTag;
          }
        });
        categorySelect.value = cat;
      }

      windField.addEventListener("input", autoSuggestCategory);
      categorySelect.addEventListener("change", clearWindTags);
    })();
  </script>
  <script src="../js/main.js" data-root="../"></script>
</body>
</html>