// ============================================================
//  گارد «نمودارهای پورتال (Chart.js)» — موج ۱۳.۲۳
// ------------------------------------------------------------
//  چه چیزی را قفل می‌کند؟
//   ۱) نمودارهای پورتال واقعاً از Chart.js می‌آیند (نه SVG تنها):
//      * مشخصات هر نمودار (spec) **ساخته و اجرا** می‌شوند.
//      * ساخت/نابودی/تغییر اندازهٔ نمونه‌ها با یک Chart قلابی سنجیده
//        می‌شود (ضد نشتی: mount دوباره = destroy قبلی).
//   ۲) اگر `window.Chart` نبود، هیچ‌چیز نمی‌شکند و همان SVG ۱۳.۴
//      جایش را می‌گیرد (fallback اجباری).
//   ۳) فقط کتابخانهٔ Chart.js مجاز است؛ d3/apexcharts/echarts/highcharts
//      در پورتال ممنوع‌اند (هم‌راستا با گارد ۱۳.۲۳ اصلی).
//   ۴) هر canvas جعبهٔ ارتفاع‌دار دارد (تلهٔ «نمودار نامرئی»).
//
//  اجرا:  npm run test:portal-charts      (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (rel) => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};

const HTML = read("Frontend/src/pages/portal.html");
const CHARTS = read("Frontend/src/features/portal/portal.charts.js");
const CSS = read("Frontend/src/features/portal/portal.charts.css");
const SERVICE = read("Frontend/src/features/portal/portal.service.js");
const EXTRA = read("Frontend/src/features/portal/portal.extra.js");
const RENDERER = read("Frontend/src/features/portal/portal.renderer.js");
const PKG = read("Frontend/package.json");
const GATE = read("tools/gate.mjs");
const GATE_PS1 = read("tools/gate.ps1");

// ============================================================
// ۰) Chart قلابی + قلاب‌های DOM (بدون مرورگر)
// ============================================================
class FakeChart {
  static instances = [];
  constructor(ctx, spec) {
    this.ctx = ctx;
    this.spec = spec;
    this.destroyed = false;
    this.resized = 0;
    FakeChart.instances.push(this);
  }

  destroy() {
    this.destroyed = true;
  }

  resize() {
    this.resized += 1;
  }
}

globalThis.window = {
  Chart: FakeChart,
  matchMedia: () => ({ matches: false, addEventListener: () => undefined }),
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  location: { hash: "", pathname: "/portal" },
};
globalThis.document = {
  documentElement: {},
  getElementById: (id) =>
    String(id) === "portalChartWeight" ? canvasOf("portalChartWeight") : null,
  querySelector: () => null,
  querySelectorAll: () => [],
  body: { appendChild: () => undefined, classList: { add: () => undefined, remove: () => undefined } },
};

const charts = await import("../Frontend/src/features/portal/portal.charts.js");

const canvasOf = (id = "portalChartWeight") => ({
  id,
  getContext: () => ({ canvas: { id } }),
});

const weeklyRows = [
  { week_number: 1, weekly_weight: 180 },
  { week_number: 2, weekly_weight: 420 },
  { week_number: 3, weekly_weight: 760 },
];

// ============================================================
// ۱) کتابخانه و مشخصات خالص
// ============================================================
check(
  "۱۳.۲۳ · Chart.js در دسترس است و نام کتابخانه درست اعلام شده",
  charts.hasChartJs() === true && charts.PORTAL_CHART_LIB === "chart.js",
);

check(
  "۱۳.۲۳ · weeklyWeightSpec: کمتر از دو هفته ⇒ null (بی‌نمودار)",
  charts.weeklyWeightSpec([]) === null &&
    charts.weeklyWeightSpec(null) === null &&
    charts.weeklyWeightSpec([{ weekly_weight: 100 }]) === null &&
    charts.weeklyWeightSpec([
      { weekly_weight: "x" },
      { weekly_weight: null },
    ]) === null,
);

check(
  "۱۳.۲۳ · weeklyWeightSpec: خطی با برچسب فارسی و همان داده",
  (() => {
    const spec = charts.weeklyWeightSpec(weeklyRows);
    if (!spec) return false;
    const dataset = spec.data.datasets[0];
    return (
      spec.type === "line" &&
      spec.data.labels.length === 3 &&
      spec.data.labels[0] === "هفتهٔ ۱" &&
      dataset.data.join(",") === "180,420,760" &&
      dataset.fill === true &&
      spec.options.responsive === true &&
      spec.options.maintainAspectRatio === false &&
      spec.options.interaction.mode === "index" &&
      spec.options.plugins.tooltip.rtl === true &&
      typeof spec.options.plugins.tooltip.callbacks.label === "function"
    );
  })(),
);

