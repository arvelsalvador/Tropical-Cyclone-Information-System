// Tropical Cyclone Information System — Historical Data page
// Renders the cyclone table, wires filters (year range, category, area),
// updates stat cards, and handles pagination.

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

  const MUNICIPALITIES = [
    "Basud",
    "Capalonga",
    "Daet",
    "Jose Panganiban",
    "Labo",
    "Mercedes",
    "Paracale",
    "San Lorenzo Ruiz",
    "San Vicente",
    "Santa Elena",
    "Talisay",
    "Vinzons",
  ];

  const PAGE_SIZE = 5;

  // ---------------------------------------------------------------------
  // Element references
  // ---------------------------------------------------------------------
  const tbody = document.getElementById("stormTableBody");
  const yearMinInput = document.getElementById("yearMinInput");
  const yearMaxInput = document.getElementById("yearMaxInput");
  const yearMinValue = document.getElementById("yearMinValue");
  const yearMaxValue = document.getElementById("yearMaxValue");
  const rangeFill = document.getElementById("rangeFill");
  const categoryList = document.getElementById("categoryList");
  const areaSelect = document.getElementById("areaSelect");
  const clearBtn = document.getElementById("clearFilters");
  const applyBtn = document.getElementById("applyFilters");
  const statTotal = document.getElementById("statTotal");
  const statTotalSub = document.getElementById("statTotalSub");
  const statLandfall = document.getElementById("statLandfall");
  const statAverage = document.getElementById("statAverage");
  const pageInfo = document.getElementById("pageInfo");
  const prevBtn = document.getElementById("prevPage");
  const nextBtn = document.getElementById("nextPage");

  let currentPage = 1;
  let lastFiltered = STORMS;

  const hurricaneSvg =
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none">' +
    '<circle cx="12" cy="12" r="2.6" fill="#fff"/>' +
    '<path d="M12 9.4c0-4 2.8-6.9 7.6-6.9-1.1 3-3.9 5-7.6 6.9z" fill="#fff"/>' +
    '<path d="M12 14.6c0 4-2.8 6.9-7.6 6.9 1.1-3 3.9-5 7.6-6.9z" fill="#fff"/>' +
    "</svg>";

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

  function buildAreaOptions() {
    MUNICIPALITIES.forEach((m) => {
      const option = document.createElement("option");
      option.value = m;
      option.textContent = m;
      areaSelect.appendChild(option);
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
  // Filtering + rendering
  // ---------------------------------------------------------------------
  function getActiveFilters() {
    const years = Array.from(
      categoryList.querySelectorAll("input[type=checkbox]:checked")
    ).map((c) => c.value);

    return {
      minYear: parseInt(yearMinInput.value, 10),
      maxYear: parseInt(yearMaxInput.value, 10),
      categories: years,
      area: areaSelect.value,
    };
  }

  function applyFilters() {
    const filters = getActiveFilters();
    const filtered = STORMS.filter((storm) => {
      if (storm.year < filters.minYear || storm.year > filters.maxYear)
        return false;
      if (
        filters.categories.length > 0 &&
        filters.categories.indexOf(storm.category) === -1
      )
        return false;
      if (filters.area && storm.location.indexOf(filters.area) === -1)
        return false;
      return true;
    });

    updateStats(filtered, filters);
    lastFiltered = filtered;
    currentPage = 1;
    renderTable(filtered);
  }

  function updateStats(filtered, filters) {
    const total = filtered.length;
    const spanYears = filters.maxYear - filters.minYear + 1;
    const average = spanYears > 0 ? total / spanYears : 0;

    statTotal.textContent = total;
    statTotalSub.textContent =
      filters.minYear === 2010 && filters.maxYear === 2020
        ? "2010–2020"
        : filters.minYear + "–" + filters.maxYear;
    statLandfall.textContent = total; // all recorded storms made landfall
    statAverage.textContent = average.toFixed(1);
  }

  function renderTable(filtered) {
    tbody.innerHTML = "";

    if (filtered.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.className = "empty-row";
      emptyRow.innerHTML =
        '<td colspan="10">No cyclones match the selected filters.</td>';
      tbody.appendChild(emptyRow);
      updatePagination(filtered);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * PAGE_SIZE;
    const pageRows = filtered.slice(start, start + PAGE_SIZE);

    pageRows.forEach((storm) => {
      const meta = CATEGORIES[storm.category] || {
        color: "#64748b",
        bg: "#f1f5f9",
      };

      const row = document.createElement("tr");

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
        storm.affected.toLocaleString(),
        null, // damage handled separately
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

      // Damage value
      const damageTd = row.children[8];
      const damage = document.createElement("span");
      damage.className = "damage-value";
      damage.textContent = storm.damage;
      damageTd.appendChild(damage);

      // Action button
      const actionTd = document.createElement("td");
      const actionBtn = document.createElement("button");
      actionBtn.type = "button";
      actionBtn.className = "row-action";
      actionBtn.setAttribute("aria-label", "View details for " + storm.name);
      actionBtn.innerHTML =
        '<svg viewBox="0 0 24 24" width="17" height="17" fill="none">' +
        '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" stroke="currentColor" stroke-width="1.8"/>' +
        '<circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.8"/>' +
        "</svg>";
      actionBtn.addEventListener("click", () => toggleDetailRow(row, storm));
      actionTd.appendChild(actionBtn);
      row.appendChild(actionTd);

      tbody.appendChild(row);
    });

    updatePagination(filtered);
  }

  function toggleDetailRow(row, storm) {
    const existing = row.nextElementSibling;
    if (existing && existing.classList.contains("detail-row")) {
      existing.remove();
      return;
    }
    tbody.querySelectorAll(".detail-row").forEach((r) => r.remove());

    const detail = document.createElement("tr");
    detail.className = "detail-row";
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.className = "detail-cell";
    cell.innerHTML =
      '<div class="detail-inner">' +
      "<strong>" + storm.name + "</strong> — " + storm.category + " (" + storm.year + "). " +
      "Made landfall over <strong>" + storm.location + "</strong> on " + storm.date +
      " with maximum sustained winds of <strong>" + storm.wind + " km/h</strong> and " +
      "an estimated rainfall of <strong>" + storm.rainfall.toFixed(1) + " mm</strong>. " +
      "Around <strong>" + storm.affected.toLocaleString() + " persons</strong> were affected, " +
      "with damages pegged at <strong>" + storm.damage + "</strong>. " +
      "Source: PAGASA tropical cyclone archives." +
      "</div>";
    detail.appendChild(cell);
    row.after(detail);
  }

  function updatePagination(filtered) {
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    pageInfo.textContent =
      total === 0 ? "0 of 0" : start + "–" + end + " of " + total;
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }

  function clearFilters() {
    yearMinInput.value = 2010;
    yearMaxInput.value = 2020;
    areaSelect.value = "";
    categoryList
      .querySelectorAll("input[type=checkbox]")
      .forEach((c) => (c.checked = false));
    updateRangeUI();
    applyFilters();
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------
  function init() {
    buildCategoryList();
    buildAreaOptions();
    updateRangeUI();
    applyFilters();

    yearMinInput.addEventListener("input", () => {
      updateRangeUI();
      applyFilters();
    });
    yearMaxInput.addEventListener("input", () => {
      updateRangeUI();
      applyFilters();
    });
    categoryList.addEventListener("change", applyFilters);
    areaSelect.addEventListener("change", applyFilters);
    applyBtn.addEventListener("click", applyFilters);
    clearBtn.addEventListener("click", clearFilters);

    prevBtn.addEventListener("click", () => {
      if (currentPage > 1) {
        currentPage -= 1;
        renderTable(lastFiltered);
      }
    });
    nextBtn.addEventListener("click", () => {
      const totalPages = Math.max(1, Math.ceil(lastFiltered.length / PAGE_SIZE));
      if (currentPage < totalPages) {
        currentPage += 1;
        renderTable(lastFiltered);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
