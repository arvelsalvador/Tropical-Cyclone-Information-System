// TEMP harness — Best Match panel (renderAnalogues) vs live APIs.
// Loads the REAL js/pages/compare-storms.js against the live database and
// asserts that the Top 3 analogue ranks follow wind closeness (closest
// wind group first) with meaningful, strictly-decreasing percentages.
// Names in checks 4–6 reflect the current live data (upcoming storm
// 400 km/h; strongest historical storms 215/195/185 km/h).
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
    // Stub child (not null): the score <strong> is written to directly.
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
global.requestAnimationFrame = () => {};
global.document = {
  readyState: "complete", activeElement: null, visibilityState: "visible",
  getElementById(id) { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  querySelectorAll() { return []; },
  // Picker shells aren't modelled: return null so setupPicker() exits.
  querySelector() { return null; },
  createElement(t) { return makeEl("<" + t + ">"); },
  addEventListener() {},
  body: { classList: { add() {}, remove() {} } },
};
const realFetch = global.fetch;
global.fetch = (u, o) => realFetch("http://localhost" + u, o);
eval(fs.readFileSync(FILE, "utf8"));

let failures = 0;
function check(label, ok, detail) {
  console.log((ok ? "PASS " : "FAIL ") + label + (ok ? "" : " -> " + detail));
  if (!ok) failures++;
}

setTimeout(() => {
  try {
    const list = els.get("analogueList");
    const group = list.children[0];
    check("analogue group rendered", !!group && group.className === "match-group", String(group && group.className));
    const rows = group.children.filter((c) => String(c.className).indexOf("analogue-row") !== -1);
    check("top 3 rows rendered", rows.length === 3, "rows: " + rows.length);

    // Each row: [rank span, info div, sim div, view button]. The score is
    // embedded in the info div's match-progress bar width; the displayed
    // percentage goes to the detached <strong> stub, so read the width.
    const parsed = rows.map((row) => {
      const infoHtml = row.children[1] ? row.children[1]._html : "";
      const nameMatch = /analogue-name">([^<]+)</.exec(infoHtml);
      const widthMatch = /width:([0-9.]+)%/.exec(infoHtml);
      return {
        name: nameMatch ? nameMatch[1] : "?",
        score: widthMatch ? parseFloat(widthMatch[1]) : NaN,
        isBest: String(row.className).indexOf("best-match") !== -1,
      };
    });
    console.log("Rendered order:", parsed.map((p) => p.name + " " + p.score.toFixed(2) + "%").join(" | "));

    check("rank 1 flagged best-match", !!parsed[0] && parsed[0].isBest, JSON.stringify(parsed[0]));
    check("rank 1 = closest storm (Nando, 215 km/h)", parsed[0] && parsed[0].name === "Nando (Ragasa)", parsed[0] && parsed[0].name);
    check("rank 2 = Pepito (195 km/h)", parsed[1] && parsed[1].name === "Pepito (Man-yi)", parsed[1] && parsed[1].name);
    check("rank 3 = Uwan (185 km/h)", parsed[2] && parsed[2].name === "Uwan (Fung-wong)", parsed[2] && parsed[2].name);
    check("scores strictly descending (closeness order)",
      parsed[0].score > parsed[1].score && parsed[1].score > parsed[2].score,
      parsed.map((p) => p.score).join(","));
    check("scores meaningful, not ~0%", parsed[2].score > 5, "lowest score: " + parsed[2].score);
  } catch (err) {
    failures++;
    console.log("FAIL harness error: " + err.stack);
  }
  console.log(failures === 0 ? "--- ALL CHECKS PASSED ---" : "--- " + failures + " CHECK(S) FAILED ---");
  setTimeout(() => process.exit(failures === 0 ? 0 : 1), 100);
}, 300);