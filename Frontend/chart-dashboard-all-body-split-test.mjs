// ============================================================
//  تست برابری بدنهٔ متد غول رندر همهٔ نمودارها — گارد موج برش بدنه (۳.۲n)
//  اجرا:  npm run test:chart-dashboard:all:body                  (در پوشهٔ Frontend)
//         npm run test:chart-dashboard:all:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ متد بزرگ زیر برش بدنه می‌خورد (کد از داخل متد به تابع‌های
//  ماژول‌محلی منتقل می‌شود) بدون تغییر یک بایت از رفتار:
//    chart-dashboard.service.js:1385  chartDashboardService.renderAllCharts   ۲۲۳ خط
//  این متد «پیکربندی‌محور» است: یک فراخوانی سنگین `renderChart("mainChart", …)`
//  با گزینه‌های ۶۶ خطی (سه callback درون‌خطی) و هفت فراخوانی دیگر.
//  روش سنجش (نسبت به گاردهای قبلی کامل‌تر):
//    • یک `this` جعلی با ۱۰ stub ثبت‌کننده (همان متدهایی که متد مصرف می‌کند)
//      و ۶ ویژگی؛ متد با `chartDashboardService.renderAllCharts.call(service)`
//      اجرا می‌شود. فقط `document.getElementById` هم استاب می‌شود.
//    • رکورد هر کِیس، **آرگومان‌های هر ۸ فراخوانی `renderChart`** به‌همراه ترتیب آن‌ها
//      و تعداد فراخوانی `renderMainSeriesControls` است.
//    • ⚠️ callbackهای درون‌خطی **واقعاً اجرا می‌شوند** (با ورودی مصنوعی) و خروجی‌شان
//      در رکورد می‌آید؛ وگرنه برشِ گزینه‌ها بی‌پوشش می‌ماند.
//    • اسنپ‌شات طلایی: sha256 رکورد JSON هر کِیس در
//      docs/chart-dashboard-all-body-golden.json (پیش از برش) ⇒ هر بایت تغییر، FAIL.
//  (پس از موج ۳.۲n این متد ۱۲۸ خط است؛ عدد بالای این بلوک وضعیت «پیش از برش» را ثبت می‌کند.)
//  ⚠️ دو درس موج ۳.۲n: ① کمکیِ برگردانندهٔ شیء باید `=> (` داشته باشد وگرنه `{` بدنهٔ
//     بلوکی تفسیر می‌شود (SyntaxError)؛ ② این گارد ناسازگاری `dailyGain`/`dailyGainGrams` را
//     کشف کرد (کِیس N3) و آن را مستند کرده، نه اصلاح.
//  ⚠️ ارقام/متن فارسی از `toLocaleString("fa-IR")` می‌آید (locale/ICU وابسته است).
//  ⚠️ اگر عمداً رفتار تغییر کرد، اول:
//     npm run test:chart-dashboard:all:body -- --snapshot
// ============================================================
import crypto from "node:crypto";
import fs from "node:fs";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);
const clone = (value) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));
const safe = (fn) => {
  try {
    return clone(fn());
  } catch (error) {
    return { thrown: error?.constructor?.name ?? "Error" };
  }
};

// ---------- استاب مرورگر ----------
const dom = { elements: new Map(), queries: [] };
globalThis.document = {
  getElementById: (id) => {
    dom.queries.push(id);
    return dom.elements.has(id) ? dom.elements.get(id) : null;
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    addEventListener() {},
  }),
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
const SERVICE_MODULE =
  "./src/features/customer-info/sections/chart-dashboard/chart-dashboard.service.js";
const { chartDashboardService } = await import(SERVICE_MODULE);

// ---------- فیکسچرها ----------
const makeFlock = (over = {}) => ({
  flockNumber: 12,
  hallName: "سالن ۳",
  series: [
    {
      week: 1,
      weight: 1.8,
      stdWeight: 2.0,
      weightGain: 0.4,
      stdGain: 0.45,
      dailyGain: 25,
      stdDailyGainGrams: 27,
      fcr: 1.12,
      stdFcr: 1.05,
    },
    {
      week: 2,
      weight: 2.3,
      stdWeight: null,
      weightGain: null,
      stdGain: 0.5,
      dailyGain: 30,
      stdDailyGainGrams: 30,
      fcr: 1.2,
      stdFcr: null,
    },
  ],
  ...over,
});
const FIXTURE_FLOCKS = [makeFlock(), makeFlock({ flockNumber: 13, hallName: "سالن ۴" })];

