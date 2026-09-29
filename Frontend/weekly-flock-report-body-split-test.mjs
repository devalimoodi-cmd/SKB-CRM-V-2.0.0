// ============================================================
//  تست برابری بدنهٔ متد غول گزارش اختصاصی گله — گارد موج برش بدنه (۳.۲l)
//  اجرا:  npm run test:weekly:flock-report:body                  (در پوشهٔ Frontend)
//         npm run test:weekly:flock-report:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ متد بزرگ زیر برش بدنه می‌خورد (کد از داخل متد به تابع‌های
//  ماژول‌محلی منتقل می‌شود) بدون تغییر یک بایت از خروجی:
//    weekly.renderer.js:889  weeklyRenderer.renderFlockReport   ۲۴۲ خط
//  (پس از موج ۳.۲l این متد ۹۹ خط است؛ عدد بالای این بلوک وضعیت «پیش از برش» را ثبت می‌کند.)
//  ⚠️ درس موج ۳.۲l: در برش اول، `isPartialWeek` را هم به کمکی بردم ولی قالب بلوک‌های
//     هفتگی هنوز سه بار مصرفش می‌کرد ⇒ ۷۸ بررسی قرمز شد. پس این کلوژر باید در متد بماند.
//  (پیش از موج ۳.۲l؛ در موج ۳.۲e متد `renderFullReport` همین فایل برش خورد و گارد
//  `test:weekly:body` را گرفت، ولی `renderFlockReport` بی‌گارد مانده بود.)
//  متد سه closure تودرتو دارد (`isPartialWeek` · `detailPairs` · `renderWeekDetailsTable`)
//  و دو سازندهٔ بلوک هفتگی + یک قالب ~۸۳ خطی؛ ترتیب/شاخه‌هایشان حساس است.
//  روش سنجش دو لایه است (هم‌سبک گاردهای هفتگی/سالن/پایان دوره/بوکمارک/نمودار):
//    ۱) «انکر»های رفتاری: زیررشته‌های کلیدی سند HTML زنده (PASS/FAIL).
//    ۲) «اسنپ‌شات طلایی»: sha256 رکورد JSON هر کِیس در
//       docs/weekly-flock-report-body-golden.json (پیش از برش) ⇒ هر بایت تغییر، FAIL.
//  ⚠️ ساعت سیستم تثبیت شده است (`now`/`nowTime` از `new Date()` می‌آیند) و TZ روی
//     Asia/Tehran قفل است؛ خروجی به Intl/locale هم وابسته است (تاریخ و ارقام فارسی).
//  ⚠️ `flock.audit` عمداً تزریق می‌شود تا شاخه‌های ناقص/بدون‌ثبت قطعی و قابل‌تکرار باشند.
//  ⚠️ اگر عمداً رفتار تغییر کرد، اول:
//     npm run test:weekly:flock-report:body -- --snapshot
// ============================================================
import crypto from "node:crypto";
import fs from "node:fs";

// ---------- تثبیت منطقهٔ زمانی + ساعت ----------
process.env.TZ = process.env.TZ || "Asia/Tehran";
const FROZEN_MS = Date.UTC(2026, 5, 15, 6, 30, 0); // 2026-06-15 06:30 UTC
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [FROZEN_MS]));
  }

  static now() {
    return FROZEN_MS;
  }
}
globalThis.Date = FrozenDate;

// ---------- استاب‌های مرورگر (قبل از import ماژول) ----------
const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};
globalThis.window = globalThis.window || {
  location: { search: "", href: "http://localhost/", pathname: "/" },
  addEventListener() {},
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  open: () => null,
};
globalThis.document = globalThis.document || {
  getElementById: () => null,
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

// ---------- ضبط console ----------
const consoleErrors = [];
const consoleWarns = [];
const consoleError = console.error;
const consoleWarn = console.warn;
console.error = (...args) => consoleErrors.push(args.map(String).join(" "));
console.warn = (...args) => consoleWarns.push(args.map(String).join(" "));

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);
const clone = (value) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));

