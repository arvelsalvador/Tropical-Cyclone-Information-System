// Visitor-entered Upcoming Storm state shared across same-tab page navigation.
(function () {
  "use strict";

  const STORAGE_KEY = "weather.upcomingStorm.v1";
  const navigation = performance.getEntriesByType("navigation")[0];

  // A reload starts a fresh experiment; ordinary same-tab navigation keeps it.
  if (navigation && navigation.type === "reload") {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function normalize(value) {
    if (!value || typeof value !== "object") return null;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const wind = Number(value.wind);
    const category = typeof value.category === "string" ? value.category.trim() : "";
    if (!name || !Number.isFinite(wind) || !category) return null;
    return { name: name, wind: Math.round(wind), category: category };
  }

  function read() {
    try {
      return normalize(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null"));
    } catch (error) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function write(value) {
    const storm = normalize(value);
    if (!storm) return null;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(storm));
    return storm;
  }

  function clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function renderCards() {
    const storm = read();
    document.querySelectorAll("[data-upcoming-storm-card]").forEach((card) => {
      const empty = card.querySelector("[data-upcoming-empty]");
      const details = card.querySelector("[data-upcoming-details]");
      if (!storm) {
        if (empty) empty.hidden = false;
        if (details) details.hidden = true;
        return;
      }
      if (empty) empty.hidden = true;
      if (details) details.hidden = false;
      const values = {
        name: storm.name,
        wind: storm.wind + " km/h",
        category: storm.category,
      };
      Object.keys(values).forEach((key) => {
        const node = card.querySelector('[data-upcoming-value="' + key + '"]');
        if (node) node.textContent = values[key];
      });
    });
  }

  window.UpcomingStormState = { read: read, write: write, clear: clear };
  window.UpcomingStormState.renderCards = renderCards;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderCards);
  } else {
    renderCards();
  }
})();
