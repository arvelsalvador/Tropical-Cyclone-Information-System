// TEMP harness — Best Match panel (renderAnalogues) vs live APIs.
// Loads the REAL js/pages/analysis-comparison.js against the live database and
// asserts that the Top 3 analogue ranks follow wind closeness (closest
// wind group first) with meaningful, strictly-decreasing percentages.
// The sandbox form is driven with a 400 km/h upcoming storm, so the pinned
// names reflect the strongest historical storms (215/195/185 km/h).
const fs = require("fs");
const FILE = "C:/xampp/htdocs/Weather/js/pages/analysis-comparison.js";
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
    reset() {},
    fire(t, e) { if (el._listeners[t]) el._listeners[t](e); },
  };
  Object.defineProperty(el, "innerHTML", { get: () => el._html, set(v) { el._html = v; if (v === "") el.children.length = 0; el.textContent = String(v).replace(/<[^>]*>/g, ""); } });
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
    // Sandbox world: apply a 400 km/h upcoming storm before reading ranks.
    els.get("customStormName").value = "TEST STORM";
    els.get("customStormWind").value = "400";
    els.get("customStormCategory").value = "Super Typhoon";
    els.get("customStormForm").fire("submit", { preventDefault() {} });
    check("upcoming storm applied", els.get("upcomingStormSection").hasClass("sandbox-mode"), els.get("upcomingStormSection")._classes.join(","));

    const list = els.get("analogueList");
    const group = list.children[0];
    check("analogue group rendered", !!group && group.className === "match-group", String(group && group.className));

    // 400 km/h: Nando alone at rank 1, FOUR storms tied at 195 (rank 2),
    // SEVEN tied at 185 (rank 3) — both tied ranks collapse to one bar.
    const top = parseTopLevel();
    check("top level is row,group,subs,group,subs", top.map((n) => n.kind).join(",") === "row,group,subs,group,subs", top.map((n) => n.kind).join(","));
    const topRow = top[0];
    const g195 = top[1];
    const g185 = top[3];
    check("ranks read 1,2,3", [topRow.rank, g195.rank, g185.rank].join(",") === "1,2,3", [topRow.rank, g195.rank, g185.rank].join(","));
    check("rank 1 = Nando single row", topRow.name === "Nando (Ragasa)" && topRow.isBest, topRow.name);
    check("header scores descend", topRow.score > g195.score && g195.score > g185.score, [topRow.score, g195.score, g185.score].join(","));
    check("rank-2 pill counts four", g195.pill.indexOf("+4 tied as top 2") !== -1, g195.pill);
    check("rank-3 pill counts seven", g185.pill.indexOf("+7 tied as top 3") !== -1, g185.pill);
    check("rank badges show numerals", topRow.rank === "1", topRow.rank);
    check("medal badge classes gold/silver/bronze", topRow.rankClass.indexOf("rank-1") !== -1 && g195.rankClass.indexOf("rank-2") !== -1 && g185.rankClass.indexOf("rank-3") !== -1, [topRow.rankClass, g195.rankClass, g185.rankClass].join(" | "));
    check("medal row classes best-match/rank-2/rank-3", topRow.rcls.indexOf("best-match") !== -1 && g195.gcls.indexOf("rank-2") !== -1 && g185.gcls.indexOf("rank-3") !== -1, [topRow.rcls, g195.gcls, g185.gcls].join(" | "));
    check("rank-1 row carries best-match", topRow.isBest, topRow.name);
    check("groups start collapsed", top[2].hidden === true && top[4].hidden === true);

    // Expand rank 2: all four 195 km/h storms, identical scores.
    g195.node.fire("click");
    const t2 = parseTopLevel().filter((n) => n.kind === "subs")[0];
    check("rank 2 expands", t2.hidden === false);
    const tied195 = t2.rows.map((p) => p.name).sort();
    check("rank 2 = all four 195 km/h storms", JSON.stringify(tied195) === JSON.stringify(["Betty (Mawar)", "KARDING (Noru)", "Leon (Kong-rey)", "Pepito (Man-yi)"].sort()), tied195.join(" | "));
    check("rank 2 shares one score", new Set(t2.rows.map((p) => p.score)).size === 1, t2.rows.map((p) => p.score).join(","));

    // Expand rank 3: capped at 5 subs + overflow note naming 185, Uwan first.
    g185.node.fire("click");
    const t3 = parseTopLevel().filter((n) => n.kind === "subs")[1];
    check("rank 3 expands with 5 subs", t3.hidden === false && t3.rows.length === 5, String(t3.rows.length));
    check("rank 3 leads with Uwan", t3.rows[0].name === "Uwan (Fung-wong)", t3.rows[0].name);
    check("rank 3 shares one score", new Set(t3.rows.map((p) => p.score)).size === 1, t3.rows.map((p) => p.score).join(","));
    const note185 = t3.node.children.filter((c) => String(c.className || "").indexOf("analogue-more") !== -1);
    check("rank-3 overflow note names 185", note185.length === 1 && note185[0].textContent.indexOf("185") !== -1, note185.map((c) => c.textContent).join(" | "));
    check("scores meaningful, not ~0%", t3.rows[0].score > 5, "lowest score: " + t3.rows[0].score);

    // Flat band rows: [badge, info(name), score, bar, View].
    // Group headers: [badge, info, score, bar, action] + sub div.
    function barHtmlOf(node) {
      const bar = node.children.filter((c) => String(c.className || "").indexOf("match-progress") !== -1)[0];
      return bar ? String(bar._html || "") : "";
    }
    function parseRowNode(row) {
      const infoHtml = row.children[1] ? row.children[1]._html : "";
      const nameMatch = /analogue-name">([^<]+)</.exec(infoHtml);
      const widthMatch = /width:([0-9.]+)%/.exec(barHtmlOf(row));
      return {
        rank: row.children[0] ? String(row.children[0].textContent) : "?",
        rankClass: row.children[0] ? String(row.children[0].className || "") : "",
        rcls: String(row.className || ""),
        name: nameMatch ? nameMatch[1] : "?",
        score: widthMatch ? parseFloat(widthMatch[1]) : NaN,
        isBest: String(row.className).indexOf("best-match") !== -1,
      };
    }
    // Flat view (group headers count as rows, nested sub-rows excluded)
    // for cases that don't care about the collapse structure.
    function parseFlatRows() {
      const g = els.get("analogueList").children[0];
      return g.children
        .filter((c) => String(c.className || "").indexOf("analogue-row") !== -1)
        .map(parseRowNode);
    }
    function parseTopLevel() {
      const g = els.get("analogueList").children[0];
      return g.children
        .map((node) => {
          const cls = String(node.className || "");
          if (cls.indexOf("analogue-subrows") !== -1) {
            return {
              kind: "subs",
              hidden: node.hidden === true,
              rows: node.children
                .filter((c) => String(c.className || "").indexOf("analogue-row") !== -1)
                .map(parseRowNode),
              node,
            };
          }
          if (cls.indexOf("analogue-group") !== -1) {
            let rank = "?", pill = "", score = NaN, rankClass = "", gcls = "";
            node.children.forEach((c) => {
              const cc = String(c.className || "");
              if (cc.indexOf("rank-number") !== -1) { rank = String(c.textContent); rankClass = cc; }
              if (cc.indexOf("analogue-tied-pill") !== -1) pill = c.textContent;
              if (cc.indexOf("analogue-action") !== -1) {
                c.children.forEach((k) => {
                  if (String(k.className || "").indexOf("analogue-tied-pill") !== -1) pill = k.textContent;
                });
              }
              if (cc.indexOf("match-progress") !== -1) {
                const wm = /width:([0-9.]+)%/.exec(c._html || "");
                if (wm) score = parseFloat(wm[1]);
              }
            });
            return { kind: "group", rank, pill, score, rankClass, gcls: String(node.className || ""), node };
          }
          if (cls.indexOf("analogue-row") !== -1) {
            const parsed = parseRowNode(node);
            parsed.kind = "row";
            return parsed;
          }
          return { kind: "other" };
        })
        .filter((n) => n.kind !== "other");
    }
    function applySandbox(name, wind, category) {
      els.get("customStormName").value = name;
      els.get("customStormWind").value = String(wind);
      els.get("customStormCategory").value = category;
      els.get("customStormForm").fire("submit", { preventDefault() {} });
    }

    // Async tail: 94-case + shared-wind tie check against live data.
    realFetch("http://localhost/Weather/api/get_cyclones.php")
      .then((r) => r.json())
      .then((liveRows) => {
        const disp = (row) => row.international_name ? row.local_name + " (" + row.international_name + ")" : row.local_name;
        const windOf = (row) => parseInt(String(row.highest_strength || "").split("/")[0], 10);

        // 94 km/h must surface the 95 km/h storm at 98.9% — never a weaker one.
        const at95 = liveRows.filter((r) => windOf(r) === 95).map(disp);
        if (at95.length) {
          applySandbox("CHECK 94", 94, "Tropical Storm");
          const r94 = parseFlatRows();
          check("94 -> rank 1 is a 95 km/h storm", at95.indexOf(r94[0].name) !== -1, r94[0].name);
          check("94 -> rank 1 scores 98.9%", Math.abs(r94[0].score - 98.947) < 0.01, String(r94[0].score));
          check("94 -> rank badge is 1", String(r94[0].rank) === "1", String(r94[0].rank));
        } else {
          console.log("SKIP 94-case — no live storm at exactly 95 km/h");
        }

        // Shared wind value: every storm at that wind shares rank 1.
        const byWind = new Map();
        liveRows.forEach((row) => {
          const w = windOf(row);
          if (isNaN(w)) return;
          if (!byWind.has(w)) byWind.set(w, []);
          byWind.get(w).push(disp(row));
        });
        let tieWind = null, tieNames = [];
        for (const [w, names] of byWind) {
          if (names.length >= 2) { tieWind = w; tieNames = names; break; }
        }
        if (tieWind != null) {
          applySandbox("CHECK TIE", tieWind, "Typhoon");
          const top = parseTopLevel();
          const groups = top.filter((n) => n.kind === "group");
          const subs = top.filter((n) => n.kind === "subs");
          check("rank-1 tie collapses to one bar", groups.length >= 1 && groups[0].rank === "1", JSON.stringify(top.map((n) => n.kind + ":" + (n.rank || ""))));
          check("tied pill shows total + rank", groups[0].pill.indexOf("+" + tieNames.length + " tied as top 1") !== -1, groups[0].pill);
          check("rank-1 sub-rows start hidden", subs.length >= 1 && subs[0].hidden === true, String(subs.length));
          groups[0].node.fire("click");
          const expanded = parseTopLevel().filter((n) => n.kind === "subs")[0];
          check("click expands sub-rows", expanded && expanded.hidden === false);
          // Rank-1 sub-rows cap at 5, overflow tucked inside as a note.
          const expectedSubs = Math.min(tieNames.length, 5);
          check("sub-row count respects cap", expanded.rows.length === expectedSubs, expanded.rows.length + " rows, group " + tieNames.length);
          check("expanded rows share rank 1", expanded.rows.length >= 1 && expanded.rows.every((r) => String(r.rank) === "1"), expanded.rows.map((r) => r.rank).join(","));
          check("tied storms show identical scores", new Set(expanded.rows.map((r) => r.score)).size === 1, JSON.stringify(expanded.rows.map((r) => r.score)));
          const expandedNames = expanded.rows.map((r) => r.name);
          check("expanded rows are the " + tieWind + " km/h storms", expandedNames.every((n) => tieNames.indexOf(n) !== -1), expandedNames.join(" | "));
          const noteKids = expanded.node.children.filter((c) => String(c.className || "").indexOf("analogue-more") !== -1);
          if (tieNames.length > 5) {
            check("overflow note inside sub-rows", noteKids.length === 1 && noteKids[0].textContent.indexOf(String(tieWind)) !== -1, noteKids.map((c) => c.textContent).join(" | "));
          } else {
            check("no overflow note needed", noteKids.length === 0, String(noteKids.length));
          }
          groups[0].node.fire("click");
          check("click again collapses", parseTopLevel().filter((n) => n.kind === "subs")[0].hidden === true);
        } else {
          console.log("SKIP tie test — no shared wind value in live data");
        }
      })
      .catch((err) => {
        failures++;
        console.log("FAIL harness error: " + err.stack);
      })
      .finally(() => {
        console.log(failures === 0 ? "--- ALL CHECKS PASSED ---" : "--- " + failures + " CHECK(S) FAILED ---");
        setTimeout(() => process.exit(failures === 0 ? 0 : 1), 100);
      });
    return;
  } catch (err) {
    failures++;
    console.log("FAIL harness error: " + err.stack);
  }
  console.log(failures === 0 ? "--- ALL CHECKS PASSED ---" : "--- " + failures + " CHECK(S) FAILED ---");
  setTimeout(() => process.exit(failures === 0 ? 0 : 1), 100);
}, 300);