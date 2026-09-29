// ============================================================
//  تست برابری بدنهٔ متد غول ساخت نمودارهای داشبورد — گارد موج برش بدنه (۳.۲o)
//  اجرا:  npm run test:dashboard:setup-charts:body                  (در پوشهٔ Frontend)
//         npm run test:dashboard:setup-charts:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ متد بزرگ زیر برش بدنه می‌خورد (کد از داخل متد به تابع‌های
//  ماژول‌محلی منتقل می‌شود) بدون تغییر یک بایت از رفتار:
//    dashboard.service.js:700  DashboardService#setupCharts   ۲۲۳ خط
//  ساختار متد: destroy چارت‌های قبلی + resetChartStats + تعریف یک **پلاگین درون‌خطی**
//  (`_valueLabelPlugin.afterDatasetsDraw` با منطق fillText/ارقام فارسی) + سه فراخوانی
//  `new Chart(ctx, {…}, [plugin])` با پیکربندی‌های ~۴۴ خطی + چهار فراخوانی پس‌رو.
//  روش سنجش:
//    • استاب `globalThis.Chart` که (ctx, config, plugins) را ثبت می‌کند.
//    • کانواس جعلی با `getContext("2d")` و ctx ثبت‌کننده (clearRect/save/restore/…/fillText).
//    • میزبان جعلی سرویس برای پنج متد + `chartInstances`؛ اجرا با
//      `dashboardService.setupCharts.call(service)`.
//    • ⚠️ callback پلاگین (`afterDatasetsDraw`) **واقعاً اجرا می‌شود** با نمودار مصنوعی و
//      همهٔ `fillText`ها ثبت می‌شوند ⇒ منطق فارسی/کلمپ/شاخهٔ bar قفل می‌شود (درس ۳.۲n).
//    • اسنپ‌شات طلایی: sha256 رکورد JSON هر کِیس در
//      docs/dashboard-setup-charts-body-golden.json (پیش از برش) ⇒ هر بایت تغییر، FAIL.
//  ⚠️ متن پلاگین از `toLocaleString("fa-IR")` استفاده می‌کند (locale/ICU وابسته است).
//  ⚠️ اگر عمداً رفتار تغییر کرد، اول:
//     npm run test:dashboard:setup-charts:body -- --snapshot
// ============================================================
import crypto from "node:crypto";
import fs from "node:fs";

const results = [];
// ⚠️ چاپ نتیجه‌ها باید با consoleLog اصلی باشد (console.log ضبط شده است).
const check = (name, ok, extra = "") => {
  results.push(ok);
  consoleLog(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => consoleLog(`ℹ️  ${message}`);
const clone = (value) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));
const safe = (fn) => {
  try {
    return clone(fn());
  } catch (error) {
    return { thrown: error?.constructor?.name ?? "Error" };
  }
};

// ---------- ضبط console ----------
const consoleLogs = [];
const consoleErrors = [];
const consoleLog = console.log;
const consoleError = console.error;
console.log = (...args) => consoleLogs.push(args.map(String).join(" "));
console.error = (...args) => consoleErrors.push(args.map(String).join(" "));

// ---------- استاب Chart ----------
const chartRecords = [];
class FakeChart {
  constructor(ctx, config, plugins) {
    this.ctx = ctx;
    this.config = config;
    this.plugins = plugins;
    this.destroyed = false;
    chartRecords.push(this);
  }

  destroy() {
    this.destroyed = true;
  }
}
globalThis.Chart = FakeChart;

