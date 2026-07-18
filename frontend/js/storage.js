/**
 * storage.js
 * ----------
 * Thin wrapper around localStorage: theme preference + a client-side
 * mirror of prediction history (used for instant UI updates and CSV/JSON
 * export even if the backend history endpoint is unreachable).
 */

const Storage = (() => {
  const THEME_KEY = "bikepredict.theme";
  const HISTORY_KEY = "bikepredict.history";
  const MAX_LOCAL_HISTORY = 200;

  function getTheme() {
    return localStorage.getItem(THEME_KEY);
  }

  function setTheme(theme) {
    localStorage.setItem(THEME_KEY, theme);
  }

  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function setHistory(items) {
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(items.slice(-MAX_LOCAL_HISTORY))
      );
    } catch {
      /* storage full or unavailable -- fail silently, backend is source of truth */
    }
  }

  function addHistoryItem(item) {
    const items = getHistory();
    items.push(item);
    setHistory(items);
    return items;
  }

  function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  }

  return { getTheme, setTheme, getHistory, setHistory, addHistoryItem, clearHistory };
})();
