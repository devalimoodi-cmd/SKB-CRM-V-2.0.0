// ================================================================
// chart-dashboard.service.js
// سرویس نمودارهای تحلیلی داینامیک (تب داشبورد اطلاعات مشتری)
// همه شاخص‌ها با فرمول‌های یکسان بخش هفتگی (weekly.calculations.js) محاسبه می‌شوند
// ================================================================

import { chartDashboardApi } from "./chart-dashboard.api.js";
import { chartDashboardRenderer } from "./chart-dashboard.renderer.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  findStandard,
  getInitialWeightKg,
  birdsStartOfWeek,
  birdsEndOfWeek,
  weeklyMortalityPercent,
  totalMortalityPercent,
  weeklyGain,
  dailyGain,
  fcrUpToWeek,
  standardWeeklyGain,
} from "../weekly/weekly.calculations.js";

// ===== پالت رنگ گله‌ها =====
const PALETTE = [
  "#2c7a6e",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#0ea5e9",
  "#10b981",
  "#f97316",
  "#e11d48",
  "#64748b",
];

// ===== تعریف شاخص‌های نمودار داینامیک اصلی =====
const MAIN_INDICATORS = {
  weight: {
    title: "وزنگیری (روند وزن هفتگی)",
    key: "weight",
    stdKey: "stdWeight",
    yLabel: "وزن (کیلوگرم)",
    decimals: 2,
    unit: "kg",
  },
  gain: {
    title: "افزایش وزن هفتگی",
    key: "weightGain",
    stdKey: "stdGain",
    yLabel: "افزایش وزن (کیلوگرم)",
    decimals: 3,
    unit: "kg",
  },
  dailyGain: {
    title: "نرخ رشد روزانه",
    key: "dailyGainGrams",
    stdKey: "stdDailyGainGrams",
    yLabel: "گرم در روز",
    decimals: 1,
    unit: "گرم",
  },
};

class ChartDashboardService {
  constructor() {
    this.customerId = null;
    this.flocks = []; // هر گله: { flock, weeks, standards, series, color }
    this.selectedFlockIds = [];
    this.weekCount = 8;
    this.mainIndicator = "weight";
    this.mortalityMode = "weekly";
    this.survivalMode = "cumulative";
    this.showStandards = true;
    this.showDataLabels = false;
    this.showTooltip = true;
    this.seriesSettings = {}; // تنظیمات سری‌های نمودار اصلی: { key: {visible,color,lineType} }
    this.lineWidth = 2;
    this.pointSize = 4;
    this.chartInstances = {};
    this.initialized = false;
  }

  // ===== مقداردهی =====
  async init(customerId) {
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    await this.loadData();
    this.initialized = true;
    console.log("✅ ChartDashboardService (تحلیلی) initialized");
  }

  async loadData() {
    try {
      const res = await chartDashboardApi.getAnalysis(this.customerId);
      if (!res.success) throw new Error(res.message || "خطا در دریافت داده");

      const rawFlocks = res.data.flocks || [];
      this.flocks = rawFlocks.map((f, i) => ({
        ...f,
        color: PALETTE[i % PALETTE.length],
        series: this.computeSeries(f),
      }));

      // انتخاب همه گله‌ها به‌صورت پیش‌فرض
      this.selectedFlockIds = this.flocks.map((f) => f.flock.id);

      // حداکثر تعداد هفته‌ها
      let maxWeek = 0;
      this.flocks.forEach((f) =>
        f.weeks.forEach((w) => {
          if (w.week_number > maxWeek) maxWeek = w.week_number;
        }),
      );
      this.weekCount = Math.max(2, Math.min(maxWeek || 2, 16));

      // تنظیمات سری‌ها با هر بار لود داده ریست می‌شوند
      this.seriesSettings = {};

      this.destroyCharts();
      chartDashboardRenderer.renderContainer(this.flocks, this.selectedFlockIds, this.weekCount, {
        mainIndicator: this.mainIndicator,
      });
      this.renderAllCharts();
    } catch (error) {
      console.error("❌ Error loading analysis data:", error);
      notificationService.error("خطا در دریافت داده‌های تحلیلی");
    }
  }

