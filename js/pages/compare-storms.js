// Tropical Cyclone Information System — Compare Storms page
// Renders the upcoming storm profile's historical analogues, wires the
// comparison controls (strength / direction), and renders the results table.

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Upcoming storm (demo profile) + historical dataset (PAGASA records)
  // ---------------------------------------------------------------------
  const UPCOMING = {
    name: "TY ODIN",
    wind: 185,
    rainfall: 260,
    pressure: 965,
    direction: "WNW",
  };

  const CATEGORY_RANK = {
    "Tropical Depression": 1,
    "Tropical Storm": 2,
    "Severe Tropical Storm": 3,
    Typhoon: 4,
    "Super Typhoon": 5,
  };

  const STORMS = [
    { name: "Typhoon Rolly (Goni)", year: 2020, category: "Super Typhoon", date: "Nov 1, 2020", location: "Mercedes, Camarines Norte", wind: 225, rainfall: 350.2, pressure: 905, direction: "WSW" },
    { name: "Typhoon Ulysses (Vamco)", year: 2020, category: "Typhoon", date: "Nov 11, 2020", location: "Daet, Camarines Norte", wind: 155, rainfall: 240.0, pressure: 965, direction: "WNW" },
    { name: "Typhoon Quinta (Molave)", year: 2020, category: "Typhoon", date: "Oct 25, 2020", location: "Paracale, Camarines Norte", wind: 185, rainfall: 290.5, pressure: 950, direction: "WNW" },
    { name: "Typhoon Ambo (Vongfong)", year: 2020, category: "Typhoon", date: "May 14, 2020", location: "San Vicente, Camarines Norte", wind: 155, rainfall: 210.0, pressure: 975, direction: "NW" },
    { name: "Typhoon Tisoy (Kammuri)", year: 2019, category: "Typhoon", date: "Dec 3, 2019", location: "Daet, Camarines Norte", wind: 175, rainfall: 265.0, pressure: 955, direction: "W" },
    { name: "Typhoon Ursula (Phanfone)", year: 2019, category: "Typhoon", date: "Dec 25, 2019", location: "Vinzons, Camarines Norte", wind: 150, rainfall: 180.4, pressure: 980, direction: "WNW" },
    { name: "Typhoon Rosita (Yutu)", year: 2018, category: "Typhoon", date: "Oct 30, 2018", location: "Santa Elena, Camarines Norte", wind: 160, rainfall: 195.6, pressure: 970, direction: "NW" },
    { name: "Typhoon Ompong (Mangkhut)", year: 2018, category: "Typhoon", date: "Sept 15, 2018", location: "Bagasbas, Daet", wind: 195, rainfall: 274.1, pressure: 945, direction: "W" },
    { name: "TD Usman", year: 2018, category: "Tropical Depression", date: "Dec 29, 2018", location: "Labo, Camarines Norte", wind: 55, rainfall: 320.8, pressure: 1000, direction: "WNW" },
    { name: "TS Urduja (Kai-tak)", year: 2017, category: "Severe Tropical Storm", date: "Dec 14, 2017", location: "Basud, Camarines Norte", wind: 95, rainfall: 156.0, pressure: 992, direction: "W" },
    { name: "Typhoon Nina (Nock-ten)", year: 2016, category: "Typhoon", date: "Dec 26, 2016", location: "Talisay, Camarines Norte", wind: 205, rainfall: 310.3, pressure: 935, direction: "WSW" },
    { name: "Typhoon Karen (Sarika)", year: 2016, category: "Typhoon", date: "Oct 16, 2016", location: "San Vicente, Camarines Norte", wind: 165, rainfall: 240.7, pressure: 960, direction: "WNW" },
    { name: "Typhoon Lawin (Haima)", year: 2016, category: "Typhoon", date: "Oct 20, 2016", location: "Mercedes, Camarines Norte", wind: 175, rainfall: 150.0, pressure: 955, direction: "NW" },
    { name: "Typhoon Lando (Koppu)", year: 2015, category: "Typhoon", date: "Oct 18, 2015", location: "Santa Elena, Camarines Norte", wind: 170, rainfall: 230.9, pressure: 960, direction: "N" },
    { name: "Typhoon Nona (Melor)", year: 2015, category: "Typhoon", date: "Dec 14, 2015", location: "Mercedes, Camarines Norte", wind: 175, rainfall: 250.6, pressure: 955, direction: "WNW" },
    { name: "TS Amang (Mekkhala)", year: 2015, category: "Tropical Storm", date: "Jan 18, 2015", location: "Basud, Camarines Norte", wind: 85, rainfall: 130.2, pressure: 995, direction: "NW" },
    { name: "Typhoon Glenda (Rammasun)", year: 2014, category: "Typhoon", date: "Jul 16, 2014", location: "Daet, Camarines Norte", wind: 185, rainfall: 220.5, pressure: 950, direction: "WNW" },
    { name: "TS Mario (Fung-wong)", year: 2014, category: "Tropical Storm", date: "Sep 19, 2014", location: "Vinzons, Camarines Norte", wind: 85, rainfall: 160.4, pressure: 995, direction: "NNW" },
    { name: "TS Maring (Trami)", year: 2013, category: "Tropical Storm", date: "Aug 19, 2013", location: "Labo, Camarines Norte", wind: 85, rainfall: 185.0, pressure: 995, direction: "N" },
    { name: "TS Salome", year: 2013, category: "Tropical Storm", date: "Jul 17, 2013", location: "Paracale, Camarines Norte", wind: 85, rainfall: 142.3, pressure: 998, direction: "NNW" },
    { name: "Typhoon Labuyo (Utor)", year: 2013, category: "Typhoon", date: "Aug 12, 2013", location: "Santa Elena, Camarines Norte", wind: 165, rainfall: 175.2, pressure: 960, direction: "WNW" },
    { name: "Typhoon Santi (Nari)", year: 2013, category: "Typhoon", date: "Oct 12, 2013", location: "Capalonga, Camarines Norte", wind: 150, rainfall: 205.8, pressure: 970, direction: "W" },
    { name: "Typhoon Pedring (Nesat)", year: 2011, category: "Typhoon", date: "Sep 27, 2011", location: "Mercedes, Camarines Norte", wind: 175, rainfall: 210.7, pressure: 955, direction: "WNW" },
    { name: "Typhoon Quiel (Nalgae)", year: 2011, category: "Typhoon", date: "Oct 1, 2011", location: "Labo, Camarines Norte", wind: 160, rainfall: 185.4, pressure: 965, direction: "NW" },
    { name: "Typhoon Juan (Megi)", year: 2010, category: "Super Typhoon", date: "Oct 18, 2010", location: "Vinzons, Camarines Norte", wind: 225, rainfall: 190.3, pressure: 905, direction: "NW" },
    { name: "Typhoon Basyang (Conson)", year: 2010, category: "Typhoon", date: "Jul 14, 2010", location: "Daet, Camarines Norte", wind: 130, rainfall: 145.6, pressure: 985, direction: "WNW" },
    { name: "Typhoon Carina (Egay)", year: 2023, category: "Typhoon", date: "Jul 24, 2023", location: "Daet, Camarines Norte", wind: 185, rainfall: 345.0, pressure: 950, direction: "WNW" },
  ];

  const RANK_STYLES = [
    { label: "Best Match", color: "#7c3aed" },
    { label: "2nd Match", color: "#64748b" },
    { label: "3rd Match", color: "#b45309" },
  ];

  const DIRECTION_POINTS = {
    N: 0,
    NNW: 337.5,
    NW: 315,
    WNW: 292.5,
    W: 270,
    WSW: 247.5,
    SW: 225,
  };

  // ---------------------------------------------------------------------
  // Element references
  // ---------------------------------------------------------------------
  const analogueList = document.getElementById("analogueList");
  const stormA = document.getElementById("stormA");
  const stormB = document.getElementById("stormB");
  const compareBtn = document.getElementById("compareNowBtn");
  const resetBtn = document.getElementById("resetBtn");
  const modeButtons = document.querySelectorAll(".mode-btn");
  const resultsTabs = document.querySelectorAll(".results-tab");
  const verdictEl = document.getElementById("resultsVerdict");
  const tableBody = document.getElementById("resultsTableBody");
  const colAHead = document.getElementById("colAHead");
  const colBHead = document.getElementById("colBHead");

  let currentMode = "strength";

  // ---------------------------------------------------------------------
  // Analogue matching — similarity of each historical storm to the upcoming one
  // ---------------------------------------------------------------------
  function similarity(storm) {
    const windScore = Math.max(0, 1 - Math.abs(storm.wind - UPCOMING.wind) / 140);
    const rainScore = Math.max(0, 1 - Math.abs(storm.rainfall - UPCOMING.rainfall) / 200);
    const pressureScore = Math.max(
      0,
      1 - Math.abs(storm.pressure - UPCOMING.pressure) / 95
    );
    const raw = windScore * 0.45 + rainScore * 0.25 + pressureScore * 0.3;
    return Math.round(Math.min(0.97, Math.max(0.4, raw)) * 100);
  }

  function awardSvg(color) {
    return (
      '<svg viewBox="0 0 24 24" width="19" height="19" fill="none">' +
      '<circle cx="12" cy="9" r="5.5" stroke="#fff" stroke-width="1.8"/>' +
      '<path d="M9.5 13.5L8 21l4-2.2L16 21l-1.5-7.5" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M10.2 8.8l1.3 1.3 2.4-2.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      "</svg>"
    );
  }

  function renderAnalogues() {
    analogueList.innerHTML = "";

    STORMS.map((storm) => ({ storm, score: similarity(storm) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .forEach((match, index) => {
        const style = RANK_STYLES[index];
        const row = document.createElement("div");
        row.className =
          "analogue-row" + (index === 0 ? " best-match" : "");

        const icon = document.createElement("div");
        icon.className = "rank-icon";
        icon.style.background = style.color;
        icon.innerHTML = awardSvg();

        const info = document.createElement("div");
        info.className = "analogue-info";
        info.innerHTML =
          '<span class="analogue-match-label">' + style.label + "</span>" +
          '<div class="analogue-name">' + match.storm.name + "</div>" +
          '<div class="analogue-date">' + match.storm.date + "</div>";

        const sim = document.createElement("div");
        sim.className = "analogue-similarity";
        sim.innerHTML =
          "<strong>" + match.score + "%</strong><small>Similarity</small>";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "analogue-view-btn";
        btn.textContent = "View Comparison";
        btn.addEventListener("click", () => {
          stormA.value = match.storm.name;
          runCompare();
          document
            .getElementById("resultsCard")
            .scrollIntoView({ behavior: "smooth", block: "start" });
        });

        row.appendChild(icon);
        row.appendChild(info);
        row.appendChild(sim);
        row.appendChild(btn);
        analogueList.appendChild(row);
      });
  }

  // ---------------------------------------------------------------------
  // Comparison
  // ---------------------------------------------------------------------
  function directionDelta(a, b) {
    const pa = DIRECTION_POINTS[a] !== undefined ? DIRECTION_POINTS[a] : 0;
    const pb = DIRECTION_POINTS[b] !== undefined ? DIRECTION_POINTS[b] : 0;
    let diff = Math.abs(pa - pb);
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  function trackSimilarityTag(storm) {
    const delta = directionDelta(storm.direction, UPCOMING.direction);
    if (delta <= 22.5) return { text: "High", color: "#15803d", bg: "#ecfdf5" };
    if (delta <= 45) return { text: "Moderate", color: "#b45309", bg: "#fef3c7" };
    return { text: "Low", color: "#b91c1c", bg: "#fee2e2" };
  }

  function row(label, valueA, valueB, winner) {
    // winner: 0 = none, 1 = A, 2 = B
    const aHtml =
      winner === 1
        ? '<span class="value-winner">' + valueA + "</span>"
        : valueA;
    const bHtml =
      winner === 2
        ? '<span class="value-winner">' + valueB + "</span>"
        : valueB;
    return (
      "<tr><td class=\"metric-col\">" + label + "</td><td>" + aHtml +
      "</td><td>" + bHtml + "</td></tr>"
    );
  }

  function tagCellHtml(value) {
    return (
      '<span class="value-tag" style="color:' + value.color +
      ";background:" + value.bg + '">' + value.text + "</span>"
    );
  }

  function runCompare() {
    const nameA = stormA.value;
    const nameB = stormB.value;
    if (!nameA) return;

    const a = STORMS.find((s) => s.name === nameA);
    const b = nameB ? STORMS.find((s) => s.name === nameB) : null;
    if (!a) return;

    colAHead.textContent = a.name;
    colBHead.textContent = b ? b.name : "TY ODIN (Upcoming)";

    if (currentMode === "strength") {
      renderStrength(a, b);
    } else {
      renderDirection(a, b);
    }
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
        " the incoming <strong>TY ODIN</strong>.";
    }

    const windWinner = !b ? (a.wind >= UPCOMING.wind ? 1 : 2) : a.wind > b.wind ? 1 : a.wind < b.wind ? 2 : 0;
    const rainWinner = !b ? (a.rainfall >= UPCOMING.rainfall ? 1 : 2) : a.rainfall > b.rainfall ? 1 : a.rainfall < b.rainfall ? 2 : 0;
    const pressureWinner = !b
      ? a.pressure <= UPCOMING.pressure ? 1 : 2
      : a.pressure < b.pressure ? 1 : a.pressure > b.pressure ? 2 : 0;

    html += row("Maximum Sustained Winds", a.wind + " km/h", b ? b.wind + " km/h" : UPCOMING.wind + " km/h", windWinner);
    html += row("Rainfall (24-hr Max)", a.rainfall.toFixed(1) + " mm", b ? b.rainfall.toFixed(1) + " mm" : UPCOMING.rainfall.toFixed(1) + " mm", rainWinner);
    html += row("Central Pressure", a.pressure + " hPa", b ? b.pressure + " hPa" : UPCOMING.pressure + " hPa", pressureWinner);

    const catRank = (x, y) =>
      CATEGORY_RANK[x] > CATEGORY_RANK[y] ? 1 : CATEGORY_RANK[x] < CATEGORY_RANK[y] ? 2 : 0;
    const catB = b ? b.category : "Typhoon (est.)";
    html += row("PAGASA Category", a.category, catB, b ? catRank(a.category, b.category) : catRank(a.category, "Typhoon"));

    tableBody.innerHTML = html;
    verdictEl.innerHTML = verdict;
  }

  function renderDirection(a, b) {
    let html = "";
    const tagA = trackSimilarityTag(a);
    const tagB = b ? trackSimilarityTag(b) : trackSimilarityTag(UPCOMING);

    html += row("Track Direction", a.direction, b ? b.direction : UPCOMING.direction, 0);
    html += row("Landfall Location", a.location, b ? b.location : "Forecast: Aurora–Quezon area", 0);
    html += row("Landfall Date", a.date, b ? b.date : "May 26, 2025", 0);
    html += row("PAGASA Category", a.category, b ? b.category : "Typhoon (est.)", 0);
    html +=
      "<tr><td class=\"metric-col\">Track Similarity to TY ODIN</td><td>" +
      tagCellHtml(tagA) + "</td><td>" + tagCellHtml(tagB) + "</td></tr>";

    let verdict;
    if (b) {
      const deltaA = directionDelta(a.direction, UPCOMING.direction);
      const deltaB = directionDelta(b.direction, UPCOMING.direction);
      verdict =
        deltaA === deltaB
          ? "Both storms followed tracks similarly close to <strong>TY ODIN</strong>."
          : "<strong>" +
            (deltaA < deltaB ? a.name : b.name) +
            "</strong> followed a track more similar to the incoming <strong>TY ODIN</strong>.";
    } else {
      verdict =
        "<strong>" + a.name + "</strong> moved " + a.direction +
        " — " +
        (tagA.text === "High"
          ? "very close to"
          : tagA.text === "Moderate"
            ? "moderately close to"
            : "quite different from") +
        " TY ODIN's WNW track.";
    }

    tableBody.innerHTML = html;
    verdictEl.innerHTML = verdict;
  }

  function runCompareSafe() {
    if (!stormA.value) {
      verdictEl.textContent = "Select at least one historical storm to compare.";
      tableBody.innerHTML = "";
      colAHead.textContent = "—";
      colBHead.textContent = "—";
      return;
    }
    runCompare();
  }

  function setMode(mode) {
    currentMode = mode;
    modeButtons.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.mode === mode)
    );
    resultsTabs.forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.mode === mode)
    );
    runCompareSafe();
  }

  function resetControls() {
    stormA.value = "Typhoon Carina (Egay)";
    stormB.value = "Typhoon Rolly (Goni)";
    currentMode = "strength";
    modeButtons.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.mode === "strength")
    );
    resultsTabs.forEach((tab) =>
      tab.classList.toggle("active", tab.dataset.mode === "strength")
    );
    runCompareSafe();
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  function buildSelects() {
    [stormA, stormB].forEach((select) => {
      STORMS.forEach((storm) => {
        const option = document.createElement("option");
        option.value = storm.name;
        option.textContent =
          storm.name + "  ·  " + storm.year;
        select.appendChild(option);
      });
      if (select === stormB) {
        const none = document.createElement("option");
        none.value = "";
        none.textContent = "— None (compare with TY ODIN) —";
        select.insertBefore(none, select.firstChild);
      }
    });
  }

  function init() {
    buildSelects();
    renderAnalogues();

    stormA.addEventListener("change", runCompareSafe);
    stormB.addEventListener("change", runCompareSafe);
    compareBtn.addEventListener("click", runCompareSafe);
    resetBtn.addEventListener("click", resetControls);
    modeButtons.forEach((btn) =>
      btn.addEventListener("click", () => setMode(btn.dataset.mode))
    );
    resultsTabs.forEach((tab) =>
      tab.addEventListener("click", () => setMode(tab.dataset.mode))
    );

    resetControls();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
