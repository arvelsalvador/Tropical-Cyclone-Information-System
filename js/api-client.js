// ===========================================================================
// TCIS shared API client (Step 2 quality).
// Single source of truth for: endpoint URLs, fetch-with-timeout, row mapping,
// date formatting, count-up animation, HTML escaping, and bulletin URL check.
// Load BEFORE page scripts: api-client.js -> storm-category.js -> page script.
// Exposes window.TCIS_API.
// ===========================================================================

(function () {
  "use strict";

  // All pages serve under /Weather on XAMPP; '' in prod at domain root.
  // Pages may override via <script data-tcis-base="..."> on the api-client tag.
  function basePrefix() {
    var tag = document.querySelector('script[src*="api-client.js"]');
    if (tag && tag.getAttribute("data-tcis-base") != null) {
      return tag.getAttribute("data-tcis-base");
    }
    return "/Weather";
  }

  var BASE = basePrefix();
  var CYCLONES_URL = BASE + "/api/get_cyclones.php";
  var BULLETINS_URL = BASE + "/api/get_bulletins.php?cyclone_id=";

  // DB abbreviations -> full PAGASA display names (was CATEGORY_MAP x2).
  var CATEGORY_MAP = {
    TD: "Tropical Depression",
    TS: "Tropical Storm",
    STS: "Severe Tropical Storm",
    TY: "Typhoon",
    STY: "Super Typhoon",
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Stored as "sustained/gust" (e.g. "185/230") — sustained drives stats.
  function parseSustained(strength) {
    if (!strength) return null;
    var n = parseInt(String(strength).split("/")[0], 10);
    return isNaN(n) ? null : n;
  }

  function categoryFull(abbrev) {
    if (!abbrev) return "—";
    return CATEGORY_MAP[abbrev] || abbrev;
  }

  // "Apr 12 – Apr 14" (historical table style). Analysis page appends year.
  function formatDateRange(startStr, endStr, withYear) {
    if (!startStr) return "—";
    var opts = { month: "short", day: "numeric" };
    var start = new Date(startStr + "T00:00:00");
    var startText = start.toLocaleDateString("en-US", opts);
    if (!endStr) {
      return withYear ? startText + ", " + start.getFullYear() : startText;
    }
    var end = new Date(endStr + "T00:00:00");
    var endText = end.toLocaleDateString("en-US", opts);
    var out = startText + " \u2013 " + endText;
    return withYear ? out + ", " + start.getFullYear() : out;
  }

  function toTitleCase(s) {
    return String(s)
      .toLowerCase()
      .replace(/(?:^|[\s-(/])\S/g, function (c) { return c.toUpperCase(); });
  }

  // Title-case local part, keep international part verbatim.
  function stormDisplayName(raw) {
    raw = String(raw || "");
    var paren = raw.indexOf(" (");
    if (paren === -1) return toTitleCase(raw);
    return toTitleCase(raw.slice(0, paren)) + raw.slice(paren);
  }

  // fetch with 15s timeout so skeletons never spin forever on a hung DB.
  function fetchJson(url, opts) {
    var controller = ("AbortController" in window) ? new AbortController() : null;
    var timer = null;
    if (controller) {
      timer = setTimeout(function () { controller.abort(); }, 15000);
    }
    var init = { signal: controller ? controller.signal : undefined };
    if (opts) {
      for (var k in opts) {
        if (Object.prototype.hasOwnProperty.call(opts, k)) init[k] = opts[k];
      }
    }
    return fetch(url, init).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error("Request failed: " + res.status);
      return res.json();
    }).then(function (data) {
      if (!Array.isArray(data)) throw new Error("Unexpected API response");
      return data;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      throw err;
    });
  }

  function animateStat(el, target, decimals) {
    if (!el) return;
    var reduce = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      el._value = target;
      el.textContent = Number(target).toFixed(decimals);
      return;
    }
    if (el._raf) cancelAnimationFrame(el._raf);
    var from = (typeof el._value === "number") ? el._value : 0;
    var duration = 900;
    var t0 = performance.now();
    function frame(now) {
      var progress = Math.min(1, (now - t0) / duration);
      var eased = 1 - Math.pow(1 - progress, 3); /* ease-out cubic */
      var value = from + (target - from) * eased;
      el._value = value;
      el.textContent = value.toFixed(decimals);
      if (progress < 1) el._raf = requestAnimationFrame(frame);
    }
    el._raf = requestAnimationFrame(frame);
  }

  // Client mirror of the server allowlist: only http(s) bulletin URLs load.
  function isSafeBulletinUrl(url) {
    return typeof url === "string" && /^https?:\/\//i.test(url);
  }

  // --- Caching (Step 3 performance) -------------------------------------
  // Cyclone records rarely change: 1hr sessionStorage cache shared across
  // Home -> Historical -> Analysis (was 3 identical full-table downloads).
  // Bulletins: per-page-load memo per cyclone_id + shared in-flight promise
  // (Historical refetched on every modal open; Analysis on every switch-back).
  var CYCLONE_CACHE_KEY = "tcis_cyclones_v1";
  var CYCLONE_TTL_MS = 3600 * 1000;
  var cycloneInflight = null;
  var bulletinInflight = {};
  var bulletinMemo = {};

  function readCycloneCache() {
    try {
      var raw = sessionStorage.getItem(CYCLONE_CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.data) || !parsed.t) return null;
      if (Date.now() - parsed.t > CYCLONE_TTL_MS) return null;
      return parsed.data;
    } catch (e) {
      return null;
    }
  }

  function writeCycloneCache(data) {
    try {
      sessionStorage.setItem(CYCLONE_CACHE_KEY, JSON.stringify({ t: Date.now(), data: data }));
    } catch (e) {}
  }

  function fetchCyclones() {
    var cached = readCycloneCache();
    if (cached) return Promise.resolve(cached);
    if (cycloneInflight) return cycloneInflight;
    cycloneInflight = fetchJson(CYCLONES_URL).then(function (data) {
      writeCycloneCache(data);
      cycloneInflight = null;
      return data;
    }).catch(function (err) {
      cycloneInflight = null;
      throw err;
    });
    return cycloneInflight;
  }

  function fetchBulletins(cycloneId) {
    var key = String(cycloneId);
    if (bulletinMemo[key]) return Promise.resolve(bulletinMemo[key]);
    if (bulletinInflight[key]) return bulletinInflight[key];
    bulletinInflight[key] = fetchJson(BULLETINS_URL + encodeURIComponent(key)).then(function (data) {
      bulletinMemo[key] = data;
      bulletinInflight[key] = null;
      return data;
    }).catch(function (err) {
      bulletinInflight[key] = null;
      throw err;
    });
    return bulletinInflight[key];
  }

  function debounce(fn, ms) {
    var t = null;
    return function () {
      var args = arguments;
      var self = this;
      if (t) clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms);
    };
  }

  window.TCIS_API = {
    BASE: BASE,
    CYCLONES_URL: CYCLONES_URL,
    BULLETINS_URL: BULLETINS_URL,
    CATEGORY_MAP: CATEGORY_MAP,
    escapeHtml: escapeHtml,
    parseSustained: parseSustained,
    categoryFull: categoryFull,
    formatDateRange: formatDateRange,
    toTitleCase: toTitleCase,
    stormDisplayName: stormDisplayName,
    fetchJson: fetchJson,
    fetchCyclones: fetchCyclones,
    fetchBulletins: fetchBulletins,
    animateStat: animateStat,
    isSafeBulletinUrl: isSafeBulletinUrl,
    debounce: debounce,
  };
})();