  // ===== محاسبه سری شاخص‌ها برای یک گله (بر اساس فرمول‌های هفتگی) =====
  computeSeries(flock) {
    const weeks = [...(flock.weeks || [])].sort(
      (a, b) => (a.week_number || 0) - (b.week_number || 0),
    );
    const standards = flock.standards || [];
    const initialChicks = parseFloat(flock.flock.totalChicks) || 0;
    const initialWeightKg = getInitialWeightKg(flock.flock.avgInitialWeightGrams);

    const weightMap = {};
    const feedMap = {};
    const mortalityMap = {};
    weeks.forEach((w) => {
      const v = parseFloat(w.weekly_weight);
      weightMap[w.week_number] = isNaN(v) ? null : v;
      const f = parseFloat(w.weekly_feed_intake);
      feedMap[w.week_number] = isNaN(f) ? null : f;
      mortalityMap[w.week_number] = parseInt(w.weekly_mortality) || 0;
    });

    return weeks.map((w) => {
      const wn = w.week_number;
      const weight = weightMap[wn];
      const std = findStandard(standards, wn);
      const gain = weeklyGain(weightMap, wn, initialWeightKg);
      const dGain = dailyGain(weightMap, wn, initialWeightKg);
      const birdsStart = birdsStartOfWeek(initialChicks, mortalityMap, wn);
      const birdsEnd = birdsEndOfWeek(initialChicks, mortalityMap, wn);
      const stdGain = standardWeeklyGain(standards, wn, initialWeightKg);

      return {
        week: wn,
        weekStart: w.week_start_date,
        weekEnd: w.week_end_date,
        ageDays: w.flock_age_days,
        weight,
        weightGain: gain,
        dailyGainGrams: dGain !== null ? dGain * 1000 : null,
        totalLiveWeight:
          weight !== null && birdsEnd > 0 ? weight * birdsEnd : null,
        totalWeightGain:
          weight !== null && birdsEnd > 0
            ? (weight - initialWeightKg) * birdsEnd
            : null,
        fcr: fcrUpToWeek(
          weightMap,
          feedMap,
          mortalityMap,
          initialChicks,
          wn,
        ),
        mortalityCount: parseInt(w.weekly_mortality) || 0,
        mortalityPctWeekly: weeklyMortalityPercent(
          initialChicks,
          mortalityMap,
          wn,
        ),
        mortalityPctTotal: totalMortalityPercent(
          initialChicks,
          mortalityMap,
          wn,
        ),
        survivalPctWeekly:
          birdsStart > 0 ? (birdsEnd / birdsStart) * 100 : null,
        survivalPctCumulative:
          initialChicks > 0 ? (birdsEnd / initialChicks) * 100 : null,
        blackoutHours: parseFloat(w.blackout_hours) || 0,
        stdWeight:
          std && std.target_weight != null
            ? parseFloat(std.target_weight)
            : null,
        stdMin: std && std.min_weight != null ? parseFloat(std.min_weight) : null,
        stdMax: std && std.max_weight != null ? parseFloat(std.max_weight) : null,
        stdGain,
        stdDailyGainGrams: stdGain !== null ? (stdGain / 7) * 1000 : null,
        stdFcr:
          std && std.standard_fcr != null
            ? parseFloat(std.standard_fcr)
            : null,
      };
    });
  }

  // ===== ابزارهای کمکی =====
  getWeekLabels() {
    const arr = [];
    for (let w = 1; w <= this.weekCount; w++) arr.push(`هفته ${w}`);
    return arr;
  }

  getFlockDataByWeek(flock, key) {
    const map = {};
    (flock.series || []).forEach((s) => {
      map[s.week] = s[key];
    });
    const arr = [];
    for (let w = 1; w <= this.weekCount; w++) {
      arr.push(map[w] !== undefined ? map[w] : null);
    }
    return arr;
  }

  getSelectedFlocks() {
    return this.flocks.filter((f) =>
      this.selectedFlockIds.includes(f.flock.id),
    );
  }

  flockLabel(f) {
    return `گله ${f.flock.flockNumber}`;
  }

