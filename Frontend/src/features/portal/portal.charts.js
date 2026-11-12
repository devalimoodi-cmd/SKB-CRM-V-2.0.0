// ============================================================
// features/portal/portal.charts.js
// ✅ موج ۱۳.۲۳ — نمودارهای واقعی پورتال مشتری با Chart.js
// ------------------------------------------------------------
//  چرا؟
//   • تا ۱۳.۲۲ پورتال فقط SVG دست‌ساز داشت (`renderWeeklyChart`):
//     بدون tooltip تعاملی، بدون legend، بدون بزرگ‌نمایی و بدون
//     ریسپانسیو سیال؛ کارشناس اما از ۱۳.۲ همان Chart.js را دارد.
//   • حالا مشتری همان تجربه را می‌بیند (همان کتابخانهٔ node_modules،
//     همان تم `chart-theme.service` که app.service.init می‌کند).
//
//  🔒 قواعد:
//   ۱) هیچ import/CDN در این فایل نیست؛ کتابخانه از HTML و از
//      node_modules می‌آید (`window.Chart`).
//   ۲) اگر `window.Chart` نبود (آفلاین/بلاک‌شده)، همهٔ سازنده‌ها
//      `""` برمی‌گردانند و رندرر SVG قبلی جایش را می‌گیرد ⇒ هیچ
//      بخشی از پورتال به کتابخانه وابسته نمی‌شود.
//   ۳) هر canvas پیش از ساخت دوباره destroy می‌شود (ضد نشتی حافظه).
//   ۴) شماره‌ها با `faNumber` فارسی می‌شوند؛ برچسب‌ها متن ثابت
//      همین فایل‌اند (هیچ متن کاربر بدون escape در HTML نمی‌نشیند).
//   ۵) سری‌های داده از `portal.renderer.js` می‌آید (یک منبع با
//      نمودار SVG) ⇒ دو نسخهٔ واگرا نداریم.
// ============================================================
import { faNumber, farmChartSeries } from "./portal.renderer.js";

// نام کتابخانه برای گارد/مستندات (منبع حقیقت: package.json)
export const PORTAL_CHART_LIB = "chart.js";
export const PORTAL_CHART_SELECTOR = "canvas[id]";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// رجیستری نمودارهای زنده: canvasId → Chart (برای destroy/resize)
const REGISTRY = new Map();

const chartLib = () =>
  typeof window !== "undefined" && window.Chart ? window.Chart : null;

export const hasChartJs = () => Boolean(chartLib());

const reduceMotion = () => {
  try {
    return Boolean(
      typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia(REDUCED_MOTION_QUERY).matches,
    );
  } catch {
    return false;
  }
};

// خواندن رنگ‌های تم از CSS (بدون ورود به جزئیات تم روشن/تیره)
const cssVar = (name, fallback) => {
  try {
    if (typeof document === "undefined" || !document.documentElement) return fallback;
    const value = window
      .getComputedStyle(document.documentElement)
      .getPropertyValue(name);
    return String(value || "").trim() || fallback;
  } catch {
    return fallback;
  }
};

export const chartThemeColors = () => ({
  primary: cssVar("--primary", "#2c7a6e"),
  primarySoft: cssVar("--primary-soft", "rgba(44, 122, 110, 0.16)"),
  text: cssVar("--text-main", "#0f172a"),
  muted: cssVar("--text-light", "#64748b"),
  border: cssVar("--border", "#e2e8f0"),
  danger: cssVar("--danger", "#dc2626"),
  warning: cssVar("--warning", "#d97706"),
  success: cssVar("--success", "#16a34a"),
});

export const SERIES_PALETTE = [
  "#2f6fed",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#dc2626",
];

// پاک‌سازی متن برای درج در HTML پوسته (هم‌قاعده با رندرر اصلی)
const esc = (value) =>
  String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ============================================================
