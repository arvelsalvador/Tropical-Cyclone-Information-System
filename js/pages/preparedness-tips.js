// Preparedness Tips — interactive emergency kit checklist
// Renders checklist categories, persists ticks to localStorage, drives progress bar.

(function () {
  "use strict";

  const STORAGE_KEY = "tcis-preparedness-v1";

  const CATEGORIES = [
    {
      title: "Water & Food",
      items: [
        "Drinking water — at least 3 liters per person per day for 3 days",
        "Non-perishable food (canned goods, crackers, dried fruit)",
        "Manual can opener and eating utensils",
        "Water purification tablets or portable filter",
      ],
    },
    {
      title: "Documents & Money",
      items: [
        "IDs and birth certificates in a waterproof pouch",
        "Copies of land title, insurance, and medical records",
        "Cash in small bills and loose change",
        "Emergency contact list written on paper",
      ],
    },
    {
      title: "Health & Hygiene",
      items: [
        "Maintenance medicines with prescriptions",
        "First aid kit with bandages, antiseptic, and pain relievers",
        "Soap, alcohol/sanitizer, and toothbrushes",
        "Sanitary pads or diapers (if needed)",
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
      title: "Clothing & Protection",
      items: [
        "Change of clothes and raincoat per person",
        "Sturdy closed shoes (not slippers)",
        "Blanket or malong and sleeping mats",
        "Plastic bags for wet clothes and waste",
      ],
    },
    {
      title: "Home & Vehicle",
      items: [
        "Sandbags or plastic sheeting for flood-prone homes",
        "Rope, duct tape, and multi-tool",
        "Car fuel tank kept at least half full",
        "Spare key for house and car in a waterproof bag",
      ],
    },
  ];

  const listEl = document.getElementById("pt-checklist");
  if (!listEl) return;

  const countEl = document.getElementById("pt-progress-count");
  const pctEl = document.getElementById("pt-progress-pct");
  const barEl = document.getElementById("pt-progress-bar");
  const fillEl = document.getElementById("pt-progress-fill");

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
      catEl.className = "pt-check-category";

      const title = document.createElement("h3");
      title.textContent = cat.title;
      catEl.appendChild(title);

      cat.items.forEach((item) => {
        const id = "pt-item-" + index++;

        const label = document.createElement("label");
        label.className = "pt-check-item";

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

  const checkAllBtn = document.getElementById("pt-check-all");
  const uncheckAllBtn = document.getElementById("pt-uncheck-all");
  const resetBtn = document.getElementById("pt-reset");

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