  // ===== تنظیمات سری‌های نمودار اصلی =====
  getLineDash(type, fallback = []) {
    if (type === "dashed") return [6, 4];
    if (type === "dotted") return [2, 3];
    if (type === "solid") return [];
    return fallback;
  }

  ensureSeriesItem(key, label, defaultColor, defaultLineType) {
    if (!this.seriesSettings[key]) {
      this.seriesSettings[key] = {
        visible: true,
        color: defaultColor,
        lineType: defaultLineType,
      };
    }
    const s = this.seriesSettings[key];
    return {
      key,
      label,
      visible: s.visible !== false,
      color: s.color || defaultColor,
      lineType: s.lineType || defaultLineType,
    };
  }

  collectMainSeries() {
    const items = [];
    this.getSelectedFlocks().forEach((f) => {
      const label = this.flockLabel(f);
      items.push(
        this.ensureSeriesItem(
          `flock:${f.flock.id}:actual`,
          label,
          f.color,
          "solid",
        ),
      );
      if (this.showStandards) {
        items.push(
          this.ensureSeriesItem(
            `flock:${f.flock.id}:max`,
            `${label} (حداکثر)`,
            f.color,
            "dashed",
          ),
        );
        items.push(
          this.ensureSeriesItem(
            `flock:${f.flock.id}:min`,
            `${label} (حداقل)`,
            f.color,
            "dashed",
          ),
        );
      }
    });
    return items;
  }

  renderMainSeriesControls() {
    chartDashboardRenderer.renderSeriesControls(this.collectMainSeries());
  }

  toggleSeries(key, checked) {
    if (!this.seriesSettings[key]) return;
    this.seriesSettings[key].visible = checked;
    this.renderAllCharts();
  }

  setSeriesColor(key, color) {
    if (!this.seriesSettings[key]) return;
    this.seriesSettings[key].color = color;
    this.renderAllCharts();
  }

  setSeriesLineType(key, type) {
    if (!this.seriesSettings[key]) return;
    this.seriesSettings[key].lineType = type;
    this.renderAllCharts();
  }

  // ===== ساخت دیتاست گله‌ها برای یک شاخص =====
  buildFlockDatasets(flocks, key, opts = {}) {
    const datasets = [];
    flocks.forEach((f) => {
      const color = f.color;
      const label = this.flockLabel(f);
      const useSettings = opts.useSeriesSettings === true;

      // سری اصلی (مقدار واقعی)
      const actualKey = `flock:${f.flock.id}:actual`;
      const sActual = useSettings ? this.seriesSettings[actualKey] : null;
      if (useSettings && sActual && sActual.visible === false) return;

      const actualColor = (useSettings && sActual?.color) || color;
      const actualDash = useSettings
        ? this.getLineDash(sActual?.lineType, [])
        : [];

      datasets.push({
        label,
        data: this.getFlockDataByWeek(f, key),
        borderColor: actualColor,
        borderDash: actualDash,
        backgroundColor: actualColor + "22",
        fill: opts.fill === true,
        tension: 0.3,
        borderWidth: this.lineWidth,
        pointRadius: this.pointSize,
      });

      if (opts.stdKey && this.showStandards) {
        // خط میانگین استاندارد (اختیاری — در نمودار اصلی حذف شده است)
        if (opts.showMeanLine !== false) {
          const stdKey = `flock:${f.flock.id}:std`;
          const sStd = useSettings ? this.seriesSettings[stdKey] : null;
          if (!(useSettings && sStd && sStd.visible === false)) {
            const stdColor = (useSettings && sStd?.color) || color;
            datasets.push({
              label: `${label} (میانگین استاندارد)`,
              data: this.getFlockDataByWeek(f, opts.stdKey),
              borderColor: stdColor,
              borderDash: useSettings
                ? this.getLineDash(sStd?.lineType, [6, 4])
                : [6, 4],
              borderWidth: 2,
              pointRadius: 0,
              fill: false,
            });
          }
        }

        if (opts.bandKey) {
          // هاله‌ی بازه استاندارد (حداکثر ← حداقل)
          const maxKey = `flock:${f.flock.id}:max`;
          const minKey = `flock:${f.flock.id}:min`;
          const sMax = useSettings ? this.seriesSettings[maxKey] : null;
          const sMin = useSettings ? this.seriesSettings[minKey] : null;
          const maxVisible = !(useSettings && sMax && sMax.visible === false);
          const minVisible = !(useSettings && sMin && sMin.visible === false);

          if (maxVisible) {
            const maxColor = (useSettings && sMax?.color) || color;
            datasets.push({
              label: `${label} (حداکثر)`,
              data: this.getFlockDataByWeek(f, opts.bandKey.max),
              borderColor: maxColor,
              borderDash: useSettings
                ? this.getLineDash(sMax?.lineType, [3, 3])
                : [3, 3],
              borderWidth: 1,
              pointRadius: 0,
              fill: minVisible ? "+1" : false,
              backgroundColor: maxColor + "18",
            });
          }
          if (minVisible) {
            datasets.push({
              label: `${label} (حداقل)`,
              data: this.getFlockDataByWeek(f, opts.bandKey.min),
              borderColor: (useSettings && sMin?.color) || color,
              borderDash: useSettings
                ? this.getLineDash(sMin?.lineType, [3, 3])
                : [3, 3],
              borderWidth: 1,
              pointRadius: 0,
              fill: false,
              backgroundColor: "transparent",
            });
          }
        }
      }
    });
    return datasets;
  }