// ۱) گزینه‌های مشترک (RTL + فارسی + ریسپانسیو + حرکت احترام‌آمیز)
// ============================================================
const baseOptions = ({ unit = "", legend = false } = {}) => {
  const colors = chartThemeColors();
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reduceMotion() ? false : { duration: 500 },
    interaction: { mode: "index", intersect: false },
    layout: { padding: 2 },
    plugins: {
      legend: {
        display: Boolean(legend),
        position: "bottom",
        rtl: true,
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          usePointStyle: true,
          color: colors.text,
        },
      },
      tooltip: {
        rtl: true,
        textDirection: "rtl",
        backgroundColor: colors.text,
        titleFont: { family: "inherit" },
        bodyFont: { family: "inherit" },
        callbacks: {
          label: (context) => {
            const value = Number(context.parsed && context.parsed.y);
            const text = Number.isFinite(value) ? faNumber(value) : "—";
            return ` ${text}${unit ? ` ${unit}` : ""}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: colors.muted, font: { family: "inherit" } },
      },
      y: {
        beginAtZero: true,
        grid: { color: colors.border },
        border: { display: false },
        ticks: {
          color: colors.muted,
          font: { family: "inherit" },
          callback: (value) => faNumber(value),
        },
      },
    },
  };
};

// ============================================================
// ۲) پوستهٔ canvas (فقط HTML؛ mount جدا انجام می‌شود)
// ============================================================
export const chartShellHtml = ({ id, title, range = "", hint = "", height = "" }) => {
  const key = String(id || "").trim();
  if (!key) return "";
  return `
    <figure class="portal-chart portal-chart--live" data-chart-id="${esc(key)}">
      <figcaption class="portal-chart__head">
        <span class="portal-chart__title">${esc(title)}</span>
        ${range ? `<span class="portal-chart__range">${esc(range)}</span>` : ""}
      </figcaption>
      <div class="portal-chart__box"${height ? ` style="height:${esc(height)}"` : ""}>
        <canvas id="${esc(key)}" role="img" aria-label="${esc(title)}"></canvas>
      </div>
      ${hint ? `<p class="portal-chart__hint">${esc(hint)}</p>` : ""}
    </figure>`;
};

// ============================================================
// ۳) مشخصات نمودارها (spec) — خالص و قابل تست بدون DOM واقعی
// ============================================================
export const weeklyWeightSpec = (items = []) => {
  const rows = (Array.isArray(items) ? items : [])
    .filter((row) => Number.isFinite(Number(row.weekly_weight)))
    .slice(-20)
    .map((row, index) => ({
      label: `هفتهٔ ${faNumber(Number(row.week_number) || index + 1)}`,
      value: Number(row.weekly_weight),
    }));

  if (rows.length < 2) return null;
  const colors = chartThemeColors();

  return {
    type: "line",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          label: "وزن هفتگی (گرم)",
          data: rows.map((row) => row.value),
          borderColor: colors.primary,
          backgroundColor: colors.primarySoft,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: colors.primary,
        },
      ],
    },
    options: baseOptions({ unit: "گرم" }),
  };
};

// سری‌های داشبورد — هر کلید فقط اگر سرور مجاز داده باشد
const DASHBOARD_SERIES = [
  { key: "weight", title: "وزن هفتگی (گرم)", unit: "گرم", type: "line", source: "weight" },
  { key: "gain", title: "افزایش وزن هفتگی (گرم)", unit: "گرم", type: "line", source: "gain" },
  { key: "mortality", title: "تلفات هفتگی (قطعه)", unit: "", type: "bar", source: "loss" },
  {
    key: "feed",
    title: "مصرف دان هفتگی (کیلوگرم)",
    unit: "کیلوگرم",
    type: "bar",
    source: "feed",
  },
  { key: "fcr", title: "ضریب تبدیل غذایی — تقریبی", unit: "", type: "bar", source: "fcr" },
];

const seriesToDatasets = ({ series, type }) => {
  return (Array.isArray(series) ? series : [])
    .filter((row) => Array.isArray(row.values) && row.values.some((v) => Number(v) > 0))
    .map((row, index) => {
      const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
      const base = {
        label: row.name || "گله",
        data: row.values.map((value) => Number(value) || 0),
        borderWidth: 2,
        tension: 0.3,
      };
      if (type === "bar") {
        return { type: "bar", ...base, backgroundColor: color, borderColor: color };
      }
      return {
        type: "line",
        ...base,
        borderColor: color,
        backgroundColor: "transparent",
        pointRadius: 2,
        pointHoverRadius: 5,
        borderDash: index === 0 ? [] : [4, 3],
        spanGaps: true,
      };
    });
};

export const dashboardSpecs = (data = {}, flags = {}) => {
  const flocks = Array.isArray(data.flocks) ? data.flocks : [];
  if (!flocks.length) return [];

  return DASHBOARD_SERIES.filter((item) => {
    // وزن/تلفات/دان پیش‌فرض باز؛ بقیه فقط با پرچم صریح سرور
    if (item.key === "weight" || item.key === "mortality" || item.key === "feed") {
      return flags[item.key] !== false;
    }
    return Boolean(flags[item.key]);
  })
    .map((item) => {
      const source = farmChartSeries[item.source];
      const series = typeof source === "function" ? source(flocks) : [];
      const datasets = seriesToDatasets({ ...item, series });
      if (!datasets.length) return null;
      const count = Math.max(...datasets.map((row) => row.data.length));
      return {
        key: item.key,
        title: item.title,
        unit: item.unit,
        spec: {
          type: item.type,
          data: {
            labels: Array.from(
              { length: count },
              (_, index) => `هفتهٔ ${faNumber(index + 1)}`,
            ),
            datasets,
          },
          options: baseOptions({ unit: item.unit, legend: datasets.length > 1 }),
        },
      };
    })
    .filter(Boolean);
};

export const standardsSpec = (analysis = {}, flags = {}) => {
  if (flags && flags.standards === false) return null;
  const flocks = Array.isArray(analysis.flocks) ? analysis.flocks : [];
  if (!flocks.length) return null;
  const colors = chartThemeColors();

  const datasets = [];
  flocks.slice(0, 5).forEach((row, index) => {
    const info = row.flockInfo || {};
    const name = info.flockNumber
      ? `گلهٔ ${faNumber(info.flockNumber)}`
      : `گلهٔ ${faNumber(index + 1)}`;
    const actual = Array.isArray(row.data && row.data.weighting) ? row.data.weighting : [];
    const target = Array.isArray(row.data && row.data.target) ? row.data.target : [];
    const color = SERIES_PALETTE[index % SERIES_PALETTE.length];
    if (actual.some((value) => Number(value) > 0)) {
      datasets.push({
        type: "line",
        label: `${name} — واقعی`,
        data: actual.map((value) => Number(value) || 0),
        borderColor: color,
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0.3,
      });
    }
    if (target.some((value) => Number(value) > 0)) {
      datasets.push({
        type: "line",
        label: `${name} — استاندارد نژاد`,
        data: target.map((value) => Number(value) || 0),
        borderColor: colors.muted,
        backgroundColor: "transparent",
        borderWidth: 2,
        borderDash: [5, 4],
        tension: 0.3,
      });
    }
  });

  if (!datasets.length) return null;
  const count = Math.max(...datasets.map((row) => row.data.length));
  return {
    type: "line",
    data: {
      labels: Array.from(
        { length: count },
        (_, index) => `هفتهٔ ${faNumber(index + 1)}`,
      ),
      datasets,
    },
    options: baseOptions({ unit: "گرم", legend: true }),
  };
};

// ============================================================
// ۴) mount / destroy / resize
// ============================================================
export const mountChart = (canvas, spec) => {
  const Lib = chartLib();
  if (!Lib || !canvas || !spec || typeof canvas.getContext !== "function") return null;
  const id = String(canvas.id || "");
  destroyChart(id);
  try {
    const chart = new Lib(canvas.getContext("2d"), spec);
    if (id) REGISTRY.set(id, chart);
    return chart;
  } catch (error) {
    console.warn("⚠️ رسم نمودار پورتال ناموفق بود:", error && error.message);
    return null;
  }
};

export const mountChartById = (id, spec) => {
  if (typeof document === "undefined" || !document.getElementById) return null;
  return mountChart(document.getElementById(String(id || "")), spec);
};

export const destroyChart = (id) => {
  const chart = REGISTRY.get(String(id || ""));
  if (!chart) return false;
  try {
    chart.destroy();
  } catch {
    /* نمودار نیمه‌ساخته — بی‌صدا رد می‌شود */
  }
  REGISTRY.delete(String(id || ""));
  return true;
};

// پاک‌سازی همهٔ نمودارهای داخل یک ظرف (پیش از innerHTML تازه)
export const destroyChartsIn = (root) => {
  if (!root || typeof root.querySelectorAll !== "function") return 0;
  let count = 0;
  root.querySelectorAll(PORTAL_CHART_SELECTOR).forEach((canvas) => {
    if (destroyChart(canvas.id)) count += 1;
  });
  return count;
};

export const chartCount = () => REGISTRY.size;

export const destroyAllCharts = () => {
  Array.from(REGISTRY.keys()).forEach((id) => destroyChart(id));
  return REGISTRY.size;
};

// بعد از نمایان‌شدن پنل (canvas پنهان ارتفاع صفر می‌گیرد)
export const resizeCharts = () => {
  if (typeof window === "undefined") return 0;
  let count = 0;
  REGISTRY.forEach((chart) => {
    if (!chart || typeof chart.resize !== "function") return;
    try {
      chart.resize();
      count += 1;
    } catch {
      /* پنل هنوز پنهان است — تلاش بعدی */
    }
  });
  return count;
};

// ============================================================
// ۵) اتصال به داده‌های واقعی پورتال
// ============================================================
// تب «هفته‌های مدیریتی»: پوسته + mount (رشتهٔ خالی ⇒ SVG قبلی)
export const renderWeeklyLiveChart = (items = []) => {
  if (!hasChartJs()) return "";
  const spec = weeklyWeightSpec(items);
  if (!spec) return "";
  const values = spec.data.datasets[0].data;
  return chartShellHtml({
    id: "portalChartWeight",
    title: "روند وزن هفتگی (گرم)",
    range: `${faNumber(Math.min(...values))} تا ${faNumber(Math.max(...values))}`,
    hint: `${faNumber(values.length)} هفتهٔ آخر از دادهٔ همین صفحه — با نشانگر روی هر نقطه مقدار دقیق را ببینید.`,
  });
};

export const mountWeeklyLiveChart = (items = []) =>
  mountChartById("portalChartWeight", weeklyWeightSpec(items));

// داشبورد تحلیلی: شبکهٔ نمودارها
export const renderDashboardLiveCharts = (data = {}, flags = {}) => {
  if (!hasChartJs()) return "";
  return dashboardSpecs(data, flags)
    .map((item) =>
      chartShellHtml({
        id: `portalDashChart-${item.key}`,
        title: item.title,
        height: "220px",
      }),
    )
    .join("");
};

export const mountDashboardLiveCharts = (data = {}, flags = {}) => {
  let mounted = 0;
  dashboardSpecs(data, flags).forEach((item) => {
    if (mountChartById(`portalDashChart-${item.key}`, item.spec)) mounted += 1;
  });
  return mounted;
};

// مقایسه با استاندارد نژاد
export const renderStandardsLiveChart = (analysis = {}, flags = {}) => {
  if (!hasChartJs()) return "";
  if (!standardsSpec(analysis, flags)) return "";
  return chartShellHtml({
    id: "portalChartStandards",
    title: "وزن واقعی در برابر استاندارد نژاد (گرم)",
    height: "240px",
  });
};

export const mountStandardsLiveChart = (analysis = {}, flags = {}) =>
  mountChartById("portalChartStandards", standardsSpec(analysis, flags));