check(
  "۱۳.۲۳ · tooltip عدد را فارسی و با واحد نشان می‌دهد",
  (() => {
    const spec = charts.weeklyWeightSpec(weeklyRows);
    const label = spec.options.plugins.tooltip.callbacks.label({
      parsed: { y: 420 },
    });
    return label.includes("۴۲۰") && label.includes("گرم");
  })(),
);

check(
  "۱۳.۲۳ · chartShellHtml: شناسهٔ canvas + escape عنوان",
  (() => {
    const html = charts.chartShellHtml({
      id: "portalChartWeight",
      title: '<script>alert(1)</script>',
      range: "۱ تا ۲",
      hint: "راهنما",
    });
    return (
      html.includes('canvas id="portalChartWeight"') &&
      html.includes("portal-chart__box") &&
      !html.includes("<script>alert(1)</script>") &&
      html.includes("&lt;script&gt;") &&
      charts.chartShellHtml({ id: "", title: "x" }) === ""
    );
  })(),
);

// ============================================================
// ۲) داشبورد و استاندارد نژاد
// ============================================================
const flocksSample = [
  {
    flockInfo: { flockNumber: 1, hallName: "سالن A" },
    data: {
      weighting: [180, 420, 760],
      loss: [2, 1, 3],
      feed: [10, 25, 40],
    },
  },
  {
    flockInfo: { flockNumber: 2, hallName: "سالن B" },
    data: {
      weighting: [200, 460, 800],
      loss: [1, 0, 2],
      feed: [12, 22, 38],
    },
  },
];

check(
  "۱۳.۲۳ · dashboardSpecs: بدون گله ⇒ هیچ نموداری",
  charts.dashboardSpecs({}) .length === 0 &&
    charts.dashboardSpecs({ flocks: [] }).length === 0,
);

check(
  "۱۳.۲۳ · dashboardSpecs: وزن/تلفات/دان پیش‌فرض و بقیه فقط با پرچم",
  (() => {
    const def = charts.dashboardSpecs({ flocks: flocksSample }, {}).map((item) => item.key);
    const withFlags = charts.dashboardSpecs(
      { flocks: flocksSample },
      { gain: true, fcr: true },
    ).map((item) => item.key);
    const off = charts.dashboardSpecs(
      { flocks: flocksSample },
      { weight: false, mortality: false, feed: false },
    ).map((item) => item.key);
    return (
      def.join(",") === "weight,mortality,feed" &&
      withFlags.join(",") === "weight,gain,mortality,feed,fcr" &&
      off.length === 0
    );
  })(),
);

check(
  "۱۳.۲۳ · dashboardSpecs: هر spec چندسری با برچسب گله/سالن دارد",
  (() => {
    const weight = charts
      .dashboardSpecs({ flocks: flocksSample }, {})
      .find((item) => item.key === "weight");
    if (!weight) return false;
    return (
      weight.spec.data.datasets.length === 2 &&
      weight.spec.data.labels.length === 3 &&
      weight.spec.data.datasets[0].data.join(",") === "180,420,760" &&
      weight.spec.data.datasets[0].label.includes("سالن A") &&
      weight.spec.options.plugins.legend.display === true
    );
  })(),
);

check(
  "۱۳.۲۳ · standardsSpec: پرچم بسته ⇒ null، وگرنه واقعی + استاندارد",
  (() => {
    const analysis = {
      flocks: [
        {
          flockInfo: { flockNumber: 1 },
          data: { weighting: [180, 420], target: [200, 450] },
        },
      ],
    };
    const off = charts.standardsSpec(analysis, { standards: false });
    const spec = charts.standardsSpec(analysis, { standards: true });
    return (
      off === null &&
      Boolean(spec) &&
      spec.data.datasets.length === 2 &&
      spec.data.datasets[0].label.includes("واقعی") &&
      spec.data.datasets[1].label.includes("استاندارد") &&
      spec.data.datasets[1].borderDash.length === 2 &&
      charts.standardsSpec({ flocks: [] }, {}) === null
    );
  })(),
);

