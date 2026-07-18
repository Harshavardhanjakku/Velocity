/**
 * app.js
 * ------
 * Bootstraps the whole page: theme handling, navbar behaviour, page loader,
 * mobile navigation, fullscreen toggle, keyboard shortcuts, scroll-to-top,
 * and wiring every interactive control to Dashboard / Animations.
 */

(() => {
  function initTheme() {
    const root = document.documentElement;
    const stored = Storage.getTheme();
    const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    const initial = stored || (prefersLight ? "light" : "dark");
    root.setAttribute("data-theme", initial);
    updateThemeIcon(initial);

    document.getElementById("theme-toggle")?.addEventListener("click", () => {
      const current = root.getAttribute("data-theme");
      const next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      Storage.setTheme(next);
      updateThemeIcon(next);
      // Charts read CSS variables at render time -- refresh existing ones.
      if (Dashboard.getHistoryCache().length) {
        setTimeout(() => Dashboard.renderHistoryTable(), 50);
      }
    });
  }

  function updateThemeIcon(theme) {
    const icon = document.querySelector("#theme-toggle i");
    if (!icon) return;
    icon.className = theme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }

  function initPageLoader() {
    const loader = document.getElementById("page-loader");
    if (!loader) return;
    window.addEventListener("load", () => {
      setTimeout(() => loader.classList.add("loaded"), 400);
    });
    // Safety net in case the load event already fired.
    setTimeout(() => loader.classList.add("loaded"), 3000);
  }

  function initNavbarScroll() {
    const nav = document.getElementById("navbar");
    if (!nav) return;
    const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  function initMobileNav() {
    const toggle = document.getElementById("nav-toggle");
    const mobileNav = document.getElementById("mobile-nav");
    if (!toggle || !mobileNav) return;
    toggle.addEventListener("click", () => {
      mobileNav.classList.toggle("open");
      const isOpen = mobileNav.classList.contains("open");
      toggle.querySelector("i").className = isOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars";
      document.body.classList.toggle("no-scroll", isOpen);
    });
    mobileNav.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => {
        mobileNav.classList.remove("open");
        toggle.querySelector("i").className = "fa-solid fa-bars";
        document.body.classList.remove("no-scroll");
      })
    );
  }

  function initFullscreen() {
    document.getElementById("fullscreen-toggle")?.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  function initScrollTop() {
    const btn = document.getElementById("scroll-top-btn");
    if (!btn) return;
    window.addEventListener(
      "scroll",
      () => btn.classList.toggle("visible", window.scrollY > 600),
      { passive: true }
    );
    btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      const tag = document.activeElement?.tagName;
      const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";

      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        Dashboard.runPrediction();
      }
      if (e.key === "Escape") {
        closeModal();
        document.getElementById("mobile-nav")?.classList.remove("open");
      }
      if (!typing && e.key === "/") {
        e.preventDefault();
        document.getElementById("history-search")?.focus();
      }
    });
  }

  function initModal() {
    const overlay = document.getElementById("confirm-modal");
    document.getElementById("clear-history-btn")?.addEventListener("click", () => openModal());
    overlay?.querySelector("[data-modal-close]")?.addEventListener("click", closeModal);
    overlay?.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.getElementById("confirm-clear-btn")?.addEventListener("click", () => {
      Dashboard.clearAllHistory();
      closeModal();
    });
  }

  function openModal() {
    document.getElementById("confirm-modal")?.classList.add("open");
  }

  function closeModal() {
    document.getElementById("confirm-modal")?.classList.remove("open");
  }

  function initHistoryToolbar() {
    const search = document.getElementById("history-search");
    search?.addEventListener(
      "input",
      Utils.debounce(() => {
        const filtered = Dashboard.getHistoryCache();
        // Dashboard.renderHistoryTable reads the search box itself.
        Dashboard.renderHistoryTable();
      }, 200)
    );
  }

  function initActionButtons() {
    document.getElementById("predict-btn")?.addEventListener("click", () => Dashboard.runPrediction());
    document.getElementById("export-csv-btn")?.addEventListener("click", () => Dashboard.exportCsv());
    document.getElementById("export-json-btn")?.addEventListener("click", () => Dashboard.exportJson());
    document.getElementById("copy-result-btn")?.addEventListener("click", () => Dashboard.copyResult());
    document.getElementById("print-report-btn")?.addEventListener("click", () => Dashboard.printReport());
    document.getElementById("hero-predict-btn")?.addEventListener("click", () => {
      document.getElementById("predict")?.scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("share-btn")?.addEventListener("click", async () => {
      const shareData = {
        title: "Bike Rental Prediction Dashboard",
        text: "Check out this AI-powered bike rental demand dashboard.",
        url: window.location.href,
      };
      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {
          /* user cancelled -- no-op */
        }
      } else {
        const ok = await Utils.copyToClipboard(window.location.href);
        Dashboard.toast(ok ? "success" : "error", ok ? "Link copied" : "Share unavailable", ok ? "Page URL copied to clipboard." : "Try copying the URL manually.");
      }
    });
  }

  function initActiveNavHighlight() {
    const sections = document.querySelectorAll("main section[id]");
    const links = document.querySelectorAll(".nav-links a, .mobile-nav a");
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === `#${entry.target.id}`));
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initPageLoader();
    initNavbarScroll();
    initMobileNav();
    initFullscreen();
    initScrollTop();
    initKeyboardShortcuts();
    initModal();
    initHistoryToolbar();
    initActionButtons();
    initActiveNavHighlight();

    Animations.initParticles();
    Animations.initCursorGlow();
    Animations.initScrollReveal();
    Animations.initRipple();
    Animations.initTilt();

    Dashboard.init();
  });
})();
