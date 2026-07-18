/**
 * charts.js
 * ---------
 * All chart rendering. Chart.js drives most panels; a single ApexCharts
 * area chart is used for the cumulative-rentals trend (per the requested
 * stack) so both charting libraries are represented deliberately rather
 * than redundantly.
 */

const Charts = (() => {
  let radarChart, trendChart, comparisonChart, histogramChart, importanceChart, apexAreaChart;

  function themeColors() {
    const styles = getComputedStyle(document.documentElement);
    return {
      text: styles.getPropertyValue("--text-secondary").trim(),
      grid: styles.getPropertyValue("--border-subtle").trim(),
      blue: styles.getPropertyValue("--accent-blue").trim(),
      purple: styles.getPropertyValue("--accent-purple").trim(),
      cyan: styles.getPropertyValue("--accent-cyan").trim(),
      green: styles.getPropertyValue("--accent-green").trim(),
      amber: styles.getPropertyValue("--accent-amber").trim(),
      surface: styles.getPropertyValue("--bg-elevated").trim(),
    };
  }

  const chartJsReady = typeof Chart !== "undefined";

  if (chartJsReady) {
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.displayColors = true;
  } else {
    console.warn("Chart.js failed to load from the CDN -- charts will be skipped.");
  }

  function baseGridOptions() {
    const c = themeColors();
    return {
      color: c.text,
      grid: { color: c.grid, drawTicks: false },
      ticks: { color: c.text, font: { size: 11 } },
    };
  }

  /** Radar chart: normalized current input feature values. */
  function renderFeatureRadar(canvasId, labels, values) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !chartJsReady) return;
    const c = themeColors();
    if (radarChart) radarChart.destroy();
    radarChart = new Chart(ctx, {
      type: "radar",
      data: {
        labels,
        datasets: [
          {
            label: "Current Inputs (normalized)",
            data: values,
            backgroundColor: "rgba(139, 92, 246, 0.18)",
            borderColor: c.purple,
            pointBackgroundColor: c.purple,
            borderWidth: 2,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: "easeOutQuart" },
        scales: {
          r: {
            angleLines: { color: c.grid },
            grid: { color: c.grid },
            pointLabels: { color: c.text, font: { size: 10 } },
            ticks: { display: false },
            suggestedMin: 0,
            suggestedMax: 1,
          },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  /** Horizontal bar: model-derived feature importance. */
  function renderFeatureImportance(canvasId, items) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !chartJsReady) return;
    const c = themeColors();
    if (importanceChart) importanceChart.destroy();
    const top = items.slice(0, 8);
    importanceChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: top.map((i) => Utils.humanize(i.feature)),
        datasets: [
          {
            label: "Relative Importance",
            data: top.map((i) => i.importance),
            backgroundColor: top.map((_, idx) =>
              `rgba(${idx % 2 === 0 ? "59,130,246" : "139,92,246"}, 0.75)`
            ),
            borderRadius: 8,
            barThickness: 16,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: "easeOutQuart" },
        scales: {
          x: { ...baseGridOptions(), beginAtZero: true },
          y: { ...baseGridOptions(), grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  /** Line chart: prediction trend across recent history entries. */
  function renderPredictionTrend(canvasId, labels, values) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !chartJsReady) return;
    const c = themeColors();
    if (trendChart) trendChart.destroy();
    const gradient = ctx.getContext("2d").createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, "rgba(6, 182, 212, 0.35)");
    gradient.addColorStop(1, "rgba(6, 182, 212, 0.0)");

    trendChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Predicted Rentals",
            data: values,
            borderColor: c.cyan,
            backgroundColor: gradient,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: c.cyan,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: "easeOutQuart" },
        interaction: { intersect: false, mode: "index" },
        scales: { x: baseGridOptions(), y: { ...baseGridOptions(), beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    });
  }

  /** Bar chart: current prediction vs average / min / max. */
  function renderComparison(canvasId, { current, average, min, max }) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !chartJsReady) return;
    const c = themeColors();
    if (comparisonChart) comparisonChart.destroy();
    comparisonChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Current", "Average", "Minimum", "Maximum"],
        datasets: [
          {
            data: [current, average, min, max],
            backgroundColor: [c.purple, c.blue, c.cyan, c.green],
            borderRadius: 10,
            barThickness: 34,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: "easeOutQuart" },
        scales: { x: { ...baseGridOptions(), grid: { display: false } }, y: { ...baseGridOptions(), beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    });
  }

  /** Histogram: distribution of all predicted values in history. */
  function renderHistogram(canvasId, values) {
    const ctx = document.getElementById(canvasId);
    if (!ctx || !chartJsReady) return;
    const c = themeColors();
    if (histogramChart) histogramChart.destroy();

    if (!values.length) {
      histogramChart = new Chart(ctx, { type: "bar", data: { labels: [], datasets: [] } });
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketCount = Math.min(8, Math.max(4, Math.ceil(Math.sqrt(values.length))));
    const bucketSize = Math.max(1, (max - min) / bucketCount || 1);
    const buckets = Array.from({ length: bucketCount }, () => 0);
    values.forEach((v) => {
      const idx = Utils.clamp(Math.floor((v - min) / bucketSize), 0, bucketCount - 1);
      buckets[idx]++;
    });
    const labels = buckets.map((_, i) =>
      `${Math.round(min + i * bucketSize)}-${Math.round(min + (i + 1) * bucketSize)}`
    );

    histogramChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Frequency",
            data: buckets,
            backgroundColor: "rgba(34, 197, 94, 0.65)",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: "easeOutQuart" },
        scales: { x: { ...baseGridOptions(), grid: { display: false } }, y: { ...baseGridOptions(), beginAtZero: true } },
        plugins: { legend: { display: false } },
      },
    });
  }

  /** ApexCharts area chart: cumulative predicted rentals over time. */
  function renderApexCumulative(elId, labels, values) {
    const el = document.querySelector(elId);
    if (!el || typeof ApexCharts === "undefined") return;

    let cumulative = 0;
    const cumulativeData = values.map((v) => (cumulative += v));

    const c = themeColors();
    const options = {
      chart: {
        type: "area",
        height: 260,
        toolbar: { show: false },
        background: "transparent",
        fontFamily: "Inter, sans-serif",
        animations: { enabled: true, easing: "easeinout", speed: 700 },
      },
      series: [{ name: "Cumulative Rentals", data: cumulativeData }],
      xaxis: {
        categories: labels,
        labels: { style: { colors: c.text, fontSize: "10px" } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { labels: { style: { colors: c.text, fontSize: "10px" } } },
      grid: { borderColor: c.grid, strokeDashArray: 4 },
      stroke: { curve: "smooth", width: 3 },
      fill: {
        type: "gradient",
        gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.02 },
      },
      colors: [c.blue],
      dataLabels: { enabled: false },
      tooltip: { theme: "dark" },
    };

    if (apexAreaChart) {
      apexAreaChart.updateOptions(options);
    } else {
      apexAreaChart = new ApexCharts(el, options);
      apexAreaChart.render();
    }
  }

  return {
    renderFeatureRadar,
    renderFeatureImportance,
    renderPredictionTrend,
    renderComparison,
    renderHistogram,
    renderApexCumulative,
  };
})();