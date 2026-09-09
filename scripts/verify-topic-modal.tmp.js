// TEMP harness — js/topic-detail-modal.js + js/topic-models.js smoke test.
// Simulates tapping each topic card and asserts the modal renders the right
// topic content, theme, close behaviors, and focus restore.
const fs = require("fs");
let failures = 0;
const check = (l, c, x) => { if (!c) failures++; console.log((c ? "PASS " : "FAIL ") + l + (x ? "  [" + x + "]" : "")); };

// --- minimal but generic selector support --------------------------------
function matchesOne(node, sel) {
  sel = sel.replace(/:not\([^)]*\)/g, ""); // enough for the harness
  const tagMatch = sel.match(/^[a-zA-Z][\w-]*/);
  if (tagMatch && /^[a-zA-Z]/.test(sel)) {
    if (node.tag !== tagMatch[0].toLowerCase()) return false;
    sel = sel.slice(tagMatch[0].length);
  }
  const classes = new Set([...(node._classes || []), ...String(node.attributes.class || "").split(/\s+/).filter(Boolean)]);
  const classRe = /\.([\w-]+)/g; let m;
  while ((m = classRe.exec(sel))) if (!classes.has(m[1])) return false;
  const attrRe = /\[([a-zA-Z-]+)(?:="([^"]*)")?\]/g;
  while ((m = attrRe.exec(sel))) {
    const v = node.getAttribute(m[1]);
    if (v == null || (m[2] !== undefined && v !== m[2])) return false;
  }
  return true;
}
const matchesSel = (node, sel) => sel.split(",").some((s) => s.trim() && matchesOne(node, s.trim()));

function makeEl(tag) {
  const el = {
    tag: tag.toLowerCase(), textContent: "", hidden: false, disabled: false, style: {},
    children: [], _listeners: {}, _html: "", _classes: [], attributes: {}, parentElement: null,
    classList: {
      add(...n) { n.forEach((x) => { if (!el._classes.includes(x)) el._classes.push(x); }); },
      remove(...n) { el._classes = el._classes.filter((x) => !n.includes(x)); },
      toggle(n, f) { const on = f === undefined ? !el._classes.includes(n) : !!f; if (on) el.classList.add(n); else el.classList.remove(n); return on; },
      contains(n) { return el._classes.includes(n); },
    },
    appendChild(c) { el.children.push(c); c.parentElement = el; return c; },
    querySelector(sel) { return matchesSel(el, sel) ? el : walk(el, sel)[0] || null; },
    querySelectorAll(sel) { return walk(el, sel); },
    addEventListener(t, f) { (el._listeners[t] = el._listeners[t] || []).push(f); },
    setAttribute(k, v) { el.attributes[k] = v; },
    getAttribute(k) { return el.attributes[k] != null ? el.attributes[k] : null; },
    closest(sel) { let n = el; while (n) { if (matchesSel(n, sel)) return n; n = n.parentElement; } return null; },
    contains(n) { let x = n; while (x) { if (x === el) return true; x = x.parentElement; } return false; },
    focus() { el.focused = true; global.document.activeElement = el; },
    get scrollTop() { return el._scrollTop || 0; },
    set scrollTop(v) { el._scrollTop = v; },
  };
  Object.defineProperty(el, "className", {
    get: () => el._classes.join(" "),
    set(v) { el._classes = String(v).split(/\s+/).filter(Boolean); },
  });
  Object.defineProperty(el, "innerHTML", {
    get: () => el._html,
    set(v) { el._html = v; el.children.length = 0; parseInto(el, v); },
  });
  return el;
}
function walk(node, sel) {
  const out = [];
  (node.children || []).forEach((c) => { if (matchesSel(c, sel)) out.push(c); out.push(...walk(c, sel)); });
  return out;
}
// Flat innerHTML "parser" — enough to materialise the modal skeleton nodes.
function parseInto(parent, html) {
  const re = /<(div|header|footer|button|h2|h3|p|span|section)\b([^>]*)>/g; let m;
  while ((m = re.exec(html))) {
    const child = makeEl(m[1]);
    // Supports bare attributes (data-topic-modal-close) and valued ones.
    const attrRe = /([a-zA-Z-]+)(?:="([^"]*)")?/g; let a;
    while ((a = attrRe.exec(m[2]))) {
      if (a[1] !== "aria-hidden") child.setAttribute(a[1], a[2] !== undefined ? a[2] : "");
    }
    parent.children.push(child); child.parentElement = parent;
  }
}

