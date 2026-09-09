// Tropical Cyclone Information System — Compare Storms page
// Renders the upcoming storm profile's historical analogues, wires the
// comparison controls, and renders the results table.
//
// UPDATED: data now comes live from MySQL via get_cyclones.php.
// Rainfall, pressure, direction, and location have been removed since
// they are not currently tracked in the database — comparisons now run
// on wind speed and PAGASA category only. These can be re-added later
// once that data is collected.
// The Best Match panel re-fetches the upcoming storm profile whenever the
// tab regains focus, so admin edits (e.g. Max Wind) show up immediately
// without a manual reload.
//
// SIMPLIFIED: storm picking is now two plain <select> dropdowns (storm A
// required, storm B optional). The old searchable/filterable/sortable
// panels and their "Sort by" toolbar were removed.
//
// SEARCHABLE DROPDOWNS: each dropdown opens a small panel (native selects
// can't be searched) with a search input above the storm list; the list
// filters as you type. A hidden <select> per picker stays the source of
// truth, so compare/tie/reset logic works unchanged.

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------
  const API_URL = "/Weather/api/get_cyclones.php"; // adjust path if needed
  const UPCOMING_API_URL = "/Weather/api/get_upcoming_storm.php"; // adjust path if needed

  // "Upcoming" storm profile. Defaults below act as demo/fallback data; the
  // live values come from the admin-managed `upcoming_storm` table
  // (edited via admin/edit-storm.php) and are loaded in loadUpcoming().
  let UPCOMING = {
    name: "TY ODIN",
    year: 2025,
    wind: 185,
    peak: null,
    category: "Typhoon",
  };

  const CATEGORY_RANK = {
    "Tropical Depression": 1,
    "Tropical Storm": 2,
    "Severe Tropical Storm": 3,
    Typhoon: 4,
    "Super Typhoon": 5,
  };

  const CATEGORY_MAP = {
    TD: "Tropical Depression",
    TS: "Tropical Storm",
    STS: "Severe Tropical Storm",
    TY: "Typhoon",
    STY: "Super Typhoon",
  };

  // Whether there is an ACTIVE upcoming storm (the admin's "No active storm"
  // switch sets is_active = 0). Defaults to true so the demo fallback keeps
  // working until the API answers; set to false when the storm is hidden.
  let hasUpcomingStorm = true;

  // Populated by loadData() on startup — replaces the old static STORMS array.
  let STORMS = [];

  // Selected storm per dropdown (by name — the identity runCompare uses).
  const selection = { stormA: "", stormB: "" };

  // Comparison modes drive both the results subtitle and the tab labels;
  // add new modes here first, then their metric logic in renderStrength.
  // The subtitle is generated from the active mode's context string, so a
  // new mode only needs its own entry — nothing is hardcoded per result.
  const COMPARISON_MODES = {
    strength: { subtitle: "Comparing cyclones by strength" },
  };
  const activeMode = "strength";

  // ---------------------------------------------------------------------
  // Element references
  // ---------------------------------------------------------------------
  const analogueList = document.getElementById("analogueList");
  // Hidden <select> per picker keeps the source of truth (the visible
  // control is a button + search panel — see the pickers section below).
  const stormASelect = document.getElementById("stormA-select");
  const stormBSelect = document.getElementById("stormB-select");
  const compareBtn = document.getElementById("compareNowBtn");
  const resetBtn = document.getElementById("resetBtn");
  const resultsSubtitle = document.getElementById("resultsSubtitle");
  const tableBody = document.getElementById("resultsTableBody");
  const colAHead = document.getElementById("colAHead");
  const colBHead = document.getElementById("colBHead");
  const winnerBanner = document.getElementById("winnerBanner");
  const winnerBannerLabel = document.getElementById("winnerBannerLabel");
  const winnerBannerName = document.getElementById("winnerBannerName");
  const winnerBannerDetail = document.getElementById("winnerBannerDetail");
  const winnerBannerIcon = winnerBanner
    ? winnerBanner.querySelector(".winner-banner-icon")
    : null;
  const analogueModal = document.getElementById("analogueModal");
  // Searchable picker refs (stormA / stormB), collected once in init().
  const pickers = {};
  const analogueModalTitle = document.getElementById("analogueModalTitle");
  const analogueModalKicker = document.getElementById("analogueModalKicker");
  const analogueModalSummary = document.getElementById("analogueModalSummary");
  const analogueModalStats = document.getElementById("analogueModalStats");
  const analogueComparisonStorm = document.getElementById("analogueComparisonStorm");
  const analogueComparisonBody = document.getElementById("analogueComparisonBody");
  const analogueModalExplanation = document.getElementById("analogueModalExplanation");

  let lastModalTrigger = null;
  // Display precision for match percentages; renderAnalogues() raises it
  // when two Top 3 candidates would otherwise render identically.
  let scoreDecimals = 1;
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // ---------------------------------------------------------------------
  // Data loading + mapping
  // ---------------------------------------------------------------------
  function formatDateRange(startStr, endStr) {
    if (!startStr) return "—";
    const opts = { month: "short", day: "numeric" };
    const start = new Date(startStr + "T00:00:00");
    const startText = start.toLocaleDateString("en-US", opts);
    if (!endStr) {
      return startText + ", " + start.getFullYear();
    }
    const end = new Date(endStr + "T00:00:00");
    const endText = end.toLocaleDateString("en-US", opts);
    // Single-day cyclones (end date same as start) keep the inclusive
    // range format, e.g. "Apr 12 – Apr 12, 2022".
    return startText + " \u2013 " + endText + ", " + start.getFullYear();
  }

  function mapRow(row) {
    const name = row.international_name
      ? row.local_name + " (" + row.international_name + ")"
      : row.local_name;

    const category = CATEGORY_MAP[row.highest_category] || row.highest_category || "—";

    // highest_strength is stored as "sustained/gust" (e.g. "185/240").
    let wind = null;
    let peak = null;
    if (row.highest_strength) {
      const parts = String(row.highest_strength).split("/");
      const sustained = parseInt(parts[0], 10);
      if (!isNaN(sustained)) wind = sustained;
      if (parts.length > 1) {
        const peakVal = parseInt(parts[1], 10);
        if (!isNaN(peakVal)) peak = peakVal;
      }
    }

    // Storm duration in days — used as a secondary ranking signal.
    let days = null;
    if (row.date_start && row.date_end) {
      const start = new Date(row.date_start + "T00:00:00");
      const end = new Date(row.date_end + "T00:00:00");
      if (!isNaN(start) && !isNaN(end)) {
        days = Math.round((end - start) / 86400000) + 1;
      }
    }

    return {
      name: name,
      year: parseInt(row.year, 10),
      category: category,
      date: formatDateRange(row.date_start, row.date_end),
      // Raw dates retained for the Best Match recency tie-break.
      dateStart: row.date_start || null,
      dateEnd: row.date_end || null,
      wind: wind,
      peak: peak,
      days: days,
    };
  }

  // Applies one API row onto the UPCOMING profile. Only fields present in
  // the row are overwritten, so a partial row never blanks the profile.
  function applyUpcomingRow(row) {
    if (row.storm_name) UPCOMING.name = row.storm_name;
    if (row.max_wind != null && row.max_wind !== "") {
      const wind = parseInt(row.max_wind, 10);
      if (!isNaN(wind)) UPCOMING.wind = wind;
    }
    if (row.peak != null && row.peak !== "") {
      const peak = parseInt(row.peak, 10);
      if (!isNaN(peak)) UPCOMING.peak = peak;
    }
    if (row.category) UPCOMING.category = row.category;
  }

  async function loadUpcoming() {
    try {
      const res = await fetch(UPCOMING_API_URL);
      if (!res.ok) throw new Error("Request failed: " + res.status);
      const row = await res.json();
      // Zero active storms (admin set it to NONE): hide the profile and
      // disable analogue matching instead of comparing against the demo.
      hasUpcomingStorm = !!(row && Object.keys(row).length);
      if (!hasUpcomingStorm) return;
      applyUpcomingRow(row);
    } catch (err) {
      console.warn("Could not load upcoming storm, keeping demo profile:", err);
    }
  }

  // Re-fetches the upcoming storm when the tab regains focus, becomes
  // visible again, or is restored from the back/forward cache. The admin
  // edits the profile in another tab (admin/edit-storm.php); this keeps
  // the Best Match panel in sync without a manual reload. The panel is
  // only re-rendered when a scoring value actually changed.
  async function refreshUpcoming() {
    try {
      const res = await fetch(UPCOMING_API_URL);
      if (!res.ok) throw new Error("Request failed: " + res.status);
      const row = await res.json();
      // If the admin just switched the storm to NONE while this tab was
      // open, re-render so the stale analogues/match panel disappear.
      const nextHasUpcoming = !!(row && Object.keys(row).length);
      if (nextHasUpcoming !== hasUpcomingStorm) {
        hasUpcomingStorm = nextHasUpcoming;
        renderAnalogues();
        if (!hasUpcomingStorm) return;
      }
      if (!row) return;

      const previous = {
        wind: UPCOMING.wind,
        peak: UPCOMING.peak,
        category: UPCOMING.category,
      };
      applyUpcomingRow(row);

      const changed =
        previous.wind !== UPCOMING.wind ||
        previous.peak !== UPCOMING.peak ||
        previous.category !== UPCOMING.category;

      if (changed) renderAnalogues();
    } catch (err) {
      // Silent: a failed refresh keeps the currently displayed profile.
    }
  }

  async function loadData() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Request failed: " + res.status);
      const rows = await res.json();
      STORMS = rows.map(mapRow).filter((s) => s.wind != null);
    } catch (err) {
      console.error("Failed to load cyclone data:", err);
      STORMS = [];
      analogueList.innerHTML =
        '<p class="empty-state">Could not load data from the server. Check that XAMPP (Apache + MySQL) is running.</p>';
    }
  }

  // ---------------------------------------------------------------------
  // Analogue matching — similarity of each historical storm to the
  // upcoming one (sustained wind + peak gust + PAGASA category).
  // ---------------------------------------------------------------------

  // Gaussian (bell-curve) similarity: 100% for an exact match, decaying
  // smoothly towards 0% as the gap grows — no artificial cap or floor.
  // Gaussian similarity with a tiny directional nudge so two storms
  // equidistant from the target (e.g. -5 km/h and +5 km/h) don't render
  // as an exact tie. The nudge is small enough that it never changes
  // which group ranks closer — it only breaks symmetric-score ties.
  function gaussScore(value, target, sigma) {
    if (value == null || target == null) return null;
    const gap = value - target;
    const base = 100 * Math.exp(-(gap * gap) / (2 * sigma * sigma));

    // Directional epsilon: storms weaker than the upcoming storm (gap < 0)
    // get a hair higher score than storms stronger by the same margin
    // (gap > 0), since a slightly-weaker historical analogue is generally
    // the more conservative/useful comparison. At 0.1% per 100 km/h of gap
    // it is orders of magnitude below the Gaussian base difference between
    // two distinct wind values, so it can only split exact equidistant
    // ties — it must never reorder storms of different strength.
    const directionalNudge = -gap * 0.001;

    return Math.max(0, Math.min(100, base + directionalNudge));
  }

  // Returns the intensity rank of a PAGASA category name, or null when
  // the label is unknown. Recognises both plain names ("Typhoon") and the
  // admin dropdown's labelled format ("Typhoon (TY)") via its abbreviation.
  function categoryRank(cat) {
    if (cat == null) return null;
    if (Object.prototype.hasOwnProperty.call(CATEGORY_RANK, cat)) {
      return CATEGORY_RANK[cat];
    }
    const match = /\((TD|TS|STS|TY|STY)\)\s*$/.exec(String(cat));
    if (match && Object.prototype.hasOwnProperty.call(CATEGORY_MAP, match[1])) {
      return CATEGORY_RANK[CATEGORY_MAP[match[1]]];
    }
    return null;
  }

  // Wind-closeness match score (0–100): Gaussian similarity of the storm's
  // sustained wind to the upcoming storm's Max Wind, sigma 100 km/h. The
  // wide sigma keeps the bell curve spread across the whole historical
  // wind range, so even an upcoming storm far stronger than anything on
  // record (e.g. 400 km/h vs a 215 km/h database max) still shows a
  // meaningful spread between candidates instead of everything reading
  // ~0%, and the score ordering tracks wind closeness.
  // "Best Match · Wind Strength" ranks purely by wind closeness — peak
  // gust and PAGASA category are informational only (shown in the modal)
  // and do not factor into the score.
  function similarity(storm) {
    const score = gaussScore(storm.wind, UPCOMING.wind, 100);
    return score == null ? 0 : score;
  }

  function animateMatchScore(el, target) {
    // The final value uses the group's chosen precision (one decimal
    // normally, escalated so near-tie candidates display distinctly);
    // whole numbers during the ease-out animation keep it readable.
    if (prefersReducedMotion) {
      el.textContent = target.toFixed(scoreDecimals) + "%";
      return;
    }

    const duration = 1500;
    const start = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      if (progress < 1) {
        el.textContent = Math.round(target * eased) + "%";
        requestAnimationFrame(frame);
      } else {
        el.textContent = target.toFixed(scoreDecimals) + "%";
      }
    }

    el.textContent = "0%";
    requestAnimationFrame(frame);
  }

  // Numeric sort key for how recent a storm is (latest activity wins).
  function recentness(storm) {
    const raw = storm.dateEnd || storm.dateStart || "";
    if (!raw) return 0;
    const t = new Date(raw + "T00:00:00").getTime();
    return isNaN(t) ? 0 : t;
  }

  // Picks the display precision for the Top 3: one decimal normally, but
  // escalates to two when two candidates would render with the same
  // string, so near-tie ranks still show distinct percentages. The cap
  // stays at two because a genuine full-precision tie (identical recorded
  // data) can never be split by decimals — there, the ranking is decided
  // by the recency/peak tie-breakers instead.
  function displayDecimals(scores) {
    let decimals = 1;
    let strings = scores.map((s) => s.toFixed(decimals));
    while (new Set(strings).size !== strings.length && decimals < 2) {
      decimals++;
      strings = scores.map((s) => s.toFixed(decimals));
    }
    return decimals;
  }

  // Groups historical storms by their exact Max Wind value.
  // Assumes `storms` is already in a stable order (STORMS is built in
  // year/date order by loadData), so groups start in that order too.
  function groupByWind(storms) {
    const map = new Map();
    storms.forEach((storm) => {
      const w = storm.wind;
      if (!map.has(w)) map.set(w, { wind: w, storms: [] });
      map.get(w).storms.push(storm);
    });
    return Array.from(map.values()).sort((a, b) => a.wind - b.wind);
  }

  // Ranks wind groups by how close their wind value is to the current
  // storm's Max Wind (closest = Rank 1). Equidistant groups are ordered
  // deterministically — the stronger wind group first — so the result never
  // depends on array order.
  function rankGroupsByCloseness(groups, currentWind) {
    return groups
      .map((group) => ({ group, distance: Math.abs(group.wind - currentWind) }))
      .sort(
        (a, b) =>
          a.distance - b.distance ||
          b.group.wind - a.group.wind,
      )
      .map((entry) => entry.group);
  }

  // Picks ONE representative storm from a wind group. The tie-breaker is
  // "most recent storm date": storms that share the same wind strength are
  // presented by the most recent record. Movement speed is not tracked for
  // historical storms, so recency is the data-backed secondary factor
  // (higher peak gust and longer duration follow, then alphabetical as a
  // final deterministic guarantee).
  function pickRepresentative(group) {
    return group.storms.slice().sort((a, b) => {
      const recencyDiff = recentness(b) - recentness(a);
      if (recencyDiff !== 0) return recencyDiff;
      const peakDiff = (b.peak ?? 0) - (a.peak ?? 0);
      if (peakDiff !== 0) return peakDiff;
      const daysDiff = (b.days ?? 0) - (a.days ?? 0);
      if (daysDiff !== 0) return daysDiff;
      return String(a.name).localeCompare(String(b.name));
    })[0];
  }

  function renderAnalogues() {
    analogueList.innerHTML = "";

    if (!hasUpcomingStorm) {
      analogueList.innerHTML =
        '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none">' +
        '<path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
        "</svg>" +
        "<p>No active upcoming storm is being monitored, so there are no historical analogues to show.</p>" +
        "</div>";
      return;
    }

    const groupEl = document.createElement("section");
    groupEl.className = "match-group";

    const heading = document.createElement("h3");
    heading.className = "match-group-title";
    heading.textContent = "Best match \u00b7 wind strength";
    groupEl.appendChild(heading);

    // Best Match selection (grouping-based): storms are grouped by their
    // exact Max Wind value, the groups are ranked by how close they are to
    // the current storm's Max Wind, and ONE representative is picked from
    // each of the closest groups. Each representative therefore comes from
    // a different wind-strength group, so the Top 3 percentages are
    // naturally distinct.
    // Rank order = group closeness (rankGroupsByCloseness already returns
    // groups closest-first, stronger group first on exact ties). The
    // similarity score is display-only and must never re-order the ranks:
    // when the upcoming storm sits far outside the historical range the
    // Gaussian bases all collapse towards 0%, and a score sort would let
    // the tie-break nudge crown a weaker storm as the "best match".
    // Only match historical storms that were the same strength or weaker
    // than the upcoming storm — never stronger.
    const eligibleStorms = STORMS.filter((storm) => storm.wind <= UPCOMING.wind);

    const groups = rankGroupsByCloseness(
      groupByWind(eligibleStorms),
      UPCOMING.wind,
    );
    const matches = groups.slice(0, 3).map((group) => {
      const storm = pickRepresentative(group);
      return { storm, score: similarity(storm) };
    });

    // One decimal normally; escalate if two of the Top 3 would display
    // the same string, so each rank shows a distinct percentage.
    scoreDecimals = displayDecimals(matches.map((match) => match.score));

    matches.forEach((match, index) => {
      const rowEl = document.createElement("div");
      rowEl.className = index === 0 ? "analogue-row best-match" : "analogue-row";

      const rank = document.createElement("span");
      rank.className = "rank-number";
      rank.textContent = index + 1;

      const info = document.createElement("div");
      info.className = "analogue-info";
      info.innerHTML =
        '<div class="analogue-name">' + match.storm.name + "</div>" +
        '<div class="analogue-date">' + match.storm.date + "</div>" +
        '<div class="match-progress"><span style="width:' + match.score + '%"></span></div>';

      const sim = document.createElement("div");
      sim.className = "analogue-similarity";
      sim.innerHTML = "<strong>0%</strong>";
      const scoreEl = sim.querySelector("strong");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "analogue-view-btn";
      btn.textContent = "View";
      btn.addEventListener("click", () => {
        openAnalogueDetails(match.storm, match.score, btn);
      });

      rowEl.appendChild(rank);
      rowEl.appendChild(info);
      rowEl.appendChild(sim);
      rowEl.appendChild(btn);
      groupEl.appendChild(rowEl);
      animateMatchScore(scoreEl, match.score);
    });

    analogueList.appendChild(groupEl);

    analogueList.querySelectorAll(".analogue-row").forEach((rowEl, index) => {
      rowEl.style.setProperty("--row-delay", index * 45 + "ms");
    });
  }

  function statMarkup(label, value, icon) {
    return '<div class="analogue-modal-stat"><span class="analogue-stat-icon">' +
      icon + '</span><div><span>' + label +
      '</span><strong>' + value + "</strong></div></div>";
  }

  function comparisonRow(label, historicalValue, upcomingValue) {
    return "<tr><th scope=\"row\">" + label + "</th><td>" +
      historicalValue + "</td><td>" + upcomingValue + "</td></tr>";
  }

  function openAnalogueDetails(storm, score, trigger) {
    // Matches the panel's display precision so near-tie storms can't
    // read as the same percentage here either.
    const displayScore = score.toFixed(scoreDecimals);
    const windDelta = storm.wind - UPCOMING.wind;
    const scoreReason =
      "Its wind speed is close to " + UPCOMING.name + "'s, producing a " + displayScore + "% match.";

    analogueModalKicker.innerHTML =
      '<span class="analogue-kicker-icon">&#9670;</span>Best match \u00b7 wind strength';
    analogueModalTitle.textContent = storm.name;
    analogueModalSummary.textContent = storm.date + " · " + storm.category;
    analogueModalStats.innerHTML =
      statMarkup("Maximum winds", storm.wind + " km/h", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h7c3 0 3-4 0-4M3 12h13c3 0 3-4 0-4M3 16h9c3 0 3-4 0-4M3 20h5"/></svg>') +
      statMarkup("PAGASA Category", storm.category, '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/></svg>');
    analogueComparisonStorm.textContent = storm.name;
    analogueComparisonBody.innerHTML =
      comparisonRow("Maximum winds", storm.wind + " km/h", UPCOMING.wind + " km/h") +
      comparisonRow("PAGASA Category", storm.category, UPCOMING.category);
    analogueModalExplanation.innerHTML =
      "<h3>Why this is a match</h3><p>" + scoreReason +
      "</p><div class=\"analogue-match-breakdown\"><div class=\"analogue-score-ring\" style=\"--score: " +
      displayScore + "%\"><strong>" + displayScore + "%</strong><span>WIND<br>MATCH</span></div><div class=\"analogue-match-checks\"><span><b>✓</b>Wind closeness: " + displayScore +
      "% (" + (windDelta >= 0 ? "+" : "") + windDelta + " km/h)</span></div></div>";

    lastModalTrigger = trigger;
    analogueModal.hidden = false;
    document.body.classList.add("modal-open");
    analogueModal.querySelector(".analogue-modal-close").focus();
  }

  function closeAnalogueDetails() {
    if (analogueModal.hidden) return;
    analogueModal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastModalTrigger) lastModalTrigger.focus();
  }

  // ---------------------------------------------------------------------
  // Comparison (wind + category only)
  // ---------------------------------------------------------------------
  function metricIcon(label) {
    if (label.indexOf("Wind") !== -1) return "≋";
    if (label.indexOf("Category") !== -1) return "◈";
    return "◈";
  }

  function metricCellHtml(value, colorClass, barValue, winner) {
    const bar = typeof barValue === "number"
      ? '<span class="metric-bar"><i style="width:' + Math.min(100, barValue) + '%"></i></span>'
      : "";
    const badge = winner
      ? '<span class="metric-winner"><svg viewBox="0 0 24 24" width="10" height="10" fill="none">' +
        '<path d="M3 8l4 3 5-7 5 7 4-3-2 10H5L3 8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
        "</svg>Stronger</span>"
      : "";
    return '<div class="metric-value ' + colorClass + '"><div class="metric-value-main"><strong>' +
      value + "</strong>" + bar + "</div>" + badge + "</div>";
  }

  function row(label, valueA, valueB, winner, classA, classB, barA, barB) {
    // winner: 0 = none, 1 = A, 2 = B. classA/classB carry each column's
    // result tone: "metric-green" for the overall winner, "metric-red" for
    // the loser, or the default identity classes on a tie.
    return (
      '<tr><td>' + metricCellHtml(valueA, classA, barA, winner === 1) +
      '</td><th scope="row" class="metric-col"><span class="metric-icon">' +
      metricIcon(label) + '</span><span>' + label + '</span></th><td>' +
      metricCellHtml(valueB, classB, barB, winner === 2) +
      "</td></tr>"
    );
  }

  // Trophy icon (the banner's default) and an "=" icon for ties — the
  // banner swaps between them so a tie doesn't show a single winner's
  // trophy. Mirror of the inline SVG in compare-storms.html.
  const TROPHY_ICON =
    '<svg viewBox="0 0 24 24" width="30" height="30" fill="none">' +
    '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />' +
    '<path d="M7 5H4a3 3 0 003 5M17 5h3a3 3 0 01-3 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />' +
    "</svg>";
  const TIE_ICON =
    '<svg viewBox="0 0 24 24" width="30" height="30" fill="none">' +
    '<path d="M5 9h14M5 15h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />' +
    "</svg>";

  // names is plain text (one storm, or "A & B" for a tie); tone is
  // "win" (decisive result), "tie" (equal strength) or "idle" (nothing
  // compared yet). The banner itself only glows once a tone is set: idle
  // keeps the dim, unlit indicator light; wins glow soft green and ties
  // glow soft blue (see .is-win / .is-tie in compare-storms.css).
  function updateWinnerBanner(label, names, detail, tone) {
    winnerBannerLabel.textContent = label;
    winnerBannerName.textContent = names;
    winnerBannerDetail.textContent = detail;
    winnerBanner.classList.toggle("winner-banner-tie", tone === "tie");
    winnerBanner.classList.toggle("is-win", tone === "win");
    winnerBanner.classList.toggle("is-tie", tone === "tie");
    if (winnerBannerIcon) {
      winnerBannerIcon.innerHTML = tone === "tie" ? TIE_ICON : TROPHY_ICON;
    }
  }

  // Results-header subtitle: describes what is being compared based on
  // the active comparison mode, not any particular result.
  function updateResultsSubtitle() {
    if (!resultsSubtitle) return;
    const mode = COMPARISON_MODES[activeMode];
    resultsSubtitle.textContent = mode ? mode.subtitle : "Select a storm above to start a comparison.";
  }

  function runCompare() {
    const nameA = selection.stormA;
    const nameB = selection.stormB;
    if (!nameA) return;

    const a = STORMS.find((s) => s.name === nameA);
    const b = nameB ? STORMS.find((s) => s.name === nameB) : null;
    if (!a) return;

    // With no active upcoming storm, comparing against "Upcoming" (the B
    // column when none is chosen) has no meaning — ask for a second storm.
    if (!hasUpcomingStorm && !b) {
      updateWinnerBanner("Comparison", "", "", "idle");
      colAHead.innerHTML =
        '<span class="th-flex"><span class="col-badge col-badge-a">A</span>' + a.name +
        ' <span class="col-year">· ' + a.year + "</span></span>";
      colBHead.textContent = "—";
      tableBody.innerHTML =
        '<tr class="empty-row"><td colspan="3">' +
        '<div class="empty-state">' +
        "<p>No active upcoming storm is being monitored right now, so there is nothing to compare against. Select a second historical storm above.</p>" +
        "</div></td></tr>";
      return;
    }

    // Column headers (badge color included) render inside renderStrength(),
    // where the overall winner — and therefore each column's green/red
    // result tone — is known.
    renderStrength(a, b);

    tableBody.querySelectorAll("tr").forEach((resultRow, index) => {
      resultRow.style.setProperty("--row-delay", index * 55 + "ms");
    });
  }

  function renderStrength(a, b) {
    let html = "";

    // Overall result: higher max sustained wind wins; on equal winds the
    // higher PAGASA category breaks the tie; identical winds AND category
    // is an explicit tie. (Previously an A-vs-B tie fell through to a
    // comparison against the upcoming storm, so a tied pair could show an
    // unrelated storm as the "winner".)
    const compareB = b || UPCOMING;
    const rankOf = (storm) => categoryRank(storm.category);
    const windDiff = a.wind - compareB.wind;
    const catDiff = (rankOf(a) ?? 0) - (rankOf(compareB) ?? 0);
    const isTie = windDiff === 0 && catDiff === 0;
    const winner = isTie
      ? null
      : windDiff > 0 || (windDiff === 0 && catDiff > 0)
        ? a
        : compareB;

    // Column colors follow the overall result: the winner's column reads
    // green and the loser's red (header badges, values and bars alike).
    // An exact tie has no winner or loser, so both columns keep their
    // default blue/green identities.
    const badgeA = isTie
      ? "col-badge-a"
      : winner === a ? "col-badge-green" : "col-badge-red";
    const badgeB = isTie
      ? "col-badge-b"
      : winner === compareB ? "col-badge-green" : "col-badge-red";
    const classA = isTie
      ? "metric-blue"
      : winner === a ? "metric-green" : "metric-red";
    const classB = isTie
      ? "metric-green"
      : winner === compareB ? "metric-green" : "metric-red";

    colAHead.innerHTML =
      '<span class="th-flex"><span class="col-badge ' + badgeA + '">A</span>' +
      a.name + ' <span class="col-year">· ' + a.year + "</span></span>";
    colBHead.innerHTML =
      '<span class="th-flex"><span class="col-badge ' + badgeB + '">B</span>' +
      compareB.name + ' <span class="col-year">· ' +
      (b ? compareB.year : "Upcoming") + "</span></span>";

    if (isTie) {
      updateWinnerBanner(
        "It's a Tie",
        a.name + " & " + compareB.name,
        "Both storms top out at " + a.wind +
          " km/h at the same PAGASA category — neither is stronger. Based on PAGASA best track data.",
        "tie"
      );
    } else if (!b) {
      updateWinnerBanner(
        "Overall Winner",
        winner.name + " · " + winner.year,
        (winner === UPCOMING
          ? "is stronger than the selected historical storm."
          : "is stronger than the incoming storm.") +
          " Based on PAGASA best track data.",
        "win"
      );
    } else if (windDiff !== 0) {
      updateWinnerBanner(
        "Overall Winner",
        winner.name + " · " + winner.year,
        "is stronger based on wind speed. Based on PAGASA best track data.",
        "win"
      );
    } else {
      updateWinnerBanner(
        "Overall Winner",
        winner.name + " · " + winner.year,
        "reached a higher PAGASA category at the same wind speed. Based on PAGASA best track data.",
        "win"
      );
    }

    // Per-row "Stronger" badges: the wind row is decided by wind speed, the
    // category row by PAGASA category; 0 = row is level, so no badge.
    const windWinner = windDiff > 0 ? 1 : windDiff < 0 ? 2 : 0;
    const catWinner = catDiff > 0 ? 1 : catDiff < 0 ? 2 : 0;

    html += row("Maximum Sustained Winds", a.wind + " km/h", compareB.wind + " km/h",
      windWinner, classA, classB, (a.wind / 250) * 100, (compareB.wind / 250) * 100);

    html += row("PAGASA Category", a.category, compareB.category, catWinner,
      classA, classB);

    tableBody.innerHTML = html;
  }

  function runCompareSafe() {
    if (!selection.stormA) {
      // Idle/empty state: no result yet, so the banner indicator stays
      // dim (no glow classes set) and the guidance empty state shows.
      updateWinnerBanner("Comparison", "", "", "idle");
      tableBody.innerHTML =
        '<tr class="empty-row"><td colspan="3">' +
        '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none">' +
        '<path d="M4 20V10M10 20V4M16 20v-7M22 20V8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />' +
        "</svg>" +
        "<p>Select a historical storm from the dropdown above, then click " +
        "<strong>Compare Storms</strong> to see results here.</p>" +
        "</div></td></tr>";
      colAHead.textContent = "—";
      colBHead.textContent = "—";
      return;
    }
    runCompare();
  }

  function resetControls() {
    selection.stormA = "";
    selection.stormB = "";
    if (stormASelect) stormASelect.value = "";
    if (stormBSelect) stormBSelect.value = "";
    syncPickerToggles();
    runCompareSafe();
  }

  // ---------------------------------------------------------------------
  // Searchable storm pickers
  // ---------------------------------------------------------------------
  // Each picker is a button + a panel with a search input and a scrollable
  // option list. Clicking the toggle opens the panel and focuses its
  // search box; typing filters the list; clicking an option picks the
  // storm, closes the panel and fires the same change flow the old native
  // <select> used. A hidden <select> (kept in sync) remains the single
  // source of truth for the compare logic below.
  const PLACEHOLDER = { stormA: "Select a storm\u2026", stormB: "None (compare with upcoming)" };

  function pickerContainer(which) {
    return document.querySelector('[data-picker="' + which + '"]');
  }

  // Case-insensitive "does the storm match the query" — searches both the
  // local name and the international name in parentheses.
  function stormMatchesQuery(storm, query) {
    return storm.name.toLowerCase().indexOf(query) !== -1;
  }

  function renderPickerOptions(picker) {
    const query = picker.search.value.trim().toLowerCase();
    picker.list.innerHTML = "";

    const ordered = STORMS.slice().sort((a, b) => {
      const aD = a.dateStart || "";
      const bD = b.dateStart || "";
      if (!aD && bD) return 1;
      if (aD && !bD) return -1;
      if (aD !== bD) return aD > bD ? -1 : 1;
      return b.year - a.year ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    // Storm B's leading placeholder (compare against the upcoming storm
    // instead of a second historical storm) is part of every list render;
    // a query hides it so search results stay storm-only.
    if (picker.which === "stormB" && !query) {
      const noneOpt = document.createElement("button");
      noneOpt.type = "button";
      noneOpt.className = "picker-option";
      noneOpt.setAttribute("role", "option");
      noneOpt.setAttribute("data-value", "");
      noneOpt.textContent = PLACEHOLDER.stormB;
      picker.list.appendChild(noneOpt);
    }

    let shown = 0;
    ordered.forEach((storm) => {
      if (query && !stormMatchesQuery(storm, query)) return;
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "picker-option";
      opt.setAttribute("role", "option");
      opt.setAttribute("data-value", storm.name);
      opt.setAttribute("aria-selected", String(selection[picker.which] === storm.name));
      opt.textContent = storm.name + " \u00b7 " + storm.year;
      if (selection[picker.which] === storm.name) opt.classList.add("is-selected");
      picker.list.appendChild(opt);
      shown++;
    });

    if (!shown) {
      const empty = document.createElement("div");
      empty.className = "picker-empty";
      empty.textContent = "No storms match \u201c" + picker.search.value.trim() + "\u201d.";
      picker.list.appendChild(empty);
    }
  }

  function syncPickerToggles() {
    Object.keys(pickers).forEach((which) => {
      const picker = pickers[which];
      const hiddenSelect = picker.root.querySelector("select");
      const chosen = hiddenSelect ? hiddenSelect.value : "";
      picker.toggle.querySelector(".picker-toggle-label").textContent =
        chosen || PLACEHOLDER[which];
      picker.toggle.classList.toggle("has-value", !!chosen);
    });
  }

  function closePicker(picker, refocusToggle) {
    if (!picker || picker.panel.hidden) return;
    picker.panel.hidden = true;
    picker.toggle.setAttribute("aria-expanded", "false");
    picker.root.classList.remove("is-open");
    picker.search.value = "";
    if (refocusToggle) picker.toggle.focus();
  }

  function closeAllPickers(except) {
    Object.keys(pickers).forEach((which) => {
      if (pickers[which] !== except) closePicker(pickers[which], false);
    });
  }

  function openPicker(picker) {
    closeAllPickers(picker);
    renderPickerOptions(picker);
    picker.panel.hidden = false;
    picker.toggle.setAttribute("aria-expanded", "true");
    picker.root.classList.add("is-open");
    picker.search.value = "";
    picker.search.focus();
  }

  function commitPick(which, value) {
    const picker = pickers[which];
    const hiddenSelect = picker.root.querySelector("select");
    selection[which] = value;
    if (hiddenSelect) hiddenSelect.value = value;
    syncPickerToggles();
    closeAllPickers(null);
  }

  function setupPicker(which) {
    const root = pickerContainer(which);
    if (!root) return;
    const toggle = root.querySelector(".picker-toggle");
    const panel = root.querySelector(".picker-panel");
    const search = root.querySelector(".picker-search");
    const list = root.querySelector(".picker-list");
    if (!toggle || !panel || !search || !list) return;

    const picker = { which, root, toggle, panel, search, list };
    pickers[which] = picker;

    toggle.addEventListener("click", () => {
      if (panel.hidden) openPicker(picker);
      else closePicker(picker, true);
    });

    // Type-to-filter; the list re-renders on every keystroke.
    search.addEventListener("input", () => renderPickerOptions(picker));

    // Click an option to choose it (delegated — the list re-renders often).
    list.addEventListener("click", (event) => {
      const opt = event.target.closest(".picker-option");
      if (!opt) return;
      commitPick(which, opt.getAttribute("data-value") || "");
    });

    search.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePicker(picker, true);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const first = list.querySelector(".picker-option");
        if (first) commitPick(which, first.getAttribute("data-value") || "");
      }
    });
  }

  // ---------------------------------------------------------------------
  // Storm dropdowns
  // ---------------------------------------------------------------------
  // Fills both <select> dropdowns with every storm, newest first (undated
  // storms last, A→Z name tie-break). Storm B keeps its leading "None"
  // placeholder option — leaving it empty compares against the upcoming
  // storm instead of a second historical one.
  function populateStormSelects() {
    if (!stormASelect || !stormBSelect) return;
    // The pickers render from STORMS directly; the hidden <select> options
    // stay in sync for the verify harness and as a fallback.

    const ordered = STORMS.slice().sort((a, b) => {
      const aD = a.dateStart || "";
      const bD = b.dateStart || "";
      if (!aD && bD) return 1;
      if (aD && !bD) return -1;
      if (aD !== bD) return aD > bD ? -1 : 1;
      return b.year - a.year ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

    [stormASelect, stormBSelect].forEach((select) => {
      // Drop any storm options from a previous fill (keeps the placeholder).
      Array.from(select.options)
        .filter((option) => option.value !== "")
        .forEach((option) => option.remove());

      ordered.forEach((storm) => {
        const option = document.createElement("option");
        option.value = storm.name;
        option.textContent = storm.name + " · " + storm.year;
        select.appendChild(option);
      });
    });
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  async function init() {
    await loadData();
    await loadUpcoming();
    populateStormSelects();
    setupPicker("stormA");
    setupPicker("stormB");
    syncPickerToggles();
    updateResultsSubtitle();
    renderAnalogues();

    compareBtn.addEventListener("click", runCompareSafe);
    resetBtn.addEventListener("click", resetControls);

    if (stormASelect) {
      stormASelect.addEventListener("change", () => {
        selection.stormA = stormASelect.value;
      });
    }
    if (stormBSelect) {
      stormBSelect.addEventListener("change", () => {
        selection.stormB = stormBSelect.value;
      });
    }

    // Keep the Best Match panel in sync with admin edits made in another
    // tab: re-fetch the upcoming profile when this tab regains focus, is
    // restored from the back/forward cache, or becomes visible again.
    // renderAnalogues() only re-runs when a scoring value actually changed.
    window.addEventListener("focus", refreshUpcoming);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) refreshUpcoming();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshUpcoming();
    });

    analogueModal.querySelectorAll("[data-modal-close]").forEach((el) =>
      el.addEventListener("click", closeAnalogueDetails)
    );
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAnalogueDetails();
    });

    // Click-away closes any open picker; Escape closes it and refocuses
    // the toggle so keyboard users don't get stranded.
    document.addEventListener("click", (event) => {
      Object.keys(pickers).forEach((which) => {
        const picker = pickers[which];
        if (!picker.panel.hidden && !picker.root.contains(event.target)) {
          closePicker(picker, false);
        }
      });
    });

    resetControls();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
