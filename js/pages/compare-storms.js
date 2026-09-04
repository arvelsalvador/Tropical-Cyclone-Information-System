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

  // ---------------------------------------------------------------------
  // Element references
  // ---------------------------------------------------------------------
  const analogueList = document.getElementById("analogueList");
  const stormA = document.getElementById("stormA");
  const stormB = document.getElementById("stormB");
  const compareBtn = document.getElementById("compareNowBtn");
  const resetBtn = document.getElementById("resetBtn");
  const verdictEl = document.getElementById("resultsVerdict");
  const tableBody = document.getElementById("resultsTableBody");
  const colAHead = document.getElementById("colAHead");
  const colBHead = document.getElementById("colBHead");
  const winnerBanner = document.getElementById("winnerBanner");
  const winnerBannerLabel = document.getElementById("winnerBannerLabel");
  const winnerBannerName = document.getElementById("winnerBannerName");
  const winnerBannerDetail = document.getElementById("winnerBannerDetail");
  const analogueModal = document.getElementById("analogueModal");
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
  // Data loading + mapping (NEW)
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
  // the more conservative/useful comparison. Magnitude is tiny (max ~0.5%
  // at large gaps) so it never overrides the main Gaussian ranking.
  const directionalNudge = -gap * 0.01;

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

  // Weighted multi-factor match score (0–100):
  //   60% sustained wind   sigma 35 km/h
  //   25% peak gust        sigma 40 km/h, target scaled 1.25 × sustained
  //   15% PAGASA category  exact 100% · adjacent 65% · 2 apart 30% · else 0
  // Factors without data are dropped and the weights renormalise.
  // "Best Match · Wind Strength" ranks purely by wind closeness — peak
