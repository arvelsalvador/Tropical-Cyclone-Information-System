// TEMP harness — real compare-storms.js (searchable storm pickers) vs live APIs.
const fs = require("fs");
const FILE = "C:/xampp/htdocs/Weather/js/pages/compare-storms.js";
function makeEl(id) {
  const el = {
    id, textContent: "", className: "", disabled: false, style: {}, dataset: {},
    children: [], _listeners: {}, _html: "", _value: "", _sel: 0, checked: false, _classes: [],
    classList: {
      add(...names) { names.forEach((n) => { if (!el._classes.includes(n)) el._classes.push(n); }); },
      remove(...names) { el._classes = el._classes.filter((n) => !names.includes(n)); },
      toggle(name, force) {
        const on = force === undefined ? !el._classes.includes(name) : !!force;
        if (on) el.classList.add(name); else el.classList.remove(name);
        return on;
      },
      contains(n) { return el._classes.includes(n); },
    },
    hasClass(n) { return el._classes.includes(n); },
    appendChild(c) { el.children.push(c); },
    querySelectorAll() { return []; },
    // Return a stub child (not null): renderAnalogues() grabs the score
    // <strong> inside each row via querySelector and writes textContent
    // to it — a null here crashes init before the compare checks run.
    querySelector() { return makeEl("stub"); },
    addEventListener(t, f) { el._listeners[t] = f; },
    setAttribute() {}, focus() {}, scrollIntoView() {}, closest() { return null; },
    fire(t, e) { if (el._listeners[t]) el._listeners[t](e); },
  };
  Object.defineProperty(el, "innerHTML", { get: () => el._html, set(v) { el._html = v; if (v === "") el.children.length = 0; } });
  Object.defineProperty(el, "value", { get: () => el._value, set(v) { el._value = v; } });
  Object.defineProperty(el, "options", { get: () => el.children });
  Object.defineProperty(el, "selectedIndex", {
    get: () => el._sel,
    set(i) { el._sel = i; const o = el.children[i]; el._value = o ? o.value : ""; },
  });
  return el;
}
const els = new Map();
global.window = { matchMedia: () => ({ matches: true }), addEventListener() {} };
global.document = {
  readyState: "complete", activeElement: null, visibilityState: "visible",
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  querySelectorAll() { return []; },
  // Picker shells aren't modelled here: return null so setupPicker()
  // exits without registering pickers.
  querySelector() { return null; },
  createElement(t) { return makeEl("<" + t + ">"); },
  addEventListener() {},
  body: { classList: { add() {}, remove() {} } },
};
const realFetch = global.fetch;
const ABBR_CAT = { TD: "Tropical Depression", TS: "Tropical Storm", STS: "Severe Tropical Storm", TY: "Typhoon", STY: "Super Typhoon" };
global.fetch = (u, o) => realFetch("http://localhost" + u, o);
eval(fs.readFileSync(FILE, "utf8"));
let HAS_UPCOMING = false;
realFetch("http://localhost/Weather/api/get_upcoming_storm.php")
  .then((r) => r.json())
  .then((row) => { HAS_UPCOMING = !!(row && Object.keys(row).length); })
  .catch(() => {});

// Find a live pair with identical max sustained winds AND identical PAGASA
// category — the app's tie rule. Name construction mirrors mapRow().
let TIE_PAIR = null;
let TIE_READY = false;
realFetch("http://localhost/Weather/api/get_cyclones.php")
  .then((r) => r.json())
  .then((rows) => {
    const ABBR = { TD: "Tropical Depression", TS: "Tropical Storm", STS: "Severe Tropical Storm", TY: "Typhoon", STY: "Super Typhoon" };
    const byKey = new Map();
    rows.forEach((row) => {
      const sustained = parseInt(String(row.highest_strength || "").split("/")[0], 10);
      if (isNaN(sustained)) return;
      const name = row.international_name
        ? row.local_name + " (" + row.international_name + ")"
        : row.local_name;
      const category = ABBR[row.highest_category] || row.highest_category;
      const key = sustained + "|" + category;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(name);
    });
    for (const names of byKey.values()) {
      if (names.length >= 2) { TIE_PAIR = [names[0], names[1]]; break; }
    }
  })
  .catch(() => {})
  .finally(() => { TIE_READY = true; });
