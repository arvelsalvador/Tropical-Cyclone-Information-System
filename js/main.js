// Tropical Cyclone Information System — shared runtime
// Loads header/footer partials, applies active nav state, wires behavior.

const ROOT = (document.currentScript && document.currentScript.dataset.root) || "";

function normalizePath(pathname) {
  let p = "/" + String(pathname).replace(/\\/g, "/").replace(/^\/+/, "");
  p = p.replace(/\/index\.html$/i, "/");
  p = p.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

function absPath(rel) {
  try {
    return normalizePath(new URL(ROOT + rel, location.href).pathname);
  } catch (_) {
    return null;
  }
}

function isExternal(url) {
  return /^(https?:|mailto:|tel:|#|\/\/)/i.test(url);
}

function rewriteAssetPaths(scope) {
  scope.querySelectorAll("a[href], img[src]").forEach((el) => {
    const attr = el.hasAttribute("href") ? "href" : "src";
    const value = el.getAttribute(attr);
    if (!value || isExternal(value)) return;
    el.setAttribute(attr, ROOT + value);
  });
}

function syncEducationDropdownFromFooter(headerMount, footerMount) {
  if (!headerMount || !footerMount) return;

  const dropdownMenu = headerMount.querySelector(".nav-dropdown .dropdown-menu");
  if (!dropdownMenu) return;

  const footerEducationTitle = Array.from(
    footerMount.querySelectorAll(".footer-col h4")
  ).find((h) => h.textContent && h.textContent.trim().toLowerCase() === "education");

  if (!footerEducationTitle) return;

  const footerEducationCol = footerEducationTitle.closest(".footer-col");
  if (!footerEducationCol) return;

  const footerLinks = Array.from(footerEducationCol.querySelectorAll("a[href]"));
  if (!footerLinks.length) return;

  // Keep the header source of truth if it is already populated.
  const hasExistingHeaderLinks = dropdownMenu.querySelector("a[href]");
  if (hasExistingHeaderLinks) return;

  dropdownMenu.innerHTML = "";
  footerLinks.forEach((link) => {
    const a = document.createElement("a");
    a.setAttribute("href", link.getAttribute("href"));
    a.textContent = link.textContent;
    dropdownMenu.appendChild(a);
  });
}

async function injectPartial(mountId, partialPath) {
  const mount = document.getElementById(mountId);
  if (!mount) return null;
  try {
    // Revalidate so edits to the partials are never masked by a stale
    // browser cache (which would render an empty/broken nav).
    const res = await fetch(ROOT + partialPath, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${partialPath}`);
    mount.innerHTML = await res.text();
    rewriteAssetPaths(mount);
    return mount;
  } catch (err) {
    console.error(`[TCIS] Could not load ${partialPath}.`, err);
    mount.innerHTML =
      '<p style="padding:16px;text-align:center;color:#7c8aa0;">Navigation failed to load. Are you running the site through a local server?</p>';
    return null;
  }
}

function applyActiveState(headerMount) {
  const here = normalizePath(location.pathname);
  const samePage = (link) => absPath(link.getAttribute("href")) === here;

  headerMount.querySelectorAll(".main-nav > a[href]").forEach((link) => {
    link.classList.toggle("active", samePage(link));
  });

  headerMount.querySelectorAll(".header-actions a[href]").forEach((link) => {
    link.classList.toggle("active", samePage(link));
  });

  const dropdown = headerMount.querySelector(".nav-dropdown");
  if (!dropdown) return;

  const children = Array.from(dropdown.querySelectorAll(".dropdown-menu a[href]"));
  let matchedChild = false;
  children.forEach((child) => {
    const isActive = samePage(child);
    child.classList.toggle("active", isActive);
    if (isActive) matchedChild = true;
  });

  const educationBase = absPath("pages/education");
  if (matchedChild || (educationBase && here.indexOf(educationBase) === 0)) {
    const toggle = dropdown.querySelector(".dropdown-toggle");
    if (toggle) toggle.classList.add("active");
  }
}

function bindBehavior(headerMount) {
  const header = headerMount.querySelector(".site-header");
  if (!header) return;

  const menuToggle = header.querySelector(".mobile-menu-toggle");
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      header.classList.toggle("nav-open");
    });
  }

  header.querySelectorAll(".nav-dropdown").forEach((item) => {
    const trigger = item.querySelector(".dropdown-toggle");
    if (!trigger) return;
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      item.classList.toggle("open");
    });
  });

  document.addEventListener("click", (event) => {
    if (header.classList.contains("nav-open") && !header.contains(event.target)) {
      header.classList.remove("nav-open");
    }
    headerMount.querySelectorAll(".nav-dropdown.open").forEach((item) => {
      if (!item.contains(event.target)) item.classList.remove("open");
    });
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const results = await Promise.all([
    injectPartial("site-header", "partials/header.html"),
    injectPartial("site-footer", "partials/footer.html"),
  ]);

  const headerMount = results[0];
  const footerMount = results[1];

  syncEducationDropdownFromFooter(headerMount, footerMount);

  if (headerMount) {
    applyActiveState(headerMount);
    bindBehavior(headerMount);
  }
});
