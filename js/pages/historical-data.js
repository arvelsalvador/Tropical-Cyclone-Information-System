// Tropical Cyclone Information System — Historical Data page
// Renders the cyclone table, wires filters (year range, category, area),
// name search, stat cards, CSV export, and numbered pagination.
// Filters apply live; no submit button needed.
//
// UPDATED: data now comes live from MySQL via get_cyclones.php instead of
// a hardcoded array.

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Config (endpoints + shared helpers via js/api-client.js)
  // ---------------------------------------------------------------------
  const API_URL = (window.TCIS_API && window.TCIS_API.CYCLONES_URL) || "/Weather/api/get_cyclones.php";
  const BULLETIN_API_URL = (window.TCIS_API && window.TCIS_API.BULLETINS_URL) || "/Weather/api/get_bulletins.php?cyclone_id=";

  // Storm badge artwork: transparent PNG glyphs in assets/Icons, one per
  // intensity. Same color ramp as the pill palette used on the admin pages.
  const CATEGORY_ICONS = {
    "Super Typhoon": "../assets/Icons/Purple_Storm.png",
    Typhoon: "../assets/Icons/Red_Storm.png",
    "Severe Tropical Storm": "../assets/Icons/Orange_Storm.png",
    "Tropical Storm": "../assets/Icons/Yellow_Storm.png",
    "Tropical Depression": "../assets/Icons/Green_Storm.png",
    "Low Pressure Area": "../assets/Icons/Grey_Storm.png",
  };

  // Builds the <img> markup for a category badge, or "" when the category has
  // no artwork. Callers fall back to text-only rendering when it is empty.
  function categoryIconMarkup(category, size) {
    const src = CATEGORY_ICONS[category];
    if (!src) return "";
    return (
      '<img src="' + src + '" alt="" width="' + size + '" height="' + size +
      '" loading="lazy" decoding="async">'
    );
  }

  // Categories offered in the filter list, most intense first; only the keys
  // are read at runtime. The hex values document the shared severity palette
  // (mirrored by the badge artwork above and the admin .pill--* classes).
  const CATEGORIES = {
    "Super Typhoon": { color: "#7c3aed", bg: "#ede9fe" },
    Typhoon: { color: "#dc2626", bg: "#fee2e2" },
    "Severe Tropical Storm": { color: "#ea580c", bg: "#ffedd5" },
    "Tropical Storm": { color: "#ca8a04", bg: "#fef9c3" },
    "Tropical Depression": { color: "#059669", bg: "#d1fae5" },
    "Low Pressure Area": { color: "#64748b", bg: "#f1f5f9" },
  };

  // Maps the abbreviations stored in the database to full display names.
  // Canonical map lives in js/api-client.js (window.TCIS_API.CATEGORY_MAP).
  const CATEGORY_MAP = (window.TCIS_API && window.TCIS_API.CATEGORY_MAP) || {
    TD: "Tropical Depression",
    TS: "Tropical Storm",
    STS: "Severe Tropical Storm",
    TY: "Typhoon",
    STY: "Super Typhoon",
  };

  // Rainfall intensity (cyclones.rainfall_category ENUM) badge colors.
  // NULL / empty maps to "—" and uses the muted fallback in renderTable.
  const RAINFALL_LEVELS = [
    "Not detected",
    "Light to Moderate",
    "Moderate to Heavy",
    "Heavy to Intense",
    "Intense to Torrential",
  ];

  const RAINFALL_STYLES = {
    "Not detected": { color: "#64748b", bg: "#f1f5f9" },
    "Light to Moderate": { color: "#0284c7", bg: "#e0f2fe" },
    "Moderate to Heavy": { color: "#ca8a04", bg: "#fef9c3" },
    "Heavy to Intense": { color: "#ea580c", bg: "#ffedd5" },
    "Intense to Torrential": { color: "#dc2626", bg: "#fee2e2" },
  };

  const PAGE_SIZE = 10;

  // Populated by loadData() on startup — replaces the old static STORMS array.
  let STORMS = [];
  let YEAR_MIN = 2022;
  let YEAR_MAX = 2025;

  // ---------------------------------------------------------------------
  // Element references
  // ---------------------------------------------------------------------
  const tbody = document.getElementById("stormTableBody");
  const tableTitle = document.getElementById("tableTitle");
  const searchInput = document.getElementById("searchInput");
  const yearMinInput = document.getElementById("yearMinInput");
  const yearMaxInput = document.getElementById("yearMaxInput");
  const yearMinValue = document.getElementById("yearMinValue");
  const yearMaxValue = document.getElementById("yearMaxValue");
  const rangeFill = document.getElementById("rangeFill");
  const categoryList = document.getElementById("categoryList");
  const clearBtn = document.getElementById("clearFilters");
  const statTotal = document.getElementById("statTotal");
  const statTotalSub = document.getElementById("statTotalSub");
  const statMaxWind = document.getElementById("statMaxWind");
  const statMaxWindSub = document.getElementById("statMaxWindSub");
  const statAverage = document.getElementById("statAverage");
  const pageInfo = document.getElementById("pageInfo");
  const pageNumbers = document.getElementById("pageNumbers");
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");
  const downloadBtn = document.getElementById("downloadCsv");

  let currentPage = 1;
  let lastFiltered = [];
  let searchQuery = "";

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------------
  // Data loading + mapping (NEW)
  // ---------------------------------------------------------------------
  function formatDateRange(startStr, endStr) {
    if (window.TCIS_API) return window.TCIS_API.formatDateRange(startStr, endStr, false);
    if (!startStr) return "—";
    const opts = { month: "short", day: "numeric" };
    const start = new Date(startStr + "T00:00:00");
    const startText = start.toLocaleDateString("en-US", opts);
    if (!endStr) {
      return startText;
    }
    const end = new Date(endStr + "T00:00:00");
    const endText = end.toLocaleDateString("en-US", opts);
    // Single-day cyclones (end date same as start) keep the inclusive
    // range format, e.g. "Apr 12 – Apr 12".
    return startText + " \u2013 " + endText;
  }

  function toTitleCase(s) {
    return String(s)
      .toLowerCase()
      .replace(/(?:^|[\s-(/])\S/g, (c) => c.toUpperCase());
  }

  // Display name: title-case the local part, keep the international
  // part exactly as stored, e.g. "UWAN (Fung-wong)" -> "Uwan (Fung-wong)".
  function stormDisplayName(storm) {
    const raw = storm.name || "";
    const paren = raw.indexOf(" (");
    if (paren === -1) return toTitleCase(raw);
    return toTitleCase(raw.slice(0, paren)) + raw.slice(paren);
  }

  // Full label with PAGASA category prefix, e.g. "Typhoon Uwan (Fung-wong)".
  // Falls back to the bare display name when no category is recorded.
  function stormLabel(storm) {
    const display = stormDisplayName(storm);
    if (!storm.category || storm.category === "—") return display;
    return storm.category + " " + display;
  }

  // Header subtitle: "2025 Tropical Depression" (year + category).
  function stormSubtitleDetails(storm) {
    if (!storm.category || storm.category === "—") return String(storm.year);
    return storm.year + " " + storm.category;
  }

  function mapRow(row) {
    const name = row.international_name
      ? row.local_name + " (" + row.international_name + ")"
      : row.local_name;

    const category = (window.TCIS_API ? window.TCIS_API.categoryFull(row.highest_category) : (CATEGORY_MAP[row.highest_category] || row.highest_category || "—"));

    let wind = window.TCIS_API ? window.TCIS_API.parseSustained(row.highest_strength) : null;
    if (wind === null && !window.TCIS_API && row.highest_strength) {
      const parsed = parseInt(String(row.highest_strength).split("/")[0], 10);
      if (!isNaN(parsed)) wind = parsed;
    }

    // rainfall_category ENUM may be NULL (not yet encoded) — show "—".
    // "Not detected" is an explicit recorded value, keep it as a badge.
    const rainfallRaw = (row.rainfall_category || "").trim();
    const rainfall = RAINFALL_LEVELS.indexOf(rainfallRaw) !== -1 ? rainfallRaw : "—";

    return {
      id: row.id != null ? parseInt(row.id, 10) : null,
      name: name,
      year: parseInt(row.year, 10),
      category: category,
      date: formatDateRange(row.date_start, row.date_end),
      dateStart: row.date_start || null,
      wind: wind,
      rainfall: rainfall,
    };
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
      STORMS = rows.map(mapRow);

      // Most recent first: newest year on top, then the latest date within
      // the same year; cyclones without a date sort last inside their year.
      STORMS.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        const aDate = a.dateStart || "";
        const bDate = b.dateStart || "";
        if (aDate !== bDate) return aDate > bDate ? -1 : 1;
        return 0;
      });

      if (STORMS.length > 0) {
        const years = STORMS.map((s) => s.year);
        YEAR_MIN = Math.min.apply(null, years);
        YEAR_MAX = Math.max.apply(null, years);
      }
    } catch (err) {
      console.error("Failed to load cyclone data:", err);
      STORMS = [];
      tbody.innerHTML =
        '<tr class="empty-row"><td colspan="7">Could not load data from the server. Check that XAMPP (Apache + MySQL) is running.</td></tr>';
    }
  }

  // ---------------------------------------------------------------------
  // Animations: count-up numbers, scroll reveal
  // ---------------------------------------------------------------------
  function animateStat(el, target, decimals) {
    if (window.TCIS_API) {
      window.TCIS_API.animateStat(el, target, decimals);
      return;
    }
    if (!el) return;
    if (prefersReducedMotion) {
      el._value = target;
      el.textContent = target.toFixed(decimals);
      return;
    }
    if (el._raf) cancelAnimationFrame(el._raf);
    const from = typeof el._value === "number" ? el._value : 0;
    const duration = 900;
    const t0 = performance.now();

    function frame(now) {
      const progress = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); /* ease-out cubic */
      const value = from + (target - from) * eased;
      el._value = value;
      el.textContent = value.toFixed(decimals);
      if (progress < 1) el._raf = requestAnimationFrame(frame);
    }

    el._raf = requestAnimationFrame(frame);
  }

  function setupReveal() {
    const targets = document.querySelectorAll("[data-reveal]");

    targets.forEach((el) => {
      const siblings = el.parentElement.querySelectorAll(
        ":scope > [data-reveal]"
      );
      const index = Array.prototype.indexOf.call(siblings, el);
      if (index > 0) el.style.transitionDelay = index * 90 + "ms";
    });

    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      // Unify with js/main.js: add both classes (is-visible is canonical).
      targets.forEach((el) => el.classList.add("is-revealed", "is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed", "is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach((el) => observer.observe(el));
  }

  // ---------------------------------------------------------------------
  // Filter UI setup
  // ---------------------------------------------------------------------
  function buildCategoryList() {
    categoryList.innerHTML = "";
    Object.keys(CATEGORIES).forEach((cat) => {
      const label = document.createElement("label");
      label.className = "category-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = cat;

      const icon = document.createElement("span");
      icon.className = "category-icon";
      icon.innerHTML = categoryIconMarkup(cat, 28);

      const text = document.createElement("span");
      text.textContent = cat;

      label.appendChild(checkbox);
      label.appendChild(icon);
      label.appendChild(text);
      categoryList.appendChild(label);
    });
  }

  // ---------------------------------------------------------------------
  function updateRangeUI() {
    let min = parseInt(yearMinInput.value, 10);
    let max = parseInt(yearMaxInput.value, 10);
    if (min > max) {
      if (document.activeElement === yearMinInput) {
        min = max;
        yearMinInput.value = min;
      } else {
        max = min;
        yearMaxInput.value = max;
      }
    }
    yearMinValue.textContent = min;
    yearMaxValue.textContent = max;

    const span = YEAR_MAX - YEAR_MIN || 1;
    const leftPct = ((min - YEAR_MIN) / span) * 100;
    const rightPct = ((max - YEAR_MIN) / span) * 100;
    rangeFill.style.left = leftPct + "%";
    rangeFill.style.width = rightPct - leftPct + "%";
  }

  // ---------------------------------------------------------------------
  // Filtering + sorting
  // ---------------------------------------------------------------------
  function getActiveFilters() {
    const categories = Array.from(
      categoryList.querySelectorAll("input[type=checkbox]:checked")
    ).map((c) => c.value);

    return {
      minYear: parseInt(yearMinInput.value, 10),
      maxYear: parseInt(yearMaxInput.value, 10),
      categories: categories,
    };
  }

  function getFiltered(filters) {
    const q = searchQuery.trim().toLowerCase();
    return STORMS.filter((storm) => {
      if (storm.year < filters.minYear || storm.year > filters.maxYear)
        return false;
      if (
        filters.categories.length > 0 &&
        filters.categories.indexOf(storm.category) === -1
      )
        return false;
      if (q) {
        const haystack = (
          storm.name +
          " " +
          storm.category +
          " " +
          storm.rainfall +
          " " +
          storm.year
        ).toLowerCase();
        if (haystack.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function runFilters() {
    const filters = getActiveFilters();
    const filtered = getFiltered(filters);

    updateStats(filtered, filters);
    lastFiltered = filtered;
    currentPage = 1;
    renderTable(filtered);
  }

  function updateStats(filtered, filters) {
    const total = filtered.length;
    const spanYears = filters.maxYear - filters.minYear + 1;
    const average = spanYears > 0 ? total / spanYears : 0;

    const strongest = filtered.reduce((best, s) => {
      if (s.wind == null) return best;
      if (!best || s.wind > best.wind) return s;
      return best;
    }, null);

    animateStat(statTotal, total, 0);
    statTotalSub.textContent = filters.minYear + "\u2013" + filters.maxYear;

    if (strongest) {
      animateStat(statMaxWind, strongest.wind, 0);
    } else {
      if (statMaxWind._raf) cancelAnimationFrame(statMaxWind._raf);
      statMaxWind._value = null;
      statMaxWind.textContent = "—";
    }
    statMaxWindSub.textContent = strongest
      ? strongest.name + " \u00b7 " + strongest.wind + " km/h"
      : "no data in range";

    animateStat(statAverage, average, 1);

    tableTitle.textContent =
      "List of Historical Cyclones (" +
      filters.minYear +
      "\u2013" +
      filters.maxYear +
      ")";
  }

  // ---------------------------------------------------------------------
  // Table rendering
  // ---------------------------------------------------------------------
  function renderTable(filtered) {
    tbody.innerHTML = "";

    if (filtered.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.className = "empty-row";
      emptyRow.innerHTML =
        '<td colspan="7">No cyclones match the selected filters.</td>';
      tbody.appendChild(emptyRow);
      updatePagination(filtered);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    pageRows.forEach((storm, rowIndex) => {
      const row = document.createElement("tr");
      row.style.animationDelay = rowIndex * 45 + "ms";
      row.classList.add("is-clickable");
      row.tabIndex = 0;
      if (storm.id != null) row.dataset.cycloneId = storm.id;
      row.setAttribute("title", "View bulletins for " + stormLabel(storm));
      row.setAttribute("aria-label", "View bulletins for " + stormLabel(storm));
      row.addEventListener("click", () => openBulletinModal(storm, row));
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openBulletinModal(storm, row);
        }
      });

      const nameCell = document.createElement("td");
      const nameWrap = document.createElement("span");
      nameWrap.className = "storm-name-cell";
      const dot = document.createElement("span");
      dot.className = "storm-dot";
      dot.innerHTML = categoryIconMarkup(storm.category, 36);
      const nameText = document.createElement("span");
      nameText.textContent = storm.name;
      nameWrap.appendChild(dot);
      nameWrap.appendChild(nameText);
      nameCell.appendChild(nameWrap);
      row.appendChild(nameCell);

      // Year, Category (placeholder, filled below), Date, Wind,
      // Rainfall (placeholder, filled below)
      const cells = [
        storm.year,
        null,
        storm.date,
        storm.wind != null ? storm.wind + " km/h" : "—",
        null,
      ];

      cells.forEach((value) => {
        const td = document.createElement("td");
        if (value !== null) td.textContent = value;
        row.appendChild(td);
      });

      // Category shows plain text label; rainfall stays plain
      // table text (no pill background).
      const badgeTd = row.children[2];
      badgeTd.textContent = storm.category;

      const rainfallTd = row.children[5];
      rainfallTd.textContent = storm.rainfall;

      // Bulletins indicator cell (presentational — the whole row opens the modal)
      const bulletinTd = document.createElement("td");
      bulletinTd.className = "bulletin-cell";
      const action = document.createElement("span");
      action.className = "bulletin-cell-action";
      action.textContent = "View PDFs ";
      const chevron = document.createElement("span");
      chevron.className = "bulletin-cell-chevron";
      chevron.textContent = "›";
      chevron.setAttribute("aria-hidden", "true");
      action.appendChild(chevron);
      bulletinTd.appendChild(action);
      row.appendChild(bulletinTd);

      tbody.appendChild(row);
    });

    updatePagination(filtered);
  }

  // ---------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------
  function updatePagination(filtered) {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    pageInfo.textContent =
      total === 0 ? "0 of 0" : start + "\u2013" + end + " of " + total;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;

    pageNumbers.innerHTML = "";
    for (let p = 1; p <= totalPages; p++) {
      const pageBtn = document.createElement("button");
      pageBtn.type = "button";
      pageBtn.className = "page-num" + (p === currentPage ? " active" : "");
      pageBtn.textContent = p;
      pageBtn.setAttribute(
        "aria-label",
        "Go to page " + p + (p === currentPage ? " (current page)" : "")
      );
      pageBtn.addEventListener("click", () => {
        currentPage = p;
        renderTable(lastFiltered);
      });
      pageNumbers.appendChild(pageBtn);
    }
  }

  // ---------------------------------------------------------------------
  // Bulletin modal: list view + in-modal PDF preview
  // ---------------------------------------------------------------------
  const bulletinModal = document.getElementById("bulletinModal");
  const bulletinModalTitle = document.getElementById("bulletinModalTitle");
  const bulletinModalSubtitle = document.getElementById("bulletinModalSubtitle");
  const bulletinModalCatIcon = document.getElementById("bulletinModalCatIcon");
  const bulletinList = document.getElementById("bulletinList");
  const bulletinStatus = document.getElementById("bulletinStatus");
  const bulletinListView = document.getElementById("bulletinListView");
  const bulletinPreviewView = document.getElementById("bulletinPreviewView");
  const bulletinPreviewFrame = document.getElementById("bulletinPreviewFrame");
  const bulletinPreviewTitle = document.getElementById("bulletinPreviewTitle");
  const bulletinOpenNewTab = document.getElementById("bulletinOpenNewTab");
  const bulletinDownload = document.getElementById("bulletinDownload");
  const bulletinCloseBtn = document.getElementById("bulletinClose");
  const bulletinBackBtn = document.getElementById("bulletinBackBtn");
  const bulletinCount = document.getElementById("bulletinCount");
  const bulletinSearch = document.getElementById("bulletinSearch");
  const bulletinSearchClear = document.getElementById("bulletinSearchClear");
  const bulletinSearchWrap = document.getElementById("bulletinSearchWrap");

  let lastFocusedRow = null;
  let currentBulletins = [];
  let currentStormName = "";
  let currentStormLabel = "";
  let currentStormCategory = "";
  let bulletinQuery = "";

  const bulletinFileSvg =
    '<svg viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M6 1.8h7.5L19 7.3V22H6V1.8z" fill="#fff" stroke="#D7DEE8" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="M13.5 1.8v5.5H19" fill="#E9EDF3" stroke="#D7DEE8" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<rect x="4" y="12.5" width="16" height="6.4" rx="1.4" fill="#E2574C"/>' +
    '<text x="12" y="17.2" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="4" font-weight="800" fill="#fff" letter-spacing="0.5">PDF</text>' +
    '<path d="M8.2 5.6h5M8.2 8h5" stroke="#E2E8F0" stroke-width="1.3" stroke-linecap="round"/>' +
    "</svg>";

  function renderBulletinSkeletons(count) {
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
    bulletinPreviewView.hidden = true;
    bulletinListView.hidden = false;
    if (bulletinSearchWrap) bulletinSearchWrap.hidden = false;
    // Stop the PDF load when going back to the list.
    bulletinPreviewFrame.removeAttribute("src");
  }

  function setBulletinSearchEnabled(enabled) {
    if (bulletinSearch) bulletinSearch.disabled = !enabled;
    if (!enabled && bulletinSearchClear) bulletinSearchClear.hidden = true;
  }

  function showBulletinPreview(bulletin, cycloneName) {
    if (window.TCIS_API && !window.TCIS_API.isSafeBulletinUrl(bulletin.r2_url)) {
      bulletinStatus.textContent = "This bulletin link looks invalid and was blocked.";
      bulletinStatus.classList.add("is-error");
      return;
    }
    bulletinPreviewTitle.textContent =
      (currentStormLabel || cycloneName) +
      " — Bulletin " +
      bulletin.bulletin_number;
    bulletinPreviewFrame.src = bulletin.r2_url;
    bulletinOpenNewTab.href = bulletin.r2_url;
    bulletinDownload.href = bulletin.r2_url;
    bulletinDownload.setAttribute(
      "download",
      "Bulletin-" + bulletin.bulletin_number + ".pdf"
    );
    bulletinListView.hidden = true;
    bulletinPreviewView.hidden = false;
    if (bulletinSearchWrap) bulletinSearchWrap.hidden = true;
    if (document.activeElement && bulletinSearchWrap &&
        bulletinSearchWrap.contains(document.activeElement)) {
      if (bulletinBackBtn) bulletinBackBtn.focus();
    }
  }

  function closeBulletinModal() {
    if (!bulletinModal || bulletinModal.hidden) return;
    bulletinModal.hidden = true;
    bulletinModal.classList.remove("is-open");
    bulletinPreviewFrame.removeAttribute("src");
    document.body.style.overflow = "";
    resetBulletinSearch();
    currentBulletins = [];
    currentStormName = "";
    currentStormLabel = "";
    currentStormCategory = "";
    bulletinQuery = "";
    if (lastFocusedRow && document.contains(lastFocusedRow)) {
      lastFocusedRow.focus();
    }
    lastFocusedRow = null;
  }

  function bulletinMatchesQuery(b, query) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const num = String(b.bulletin_number);
    const haystacks = [
      num,
      "bulletin " + num,
      "#" + num,
      ("bulletin " + num + " " + currentStormName).toLowerCase(),
      currentStormName.toLowerCase(),
      currentStormLabel.toLowerCase(),
      currentStormCategory.toLowerCase(),
    ];
    return haystacks.some((h) => h.indexOf(q) !== -1);
  }

  function updateBulletinCount(filtered) {
    const total = currentBulletins.length;
    const totalLabel = total + (total === 1 ? " bulletin" : " bulletins");
    if (bulletinCount) {
      bulletinCount.textContent =
        bulletinQuery && filtered.length !== total
          ? filtered.length + " of " + totalLabel
          : totalLabel;
    }
    return totalLabel;
  }

  function renderBulletinItems(list) {
    bulletinList.innerHTML = "";
    if (list.length === 0) {
      if (currentBulletins.length > 0) {
        bulletinStatus.textContent = "No bulletins match your search.";
      }
      return;
    }
    bulletinStatus.textContent = "";
    list.forEach((b, index) => {
      const li = document.createElement("li");
      li.style.animationDelay = Math.min(index * 30, 300) + "ms";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bulletin-item";
      btn.setAttribute(
        "aria-label",
        "Preview Bulletin " + b.bulletin_number + " for " + currentStormName
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
      btn.appendChild(previewPill);
      btn.appendChild(openBtn);
      btn.appendChild(chevron);
      btn.addEventListener("click", () =>
        showBulletinPreview(b, currentStormName)
      );
      li.appendChild(btn);
      bulletinList.appendChild(li);
    });
  }

  function applyBulletinFilter() {
    const filtered = currentBulletins.filter((b) =>
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

  // The modal header shows the cyclone's category badge beside the
  // "2025 Typhoon" subtitle; categories without artwork hide the node.
  function setBulletinModalCategoryIcon(category) {
    if (!bulletinModalCatIcon) return;
    const markup = categoryIconMarkup(category, 22);
    bulletinModalCatIcon.innerHTML = markup;
    bulletinModalCatIcon.hidden = markup === "";
  }

  async function openBulletinModal(storm, rowEl) {
    if (!bulletinModal || storm.id == null) return;
    lastFocusedRow = rowEl || null;
    currentStormName = stormDisplayName(storm);
    currentStormLabel = stormLabel(storm);
    currentStormCategory = storm.category || "";
    currentBulletins = [];
    resetBulletinSearch();
    setBulletinSearchEnabled(false);

    bulletinModalTitle.textContent = currentStormName + " Bulletins";
    bulletinModalSubtitle.textContent = stormSubtitleDetails(storm);
    setBulletinModalCategoryIcon(storm.category);
    if (bulletinCount) bulletinCount.textContent = "";
    renderBulletinSkeletons(6);
    bulletinStatus.textContent = "Loading bulletins…";
    bulletinStatus.classList.remove("is-error");
    showBulletinListView();

    bulletinModal.hidden = false;
    requestAnimationFrame(() =>
      bulletinModal.classList.add("is-open")
    );
    document.body.style.overflow = "hidden";
    if (bulletinCloseBtn) bulletinCloseBtn.focus();

    try {
      const bulletins = window.TCIS_API
        ? await window.TCIS_API.fetchBulletins(storm.id)
        : await fetch(BULLETIN_API_URL + encodeURIComponent(storm.id)).then(function (res) {
            if (!res.ok) throw new Error("Request failed: " + res.status);
            return res.json();
          });

      bulletinList.innerHTML = "";
      if (!Array.isArray(bulletins) || bulletins.length === 0) {
        if (bulletinCount) bulletinCount.textContent = "0 bulletins";
        bulletinStatus.textContent =
          "No bulletins archived for this cyclone yet.";
        return;
      }

      currentBulletins = bulletins;
      const countLabel =
        bulletins.length + (bulletins.length === 1 ? " bulletin" : " bulletins");
      if (bulletinCount) bulletinCount.textContent = countLabel;
      bulletinModalSubtitle.textContent = stormSubtitleDetails(storm);
      setBulletinSearchEnabled(true);
      applyBulletinFilter();
    } catch (err) {
      console.error("Failed to load bulletins:", err);
      bulletinList.innerHTML = "";
      if (bulletinCount) bulletinCount.textContent = "";
      bulletinStatus.textContent =
        "Could not load bulletins. Please try again.";
      bulletinStatus.classList.add("is-error");
    }
  }

  function wireBulletinModal() {
    if (!bulletinModal) return;
    if (bulletinCloseBtn)
      bulletinCloseBtn.addEventListener("click", closeBulletinModal);
    if (bulletinBackBtn)
      bulletinBackBtn.addEventListener("click", showBulletinListView);
    bulletinModal.addEventListener("click", (e) => {
      if (e.target === bulletinModal) closeBulletinModal();
    });
    if (bulletinSearch) {
      bulletinSearch.addEventListener("input", () => {
        bulletinQuery = bulletinSearch.value;
        if (bulletinSearchClear)
          bulletinSearchClear.hidden = bulletinQuery.length === 0;
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
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBulletinModal();
    }, true);
  }

  // ---------------------------------------------------------------------
  // CSV export
  // ---------------------------------------------------------------------
  function downloadCsv() {
    const header = ["Name", "Year", "PAGASA Category", "Inclusive Date", "Max Wind (km/h)", "Rainfall Intensity"];
    const rows = lastFiltered.map((s) => [
      s.name,
      s.year,
      s.category,
      s.date,
      s.wind != null ? s.wind : "",
      s.rainfall && s.rainfall !== "—" ? s.rainfall : "",
    ]);
    const csv = [header].concat(rows)
      .map((row) =>
        row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cyclones-" + YEAR_MIN + "-" + YEAR_MAX + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------
  // Clear filters
  // ---------------------------------------------------------------------
  function clearFilters() {
    yearMinInput.value = YEAR_MIN;
    yearMaxInput.value = YEAR_MAX;
    searchInput.value = "";
    searchQuery = "";
    categoryList
      .querySelectorAll("input[type=checkbox]")
      .forEach((c) => (c.checked = false));
    updateRangeUI();
    runFilters();
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------
  async function init() {
    setupReveal();
    buildCategoryList();
    wireBulletinModal();

    await loadData();

    yearMinInput.min = YEAR_MIN;
    yearMinInput.max = YEAR_MAX;
    yearMinInput.value = YEAR_MIN;
    yearMaxInput.min = YEAR_MIN;
    yearMaxInput.max = YEAR_MAX;
    yearMaxInput.value = YEAR_MAX;

    updateRangeUI();
    runFilters();

    yearMinInput.addEventListener("input", () => {
      updateRangeUI();
      runFilters();
    });
    yearMaxInput.addEventListener("input", () => {
      updateRangeUI();
      runFilters();
    });
    categoryList.addEventListener("change", runFilters);
    clearBtn.addEventListener("click", clearFilters);

    searchInput.addEventListener("input", window.TCIS_API
      ? window.TCIS_API.debounce(() => {
          searchQuery = searchInput.value;
          runFilters();
        }, 150)
      : () => {
          searchQuery = searchInput.value;
          runFilters();
        });

    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderTable(lastFiltered);
      }
    });
    nextBtn.addEventListener("click", () => {
      const totalPages = Math.max(
        1,
        Math.ceil(lastFiltered.length / PAGE_SIZE)
      );
      if (currentPage < totalPages) {
        currentPage += 1;
        renderTable(lastFiltered);
      }
    });

    downloadBtn.addEventListener("click", downloadCsv);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();