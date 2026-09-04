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
  // Config
  // ---------------------------------------------------------------------
  const API_URL = "/Weather/api/get_cyclones.php"; // adjust path if needed

  const CATEGORIES = {
    "Super Typhoon": { color: "#7c3aed", bg: "#ede9fe" },
    Typhoon: { color: "#dc2626", bg: "#fee2e2" },
    "Severe Tropical Storm": { color: "#ea580c", bg: "#ffedd5" },
    "Tropical Storm": { color: "#ca8a04", bg: "#fef9c3" },
    "Tropical Depression": { color: "#059669", bg: "#d1fae5" },
    "Low Pressure Area": { color: "#64748b", bg: "#f1f5f9" },
  };

  // Maps the abbreviations stored in the database to full display names.
  const CATEGORY_MAP = {
    TD: "Tropical Depression",
    TS: "Tropical Storm",
    STS: "Severe Tropical Storm",
    TY: "Typhoon",
    STY: "Super Typhoon",
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

  const hurricaneSvg =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none">' +
    '<circle cx="12" cy="12" r="2.6" fill="#fff"/>' +
    '<path d="M12 9.4c0-4 2.8-6.9 7.6-6.9-1.1 3-3.9 5-7.6 6.9z" fill="#fff"/>' +
    '<path d="M12 14.6c0 4-2.8 6.9-7.6 6.9 1.1-3 3.9-5 7.6-6.9z" fill="#fff"/>' +
    "</svg>";

  // ---------------------------------------------------------------------
  // Data loading + mapping (NEW)
  // ---------------------------------------------------------------------
  function formatDateRange(startStr, endStr) {
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

  function mapRow(row) {
    const name = row.international_name
      ? row.local_name + " (" + row.international_name + ")"
      : row.local_name;

    const category = CATEGORY_MAP[row.highest_category] || row.highest_category || "—";

    let wind = null;
    if (row.highest_strength) {
      const parsed = parseInt(String(row.highest_strength).split("/")[0], 10);
      if (!isNaN(parsed)) wind = parsed;
    }

    return {
      name: name,
      year: parseInt(row.year, 10),
      category: category,
      date: formatDateRange(row.date_start, row.date_end),
      wind: wind,
    };
  }

  async function loadData() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Request failed: " + res.status);
      const rows = await res.json();
      STORMS = rows.map(mapRow);

      if (STORMS.length > 0) {
        const years = STORMS.map((s) => s.year);
        YEAR_MIN = Math.min.apply(null, years);
        YEAR_MAX = Math.max.apply(null, years);
      }
    } catch (err) {
      console.error("Failed to load cyclone data:", err);
      STORMS = [];
      tbody.innerHTML =
        '<tr class="empty-row"><td colspan="6">Could not load data from the server. Check that XAMPP (Apache + MySQL) is running.</td></tr>';
    }
  }

  // ---------------------------------------------------------------------
  // Animations: count-up numbers, scroll reveal
  // ---------------------------------------------------------------------
  function animateStat(el, target, decimals) {
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
      targets.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
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
      const meta = CATEGORIES[cat];
      const label = document.createElement("label");
      label.className = "category-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = cat;

      const icon = document.createElement("span");
      icon.className = "category-icon";
      icon.style.background = meta.color;
      icon.innerHTML = hurricaneSvg;

      const text = document.createElement("span");
      text.textContent = cat;

      label.appendChild(checkbox);
      label.appendChild(icon);
      label.appendChild(text);
      categoryList.appendChild(label);
    });
  }

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
      if (q && storm.name.toLowerCase().indexOf(q) === -1) return false;
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
        '<td colspan="6">No cyclones match the selected filters.</td>';
      tbody.appendChild(emptyRow);
      updatePagination(filtered);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    pageRows.forEach((storm, rowIndex) => {
      const meta = CATEGORIES[storm.category] || {
        color: "#64748b",
        bg: "#f1f5f9",
      };

      const row = document.createElement("tr");
      row.style.animationDelay = rowIndex * 45 + "ms";

      const nameCell = document.createElement("td");
      const nameWrap = document.createElement("span");
      nameWrap.className = "storm-name-cell";
      const dot = document.createElement("span");
      dot.className = "storm-dot";
      dot.style.background = meta.bg;
      dot.innerHTML =
        '<svg viewBox="0 0 24 24" width="15" height="15" fill="none">' +
        '<circle cx="12" cy="12" r="2.6" fill="' + meta.color + '"/>' +
        '<path d="M12 9.4c0-4 2.8-6.9 7.6-6.9-1.1 3-3.9 5-7.6 6.9z" fill="' + meta.color + '"/>' +
        '<path d="M12 14.6c0 4-2.8 6.9-7.6 6.9 1.1-3 3.9-5 7.6-6.9z" fill="' + meta.color + '"/>' +
        "</svg>";
      const nameText = document.createElement("span");
      nameText.textContent = storm.name;
      nameWrap.appendChild(dot);
      nameWrap.appendChild(nameText);
      nameCell.appendChild(nameWrap);
      row.appendChild(nameCell);

      // Year, Category (placeholder, filled below), Date, Wind
      const cells = [
        storm.year,
        null,
        storm.date,
        storm.wind != null ? storm.wind + " km/h" : "—",
      ];

      cells.forEach((value) => {
        const td = document.createElement("td");
        if (value !== null) td.textContent = value;
        row.appendChild(td);
      });

      // Category badge
      const badgeTd = row.children[2];
      const badge = document.createElement("span");
      badge.className = "category-badge";
      badge.textContent = storm.category;
      badge.style.background = meta.bg;
      badge.style.color = meta.color;
      badgeTd.appendChild(badge);

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
  // CSV export
  // ---------------------------------------------------------------------
  function downloadCsv() {
    const header = ["Name", "Year", "PAGASA Category", "Inclusive Date", "Max Wind (km/h)"];
    const rows = lastFiltered.map((s) => [
      s.name,
      s.year,
      s.category,
      s.date,
      s.wind != null ? s.wind : "",
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

    searchInput.addEventListener("input", () => {
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