// ---------- import ماژول واقعی ----------
const DOMAIN = "./src/features/customer-info/sections/weekly/";
const { weeklyRenderer } = await import(`${DOMAIN}weekly.renderer.js`);
const { WEEK_STATUS } = await import(`${DOMAIN}weekly.audit.js`);
const { WEEK_PRESET } = await import(`${DOMAIN}weekly.report.weeks.js`);

// ---------- فیکسچرها ----------
const makeWeek = (over = {}) => ({
  week_number: 1,
  week_start_date: "2026-05-01",
  week_end_date: "2026-05-07",
  flock_age_days: 7,
  weekly_mortality: 12,
  weekly_weight: 0.18,
  daily_feed_intake: 22,
  weekly_feed_intake: 154,
  blackout_hours: 2,
  diseases: [],
  vaccines: ["نیوکاسل"],
  medicines: [],
  feedTypes: ["آغازگر"],
  suggestions: ["تهویه"],
  additional_notes: "یادداشت نمونه",
  metrics: {
    weight: 0.18,
    weightGain: 0.05,
    standard: 0.2,
    weightStatus: "below",
    weightDeviation: -0.02,
    standardGain: 0.06,
    gainDeviation: -10,
    fcr: 1.12,
    standardFcr: 1.05,
    fcrDeviation: 6,
    dailyGainGrams: 25,
    standardDailyGainGrams: 27,
    population: 9800,
  },
  ...over,
});
const makeFlock = (over = {}) => ({
  id: 71,
  flock_number: 12,
  hall_name: "سالن ۳",
  breed_name: "راس ۳۰۸",
  placement_date: "2026-05-01",
  total_chicks_count: 10000,
  is_active: true,
  timeline: { basis: "placement" },
  statistics: {
    totalMortality: 350,
    finalMetrics: {
      birdsEndOfWeek: 9650,
      cumulativeSurvivalPercent: 96.5,
      totalLiveWeight: 22560.5,
      fcr: 1.72,
      cumulativeFeed: 38800,
      totalMortalityPercent: 3.5,
    },
  },
  savedWeeks: [makeWeek({ week_number: 1 }), makeWeek({ week_number: 2 })],
  weeks: [makeWeek({ week_number: 1 }), makeWeek({ week_number: 2 })],
  ...over,
});
const makeCustomer = (over = {}) => ({
  id: 5,
  full_name: "مشتری نمونه",
  farm_name: "فارم نمونه",
  mobile_number: "09120000000",
  ...over,
});
const makeOptions = (over = {}) => ({ ...over });
const FULL_USER = {
  fullName: "مدیر نمونه",
  first_name: "مدیر",
  last_name: "نمونه",
  username: "manager",
  role: "admin",
};
const setUser = (user) => {
  if (user === null || user === undefined) {
    storage.delete("user");
    return;
  }
  storage.set("user", JSON.stringify(user));
};

// ---------- رانر ----------
const runCase = (testCase) => {
  consoleErrors.length = 0;
  consoleWarns.length = 0;
  testCase.setup?.();
  const input = testCase.args();
  let html = null;
  let thrown = null;
  try {
    html =
      testCase.omitOptions === true
        ? weeklyRenderer.renderFlockReport(input.customer, input.flock, input.periods)
        : weeklyRenderer.renderFlockReport(
            input.customer,
            input.flock,
            input.periods,
            input.options,
          );
  } catch (error) {
    // نام کلاس خطا (نه متن پیام) تا اسنپ‌شات به نسخهٔ Node وابسته نشود.
    thrown = error?.constructor?.name ?? "Error";
  }
  return {
    method: "weeklyRenderer.renderFlockReport",
    thrown,
    html,
    htmlBytes: html === null ? null : Buffer.byteLength(html, "utf8"),
    consoleErrors: clone(consoleErrors),
    consoleWarns: clone(consoleWarns),
  };
};

