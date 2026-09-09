// Tropical Cyclone Information System — home page "Historical Typhoon Overview"
// Fills the overview card on index.html with live, summarized figures computed
// from the SAME source as the Historical Data page (api/get_cyclones.php):
//   - Total cyclones (+ the year range they span)
//   - Max wind (strongest sustained wind, with the storm's name)
//   - Average per year
//   - Highlights: busiest year, strongest storm, most recent cyclone
// The static numbers in the HTML are only neutral placeholders ("0"/"—");
// every displayed value comes from the database so the overview can never
// drift away from the Historical Data page again.
(function () {
  "use strict";

  // Config — same endpoint and row mapping as js/pages/historical-data.js
  const API_URL = "/Weather/api/get_cyclones.php"; // adjust path if needed

  // ---------------------------------------------------------------------
  // Element references
  // ---------------------------------------------------------------------
  const statTotal = document.getElementById("statTotal");
  const statTotalSub = document.getElementById("statTotalSub");
  const statMaxWind = document.getElementById("statMaxWind");
  const statMaxWindSub = document.getElementById("statMaxWindSub");
  const statAverage = document.getElementById("statAverage");
  const overviewYearRange = document.getElementById("overviewYearRange");
  const featureYearRange = document.getElementById("featureYearRange");
  const hlBusiest = document.getElementById("hlBusiest");
  const hlStrongest = document.getElementById("hlStrongest");
  const hlRecent = document.getElementById("hlRecent");

  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------------
  // Row mapping (mirrors js/pages/historical-data.js)
  // ---------------------------------------------------------------------
  function mapRow(row) {
    const local = row.local_name || row.international_name || "Unnamed";
    const name = row.international_name
      ? local + " (" + row.international_name + ")"
      : local;

    let wind = null;
    if (row.highest_strength) {
      // Stored as "sustained/gust", e.g. "185/230" — the sustained value is
      // what the Historical Data page's Max Wind stat shows.
      const parsed = parseInt(String(row.highest_strength).split("/")[0], 10);
      if (!isNaN(parsed)) wind = parsed;
    }

    return {
      name: name,
      localName: local,
      year: parseInt(row.year, 10),
      dateStart: row.date_start || null,
      wind: wind,
    };
  }

  // ---------------------------------------------------------------------
  // Count-up animation (same easing as js/pages/historical-data.js)
  // ---------------------------------------------------------------------
  function animateStat(el, target, decimals) {
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

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  // The static markup holds neutral placeholders, so on failure we show an
  // honest "unavailable" state instead of stale numbers that look real.
  function showError() {
    if (statTotal) statTotal.textContent = "\u2014";
    if (statTotalSub) statTotalSub.textContent = "unavailable";
    if (statMaxWind) statMaxWind.textContent = "\u2014";
    if (statMaxWindSub) statMaxWindSub.textContent = "unavailable";
    if (statAverage) statAverage.textContent = "\u2014";
    [overviewYearRange, featureYearRange, hlBusiest, hlStrongest, hlRecent]
      .forEach(function (el) {
        if (el) el.textContent = "\u2014";
      });
  }

  function render(storms) {
    if (storms.length === 0) {
      showError();
      return;
    }

    const years = storms.map(function (s) {
      return s.year;
    });
    const yearMin = Math.min.apply(null, years);
    const yearMax = Math.max.apply(null, years);
    const spanYears = yearMax - yearMin + 1;
    const range = yearMin + "\u2013" + yearMax;

    // Total + average — same math as the Historical Data page stat cards.
    animateStat(statTotal, storms.length, 0);
    if (statTotalSub) statTotalSub.textContent = range;
    animateStat(statAverage, storms.length / spanYears, 1);

    // Strongest storm by sustained wind (rows without wind data are skipped).
    const strongest = storms.reduce(function (best, s) {
      if (s.wind == null) return best;
      if (!best || s.wind > best.wind) return s;
      return best;
    }, null);

    if (strongest) {
      animateStat(statMaxWind, strongest.wind, 0);
      const strongestText =
        strongest.name + " \u00b7 " + strongest.wind + " km/h";
      if (statMaxWindSub) statMaxWindSub.textContent = strongestText;
      if (hlStrongest) hlStrongest.textContent = strongestText;
    } else {
      if (statMaxWind) statMaxWind.textContent = "\u2014";
      if (statMaxWindSub) statMaxWindSub.textContent = "no wind data recorded";
      if (hlStrongest) hlStrongest.textContent = "\u2014";
    }

    // Busiest year (ties go to the most recent year).
    const countsByYear = {};
    storms.forEach(function (s) {
      countsByYear[s.year] = (countsByYear[s.year] || 0) + 1;
    });
    let busiestYear = null;
    let busiestCount = 0;
    Object.keys(countsByYear).forEach(function (key) {
      const year = parseInt(key, 10);
      const count = countsByYear[key];
      if (
        count > busiestCount ||
        (count === busiestCount && year > busiestYear)
      ) {
        busiestYear = year;
        busiestCount = count;
      }
    });
    if (hlBusiest && busiestYear != null) {
      hlBusiest.textContent =
        busiestYear +
        " \u00b7 " +
        busiestCount +
        " cyclone" +
        (busiestCount === 1 ? "" : "s");
    }

    // Most recent cyclone — latest date_start; rows without dates fall back
    // to the year field and order last within the same year.
    const mostRecent = storms.reduce(function (latest, s) {
      if (!latest) return s;
      if (s.dateStart && latest.dateStart) {
        return s.dateStart > latest.dateStart ? s : latest;
      }
      if (s.dateStart) return s;
      if (latest.dateStart) return latest;
      return s.year > latest.year ? s : latest;
    }, null);
    if (hlRecent && mostRecent) {
      hlRecent.textContent =
        mostRecent.localName + " \u00b7 " + mostRecent.year;
    }

    // Keep every year-range mention on the page in sync with the data.
    if (overviewYearRange) overviewYearRange.textContent = range;
    if (featureYearRange) featureYearRange.textContent = range;
  }

  // ---------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------
  async function load() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Request failed: " + res.status);
      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error("Unexpected API response");
      return rows
        .map(mapRow)
        .filter(function (s) {
          return !isNaN(s.year);
        });
    } catch (err) {
      console.error("Could not load cyclone overview:", err);
      return null;
    }
  }

  function run() {
    load().then(function (storms) {
      if (storms === null) {
        showError();
        return;
      }
      render(storms);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();