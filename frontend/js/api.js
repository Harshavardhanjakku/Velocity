/**
 * api.js
 * ------
 * All communication with the Flask backend. Wraps fetch() with a timeout,
 * automatic retry (for transient network errors only), and consistent
 * error shapes so the UI can render loading / error states uniformly.
 */

const Api = (() => {
  // Same-origin by default: app.py serves both the frontend and the API
  // together (locally on :5000, and on Render over standard HTTPS), so no
  // host/port guessing is needed. Only set window.BIKE_API_BASE_URL if you
  // are deliberately serving the frontend from a separate static server on
  // a different origin than the Flask API.
  const BASE_URL = window.BIKE_API_BASE_URL || "";

  const DEFAULT_TIMEOUT = 12000;
  const DEFAULT_RETRIES = 2;

  function withTimeout(promise, ms) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Request timed out. Please try again.")), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
  }

  async function request(path, { method = "GET", body, retries = DEFAULT_RETRIES, timeout = DEFAULT_TIMEOUT } = {}) {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await withTimeout(fetch(url, options), timeout);
        let payload;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        if (!res.ok) {
          const message = payload?.message || `Request failed with status ${res.status}`;
          const err = new Error(message);
          err.status = res.status;
          err.errors = payload?.errors;
          throw err;
        }
        return payload;
      } catch (err) {
        lastError = err;
        // Don't retry validation errors (4xx) -- only network/timeout issues.
        if (err.status && err.status < 500) break;
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
      }
    }
    throw lastError;
  }

  return {
    health: () => request("/health"),
    features: () => request("/features"),
    predict: (payload) => request("/predict", { method: "POST", body: payload }),
    metrics: () => request("/metrics"),
    modelInfo: () => request("/model-info"),
    history: (limit) => request(`/history${limit ? `?limit=${limit}` : ""}`),
    clearHistory: () => request("/history", { method: "DELETE" }),
    downloadJson: (data, filename) =>
      fetch(`${BASE_URL}/download-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, filename }),
      }),
    BASE_URL,
  };
})();