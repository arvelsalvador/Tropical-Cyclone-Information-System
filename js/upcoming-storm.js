// Tropical Cyclone Information System — upcoming storm data loader
// Loads the admin-managed upcoming storm profile (the single row of the
// `upcoming_storm` table, edited via admin/edit-storm.php) and fills every
// element carrying a data-us attribute with the matching field value.
// The static markup in the HTML serves as the demo/fallback profile, shown
// when the API is unreachable or the admin has not saved a storm yet.
(function () {
  "use strict";

  // Config
  const API_URL = "/Weather/api/get_upcoming_storm.php"; // adjust path if needed

  // None-mode elements: the storm profile block and the "no active storm"
  // message. The profile wrapper starts hidden in the HTML; the loader
  // reveals whichever matches the API response.
  const stormSection = document.getElementById("upcomingStormSection");
  const emptyState = document.getElementById("upcomingEmpty");

  function formatLandfall(value) {
    if (!value) return "";
    const date = new Date(value + "T00:00:00");
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  // Maps a data-us key on an element to the value from the upcoming storm row.
  function resolve(key, row) {
    switch (key) {
      case "wind":
        return row.max_wind ? row.max_wind + " km/h" : "";
      case "movement_speed":
        return row.movement_speed ? row.movement_speed + " km/h" : "";
      case "pressure":
        return row.central_pressure ? row.central_pressure + " hPa" : "";
      case "landfall":
        return formatLandfall(row.forecast_landfall_date);
      default:
        return row[key] || "";
    }
  }

  async function load() {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return await res.json();
    } catch (err) {
      console.error("Could not load upcoming storm profile:", err);
      return null;
    }
  }

  // Reveals the storm profile and hides the empty-state message.
  function showStormState() {
    if (stormSection) stormSection.classList.remove("upcoming-hidden");
    if (emptyState) emptyState.classList.add("upcoming-hidden");
  }

  // Reveals the "no active storm" message and hides the storm profile.
  function showEmptyState() {
    if (stormSection) stormSection.classList.add("upcoming-hidden");
    if (emptyState) emptyState.classList.remove("upcoming-hidden");
  }

  // Fills every [data-us] element on the page with values from `row`.
  function apply(row) {
    if (!row) {
      showEmptyState();
      return;
    }

    // Reveal + fill happen in the same synchronous frame, so the profile
    // (which is hidden in the static HTML) never flashes stale demo content.
    showStormState();
    document.querySelectorAll("[data-us]").forEach((el) => {
      const key = el.getAttribute("data-us");

      // Advisory notes render as a bullet list — one <li> per line.
      if (key === "advisory_list") {
        const lines = String(row.advisory_notes || "")
          .split(/\r?\n/)
          .filter((line) => line.trim() !== "");
        el.innerHTML = "";
        if (!lines.length) return;
        lines.forEach((line) => {
          const li = document.createElement("li");
          li.textContent = line;
          el.appendChild(li);
        });
        return;
      }

      const value = resolve(key, row);
      if (value !== "") el.textContent = value;
    });
  }

  function run() {
    load().then(apply);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