// ---------- میزبان جعلی سرویس ----------
const makeService = (behavior = {}) => {
  const calls = {
    flockDatasets: [],
    compareDatasets: [],
    breedStdDatasets: [],
    withCompare: [],
    fcrDatasets: 0,
    renderChart: [],
    seriesControls: 0,
    getSelectedFlocks: 0,
    getWeekLabels: 0,
    flockLabel: [],
  };
  const service = {
    mainIndicator: "weight",
    showStandards: true,
    showDataLabels: true,
    labelStyle: { valueColor: "#111827", valueSize: 10 },
    mortalityMode: "weekly",
    survivalMode: "cumulative",
    flocks: FIXTURE_FLOCKS,
    getSelectedFlocks() {
      calls.getSelectedFlocks++;
      return behavior.selectedFlocks ?? service.flocks;
    },
    getWeekLabels() {
      calls.getWeekLabels++;
      return behavior.weekLabels ?? ["هفته ۱", "هفته ۲"];
    },
    buildFlockDatasets(selected, key, opts) {
      calls.flockDatasets.push({ selectedCount: (selected || []).length, key, opts: clone(opts) });
      return behavior.flockDatasets ?? [{ label: `گله · ${key}` }];
    },
    buildCompareDatasets(key) {
      calls.compareDatasets.push(key);
      return behavior.compareDatasets ?? [{ label: `مقایسه · ${key}` }];
    },
    buildBreedStdDatasets(opts) {
      calls.breedStdDatasets.push(clone(opts));
      return behavior.breedStdDatasets ?? [{ label: `نژاد · ${opts?.stdKey}` }];
    },
    withCompare(datasets, key) {
      calls.withCompare.push({ count: (datasets || []).length, key });
      return [...(datasets || []), { label: `با مقایسه · ${key}` }];
    },
    _buildFcrDatasets(selected) {
      calls.fcrDatasets++;
      return [{ label: `FCR · ${(selected || []).length}` }];
    },
    flockLabel(f) {
      calls.flockLabel.push(String(f?.flockNumber));
      return `گله ${f?.flockNumber}`;
    },
    renderChart(id, datasets, labels, yLabel, type, options) {
      calls.renderChart.push({
        id,
        datasetLabels: (datasets || []).map((d) => d?.label ?? null),
        datasetCount: (datasets || []).length,
        labels: clone(labels),
        yLabel,
        type,
        options,
      });
    },
    renderMainSeriesControls() {
      calls.seriesControls++;
    },
    ...(behavior.serviceOverrides ?? {}),
  };
  return { service, calls };
};

// ---------- نرمال‌سازی گزینه‌ها (اجرای واقعی callbackها) ----------
const normalizeOptions = (options) => {
  if (!options || typeof options !== "object") return { raw: options ?? null };
  const out = {
    keys: Object.keys(options).sort(),
    tooltipUnit: options.tooltipUnit ?? null,
    hasTooltip: !!options.tooltip,
    hasDatalabels: !!options.datalabels,
  };
  if (options.tooltip) {
    const cb = options.tooltip.callbacks || {};
    out.tooltip = {
      mode: options.tooltip.mode ?? null,
      intersect: options.tooltip.intersect ?? null,
      callbacks: Object.keys(cb).sort(),
      titleItem: safe(() => cb.title?.([{ dataIndex: 0 }])),
      titleEmpty: safe(() => cb.title?.([])),
      titleNull: safe(() => cb.title?.(null)),
      labelValue: safe(() =>
        cb.label?.({ raw: 12.345, dataset: { label: "گله ۱۲" } }),
      ),
      labelNull: safe(() => cb.label?.({ raw: null, dataset: { label: "گله ۱۲" } })),
      labelUndefined: safe(() =>
        cb.label?.({ raw: undefined, dataset: { label: "گله ۱۲" } }),
      ),
      afterBodyItem: safe(() => cb.afterBody?.([{ dataIndex: 1 }])),
      afterBodyItem2: safe(() => cb.afterBody?.([{ dataIndex: 0 }])),
      afterBodyEmpty: safe(() => cb.afterBody?.([])),
      afterBodyNull: safe(() => cb.afterBody?.(null)),
    };
  }
  if (options.datalabels) {
    out.datalabels = {
      display: options.datalabels.display ?? null,
      color: options.datalabels.color ?? null,
      font: clone(options.datalabels.font ?? null),
      anchor: options.datalabels.anchor ?? null,
      align: options.datalabels.align ?? null,
      formatterValue: safe(() => options.datalabels.formatter?.(3.14159)),
      formatterNull: safe(() => options.datalabels.formatter?.(null)),
      formatterUndefined: safe(() => options.datalabels.formatter?.(undefined)),
    };
  }
  return out;
};
// `afterBodyItem` با هفتهٔ ۲ و `afterBodyItem2` با هفتهٔ ۱ اجرا می‌شود تا هر دو شاخهٔ
// «weekNo با/بدون سری» پوشش داده شود.

