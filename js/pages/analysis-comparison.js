// Tropical Cyclone Information System — Analysis Comparison page
// Renders the upcoming storm profile's historical analogues, wires the
// comparison controls, and renders the results table.
//
// UPDATED: data now comes live from MySQL via get_cyclones.php.
// Rainfall, pressure, direction, and location have been removed since
// they are not currently tracked in the database — comparisons now run
// on wind speed and PAGASA category only. These can be re-added later
// once that data is collected.
// VISITOR PROFILE: there is no admin-managed upcoming storm in this flow.
// The visitor enters the upcoming storm (name + max wind + category) in the
// Step 1 form; only pressing Apply fills the UPCOMING profile, Best Match
// panel, default compare column, and shared same-tab session state.
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

  // Current upcoming storm profile, filled by the Step 1 form and mirrored
  // to the shared same-tab session state.
  let UPCOMING = null;

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

  // Whether the visitor has applied an upcoming storm in Step 1. Defaults to
  // false so the page opens in the "no upcoming storm yet" empty state.
  let hasUpcomingStorm = false;

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
  // Step 1 sandbox form refs (wired in setupCustomStorm()).
  const customStormForm = document.getElementById("customStormForm");
  const customStormName = document.getElementById("customStormName");
  const customStormWind = document.getElementById("customStormWind");
  const customStormCategory = document.getElementById("customStormCategory");
  const customStormSuggest = document.getElementById("customStormSuggest");
  const customStormCategoryInfo = document.getElementById("customStormCategoryInfo");
  const customStormError = document.getElementById("customStormError");
  const customStormClear = document.getElementById("customStormClear");
  const upcomingStormSection = document.getElementById("upcomingStormSection");
  const upcomingEmpty = document.getElementById("upcomingEmpty");

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

  // ---------------------------------------------------------------------
  // Step 1 form — the visitor's upcoming storm (session-only)
  // ---------------------------------------------------------------------
  const CUSTOM_WIND_MIN = 30;
  const CUSTOM_WIND_MAX = 500;

  // Plain category names keyed by the shared classifier's TD…STY keys
  // (js/storm-category.js exposes getCategoryFromStrength).
  const CUSTOM_CATEGORY_NAMES = {
    TD: "Tropical Depression",
    TS: "Tropical Storm",
    STS: "Severe Tropical Storm",
    TY: "Typhoon",
    STY: "Super Typhoon",
  };

  // One-line explainer per category: wind range + what it means.
  const CATEGORY_INFO = {
    "Tropical Depression": "61–88 km/h · the weakest class — heavy rain, Signals No. 1–2.",
    "Tropical Storm": "89–117 km/h · damaging winds, possible Signals No. 2–3.",
    "Severe Tropical Storm": "118–148 km/h · destructive winds, widespread damage, higher signals.",
    Typhoon: "149–184 km/h · very destructive — major damage, evacuations likely.",
    "Super Typhoon": "185 km/h and above · catastrophic — the highest PAGASA class.",
  };

  function suggestedCategoryName(wind) {
    if (typeof window.getCategoryFromStrength !== "function") return "";
    const key = window.getCategoryFromStrength(wind);
    return (key && CUSTOM_CATEGORY_NAMES[key]) || "";
  }

  // Auto-prefix: "odin" + Typhoon -> "Typhoon Odin". Strips any existing
  // prefix first (short codes TD/TS/STS/TY/STY or full words,
  // case-insensitive) so re-saving never yields "TY TY ODIN".
  const STORM_PREFIX_RE =
    /^(?:super\s+typhoon|severe\s+tropical\s+storm|tropical\s+depression|tropical\s+storm|typhoon|sty|sts|td|ts|ty)[\s\-.]+/i;

  function stripStormPrefix(raw) {
    let base = String(raw || "").trim().replace(/\s+/g, " ");
    let prev = null;
    while (prev !== base) {
      prev = base;
      base = base.replace(STORM_PREFIX_RE, "").trim();
    }
    // A lone prefix with no actual name (e.g. just "TY" or "Typhoon")
    // counts as empty so validation rejects it instead of saving "Typhoon Ty".
    const lone = base.toLowerCase();
    if (
      lone === "td" ||
      lone === "ts" ||
      lone === "sts" ||
      lone === "ty" ||
      lone === "sty" ||
      lone === "tropical depression" ||
      lone === "tropical storm" ||
      lone === "severe tropical storm" ||
      lone === "typhoon" ||
      lone === "super typhoon"
    ) {
      return "";
    }
    return base;
  }

  function toTitleCaseBase(base) {
    return String(base || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  // Full-word prefix (e.g. "Typhoon Odin"). Final category wins; returns
  // "" when no usable base name remains (caller treats it as invalid).
  function formatStormName(rawName, category) {
    const base = toTitleCaseBase(stripStormPrefix(rawName));
    if (!base) return "";
    const prefix = String(category || "").trim();
    if (!prefix) return base;
    return prefix + " " + base;
  }

  function showCustomError(message, focusEl) {
    if (customStormError) {
      customStormError.textContent = message;
      customStormError.hidden = false;
    }
    if (focusEl && typeof focusEl.focus === "function") focusEl.focus();
    return false;
  }

  function hideCustomError() {
    if (customStormError) {
      customStormError.textContent = "";
      customStormError.hidden = true;
    }
  }

  // Live hint under the wind field: "Suggested category: Typhoon".
  // Also pre-selects the suggestion so Apply works untouched.
  function refreshCategorySuggestion() {
    if (!customStormWind || !customStormCategory || !customStormSuggest) return;
    const raw = customStormWind.value.trim();
    const wind = Number(raw);
    if (raw === "" || isNaN(wind)) {
      customStormSuggest.hidden = true;
      return;
    }
    const name = suggestedCategoryName(wind);
    if (!name) {
      customStormSuggest.hidden = true;
      return;
    }
    customStormCategory.value = name;
    customStormSuggest.textContent =
      "Suggested category: " + name + " (based on " + wind + " km/h). You can still change it.";
    customStormSuggest.hidden = false;
    renderCategoryInfo();
  }

  // Paints the applied upcoming storm into the Step 1 profile shell. Only the
  // name/wind/category blocks are meaningful for a custom storm, so the
  // admin-fed blocks (movement, signal, pressure, landfall, location,
  // advisory, PAGASA link) hide via .sandbox-mode (see CSS).
  function renderCustomProfile() {
    if (!upcomingStormSection || !upcomingEmpty) return;
    if (!hasUpcomingStorm || !UPCOMING) {
      upcomingStormSection.classList.add("upcoming-hidden");
      upcomingStormSection.classList.remove("sandbox-mode");
      upcomingEmpty.classList.remove("upcoming-hidden");
      return;
    }
    upcomingEmpty.classList.add("upcoming-hidden");
    upcomingStormSection.classList.remove("upcoming-hidden");
    upcomingStormSection.classList.add("sandbox-mode");
    const set = (key, text) => {
      const node = upcomingStormSection.querySelector('[data-us="' + key + '"]');
      if (node) node.textContent = text;
    };
    set("storm_name", UPCOMING.name);
    set("status", "Upcoming storm");
    set("wind", UPCOMING.wind + " km/h");
    set("category", UPCOMING.category);
  }

  function applyCustomStorm() {
    hideCustomError();
    const data = readCustomStorm();
    const problem = validateCustomStorm(data);
    if (problem) return showCustomError(problem.message, problem.focusEl);
    commitCustomStorm(data);
    return true;
  }

  // Reads the raw form state; category falls back to the wind suggestion.
  function readCustomStorm() {
    const name = customStormName ? customStormName.value.trim() : "";
    const windRaw = customStormWind ? customStormWind.value.trim() : "";
    const wind = Number(windRaw);
    let category = customStormCategory ? customStormCategory.value : "";
    if (!category && windRaw !== "" && !isNaN(wind)) {
      category = suggestedCategoryName(wind);
    }
    return { name, windRaw, wind, category };
  }

  // Returns { message, focusEl } for the first problem, or null when valid.
  function validateCustomStorm(data) {
    if (!stripStormPrefix(data.name)) {
      return { message: "Give the upcoming storm a name (e.g. Typhoon Odin).", focusEl: customStormName };
    }
    if (data.windRaw === "" || isNaN(data.wind)) {
      return { message: "Enter the max sustained winds in km/h.", focusEl: customStormWind };
    }
    if (data.wind < CUSTOM_WIND_MIN || data.wind > CUSTOM_WIND_MAX) {
      return {
        message: "Wind must be between " + CUSTOM_WIND_MIN + " and " + CUSTOM_WIND_MAX + " km/h.",
        focusEl: customStormWind,
      };
    }
    if (!data.category) {
      return { message: "Pick a PAGASA category.", focusEl: customStormCategory };
    }
    return null;
  }

  function commitCustomStorm(data) {
    UPCOMING = {
      name: formatStormName(data.name, data.category),
      year: null,
      wind: Math.round(data.wind),
      peak: null,
      category: data.category,
    };
    hasUpcomingStorm = true;
    if (window.UpcomingStormState) window.UpcomingStormState.write(UPCOMING);
    if (window.UpcomingStormState) window.UpcomingStormState.renderCards();
    renderCustomProfile();
    renderAnalogues();
    // Re-run any visible comparison so column B picks up the new storm.
    runCompareSafe();
  }

  function restoreCustomStorm() {
    if (!window.UpcomingStormState) return;
    const saved = window.UpcomingStormState.read();
    if (!saved) return;
    if (customStormName) customStormName.value = saved.name;
    if (customStormWind) customStormWind.value = String(saved.wind);
    if (customStormCategory) customStormCategory.value = saved.category;
    commitCustomStorm(saved);
  }

  // Explainer line under the category select.
  function renderCategoryInfo() {
    if (!customStormCategory || !customStormCategoryInfo) return;
    const name = customStormCategory.value;
    const info = name && CATEGORY_INFO[name];
    if (!info) {
      customStormCategoryInfo.hidden = true;
      return;
    }
    // Both halves come from our own static map — safe to inject.
    customStormCategoryInfo.innerHTML = "<strong>" + name + ":</strong> " + info;
    customStormCategoryInfo.hidden = false;
  }

  // Clears the sandbox back to the initial empty state (also used by the
  // page-level Reset so one click restores a pristine page).
  function resetCustomStormState() {
    if (customStormForm) customStormForm.reset();
    if (customStormSuggest) customStormSuggest.hidden = true;
    if (customStormCategoryInfo) customStormCategoryInfo.hidden = true;
    hideCustomError();
    UPCOMING = null;
    hasUpcomingStorm = false;
    if (window.UpcomingStormState) {
      window.UpcomingStormState.clear();
      window.UpcomingStormState.renderCards();
    }
    renderCustomProfile();
  }

  function setupCustomStorm() {
    if (customStormName) {
      customStormName.addEventListener("input", () => {
        hideCustomError();
      });
    }
    if (customStormWind) {
      customStormWind.addEventListener("input", () => {
        hideCustomError();
        refreshCategorySuggestion();
        renderCategoryInfo();
      });
    }
    if (customStormCategory) {
      customStormCategory.addEventListener("change", () => {
        hideCustomError();
        renderCategoryInfo();
      });
    }
    if (customStormForm) {
      customStormForm.addEventListener("submit", (event) => {
        event.preventDefault();
        applyCustomStorm();
      });
    }
    if (customStormClear) {
      customStormClear.addEventListener("click", () => {
        resetCustomStormState();
        renderAnalogues();
        runCompareSafe();
      });
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

  // Wind-closeness match score (0–100): the closer of the two winds as a
  // straight percentage of the farther one, e.g. 195 km/h against a
  // 200 km/h upcoming storm reads 97.5%. Symmetric, so stronger historical
  // storms can score too — and the score can never exceed 100%, no
  // clamping needed. Because both the rank order (wind gap, closest
  // first) and this score are monotonic in the gap, rank and score can
  // never disagree. Far-stronger upcoming storms degrade gracefully
  // (215/400 = 53.8%) instead of collapsing every candidate toward 0%.
  // "Best Match · Wind Strength" ranks purely by wind closeness — peak
  // gust and PAGASA category are informational only (shown in the modal)
  // and do not factor into the score.
  function similarity(storm) {
    if (storm.wind == null || UPCOMING.wind == null || UPCOMING.wind <= 0) return 0;
    const lo = Math.min(storm.wind, UPCOMING.wind);
    const hi = Math.max(storm.wind, UPCOMING.wind);
    return hi > 0 ? (lo / hi) * 100 : 0;
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

  // Picks the display precision: one decimal normally, but escalates to
  // two when two different scores would render with the same string.
  // Distinctness is judged on unique values only — tied storms share one
  // wind, so they must share one percentage string too. The cap stays at
  // two because a genuine full-precision tie can never be split by
  // decimals — there, the ranking is decided by the recency/peak
  // tie-breakers instead.
  function displayDecimals(scores) {
    const unique = Array.from(new Set(scores));
    let decimals = 1;
    let strings = unique.map((s) => s.toFixed(decimals));
    while (new Set(strings).size !== strings.length && decimals < 2) {
      decimals++;
      strings = unique.map((s) => s.toFixed(decimals));
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

  // Display order for storms that share one wind value: most recent
  // record first, then higher peak gust, longer duration, alphabetical.
  // Ties are expanded into their own rows (see renderAnalogues) instead
  // of keeping a single representative per wind group.
  function compareTiedStorms(a, b) {
    const recencyDiff = recentness(b) - recentness(a);
    if (recencyDiff !== 0) return recencyDiff;
    const peakDiff = (b.peak ?? 0) - (a.peak ?? 0);
    if (peakDiff !== 0) return peakDiff;
    const daysDiff = (b.days ?? 0) - (a.days ?? 0);
    if (daysDiff !== 0) return daysDiff;
    return String(a.name).localeCompare(String(b.name));
  }

  function renderAnalogues() {
    analogueList.innerHTML = "";

    if (!hasUpcomingStorm) {
      analogueList.innerHTML =
        '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none">' +
        '<path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
        "</svg>" +
        "<p>No upcoming storm yet — enter a storm name and wind speed in Step 1, then Apply, to see its closest historical matches.</p>" +
        "</div>";
      return;
    }

    const groupEl = document.createElement("section");
    groupEl.className = "match-group";

    const heading = document.createElement("div");
    heading.className = "match-group-head";
    heading.innerHTML =
      '<div>' +
      '<div class="match-group-titlerow">' +
      '<span class="match-group-trophy" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none">' +
      '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M7 5H4a3 3 0 003 5M17 5h3a3 3 0 01-3 5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg></span>" +
      '<h3 class="match-group-title">Best historical matches</h3>' +
      "</div>" +
      "</div>" +
      '<span class="match-group-badge">' +
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">' +
      '<ellipse cx="12" cy="5.5" rx="8" ry="3" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M4 5.5V12c0 1.7 3.6 3 8 3s8-1.3 8-3V5.5M4 12v6.5c0 1.7 3.6 3 8 3s8-1.3 8-3V12" stroke="currentColor" stroke-width="1.8"/>' +
      "</svg>Based on PAGASA data</span>";
    groupEl.appendChild(heading);

    // Best Match selection: storms are grouped by their exact Max Wind
    // value, the groups are ranked by gap to the upcoming storm's Max Wind
    // (nearest wins — stronger or weaker alike), and the Top 3 distinct
    // wind values are shown with ties expanded: every storm sharing a top
    // Each rank keeps every storm sharing its wind (dense ranking:
    // 1, 1, 1, 2, 3), most recent first. Rank order = group closeness;
    // the similarity score is display-only and must never re-order ranks.
    const MAX_SUB_ROWS = 5;
    const topGroups = rankGroupsByCloseness(groupByWind(STORMS), UPCOMING.wind)
      .slice(0, 3)
      .map((group, groupIndex) => ({
        rank: groupIndex + 1,
        matches: group.storms
          .slice()
          .sort(compareTiedStorms)
          .map((storm) => ({ storm, score: similarity(storm), rank: groupIndex + 1 })),
      }));
    const allMatches = topGroups.flatMap((group) => group.matches);

    // One decimal normally; escalate if two different scores would display
    // the same string. Tied storms share one wind and one string by design.
    scoreDecimals = displayDecimals(allMatches.map((match) => match.score));

    // Builds one storm row: rank badge, name + wind bar, score, View
    // button. Used for plain rows and tied-group sub-rows alike.
    const buildStormRow = (match, extraClass) => {
      const rowEl = document.createElement("div");
      rowEl.className = "analogue-row" +
        (match.rank === 1 ? " best-match" : " rank-" + match.rank) +
        (extraClass ? " " + extraClass : "");

      const rank = document.createElement("span");
      rank.className = "rank-number rank-" + match.rank;
      rank.textContent = match.rank;

      const info = document.createElement("div");
      info.className = "analogue-info";
      info.innerHTML =
        '<div class="analogue-name">' + match.storm.name + "</div>";

      const sim = document.createElement("div");
      sim.className = "analogue-similarity";
      sim.innerHTML = "<strong>0%</strong>";
      const scoreEl = sim.querySelector("strong");

      const bar = document.createElement("div");
      bar.className = "match-progress";
      bar.innerHTML = "<span style=\"width:" + match.score + '%"></span>';

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
      rowEl.appendChild(bar);
      rowEl.appendChild(btn);
      animateMatchScore(scoreEl, match.score);
      return rowEl;
    };

    // A rank shared by 2+ storms collapses into one bar: the most-recent
    // storm plus a "+N tied" pill, expanding to its storms (capped, the
    // overflow note tucked inside). A lone storm renders as a plain row —
    // so the panel is always exactly the top 3 ranks and nothing can be
    // pushed off it. Re-renders reset every group to collapsed.
    topGroups.forEach((topGroup) => {
      if (topGroup.matches.length === 1) {
        groupEl.appendChild(buildStormRow(topGroup.matches[0]));
        return;
      }

      const rep = topGroup.matches[0];
      const shownSubs = topGroup.matches.slice(0, MAX_SUB_ROWS);
      const hiddenSubCount = topGroup.matches.length - shownSubs.length;
      const subId = "analogue-sub-" + rep.storm.wind;

      const header = document.createElement("button");
      header.type = "button";
      header.className = "analogue-row analogue-group" + (topGroup.rank === 1 ? " best-match" : " rank-" + topGroup.rank);
      header.setAttribute("aria-expanded", "false");
      header.setAttribute("aria-controls", subId);

      const rank = document.createElement("span");
      rank.className = "rank-number rank-" + topGroup.rank;
      rank.textContent = topGroup.rank;

      const info = document.createElement("div");
      info.className = "analogue-info";
      info.innerHTML =
        '<div class="analogue-name">' + rep.storm.name + "</div>";

      const sim = document.createElement("div");
      sim.className = "analogue-similarity";
      sim.innerHTML = "<strong>0%</strong>";

      const bar = document.createElement("div");
      bar.className = "match-progress";
      bar.innerHTML = "<span style=\"width:" + rep.score + '%"></span>';

      const action = document.createElement("div");
      action.className = "analogue-action";
      const pill = document.createElement("span");
      pill.className = "analogue-tied-pill";
      pill.textContent = "\u2191 +" + topGroup.matches.length + " tied as top " + topGroup.rank;

      const chevron = document.createElement("span");
      chevron.className = "analogue-chevron";
      chevron.setAttribute("aria-hidden", "true");
      chevron.textContent = "\u203a";
      action.appendChild(pill);
      action.appendChild(chevron);

      const sub = document.createElement("div");
      sub.className = "analogue-subrows";
      sub.id = subId;
      sub.hidden = true;
      shownSubs.forEach((match) => {
        sub.appendChild(buildStormRow(match, "is-sub"));
      });
      if (hiddenSubCount > 0) {
        const moreEl = document.createElement("div");
        moreEl.className = "analogue-more";
        moreEl.textContent = "+" + hiddenSubCount + " more at " + rep.storm.wind + " km/h";
        sub.appendChild(moreEl);
      }

      header.appendChild(rank);
      header.appendChild(info);
      header.appendChild(sim);
      header.appendChild(bar);
      header.appendChild(action);
      let expanded = false;
      header.addEventListener("click", () => {
        expanded = !expanded;
        header.setAttribute("aria-expanded", String(expanded));
        sub.hidden = !expanded;
      });

      groupEl.appendChild(header);
      groupEl.appendChild(sub);
      animateMatchScore(sim.querySelector("strong"), rep.score);
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
    // The modal's "Compared with …" headings name the upcoming storm; they
    // used to be filled by upcoming-storm.js, now we set them directly.
    analogueModal.querySelectorAll('[data-us="storm_name"]').forEach((node) => {
      node.textContent = UPCOMING.name;
    });
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
  // trophy. Mirror of the inline SVG in analysis-comparison.html.
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
  // glow soft blue (see .is-win / .is-tie in analysis-comparison.css).
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

    // With no upcoming storm applied, comparing against "Upcoming" (the B
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
        "<p>No upcoming storm has been applied yet, so there is nothing to compare against. Apply one in Step 1 or select a second historical storm above.</p>" +
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
      (b ? compareB.year : "Upcoming storm") + "</span></span>";

    // An upcoming storm has no year, so its banner label is name-only.
    const upcomingLabel = UPCOMING.year
      ? UPCOMING.name + " · " + UPCOMING.year
      : UPCOMING.name;

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
        winner === UPCOMING ? upcomingLabel : winner.name + " · " + winner.year,
          (winner === UPCOMING
          ? "is stronger than the selected historical storm."
          : "is stronger than the upcoming storm.") +
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
        "<strong>Analysis Comparison</strong> to see results here.</p>" +
        "</div></td></tr>";
      colAHead.textContent = "—";
      colBHead.textContent = "—";
      return;
    }
    runCompare();
  }

  function resetControls(clearUpcoming) {
    selection.stormA = "";
    selection.stormB = "";
    if (stormASelect) stormASelect.value = "";
    if (stormBSelect) stormBSelect.value = "";
    syncPickerToggles();
    // The page Reset button clears the upcoming storm; initial setup only
    // resets the historical selections so a stored storm can be restored.
    if (clearUpcoming !== false) resetCustomStormState();
    renderAnalogues();
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
  const PLACEHOLDER = { stormA: "Select a storm\u2026", stormB: "None (compare with upcoming storm)" };

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
    populateStormSelects();
    setupPicker("stormA");
    setupPicker("stormB");
    syncPickerToggles();
    setupCustomStorm();
    updateResultsSubtitle();
    renderCustomProfile();
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

    // The shared state script clears the stored profile on a browser reload;
    // ordinary navigation restores it when this page is opened again.
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

    restoreCustomStorm();
    resetControls(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
