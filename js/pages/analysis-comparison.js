// Tropical Cyclone Information System — Analysis Comparison page
// Renders the upcoming storm profile's historical analogues, wires the
// comparison controls, and renders the results table.
//
// UPDATED: data now comes live from MySQL via get_cyclones.php.
// Rainfall, pressure, direction, and location have been removed since
// they are not currently tracked in the database — comparisons now run
// on wind speed and PAGASA category only. These can be re-added later
// once that data is collected.
//
// LOCATION MATCH: the Step 1 form also takes optional latitude/longitude.
// When both are filled, a separate "Best match · Location" panel ranks
// historical storms by Haversine distance from that point to each
// storm's full bulletin track (closest approach over all bulletin
// lat/long points). It never merges with the wind-strength match — the
// two bars run and display independently.
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
  // Config (endpoints + shared helpers via js/api-client.js)
  // ---------------------------------------------------------------------
  const API_URL = (window.TCIS_API && window.TCIS_API.CYCLONES_URL) || "/Weather/api/get_cyclones.php";
  const BULLETIN_API_URL = (window.TCIS_API && window.TCIS_API.BULLETINS_URL) || "/Weather/api/get_bulletins.php?cyclone_id=";

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

  const CATEGORY_MAP = (window.TCIS_API && window.TCIS_API.CATEGORY_MAP) || {
    TD: "Tropical Depression",
    TS: "Tropical Storm",
    STS: "Severe Tropical Storm",
    TY: "Typhoon",
    STY: "Super Typhoon",
  };

  // Single cyclone artwork for every intensity: assets/Icons/The icon.png.
  // The old per-category color-code (Green/Yellow/Orange/Red/Purple) was
  // removed — all cyclones now share one icon regardless of PAGASA category.
  const CYCLONE_ICON_SRC = "../assets/Icons/The%20icon.png";

  // Builds the <img> markup for the shared cyclone icon. The category
  // argument is kept (so existing callers need no changes) but ignored —
  // every category returns the same artwork.
  function categoryIconMarkup(category, size) {
    return (
      '<img src="' + CYCLONE_ICON_SRC + '" alt="" width="' + size + '" height="' + size +
      '" loading="lazy" decoding="async">'
    );
  }

  // Whether the visitor has applied an upcoming storm in Step 1. Defaults to
  // false so the page opens in the "no upcoming storm yet" empty state.
  let hasUpcomingStorm = false;

  // Populated by loadData() on startup — replaces the old static STORMS array.
  let STORMS = [];

  // Selected storm per dropdown (stable DB id when available — the identity
  // runCompare resolves via findStorm(); display name is the fallback).
  const selection = { stormA: "", stormB: "" };

  // Comparison modes drive both the results subtitle and the tab labels;
  // single strength mode only (kept as a constant for future extension).
  const COMPARISON_SUBTITLE = "Comparing cyclones by strength";

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
  const compareError = document.getElementById("compareError");
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
  const analogueModalReason = document.getElementById("analogueModalReason");
  const analogueModalExplanationBody = document.getElementById("analogueModalExplanationBody");
  // Bulletin overlay refs — verbatim reuse of the Historical Data bulletin
  // viewer (same markup + css/pages/bulletin-modal.css), opened as an
  // overlay above the analogue modal.
  const analogueBulletinsBtn = document.getElementById("analogueBulletinsBtn");
  const analogueBulletinsHint = document.getElementById("analogueBulletinsHint");
  const bulletinModal = document.getElementById("bulletinModal");
  const bulletinModalTitle = document.getElementById("bulletinModalTitle");
  const bulletinModalSubtitle = document.getElementById("bulletinModalSubtitle");
  const bulletinCloseBtn = document.getElementById("bulletinClose");
  const bulletinList = document.getElementById("bulletinList");
  const bulletinStatus = document.getElementById("bulletinStatus");
  const bulletinListView = document.getElementById("bulletinListView");
  const bulletinPreviewView = document.getElementById("bulletinPreviewView");
  const bulletinPreviewFrame = document.getElementById("bulletinPreviewFrame");
  const bulletinPreviewTitle = document.getElementById("bulletinPreviewTitle");
  const bulletinPreviewCoords = document.getElementById("bulletinPreviewCoords");
  const bulletinOpenNewTab = document.getElementById("bulletinOpenNewTab");
  const bulletinDownload = document.getElementById("bulletinDownload");
  const bulletinBackBtn = document.getElementById("bulletinBackBtn");
  const bulletinCount = document.getElementById("bulletinCount");
  const bulletinSearch = document.getElementById("bulletinSearch");
  const bulletinSearchClear = document.getElementById("bulletinSearchClear");
  const bulletinSearchWrap = document.getElementById("bulletinSearchWrap");
  // Step 1 sandbox form refs (wired in setupCustomStorm()).
  const customStormForm = document.getElementById("customStormForm");
  const customStormName = document.getElementById("customStormName");
  const customStormWind = document.getElementById("customStormWind");
  const customStormLat = document.getElementById("customStormLat");
  const customStormLng = document.getElementById("customStormLng");
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
    if (window.TCIS_API) return window.TCIS_API.formatDateRange(startStr, endStr, true);
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

    const category = window.TCIS_API ? window.TCIS_API.categoryFull(row.highest_category) : (CATEGORY_MAP[row.highest_category] || row.highest_category || "—");

    // highest_strength is stored as "sustained/gust" (e.g. "185/240").
    let wind = window.TCIS_API ? window.TCIS_API.parseSustained(row.highest_strength) : null;
    let peak = null;
    if (row.highest_strength) {
      const parts = String(row.highest_strength).split("/");
      if (wind === null) {
        const sustained = parseInt(parts[0], 10);
        if (!isNaN(sustained)) wind = sustained;
      }
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
      // Stable DB identity — selection/lookup keys on this first, with the
      // display name as fallback for rows missing an id.
      id: row.id != null ? String(row.id) : null,
      name: name,
      year: parseInt(row.year, 10),
      category: category,
      date: formatDateRange(row.date_start, row.date_end),
      // Raw dates retained for the Best Match recency tie-break.
      dateStart: row.date_start || null,
      dateEnd: row.date_end || null,
      wind: wind,
      peak: peak,
      // Combined "sustained / gust" display value (matches admin table);
      // display-only — ranking/similarity stays on sustained (wind).
      strengthText: window.TCIS_API
        ? window.TCIS_API.formatStrength(row.highest_strength)
        : peak != null
        ? wind != null
          ? wind + " / " + peak + " km/h"
          : peak + " km/h"
        : wind != null
        ? wind + " km/h"
        : "\u2014",
      days: days,
    };
  }

  // ---------------------------------------------------------------------
  // Step 1 form — the visitor's upcoming storm (session-only)
  // ---------------------------------------------------------------------
  const CUSTOM_WIND_MIN = 30;
  const CUSTOM_WIND_MAX = 500;

  // Simplified PAR bounding box enforced on the optional Step 1
  // coordinates: latitude 3°N–26°N, longitude 115°E–145°E. Anything
  // outside means the point is outside the Philippine Area of
  // Responsibility, so the form rejects it with an error.
  const PAR_LAT_MIN = 3;
  const PAR_LAT_MAX = 26;
  const PAR_LNG_MIN = 115;
  const PAR_LNG_MAX = 145;

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
    "Tropical Depression": "30–88 km/h · the weakest class — heavy rain, Signals No. 1–2.",
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
    refreshLatLngValidity();
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
    // Coordinates are optional; empty strings mean "no location match".
    const latRaw = customStormLat ? customStormLat.value.trim() : "";
    const lngRaw = customStormLng ? customStormLng.value.trim() : "";
    const lat = latRaw === "" ? null : Number(latRaw);
    const lng = lngRaw === "" ? null : Number(lngRaw);
    let category = customStormCategory ? customStormCategory.value : "";
    if (!category && windRaw !== "" && !isNaN(wind)) {
      category = suggestedCategoryName(wind);
    }
    return { name, windRaw, wind, category, latRaw, lngRaw, lat, lng };
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
    // Coordinates are optional, but they work as a pair: one without the
    // other can't form a point. Each gets its own range check.
    const latFilled = data.latRaw !== "";
    const lngFilled = data.lngRaw !== "";
    if (latFilled !== lngFilled) {
      return {
        message: "Fill both latitude and longitude — or leave both blank to skip the location match.",
        focusEl: latFilled ? customStormLng : customStormLat,
      };
    }
    if (latFilled && (isNaN(data.lat) || data.lat < -90 || data.lat > 90)) {
      return { message: "Latitude must be a number between -90 and 90.", focusEl: customStormLat };
    }
    if (lngFilled && (isNaN(data.lng) || data.lng < -180 || data.lng > 180)) {
      return { message: "Longitude must be a number between -180 and 180.", focusEl: customStormLng };
    }
    // Simplified PAR bounding box (lat 3°N–26°N, lng 115°E–145°E):
    // anything outside PAR is rejected as an error.
    if (latFilled && (data.lat < PAR_LAT_MIN || data.lat > PAR_LAT_MAX)) {
      return {
        message: "Latitude must be between " + PAR_LAT_MIN + "°N and " + PAR_LAT_MAX +
          "°N — anything outside is outside the PAR.",
        focusEl: customStormLat,
      };
    }
    if (lngFilled && (data.lng < PAR_LNG_MIN || data.lng > PAR_LNG_MAX)) {
      return {
        message: "Longitude must be between " + PAR_LNG_MIN + "°E and " + PAR_LNG_MAX +
          "°E — anything outside is outside the PAR.",
        focusEl: customStormLng,
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
      lat: data.lat != null && !isNaN(data.lat) ? data.lat : null,
      lng: data.lng != null && !isNaN(data.lng) ? data.lng : null,
    };
    hasUpcomingStorm = true;
    if (window.UpcomingStormState) window.UpcomingStormState.write(UPCOMING);
    if (window.UpcomingStormState) window.UpcomingStormState.renderCards();
    renderCustomProfile();
    renderAnalogues();
    renderLocationMatches();
    syncPickerToggles();
    // Don't flash the "please choose" error just because an upcoming storm
    // was applied — the user hasn't pressed Run Analysis yet. Only refresh
    // a comparison that is already fully picked.
    if (selection.stormA && selection.stormB) runCompareSafe();
  }

  function restoreCustomStorm() {
    if (!window.UpcomingStormState) return;
    const saved = window.UpcomingStormState.read();
    if (!saved) return;
    if (customStormName) customStormName.value = saved.name;
    if (customStormWind) customStormWind.value = String(saved.wind);
    if (customStormLat) {
      customStormLat.value = saved.lat != null ? String(saved.lat) : "";
    }
    if (customStormLng) {
      customStormLng.value = saved.lng != null ? String(saved.lng) : "";
    }
    if (customStormCategory) customStormCategory.value = saved.category;
    refreshLatLngValidity();
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
    // Both halves come from our own static map — still escape the key.
    const esc = window.TCIS_API ? window.TCIS_API.escapeHtml : function (s) { return String(s); };
    customStormCategoryInfo.innerHTML = "<strong>" + esc(name) + ":</strong> " + info;
    customStormCategoryInfo.hidden = false;
  }

  // Clears the sandbox back to the initial empty state (also used by the
  // page-level Reset so one click restores a pristine page).
  function resetCustomStormState() {
    if (customStormForm) customStormForm.reset();
    if (customStormSuggest) customStormSuggest.hidden = true;
    if (customStormCategoryInfo) customStormCategoryInfo.hidden = true;
    hideCustomError();
    clearLatLngValidity();
    UPCOMING = null;
    hasUpcomingStorm = false;
    if (window.UpcomingStormState) {
      window.UpcomingStormState.clear();
      window.UpcomingStormState.renderCards();
    }
    renderCustomProfile();
    renderAnalogues();
    renderLocationMatches();
    // A cleared upcoming storm can't stay picked — drop it from both
    // dropdowns so it never renders as a stale selection.
    if (selection.stormA === UPCOMING_KEY) selection.stormA = "";
    if (selection.stormB === UPCOMING_KEY) selection.stormB = "";
    if (stormASelect && stormASelect.value === UPCOMING_KEY) stormASelect.value = "";
    if (stormBSelect && stormBSelect.value === UPCOMING_KEY) stormBSelect.value = "";
    syncPickerToggles();
  }

  // Live lat/lng range highlight (before Apply): empty stays neutral since
  // coordinates are optional; any filled value outside the PAR box goes red
  // on each keystroke. The full text error still only appears on Apply via
  // validateCustomStorm(), which remains the authority.
  function setCoordValidity(input, invalid) {
    if (!input) return;
    input.classList.toggle("is-invalid", !!invalid);
    if (invalid) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  function isLatOutOfRange(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (text === "") return false;
    const n = Number(text);
    return isNaN(n) || n < PAR_LAT_MIN || n > PAR_LAT_MAX;
  }

  function isLngOutOfRange(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (text === "") return false;
    const n = Number(text);
    return isNaN(n) || n < PAR_LNG_MIN || n > PAR_LNG_MAX;
  }

  function refreshLatLngValidity() {
    setCoordValidity(customStormLat, customStormLat && isLatOutOfRange(customStormLat.value));
    setCoordValidity(customStormLng, customStormLng && isLngOutOfRange(customStormLng.value));
  }

  function clearLatLngValidity() {
    setCoordValidity(customStormLat, false);
    setCoordValidity(customStormLng, false);
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
    if (customStormLat) {
      customStormLat.addEventListener("input", () => {
        hideCustomError();
        refreshLatLngValidity();
      });
      customStormLat.addEventListener("change", refreshLatLngValidity);
    }
    if (customStormLng) {
      customStormLng.addEventListener("input", () => {
        hideCustomError();
        refreshLatLngValidity();
      });
      customStormLng.addEventListener("change", refreshLatLngValidity);
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
        renderLocationMatches();
        runCompareSafe();
      });
    }
  }

  async function loadData() {
    try {
      const rows = window.TCIS_API
        ? await window.TCIS_API.fetchCyclones()
        : await fetch(API_URL).then(function (res) {
            if (!res.ok) throw new Error("Request failed: " + res.status);
            return res.json();
          });
      if (!Array.isArray(rows)) throw new Error("Unexpected API response");
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

  // ---------------------------------------------------------------------
  // Location matching — Haversine distance against each historical
  // storm's FULL bulletin track (every bulletin lat/long in sequence,
  // not just one point).
  // ---------------------------------------------------------------------

  // Mean Earth radius in km — the standard constant for Haversine.
  const EARTH_RADIUS_KM = 6371;

  // Great-circle distance between two points in kilometres. Haversine is
  // used because it accounts for the Earth's curvature, so the result is
  // a true real-world surface distance rather than a flat-coordinate gap.
  function haversineKm(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const dLat = (lat2 - lat1) * toRad;
    const dLon = (lon2 - lon1) * toRad;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    // Clamp handles floating-point drift at antipodal points (a > 1).
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  // Display scale for the location bar: a closest approach of 0 km reads
  // 100%, and every 1,000 km of distance costs 100 points. Bars are
  // display-only — ranking is always by raw distance.
  const LOCATION_SCORE_RANGE_KM = 1000;

  function locationScore(distanceKm) {
    return Math.max(0, (1 - distanceKm / LOCATION_SCORE_RANGE_KM) * 100);
  }

  function formatDistanceKm(distanceKm) {
    if (distanceKm < 10) return distanceKm.toFixed(1) + " km";
    return Math.round(distanceKm).toLocaleString("en-US") + " km";
  }

  // Collects the bulletin track points that form a storm's track.
  // Bulletins without coordinates are skipped — partial coverage is
  // normal, and any single valid point is enough to compare against.
  // The bulletin_number rides along so the location panel can name the
  // exact bulletin behind each closest approach.
  function trackPointsFromBulletins(bulletins) {
    const points = [];
    (Array.isArray(bulletins) ? bulletins : []).forEach((bulletin) => {
      if (bulletin.latitude == null || bulletin.longitude == null) return;
      const lat = Number(bulletin.latitude);
      const lng = Number(bulletin.longitude);
      if (!isFinite(lat) || !isFinite(lng)) return;
      points.push({
        lat: lat,
        lng: lng,
        bulletin_number: bulletin.bulletin_number != null ? Number(bulletin.bulletin_number) : null,
      });
    });
    return points;
  }

  // Fetches a storm's bulletins through the shared api-client (memoized,
  // ETag-cached), with a direct-API fallback when TCIS_API is absent.
  async function loadStormBulletins(cycloneId) {
    if (window.TCIS_API && typeof window.TCIS_API.fetchBulletins === "function") {
      return window.TCIS_API.fetchBulletins(cycloneId);
    }
    const res = await fetch(BULLETIN_API_URL + encodeURIComponent(cycloneId));
    if (!res.ok) throw new Error("Request failed: " + res.status);
    return res.json();
  }

  // Fetches every storm's bulletins and, for each, the smallest Haversine
  // distance from the entered point to ANY point along its full track
  // (closest approach over all bulletin positions combined). Resolves
  // with storms sorted by that distance — nearest track first — with the
  // distance AND the winning bulletin attached. Storms whose bulletins
  // carry no coordinates are excluded. The input point itself is
  // validated by the caller.
  async function computeLocationMatches(lat, lng) {
    const candidates = await Promise.all(
      STORMS.map(async (storm) => {
        try {
          const bulletins = await loadStormBulletins(storm.id);
          const points = trackPointsFromBulletins(bulletins);
          if (!points.length) return null;
          let closest = Infinity;
          let closestBulletin = null;
          points.forEach((point) => {
            const distance = haversineKm(lat, lng, point.lat, point.lng);
            // Strict < keeps the first (lowest bulletin_number when the
            // feed is ordered) on exact ties — deterministic winner.
            if (distance < closest) {
              closest = distance;
              closestBulletin = point;
            }
          });
          return { storm: storm, distanceKm: closest, bulletin: closestBulletin };
        } catch (err) {
          console.error("Location match: failed to load bulletins for storm", storm.id, err);
          return null;
        }
      })
    );
    return candidates
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // Cap on how many tied storms expand inside one group header; overflow
  // gets a "+N more …" note tucked inside the expanded list.
  const MAX_SUB_ROWS = 5;

  // Shared tie-group markup for BOTH match panels — the wind panel and the
  // location panel render through this one implementation (DRY). A group
  // with a single storm renders as a plain analogue row; a group of 2+
  // collapses into a "Top N · X cyclones tied" header bar (rank badge,
  // Top N pill, shared score + bar, chevron) that expands to its member rows. The
  // group's identity comes from `group.key`/`group.unit` (e.g. 75 km/h,
  // 5.5 km) used in the aria label and the "+N more" note, and `buildRow`
  // renders each member so the panels keep their own row look and data.
  // Nodes are appended into `container` (one node, or header + sub-rows
  // container for a tie group).
  function buildTieGroupMarkup(group, buildRow, container) {
    if (group.matches.length === 1) {
      container.appendChild(buildRow(group.matches[0]));
      return;
    }

    const rep = group.matches[0];
    const shownSubs = group.matches.slice(0, MAX_SUB_ROWS);
    const hiddenSubCount = group.matches.length - shownSubs.length;
    // Keys can carry units ("5.5 km") — collapse whitespace so the id
    // behind aria-controls stays a valid single token.
    const subId =
      "analogue-sub-" + group.rank + "-" + String(group.key).replace(/\s+/g, "-");

    const header = document.createElement("button");
    header.type = "button";
    header.className = "analogue-row analogue-group" + (group.rank === 1 ? " best-match" : " rank-" + group.rank);
    header.setAttribute("aria-expanded", "false");
    header.setAttribute("aria-controls", subId);

    const rank = document.createElement("span");
    rank.className = "rank-number rank-" + group.rank;
    rank.textContent = group.rank;

    const info = document.createElement("div");
    info.className = "analogue-info";
    // Same "Top N" pill as single rows (wind + location share this helper
    // and the .analogue-top-tag style); rank is 1-3, safe to interpolate.
    info.innerHTML =
      '<div class="analogue-name"><span class="analogue-top-tag rank-' + group.rank + '">Top ' + group.rank + "</span>" +
      group.matches.length + ' cyclones tied</div>' +
      '<span class="analogue-match-label">Click to view</span>';

    const sim = document.createElement("div");
    sim.className = "analogue-similarity";
    sim.innerHTML = "<strong>0%</strong>";

    const bar = document.createElement("div");
    bar.className = "match-progress";
    bar.innerHTML = '<span style="width:' + Number(rep.score) + '%"></span>';

    const action = document.createElement("div");
    action.className = "analogue-action";
    const chevron = document.createElement("span");
    chevron.className = "analogue-chevron";
    chevron.setAttribute("aria-hidden", "true");
    chevron.textContent = "\u203a";
    action.appendChild(chevron);

    const sub = document.createElement("div");
    sub.className = "analogue-subrows";
    sub.id = subId;
    sub.hidden = true;
    sub.setAttribute("role", "group");
    sub.setAttribute("aria-label", "Tied storms at " + group.key + " " + group.unit);

    shownSubs.forEach((match) => {
      sub.appendChild(buildRow(match, "is-sub"));
    });
    if (hiddenSubCount > 0) {
      const moreEl = document.createElement("div");
      moreEl.className = "analogue-more";
      moreEl.textContent = "+" + hiddenSubCount + " more at " + group.key + " " + group.unit;
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

    container.appendChild(header);
    container.appendChild(sub);
    animateMatchScore(sim.querySelector("strong"), rep.score);
  }

  // Render token: only the newest location render may paint, so a slow
  // bulletin fetch from a previous apply/reset can never overwrite the
  // panel that is on screen now.
  let locationRenderToken = 0;

  // Builds the separate "Best match · Location" panel — it never merges
  // with the wind-strength group; the two run and display independently.
  async function renderLocationMatches() {
    const token = ++locationRenderToken;
    const hasCoordinates =
      UPCOMING && UPCOMING.lat != null && UPCOMING.lng != null;

    if (!hasCoordinates) {
      // No coordinates entered — the location bar simply never appears.
      // The wind bar is untouched: the two do not depend on each other.
      return;
    }

    let matches;
    try {
      matches = await computeLocationMatches(UPCOMING.lat, UPCOMING.lng);
    } catch (err) {
      if (token !== locationRenderToken || !hasUpcomingStorm) return;
      console.error("Location match failed:", err);
      const failEl = document.createElement("p");
      failEl.className = "empty-state";
      failEl.textContent =
        "Location match could not be calculated — bulletin data is unavailable right now.";
      analogueList.appendChild(failEl);
      return;
    }
    if (token !== locationRenderToken || !hasUpcomingStorm) return;

    // A 0% score must never rank as a "best" match: drop every track whose
    // closest approach is at/beyond the score range (score is display-only,
    // ranking stays by raw distance). The cutoff is display-aware: anything
    // that would render as 0.0% at one decimal is also hidden, not just raw
    // zero (strict < keeps exactly-1000 km out too).
    const hadCandidates = matches.length > 0;
    matches = matches.filter((match) => locationScore(match.distanceKm) > 0.05);

    const groupEl = document.createElement("section");
    groupEl.className = "match-group match-group-location";

    const heading = document.createElement("div");
    heading.className = "match-group-head";
    heading.innerHTML =
      '<div>' +
      '<div class="match-group-titlerow">' +
      '<span class="match-group-trophy" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none">' +
      '<path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="10" r="2.6" stroke="#fff" stroke-width="1.8"/>' +
      "</svg></span>" +
      '<h3 class="match-group-title">Best match &middot; Location</h3>' +
      "</div>" +
      "</div>" +
      '<span class="match-group-badge">' +
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" aria-hidden="true">' +
      '<path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<circle cx="12" cy="10" r="2.6" stroke="currentColor" stroke-width="1.8"/>' +
      "</svg>Based on bulletin tracks (Haversine)</span>";
    groupEl.appendChild(heading);

    if (!matches.length) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "empty-state";
      emptyEl.innerHTML = hadCandidates
        ? "<p>No historical storm passes close to this location — all bulletin tracks are over 1,000 km away.</p>"
        : "<p>No historical storm in the archive has bulletin coordinates to compare this location against.</p>";
      groupEl.appendChild(emptyEl);
      analogueList.appendChild(groupEl);
      return;
    }

    // Rank the GROUPS, not the individual cyclones: cyclones whose
    // closest-approach distances agree to one decimal (the same rounding
    // tolerance the wind groups use on their 1-decimal scores) share one
    // rank — dense Top 3, e.g. two cyclones both 0.0 km away render as
    // "Top 1 · 2 cyclones tied". Input is already nearest-first, so
    // group order is distance order; members inside a group are ordered
    // by exact distance (truly nearer first), then alphabetically.
    const TIE_DECIMALS = 1;
    const topGroups = groupTies(
      matches.map((match) => ({
        storm: match.storm,
        distanceKm: match.distanceKm,
        score: locationScore(match.distanceKm),
        bulletin: match.bulletin || null,
      })),
      (match) => match.distanceKm.toFixed(TIE_DECIMALS),
      compareTiedLocationStorms
    )
      .slice(0, 3)
      .map((group, groupIndex) => ({
        rank: groupIndex + 1,
        key: formatDistanceKm(group.items[0].distanceKm),
        unit: "",
        matches: group.items.map((match) => ({
          storm: match.storm,
          distanceKm: match.distanceKm,
          score: match.score,
          bulletin: match.bulletin || null,
          rank: groupIndex + 1,
        })),
      }));

    // Same precision policy as the wind panel: escalate if two distinct
    // scores would render as the same string.
    scoreDecimals = displayDecimals(topGroups.flatMap((group) => group.matches.map((m) => m.score)));

    // Plain-text "Bulletin N · X.X°N, Y.Y°E" for the winning bulletin, or
    // "" when the number is missing (legacy rows stay clean).
    const matchedBulletinText = (bulletin) => {
      if (!bulletin) return "";
      const num = Number(bulletin.bulletin_number);
      if (!isFinite(num)) return "";
      let coords = "";
      if (typeof formatLatLong === "function") {
        coords = formatLatLong(bulletin.lat, bulletin.lng);
      }
      return "Bulletin " + num + (coords ? " · " + coords : "");
    };

    // Row sub-line HTML for the winning bulletin. Bulletin number comes
    // from our own track data (numeric) and coords from formatLatLong
    // (numbers only) — no raw DB text interpolated.
    const matchedBulletinLabel = (bulletin) => {
      const text = matchedBulletinText(bulletin);
      if (!text) return "";
      return '<span class="analogue-distance-label analogue-bulletin-label">' +
        esc(text) + "</span>";
    };

    // One location row: rank badge, name + closest-approach distance +
    // matched bulletin number/coords, shared bar/score, View button. Same
    // shape as the wind panel's row builder; the bar carries the location
    // panel's teal accent.
    const buildStormRow = (match, extraClass) => {
      const rowEl = document.createElement("div");
      rowEl.className = "analogue-row" +
        (match.rank === 1 ? " best-match" : " rank-" + match.rank) +
        (extraClass ? " " + extraClass : "");

      const rankEl = document.createElement("span");
      rankEl.className = "rank-number rank-" + match.rank;
      rankEl.textContent = match.rank;

      const info = document.createElement("div");
      info.className = "analogue-info";
      var escName = window.TCIS_API ? window.TCIS_API.escapeHtml(match.storm.name) : String(match.storm.name);
      // Explicit "Top N" pill mirroring the wind panel's tie-header wording
      // ("Top 1 · N cyclones tied"): location distances are unique floats so
      // ties almost never occur, leaving single rows with only the rank
      // badge. rank is always 1–3 here (Top-3 slice), safe to interpolate.
      info.innerHTML =
        '<div class="analogue-name"><span class="analogue-top-tag rank-' + match.rank + '">Top ' + match.rank + "</span>" + escName + "</div>" +
        '<span class="analogue-distance-label">Closest approach: ' +
        formatDistanceKm(match.distanceKm) + "</span>" +
        matchedBulletinLabel(match.bulletin);

      const sim = document.createElement("div");
      sim.className = "analogue-similarity";
      sim.innerHTML = "<strong>0%</strong>";

      const bar = document.createElement("div");
      bar.className = "match-progress match-progress-location";
      bar.innerHTML = '<span style="width:' + Number(match.score) + '%"></span>';

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "analogue-view-btn";
      btn.textContent = "View";
      btn.addEventListener("click", () => {
        openAnalogueDetails(match.storm, match.score, btn, {
          kind: "location",
          distanceKm: match.distanceKm,
          bulletin: match.bulletin || null,
        });
      });

      rowEl.appendChild(rankEl);
      rowEl.appendChild(info);
      rowEl.appendChild(sim);
      rowEl.appendChild(bar);
      rowEl.appendChild(btn);
      animateMatchScore(sim.querySelector("strong"), match.score);
      return rowEl;
    };

    // Tied ranks collapse exactly like the wind panel's ("Top N · X
    // cyclones tied", Click to view, capped sub-rows) through the same
    // shared helper — while the panel itself stays fully independent.
    topGroups.forEach((topGroup) => {
      buildTieGroupMarkup(topGroup, buildStormRow, groupEl);
    });

    // Re-check before painting: the panel may have been re-rendered (or
    // emptied) while bulletins were in flight.
    if (token !== locationRenderToken || !hasUpcomingStorm) return;

    analogueList.appendChild(groupEl);
    groupEl.querySelectorAll(".analogue-row").forEach((rowEl, index) => {
      rowEl.style.setProperty("--row-delay", index * 45 + "ms");
    });
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

  // Groups matches that share one value into ordered tie groups (dense
  // grouping: every member of a group shares one rank). `keyOf` decides
  // what "equal" means — pass a rounding function for numeric tolerance
  // (the wind panel compares exact winds; the location panel rounds its
  // Haversine distances to one decimal first, mirroring the wind panel's
  // 1-decimal score equality). Input order is preserved inside groups;
  // group order follows first appearance, so callers stay in control of
  // ranking (e.g. by passing pre-sorted input).
  function groupTies(items, keyOf, sortWithin) {
    const groups = [];
    const index = new Map();
    (items || []).forEach((item) => {
      const key = keyOf(item);
      if (!index.has(key)) {
        const group = { key: key, items: [] };
        index.set(key, group);
        groups.push(group);
      }
      index.get(key).items.push(item);
    });
    if (typeof sortWithin === "function") {
      groups.forEach((group) => group.items.sort(sortWithin));
    }
    return groups;
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

  // Display order for location matches inside one tied-distance group:
  // exact distance first (a 5.51 km cyclone ahead of a 5.53 km one even
  // though both read "5.5 km"), then recency, then alphabetical — the
  // same trailing order the wind panel uses on its ties.
  function compareTiedLocationStorms(a, b) {
    const distanceDiff = a.distanceKm - b.distanceKm;
    if (distanceDiff !== 0) return distanceDiff;
    const recencyDiff = recentness(b.storm) - recentness(a.storm);
    if (recencyDiff !== 0) return recencyDiff;
    return String(a.storm.name).localeCompare(String(b.storm.name));
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
    const topGroups = rankGroupsByCloseness(groupByWind(STORMS), UPCOMING.wind)
      .slice(0, 3)
      .map((group, groupIndex) => ({
        rank: groupIndex + 1,
        // groupTies()/buildTieGroupMarkup() group identity: the exact
        // shared wind (used in the aria label / "+N more" note).
        key: group.wind,
        unit: "km/h",
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
      // DB names are untrusted — escape before innerHTML. The "Top N" pill
      // matches the location panel's rows (same class, same rank colors);
      // rank is always 1–3 here (Top-3 slice), safe to interpolate.
      var escName = window.TCIS_API ? window.TCIS_API.escapeHtml(match.storm.name) : String(match.storm.name);
      info.innerHTML =
        '<div class="analogue-name"><span class="analogue-top-tag rank-' + match.rank + '">Top ' + match.rank + "</span>" + escName + "</div>";

      const sim = document.createElement("div");
      sim.className = "analogue-similarity";
      sim.innerHTML = "<strong>0%</strong>";
      const scoreEl = sim.querySelector("strong");

      const bar = document.createElement("div");
      bar.className = "match-progress";
      // Score is numeric (similarity()) — coerce to float, never raw text.
      bar.innerHTML = '<span style="width:' + Number(match.score) + '%"></span>';

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

    // A rank shared by 2+ storms collapses into one bar: "Top X · N
    // cyclones tied" plus a "Click to view" hint, expanding to all its
    // storms (capped, the overflow note tucked inside). A lone storm
    // renders as a plain row — so the panel is always exactly the top 3
    // ranks and nothing can be pushed off it. Re-renders reset every
    // group to collapsed. The markup itself is shared with the location
    // panel via buildTieGroupMarkup().
    topGroups.forEach((topGroup) => {
      buildTieGroupMarkup(topGroup, buildStormRow, groupEl);
    });

    analogueList.appendChild(groupEl);

    analogueList.querySelectorAll(".analogue-row").forEach((rowEl, index) => {
      rowEl.style.setProperty("--row-delay", index * 45 + "ms");
    });
  }

  function esc(s) {
    return window.TCIS_API ? window.TCIS_API.escapeHtml(s) : String(s == null ? "" : s);
  }

  function statMarkup(label, value, icon, extraClass) {
    return '<div class="analogue-modal-stat' + (extraClass ? " " + extraClass : "") + '"><span class="analogue-stat-icon">' +
      icon + '</span><div><span>' + esc(label) +
      '</span><strong>' + esc(value) + "</strong></div></div>";
  }

  function comparisonRow(label, historicalValue, upcomingValue) {
    return "<tr><th scope=\"row\">" + esc(label) + "</th><td>" +
      esc(historicalValue) + "</td><td>" + esc(upcomingValue) + "</td></tr>";
  }

  function openAnalogueDetails(storm, score, trigger, options) {
    const details = options || {};
    const isLocation = details.kind === "location";
    // Matches the panel's display precision so near-tie storms can't
    // read as the same percentage here either.
    const displayScore = score.toFixed(scoreDecimals);
    const hasCoordinates =
      UPCOMING && UPCOMING.lat != null && UPCOMING.lng != null;

    if (isLocation) {
      const distanceKm = Number(details.distanceKm);
      const distanceText =
        isFinite(distanceKm) ? formatDistanceKm(distanceKm) : "—";
      const upcomingCoordText = hasCoordinates
        ? Number(UPCOMING.lat).toFixed(2) + "°, " + Number(UPCOMING.lng).toFixed(2) + "°"
        : "—";
      // Winning bulletin behind this closest approach (number + coords).
      const matchedBulletin = details.bulletin || null;
      const matchedNum = matchedBulletin ? Number(matchedBulletin.bulletin_number) : NaN;
      const hasBulletin = isFinite(matchedNum);
      const matchedCoords = hasBulletin && typeof formatLatLong === "function"
        ? formatLatLong(matchedBulletin.lat, matchedBulletin.lng)
        : "";
      const matchedText = hasBulletin
        ? "Bulletin " + matchedNum + (matchedCoords ? " (" + matchedCoords + ")" : "")
        : "—";
      const scoreReason =
        storm.name + "'s " + (hasBulletin ? matchedText + " passes" : "bulletin track passes") +
        " within " + distanceText +
        " of " + UPCOMING.name + "'s position (" + upcomingCoordText + "), producing a " +
        displayScore + "% match.";

      analogueModalKicker.innerHTML =
        '<span class="analogue-kicker-icon">&#9670;</span>Best match \u00b7 location';
      analogueModalTitle.textContent = storm.name;
      analogueModalSummary.textContent = storm.date + " · " + storm.category;
      // The modal's "Compared with …" headings name the upcoming storm; they
      // used to be filled by upcoming-storm.js, now we set them directly.
      analogueModal.querySelectorAll('[data-us="storm_name"]').forEach((node) => {
        node.textContent = UPCOMING.name;
      });
      // Row 1 (full width): headline distance. Row 2: Matched Bulletin
      // + Upcoming Position side by side, exactly aligned for direct
      // coordinate comparison.
      analogueModalStats.innerHTML =
        statMarkup("Closest Approach", distanceText, '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/></svg>', "analogue-modal-stat--wide") +
        statMarkup("Matched Bulletin", matchedText, categoryIconMarkup(storm.category, 22)) +
        statMarkup("Upcoming Position", upcomingCoordText,
          categoryIconMarkup(storm.category, 22));
      analogueComparisonStorm.textContent = storm.name;
      // The upcoming storm's position comes from the sandbox form's lat/lng
      // inputs, so its value keeps the coordinate text.
      analogueComparisonBody.innerHTML =
        comparisonRow("Closest Approach", distanceText, upcomingCoordText) +
        comparisonRow("Matched Bulletin", matchedText, "—") +
        comparisonRow("PAGASA Category", storm.category, UPCOMING.category);
      // Reason paragraph + breakdown render separately — the heading and
      // the compact bulletins button live statically in the HTML above,
      // so writing innerHTML here never wipes the button or its listener.
      if (analogueModalReason) {
        analogueModalReason.textContent = scoreReason;
      }
      const explanationTarget = analogueModalExplanationBody || analogueModalExplanation;
      explanationTarget.innerHTML =
        "<div class=\"analogue-match-breakdown\"><div class=\"analogue-score-ring\" style=\"--score: " +
        displayScore + "%\"><strong>" + displayScore + "%</strong><span>LOCATION<br>MATCH</span></div><div class=\"analogue-match-checks\"><span><b>✓</b>Track closeness: " + displayScore +
        "% (" + distanceText + " away)</span>" +
        (hasBulletin ? "<span><b>✓</b>Closest point: " + esc(matchedText) + "</span>" : "") + "</div></div>";

      // Fresh bulletin state per storm; the PDFs lazy-load when the visitor
      // opens the bulletin overlay.
      resetAnalogueBulletins();
      bulletinStorm = storm;
      if (analogueBulletinsHint) {
        analogueBulletinsHint.textContent = hasBulletin
          ? matchedText + " is the closest — inspect all archived PAGASA bulletins for " + storm.name
          : "Inspect archived PAGASA bulletins for " + storm.name;
      }
      // Compact button: full hint lives in the tooltip / screen-reader label.
      if (analogueBulletinsBtn) {
        analogueBulletinsBtn.setAttribute(
          "aria-label",
          "View bulletins — inspect archived PAGASA bulletins for " + storm.name
        );
        analogueBulletinsBtn.title =
          "Inspect archived PAGASA bulletins for " + storm.name;
      }

      lastModalTrigger = trigger;
      analogueModal.hidden = false;
      document.body.classList.add("modal-open");
      analogueModal.querySelector(".analogue-modal-close").focus();
      return;
    }

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
      statMarkup("Strength (Sustained / Gust)", storm.strengthText || "\u2014", '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h7c3 0 3-4 0-4M3 12h13c3 0 3-4 0-4M3 16h9c3 0 3-4 0-4M3 20h5"/></svg>') +
      statMarkup("PAGASA Category", storm.category,
        categoryIconMarkup(storm.category, 22));
    analogueComparisonStorm.textContent = storm.name;
    // The upcoming storm's wind comes from the sandbox form (sustained
    // only — no gust input), so its value keeps the sustained-only text.
    analogueComparisonBody.innerHTML =
      comparisonRow("Strength (Sustained / Gust)", storm.strengthText || "\u2014", UPCOMING.wind + " km/h") +
      comparisonRow("PAGASA Category", storm.category, UPCOMING.category);
    // Reason paragraph + breakdown render separately — the heading and
    // the compact bulletins button live statically in the HTML above,
    // so writing innerHTML here never wipes the button or its listener.
    if (analogueModalReason) {
      analogueModalReason.textContent = scoreReason;
    }
    const explanationTarget = analogueModalExplanationBody || analogueModalExplanation;
    explanationTarget.innerHTML =
      "<div class=\"analogue-match-breakdown\"><div class=\"analogue-score-ring\" style=\"--score: " +
      displayScore + "%\"><strong>" + displayScore + "%</strong><span>WIND<br>MATCH</span></div><div class=\"analogue-match-checks\"><span><b>✓</b>Wind closeness: " + displayScore +
      "% (" + (windDelta >= 0 ? "+" : "") + windDelta + " km/h)</span></div></div>";

    // Fresh bulletin state per storm; the PDFs lazy-load when the visitor
    // opens the bulletin overlay.
    resetAnalogueBulletins();
    bulletinStorm = storm;
    if (analogueBulletinsHint) {
      analogueBulletinsHint.textContent =
        "Inspect archived PAGASA bulletins for " + storm.name;
    }
    // Compact button: full hint lives in the tooltip / screen-reader label.
    if (analogueBulletinsBtn) {
      analogueBulletinsBtn.setAttribute(
        "aria-label",
        "View bulletins — inspect archived PAGASA bulletins for " + storm.name
      );
      analogueBulletinsBtn.title =
        "Inspect archived PAGASA bulletins for " + storm.name;
    }

    lastModalTrigger = trigger;
    analogueModal.hidden = false;
    document.body.classList.add("modal-open");
    analogueModal.querySelector(".analogue-modal-close").focus();
  }

  function closeAnalogueDetails() {
    if (analogueModal.hidden) return;
    resetAnalogueBulletins();
    analogueModal.hidden = true;
    document.body.classList.remove("modal-open");
    if (lastModalTrigger) lastModalTrigger.focus();
  }

  // ---------------------------------------------------------------------
  // Analogue bulletins — archived PAGASA PDFs for the historical storm in
  // the details modal. Same list + in-modal preview UX as Historical Data.
  // ---------------------------------------------------------------------
  let bulletinStorm = null;
  let bulletinItems = [];
  let bulletinQuery = "";
  let bulletinLoadedFor = null;
  let bulletinRequest = 0;

  const bulletinFileSvg =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M6 1.8h7.5L19 7.3V22H6V1.8z" fill="#fff" stroke="#D7DEE8" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M13.5 1.8v5.5H19" fill="#E9EDF3" stroke="#D7DEE8" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<rect x="4" y="12.5" width="16" height="6.4" rx="1.4" fill="#E2574C"/>' +
    '<text x="12" y="17.2" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="4" font-weight="800" fill="#fff" letter-spacing="0.5">PDF</text>' +
    '<path d="M8.2 5.6h5M8.2 8h5" stroke="#E2E8F0" stroke-width="1.3" stroke-linecap="round"/>' +
    "</svg>";

  function renderBulletinSkeletons(count) {
    if (!bulletinList) return;
    bulletinList.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const li = document.createElement("li");
      li.className = "bulletin-skeleton";
      li.setAttribute("aria-hidden", "true");
      li.innerHTML =
        '<span class="sk-icon"></span><span class="sk-lines"></span><span class="sk-btn"></span>';
      bulletinList.appendChild(li);
    }
  }

  function showBulletinListView() {
    if (!bulletinPreviewView || !bulletinListView) return;
    bulletinPreviewView.hidden = true;
    bulletinListView.hidden = false;
    if (bulletinSearchWrap) bulletinSearchWrap.hidden = false;
    // Stop the PDF load when going back to the list.
    if (bulletinPreviewFrame) bulletinPreviewFrame.removeAttribute("src");
    if (bulletinPreviewCoords) {
      bulletinPreviewCoords.hidden = true;
      bulletinPreviewCoords.textContent = "";
    }
  }

  function setBulletinSearchEnabled(enabled) {
    if (bulletinSearch) bulletinSearch.disabled = !enabled;
    if (!enabled && bulletinSearchClear) bulletinSearchClear.hidden = true;
  }

  function getBulletinPreviewUrl(url) {
    // Same fit-to-width hint as Historical Data: start the native viewer
    // at page-width with thumbnails closed so the page never opens at a
    // stale zoom (e.g. 92%) and looks clipped inside the modal.
    if (typeof url !== "string" || !url) return url;
    var base = url.split("#")[0];
    return base + "#page=1&zoom=page-width&pagemode=none&navpanes=0";
  }

  // Shows this bulletin's coordinates alongside its PDF preview title.
  // Missing coords hide the pill so legacy rows never show a stale value.
  function setPreviewCoords(el, bulletin) {
    if (!el) return;
    if (bulletin && bulletin.latitude != null && bulletin.longitude != null) {
      const coordsText = formatLatLong(bulletin.latitude, bulletin.longitude);
      if (coordsText) {
        el.innerHTML =
          '<span aria-hidden="true">📌</span> ' + coordsText;
        el.hidden = false;
        return;
      }
    }
    el.hidden = true;
    el.textContent = "";
  }

  function showBulletinPreview(bulletin) {
    if (!bulletinPreviewView || !bulletinListView || !bulletinStorm) return;
    if (window.TCIS_API && !window.TCIS_API.isSafeBulletinUrl(bulletin.r2_url)) {
      if (bulletinStatus) {
        bulletinStatus.textContent = "This bulletin link looks invalid and was blocked.";
        bulletinStatus.classList.add("is-error");
      }
      return;
    }
    bulletinPreviewTitle.textContent =
      "Bulletin " + bulletin.bulletin_number;
    setPreviewCoords(bulletinPreviewCoords, bulletin);
    bulletinPreviewFrame.src = getBulletinPreviewUrl(bulletin.r2_url);
    bulletinOpenNewTab.href = bulletin.r2_url;
    bulletinDownload.href = bulletin.r2_url;
    bulletinDownload.setAttribute(
      "download",
      "Bulletin-" + bulletin.bulletin_number + ".pdf"
    );
    bulletinListView.hidden = true;
    bulletinPreviewView.hidden = false;
    if (bulletinSearchWrap) bulletinSearchWrap.hidden = true;
    if (bulletinBackBtn) bulletinBackBtn.focus();
  }

  // Hides the overlay and clears all bulletin state. In-flight fetches are
  // invalidated via bulletinRequest so a slow response for a previous storm
  // can never overwrite the current one. The analogue modal underneath is
  // left untouched (it keeps the body's modal-open scroll lock).
  function resetAnalogueBulletins() {
    bulletinRequest++;
    bulletinStorm = null;
    bulletinItems = [];
    bulletinQuery = "";
    bulletinLoadedFor = null;
    if (bulletinSearch) bulletinSearch.value = "";
    if (bulletinSearchClear) bulletinSearchClear.hidden = true;
    if (bulletinList) bulletinList.innerHTML = "";
    if (bulletinStatus) {
      bulletinStatus.textContent = "";
      bulletinStatus.classList.remove("is-error");
    }
    if (bulletinCount) bulletinCount.textContent = "";
    showBulletinListView();
    if (bulletinModal) {
      bulletinModal.hidden = true;
      bulletinModal.classList.remove("is-open");
    }
  }

  function closeAnalogueBulletins() {
    if (!bulletinModal || bulletinModal.hidden) return;
    resetAnalogueBulletins();
    if (analogueBulletinsBtn) analogueBulletinsBtn.focus();
  }

  function bulletinMatchesQuery(b, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const num = String(b.bulletin_number);
    const stormName = (bulletinStorm ? bulletinStorm.name : "").toLowerCase();
    const haystacks = [
      num,
      "bulletin " + num,
      "#" + num,
      ("bulletin " + num + " " + stormName).toLowerCase(),
      stormName,
    ];
    return haystacks.some((h) => h.indexOf(q) !== -1);
  }

  function updateBulletinCount(filtered) {
    const total = bulletinItems.length;
    const totalLabel = total + (total === 1 ? " bulletin" : " bulletins");
    if (bulletinCount) {
      bulletinCount.textContent =
        bulletinQuery && filtered.length !== total
          ? filtered.length + " of " + totalLabel
          : totalLabel;
    }
  }

  function formatLatLong(lat, lon) {
    const latNum = Number(lat);
    const lonNum = Number(lon);
    if (!isFinite(latNum) || !isFinite(lonNum)) return "";
    const latAbs = Math.abs(latNum).toFixed(1);
    const lonAbs = Math.abs(lonNum).toFixed(1);
    const latDir = latNum < 0 ? "S" : "N";
    const lonDir = lonNum < 0 ? "W" : "E";
    return latAbs + "°" + latDir + ", " + lonAbs + "°" + lonDir;
  }

  function renderBulletinItems(list) {
    if (!bulletinList) return;
    bulletinList.innerHTML = "";
    if (list.length === 0) {
      if (bulletinItems.length > 0 && bulletinStatus) {
        bulletinStatus.textContent = "No bulletins match your search.";
      }
      return;
    }
    if (bulletinStatus) bulletinStatus.textContent = "";
    list.forEach((b, index) => {
      const li = document.createElement("li");
      li.style.animationDelay = Math.min(index * 30, 300) + "ms";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bulletin-item";
      btn.setAttribute(
        "aria-label",
        "Preview Bulletin " + b.bulletin_number + " for " + bulletinStorm.name
      );

      const icon = document.createElement("span");
      icon.className = "bulletin-item-icon";
      icon.innerHTML = bulletinFileSvg;

      const text = document.createElement("span");
      text.className = "bulletin-item-text";
      const title = document.createElement("span");
      title.className = "bulletin-item-title";
      title.textContent = "Bulletin " + b.bulletin_number;
      const sub = document.createElement("span");
      sub.className = "bulletin-item-sub";
      sub.textContent = "PDF · Click to preview";
      text.appendChild(title);
      text.appendChild(sub);

      const previewPill = document.createElement("span");
      previewPill.className = "bulletin-item-preview";
      previewPill.textContent = "Preview";

      let latLongPill = null;
      if (b.latitude != null && b.longitude != null) {
        const coordsText = formatLatLong(b.latitude, b.longitude);
        if (coordsText) {
          latLongPill = document.createElement("span");
          latLongPill.className = "bulletin-item-latlong";
          latLongPill.innerHTML =
            '<span aria-hidden="true">📌</span> ' + coordsText;
        }
      }

      // Decorative affordance only (aria-hidden): the outer button owns
      // activation. A nested role=button/tabindex here would create an
      // invalid nested interactive with a double tab stop, so the
      // open-in-new-tab action lives in the preview view instead.
      const openBtn = document.createElement("span");
      openBtn.className = "bulletin-item-open";
      openBtn.setAttribute("aria-hidden", "true");
      openBtn.textContent = "↗";

      const chevron = document.createElement("span");
      chevron.className = "bulletin-item-chevron";
      chevron.textContent = "›";
      chevron.setAttribute("aria-hidden", "true");

      btn.appendChild(icon);
      btn.appendChild(text);
      if (latLongPill) btn.appendChild(latLongPill);
      btn.appendChild(previewPill);
      btn.appendChild(openBtn);
      btn.appendChild(chevron);
      btn.addEventListener("click", () => showBulletinPreview(b));
      li.appendChild(btn);
      bulletinList.appendChild(li);
    });
  }

  function applyBulletinFilter() {
    const filtered = bulletinItems.filter((b) =>
      bulletinMatchesQuery(b, bulletinQuery)
    );
    renderBulletinItems(filtered);
    updateBulletinCount(filtered);
  }

  function resetBulletinSearch() {
    bulletinQuery = "";
    if (bulletinSearch) bulletinSearch.value = "";
    if (bulletinSearchClear) bulletinSearchClear.hidden = true;
  }

  async function loadAnalogueBulletins(storm) {
    const request = ++bulletinRequest;
    resetBulletinSearch();
    setBulletinSearchEnabled(false);
    if (bulletinCount) bulletinCount.textContent = "";
    renderBulletinSkeletons(4);
    if (bulletinStatus) {
      bulletinStatus.textContent = "Loading bulletins…";
      bulletinStatus.classList.remove("is-error");
    }
    showBulletinListView();

    // Rows without a DB id (shouldn't happen — the API returns ids) have
    // no bulletin feed to query.
    if (storm.id == null) {
      if (request !== bulletinRequest) return;
      if (bulletinList) bulletinList.innerHTML = "";
      if (bulletinStatus) bulletinStatus.textContent = "Bulletins are not available for this storm.";
      return;
    }

    try {
      const bulletins = window.TCIS_API
        ? await window.TCIS_API.fetchBulletins(storm.id)
        : await fetch(BULLETIN_API_URL + encodeURIComponent(storm.id)).then(function (res) {
            if (!res.ok) throw new Error("Request failed: " + res.status);
            return res.json();
          });
      if (request !== bulletinRequest) return;

      if (bulletinList) bulletinList.innerHTML = "";
      if (!Array.isArray(bulletins) || bulletins.length === 0) {
        if (bulletinCount) bulletinCount.textContent = "0 bulletins";
        if (bulletinStatus) {
          bulletinStatus.textContent = "No bulletins archived for this cyclone yet.";
        }
        bulletinLoadedFor = storm.id;
        return;
      }

      bulletinItems = bulletins;
      bulletinLoadedFor = storm.id;
      setBulletinSearchEnabled(true);
      applyBulletinFilter();
    } catch (err) {
      if (request !== bulletinRequest) return;
      console.error("Failed to load bulletins:", err);
      if (bulletinList) bulletinList.innerHTML = "";
      if (bulletinCount) bulletinCount.textContent = "";
      if (bulletinStatus) {
        bulletinStatus.textContent = "Could not load bulletins. Please try again.";
        bulletinStatus.classList.add("is-error");
      }
    }
  }

  // Header mirrors the Historical Data viewer: "<Name> Bulletins" over the
  // "year + category" subtitle (category icon removed).
  function setBulletinModalHeader(storm) {
    if (bulletinModalTitle) bulletinModalTitle.textContent = storm.name + " Bulletins";
    if (bulletinModalSubtitle) {
      bulletinModalSubtitle.textContent =
        storm.category && storm.category !== "—"
          ? storm.year + " " + storm.category
          : String(storm.year);
    }
  }

  function openAnalogueBulletins() {
    if (!bulletinModal || !bulletinStorm) return;
    setBulletinModalHeader(bulletinStorm);
    bulletinModal.hidden = false;
    // Next frame so the pop-in animation runs (same pattern as Historical).
    requestAnimationFrame(() => {
      if (bulletinModal) bulletinModal.classList.add("is-open");
    });
    if (bulletinCloseBtn) bulletinCloseBtn.focus();
    if (bulletinLoadedFor !== bulletinStorm.id) {
      loadAnalogueBulletins(bulletinStorm);
    }
  }

  function setupAnalogueBulletins() {
    if (analogueBulletinsBtn) {
      analogueBulletinsBtn.addEventListener("click", openAnalogueBulletins);
    }
    if (bulletinCloseBtn) {
      bulletinCloseBtn.addEventListener("click", closeAnalogueBulletins);
    }
    if (bulletinModal) {
      bulletinModal.addEventListener("click", (e) => {
        if (e.target === bulletinModal) closeAnalogueBulletins();
      });
    }
    if (bulletinBackBtn) {
      bulletinBackBtn.addEventListener("click", showBulletinListView);
    }
    if (bulletinSearch) {
      bulletinSearch.addEventListener("input", () => {
        bulletinQuery = bulletinSearch.value;
        if (bulletinSearchClear) {
          bulletinSearchClear.hidden = bulletinQuery.length === 0;
        }
        applyBulletinFilter();
      });
      bulletinSearch.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && bulletinSearch.value) {
          e.preventDefault();
          e.stopPropagation();
          resetBulletinSearch();
          applyBulletinFilter();
          bulletinSearch.focus();
        }
      });
    }
    if (bulletinSearchClear) {
      bulletinSearchClear.addEventListener("click", () => {
        resetBulletinSearch();
        applyBulletinFilter();
        if (bulletinSearch) bulletinSearch.focus();
      });
    }
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
    return '<div class="metric-value ' + esc(colorClass) + '"><div class="metric-value-main"><strong>' +
      esc(value) + "</strong>" + bar + "</div>" + badge + "</div>";
  }

  function row(label, valueA, valueB, winner, classA, classB, barA, barB) {
    // winner: 0 = none, 1 = A, 2 = B. classA/classB carry each column's
    // result tone: "metric-green" for the overall winner, "metric-red" for
    // the loser, or the default identity classes on a tie.
    return (
      '<tr><td>' + metricCellHtml(valueA, classA, barA, winner === 1) +
      '</td><th scope="row" class="metric-col"><span class="metric-icon">' +
      esc(metricIcon(label)) + '</span><span>' + esc(label) + '</span></th><td>' +
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

  // Results-header subtitle: single strength mode (was COMPARISON_MODES
  // scaffolding — one static string now, no over-engineering).
  function updateResultsSubtitle() {
    if (!resultsSubtitle) return;
    resultsSubtitle.textContent = COMPARISON_SUBTITLE;
  }

  // Stable storm identity: selections store the DB id (as a string) when
  // available, falling back to the display name for rows without one.
  // Matches by id first, then by exact display name.
  function stormKey(storm) {
    return storm && storm.id != null ? String(storm.id) : (storm ? storm.name : "");
  }

  function findStorm(ref) {
    if (ref == null || ref === "") return null;
    const byId = STORMS.find((s) => s.id != null && String(s.id) === String(ref));
    if (byId) return byId;
    return STORMS.find((s) => s.name === ref) || null;
  }

  // The applied upcoming storm (Step 1) is a first-class pick in BOTH
  // dropdowns: a pinned "upcoming" option sits at the very top of each
  // storm list (when one is applied), above the historical storms.
  var UPCOMING_KEY = "__upcoming__";
  var UPCOMING_LABEL = "Upcoming storm";

  function resolveStorm(ref) {
    if (ref === UPCOMING_KEY) return hasUpcomingStorm && UPCOMING ? UPCOMING : null;
    return findStorm(ref);
  }

  function upcomingLabel() {
    if (!hasUpcomingStorm || !UPCOMING) return UPCOMING_LABEL;
    return UPCOMING_LABEL + " — " + UPCOMING.name;
  }

  function stormDisplayLabel(storm) {
    if (!storm) return "";
    if (storm.year) return storm.name + " \u00b7 " + storm.year;
    return storm.name;
  }

  function lookupErrorRow(message) {
    updateWinnerBanner("Comparison", "", "", "idle");
    colAHead.textContent = "—";
    colBHead.textContent = "—";
    tableBody.innerHTML =
      '<tr class="empty-row"><td colspan="3">' +
      '<div class="empty-state"><p>' + message + "</p></div></td></tr>";
  }

  function runCompare() {
    const refA = selection.stormA;
    const refB = selection.stormB;
    if (!refA || !refB) return;

    // The cyclone list failed to load — nothing can be resolved.
    if (!STORMS.length) {
      lookupErrorRow("Could not load cyclone data from the server. Check that XAMPP (Apache + MySQL) is running, then reload the page.");
      return;
    }

    const a = resolveStorm(refA);
    const b = resolveStorm(refB);
    if (!a) {
      lookupErrorRow(refA === UPCOMING_KEY
        ? "The upcoming storm is no longer applied. Apply one in Step 1, then pick it again."
        : "The selected storm (A) could not be found. The list may have changed — please re-select it and run the analysis again.");
      return;
    }
    if (!b) {
      lookupErrorRow(refB === UPCOMING_KEY
        ? "The upcoming storm is no longer applied. Apply one in Step 1, then pick it again."
        : "The selected storm (B) could not be found. The list may have changed — please re-select it and run the analysis again.");
      return;
    }

    // Same storm on both sides has no meaning — ask for two different picks.
    if (refA === refB || (a === b && refA !== UPCOMING_KEY)) {
      setCompareError("Pick two different storms — Storm A and Storm B can't be the same.", ["stormA", "stormB"]);
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
    // is an explicit tie. Either column may be the applied upcoming storm
    // (picked from the pinned top option in its dropdown).
    const compareB = b;
    // Defensive: without a B column there is nothing to render — the caller
    // guards this, but never crash the results table on a null storm.
    if (!compareB) {
      lookupErrorRow("There is nothing to compare against. Apply an upcoming storm in Step 1 or select a second historical storm above.");
      return;
    }
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

    // Either side may be the upcoming storm (no year) — its header reads
    // name-only with an "Upcoming storm" tag instead of a year.
    colAHead.innerHTML =
      '<span class="th-flex"><span class="col-badge ' + esc(badgeA) + '">A</span>' +
      esc(a.name) + ' <span class="col-year">· ' + esc(a.year || "Upcoming storm") + "</span></span>";
    colBHead.innerHTML =
      '<span class="th-flex"><span class="col-badge ' + esc(badgeB) + '">B</span>' +
      esc(compareB.name) + ' <span class="col-year">· ' + esc(compareB.year || "Upcoming storm") + "</span></span>";

    function bannerLabel(storm) {
      if (!storm) return "";
      return storm.year ? storm.name + " · " + storm.year : storm.name + " (upcoming storm)";
    }

    if (isTie) {
      updateWinnerBanner(
        "It's a Tie",
        bannerLabel(a) + " & " + bannerLabel(compareB),
        "Both storms top out at " + a.wind +
          " km/h at the same PAGASA category — neither is stronger. Based on PAGASA best track data.",
        "tie"
      );
    } else if (windDiff !== 0) {
      updateWinnerBanner(
        "Overall Winner",
        bannerLabel(winner),
        "is stronger based on wind speed. Based on PAGASA best track data.",
        "win"
      );
    } else {
      updateWinnerBanner(
        "Overall Winner",
        bannerLabel(winner),
        "reached a higher PAGASA category at the same wind speed. Based on PAGASA best track data.",
        "win"
      );
    }

    // Per-row "Stronger" badges: the wind row is decided by wind speed, the
    // category row by PAGASA category; 0 = row is level, so no badge.
    const windWinner = windDiff > 0 ? 1 : windDiff < 0 ? 2 : 0;
    const catWinner = catDiff > 0 ? 1 : catDiff < 0 ? 2 : 0;

    // Strength shows the combined sustained/gust text (display only); the
    // row's "Stronger" badge is still decided by sustained wind (windDiff).
    // The upcoming storm side has no gust input (sandbox form), so it keeps
    // its sustained-only text.
    html += row("Strength (Sustained / Gust)",
      a.strengthText || (a.wind != null ? a.wind + " km/h" : "\u2014"),
      compareB.strengthText || (compareB.wind != null ? compareB.wind + " km/h" : "\u2014"),
      windWinner, classA, classB, (a.wind / 250) * 100, (compareB.wind / 250) * 100);

    html += row("PAGASA Category", a.category, compareB.category, catWinner,
      classA, classB);

    tableBody.innerHTML = html;
  }

  // Run Analysis is always clickable. With an incomplete selection it does
  // nothing except flag what's missing: an inline error, a red outline on
  // the button plus the empty picker(s), and a short shake for attention.
  function setCompareError(message, missing) {
    if (compareError) {
      if (message) {
        compareError.textContent = message;
        compareError.hidden = false;
      } else {
        compareError.textContent = "";
        compareError.hidden = true;
      }
    }
    if (compareBtn) compareBtn.classList.toggle("is-error", !!message);
    ["stormA", "stormB"].forEach(function (which) {
      var root = pickerContainer(which);
      if (root) root.classList.toggle("needs-choice", !!(missing && missing.indexOf(which) !== -1));
    });
    if (message && compareBtn) {
      // Re-trigger the shake animation on repeated clicks.
      compareBtn.classList.remove("is-error");
      void compareBtn.offsetWidth;
      compareBtn.classList.add("is-error");
    }
  }

  function runCompareSafe() {
    var missing = [];
    if (!selection.stormA) missing.push("stormA");
    if (!selection.stormB) missing.push("stormB");
    if (missing.length) {
      setCompareError("Please choose two cyclones first — pick a storm in both dropdowns above.", missing);
      // Idle/empty state: no result yet, so the banner indicator stays
      // dim (no glow classes set) and the guidance empty state shows.
      updateWinnerBanner("Comparison", "", "", "idle");
      tableBody.innerHTML =
        '<tr class="empty-row"><td colspan="3">' +
        '<div class="empty-state">' +
        '<svg viewBox="0 0 24 24" width="28" height="28" fill="none">' +
        '<path d="M4 20V10M10 20V4M16 20v-7M22 20V8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />' +
        "</svg>" +
        "<p>Select a storm in both dropdowns above (historical or the applied upcoming storm), then click " +
        "<strong>Run Analysis</strong> to see results here.</p>" +
        "</div></td></tr>";
      colAHead.textContent = "—";
      colBHead.textContent = "—";
      return;
    }
    setCompareError("", []);
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
    renderLocationMatches();
    setCompareError("", []);
  }

  // ---------------------------------------------------------------------
  // Searchable storm pickers
  // ---------------------------------------------------------------------
  // Each picker is a button + a panel with a search input and a scrollable
  // option list. Clicking the toggle opens the panel and focuses its
  // search box; typing filters the list; clicking an option picks the
  // storm, closes the panel and fires the same change flow the old native
  // <select> used. The `selection` object is the single source of truth for
  // the compare logic; a hidden <select> (kept in sync) mirrors it for the
  // verify harness and as a fallback.
  const PLACEHOLDER = { stormA: "Select a storm\u2026", stormB: "Select a storm…" };

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

    // Pinned upcoming-storm option at the very top (when applied) — its own
    // separated bar so the visitor can pit the Step 1 storm against any
    // historical cyclone. Hidden while searching so results stay storm-only.
    if (hasUpcomingStorm && UPCOMING && !query) {
      const upOpt = document.createElement("button");
      upOpt.type = "button";
      upOpt.className = "picker-option picker-option-upcoming";
      upOpt.setAttribute("role", "option");
      upOpt.setAttribute("data-value", UPCOMING_KEY);
      upOpt.setAttribute("aria-selected", String(selection[picker.which] === UPCOMING_KEY));
      const upName = document.createElement("span");
      upName.className = "picker-option-name";
      upName.textContent = upcomingLabel();
      const upTag = document.createElement("span");
      upTag.className = "picker-option-tag";
      upTag.textContent = "Upcoming";
      upOpt.appendChild(upName);
      upOpt.appendChild(upTag);
      if (selection[picker.which] === UPCOMING_KEY) upOpt.classList.add("is-selected");
      picker.list.appendChild(upOpt);
      const upSep = document.createElement("div");
      upSep.className = "picker-separator";
      upSep.setAttribute("aria-hidden", "true");
      upSep.textContent = "Historical storms";
      picker.list.appendChild(upSep);
    }

    let shown = 0;
    ordered.forEach((storm) => {
      if (query && !stormMatchesQuery(storm, query)) return;
      const key = stormKey(storm);
      const isChosen = selection[picker.which] !== "" &&
        (selection[picker.which] === key || selection[picker.which] === storm.name);
      const opt = document.createElement("button");
      opt.type = "button";
      opt.className = "picker-option";
      opt.setAttribute("role", "option");
      opt.setAttribute("data-value", key);
      opt.setAttribute("aria-selected", String(isChosen));
      opt.textContent = storm.name + " \u00b7 " + storm.year;
      if (isChosen) opt.classList.add("is-selected");
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
      // selection is the source of truth (hidden <select> mirrors it, but
      // reads "" when its options were rebuilt without the chosen value).
      const raw = selection[which] || (hiddenSelect ? hiddenSelect.value : "");
      let label = "";
      if (raw === UPCOMING_KEY) {
        label = upcomingLabel();
      } else if (raw) {
        const found = findStorm(raw);
        label = found ? found.name + " \u00b7 " + found.year : raw;
      }
      picker.toggle.querySelector(".picker-toggle-label").textContent =
        label || PLACEHOLDER[which];
      picker.toggle.classList.toggle("has-value", !!raw);
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
    // A completed selection clears any previous "please choose" error.
    if (selection.stormA && selection.stormB) setCompareError("", []);
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

    // Type-to-filter; debounced so every keystroke doesn't re-sort the table.
    search.addEventListener("input", window.TCIS_API
      ? window.TCIS_API.debounce(() => renderPickerOptions(picker), 150)
      : () => renderPickerOptions(picker));

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

    // Hidden selects also carry the upcoming option so the fallback and
    // the verify harness can pick it too. Rebuilt on every fill, so re-add
    // it each time (keeps the "" placeholder first).
    [stormASelect, stormBSelect].forEach((select) => {
      // Drop any storm options from a previous fill (keeps the placeholder).
      Array.from(select.options)
        .filter((option) => option.value !== "")
        .forEach((option) => option.remove());

      if (hasUpcomingStorm && UPCOMING) {
        const upOption = document.createElement("option");
        upOption.value = UPCOMING_KEY;
        upOption.textContent = upcomingLabel();
        select.appendChild(upOption);
      }

      ordered.forEach((storm) => {
        const option = document.createElement("option");
        option.value = stormKey(storm);
        option.textContent = storm.name + " · " + storm.year;
        select.appendChild(option);
      });
    });
    // Restore any picked values the rebuild just dropped.
    if (stormASelect && selection.stormA) stormASelect.value = selection.stormA;
    if (stormBSelect && selection.stormB) stormBSelect.value = selection.stormB;
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
    renderLocationMatches();

    compareBtn.addEventListener("click", runCompareSafe);
    resetBtn.addEventListener("click", resetControls);

    if (stormASelect) {
      stormASelect.addEventListener("change", () => {
        selection.stormA = stormASelect.value;
        if (selection.stormA && selection.stormB) setCompareError("", []);
      });
    }
    if (stormBSelect) {
      stormBSelect.addEventListener("change", () => {
        selection.stormB = stormBSelect.value;
        if (selection.stormA && selection.stormB) setCompareError("", []);
      });
    }

    // The shared state script clears the stored profile on a browser reload;
    // ordinary navigation restores it when this page is opened again.
    analogueModal.querySelectorAll("[data-modal-close]").forEach((el) =>
      el.addEventListener("click", closeAnalogueDetails)
    );
    setupAnalogueBulletins();
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      // Escape unwinds topmost-first: PDF preview → bulletin overlay →
      // analogue modal. The analogue modal underneath keeps the body's
      // scroll lock until it closes too.
      if (bulletinModal && !bulletinModal.hidden) {
        if (bulletinPreviewView && !bulletinPreviewView.hidden) {
          showBulletinListView();
          return;
        }
        closeAnalogueBulletins();
        return;
      }
      if (!analogueModal.hidden) closeAnalogueDetails();
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