// ---------- رانر ----------
const runCase = (testCase) => {
  dom.elements = new Map();
  dom.queries = [];
  for (const [id, text] of Object.entries(testCase.elements ?? {})) {
    dom.elements.set(id, { textContent: "", value: text });
  }
  const { service, calls } = makeService(testCase.behavior ?? {});
  let thrown = null;
  let returned;
  try {
    returned = chartDashboardService.renderAllCharts.call(service);
  } catch (error) {
    thrown = error?.constructor?.name ?? "Error";
  }
  const titleEl = dom.elements.get("mainChartTitle");
  return {
    method: "chartDashboardService.renderAllCharts",
    thrown,
    returned: returned === undefined ? null : clone(returned),
    titleText: titleEl ? titleEl.textContent : null,
    domQueries: clone(dom.queries),
    chartCalls: calls.renderChart.map((c) => ({
      id: c.id,
      datasetLabels: c.datasetLabels,
      datasetCount: c.datasetCount,
      labels: c.labels,
      yLabel: c.yLabel,
      type: c.type,
      options: normalizeOptions(c.options),
    })),
    callOrder: calls.renderChart.map((c) => c.id),
    datasets: {
      flock: calls.flockDatasets,
      compare: calls.compareDatasets,
      breedStd: calls.breedStdDatasets,
      withCompare: calls.withCompare,
      fcr: calls.fcrDatasets,
    },
    flockLabelCalls: calls.flockLabel,
    seriesControls: calls.seriesControls,
    hostCalls: {
      getSelectedFlocks: calls.getSelectedFlocks,
      getWeekLabels: calls.getWeekLabels,
    },
  };
};

