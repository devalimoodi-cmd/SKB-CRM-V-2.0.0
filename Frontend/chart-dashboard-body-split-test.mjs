// ============================================================
//  تست برابری بدنهٔ متد غول نمودارهای تحلیلی — گارد موج برش بدنه (۳.۲k)
//  اجرا:  npm run test:chart-dashboard:body                  (در پوشهٔ Frontend)
//         npm run test:chart-dashboard:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ متد بزرگ زیر برش بدنه می‌خورد (کد از داخل متد به تابع‌های
//  ماژول‌محلی منتقل می‌شود) بدون تغییر یک بایت از خروجی:
//    chart-dashboard.renderer.js:8  chartDashboardRenderer.renderContainer   ۲۴۹ خط
//  هیچ تستی این خوشه را نمی‌پوشاند. متد کانتینر `.skb-charts-container` را
//  می‌گیرد و `innerHTML` آن را با یک قالب ~۱۸۷ خطی می‌سازد؛ پس گارد خودِ
//  «کالینتر جعلی» را می‌سازد و بایت‌های HTML نوشته‌شده را قفل می‌کند.
//  روش سنجش دو لایه است (هم‌سبک گاردهای هفتگی/سالن/پایان دوره/بوکمارک/گزارش پیامک):
//    ۱) «انکر»های رفتاری: زیررشته‌های کلیدی قالب زنده (PASS/FAIL).
//    ۲) «اسنپ‌شات طلایی»: sha256 رکورد JSON هر کِیس در
//       docs/chart-dashboard-body-golden.json (پیش از برش) ⇒ هر بایت تغییر، FAIL.
//  ✅ این گارد **بدون وابستگی به ساعت/locale/ICU** است (متد هیچ `Date`/`Intl`
//     ندارد) و این ادعا با یک بررسی منبع‌محور در پایین تست می‌شود.
//  ⚠️ بایت‌های قالب داخل backtick به «سبک پایان خط فایل هدف» هم وابسته‌اند؛
//     فایل هدف LF است و اسنپ‌شات در همین وضعیت گرفته شده است.
//  ⚠️ اگر عمداً رفتار تغییر کرد، اول:
//     npm run test:chart-dashboard:body -- --snapshot
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