  // ===== ساخت کانفیگ پایه =====
  baseOptions(yLabel, extra = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: this.showTooltip,
          mode: "index",
          intersect: false,
          backgroundColor: "rgba(15,23,42,0.92)",
          titleFont: { family: "Vazir", size: 12 },
          bodyFont: { family: "Vazir", size: 11 },
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              const unit = extra.tooltipUnit || "";
              if (val === null || val === undefined) {
                return `${ctx.dataset.label}: —`;
              }
              return `${ctx.dataset.label}: ${Number(val).toLocaleString("fa-IR", {
                maximumFractionDigits: 2,
              })}${unit}`;
            },
          },
          ...(extra.tooltip || {}),
        },
        datalabels: {
          display: false,
          ...(extra.datalabels || {}),
        },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true, speed: 0.05 },
            pinch: { enabled: true },
            mode: "x",
          },
        },
        // ✅ پس‌زمینه‌ی سفید بوم (هم در صفحه هم در خروجی دانلود)
        background: { color: "#ffffff" },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: yLabel,
            font: { family: "Vazir", size: 11 },
          },
          grid: { color: "#f1f5f9" },
        },
        x: { grid: { display: false } },
      },
    };
  }

  // ===== رندر یک نمودار =====
  renderChart(id, datasets, labels, yLabel, chartType = "line", extra = {}) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    if (this.chartInstances[id]) {
      try {
        this.chartInstances[id].destroy();
      } catch (e) {}
    }
    const ctx = canvas.getContext("2d");
    this.chartInstances[id] = new Chart(ctx, {
      type: chartType,
      data: { labels, datasets },
      options: this.baseOptions(yLabel, extra),
      plugins:
        typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : [],
    });

    // لِجند چک‌باکسی کنار نمودار
    this.renderChartLegend(id, datasets);
  }

  // ===== لِجند چک‌باکسی کنار نمودار =====
  renderChartLegend(id, datasets) {
    const container = document.getElementById(`${id}Legend`);
    if (!container || !datasets) return;

    container.innerHTML = datasets
      .map((ds, i) => {
        const color = ds.borderColor || ds.backgroundColor || "#64748b";
        return `
            <label class="chart-legend-row">
                <input type="checkbox" class="legend-check" checked
                       onchange="chartDashboardService.toggleDataset('${id}', ${i}, this.checked)">
                <span class="legend-color" style="background:${color}"></span>
                <span class="legend-label">${ds.label}</span>
            </label>`;
      })
      .join("");
  }

  toggleDataset(chartId, index, checked) {
    const chart = this.chartInstances[chartId];
    if (!chart) return;
    try {
      chart.setDatasetVisibility(index, checked);
      chart.update();
    } catch (e) {}
  }

  // ===== رندر همه نمودارها =====
  renderAllCharts() {
    const selected = this.getSelectedFlocks();
    const labels = this.getWeekLabels();
    const main = MAIN_INDICATORS[this.mainIndicator];

    const titleEl = document.getElementById("mainChartTitle");
    if (titleEl) titleEl.textContent = main.title;

    const chartType =
      document.getElementById("mainChartType")?.value || "line";

    // نمودار داینامیک اصلی (با استاندارد + بازه)
    const mainDatasets = this.buildFlockDatasets(selected, main.key, {
      stdKey: main.stdKey,
      bandKey: { min: "stdMin", max: "stdMax" },
      useSeriesSettings: true,
      showMeanLine: false, // خط میانگین استاندارد از نمودار اصلی حذف شده است
    });
    this.renderChart(
      "mainChart",
      mainDatasets,
      labels,
      main.yLabel,
      chartType,
      {
        tooltipUnit: ` ${main.unit}`,
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: (items) =>
              items && items.length
                ? `هفته ${Number(items[0].dataIndex + 1).toLocaleString("fa-IR")}`
                : "",
            label: (ctx) => {
              const val = ctx.raw;
              if (val === null || val === undefined)
                return `${ctx.dataset.label}: —`;
              return `${ctx.dataset.label}: ${Number(val).toLocaleString("fa-IR", {
                maximumFractionDigits: main.decimals,
              })} ${main.unit}`;
            },
            afterBody: (items) => {
              if (!items || !items.length) return [];
              if (!this.showStandards) return [];
              const weekNo = items[0].dataIndex + 1;
              const lines = [];
              this.getSelectedFlocks().forEach((f) => {
                const s = (f.series || []).find((x) => x.week === weekNo);
                if (!s) return;
                const stdVal = s[main.stdKey];
                if (stdVal === null || stdVal === undefined) return;
                const actual = s[main.key];
                let dev = "";
                if (actual !== null && actual !== undefined && stdVal !== 0) {
                  const diff = ((actual - stdVal) / stdVal) * 100;
                  dev = ` (${diff >= 0 ? "+" : ""}${Number(diff).toLocaleString("fa-IR", {
                    maximumFractionDigits: 1,
                  })}٪)`;
                }
                lines.push(
                  `استاندارد ${this.flockLabel(f)}: ${Number(stdVal).toLocaleString("fa-IR", {
                    maximumFractionDigits: main.decimals,
                  })} ${main.unit}${dev}`,
                );
              });
              return lines;
            },
          },
        },
        datalabels: this.showDataLabels
          ? {
              display: true,
              color: "#1e293b",
              font: { family: "Vazir", size: 9, weight: "bold" },
              anchor: "end",
              align: "top",
              formatter: (value) =>
                value === null || value === undefined
                  ? ""
                  : Number(value).toLocaleString("fa-IR", {
                      maximumFractionDigits: main.decimals,
                    }),
            }
          : {},
      },
    );

    // نمودارهای جداگانه
    this.renderChart(
      "totalWeightGainChart",
      this.buildFlockDatasets(selected, "totalWeightGain"),
      labels,
      "کیلوگرم",
      "line",
      { tooltipUnit: " کیلوگرم" },
    );
    this.renderChart(
      "totalLiveWeightChart",
      this.buildFlockDatasets(selected, "totalLiveWeight"),
      labels,
      "کیلوگرم",
      "line",
      { tooltipUnit: " کیلوگرم" },
    );
    this.renderChart(
      "fcrChart",
      this.buildFlockDatasets(selected, "fcr", { stdKey: "stdFcr" }),
      labels,
      "FCR",
      "line",
      {
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            title: (items) =>
              items && items.length
                ? `هفته ${Number(items[0].dataIndex + 1).toLocaleString("fa-IR")}`
                : "",
            afterBody: (items) => {
              if (!items || !items.length) return [];
              if (!this.showStandards) return [];
              const weekNo = items[0].dataIndex + 1;
              const lines = [];
              this.getSelectedFlocks().forEach((f) => {
                const s = (f.series || []).find((x) => x.week === weekNo);
                if (!s || s.stdFcr === null || s.stdFcr === undefined) return;
                lines.push(
                  `FCR استاندارد ${this.flockLabel(f)}: ${Number(s.stdFcr).toLocaleString("fa-IR", {
                    maximumFractionDigits: 3,
                  })}`,
                );
              });
              return lines;
            },
          },
        },
      },
    );
    this.renderChart(
      "mortalityCountChart",
      this.buildFlockDatasets(selected, "mortalityCount", { fill: true }),
      labels,
      "قطعه",
      "line",
      { tooltipUnit: " قطعه" },
    );

    const mortKey =
      this.mortalityMode === "total"
        ? "mortalityPctTotal"
        : "mortalityPctWeekly";
    this.renderChart(
      "mortalityPctChart",
      this.buildFlockDatasets(selected, mortKey),
      labels,
      "درصد",
      "line",
      { tooltipUnit: "٪" },
    );

    const survKey =
      this.survivalMode === "cumulative"
        ? "survivalPctCumulative"
        : "survivalPctWeekly";
    this.renderChart(
      "survivalPctChart",
      this.buildFlockDatasets(selected, survKey),
      labels,
      "درصد",
      "line",
      { tooltipUnit: "٪" },
    );

    this.renderChart(
      "blackoutChart",
      this.buildFlockDatasets(selected, "blackoutHours", { fill: true }),
      labels,
      "ساعت",
      "line",
      { tooltipUnit: " ساعت" },
    );

    // پنل نمایش و تنظیم سری‌های نمودار اصلی
    this.renderMainSeriesControls();
  }

  // ===== کنترل‌ها =====
  toggleFlock(id, checked) {
    const flockId = parseInt(id);
    if (checked) {
      if (!this.selectedFlockIds.includes(flockId)) {
        this.selectedFlockIds.push(flockId);
      }
    } else {
      this.selectedFlockIds = this.selectedFlockIds.filter(
        (x) => x !== flockId,
      );
    }
    this.renderAllCharts();
  }

  selectAllFlocks(select) {
    this.selectedFlockIds = select
      ? this.flocks.map((f) => f.flock.id)
      : [];
    this.flocks.forEach((f) => {
      const cb = document.querySelector(
        `.analysis-flock-check input[value="${f.flock.id}"]`,
      );
      if (cb) cb.checked = select;
    });
    this.renderAllCharts();
  }

  setWeekRange(value) {
    const v = parseInt(value);
    if (!isNaN(v) && v >= 2) {
      this.weekCount = Math.min(v, 16);
      const input = document.getElementById("analysisWeekRange");
      if (input) input.value = this.weekCount;
      this.renderAllCharts();
    }
  }

  changeWeekRange(delta) {
    this.setWeekRange(String(this.weekCount + delta));
  }

  setMainIndicator(ind) {
    if (!MAIN_INDICATORS[ind]) return;
    this.mainIndicator = ind;
    document
      .querySelectorAll("#mainIndicatorTabs .analysis-tab")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.ind === this.mainIndicator),
      );
    this.renderAllCharts();
  }

  setMortalityMode(mode) {
    this.mortalityMode = mode;
    document
      .querySelectorAll("#mortalityPctChartTabs .analysis-tab")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === this.mortalityMode),
      );
    this.renderAllCharts();
  }

  setSurvivalMode(mode) {
    this.survivalMode = mode;
    document
      .querySelectorAll("#survivalPctChartTabs .analysis-tab")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.mode === this.survivalMode),
      );
    this.renderAllCharts();
  }

  updateMainSettings() {
    this.showStandards =
      document.getElementById("showStandards")?.checked ?? true;
    this.showDataLabels =
      document.getElementById("showDataLabels")?.checked ?? false;
    this.showTooltip =
      document.getElementById("showTooltip")?.checked ?? true;
    this.lineWidth =
      parseInt(document.getElementById("mainLineWidth")?.value) || 2;
    this.pointSize =
      parseInt(document.getElementById("mainPointSize")?.value) || 4;
    this.renderAllCharts();
  }

  // ===== اطلاعات هدر تصویر دانلودی =====
  getChartTitle(id) {
    const map = {
      mainChart: MAIN_INDICATORS[this.mainIndicator].title,
      totalWeightGainChart: "افزایش وزن کل گله (هفتگی)",
      totalLiveWeightChart: "وزن زنده کل گله (هفتگی)",
      fcrChart: "ضریب تبدیل هفتگی (FCR)",
      mortalityCountChart: "تلفات (قطعه) هفته به هفته",
      mortalityPctChart:
        this.mortalityMode === "total"
          ? "درصد تلفات (کل)"
          : "درصد تلفات (هفتگی)",
      survivalPctChart:
        this.survivalMode === "cumulative"
          ? "درصد زنده مانی (تجمعی)"
          : "درصد زنده مانی (هفتگی)",
      blackoutChart: "میزان خاموشی (ساعت)",
    };
    return map[id] || "نمودار";
  }

  getDownloadInfo(id) {
    let dateText = "—";
    try {
      dateText = new Intl.DateTimeFormat("fa-IR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date());
    } catch (e) {}

    let user = "—";
    try {
      const u = JSON.parse(localStorage.getItem("user") || "{}");
      user =
        u.fullName ||
        u.full_name ||
        `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
        u.username ||
        "—";
    } catch (e) {}

    let customer = "—";
    if (this.flocks && this.flocks.length) {
      customer = this.flocks[0].flock.customerName || "—";
    }

    return { title: this.getChartTitle(id), date: dateText, user, customer };
  }

  downloadChart(id, format) {
    const canvas = document.getElementById(id);
    if (!canvas) {
      notificationService.error("نموداری برای دانلود وجود ندارد");
      return;
    }
    try {
      const chart = this.chartInstances[id];

      // پس‌زمینه‌ی سفید روی بوم اصلی (ضمانت)
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // بوم ترکیبی: هدر اطلاعات + نمودار
      const info = this.getDownloadInfo(id);
      const headerHeight = 118;
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height + headerHeight;
      const octx = out.getContext("2d");

      octx.fillStyle = "#ffffff";
      octx.fillRect(0, 0, out.width, out.height);

      // عنوان نمودار
      octx.direction = "rtl";
      octx.textAlign = "right";
      octx.fillStyle = "#0f172a";
      octx.font = "700 17px Vazir";
      octx.fillText(info.title, out.width - 16, 30);

      // خط جداکننده
      octx.strokeStyle = "#e2e8f0";
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(16, 42);
      octx.lineTo(out.width - 16, 42);
      octx.stroke();

      // اطلاعات دانلود
      octx.fillStyle = "#475569";
      octx.font = "500 12px Vazir";
      octx.fillText(`تاریخ و ساعت دریافت: ${info.date}`, out.width - 16, 64);
      octx.fillText(`کاربر دریافت‌کننده: ${info.user}`, out.width - 16, 86);
      octx.fillText(`مشتری: ${info.customer}`, out.width - 16, 108);

      // رسم نمودار در پایین هدر
      octx.drawImage(canvas, 0, headerHeight);

      const now = new Date();
      const dateStr = now.toLocaleDateString("fa-IR").replace(/\//g, "-");
      const link = document.createElement("a");
      link.download = `نمودار_${id}_${dateStr}.${format}`;
      link.href = out.toDataURL(
        format === "jpg" ? "image/jpeg" : "image/png",
        format === "jpg" ? 0.95 : undefined,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // بازگردانی بوم به حالت تمیز
      if (chart && typeof chart.update === "function") {
        chart.update();
      }

      notificationService.success("✅ تصویر با موفقیت دانلود شد");
    } catch (error) {
      console.error("❌ Error downloading chart:", error);
      notificationService.error("خطا در دانلود تصویر");
    }
  }

  resetZoom(id) {
    const chart = this.chartInstances[id];
    if (chart && typeof chart.resetZoom === "function") {
      chart.resetZoom();
    }
  }

  destroyCharts() {
    Object.keys(this.chartInstances).forEach((key) => {
      try {
        this.chartInstances[key].destroy();
      } catch (e) {}
    });
    this.chartInstances = {};
  }

  refresh() {
    this.destroyCharts();
    this.loadData();
  }

  destroy() {
    this.destroyCharts();
  }
}

export const chartDashboardService = new ChartDashboardService();
if (typeof window !== "undefined") {
  window.chartDashboardService = chartDashboardService;
  window.ChartDashboardService = ChartDashboardService;
  window.loadAccordionState = () => {};
  window.openAllAccordion = () => {};
  window.closeAllAccordion = () => {};
}
