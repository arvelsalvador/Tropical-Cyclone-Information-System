// ===========================================================================
// Shared storm-classification utility.
//
// Originally extracted from the old admin Upcoming Storm form so the Max
// Wind -> Category auto-suggest and the Historical Cyclone form (Highest
// Strength -> Highest Category auto-select) share ONE copy of the PAGASA
// wind-range thresholds. It is now also used by the public Analysis
// Comparison sandbox. Future changes to the classification only need to
// happen in this file.
//
// Load this file BEFORE each form's inline <script> (both admin pages do).
// Exposes:
//   getCategoryFromStrength(strength) -> "TD" | "TS" | "STS" | "TY" | "STY" | null
//   STORM_CATEGORY_LABELS             -> { TD: "Tropical Depression (TD)", ... }
//
// getCategoryFromStrength takes a max SUSTAINED wind in km/h (number or
// numeric string). It deliberately does NOT parse "sustained/gust" strings —
// each form extracts the sustained part from its own field first.
// ===========================================================================

(function () {
  "use strict";

  // PAGASA wind ranges (km/h, max sustained wind) — the exact values the
  // original admin forms always used, with the TD floor lowered to 30 so
  // weak systems (e.g. 45 km/h) still auto-suggest a category:
  //   below 30  -> unclassified (null)
  //   30 - 88   -> Tropical Depression
  //   89 - 117  -> Tropical Storm
  //   118 - 148 -> Severe Tropical Storm
  //   149 - 184 -> Typhoon
  //   185+      -> Super Typhoon
  var FLOOR = 30;
  var THRESHOLDS = [
    { max: 88,  key: "TD"  },
    { max: 117, key: "TS"  },
    { max: 148, key: "STS" },
    { max: 184, key: "TY"  },
  ];
  var TOP_KEY = "STY";

  // Canonical display labels — the exact strings the Upcoming Storm form's
  // category dropdown saves and both dropdowns display.
  var LABELS = {
    TD:  "Tropical Depression (TD)",
    TS:  "Tropical Storm (TS)",
    STS: "Severe Tropical Storm (STS)",
    TY:  "Typhoon (TY)",
    STY: "Super Typhoon (STY)",
  };

  // Maps a max sustained wind (km/h) to its PAGASA category key.
  // Returns null for empty, non-numeric, or below-floor values so callers
  // can fall back to their dropdown placeholder.
  function getCategoryFromStrength(strength) {
    if (strength === null || strength === undefined || strength === "") return null;
    var n = Number(strength);
    if (isNaN(n) || n < FLOOR) return null;
    for (var i = 0; i < THRESHOLDS.length; i++) {
      if (n <= THRESHOLDS[i].max) return THRESHOLDS[i].key;
    }
    return TOP_KEY;
  }

  window.getCategoryFromStrength = getCategoryFromStrength;
  window.STORM_CATEGORY_LABELS = LABELS;
})();