// ---------- استاب مرورگر (قبل از import ماژول) ----------
const makeEl = () => ({
  innerHTML: "",
  textContent: "",
  value: "",
  checked: false,
  style: {},
  dataset: {},
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {},
  removeEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
});
const dom = {
  containerPresent: true,
  queryCount: 0,
  lastSelector: null,
  getElementByIdCalls: 0,
  createdElements: [],
};
let container = makeEl();
globalThis.document = {
  querySelector: (selector) => {
    dom.queryCount++;
    dom.lastSelector = selector;
    return dom.containerPresent ? container : null;
  },
  querySelectorAll: () => [],
  getElementById: () => {
    dom.getElementByIdCalls++;
    return null;
  },
  createElement: () => {
    const el = makeEl();
    dom.createdElements.push(el);
    return el;
  },
  addEventListener() {},
  removeEventListener() {},
  body: makeEl(),
};
globalThis.window = globalThis.window || {
  location: { search: "", href: "http://localhost/", pathname: "/" },
  addEventListener() {},
  removeEventListener() {},
  print() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.localStorage = globalThis.localStorage || {
  getItem: () => null,
  setItem() {},
  removeItem() {},
  clear() {},
};

// ---------- import ماژول واقعی ----------
const RENDERER_MODULE =
  "./src/features/customer-info/sections/chart-dashboard/chart-dashboard.renderer.js";
const { chartDashboardRenderer } = await import(RENDERER_MODULE);
const RENDERER_SOURCE = fs.readFileSync(
  new URL(RENDERER_MODULE, import.meta.url),
  "utf8",
);

// ---------- فیکسچرها ----------
const makeUnit = (over = {}) => ({
  _uid: "u1",
  color: "#2c7a6e",
  _chipLabel: null,
  flock: { id: 71, flockNumber: 12 },
  ...over,
});
const makeGroup = (over = {}) => ({
  _groupKey: "g1",
  flockNumber: 12,
  members: [{ _uid: "u1" }, { _uid: "u2" }],
  ...over,
});
const makeOptions = (over = {}) => ({
  includePast: false,
  hasPastFlocks: false,
  hasActiveFlock: true,
  selectedPast: false,
  mainIndicator: "weight",
  viewMode: "flock",
  layoutMode: "stacked",
  hallFlocks: [],
  groupMeta: [],
  compareCount: 0,
  ...over,
});
const HALL_UNITS = [
  makeUnit({ _uid: "u1", color: "#2c7a6e", flock: { id: 71, flockNumber: 12 } }),
  makeUnit({ _uid: "u2", color: "#3b82f6", flock: { id: 71, flockNumber: 12 } }),
  makeUnit({ _uid: "u3", color: "#f59e0b", flock: { id: 72, flockNumber: 13 } }),
];
const HALL_OPTIONS = () =>
  makeOptions({
    viewMode: "hall",
    hallFlocks: HALL_UNITS,
    groupMeta: [
      makeGroup({ _groupKey: "g12", flockNumber: 12, members: [{ _uid: "u1" }, { _uid: "u2" }] }),
      makeGroup({ _groupKey: "g13", flockNumber: 13, members: [{ _uid: "u3" }] }),
    ],
  });
const BASE_UNITS = [
  makeUnit({ _uid: "u1" }),
  makeUnit({ _uid: "u2", color: "#3b82f6", flock: { id: 72, flockNumber: 13 } }),
];

// ---------- رانر: هر کِیس روی کانتینر تازه اجرا می‌شود ----------
const runCase = (testCase) => {
  container = makeEl();
  dom.containerPresent = testCase.containerPresent !== false;
  dom.queryCount = 0;
  dom.lastSelector = null;
  dom.getElementByIdCalls = 0;
  dom.createdElements = [];
  const input = testCase.args();
  let returned;
  let thrown = null;
  try {
    returned = testCase.omitOptions
      ? chartDashboardRenderer.renderContainer(
          input.flocks,
          input.selectedFlockIds,
          input.weekCount,
        )
      : chartDashboardRenderer.renderContainer(
          input.flocks,
          input.selectedFlockIds,
          input.weekCount,
          input.options,
        );
  } catch (error) {
    // نام کلاس خطا (نه متن پیام) تا اسنپ‌شات به نسخهٔ Node وابسته نشود.
    thrown = error?.constructor?.name ?? "Error";
  }
  const html = thrown ? null : container.innerHTML;
  return {
    method: "chartDashboardRenderer.renderContainer",
    containerFound: dom.containerPresent,
    selectorQueries: dom.queryCount,
    lastSelector: dom.lastSelector,
    getElementByIdCalls: dom.getElementByIdCalls,
    createdElements: dom.createdElements.length,
    returnedUndefined: returned === undefined,
    thrown,
    html,
    htmlBytes: html === null ? null : Buffer.byteLength(html, "utf8"),
  };
};

// ---------- کِیس‌ها ----------
const cases = [
  {
    name: "C1.نمای-گله-پایه",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: ["u1"],
      weekCount: 8,
      options: makeOptions(),
    }),
    anchors: [
      '<div class="analysis-module">',
      'id="includePastToggle"',
      'class="analysis-flock-list"',
      'class="analysis-flock-check"',
      'value="u1" checked',
      "toggleFlock('u1', this.checked)",
      'style="background: #2c7a6e"',
      'گله 12',
      'id="analysisWeekRange" class="analysis-week-input" value="8"',
      'data-layout="stacked"',
      'class="analysis-seg-btn active" data-view="flock"',
      'id="mainChart"',
      'id="mainSeriesControls"',
      'id="totalWeightGainChart"',
      'id="totalLiveWeightChart"',
      'id="fcrChart"',
      'id="mortalityPctChart"',
      'id="mortalityCountChart"',
      'id="survivalPctChart"',
      'id="blackoutChart"',
    ],
    extraChecks: [
      ['"returnedUndefined": true', (r) => r.returnedUndefined === true],
      ['"getElementByIdCalls": 0', (r) => r.getElementByIdCalls === 0],
      ['"htmlBytes" > 8000', (r) => r.htmlBytes > 8000],
    ],
  },
  {
    name: "C2.کانتینر-غایب",
    containerPresent: false,
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 8,
      options: makeOptions(),
    }),
    anchors: [
      '"containerFound": false',
      '"selectorQueries": 1',
      '"lastSelector": ".skb-charts-container"',
      '"html": ""',
    ],
  },
  {
    name: "C3.بدون-گله-آرایهٔ-خالی",
    args: () => ({ flocks: [], selectedFlockIds: [], weekCount: 8, options: makeOptions() }),
    anchors: [
      'class="charts-empty-state"',
      'هیچ گله فعالی وجود ندارد',
      'برای مشاهده نمودارها، ابتدا یک گله ثبت کنید',
    ],
    absent: ['analysis-module', 'analysisWeekRange'],
  },
  {
    name: "C4.flocks-null-حالت-خالی",
    args: () => ({ flocks: null, selectedFlockIds: [], weekCount: 8, options: makeOptions() }),
    anchors: ['class="charts-empty-state"'],
    absent: ['analysis-module'],
  },
  {
    name: "C5.نمای-سالن-گروه-چندعضوی",
    args: () => ({
      flocks: HALL_UNITS,
      selectedFlockIds: ["u2"],
      weekCount: 4,
      options: HALL_OPTIONS(),
    }),
    anchors: [
      'class="analysis-group-block"',
      'class="analysis-flock-groups"',
      'analysis-group-count">2 سالن',
      'selectGroupMembers(\'g12\', true)',
      'selectGroupMembers(\'g12\', false)',
      'value="u2" checked',
      'data-view="hall"',
    ],
  },
  {
    name: "C6.نمای-سالن-گروه-تک-عضوی",
    args: () => ({
      flocks: HALL_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({
        viewMode: "hall",
        hallFlocks: HALL_UNITS,
        groupMeta: [makeGroup({ _groupKey: "g13", flockNumber: 13, members: [{ _uid: "u3" }] })],
      }),
    }),
    anchors: ['class="analysis-group-block analysis-group-single"', 'value="u3"'],
    absent: ['selectGroupMembers'],
  },
  {
    name: "C7.نمای-سالن-عضو-گمشده",
    args: () => ({
      flocks: HALL_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({
        viewMode: "hall",
        hallFlocks: HALL_UNITS,
        groupMeta: [
          makeGroup({ _groupKey: "g12", flockNumber: 12, members: [{ _uid: "u1" }, { _uid: "missing" }] }),
        ],
      }),
    }),
    anchors: [
      'value="u1"',
      'analysis-group-count">2 سالن',
    ],
    absent: ['value="missing"'],
  },
  {
    name: "C8.نمای-سالن-بدون-گروه",
    args: () => ({
      flocks: HALL_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ viewMode: "hall", hallFlocks: HALL_UNITS, groupMeta: [] }),
    }),
    anchors: ['class="analysis-flock-groups"></div>', 'data-view="hall"'],
    absent: ['analysis-group-block'],
  },
  {
    name: "C9.viewMode-نامعتبر-بازگشت-به-گله",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ viewMode: "weird" }),
    }),
    anchors: ['class="analysis-seg-btn active" data-view="flock"'],
    absent: ['analysis-flock-groups', 'analysis-group-block'],
  },
  {
    name: "C10.چیدمان-duo",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ layoutMode: "duo" }),
    }),
    anchors: [
      'id="analysisCards" data-layout="duo"',
      'class="analysis-seg-btn active" data-layout="duo"',
    ],
    absent: ['id="analysisCards" data-layout="stacked"'],
  },
  {
    name: "C11.چیدمان-نامعتبر-passthrough",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ layoutMode: "weird" }),
    }),
    anchors: ['id="analysisCards" data-layout="weird"'],
    absent: ['id="analysisCards" data-layout="stacked"'],
  },
  {
    name: "C12.شاخص-main-gain",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ mainIndicator: "gain" }),
    }),
    anchors: ['class="analysis-tab active" data-ind="gain"'],
    absent: ['analysis-tab active" data-ind="weight"'],
  },
  {
    name: "C13.شاخص-main-dailyGain",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ mainIndicator: "dailyGain" }),
    }),
    anchors: ['class="analysis-tab active" data-ind="dailyGain"'],
  },
  {
    name: "C14.شاخص-main-نامعتبر",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ mainIndicator: "weird" }),
    }),
    anchors: ['id="mainIndicatorTabs"'],
    absent: ['analysis-tab active" data-ind='],
  },
  {
    name: "C15.گله‌های-گذشته-یادداشت-انتخاب",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ includePast: true, hasPastFlocks: true }),
    }),
    anchors: [
      'id="includePastToggle" checked',
      'گله‌های گذشته به لیست اضافه شدند؛ یکی را انتخاب کنید',
    ],
    absent: ['analysis-history-note">مشتری گلهٔ فعال ندارد'],
  },
  {
    name: "C16.گله‌های-گذشته-بدون-گلهٔ-فعال",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ includePast: true, hasPastFlocks: true, hasActiveFlock: false }),
    }),
    anchors: ['مشتری گلهٔ فعال ندارد — دادهٔ گله‌های گذشته نمایش داده می‌شود'],
    absent: ['گله‌های گذشته به لیست اضافه شدند'],
  },
  {
    name: "C17.بنر-گله‌های-گذشته",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 4,
      options: makeOptions({ selectedPast: true }),
    }),
    anchors: [
      'class="analysis-past-banner"',
      'این نمودار اطلاعات گله‌های گذشته / پایان‌یافته را نشان می‌دهد',
    ],
  },
  {
    name: "C18.شمار-هفته-۱۶",
    args: () => ({ flocks: BASE_UNITS, selectedFlockIds: [], weekCount: 16, options: makeOptions() }),
    anchors: ['id="analysisWeekRange" class="analysis-week-input" value="16"'],
  },
  {
    name: "C19.شمار-هفته-undefined-مرزی",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: undefined,
      options: makeOptions(),
    }),
    anchors: ['value="undefined"', '"thrown": null'],
  },
  {
    name: "C20.بدون-انتخاب",
    args: () => ({
      flocks: BASE_UNITS,
      selectedFlockIds: [],
      weekCount: 8,
      options: makeOptions(),
    }),
    anchors: ['value="u1"', 'value="u2"'],
    absent: ['value="u1" checked', 'value="u2" checked'],
  },
  {
    // ⚠️ نکتهٔ رفتاری کشف‌شده توسط گارد: مقدار چک‌باکس از `_uid || flock.id` می‌آید ولی
    // وضعیت checked از `_uid` خوانده می‌شود، پس واحدِ بدون `_uid` حتی با انتخابِ id او تیک نمی‌خورد.
    name: "C21.شناسه-عددی-و-تکراری-و-uid-غایب",
    args: () => ({
      flocks: [
        makeUnit({ _uid: undefined, color: "#2c7a6e", flock: { id: 71, flockNumber: 12 } }),
        makeUnit({ _uid: "u2", color: "#3b82f6", flock: { id: 72, flockNumber: 13 } }),
      ],
      selectedFlockIds: [71, 71, "nope"],
      weekCount: 8,
      options: makeOptions(),
    }),
    anchors: ['value="71"', "toggleFlock('71', this.checked)"],
    absent: ['value="71" checked', 'value="u2" checked'],
  },
  {
    // همان تناقض از سوی دیگر: انتخابِ مقدار undefined ⇒ String(undefined) === "undefined"
    name: "C25.شناسه-undefined-تیک-واحد-بدون-uid",
    args: () => ({
      flocks: [
        makeUnit({ _uid: undefined, color: "#2c7a6e", flock: { id: 71, flockNumber: 12 } }),
      ],
      selectedFlockIds: [undefined, "u2"],
      weekCount: 8,
      options: makeOptions(),
    }),
    anchors: ['value="71" checked'],
  },
  {
    name: "C22.برچسب-سفارشی-چیپ",
    args: () => ({
      flocks: [
        makeUnit({ _uid: "u1", color: "#2c7a6e", _chipLabel: "سالن ۹ (گله ۱۲)" }),
      ],
      selectedFlockIds: [],
      weekCount: 8,
      options: makeOptions(),
    }),
    anchors: ['سالن ۹ (گله ۱۲)'],
    absent: ['گله 12'],
  },
  {
    name: "C23.options-حذف‌شده-پیش‌فرض",
    omitOptions: true,
    args: () => ({ flocks: BASE_UNITS, selectedFlockIds: [], weekCount: 8 }),
    anchors: [
      'data-layout="stacked"',
      'id="includePastToggle"',
      '"thrown": null',
    ],
    absent: ['analysis-history-note', 'analysis-past-banner'],
  },
  {
    name: "C24.selectedFlockIds-غایب-خطای-مرزی",
    args: () => ({ flocks: BASE_UNITS, selectedFlockIds: undefined, weekCount: 8, options: makeOptions() }),
    anchors: ['"thrown": "TypeError"', '"html": null'],
  },
];

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const GOLDEN_URL = new URL("../docs/chart-dashboard-body-golden.json", import.meta.url);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
// رکورد با تورفتگی می‌شود تا انکرها خوانا باشند؛ برای انکرهای درون‌HTML
// (که در JSON با \" فرار می‌کنند) نسخهٔ «رمزگشایی‌شده» هم در نظر گرفته می‌شود.
const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