let failures = 0;
const check = (l, c, x) => { if (!c) failures++; console.log((c ? "PASS " : "FAIL ") + l + (x ? "  [" + x + "]" : "")); };
const timer = setInterval(() => {
  // The hidden <select> behind each picker is the state holder the
  // compare logic reads; the visible picker (button + panel) isn't
  // modelled in this harness.
  const selA = els.get("stormA-select"), selB = els.get("stormB-select");
  if (!selA || selA.children.length < 2 || !TIE_READY) return;
  clearInterval(timer);
  try {
    const optionValue = (select, i) => select.children[i].value;
    check("70 options in picker A (hidden select)", selA.children.length === 70, String(selA.children.length));
    check("70 options in picker B (hidden select)", selB.children.length === 70, String(selB.children.length));
    check("first option = Wilma (newest)", optionValue(selA, 0) === "Wilma", optionValue(selA, 0));
    check("B first option = Wilma", optionValue(selB, 0) === "Wilma", optionValue(selB, 0));

    // Nothing selected yet -> Compare shows the guidance empty state.
    els.get("compareNowBtn").fire("click");
    check("no selection -> banner stays silent", els.get("winnerBannerName").textContent === "", els.get("winnerBannerName").textContent);
    check("no selection -> empty table", els.get("resultsTableBody").innerHTML.indexOf("empty-state") !== -1);

    // Subtitle is generated from the comparison mode context.
    check("subtitle describes comparison context", els.get("resultsSubtitle").textContent === "Comparing cyclones by strength", els.get("resultsSubtitle").textContent);

    // Idle state: the indicator light must have NO glow classes.
    check("idle -> no glow on indicator", !els.get("winnerBanner").hasClass("is-win") && !els.get("winnerBanner").hasClass("is-tie"), els.get("winnerBanner")._classes.join(","));

    // Pick storm A only -> compares against the upcoming storm (or asks
    // for a second storm when the admin currently has none set).
    selA.value = "Nando (Ragasa)"; selA.fire("change");
    els.get("compareNowBtn").fire("click");
    check("col A header shows storm", els.get("colAHead").innerHTML.indexOf("Nando (Ragasa)") !== -1, els.get("colAHead").innerHTML);
    let hasUpcoming = HAS_UPCOMING;
    if (hasUpcoming) {
      check("col B defaults to upcoming", els.get("colBHead").innerHTML.indexOf("Upcoming") !== -1, els.get("colBHead").innerHTML);
      check("table rendered", els.get("resultsTableBody").innerHTML.indexOf("Maximum Sustained Winds") !== -1);
    } else {
      check("no upcoming -> col B empty", els.get("colBHead").textContent === "\u2014", els.get("colBHead").textContent);
      check("no upcoming -> asks for second storm", els.get("resultsTableBody").innerHTML.indexOf("No active upcoming storm") !== -1, els.get("resultsTableBody").innerHTML);
      check("no upcoming -> guidance table", els.get("resultsTableBody").innerHTML.indexOf("empty-state") !== -1);
    }

    // Pick storm B too -> A vs B comparison.
    selB.value = "Betty (Mawar)"; selB.fire("change");
    els.get("compareNowBtn").fire("click");
    check("col B switches to storm B", els.get("colBHead").innerHTML.indexOf("Betty (Mawar)") !== -1, els.get("colBHead").innerHTML);
    const resultBannerName = els.get("winnerBannerName").textContent;
    check("banner names a winner or a tie", resultBannerName.indexOf("Nando (Ragasa)") !== -1 || resultBannerName.indexOf("Betty (Mawar)") !== -1, resultBannerName);
    check("result -> indicator glows (win or tie)", els.get("winnerBanner").hasClass("is-win") || els.get("winnerBanner").hasClass("is-tie"), els.get("winnerBanner")._classes.join(","));
    const resultBody = els.get("resultsTableBody").innerHTML;
    check("winner column green, loser red", resultBody.indexOf("metric-green") !== -1 && resultBody.indexOf("metric-red") !== -1, "green:" + resultBody.indexOf("metric-green") + " red:" + resultBody.indexOf("metric-red"));
    check("winner head badge green", els.get("colAHead").innerHTML.indexOf("col-badge-green") !== -1 || els.get("colBHead").innerHTML.indexOf("col-badge-green") !== -1, els.get("colAHead").innerHTML + " | " + els.get("colBHead").innerHTML);

    // Tie test: two storms with the same max wind must produce an explicit
    // tie banner, with no "Stronger" badge in the table.
    if (TIE_PAIR) {
      selA.value = TIE_PAIR[0]; selA.fire("change");
      selB.value = TIE_PAIR[1]; selB.fire("change");
      els.get("compareNowBtn").fire("click");
      const tieDetail = els.get("winnerBannerDetail").textContent;
      const tieBody = els.get("resultsTableBody").innerHTML;
      check("tie banner label", els.get("winnerBannerLabel").textContent === "It's a Tie", els.get("winnerBannerLabel").textContent);
      check("tie -> indicator glows blue", els.get("winnerBanner").hasClass("is-tie") && !els.get("winnerBanner").hasClass("is-win"), els.get("winnerBanner")._classes.join(","));
      check("tie banner names both storms", els.get("winnerBannerName").textContent.indexOf(TIE_PAIR[0]) !== -1 && els.get("winnerBannerName").textContent.indexOf(TIE_PAIR[1]) !== -1, els.get("winnerBannerName").textContent);
      check("tie banner explains equal strength", tieDetail.indexOf("neither is stronger") !== -1, tieDetail);
      check("tie banner mentions category", tieDetail.indexOf("same PAGASA category") !== -1, tieDetail);
      check("no Stronger badge on a tie", tieBody.indexOf("metric-winner") === -1, tieBody.indexOf("metric-winner").toString());
      check("tie keeps default column colors (no red)", tieBody.indexOf("metric-blue") !== -1 && tieBody.indexOf("metric-green") !== -1 && tieBody.indexOf("metric-red") === -1, "red index: " + tieBody.indexOf("metric-red"));
    } else {
      console.log("SKIP tie test — no two live storms share the same max wind");
    }

    // Reset clears both dropdowns and the results, and returns the
    // indicator to the dim idle state (no glow).
    els.get("resetBtn").fire("click");
    check("reset clears dropdown A", selA._value === "", String(selA._value));
    check("reset clears dropdown B", selB._value === "", String(selB._value));
    check("reset restores guidance empty table", els.get("resultsTableBody").innerHTML.indexOf("empty-state") !== -1);
    check("reset -> indicator back to idle (no glow)", !els.get("winnerBanner").hasClass("is-win") && !els.get("winnerBanner").hasClass("is-tie"), els.get("winnerBanner")._classes.join(","));
  } catch (err) {
    failures++;
    console.log("FAIL harness error: " + err.stack);
  }
  console.log(failures === 0 ? "--- ALL CHECKS PASSED ---" : "--- " + failures + " CHECK(S) FAILED ---");
  setTimeout(() => process.exit(failures === 0 ? 0 : 1), 100);
}, 50);