// ---------- کِیس‌ها ----------
const cases = [
  {
    name: "F1.گزارش-پایه-دو-هفته",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      periods: [],
      options: makeOptions(),
    }),
    anchors: [
      "<title>گزارش اختصاصی سالن 12</title>",
      "<div class=\"report-header\">",
      "🐔 گزارش اختصاصی سالن 12",
      "📅 تاریخ تهیه: ",
      "جوجه‌ریزی اولیه",
      "🐔 گله 12",
      "📊 2 هفته ثبت‌شده",
      'status-badge status-active">فعال</span>',
      'class="week-report-block"',
      'class="report-groups-note">🧾 شاخص‌های این گزارش: <strong>',
      "📌 دریافت گزارش توسط: <strong>مدیر نمونه</strong> (مدیر)",
      'class="customer-item"',
      '"thrown": null',
    ],
  },
  {
    name: "F2.بدون-savedWeeks-و-بدون-بلوک",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ savedWeeks: [] }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: ["هیچ هفته‌ای برای این گله ثبت نشده است"],
    absent: ['class="week-report-block'],
  },
  {
    name: "F3.گلهٔ-بدون-هیچ-هفته",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ savedWeeks: [], weeks: [], timeline: null }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: ["هیچ هفته‌ای برای این گله ثبت نشده است"],
    absent: ['class="week-report-block', 'class="basis-chip"'],
  },
  {
    name: "F4.انتخاب-خالی-MANUAL",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      periods: [],
      options: makeOptions({ weekSelection: { shared: { preset: WEEK_PRESET.MANUAL } } }),
    }),
    anchors: [
      "هیچ هفته‌ای برای این گزارش انتخاب نشده است",
      'class="week-range-chip"',
    ],
    absent: ['class="week-report-block'],
  },
  {
    name: "F5.انتخاب-فقط-هفتهٔ-۲",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      periods: [],
      options: makeOptions({ weekSelection: { shared: [2] } }),
    }),
    anchors: ["هفته 2", "📊 2 هفته ثبت‌شده", 'class="week-range-chip"'],
    absent: ["هفته 1"],
  },
  {
    name: "F6.هفتهٔ-بدون-ثبت-بلوک-هشدار",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({
        savedWeeks: [makeWeek({ week_number: 1 })],
        weeks: [makeWeek({ week_number: 1 }), makeWeek({ week_number: 2, __missing: true })],
      }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: [
      "week-report-block week-missing",
      "هفته 2 ❌",
      "اطلاعات این هفته ثبت نشده است",
    ],
  },
  {
    name: "F7.هفتهٔ-ناقص-PARTIAL",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ audit: { statuses: { 1: WEEK_STATUS.PARTIAL } } }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: [
      "week-report-block week-partial",
      "هفته 1 ⚠️",
      "⚠️ وزن یا خوراک این هفته ثبت نشده است",
    ],
  },
  {
    name: "F8.گروهٔ-جمعیت-فقط",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      periods: [],
      options: makeOptions({ selectedGroups: ["population"] }),
    }),
    anchors: ["<th>تلفات</th>"],
    absent: ["<th>خوراک هفتگی</th>", "<th>خاموشی</th>"],
  },
  {
    name: "F9.گروهٔ-خوراک-فقط",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      periods: [],
      options: makeOptions({ selectedGroups: ["feed"] }),
    }),
    anchors: ["<th>خوراک روزانه</th>", "<th>خوراک هفتگی</th>"],
    absent: ["<th>تلفات</th>"],
  },
  {
    name: "F10.گروهٔ-جزئیات-فقط",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      periods: [],
      options: makeOptions({ selectedGroups: ["details"] }),
    }),
    anchors: [
      "<th>خاموشی</th>",
      "<th>بیماری‌ها</th>",
      "<th>واکسن‌ها</th>",
      "<th>داروها</th>",
      "<th>نوع خوراک</th>",
      "<th>پیشنهادات</th>",
      "<th>توضیحات</th>",
      "نیوکاسل",
    ],
  },
  {
    // رفتار واقعی: آرایهٔ خالی گروه‌ها مثل «همهٔ گروه‌ها» عمل می‌کند (توسط گارد قفل شد).
    name: "F11.گروه‌های-آرایهٔ-خالی-رفتار-واقعی",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      periods: [],
      options: makeOptions({ selectedGroups: [] }),
    }),
    anchors: ['class="report-groups-note"', 'class="detail-list"'],
  },
  {
    name: "F12.همهٔ-گروه‌ها-صریح",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock(),
      periods: [],
      options: makeOptions({ selectedGroups: ["population", "weight", "feed", "details"] }),
    }),
    anchors: [
      "<th>تلفات</th>",
      "<th>وزن</th>",
      "<th>خوراک روزانه</th>",
      "<th>توضیحات</th>",
    ],
  },
  {
    name: "F13.options-حذف‌شده",
    omitOptions: true,
    setup: () => setUser(FULL_USER),
    args: () => ({ customer: makeCustomer(), flock: makeFlock(), periods: [] }),
    anchors: ['class="report-header"', "week-report-block"],
    absent: ['class="week-range-chip"', 'class="gap-outside-note"'],
  },
  {
    name: "F14.کاربر-نام-و-فامیل-نقش-میانی",
    setup: () => setUser({ first_name: "مریم", last_name: "رضایی", role: "sub_admin" }),
    args: () => ({ customer: makeCustomer(), flock: makeFlock(), periods: [], options: makeOptions() }),
    anchors: ["<strong>مریم رضایی</strong> (مدیر میانی)"],
  },
  {
    name: "F15.کاربر-یوزرنیم-نقش-ناشناس",
    setup: () => setUser({ username: "u9", role: "ghost" }),
    args: () => ({ customer: makeCustomer(), flock: makeFlock(), periods: [], options: makeOptions() }),
    anchors: ["<strong>u9</strong> (کاربر)"],
  },
  {
    name: "F16.بدون-کاربر",
    setup: () => setUser(null),
    args: () => ({ customer: makeCustomer(), flock: makeFlock(), periods: [], options: makeOptions() }),
    anchors: ["<strong>کاربر ناشناس</strong> (کاربر)"],
  },
  {
    name: "F17.statistics-غایب-شاخص‌ها-خط‌تیره",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ statistics: {} }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: [
      'stat-number">—</div>',
      "تلفات کل:</strong> undefined قطعه",
    ],
  },
  {
    name: "F18.بدون-timeline",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ timeline: null }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: ["🐔 گله 12"],
    absent: ['class="basis-chip"'],
  },
  {
    name: "F19.بدون-تاریخ-جوجه‌ریزی",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ placement_date: null }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: ["جوجه‌ریزی: -", "سن: 0 روز"],
  },
  {
    name: "F20.تاریخ-هفتهٔ-نامعتبر-شاخهٔ-catch",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({
        savedWeeks: [makeWeek({ week_number: 1, week_start_date: "نامعتبر", week_end_date: null })],
      }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: ["📅 - تا -", 'class="week-report-block"'],
  },
  {
    name: "F21.گلهٔ-غیرفعال",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ is_active: false }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: ['status-badge status-inactive">غیرفعال</span>'],
  },
  {
    name: "F22.بدون-نژاد-برچسب-خط-تیره",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({ breed_name: null }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: ["سالن ۳ | -"],
  },
  {
    name: "F23.مشتری-null-خطای-مرزی",
    setup: () => setUser(FULL_USER),
    args: () => ({ customer: null, flock: makeFlock(), periods: [], options: makeOptions() }),
    anchors: ['"thrown": "TypeError"', '"html": null'],
  },
  {
    name: "F24.شمارهٔ-هفته-رشته‌ای",
    setup: () => setUser(FULL_USER),
    args: () => ({
      customer: makeCustomer(),
      flock: makeFlock({
        savedWeeks: [makeWeek({ week_number: "3" })],
        weeks: [makeWeek({ week_number: "3" })],
      }),
      periods: [],
      options: makeOptions(),
    }),
    anchors: ["هفته 3", "📊 1 هفته ثبت‌شده"],
  },
];

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const GOLDEN_URL = new URL("../docs/weekly-flock-report-body-golden.json", import.meta.url);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
const recordText = (record) => JSON.stringify(record, null, 2);
const anchorView = (text) =>
  text + "\n" + text.replace(/\\"/g, '"').replace(/\\n/g, "\n");

check(
  "متد هدف weeklyRenderer.renderFlockReport موجود است",
  typeof weeklyRenderer?.renderFlockReport === "function",
);
check(
  "WEEK_STATUS.PARTIAL برای کِیس ناقص در دسترس است",
  typeof WEEK_STATUS?.PARTIAL === "string",
  String(WEEK_STATUS?.PARTIAL),
);
check(
  "WEEK_PRESET.MANUAL برای کِیس انتخاب خالی در دسترس است",
  WEEK_PRESET?.MANUAL === "manual",
  String(WEEK_PRESET?.MANUAL),
);

// ⚠️ هشدار آسنکرون Node بیرون از ضبط بماند (تلهٔ موج ۳.۲i).
await new Promise((resolve) => setImmediate(resolve));

const captured = {};
const caseRecords = [];
for (const testCase of cases) {
  const record = runCase(testCase);
  caseRecords.push({ name: testCase.name, thrown: record.thrown, bytes: record.htmlBytes });
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
}

check(
  "فقط کِیس مرزی مشتری-null پرتاب خطا می‌کند (بقیه سند می‌سازند)",
  caseRecords.filter((r) => r.thrown !== null).length === 1 &&
    caseRecords.find((r) => r.thrown !== null)?.name.startsWith("F23."),
  caseRecords
    .filter((r) => r.thrown !== null)
    .map((r) => r.name)
    .join(","),
);

// ===== پایداری: دو اجرای متوالی کِیس اول =====
const firstCase = cases[0];
const firstAgain = recordText(runCase(firstCase));
check(
  "دو اجرای متوالی کِیس اول رکورد یکسان می‌دهند (تثبیت ساعت)",
  sha256(firstAgain) === captured[firstCase.name].sha256,
);

// ===== اسنپ‌شات طلایی =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${JSON.stringify(
      {
        note: "اسنپ‌شات رکورد ساختاری متد غول گزارش اختصاصی گله (weeklyRenderer.renderFlockReport)، گرفته‌شده پیش از موج برش بدنه (۳.۲l). هر کِیس = رکورد JSON شامل سند HTML کامل ({ html, thrown, htmlBytes, consoleErrors, consoleWarns }). بازتولید: npm run test:weekly:flock-report:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        frozenClockUtc: new Date(FROZEN_MS).toISOString(),
        source: "HEAD پیش از برش بدنه — git tag pre-flock-report-body-split",
        note2:
          "خروجی به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (تاریخ و ساعت شمسی + ارقام فارسی در تمام سند)؛ هارنس ساعت را تثبیت و TZ را روی Asia/Tehran قفل می‌کند، پس مقایسه فقط در همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/weekly-flock-report-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check("اسنپ‌شات طلایی docs/weekly-flock-report-body-golden.json موجود است", false, "با --snapshot بساز");
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

console.error = consoleError;
console.warn = consoleWarn;
const failed = results.filter((ok) => !ok).length;
if (failed) {
  console.log(`\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ گزارش اختصاصی گله`);
  process.exitCode = 1;
} else {
  console.log(`\n✅ هر ${results.length} بررسی موفق — خروجی متد بایت‌به‌بایت پایدار است`);
}