check(
  "متد هدف chartDashboardRenderer.renderContainer موجود است",
  typeof chartDashboardRenderer?.renderContainer === "function",
);
check(
  "سطح عمومی رندرر همان ۴ متد مورد انتظار است",
  ["renderContainer", "renderSeriesControls", "renderSimpleCard", "renderMiniTabsCard"].every(
    (name) => typeof chartDashboardRenderer[name] === "function",
  ),
);

// قابلیت حمل: متد به ساعت/منطقهٔ زمانی وابسته نباشد (ادعای سرصفحهٔ گارد)
const methodStart = RENDERER_SOURCE.indexOf("renderContainer(flocks");
const methodEnd = RENDERER_SOURCE.indexOf("\n  },", methodStart);
const methodSource = RENDERER_SOURCE.slice(methodStart, methodEnd);
check(
  "متد هیچ استفاده‌ای از Date/Intl ندارد (اسنپ‌شات بدون ساعت قابل‌حمل است)",
  !/\bnew Date\(/.test(methodSource) && !/\bIntl\./.test(methodSource),
);
const innerHtmlWrites = (methodSource.match(/container\.innerHTML =/g) || []).length;
check(
  "متد هدف فقط دو بار در کانتینر می‌نویسد (بدون return مقدار)",
  innerHtmlWrites === 2,
  `innerHTMLWrites=${innerHtmlWrites} methodChars=${methodSource.length}`,
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
    returnedUndefined: record.returnedUndefined,
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
    check(`${testCase.name} → ${label}`, Boolean(predicate(record)));
  }
}