// gust and PAGASA category are informational only (shown in the modal)
// and no longer factor into the score.
function similarity(storm) {
  const score = gaussScore(storm.wind, UPCOMING.wind, 35);
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
    // Only match historical storms that were the same strength or weaker
// than the upcoming storm — never stronger.
const eligibleStorms = STORMS.filter((storm) => storm.wind <= UPCOMING.wind);

const groups = rankGroupsByCloseness(
  groupByWind(eligibleStorms),
  UPCOMING.wind,
);
    const matches = groups
  .slice(0, 3)
  .map((group) => {
    const storm = pickRepresentative(group);
    return { storm, score: similarity(storm) };
  })
  .sort((a, b) => b.score - a.score); // Rank 1 = highest actual score

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

  function row(label, valueA, valueB, winner, barA, barB) {
    // winner: 0 = none, 1 = A, 2 = B
    return (
      '<tr><td>' + metricCellHtml(valueA, "metric-blue", barA, winner === 1) +
      '</td><th scope="row" class="metric-col"><span class="metric-icon">' +
      metricIcon(label) + '</span><span>' + label + '</span></th><td>' +
      metricCellHtml(valueB, "metric-green", barB, winner === 2) +
      "</td></tr>"
    );
  }

  function updateWinnerBanner(label, storm, detail, tone) {
    winnerBannerLabel.textContent = label;
    winnerBannerName.textContent = storm ? storm.name + " · " + storm.year : "No clear winner";
    winnerBannerDetail.textContent = detail;
    winnerBanner.classList.toggle("winner-banner-green", tone === "green");
  }

  function runCompare() {
    const nameA = stormA.value;
    const nameB = stormB.value;
    if (!nameA) return;

    const a = STORMS.find((s) => s.name === nameA);
    const b = nameB ? STORMS.find((s) => s.name === nameB) : null;
    if (!a) return;

    // With no active upcoming storm, comparing against "Upcoming" (the B
    // column when none is chosen) has no meaning — ask for a second storm.
    if (!hasUpcomingStorm && !b) {
      colAHead.innerHTML =
        '<span class="th-flex"><span class="col-badge col-badge-a">A</span>' + a.name +
        ' <span class="col-year">· ' + a.year + "</span></span>";
      colBHead.textContent = "—";
      verdictEl.textContent = "No active upcoming storm — pick a second historical storm to compare instead.";
      tableBody.innerHTML =
        '<tr class="empty-row"><td colspan="3">' +
        '<div class="empty-state">' +
        "<p>No active upcoming storm is being monitored right now, so there is nothing to compare against. Select a second historical storm above.</p>" +
        "</div></td></tr>";
      return;
    }

    colAHead.innerHTML =
      '<span class="th-flex"><span class="col-badge col-badge-a">A</span>' + a.name +
      ' <span class="col-year">· ' + a.year + "</span></span>";
    colBHead.innerHTML = b
      ? '<span class="th-flex"><span class="col-badge col-badge-b">B</span>' + b.name +
        ' <span class="col-year">· ' + b.year + "</span></span>"
      : '<span class="th-flex"><span class="col-badge col-badge-b">B</span>' + UPCOMING.name +
        ' <span class="col-year">· Upcoming</span></span>';

    renderStrength(a, b);

    tableBody.querySelectorAll("tr").forEach((resultRow, index) => {
      resultRow.style.setProperty("--row-delay", index * 55 + "ms");
    });
  }

  function renderStrength(a, b) {
    let html = "";
    let verdict;

    const stronger = (x, y) =>
      !y || x.wind > y.wind ? x : y.wind > x.wind ? y : null;

    const winner = stronger(a, b);
    if (b) {
      verdict = winner
        ? "<strong>" + winner.name + "</strong> is stronger overall."
        : "Both storms are of comparable strength.";
    } else {
      verdict =
        "<strong>" + a.name + "</strong> " +
        (a.wind >= UPCOMING.wind
          ? "was stronger than"
          : "was weaker than") +
        " the incoming <strong>" + UPCOMING.name + "</strong>.";
    }

    const strengthWinner = winner || (a.wind >= UPCOMING.wind ? a : UPCOMING);
    updateWinnerBanner(
      "Overall Winner",
      strengthWinner,
      (b ? "is stronger based on wind speed." :
        (strengthWinner === UPCOMING ? "is stronger than the selected historical storm." :
          "is stronger than the incoming storm.")) +
        " Based on PAGASA best track data.",
      strengthWinner === UPCOMING ? "green" : "blue"
    );

    const windWinner = !b ? (a.wind >= UPCOMING.wind ? 1 : 2) : a.wind > b.wind ? 1 : a.wind < b.wind ? 2 : 0;

    const compareB = b || UPCOMING;
    html += row("Maximum Sustained Winds", a.wind + " km/h", compareB.wind + " km/h", windWinner,
      (a.wind / 250) * 100, (compareB.wind / 250) * 100);

    const catRank = (x, y) =>
      CATEGORY_RANK[x] > CATEGORY_RANK[y] ? 1 : CATEGORY_RANK[x] < CATEGORY_RANK[y] ? 2 : 0;
    const catB = b ? b.category : UPCOMING.category;
    html += row("PAGASA Category", a.category, catB, catRank(a.category, catB));

    tableBody.innerHTML = html;
    verdictEl.innerHTML = verdict;
  }

  function runCompareSafe() {
    if (!stormA.value) {
      verdictEl.textContent = "Select at least one historical storm to compare.";
      tableBody.innerHTML =
        '<tr class="empty-row"><td colspan="3">' +
        '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none">' +
        '<path d="M4 20V10M10 20V4M16 20v-7M22 20V8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />' +
        "</svg>" +
        "<p>Select a historical storm above, then click " +
        '<strong>Compare Now</strong> to see results here.</p>' +
        "</div></td></tr>";
      colAHead.textContent = "—";
      colBHead.textContent = "—";
      return;
    }
    runCompare();
  }

  function resetControls() {
    stormA.selectedIndex = 0;
    stormB.selectedIndex = 0;
    runCompareSafe();
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  function buildSelects() {
    [stormA, stormB].forEach((select) => {
      select.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "— Select a storm —";
      select.appendChild(placeholder);

      STORMS.forEach((storm) => {
        const option = document.createElement("option");
        option.value = storm.name;
        option.textContent = storm.name + "  ·  " + storm.year;
        select.appendChild(option);
      });
    });
  }

  async function init() {
    await loadData();
    await loadUpcoming();
    buildSelects();
    renderAnalogues();

    compareBtn.addEventListener("click", runCompareSafe);
    resetBtn.addEventListener("click", resetControls);

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

    resetControls();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();