// ---------- کِیس‌ها ----------
const CHART_IDS = [
  "mainChart",
  "totalWeightGainChart",
  "totalLiveWeightChart",
  "fcrChart",
  "mortalityCountChart",
  "mortalityPctChart",
  "survivalPctChart",
  "blackoutChart",
];
const elementsBase = { mainChartTitle: "عنوان", mainChartType: "line" };
const cases = [
  {
    name: "N1.شاخص-وزن-پایه",
    elements: elementsBase,
    args: () => ({}),
    anchors: [
      '"titleText": "وزنگیری (روند وزن هفتگی)"',
      '"seriesControls": 1',
      '"id": "mainChart"',
      '"id": "blackoutChart"',
      '"type": "line"',
      '"yLabel": "وزن (کیلوگرم)"',
      '"tooltipUnit": " kg"',
    ],
    extraChecks: [
      ["ترتیب ۸ نمودار", (r) => JSON.stringify(r.callOrder) === JSON.stringify(CHART_IDS)],
      ["getSelectedFlocks حداقل دو بار (پیشانی + callback)", (r) =>
        r.hostCalls.getSelectedFlocks >= 2],
      ["getWeekLabels یک‌بار", (r) => r.hostCalls.getWeekLabels === 1],
      ["برداشت استاندارد وزن", (r) =>
        JSON.stringify(r.datasets.flock[0].opts.bandKey) === '{"min":"stdMin","max":"stdMax"}'],
      ["خط میانگین خاموش", (r) => r.datasets.flock[0].opts.showMeanLine === false],
    ],
  },
  {
    name: "N2.شاخص-افزایش-وزن",
    elements: elementsBase,
    behavior: { serviceOverrides: { mainIndicator: "gain" } },
    anchors: ['"bandKey": {', "stdGainMin", "stdGainMax"],
    extraChecks: [
      ["برداشت stdGain", (r) => r.datasets.flock[0].opts.bandKey.min === "stdGainMin"],
    ],
  },
  {
    // ⚠️ ناسازگاری پنهان (توسط همین گارد کشف شد، اصلاح نشد): برای `mainIndicator: "dailyGain"`
    // مقدار `main.key` برابر `"dailyGainGrams"` است، پس شرط `main.key === "dailyGain"`
    // هرگز برقرار نمی‌شود و بازهٔ استاندارد به شاخهٔ پیش‌فرض (`stdMin`/`stdMax`) می‌افتد.
    name: "N3.شاخص-نرخ-رشد-روزانه-رفتار-واقعی",
    elements: elementsBase,
    behavior: { serviceOverrides: { mainIndicator: "dailyGain" } },
    anchors: ['"yLabel": "گرم در روز"', '"tooltipUnit": " گرم"'],
    extraChecks: [
      ["بازهٔ استاندارد به پیش‌فرض می‌افتد (ناسازگاری مستند)", (r) =>
        r.datasets.flock[0].opts.bandKey.min === "stdMin" &&
        r.datasets.flock[0].opts.bandKey.max === "stdMax"],
    ],
  },
  {
    name: "N4.شاخص-نامعتبر-خطای-مرزی",
    elements: elementsBase,
    behavior: { serviceOverrides: { mainIndicator: "weird" } },
    anchors: ['"thrown": "TypeError"', '"chartCalls": []'],
  },
  {
    name: "N5.استانداردها-خاموش",
    elements: elementsBase,
    behavior: { serviceOverrides: { showStandards: false } },
    anchors: ['"afterBodyItem": []', '"afterBodyEmpty": []'],
    extraChecks: [
      ["هیچ برچسب گله‌ای ساخته نشد", (r) => r.flockLabelCalls.length === 0],
    ],
  },
  {
    name: "N6.برچسب‌های-داده-خاموش",
    elements: elementsBase,
    behavior: { serviceOverrides: { showDataLabels: false } },
    anchors: ['"hasDatalabels": true', '"display": null'],
    extraChecks: [
      ["formatter وجود ندارد", (r) => {
        const dl = r.chartCalls[0].options.datalabels;
        return dl.display === null && dl.formatterValue === null;
      }],
    ],
  },
  {
    name: "N7.نوع-نمودار-bar",
    elements: { mainChartTitle: "عنوان", mainChartType: "bar" },
    anchors: ['"type": "bar"'],
    extraChecks: [
      ["همهٔ هشت نمودار bar نیستند", (r) =>
        r.chartCalls.filter((c) => c.type === "bar").length === 1],
    ],
  },
  {
    name: "N8.عنصر-نوع-نمودار-غایب",
    elements: { mainChartTitle: "عنوان" },
    anchors: ['"type": "line"'],
    extraChecks: [
      ["مقدار پیش‌فرض خطی", (r) => r.chartCalls[0].type === "line"],
    ],
  },
  {
    name: "N9.عنصر-عنوان-غایب",
    elements: { mainChartType: "bar" },
    anchors: ['"titleText": null'],
    extraChecks: [
      ["خطایی پرت نمی‌شود", (r) => r.thrown === null],
      ["همان شناسه‌ها پرسیده می‌شوند", (r) =>
        JSON.stringify(r.domQueries) === '["mainChartTitle","mainChartType"]'],
    ],
  },
  {
    name: "N10.حالت-تلفات-کل",
    elements: elementsBase,
    behavior: { serviceOverrides: { mortalityMode: "total" } },
    extraChecks: [
      ["کلید تلفات کل", (r) =>
        r.datasets.flock.some((f) => f.key === "mortalityPctTotal") &&
        !r.datasets.flock.some((f) => f.key === "mortalityPctWeekly")],
    ],
  },
  {
    name: "N11.حالت-زنده‌مانی-هفتگی",
    elements: elementsBase,
    behavior: { serviceOverrides: { survivalMode: "weekly" } },
    extraChecks: [
      ["کلید زنده‌مانی هفتگی", (r) =>
        r.datasets.flock.some((f) => f.key === "survivalPctWeekly")],
    ],
  },
  {
    name: "N12.بدون-گلهٔ-انتخاب‌شده",
    elements: elementsBase,
    behavior: { selectedFlocks: [] },
    anchors: ['"datasetCount": 2'],
    extraChecks: [
      ["همهٔ فراخوانی‌ها با گلهٔ خالی", (r) =>
        r.datasets.flock.every((f) => f.selectedCount === 0)],
      ["هیچ برچسب گله‌ای ساخته نشد", (r) => r.flockLabelCalls.length === 0],
    ],
  },
  {
    name: "N13.استاندارد-با-دو-گله",
    elements: elementsBase,
    extraChecks: [
      ["دو خط استاندارد برای هفتهٔ دارای مقدار", (r) =>
        Array.isArray(r.chartCalls[0].options.tooltip.afterBodyItem2) &&
        r.chartCalls[0].options.tooltip.afterBodyItem2.length === 2],
      ["برچسب هر دو گله ساخته شد", (r) =>
        JSON.stringify([...new Set(r.flockLabelCalls)]) === '["12","13"]'],
      ["خط استاندارد با برچسب گله و واحد کیلوگرم", (r) =>
        r.chartCalls[0].options.tooltip.afterBodyItem2[0].startsWith("استاندارد گله 12:") &&
        r.chartCalls[0].options.tooltip.afterBodyItem2[0].includes("kg")],
    ],
  },
  {
    name: "N14.گلهٔ-بدون-سری",
    elements: elementsBase,
    behavior: { selectedFlocks: [makeFlock({ series: undefined })] },
    anchors: ['"afterBodyItem": []'],
  },
  {
    name: "N15.مقدار-استاندارد-نال-در-هفتهٔ-دوم",
    elements: elementsBase,
    extraChecks: [
      ["هفتهٔ دوم (stdWeight نال) ⇒ هیچ خطی", (r) =>
        r.chartCalls[0].options.tooltip.afterBodyItem.length === 0],
      ["هفتهٔ اول ⇒ دو خط", (r) =>
        r.chartCalls[0].options.tooltip.afterBodyItem2.length === 2],
    ],
  },
  {
    name: "N16.استاندارد-صفر-و-مقدار-نال",
    elements: elementsBase,
    behavior: {
      selectedFlocks: [
        makeFlock({
          series: [
            { week: 2, weight: 2.0, stdWeight: 0, fcr: 1.2, stdFcr: 1.1 },
            { week: 3, weight: null, stdWeight: 2.2, fcr: null, stdFcr: 1.2 },
          ],
        }),
      ],
    },
    anchors: ['"afterBodyItem2": []'],
    extraChecks: [
      ["استاندارد صفر ⇒ خط بدون انحراف درصدی", (r) => {
        const lines = r.chartCalls[0].options.tooltip.afterBodyItem;
        return lines.length === 1 && !lines[0].includes("٪");
      }],
      ["هفتهٔ ناموجود ⇒ هیچ خطی", (r) =>
        r.chartCalls[0].options.tooltip.afterBodyItem2.length === 0],
    ],
  },
  {
    name: "N17.برچسب-مقدار-عددی-و-نال",
    elements: elementsBase,
    extraChecks: [
      ["مقدار نال ⇒ خط تیره", (r) =>
        String(r.chartCalls[0].options.tooltip.labelNull).includes("—")],
      ["مقدار undefined ⇒ خط تیره", (r) =>
        String(r.chartCalls[0].options.tooltip.labelUndefined).includes("—")],
      ["مقدار عددی با واحد شاخص", (r) => {
        const out = String(r.chartCalls[0].options.tooltip.labelValue);
        return out.startsWith("گله ۱۲: ") && out.endsWith(" kg");
      }],
    ],
  },
  {
    name: "N18.عنوان-تولتیپ-با-آیتم-و-خالی",
    elements: elementsBase,
    extraChecks: [
      ["عنوان تولتیپ شامل شمارهٔ هفته", (r) => {
        const out = String(r.chartCalls[0].options.tooltip.titleItem);
        return out.startsWith("هفته ") && out.length >= 6;
      }],
      ["بدون آیتم ⇒ رشتهٔ خالی", (r) => r.chartCalls[0].options.tooltip.titleEmpty === ""],
      ["null ⇒ رشتهٔ خالی", (r) => r.chartCalls[0].options.tooltip.titleNull === ""],
    ],
  },
  {
    name: "N19.تعداد-دیتاست‌ها-و-مقایسه",
    elements: elementsBase,
    behavior: {
      compareDatasets: [{ label: "مقایسه ۱" }, { label: "مقایسه ۲" }],
      breedStdDatasets: [{ label: "نژاد ۱" }],
    },
    extraChecks: [
      ["دیتاست نمودار اصلی = گله + مقایسه + نژاد", (r) =>
        r.chartCalls[0].datasetCount === 4],
      ["withCompare روی شش نمودار", (r) => r.datasets.withCompare.length === 6],
      ["نژاد یک‌بار ساخته شد", (r) => r.datasets.breedStd.length === 1],
    ],
  },
  {
    name: "N20.برچسب‌های-سفارشی-هفته",
    elements: elementsBase,
    behavior: { weekLabels: ["هفتهٔ ۱", "هفتهٔ ۲", "هفتهٔ ۳"] },
    anchors: ['"هفتهٔ ۳"'],
    extraChecks: [
      ["همهٔ نمودارها یک برچسب دارند", (r) =>
        r.chartCalls.every((c) => c.labels.length === 3)],
    ],
  },
];

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const GOLDEN_URL = new URL("../docs/chart-dashboard-all-body-golden.json", import.meta.url);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