// ---------- کانواس/ctx جعلی ----------
const CANVAS_IDS = {
  weighting: "weightingCanvas",
  loss: "lossCanvas",
  feed: "feedCanvas",
};
const makeCtx = (key) => {
  const calls = [];
  const ctx = {
    key,
    calls,
    save: () => calls.push(["save"]),
    restore: () => calls.push(["restore"]),
    clearRect: (...a) => calls.push(["clearRect", ...a]),
    fillText: (text, x, y) => calls.push(["fillText", text, x, y]),
    set font(v) {
      calls.push(["font", v]);
    },
    get font() {
      return null;
    },
    set fillStyle(v) {
      calls.push(["fillStyle", v]);
    },
    get fillStyle() {
      return null;
    },
    set textAlign(v) {
      calls.push(["textAlign", v]);
    },
    get textAlign() {
      return null;
    },
  };
  return ctx;
};
const dom = { canvases: new Map(), queries: [] };
globalThis.document = {
  getElementById: (id) => {
    dom.queries.push(id);
    return dom.canvases.has(id) ? dom.canvases.get(id) : null;
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({ style: {}, appendChild() {}, addEventListener() {} }),
  body: { appendChild() {}, style: {} },
};
globalThis.window = globalThis.window || {
  location: { search: "", href: "http://localhost/", pathname: "/" },
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem() {},
  removeItem() {},
  clear() {},
};

// ---------- import ماژول واقعی ----------
const SERVICE_MODULE = "./src/features/dashboard/dashboard.service.js";
const { dashboardService } = await import(SERVICE_MODULE);

// ---------- میزبان جعلی ----------
const makeService = (behavior = {}) => {
  const calls = { resetStats: 0, compareUi: 0, options: 0, tooltips: 0, seriesToggles: 0, destroyed: [] };
  const service = {
    chartInstances: behavior.chartInstances ?? {},
    resetChartStats() {
      calls.resetStats++;
    },
    ensureChartCompareUi() {
      calls.compareUi++;
    },
    setupChartOptions() {
      calls.options++;
    },
    _attachExternalTooltips() {
      calls.tooltips++;
    },
    renderChartSeriesToggles() {
      calls.seriesToggles++;
    },
    ...(behavior.serviceOverrides ?? {}),
  };
  return { service, calls };
};

// ---------- نمودار مصنوعی برای اجرای callback پلاگین ----------
const makeFakeChartForPlugin = (over = {}) => {
  const ctx = over.ctx ?? makeCtx("plugin");
  return {
    ctx,
    chartArea: over.chartArea === undefined ? { top: 10, bottom: 100 } : over.chartArea,
    _dashShowValues: over._dashShowValues ?? true,
    _dashFrac: over._dashFrac ?? 1,
    config: { type: over.type ?? "line" },
    data: { datasets: over.datasets ?? [] },
    getDatasetMeta: () => over.meta === undefined ? { data: [] } : over.meta,
  };
};

// ---------- رانر ----------
const runCase = (testCase) => {
  chartRecords.length = 0;
  consoleLogs.length = 0;
  consoleErrors.length = 0;
  dom.canvases = new Map();
  dom.queries = [];
  for (const [key, mode] of Object.entries(testCase.canvases ?? { weighting: "ok", loss: "ok", feed: "ok" })) {
    if (mode === "missing") continue;
    const ctx = mode === "noctx" ? null : makeCtx(key);
    dom.canvases.set(CANVAS_IDS[key] ?? key, { id: CANVAS_IDS[key] ?? key, getContext: () => ctx });
  }
  const { service, calls } = makeService(testCase.behavior ?? {});
  let thrown = null;
  try {
    dashboardService.setupCharts.call(service);
  } catch (error) {
    thrown = error?.constructor?.name ?? "Error";
  }
  const chartCalls = chartRecords.map((chart) => ({
    ctxKey: chart.ctx?.key ?? null,
    type: chart.config?.type ?? null,
    datasetLabels: (chart.config?.data?.datasets || []).map((d) => d?.label ?? null),
    datasetCount: (chart.config?.data?.datasets || []).length,
    datasetSummaries: (chart.config?.data?.datasets || []).map((d) => ({
      label: d?.label ?? null,
      dataLength: Array.isArray(d?.data) ? d.data.length : null,
      borderColor: d?.borderColor ?? null,
      backgroundColor: d?.backgroundColor ?? null,
      hoverBackgroundColor: d?.hoverBackgroundColor ?? null,
      fill: d?.fill ?? null,
      tension: d?.tension ?? null,
      pointRadius: d?.pointRadius ?? null,
      pointHitRadius: d?.pointHitRadius ?? null,
      borderRadius: d?.borderRadius ?? null,
    })),
    labels: clone(chart.config?.data?.labels ?? null),
    options: chart.config?.options ?? null,
    pluginIds: (chart.plugins || []).map((p) => p?.id ?? null),
    pluginHasCallback: (chart.plugins || []).map((p) => typeof p?.afterDatasetsDraw === "function"),
    ctxCalls: clone(chart.ctx?.calls ?? []),
  }));
  // اجرای واقعی callback پلاگین (برای هر پلاگین ثبت‌شده)
  const pluginRuns = [];
  for (const chart of chartRecords) {
    for (const plugin of chart.plugins || []) {
      if (typeof plugin?.afterDatasetsDraw !== "function") continue;
      const fake = makeFakeChartForPlugin(testCase.pluginChart ?? {});
      let pluginThrown = null;
      try {
        plugin.afterDatasetsDraw(fake);
      } catch (error) {
        pluginThrown = error?.constructor?.name ?? "Error";
      }
      pluginRuns.push({
        id: plugin.id ?? null,
        thrown: pluginThrown,
        fillTexts: clone((fake.ctx.calls || []).filter((c) => c[0] === "fillText")),
        ctxCalls: clone(fake.ctx.calls || []),
      });
      break;
    }
  }
  return {
    method: "DashboardService#setupCharts",
    thrown,
    chartCalls,
    pluginRuns,
    followUps: calls,
    queries: clone(dom.queries),
    consoleLogs: clone(consoleLogs),
    consoleErrors: clone(consoleErrors),
    destroyed: (testCase.behavior?.chartInstances
      ? Object.values(testCase.behavior.chartInstances)
      : []
    ).map((c) => !!c?.destroyed),
  };
};

// ---------- کِیس‌ها ----------
const PLUGIN_CHART = {
  type: "line",
  _dashFrac: 1,
  chartArea: { top: 10, bottom: 100 },
  datasets: [
    {
      label: "وزن",
      data: [12.34, null, Number.NaN, 7],
      borderColor: "#4a90e2",
    },
    { label: "خوراک", data: [3.5], backgroundColor: "#10b981" },
  ],
  meta: { data: [{ x: 10, y: 50 }, { x: 20, y: 60 }, { x: 30, y: 70 }, { x: 40, y: 5 }] },
};
const cases = [
  {
    name: "P1.پایه-سه-نمودار",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: PLUGIN_CHART,
    anchors: [
      '"id": "dashValueLabels"',
      '"type": "line"',
      '✅ Charts initialized (empty)',
      'وزن (کیلوگرم)',
      'خوراک (کیلوگرم)',
      'تلفات',
      '"labels": []',
      '"borderColor": "#4a90e2"',
      '"backgroundColor": "rgba(16, 185, 129, 0.1)"',
    ],
    extraChecks: [
      ["سه نمودار با کلیدهای درست", (r) =>
        JSON.stringify(r.chartCalls.map((c) => c.ctxKey)) === '["weighting","loss","feed"]'],
      ["نوع نمودارها line/bar/line", (r) =>
        JSON.stringify(r.chartCalls.map((c) => c.type)) === '["line","bar","line"]'],
      ["هر نمودار پلاگین را دارد", (r) =>
        r.chartCalls.every((c) => c.pluginIds.length === 1 && c.pluginIds[0] === "dashValueLabels" && c.pluginHasCallback[0])],
      ["چهار فراخوانی پس‌رو", (r) =>
        r.followUps.resetStats === 1 && r.followUps.compareUi === 1 &&
        r.followUps.options === 1 && r.followUps.tooltips === 1 && r.followUps.seriesToggles === 1],
      ["پاکسازی canvas وزن", (r) =>
        JSON.stringify(r.chartCalls[0].ctxCalls[0]) === '["clearRect",0,0,200,120]'],
      ["callback پلاگین سه برچسب نوشت (null/NaN رد شدند)", (r) =>
        r.pluginRuns.length >= 1 && r.pluginRuns[0].fillTexts.length === 3],
      ["کلمپ y به chartArea.top+4", (r) =>
        r.pluginRuns[0].fillTexts[1][3] === 14],
    ],
  },
  {
    name: "P2.کانواس-وزن-غایب",
    canvases: { weighting: "missing", loss: "ok", feed: "ok" },
    pluginChart: PLUGIN_CHART,
    extraChecks: [
      ["دو نمودار ساخته می‌شود", (r) => r.chartCalls.length === 2],
      ["فقط دو کانواس پرسیده شد", (r) =>
        JSON.stringify(r.queries) === '["weightingCanvas","lossCanvas","feedCanvas"]'],
    ],
  },
  {
    name: "P3.کانواس-تلفات-غایب",
    canvases: { weighting: "ok", loss: "missing", feed: "ok" },
    pluginChart: PLUGIN_CHART,
    extraChecks: [
      ["کلیدها weighting و feed", (r) =>
        JSON.stringify(r.chartCalls.map((c) => c.ctxKey)) === '["weighting","feed"]'],
    ],
  },
  {
    name: "P4.کانواس-خوراک-غایب",
    canvases: { weighting: "ok", loss: "ok", feed: "missing" },
    pluginChart: PLUGIN_CHART,
    extraChecks: [
      ["کلیدها weighting و loss", (r) =>
        JSON.stringify(r.chartCalls.map((c) => c.ctxKey)) === '["weighting","loss"]'],
    ],
  },
  {
    name: "P5.هیچ-کانواسی-نیست",
    canvases: { weighting: "missing", loss: "missing", feed: "missing" },
    pluginChart: PLUGIN_CHART,
    anchors: ['"chartCalls": []', '✅ Charts initialized (empty)'],
    extraChecks: [
      ["فراخوانی‌های پس‌رو همچنان اجرا می‌شوند", (r) =>
        r.followUps.resetStats === 1 && r.followUps.seriesToggles === 1],
    ],
  },
  {
    name: "P6.getContext-نال-برای-وزن",
    canvases: { weighting: "noctx", loss: "ok", feed: "ok" },
    pluginChart: PLUGIN_CHART,
    extraChecks: [
      ["نمودار وزن ساخته نشد", (r) => !r.chartCalls.some((c) => c.ctxKey === "weighting")],
      ["بقیه ساخته شدند", (r) => r.chartCalls.length === 2],
    ],
  },
  {
    name: "P7.چارت‌های-قبلی-destroy-می‌شوند",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: PLUGIN_CHART,
    behavior: {
      chartInstances: {
        weighting: { destroy() { this.destroyed = true; } },
        loss: { destroy() { this.destroyed = true; } },
      },
    },
    anchors: ['"resetStats": 1'],
    extraChecks: [
      ["هر دو چارت قبلی destroy شدند", (r) =>
        JSON.stringify(r.destroyed) === "[true,true]"],
    ],
  },
  {
    name: "P8.destroy-که-پرتاب-می‌کند",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: PLUGIN_CHART,
    behavior: {
      chartInstances: {
        weighting: { destroy() { throw new Error("destroy failed"); } },
        loss: { destroy() { this.destroyed = true; } },
      },
    },
    anchors: ['"thrown": null'],
    extraChecks: [
      ["خطا مهار می‌شود و چارت دوم destroy می‌شود", (r) =>
        JSON.stringify(r.destroyed) === "[false,true]"],
      ["سه نمودار جدید ساخته شد", (r) => r.chartCalls.length === 3],
    ],
  },
  {
    name: "P9.مقدار-فالسی-در-chartInstances",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: PLUGIN_CHART,
    behavior: { chartInstances: { weighting: null, loss: undefined, feed: false } },
    anchors: ['"thrown": null'],
    extraChecks: [
      ["سه نمودار جدید ساخته شد", (r) => r.chartCalls.length === 3],
      ["هیچ destroy ای صدا زده نشد", (r) => JSON.stringify(r.destroyed) === "[false,false,false]"],
    ],
  },
  {
    name: "P10.پلاگین-خاموش",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: { ...PLUGIN_CHART, _dashShowValues: false },
    anchors: ['"id": "dashValueLabels"'],
    extraChecks: [
      ["هیچ متنی نوشته نشد", (r) => r.pluginRuns[0].fillTexts.length === 0],
      ["حتی save/restore هم اجرا نشد", (r) =>
        !r.pluginRuns[0].ctxCalls.some((c) => c[0] === "save")],
    ],
  },
  {
    name: "P11.پلاگین-بدون-chartArea",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: { ...PLUGIN_CHART, chartArea: null },
    extraChecks: [
      ["هیچ متنی نوشته نشد", (r) => r.pluginRuns[0].fillTexts.length === 0],
      ["حتی save/restore هم اجرا نشد", (r) =>
        !r.pluginRuns[0].ctxCalls.some((c) => c[0] === "save")],
    ],
  },
  {
    name: "P12.دیتاست-پنهان",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: {
      ...PLUGIN_CHART,
      datasets: [{ label: "پنهان", data: [5], hidden: true, borderColor: "#000" }],
    },
    extraChecks: [
      ["دیتاست پنهان نوشته نشد ولی save/restore هست", (r) =>
        r.pluginRuns[0].fillTexts.length === 0 &&
        r.pluginRuns[0].ctxCalls.some((c) => c[0] === "save") &&
        r.pluginRuns[0].ctxCalls.some((c) => c[0] === "restore")],
    ],
  },
  {
    name: "P13.دقت-اعشار-غیرعدد",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: { ...PLUGIN_CHART, _dashFrac: "نامعتبر" },
    extraChecks: [
      ["دقت صفر اعمال شد (بدون ارقام فارسی دستی)", (r) => {
        const expected = Number(12.34).toLocaleString("fa-IR", { maximumFractionDigits: 0 });
        return r.pluginRuns[0].fillTexts[0][1] === expected;
      }],
    ],
  },
  {
    name: "P14.پلاگین-روی-نمودار-میله‌ای",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: {
      ...PLUGIN_CHART,
      type: "bar",
      datasets: [{ label: "میله", data: [9], borderColor: "#111" }],
      meta: { data: [{ x: 20, y: 60, width: 12 }] },
    },
    extraChecks: [
      ["مختصات میله: x وسط ستون و y بالا‌تر از میله", (r) =>
        r.pluginRuns[0].fillTexts[0][2] === 26 && r.pluginRuns[0].fillTexts[0][3] === 55],
    ],
  },
  {
    name: "P15.meta-نال",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: { ...PLUGIN_CHART, meta: null },
    extraChecks: [
      ["هیچ متنی نوشته نشد", (r) => r.pluginRuns[0].fillTexts.length === 0],
    ],
  },
  {
    name: "P16.x-غیرعدد-در-متد‌داده",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: {
      ...PLUGIN_CHART,
      datasets: [{ label: "الف", data: [1, 2], borderColor: "#111" }],
      meta: { data: [{ x: "نامعتبر", y: 50 }, { x: 30, y: 60 }] },
    },
    extraChecks: [
      ["فقط عنصر دوم نوشته شد", (r) =>
        r.pluginRuns[0].fillTexts.length === 1 && r.pluginRuns[0].fillTexts[0][2] === 30],
    ],
  },
  {
    name: "P17.زنجیرهٔ-رنگ-پیش‌فرض",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: {
      ...PLUGIN_CHART,
      datasets: [
        { label: "۱", data: [1], borderColor: "#border" },
        { label: "۲", data: [2], backgroundColor: "#bg" },
        { label: "۳", data: [3] },
      ],
      meta: { data: [{ x: 1, y: 90 }, { x: 2, y: 90 }, { x: 3, y: 90 }] },
    },
    extraChecks: [
      ["رنگ‌ها: borderColor ⇒ backgroundColor ⇒ پیش‌فرض", (r) => {
        const fills = r.pluginRuns[0].ctxCalls.filter((c) => c[0] === "fillStyle").map((c) => c[1]);
        return JSON.stringify(fills) === '["#border","#bg","#475569"]';
      }],
    ],
  },
  {
    name: "P18.پیکربندی-نمودارها-و-پس‌رو",
    canvases: { weighting: "ok", loss: "ok", feed: "ok" },
    pluginChart: PLUGIN_CHART,
    anchors: [
      '"display": false',
      '"dataLength": 0',
      '"beginAtZero": true',
      '"consoleErrors": []',
      '"compareUi": 1',
      '"seriesToggles": 1',
    ],
    extraChecks: [
      ["راهنمای نمودار وزن روشن و بقیه خاموش", (r) =>
        r.chartCalls[0].options.plugins.legend.display === true &&
        r.chartCalls[1].options.plugins.legend.display === false &&
        r.chartCalls[2].options.plugins.legend.display === false],
      ["تنظیمات مشترک تولتیپ", (r) =>
        r.chartCalls.every((c) =>
          c.options.interaction.mode === "index" &&
          c.options.plugins.tooltip.rtl === true &&
          c.options.plugins.tooltip.bodyFont.family === "Vazir" &&
          c.options.plugins.datalabels.display === false)],
      ["ترتیب پرسش کانواس‌ها", (r) =>
        JSON.stringify(r.queries) === '["weightingCanvas","lossCanvas","feedCanvas"]'],
    ],
  },
];

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const GOLDEN_URL = new URL("../docs/dashboard-setup-charts-body-golden.json", import.meta.url);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

check(
  "متد هدف DashboardService#setupCharts موجود است",
  typeof dashboardService?.setupCharts === "function",
);
check(
  "استاب Chart نصب شده است",
  globalThis.Chart === FakeChart,
);

// ⚠️ هشدار آسنکرون Node بیرون از ضبط بماند (تلهٔ موج ۳.۲i).
await new Promise((resolve) => setImmediate(resolve));

const captured = {};
const caseRecords = [];
for (const testCase of cases) {
  const record = runCase(testCase);
  caseRecords.push({
    name: testCase.name,
    thrown: record.thrown,
    charts: record.chartCalls.length,
  });
  const text = recordText(record);
  const view = anchorView(text);
  captured[testCase.name] = {
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: sha256(text),
  };
  for (const anchor of testCase.anchors ?? []) {
    check(`${testCase.name} → انکر «${anchor}»`, view.includes(anchor));
  }
  for (const anchor of testCase.absent ?? []) {
    check(`${testCase.name} → غیبت «${anchor}»`, !view.includes(anchor));
  }
  for (const [label, predicate] of testCase.extraChecks ?? []) {
    // ⚠️ اگر خودِ predicate خطا بدهد، به‌جای کرش گارد، FAIL گزارش می‌شود.
    let ok = false;
    let reason = "";
    try {
      ok = Boolean(predicate(record, testCase));
    } catch (error) {
      reason = `predicateError=${error?.constructor?.name ?? "Error"}: ${error?.message ?? ""}`;
    }
    check(`${testCase.name} → ${label}`, ok, reason);
  }
}

check(
  "هیچ کِیسی خطای بیرون‌زده ندارد",
  caseRecords.every((r) => r.thrown === null),
  caseRecords
    .filter((r) => r.thrown !== null)
    .map((r) => r.name)
    .join(","),
);
check(
  "کِیس‌های با کانواس، سه نمودار می‌سازند و کِیس بدون کانواس، صفر",
  caseRecords.find((r) => r.name.startsWith("P1."))?.charts === 3 &&
    caseRecords.find((r) => r.name.startsWith("P5."))?.charts === 0,
  JSON.stringify(caseRecords.map((r) => `${r.name.split(".")[0]}:${r.charts}`)),
);

// ===== پایداری: دو اجرای متوالی کِیس اول =====
const firstCase = cases[0];
const firstAgain = recordText(runCase(firstCase));
check(
  "دو اجرای متوالی کِیس اول رکورد یکسان می‌دهند",
  sha256(firstAgain) === captured[firstCase.name].sha256,
);

// ===== اسنپ‌شات طلایی =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${JSON.stringify(
      {
        note: "اسنپ‌شات رکورد ساختاری متد غول ساخت نمودارهای داشبورد (DashboardService#setupCharts)، گرفته‌شده پیش از موج برش بدنه (۳.۲o). هر کِیس = رکورد JSON شامل آرگومان‌های هر فراخوانی new Chart (نوع، دیتاست‌ها، گزینه‌ها، شناسهٔ پلاگین‌ها)، فراخوانی‌های ctx، **خروجی واقعی callback پلاگین (fillTextها)**، وضعیت destroy چارت‌های قبلی، فراخوانی‌های پس‌رو و console. بازتولید: npm run test:dashboard:setup-charts:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: "HEAD پیش از برش بدنه — git tag pre-setup-charts-body-split",
        note2:
          "متن پلاگین با toLocaleString(\"fa-IR\") ساخته می‌شود ⇒ به locale/ICU وابسته است؛ رکورد کل پیکربندی‌های three chart را هم شامل می‌شود (بزرگ‌ترین بخش رکورد).",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/dashboard-setup-charts-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check("اسنپ‌شات طلایی docs/dashboard-setup-charts-body-golden.json موجود است", false, "با --snapshot بساز");
} else {
  const golden = JSON.parse(fs.readFileSync(GOLDEN_URL, "utf8"));
  const goldenNames = Object.keys(golden.cases ?? {});
  check(
    `اسنپ‌شات طلایی هر ${Object.keys(captured).length} کِیس را پوشش می‌دهد`,
    goldenNames.length === Object.keys(captured).length,
    `اسنپ‌شات=${goldenNames.length}`,
  );
  for (const [name, digest] of Object.entries(captured)) {
    const expected = golden.cases?.[name];
    check(
      `${name} → برابری بایت‌به‌بایت با اسنپ‌شات`,
      !!expected && expected.sha256 === digest.sha256 && expected.bytes === digest.bytes,
      expected
        ? `انتظار ${expected.sha256.slice(0, 10)}/${expected.bytes}B · دریافت ${digest.sha256.slice(0, 10)}/${digest.bytes}B`
        : "این کِیس در اسنپ‌شات نیست",
    );
  }
}

console.log = consoleLog;
console.error = consoleError;
const failed = results.filter((ok) => !ok).length;
if (failed) {
  consoleLog(`\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ ساخت نمودارهای داشبورد`);
  process.exitCode = 1;
} else {
  consoleLog(`\n✅ هر ${results.length} بررسی موفق — رفتار متد و پلاگینش پایدار است`);
}