// ============================================================
// ۳) mount / destroy / resize (اجرای واقعی با Chart قلابی)
// ============================================================
check(
  "۱۳.۲۳ · mount: نمونه ساخته و ثبت می‌شود و spec درست می‌رسد",
  (() => {
    FakeChart.instances = [];
    const chart = charts.mountChart(
      canvasOf("portalChartWeight"),
      charts.weeklyWeightSpec(weeklyRows),
    );
    return (
      Boolean(chart) &&
      charts.chartCount() === 1 &&
      chart.spec.data.datasets[0].data.length === 3
    );
  })(),
);

check(
  "۱۳.۲۳ · mount دوباره ⇒ نمونهٔ قبلی destroy می‌شود (ضد نشتی)",
  (() => {
    const first = FakeChart.instances[0];
    charts.mountChart(canvasOf("portalChartWeight"), charts.weeklyWeightSpec(weeklyRows));
    return (
      first.destroyed === true &&
      FakeChart.instances.length === 2 &&
      charts.chartCount() === 1
    );
  })(),
);

check(
  "۱۳.۲۳ · mount با canvas نامعتبر یا spec خالی ⇒ null و بدون استثنا",
  charts.mountChart(null, charts.weeklyWeightSpec(weeklyRows)) === null &&
    charts.mountChart(canvasOf(), null) === null &&
    charts.mountChart({ id: "x" }, charts.weeklyWeightSpec(weeklyRows)) === null,
);

check(
  "۱۳.۲۳ · destroyChart: ناموجود ⇒ false، موجود ⇒ true و خروج از رجیستری",
  (() => {
    const before = charts.chartCount();
    const missing = charts.destroyChart("nope");
    const ok = charts.destroyChart("portalChartWeight");
    return (
      before === 1 &&
      missing === false &&
      ok === true &&
      charts.chartCount() === 0 &&
      FakeChart.instances.every((item) => item.destroyed === true)
    );
  })(),
);

check(
  "۱۳.۲۳ · destroyChartsIn: همهٔ canvasهای یک ظرف پاک می‌شوند",
  (() => {
    charts.mountChart(canvasOf("portalDashChart-weight"), charts.weeklyWeightSpec(weeklyRows));
    charts.mountChart(canvasOf("portalDashChart-feed"), charts.weeklyWeightSpec(weeklyRows));
    const root = {
      querySelectorAll: () => [
        { id: "portalDashChart-weight" },
        { id: "portalDashChart-feed" },
        { id: "unknown" },
      ],
    };
    const destroyed = charts.destroyChartsIn(root);
    return destroyed === 2 && charts.chartCount() === 0 && charts.destroyChartsIn(null) === 0;
  })(),
);

check(
  "۱۳.۲۳ · resizeCharts: همهٔ نمونه‌های زنده resize می‌شوند",
  (() => {
    FakeChart.instances = [];
    const chart = charts.mountChart(
      canvasOf("portalChartStandards"),
      charts.weeklyWeightSpec(weeklyRows),
    );
    const resized = charts.resizeCharts();
    const cleared = charts.destroyAllCharts();
    return resized === 1 && chart.resized === 1 && cleared === 0 && charts.chartCount() === 0;
  })(),
);


// ============================================================
// ۴) fallback: بدون Chart.js هیچ‌چیز نمی‌شکند
// ============================================================
check(
  "۱۳.۲۳ · بدون window.Chart: سازنده‌ها رشتهٔ خالی می‌دهند (SVG جای آن)",
  (() => {
    const saved = globalThis.window.Chart;
    globalThis.window.Chart = undefined;
    const noLib = charts.hasChartJs();
    const weekly = charts.renderWeeklyLiveChart(weeklyRows);
    const dash = charts.renderDashboardLiveCharts({ flocks: flocksSample }, {});
    const standards = charts.renderStandardsLiveChart(
      { flocks: flocksSample.map((row) => ({ ...row, data: { weighting: [10, 20], target: [12, 22] } })) },
      {},
    );
    const mounted = charts.mountChartById("portalChartWeight", charts.weeklyWeightSpec(weeklyRows));
    globalThis.window.Chart = saved;
    return (
      noLib === false &&
      weekly === "" &&
      dash === "" &&
      standards === "" &&
      mounted === null &&
      charts.hasChartJs() === true
    );
  })(),
);

