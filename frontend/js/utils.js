/**
 * utils.js
 * --------
 * Small, dependency-free helper functions shared across the frontend.
 */

const Utils = (() => {
  /** Debounce a function call. */
  function debounce(fn, wait = 250) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
  }

  /** Clamp a number between min/max. */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /** Format a number with thousands separators. */
  function formatNumber(value, decimals = 0) {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return Number(value).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /** Format a percentage from a 0-1 fraction. */
  function formatPercent(value, decimals = 1) {
    if (value === null || value === undefined || Number.isNaN(value)) return "--";
    return `${(value * 100).toFixed(decimals)}%`;
  }

  /** Format an ISO timestamp into a short readable string. */
  function formatTime(iso) {
    try {
      const date = new Date(iso);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  /**
   * Animate a number counting up from `from` to `to` inside `el.textContent`.
   * Uses requestAnimationFrame for smoothness and respects reduced motion.
   */
  function animateCounter(el, to, { from = 0, duration = 1200, decimals = 0, suffix = "" } = {}) {
    if (!el) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.textContent = formatNumber(to, decimals) + suffix;
      return;
    }
    const start = performance.now();
    const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    function tick(now) {
      const elapsed = now - start;
      const progress = clamp(elapsed / duration, 0, 1);
      const eased = easeOutExpo(progress);
      const current = from + (to - from) * eased;
      el.textContent = formatNumber(current, decimals) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /** Generate a short random id (for DOM element ids). */
  function uid(prefix = "id") {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /** Copy text to the clipboard, returns a Promise<boolean>. */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      let success = false;
      try {
        success = document.execCommand("copy");
      } catch {
        success = false;
      }
      document.body.removeChild(textarea);
      return success;
    }
  }

  /** Convert an array of flat objects to a CSV string. */
  function toCSV(rows) {
    if (!rows || !rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = (val) => {
      const str = String(val ?? "");
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [headers.join(",")];
    rows.forEach((row) => {
      lines.push(headers.map((h) => escape(row[h])).join(","));
    });
    return lines.join("\n");
  }

  /** Trigger a browser download of arbitrary text content. */
  function downloadTextFile(filename, content, mime = "text/plain") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /** Convert a title-case-friendly label from a snake_case column name. */
  function humanize(name) {
    return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return {
    debounce,
    clamp,
    formatNumber,
    formatPercent,
    formatTime,
    animateCounter,
    uid,
    copyToClipboard,
    toCSV,
    downloadTextFile,
    humanize,
  };
})();
