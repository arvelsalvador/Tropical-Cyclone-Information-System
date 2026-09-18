// Tropical Cyclone Information System — Education Hub
// TopicDetailModal: reusable popup for "Explore Topics" cards.
//
// Open a topic's content in a scrollable dialog instead of navigating away.
// The modal is driven entirely by a TopicModel (see js/topic-models.js), so
// all five cards share this one component — new topics need no new code.
//
// Structure follows the existing analogue-details dialog on the Analysis Comparison
// page: fixed backdrop, rounded dialog, Escape/backdrop/X to close, body
// scroll lock while open.
//
// Usage:
//   TopicDetailModal.open(topicModel);
// or via event delegation (wired in init):
//   <button data-topic-id="what-is-a-typhoon">…</button>

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // SVG fragment helpers (strings because the markup is built once)
  // ------------------------------------------------------------------
  var CLOSE_X_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">' +
    '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />' +
    "</svg>";

  // ------------------------------------------------------------------
  // Singleton DOM — built lazily on first open, reused afterwards
  // ------------------------------------------------------------------
  var el = {
    root: null, // .topic-modal          (fixed overlay)
    backdrop: null, // .topic-modal__backdrop
    dialog: null, // .topic-modal__dialog   (rounded card)
    panel: null, // .topic-modal__panel    (header + scroll body)
    header: null, // .topic-modal__header   (sticky)
    badge: null, // .topic-modal__badge    (gradient icon)
    title: null, // .topic-modal__title
    tagline: null, // .topic-modal__tagline
    closeX: null, // .topic-modal__close    (X, top-right)
    body: null, // .topic-modal__body     (scrollable sections)
    prevBtn: null, // .topic-modal__footer previous-topic button
    nextBtn: null, // .topic-modal__footer next-topic button
    count: null, // .topic-modal__footer "Topic X of N" label
    closeBtn: null, // .topic-modal__footer .topic-modal__close-btn
  };

  var currentTopic = null;
  var lastTrigger = null;
  var initialized = false;

  // ------------------------------------------------------------------
  // Build the static skeleton once (header/close stay; body is refilled)
  // ------------------------------------------------------------------
  function ensureSkeleton() {
    if (el.root) return;

    el.root = document.createElement("div");
    el.root.className = "topic-modal";
    el.root.hidden = true;
    el.root.innerHTML =
      '<div class="topic-modal__backdrop" data-topic-modal-close></div>' +
      '<div class="topic-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="topic-modal-title">' +
      '  <div class="topic-modal__panel">' +
      '    <header class="topic-modal__header">' +
      '      <span class="topic-modal__badge" aria-hidden="true"></span>' +
      '      <div class="topic-modal__headings">' +
      '        <h2 class="topic-modal__title" id="topic-modal-title"></h2>' +
      '        <p class="topic-modal__tagline"></p>' +
      "      </div>" +
      '      <button type="button" class="topic-modal__close" data-topic-modal-close aria-label="Close topic"></button>' +
      "    </header>" +
      '    <div class="topic-modal__body"></div>' +
      '    <footer class="topic-modal__footer">' +
      '      <div class="topic-modal__pager">' +
      '        <span class="topic-modal__count" aria-live="polite"></span>' +
      '        <button type="button" class="topic-modal__page-btn" data-topic-modal-prev aria-label="Previous topic"><span aria-hidden="true">&lsaquo;</span> Prev</button>' +
      '        <button type="button" class="topic-modal__page-btn" data-topic-modal-next aria-label="Next topic">Next <span aria-hidden="true">&rsaquo;</span></button>' +
      "      </div>" +
      '      <button type="button" class="topic-modal__close-btn" data-topic-modal-close>Close</button>' +
      "    </footer>" +
      "  </div>" +
      "</div>";

    el.backdrop = el.root.querySelector(".topic-modal__backdrop");
    el.dialog = el.root.querySelector(".topic-modal__dialog");
    el.panel = el.root.querySelector(".topic-modal__panel");
    el.header = el.root.querySelector(".topic-modal__header");
    el.badge = el.root.querySelector(".topic-modal__badge");
    el.title = el.root.querySelector(".topic-modal__title");
    el.tagline = el.root.querySelector(".topic-modal__tagline");
    el.closeX = el.root.querySelector(".topic-modal__close");
    el.body = el.root.querySelector(".topic-modal__body");
    el.prevBtn = el.root.querySelector("[data-topic-modal-prev]");
    el.nextBtn = el.root.querySelector("[data-topic-modal-next]");
    el.count = el.root.querySelector(".topic-modal__count");
    el.closeBtn = el.root.querySelector(".topic-modal__close-btn");

    // Close on X, footer Close button, and backdrop click.
    // Prev/Next have their own handler below and must not bubble to close.
    el.closeX.innerHTML = CLOSE_X_SVG;
    el.root.addEventListener("click", function (event) {
      if (event.target.closest("[data-topic-modal-prev]")) {
        goTo(-1);
        return;
      }
      if (event.target.closest("[data-topic-modal-next]")) {
        goTo(1);
        return;
      }
      if (event.target.closest("[data-topic-modal-close]")) close();
    });

    document.body.appendChild(el.root);
  }

  // ------------------------------------------------------------------
  // Content rendering
  // ------------------------------------------------------------------
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Body sections may embed a few whitelisted inline tags for emphasis
  // (<strong>, <em>) — everything else is escaped.
  function renderParagraph(html) {
    var restored = escapeHtml(html)
      .replace(/&lt;strong&gt;/g, "<strong>")
      .replace(/&lt;\/strong&gt;/g, "</strong>")
      .replace(/&lt;em&gt;/g, "<em>")
      .replace(/&lt;\/em&gt;/g, "</em>");
    return "<p>" + restored + "</p>";
  }

  function renderBody(topic) {
    var html = "";
    (topic.sections || []).forEach(function (section) {
      html += '<section class="topic-modal__section">';
      if (section.heading) {
        html += "<h3>" + escapeHtml(section.heading) + "</h3>";
      }
      (section.paragraphs || []).forEach(function (paragraph) {
        html += renderParagraph(paragraph);
      });
      html += "</section>";
    });
    return html;
  }

  function topicIndex(topic) {
    var models = window.TOPIC_MODELS || [];
    for (var i = 0; i < models.length; i++) {
      if (models[i] === topic || models[i].id === (topic && topic.id)) return i;
    }
    return -1;
  }

  // Step to the previous/next topic in journey order, wrapping around
  // (After the Storm → What is a Typhoon). Keeps the dialog open so the
  // five topics read as one continuous lesson.
  function goTo(offset) {
    var models = window.TOPIC_MODELS || [];
    if (!models.length || !currentTopic) return;
    var next = (topicIndex(currentTopic) + offset + models.length) % models.length;
    currentTopic = models[next];
    render(currentTopic);
    el.closeX.focus();
  }

  function render(topic) {
    currentTopic = topic;

    // Per-topic badge theme matching its card (homepage feature-icon palette).
    el.root.className = "topic-modal topic-modal--" + (topic.theme || "sky");

    el.badge.innerHTML = topic.icon || "";
    el.title.textContent = topic.title || "";
    el.tagline.textContent = topic.tagline || "";
    el.body.innerHTML = renderBody(topic);
    el.body.scrollTop = 0;
    el.panel.scrollTop = 0;

    var models = window.TOPIC_MODELS || [];
    var at = topicIndex(topic);
    if (el.count) {
      el.count.textContent =
        at >= 0 ? "Topic " + (at + 1) + " of " + models.length : "";
    }
  }

  // ------------------------------------------------------------------
  // Open / close
  // ------------------------------------------------------------------
  function open(topic, trigger) {
    ensureSkeleton();
    render(topic);
    lastTrigger = trigger || document.activeElement;
    el.root.hidden = false;
    document.body.classList.add("topic-modal-open");
    el.closeX.focus();
  }

  function close() {
    if (!el.root || el.root.hidden) return;
    el.root.hidden = true;
    document.body.classList.remove("topic-modal-open");
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
    currentTopic = null;
  }

  // ------------------------------------------------------------------
  // Keyboard support: Escape closes; Tab cycles inside the dialog
  // ------------------------------------------------------------------
  function focusables() {
    if (!el.dialog) return [];
    return Array.prototype.filter.call(
      el.dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ),
      function (node) {
        return !node.disabled && node.offsetParent !== null;
      }
    );
  }

  function onKeydown(event) {
    if (!el.root || el.root.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;

    var items = focusables();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

    if (event.shiftKey && (active === first || !el.dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // ------------------------------------------------------------------
  // Wiring
  // ------------------------------------------------------------------
  function init() {
    if (initialized) return;
    initialized = true;

    // One delegated listener covers every card, present and future.
    document.addEventListener("click", function (event) {
      var card = event.target.closest("[data-topic-id]");
      if (!card) return;
      var model = (window.TOPIC_MODELS || []).filter(function (topic) {
        return topic.id === card.getAttribute("data-topic-id");
      })[0];
      if (model) {
        event.preventDefault();
        open(model, card);
      }
    });

    document.addEventListener("keydown", onKeydown);
  }

  // Public API — reusable across pages, like a widget instance.
  window.TopicDetailModal = {
    open: open,
    close: close,
    init: init,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