// --- DOM + component under test -------------------------------------------
const body = makeEl("body");
const roots = [];
global.document = {
  readyState: "complete", activeElement: null, body,
  createElement: (t) => makeEl(t),
  addEventListener(t, f) { (global.document._docListeners = global.document._docListeners || {})[t] = f; },
};
// body.appendChild must "attach" the modal root like a real DOM would.
body.appendChild = (n) => { roots.push(n); n.parentElement = body; return n; };
global.window = {};
eval(fs.readFileSync("js/topic-models.js", "utf8"));
eval(fs.readFileSync("js/topic-detail-modal.js", "utf8"));

const Modal = global.window.TopicDetailModal;
check("TopicDetailModal exposed", !!Modal && typeof Modal.open === "function");

// Fire like a real click: local listeners along the ancestor chain, then
// the delegated document listener.
const click = (target) => {
  const ev = { target, preventDefault() {} };
  let n = target;
  while (n) { (n._listeners.click || []).forEach((f) => f(ev)); n = n.parentElement; }
  if (global.document._docListeners.click) global.document._docListeners.click(ev);
};
const key = (k, shift) => global.document._docListeners.keydown({ key: k, shiftKey: !!shift, preventDefault() {} });

// Simulate tapping each of the 5 cards.
const models = global.window.TOPIC_MODELS;
const cards = models.map((t) => { const c = makeEl("button"); c.setAttribute("data-topic-id", t.id); return c; });
const root = () => roots[0];

cards.forEach((card, i) => {
  const model = models[i];
  click(card);
  const r = root();
  check(`tap "${model.id}" opens modal`, r && !r.hidden);
  check(`  title = "${model.title}"`, r.querySelector(".topic-modal__title").textContent === model.title, r.querySelector(".topic-modal__title").textContent);
  check(`  tagline set`, r.querySelector(".topic-modal__tagline").textContent === model.tagline);
  check(`  theme class --${model.theme}`, r._classes.includes("topic-modal--" + model.theme), r.className);
  check(`  icon badge filled`, r.querySelector(".topic-modal__badge").innerHTML.indexOf("<svg") !== -1);
  check(`  ${model.sections.length} sections rendered`, r.querySelectorAll(".topic-modal__section").length === model.sections.length, String(r.querySelectorAll(".topic-modal__section").length));
  check(`  h3 headings rendered`, r.querySelectorAll("h3").length === model.sections.filter((s) => s.heading).length, String(r.querySelectorAll("h3").length));
  check("  X close focused", global.document.activeElement && global.document.activeElement.getAttribute("data-topic-modal-close") != null);
  check("  body scroll locked", body._classes.includes("topic-modal-open"));
  check("  body reset to top", r.querySelector(".topic-modal__body").scrollTop === 0);
  key("Escape");
  check("  Escape closes + refocuses card", r.hidden && card.focused === true);
});

// X / footer Close / backdrop close + Tab trap on one open modal.
const card = cards[0];
click(card); click(root().querySelector(".topic-modal__close")); check("X button closes", root().hidden);
click(card); click(root().querySelector(".topic-modal__close-btn")); check("footer Close closes", root().hidden);
click(card); click(root().querySelector(".topic-modal__backdrop")); check("backdrop click closes", root().hidden);
click(card);
key("Tab"); key("Tab", true); check("Tab cycling survives", !root().hidden);
key("Escape"); check("escape after tab closes", root().hidden);

// Unknown id does nothing; programmatic API works.
const ghost = makeEl("button"); ghost.setAttribute("data-topic-id", "nope");
click(ghost); check("unknown data-topic-id ignored", root().hidden);
Modal.open(models[4]); check("programmatic open works", !root().hidden && root().querySelector(".topic-modal__title").textContent === "After the Storm");
Modal.close(); check("programmatic close works", root().hidden);

console.log(failures === 0 ? "--- ALL CHECKS PASSED ---" : "--- " + failures + " CHECK(S) FAILED ---");
process.exit(failures === 0 ? 0 : 1);
