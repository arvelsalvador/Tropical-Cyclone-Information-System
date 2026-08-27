// Tropical Cyclone Information System — Historical Data page
// Renders the cyclone table, wires filters (year range, category, area),
// name search, stat cards, CSV export, and numbered pagination.
// Filters apply live; no submit button needed.

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Data — based on PAGASA historical records for Camarines Norte
  // ---------------------------------------------------------------------
  const CATEGORIES = {
    "Super Typhoon": { color: "#7c3aed", bg: "#ede9fe" },
    Typhoon: { color: "#dc2626", bg: "#fee2e2" },
    "Severe Tropical Storm": { color: "#ea580c", bg: "#ffedd5" },
    "Tropical Storm": { color: "#ca8a04", bg: "#fef9c3" },
    "Tropical Depression": { color: "#059669", bg: "#d1fae5" },
    "Low Pressure Area": { color: "#64748b", bg: "#f1f5f9" },
  };

  const STORMS = [
    { name: "Typhoon Rolly (Goni)", year: 2020, category: "Super Typhoon", date: "Nov 1, 2020", location: "Mercedes, Camarines Norte", wind: 225, rainfall: 350.2, affected: 126000, damage: "₱1.2B" },
    { name: "Typhoon Ulysses (Vamco)", year: 2020, category: "Typhoon", date: "Nov 11, 2020", location: "Daet, Camarines Norte", wind: 155, rainfall: 240.0, affected: 88000, damage: "₱520M" },
    { name: "Typhoon Quinta (Molave)", year: 2020, category: "Typhoon", date: "Oct 25, 2020", location: "Paracale, Camarines Norte", wind: 185, rainfall: 290.5, affected: 98000, damage: "₱763M" },
    { name: "Typhoon Ambo (Vongfong)", year: 2020, category: "Typhoon", date: "May 14, 2020", location: "San Vicente, Camarines Norte", wind: 155, rainfall: 210.0, affected: 74000, damage: "₱510M" },
    { name: "Typhoon Tisoy (Kammuri)", year: 2019, category: "Typhoon", date: "Dec 3, 2019", location: "Daet, Camarines Norte", wind: 175, rainfall: 265.0, affected: 88000, damage: "₱640M" },
    { name: "Typhoon Ursula (Phanfone)", year: 2019, category: "Typhoon", date: "Dec 25, 2019", location: "Vinzons, Camarines Norte", wind: 150, rainfall: 180.4, affected: 52000, damage: "₱320M" },
    { name: "Typhoon Rosita (Yutu)", year: 2018, category: "Typhoon", date: "Oct 30, 2018", location: "Santa Elena, Camarines Norte", wind: 160, rainfall: 195.6, affected: 61000, damage: "₱410M" },
    { name: "Typhoon Ompong (Mangkhut)", year: 2018, category: "Typhoon", date: "Sept 15, 2018", location: "Bagasbas, Daet", wind: 195, rainfall: 274.1, affected: 82000, damage: "₱542M" },
    { name: "TD Usman", year: 2018, category: "Tropical Depression", date: "Dec 29, 2018", location: "Labo, Camarines Norte", wind: 55, rainfall: 320.8, affected: 95000, damage: "₱280M" },
    { name: "TS Urduja (Kai-tak)", year: 2017, category: "Severe Tropical Storm", date: "Dec 14, 2017", location: "Basud, Camarines Norte", wind: 95, rainfall: 156.0, affected: 32000, damage: "₱186M" },
    { name: "Typhoon Nina (Nock-ten)", year: 2016, category: "Typhoon", date: "Dec 26, 2016", location: "Talisay, Camarines Norte", wind: 205, rainfall: 310.3, affected: 132000, damage: "₱980M" },
    { name: "Typhoon Karen (Sarika)", year: 2016, category: "Typhoon", date: "Oct 16, 2016", location: "San Vicente, Camarines Norte", wind: 165, rainfall: 240.7, affected: 76000, damage: "₱450M" },
    { name: "Typhoon Lawin (Haima)", year: 2016, category: "Typhoon", date: "Oct 20, 2016", location: "Mercedes, Camarines Norte", wind: 175, rainfall: 150.0, affected: 28000, damage: "₱120M" },
    { name: "Typhoon Lando (Koppu)", year: 2015, category: "Typhoon", date: "Oct 18, 2015", location: "Santa Elena, Camarines Norte", wind: 170, rainfall: 230.9, affected: 67000, damage: "₱480M" },
    { name: "Typhoon Nona (Melor)", year: 2015, category: "Typhoon", date: "Dec 14, 2015", location: "Mercedes, Camarines Norte", wind: 175, rainfall: 250.6, affected: 84000, damage: "₱620M" },
    { name: "TS Amang (Mekkhala)", year: 2015, category: "Tropical Storm", date: "Jan 18, 2015", location: "Basud, Camarines Norte", wind: 85, rainfall: 130.2, affected: 22000, damage: "₱75M" },
    { name: "Typhoon Glenda (Rammasun)", year: 2014, category: "Typhoon", date: "Jul 16, 2014", location: "Daet, Camarines Norte", wind: 185, rainfall: 220.5, affected: 91000, damage: "₱570M" },
    { name: "TS Mario (Fung-wong)", year: 2014, category: "Tropical Storm", date: "Sep 19, 2014", location: "Vinzons, Camarines Norte", wind: 85, rainfall: 160.4, affected: 26000, damage: "₱95M" },
    { name: "TS Maring (Trami)", year: 2013, category: "Tropical Storm", date: "Aug 19, 2013", location: "Labo, Camarines Norte", wind: 85, rainfall: 185.0, affected: 24000, damage: "₱88M" },
    { name: "TS Salome", year: 2013, category: "Tropical Storm", date: "Jul 17, 2013", location: "Paracale, Camarines Norte", wind: 85, rainfall: 142.3, affected: 18000, damage: "₱98M" },
    { name: "Typhoon Labuyo (Utor)", year: 2013, category: "Typhoon", date: "Aug 12, 2013", location: "Santa Elena, Camarines Norte", wind: 165, rainfall: 175.2, affected: 42000, damage: "₱230M" },
    { name: "Typhoon Santi (Nari)", year: 2013, category: "Typhoon", date: "Oct 12, 2013", location: "Capalonga, Camarines Norte", wind: 150, rainfall: 205.8, affected: 58000, damage: "₱310M" },
    { name: "Typhoon Pedring (Nesat)", year: 2011, category: "Typhoon", date: "Sep 27, 2011", location: "Mercedes, Camarines Norte", wind: 175, rainfall: 210.7, affected: 72000, damage: "₱390M" },
    { name: "Typhoon Quiel (Nalgae)", year: 2011, category: "Typhoon", date: "Oct 1, 2011", location: "Labo, Camarines Norte", wind: 160, rainfall: 185.4, affected: 55000, damage: "₱270M" },
    { name: "Typhoon Juan (Megi)", year: 2010, category: "Super Typhoon", date: "Oct 18, 2010", location: "Vinzons, Camarines Norte", wind: 225, rainfall: 190.3, affected: 30000, damage: "₱140M" },
    { name: "Typhoon Basyang (Conson)", year: 2010, category: "Typhoon", date: "Jul 14, 2010", location: "Daet, Camarines Norte", wind: 130, rainfall: 145.6, affected: 35000, damage: "₱160M" },
  ];

  const PAGE_SIZE = 10;

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
  let lastFiltered = STORMS;
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

    /* Stagger siblings inside the same parent (e.g. the stat cards). */
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

    const span = 2020 - 2010;
    const leftPct = ((min - 2010) / span) * 100;
    const rightPct = ((max - 2010) / span) * 100;
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
    const landfalls = filtered.filter((s) => s.date && s.location).length;

    const strongest = filtered.reduce(
      (best, s) =>
        s.wind / s.rainfall > (best ? best.wind / best.rainfall : -1)
          ? s
          : best,
      null
    );

    animateStat(statTotal, total, 0);
    statTotalSub.textContent =
      filters.minYear === 2010 && filters.maxYear === 2020
        ? "2010–2020"
        : filters.minYear + "–" + filters.maxYear;
    if (strongest) {
      animateStat(statMaxWind, strongest.wind / strongest.rainfall, 2);
    } else {
      if (statMaxWind._raf) cancelAnimationFrame(statMaxWind._raf);
      statMaxWind._value = null;
      statMaxWind.textContent = "—";
    }
    statMaxWindSub.textContent = strongest
      ? strongest.name.replace(/^Typhoon |^TS |^TD /, "") +
        " · " +
        strongest.wind + " km/h · " +
        strongest.rainfall.toFixed(1) + " mm rain"
      : "no data in range";
    animateStat(statAverage, average, 1);

    tableTitle.textContent =
      "List of Historical Cyclones (" +
      filters.minYear +
      "–" +
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

      const cells = [
        storm.year,
        null, // category badge handled separately
        storm.date,
        storm.location,
        storm.wind,
        storm.rainfall.toFixed(1),
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
      total === 0 ? "0 of 0" : start + "–" + end + " of " + total;
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
    const header = [
      "Name", "Year", "PAGASA Category", "Landfall Date",
      "Landfall Location", "Max Wind (km/h)", "Rainfall (mm)",
    ];
    const rows = lastFiltered.map((s) => [
      s.name, s.year, s.category, s.date, s.location,
      s.wind, s.rainfall.toFixed(1),
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
    link.download = "camarines-norte-cyclones-2010-2020.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------
  // Clear filters
  // ---------------------------------------------------------------------
  function clearFilters() {
    yearMinInput.value = 2010;
    yearMaxInput.value = 2020;
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
  function init() {
    setupReveal();
    buildCategoryList();
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
