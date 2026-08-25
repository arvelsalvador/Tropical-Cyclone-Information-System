// Evacuation Guide — interactive go-bag checklist
// Renders checklist categories, persists ticks to localStorage, drives progress bar.

(function () {
  "use strict";

  const STORAGE_KEY = "tcis-gobag-v1";

  const CATEGORIES = [
    {
      title: "Water & Food",
      items: [
        "Drinking water — at least 3 L per person per day",
        "Ready-to-eat food for 3 days (canned goods, crackers)",
        "Manual can opener and utensils",
        "Water bottles or jugs with tight lids",
      ],
    },
    {
      title: "Documents & Money",
      items: [
        "IDs and birth certificates in a waterproof pouch",
        "Copies of land title, insurance, and medical records",
        "Cash in small bills and loose change",
        "Emergency contact list (written on paper)",
      ],
    },
    {
      title: "Health & Hygiene",
      items: [
        "Maintenance medicines with prescriptions",
        "First aid kit with bandages and antiseptic",
        "Soap, alcohol/sanitizer, and toothbrushes",
        "Diapers and formula (if there are infants)",
      ],
    },
    {
      title: "Light & Communication",
      items: [
        "Flashlight with spare batteries",
        "Battery-powered or hand-crank radio",
        "Fully charged power banks and charging cables",
        "Whistle to signal for help",
      ],
    },
    {
      title: "Clothing & Shelter",
      items: [
        "Change of clothes and raincoat per person",
        "Sturdy closed shoes (no slippers)",
        "Blanket or malong and sleeping mats",
        "Plastic bags for wet clothes and waste",
      ],
    },
    {
      title: "Special Needs",
      items: [
        "Items for elderly family members (glasses, hearing aids)",
        "Mobility aids (canes, wheelchairs) if needed",
        "Pet food and leash (if the center allows pets)",
        "Toys or comfort items for young children",
      ],
    },
  ];

  const listEl = document.getElementById("eg-checklist");
  if (!listEl) return;

  const countEl = document.getElementById("eg-progress-count");
  const pctEl = document.getElementById("eg-progress-pct");
  const barEl = document.getElementById("eg-progress-bar");
  const fillEl = document.getElementById("eg-progress-fill");

  const total = CATEGORIES.reduce((sum, cat) => sum + cat.items.length, 0);

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && typeof JSON.parse(raw) === "object") {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (_) {
      // corrupted or unavailable storage — start fresh
    }
    return {};
  }

  function saveState() {
    try {
      const state = {};
      listEl.querySelectorAll("input[type='checkbox']").forEach((box) => {
        state[box.dataset.id] = box.checked;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      // storage unavailable (private mode) — progress just won't persist
    }
  }

  function updateProgress() {
    const boxes = Array.from(listEl.querySelectorAll("input[type='checkbox']"));
    const done = boxes.filter((b) => b.checked).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);

    if (countEl) countEl.textContent = done + " of " + total + " items";
    if (pctEl) pctEl.textContent = pct + "%";
    if (fillEl) fillEl.style.width = pct + "%";
    if (barEl) barEl.setAttribute("aria-valuenow", String(pct));
  }

  function setAll(checked) {
    listEl.querySelectorAll("input[type='checkbox']").forEach((box) => {
      box.checked = checked;
    });
    saveState();
    updateProgress();
  }

  function render() {
    const state = loadState();
    const frag = document.createDocumentFragment();

    let index = 0;
    CATEGORIES.forEach((cat) => {
      const catEl = document.createElement("div");
      catEl.className = "eg-check-category";

      const title = document.createElement("h3");
      title.textContent = cat.title;
      catEl.appendChild(title);

      cat.items.forEach((item) => {
        const id = "eg-item-" + index++;

        const label = document.createElement("label");
        label.className = "eg-check-item";

        const box = document.createElement("input");
        box.type = "checkbox";
        box.dataset.id = id;
        box.checked = Boolean(state[id]);

        const text = document.createElement("span");
        text.textContent = item;

        label.appendChild(box);
        label.appendChild(text);
        catEl.appendChild(label);
      });

      frag.appendChild(catEl);
    });

    listEl.appendChild(frag);

    listEl.addEventListener("change", () => {
      saveState();
      updateProgress();
    });
  }

  render();
  updateProgress();

  const checkAllBtn = document.getElementById("eg-check-all");
  const uncheckAllBtn = document.getElementById("eg-uncheck-all");
  const resetBtn = document.getElementById("eg-reset");

  if (checkAllBtn) checkAllBtn.addEventListener("click", () => setAll(true));
  if (uncheckAllBtn) uncheckAllBtn.addEventListener("click", () => setAll(false));
  if (resetBtn)
    resetBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {
        // ignore
      }
      setAll(false);
    });
})();