check(
  "هیچ کِیسِ بدون خطا مقدار بازگشتی ندارد (رفتار متد: فقط نوشتن در DOM)",
  caseRecords.every((r) => r.thrown !== null || r.returnedUndefined === true),
  caseRecords
    .filter((r) => r.thrown === null && r.returnedUndefined !== true)
    .map((r) => r.name)
    .join(","),
);

// ===== پایداری: دو اجرای متوالی یک کِیس باید رکورد یکسان بدهد =====
const firstCase = cases[0];
const firstAgain = recordText(runCase(firstCase));
check(
  "دو اجرای متوالی کِیس اول رکورد یکسان می‌دهند",
  sha256(firstAgain) === captured[firstCase.name].sha256,
);

// ===== اسنپ‌شات طلایی: برابری بایت‌به‌بایت =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${JSON.stringify(
      {
        note: "اسنپ‌شات رکورد ساختاری متد غول نمودارهای تحلیلی (chartDashboardRenderer.renderContainer)، گرفته‌شده پیش از موج برش بدنه (۳.۲k). هر کِیس = رکورد JSON شامل HTML نوشته‌شده در کانتینر جعلی ({ html, thrown, containerFound, selectorQueries, returnedUndefined, … }). بازتولید: npm run test:chart-dashboard:body -- --snapshot",
        node: process.version,
        note2:
          "این اسنپ‌شات به ساعت/locale/ICU وابسته نیست (متد هیچ Date/Intl ندارد و این ادعا در تست بررسی می‌شود)؛ تنها به بایت‌های قالب داخل backtick و سبک پایان خط فایل هدف وابسته است.",
        source: "HEAD پیش از برش بدنه — git tag pre-charts-body-split",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/chart-dashboard-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check("اسنپ‌شات طلایی docs/chart-dashboard-body-golden.json موجود است", false, "با --snapshot بساز");
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
  console.log(`\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ نمودارهای تحلیلی`);
  process.exitCode = 1;
} else {
  console.log(`\n✅ هر ${results.length} بررسی موفق — خروجی متد بایت‌به‌بایت پایدار است`);
}