check(
  "۱۳.۲۳ · با Chart.js: پوستهٔ نمودار هفته/داشبورد/استاندارد ساخته می‌شود",
  (() => {
    const weekly = charts.renderWeeklyLiveChart(weeklyRows);
    const dash = charts.renderDashboardLiveCharts({ flocks: flocksSample }, {});
    return (
      weekly.includes('canvas id="portalChartWeight"') &&
      weekly.includes("روند وزن هفتگی") &&
      dash.includes('canvas id="portalDashChart-weight"') &&
      dash.includes('canvas id="portalDashChart-feed"') &&
      !dash.includes("portalDashChart-fcr")
    );
  })(),
);

check(
  "۱۳.۲۳ · mountWeeklyLiveChart پوستهٔ واقعی صفحه را پر می‌کند",
  (() => {
    FakeChart.instances = [];
    const chart = charts.mountWeeklyLiveChart(weeklyRows);
    const cleared = charts.destroyAllCharts();
    return Boolean(chart) && chart.spec.type === "line" && cleared === 0;
  })(),
);

// ============================================================
// ۵) سیم‌کشی صفحه/سرویس/استایل
// ============================================================
check(
  "۱۳.۲۳ · portal.html: Chart.js از node_modules + ماژول + استایل",
  /node_modules\/chart\.js\/dist\/chart\.umd\.min\.js/.test(HTML) &&
    /src="\/features\/portal\/portal\.charts\.js"/.test(HTML) &&
    /href="\/features\/portal\/portal\.charts\.css"/.test(HTML) &&
    !/\b(apexcharts|echarts|highcharts)\b|\bd3\b/i.test(HTML),
);

check(
  "۱۳.۲۳ · portal.charts.css: جعبهٔ canvas ارتفاع صریح دارد (ضد نمودار نامرئی)",
  /\.portal-chart__box\s*\{[^}]*height:\s*\d+px/s.test(CSS) &&
    /\.portal-chart__box > canvas\s*\{/.test(CSS) &&
    /@media \(min-width: 768px\)/.test(CSS) &&
    !/position:\s*fixed/.test(CSS),
);

check(
  "۱۳.۲۳ · سرویس: نمودار تب هفته‌ها از Chart.js می‌آید و SVG fallback است",
  /renderWeeklyLiveChart\(items\)/.test(SERVICE) &&
    /mountWeeklyLiveChart\(items\)/.test(SERVICE) &&
    /renderWeeklyChart\(items\)/.test(SERVICE) &&
    /resizeCharts\(\)/.test(SERVICE),
);

check(
  "۱۳.۲۳ · داشبورد: نمودارها و استاندارد نژاد هم live هستند و SVG fallback دارند",
  /renderDashboardLiveCharts\(state\.charts, allowed\)/.test(EXTRA) &&
    /mountDashboardLiveCharts\(state\.charts, allowed\)/.test(EXTRA) &&
    /renderStandardsLiveChart\(state\.analysis, allowed\)/.test(EXTRA) &&
    /mountStandardsLiveChart\(state\.analysis, allowed\)/.test(EXTRA) &&
    /destroyChartsIn\(chartsBox\)/.test(EXTRA) &&
    /renderDashboardCharts\(state\.charts, \{ charts: allowed \}\)/.test(EXTRA),
);

check(
  "۱۳.۲۳ · سری‌های Chart.js از همان منبع SVG می‌آیند (بدون واگرایی عددی)",
  /export const farmChartSeries/.test(RENDERER) &&
    /farmChartSeries\b/.test(CHARTS) &&
    /weight: \(flocks = \[\]\) => seriesFrom\(flocks, "weighting"\)/.test(RENDERER),
);

// ============================================================
// ۶) ثبت در npm و دروازهٔ کیفیت
// ============================================================
check(
  "۱۳.۲۳ · اسکریپت npm و gate این گارد را می‌شناسند",
  (() => {
    try {
      const pkg = JSON.parse(PKG);
      return (
        pkg.scripts?.["test:portal-charts"] === "node portal-charts-test.mjs" &&
        /test:portal-charts/.test(GATE) &&
        /test:portal-charts/.test(GATE_PS1)
      );
    } catch {
      return false;
    }
  })(),
);

// ============================================================
// جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;
console.log("");
console.log("============================================================");
console.log(`  نمودارهای پورتال (Chart.js) — ${passed}/${results.length} بررسی`);
console.log("============================================================");

if (passed !== results.length) {
  console.log(`\n❌ ${results.length - passed} بررسی ناموفق`);
  process.exitCode = 1;
  console.log("FAIL - گارد نمودارهای پورتال شکست خورد");
} else {
  console.log("GATE-PASS - نمودارهای پورتال سالم‌اند");
}