check(
  "متد هدف chartDashboardService.renderAllCharts موجود است",
  typeof chartDashboardService?.renderAllCharts === "function",
);
check(
  "میزبان جعلی همهٔ ۱۰ متد مصرفی را دارد",
  [
    "getSelectedFlocks",
    "getWeekLabels",
    "buildFlockDatasets",
    "buildCompareDatasets",
    "buildBreedStdDatasets",
    "renderChart",
    "flockLabel",
    "withCompare",
    "_buildFcrDatasets",
    "renderMainSeriesControls",
  ].every((name) => typeof makeService().service[name] === "function"),
);

// ⚠️ هشدار آسنکرون Node بیرون از ضبط بماند (تلهٔ موج ۳.۲i).
await new Promise((resolve) => setImmediate(resolve));

const captured = {};
const caseRecords = [];
for (const testCase of cases) {
  const record = runCase(testCase);
  caseRecords.push({ name: testCase.name, thrown: record.thrown, charts: record.chartCalls.length });
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
    check(`${testCase.name} → ${label}`, Boolean(predicate(record, testCase)));
  }
}

check(
  "تنها کِیس شاخص نامعتبر پرتاب خطا می‌کند",
  caseRecords.filter((r) => r.thrown !== null).length === 1 &&
    caseRecords.find((r) => r.thrown !== null)?.name.startsWith("N4."),
  caseRecords
    .filter((r) => r.thrown !== null)
    .map((r) => r.name)
    .join(","),
);
check(
  "همهٔ کِیس‌های سالم دقیقاً ۸ نمودار می‌سازند",
  caseRecords.filter((r) => r.thrown === null).every((r) => r.charts === 8),
  caseRecords
    .filter((r) => r.thrown === null && r.charts !== 8)
    .map((r) => `${r.name}:${r.charts}`)
    .join(","),
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
        note: "اسنپ‌شات رکورد ساختاری متد غول رندر همهٔ نمودارها (chartDashboardService.renderAllCharts)، گرفته‌شده پیش از موج برش بدنه (۳.۲n). هر کِیس = رکورد JSON شامل آرگومان‌های هر ۸ فراخوانی renderChart (به‌همراه ترتیب)، گزینه‌ها با **خروجی واقعی callbackها** (title/label/afterBody/formatter)، فراخوانی‌های سازندهٔ دیتاست‌ها و برچسب گله‌ها. بازتولید: npm run test:chart-dashboard:all:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        source: "HEAD پیش از برش بدنه — git tag pre-all-charts-body-split",
        note2:
          "خروجی callbackها از toLocaleString(\"fa-IR\") استفاده می‌کند و به locale/ICU وابسته است؛ هارنس ساعت را تثبیت نمی‌کند چون متد هیچ Date ندارد، ولی TZ محیط باید ثابت بماند.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/chart-dashboard-all-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check("اسنپ‌شات طلایی docs/chart-dashboard-all-body-golden.json موجود است", false, "با --snapshot بساز");
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

const failed = results.filter((ok) => !ok).length;
if (failed) {
  console.log(`\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ رندر همهٔ نمودارها`);
  process.exitCode = 1;
} else {
  console.log(`\n✅ هر ${results.length} بررسی موفق — رفتار متد و callbackهایش پایدار است`);
}
