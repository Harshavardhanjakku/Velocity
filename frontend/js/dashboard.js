/**
 * dashboard.js
 * ------------
 * Orchestrates the entire prediction experience: builds the form straight
 * from GET /features, runs predictions, updates KPI cards + charts, and
 * manages the prediction history table (search / filter / export / delete).
 */

const Dashboard = (() => {
  let featureConfigs = [];
  let historyCache = [];
  let modelInfoCache = null;

  // ------------------------------------------------------------------
  // Toasts
  // ------------------------------------------------------------------
  function toast(type, title, message, duration = 4200) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const icons = {
      success: "fa-circle-check",
      error: "fa-circle-exclamation",
      info: "fa-circle-info",
      warning: "fa-triangle-exclamation",
    };
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `
      <i class="fa-solid ${icons[type] || icons.info} toast-icon"></i>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
      </div>
      <button class="toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>
    `;
    stack.appendChild(el);
    el.querySelector(".toast-close").addEventListener("click", () => dismiss(el));
    const timer = setTimeout(() => dismiss(el), duration);
    el.addEventListener("mouseenter", () => clearTimeout(timer));

    function dismiss(node) {
      node.classList.add("hide");
      setTimeout(() => node.remove(), 300);
    }
  }

  // ------------------------------------------------------------------
  // Dynamic form generation
  // ------------------------------------------------------------------
  function fieldTemplate(cfg) {
    const id = `field-${cfg.name}`;
    let control = "";

    if (cfg.type === "select") {
      const options = (cfg.options || [])
        .map((o) => `<option value="${o.value}">${o.label}</option>`)
        .join("");
      control = `<select id="${id}" name="${cfg.name}" data-field>${options}</select>`;
    } else if (cfg.type === "slider") {
      control = `
        <div class="range-row">
          <input type="range" id="${id}" name="${cfg.name}" data-field
                 min="${cfg.min}" max="${cfg.max}" step="${cfg.step}" value="${cfg.default}">
          <span class="range-value" data-range-value>${cfg.default}</span>
        </div>`;
    } else {
      control = `<input type="number" id="${id}" name="${cfg.name}" data-field
                   min="${cfg.min ?? ""}" max="${cfg.max ?? ""}" step="${cfg.step ?? "any"}"
                   value="${cfg.default ?? 0}">`;
    }

    return `
      <div class="card glass field-card" data-tilt data-reveal>
        <div class="field-head">
          <div class="field-label-group">
            <div class="field-icon"><i class="fa-solid ${cfg.icon || "fa-sliders"}"></i></div>
            <div class="field-label">${cfg.label}</div>
          </div>
          <span class="tooltip-trigger" tabindex="0">
            <i class="fa-solid fa-circle-info"></i>
            <span class="tooltip-bubble">${cfg.tooltip || "Model input feature."}</span>
          </span>
        </div>
        <div class="field-control">${control}</div>
        <div class="field-error" data-error></div>
      </div>`;
  }

  function buildForm(configs) {
    const grid = document.getElementById("prediction-form-grid");
    if (!grid) return;
    grid.innerHTML = configs.map(fieldTemplate).join("");

    // Wire live range value labels + validation on every field.
    configs.forEach((cfg) => {
      const input = document.getElementById(`field-${cfg.name}`);
      if (!input) return;
      const card = input.closest(".field-card");
      const errorEl = card.querySelector("[data-error]");
      const rangeValueEl = card.querySelector("[data-range-value]");

      const handleInput = () => {
        if (rangeValueEl) rangeValueEl.textContent = input.value;
        const err = Validation.validateField(input.value, cfg);
        input.classList.toggle("invalid", Boolean(err));
        errorEl.textContent = err || "";
      };

      input.addEventListener("input", handleInput);
      handleInput();
    });

    Animations.refresh();
  }

  function collectFormValues() {
    const values = {};
    document.querySelectorAll("[data-field]").forEach((el) => {
      values[el.name] = el.value;
    });
    return values;
  }

  // ------------------------------------------------------------------
  // Result card rendering
  // ------------------------------------------------------------------
  function classifyLevel(prediction, avg) {
    if (!avg || avg <= 0) return { key: "moderate", label: "Moderate Demand" };
    const ratio = prediction / avg;
    if (ratio < 0.6) return { key: "low", label: "Low Demand" };
    if (ratio < 1.15) return { key: "moderate", label: "Moderate Demand" };
    if (ratio < 1.6) return { key: "high", label: "High Demand" };
    return { key: "veryhigh", label: "Very High Demand" };
  }

  function recommendationFor(levelKey) {
    const map = {
      low: "Demand looks light for this window. Good time for maintenance or fleet rebalancing.",
      moderate: "Demand is within the typical range. Standard fleet allocation should suffice.",
      high: "Expect elevated ridership. Consider redistributing bikes toward high-traffic docks.",
      veryhigh: "Surge conditions likely. Deploy additional bikes and monitor dock capacity closely.",
    };
    return map[levelKey] || map.moderate;
  }

  function renderResultCard(record, historyStats) {
    const wrap = document.getElementById("result-card");
    if (!wrap) return;
    wrap.classList.remove("hidden");

    const numberEl = document.getElementById("result-number");
    Utils.animateCounter(numberEl, record.prediction, { duration: 1100 });

    const level = classifyLevel(record.prediction, historyStats.average);
    const statusEl = document.getElementById("result-status");
    statusEl.className = `result-status ${level.key}`;
    statusEl.textContent = level.label;

    document.getElementById("result-recommendation").textContent = recommendationFor(level.key);
    document.getElementById("result-time").textContent = Utils.formatTime(record.timestamp);
    document.getElementById("result-confidence").textContent =
      modelInfoCache?.feature_importance?.length ? "Model-scored" : "--";

    // Animate the circular gauge ring.
    const ring = document.getElementById("result-ring-fg");
    if (ring) {
      const radius = 80;
      const circumference = 2 * Math.PI * radius;
      const maxForRing = Math.max(historyStats.max || 1, record.prediction, 1);
      const fraction = Utils.clamp(record.prediction / (maxForRing * 1.1), 0.03, 1);
      ring.style.strokeDasharray = `${circumference}`;
      ring.style.strokeDashoffset = `${circumference}`;
      requestAnimationFrame(() => {
        ring.style.strokeDashoffset = `${circumference * (1 - fraction)}`;
      });
    }

    window._lastResult = record;
  }

  // ------------------------------------------------------------------
  // KPI + stats
  // ------------------------------------------------------------------
  function computeStats(history) {
    const values = history.map((h) => h.prediction).filter((v) => typeof v === "number");
    if (!values.length) return { average: 0, max: 0, min: 0, latest: 0, trendPct: 0 };
    const average = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const latest = values[values.length - 1];
    const prev = values.length > 1 ? values[values.length - 2] : latest;
    const trendPct = prev ? ((latest - prev) / prev) * 100 : 0;
    return { average, max, min, latest, trendPct };
  }

  function updateKpis(stats) {
    Utils.animateCounter(document.getElementById("kpi-current"), stats.latest, { duration: 900 });
    Utils.animateCounter(document.getElementById("kpi-average"), Math.round(stats.average), { duration: 900 });
    Utils.animateCounter(document.getElementById("kpi-max"), stats.max, { duration: 900 });
    Utils.animateCounter(document.getElementById("kpi-min"), stats.min, { duration: 900 });

    const trendEl = document.getElementById("kpi-trend");
    if (trendEl) {
      const up = stats.trendPct >= 0;
      trendEl.className = `kpi-trend ${up ? "up" : "down"}`;
      trendEl.innerHTML = `<i class="fa-solid ${up ? "fa-arrow-trend-up" : "fa-arrow-trend-down"}"></i> ${Math.abs(stats.trendPct).toFixed(1)}%`;
    }
  }

  function updateModelStatusKpis(health) {
    const statusEl = document.getElementById("kpi-model-status");
    if (statusEl) statusEl.textContent = health.model_loaded ? "Online" : "Offline";
    const apiEl = document.getElementById("kpi-api-status");
    if (apiEl) apiEl.textContent = "Connected";
  }

  function tickClock() {
    const el = document.getElementById("kpi-time");
    if (el) el.textContent = new Date().toLocaleTimeString();
  }

  // ------------------------------------------------------------------
  // History table
  // ------------------------------------------------------------------
  function renderHistoryTable(history, filterText = "") {
    const tbody = document.getElementById("history-tbody");
    const emptyEl = document.getElementById("history-empty");
    if (!tbody) return;

    const filtered = filterText
      ? history.filter((h) => JSON.stringify(h.inputs).toLowerCase().includes(filterText.toLowerCase()))
      : history;

    if (!filtered.length) {
      tbody.innerHTML = "";
      if (emptyEl) emptyEl.classList.remove("hidden");
      return;
    }
    if (emptyEl) emptyEl.classList.add("hidden");

    tbody.innerHTML = filtered
      .slice(0, 50)
      .map(
        (h) => `
      <tr>
        <td>${Utils.formatTime(h.timestamp)}</td>
        <td>${Utils.formatNumber(h.prediction)}</td>
        <td>${Object.keys(h.inputs || {}).length} features</td>
        <td><button class="row-action" data-delete-id="${h.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button></td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-delete-id]").forEach((btn) => {
      btn.addEventListener("click", () => deleteHistoryItem(btn.dataset.deleteId));
    });
  }

  function deleteHistoryItem(id) {
    historyCache = historyCache.filter((h) => h.id !== id);
    Storage.setHistory(historyCache);
    renderHistoryTable(historyCache, document.getElementById("history-search")?.value || "");
    refreshAnalytics();
    toast("info", "Removed", "Prediction removed from history.");
  }

  async function clearAllHistory() {
    try {
      await Api.clearHistory();
    } catch {
      /* backend may be unreachable -- still clear local copy */
    }
    historyCache = [];
    Storage.clearHistory();
    renderHistoryTable(historyCache);
    refreshAnalytics();
    toast("success", "History cleared", "All predictions have been removed.");
  }

  // ------------------------------------------------------------------
  // Charts + analytics refresh
  // ------------------------------------------------------------------
  function refreshAnalytics() {
    const stats = computeStats(historyCache);
    updateKpis(stats);

    const recent = historyCache.slice(-12);
    Charts.renderPredictionTrend(
      "chart-trend",
      recent.map((h) => Utils.formatTime(h.timestamp)),
      recent.map((h) => h.prediction)
    );
    Charts.renderComparison("chart-comparison", {
      current: stats.latest,
      average: Math.round(stats.average),
      min: stats.min,
      max: stats.max,
    });
    Charts.renderHistogram(
      "chart-histogram",
      historyCache.map((h) => h.prediction)
    );
    Charts.renderApexCumulative(
      "#chart-apex-cumulative",
      recent.map((h) => Utils.formatTime(h.timestamp)),
      recent.map((h) => h.prediction)
    );

    if (window._lastResult) {
      renderResultCard(window._lastResult, stats);
    }
  }

  function renderFeatureRadarFromValues(values) {
    if (!featureConfigs.length) return;
    const labels = featureConfigs.map((c) => Utils.humanize(c.name));
    const normalized = featureConfigs.map((c) => {
      const raw = Number(values[c.name]);
      if (c.type === "select") {
        const opts = (c.options || []).map((o) => Number(o.value));
        const max = Math.max(...opts, 1);
        return max ? raw / max : 0;
      }
      const min = typeof c.min === "number" ? c.min : 0;
      const max = typeof c.max === "number" ? c.max : Math.max(raw, 1);
      return max !== min ? (raw - min) / (max - min) : 0;
    });
    Charts.renderFeatureRadar("chart-radar", labels, normalized);
  }

  // ------------------------------------------------------------------
  // Model info + metrics panels
  // ------------------------------------------------------------------
  function renderMetricRing(elId, value, max, colorVar) {
    const el = document.getElementById(elId);
    if (!el) return;
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const fraction = Utils.clamp(value / max, 0, 1);
    const fg = el.querySelector(".metric-ring-fg");
    fg.style.stroke = `var(${colorVar})`;
    fg.setAttribute("stroke-dasharray", circumference);
    fg.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
      fg.style.strokeDashoffset = circumference * (1 - fraction);
    });
  }

  function renderMetrics(metrics) {
    const banner = document.getElementById("metrics-unavailable");
    if (!metrics.available) {
      if (banner) banner.classList.remove("hidden");
      return;
    }
    if (banner) banner.classList.add("hidden");

    document.getElementById("metric-rmse-value").textContent = Utils.formatNumber(metrics.rmse, 2);
    document.getElementById("metric-mae-value").textContent = Utils.formatNumber(metrics.mae, 2);
    document.getElementById("metric-r2-value").textContent = Utils.formatNumber(metrics.r2, 3);
    document.getElementById("metric-acc-value").textContent = Utils.formatPercent(metrics.accuracy, 1);

    renderMetricRing("metric-r2-ring", metrics.r2 || 0, 1, "--accent-green");
    renderMetricRing("metric-acc-ring", metrics.accuracy || 0, 1, "--accent-blue");
    // RMSE/MAE don't have a natural 0-1 ceiling -- ring reflects "closeness to 0" against a soft cap.
    const softCap = Math.max(metrics.rmse, metrics.mae, 100) * 1.4;
    renderMetricRing("metric-rmse-ring", 1 - Utils.clamp(metrics.rmse / softCap, 0, 1), 1, "--accent-purple");
    renderMetricRing("metric-mae-ring", 1 - Utils.clamp(metrics.mae / softCap, 0, 1), 1, "--accent-amber");
  }

  function renderModelInfo(info) {
    const archFlow = document.getElementById("arch-flow");
    if (archFlow) {
      const nodes = info.layers.map(
        (l) => `<div class="card neu arch-node"><div class="n">${l.units}</div><div class="l">${l.name}${l.activation ? ` · ${l.activation}` : ""}</div></div>`
      );
      archFlow.innerHTML = nodes.join('<i class="fa-solid fa-arrow-right-long arch-arrow"></i>');
    }

    const rows = [
      ["Framework", info.framework],
      ["Optimizer", info.optimizer],
      ["Loss Function", info.loss_function],
      ["Scaler", info.scaler],
      ["Epochs", info.epochs],
      ["Batch Size", info.batch_size],
      ["Learning Rate", info.learning_rate],
      ["Weight Decay", info.weight_decay],
      ["Input Features", info.input_features],
    ];
    const listEl = document.getElementById("model-info-list");
    if (listEl) {
      listEl.innerHTML = rows
        .map(([k, v]) => `<div class="info-row"><span class="k">${k}</span><span class="v">${v}</span></div>`)
        .join("");
    }

    if (info.feature_importance?.length) {
      Charts.renderFeatureImportance("chart-importance", info.feature_importance);
    }
  }

  // ------------------------------------------------------------------
  // Prediction flow
  // ------------------------------------------------------------------
  async function runPrediction() {
    const values = collectFormValues();
    const { valid, errors } = Validation.validateForm(values, featureConfigs);

    if (!valid) {
      Object.entries(errors).forEach(([name, msg]) => {
        const input = document.getElementById(`field-${name}`);
        const card = input?.closest(".field-card");
        if (card) {
          card.querySelector("[data-error]").textContent = msg;
          input.classList.add("invalid");
        }
      });
      toast("warning", "Check your inputs", "Some fields need attention before predicting.");
      return;
    }

    const btn = document.getElementById("predict-btn");
    const originalLabel = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="loader-ring" style="width:18px;height:18px;border-width:2px;"></span> Predicting...`;

    try {
      const res = await Api.predict(values);
      const record = res.data;
      historyCache.push(record);
      Storage.addHistoryItem(record);
      renderHistoryTable(historyCache, document.getElementById("history-search")?.value || "");
      refreshAnalytics();
      renderFeatureRadarFromValues(values);
      renderResultCard(record, computeStats(historyCache));
      toast("success", "Prediction complete", `Estimated ${Utils.formatNumber(record.prediction)} rentals.`);
      document.getElementById("result-anchor")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      toast("error", "Prediction failed", err.message || "Please check the backend connection.");
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalLabel;
    }
  }

  // ------------------------------------------------------------------
  // Export / actions
  // ------------------------------------------------------------------
  function exportCsv() {
    if (!historyCache.length) return toast("warning", "Nothing to export", "Run a prediction first.");
    const rows = historyCache.map((h) => ({ timestamp: h.timestamp, prediction: h.prediction, ...h.inputs }));
    Utils.downloadTextFile("bike_rental_history.csv", Utils.toCSV(rows), "text/csv");
    toast("success", "Exported", "CSV file downloaded.");
  }

  async function exportJson() {
    if (!historyCache.length) return toast("warning", "Nothing to export", "Run a prediction first.");
    try {
      const res = await Api.downloadJson(historyCache, "bike_rental_history.json");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bike_rental_history.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      Utils.downloadTextFile("bike_rental_history.json", JSON.stringify(historyCache, null, 2), "application/json");
    }
    toast("success", "Exported", "JSON file downloaded.");
  }

  async function copyResult() {
    if (!window._lastResult) return toast("warning", "No result yet", "Run a prediction first.");
    const text = `Predicted bike rentals: ${window._lastResult.prediction} (generated ${Utils.formatTime(window._lastResult.timestamp)})`;
    const ok = await Utils.copyToClipboard(text);
    toast(ok ? "success" : "error", ok ? "Copied" : "Copy failed", ok ? "Result copied to clipboard." : "Clipboard access was blocked.");
  }

  function printReport() {
    window.print();
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  async function init() {
    historyCache = Storage.getHistory();

    try {
      const [healthRes, featuresRes, metricsRes, modelInfoRes] = await Promise.all([
        Api.health(),
        Api.features(),
        Api.metrics(),
        Api.modelInfo(),
      ]);

      updateModelStatusKpis(healthRes.data);
      if (!healthRes.data.model_loaded) {
        toast(
          "warning",
          "Model not loaded",
          healthRes.data.load_error || "Predictions will fail until the model artifacts load correctly."
        );
      }
      featureConfigs = featuresRes.data.features;
      buildForm(featureConfigs);
      renderMetrics(metricsRes.data);
      modelInfoCache = modelInfoRes.data;
      renderModelInfo(modelInfoRes.data);

      try {
        const historyRes = await Api.history(100);
        if (historyRes?.data?.history?.length) {
          historyCache = [...historyRes.data.history].reverse();
          Storage.setHistory(historyCache);
        }
      } catch {
        /* fall back to local cache */
      }

      renderHistoryTable(historyCache);
      refreshAnalytics();
      renderFeatureRadarFromValues(collectFormValues());

      toast("success", "Model ready", `${featureConfigs.length} input features loaded.`);
    } catch (err) {
      toast(
        "error",
        "Backend unreachable",
        err.message || "Start the Flask server (python backend/app.py) so predictions can run."
      );
      const formGrid = document.getElementById("prediction-form-grid");
      if (formGrid) {
        formGrid.innerHTML = `<div class="card glass" style="grid-column:1/-1;padding:2rem;text-align:center;color:var(--text-secondary);">
          <strong>${err.message || "Could not load model features."}</strong><br>
          Confirm the backend is running at <code>${Api.BASE_URL}</code> and that
          <code>bike_rental_model.pth</code>, <code>scaler.pkl</code>, and
          <code>feature_columns.pkl</code> are all present in <code>backend/</code>.
        </div>`;
      }
    }

    const el = document.getElementById("kpi-time");
    if (el) {
      tickClock();
      setInterval(tickClock, 1000);
    }
  }

  return {
    init,
    runPrediction,
    exportCsv,
    exportJson,
    copyResult,
    printReport,
    clearAllHistory,
    renderHistoryTable: () => renderHistoryTable(historyCache, document.getElementById("history-search")?.value || ""),
    getHistoryCache: () => historyCache,
    toast,
  };
})();
