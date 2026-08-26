// Tropical Cyclone Information System — main.js
// Nav is now embedded directly in every HTML page.
// This script just wires up the dropdown click and mobile menu behavior.

(function () {
  "use strict";

  function initNav() {
    // ── Education dropdown (click to open/close) ──────────────────────────────
    var dropdowns = document.querySelectorAll(".nav-dropdown");
    dropdowns.forEach(function (dropdown) {
      var btn = dropdown.querySelector(".dropdown-toggle");
      if (!btn) return;

      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var isOpen = dropdown.classList.contains("open");
        // Close any other open dropdowns first
        document.querySelectorAll(".nav-dropdown.open").forEach(function (d) {
          d.classList.remove("open");
          var t = d.querySelector(".dropdown-toggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
        // Toggle this one
        if (!isOpen) {
          dropdown.classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".nav-dropdown")) {
        document.querySelectorAll(".nav-dropdown.open").forEach(function (d) {
          d.classList.remove("open");
          var t = d.querySelector(".dropdown-toggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
      }
    });

    // Close dropdown on Escape key
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".nav-dropdown.open").forEach(function (d) {
          d.classList.remove("open");
          var t = d.querySelector(".dropdown-toggle");
          if (t) t.setAttribute("aria-expanded", "false");
        });
      }
    });

    // ── Mobile menu toggle ────────────────────────────────────────────────────
    var mobileToggle = document.querySelector(".mobile-menu-toggle");
    var siteHeader = document.querySelector(".site-header");
    if (mobileToggle && siteHeader) {
      mobileToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        siteHeader.classList.toggle("nav-open");
      });

      // Close mobile menu when clicking outside the header
      document.addEventListener("click", function (e) {
        if (
          siteHeader.classList.contains("nav-open") &&
          !siteHeader.contains(e.target)
        ) {
          siteHeader.classList.remove("nav-open");
        }
      });
    }

    // ── Header shadow once the page scrolls ────────────────────────────────
    if (siteHeader) {
      var onScroll = function () {
        siteHeader.classList.toggle("scrolled", window.scrollY > 8);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    // ── Mark active nav link ──────────────────────────────────────────────────
    var currentPath = window.location.pathname
      .replace(/\\/g, "/")
      .replace(/\/index\.html$/i, "/")
      .replace(/\/+$/, "");
    if (!currentPath) currentPath = "/";

    document.querySelectorAll(".main-nav a[href]").forEach(function (link) {
      try {
        var linkPath = new URL(link.href).pathname
          .replace(/\\/g, "/")
          .replace(/\/index\.html$/i, "/")
          .replace(/\/+$/, "");
        if (linkPath === currentPath) {
          link.classList.add("active");
        }
      } catch (e) {}
    });

    // Mark education button active if we're in any education page
    if (currentPath.indexOf("/pages/education") !== -1) {
      var eduBtn = document.querySelector(".dropdown-toggle");
      if (eduBtn) eduBtn.classList.add("active");
    }
  }

  function initReveal() {
    var items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;

    var reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (!("IntersectionObserver" in window) || reduceMotion) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initNav();
      initReveal();
    });
  } else {
    initNav();
    initReveal();
  }
})();
