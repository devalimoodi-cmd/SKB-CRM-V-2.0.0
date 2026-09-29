// ============================================================
//  تست برابری بدنهٔ متد غول هفتگی — گارد موج برش بدنه (۳.۲e)
//  اجرا:  npm run test:weekly:body                  (در پوشهٔ Frontend)
//         npm run test:weekly:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ `weeklyRenderer.renderFullReport` (`weekly.renderer.js:746` · ۵۲۴ خط)
//  بزرگ‌ترین متد مخزن است و «برش بدنه» می‌خورد (کد از داخل متد به تابع‌های
//  ماژول‌محلی منتقل می‌شود) بدون تغییر فایل، سطح عمومی، یا رفتار.
//  این متد چهار closure تودرتو دارد (`toPersian` · `renderMetricsTable` ·
//  `pushHallSection` · `renderGroupSection`) که متغیرهای اسیرشده دارند؛
//  جابه‌جایی اشتباه می‌تواند بی‌صدا یک شاخه یا ترتیب را عوض کند.
//  روش سنجش دو لایه است (هم‌سبک گارد سالن‌ها در موج ۳.۲d):
//    ۱) «انکر»های رفتاری: زیررشته‌های کلیدی خروجی زنده (PASS/FAIL).
//    ۲) «اسنپ‌شات طلایی»: sha256 خروجی هر کِیس در docs/weekly-body-golden.json
//       که **پیش از برش** از همین منبع گرفته شده است ⇒ هر بایت تغییر، FAIL.
//  ⚠️ ساعت سیستم در این هارنس «تثبیت» شده است (در متد، `now`/`nowTime` از
//     `new Date()` می‌آیند)؛ بدون آن هیچ اسنپ‌شاتی پایدار نیست.
//  ⚠️ اگر عمداً رفتار خروجی تغییر کرد، اول:
//     npm run test:weekly:body -- --snapshot
// ============================================================
import fs from "node:fs";
import crypto from "node:crypto";

// ---------- تثبیت منطقهٔ زمانی (رشتهٔ تاریخ/ساعت داخل متد) ----------
process.env.TZ = process.env.TZ || "Asia/Tehran";

// ---------- تثبیت ساعت سیستم ----------
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

const GOLDEN_URL = new URL("../docs/weekly-body-golden.json", import.meta.url);
const SNAPSHOT = process.argv.includes("--snapshot");
const DOMAIN = "./src/features/customer-info/sections/weekly/";

// ---------- استاب‌های حداقلی مرورگر (قبل از import ماژول‌ها) ----------
globalThis.window = globalThis.window || {
  location: { search: "", href: "http://localhost/", pathname: "/" },
  addEventListener: () => {},
  removeEventListener: () => {},
  matchMedia: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }),
  open: () => null,
};
globalThis.document = globalThis.document || {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
};
const storage = new Map();
const DEFAULT_USER = JSON.stringify({
  username: "tester",
  role: "admin",
  first_name: "تست",
});
let userRaw = DEFAULT_USER;
globalThis.localStorage = {
  getItem: (key) =>
    key === "user" ? userRaw : storage.has(key) ? storage.get(key) : null,
  setItem: (key, value) => {
    if (key === "user") userRaw = String(value);
    else storage.set(key, String(value));
  },
  removeItem: (key) => {
    if (key === "user") userRaw = null;
    else storage.delete(key);
  },
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);

// ---------- import ماژول‌های واقعی ----------
const { weeklyRenderer } = await import(`${DOMAIN}weekly.renderer.js`);
const { groupFlocksByFlock } = await import(`${DOMAIN}weekly.aggregation.js`);
const { calculateWeekMetrics } = await import(`${DOMAIN}weekly.calculations.js`);

// ---------- ابزار ساخت سالن/گله (هم‌سان با weekly-report-render-smoke.mjs) ----------
const buildHall = ({ hallName, chicks, records }) => {
  const hallFlock = {
    total_chicks_count: chicks,
    avg_initial_weight: 42,
    standards: [],
  };
  const allWeeks = records.map((r) => ({ ...r, existsInDb: true }));
  const savedWeeks = records.map((r) => ({
    ...r,
    existsInDb: true,
    metrics: calculateWeekMetrics({
      flock: hallFlock,
      weeks: allWeeks,
      weekNumber: r.week_number,
      formValues: {},
    }),
  }));
  const totalMortality = savedWeeks.reduce(
    (s, w) => s + (parseFloat(w.weekly_mortality) || 0),
    0,
  );
  return {
    id: `${hallName}-p`,
    flock_id: 7,
    flock_number: 12,
    hall_id: hallName,
    hall_name: hallName,
    total_chicks_count: chicks,
    avg_initial_weight: 42,
    breed_name: "راس 308",
    placement_date: "2026-01-01",
    is_active: true,
    standards: [],
    weeks: savedWeeks,
    savedWeeks,
    statistics: {
      totalMortality,
      totalFeed: savedWeeks
        .reduce((s, w) => s + (parseFloat(w.weekly_feed_intake) || 0), 0)
        .toFixed(1),
      weekCount: savedWeeks.length,
      lastWeight: 0,
      fcr: savedWeeks[savedWeeks.length - 1]?.metrics?.fcr ?? null,
      finalMetrics: savedWeeks[savedWeeks.length - 1]?.metrics ?? null,
    },
  };
};

const hallA = buildHall({
  hallName: "سالن A",
  chicks: 1000,
  records: [
    {
      week_number: 1,
      weekly_weight: 0.19,
      weekly_feed_intake: 190,
      weekly_mortality: 10,
      flock_age_days: 7,
      week_start_date: "2026-01-01",
      week_end_date: "2026-01-07",
    },
    {
      week_number: 2,
      weekly_weight: 0.45,
      weekly_feed_intake: 420,
      weekly_mortality: 5,
      flock_age_days: 14,
      week_start_date: "2026-01-08",
      week_end_date: "2026-01-14",
    },
  ],
});
const hallB = buildHall({
  hallName: "سالن B",
  chicks: 500,
  records: [
    {
      week_number: 1,
      weekly_weight: 0.21,
      weekly_feed_intake: 95,
      weekly_mortality: 2,
      flock_age_days: 7,
      week_start_date: "2026-01-01",
      week_end_date: "2026-01-07",
    },
  ],
});

// سالنی با هفتهٔ ثبت‌نشده (۲) و هفتهٔ ناقص (۳ = بدون خوراک)
const hallC = buildHall({
  hallName: "سالن C",
  chicks: 800,
  records: [
    {
      week_number: 1,
      weekly_weight: 0.19,
      weekly_feed_intake: 180,
      weekly_mortality: 4,
      flock_age_days: 7,
      week_start_date: "2026-01-01",
      week_end_date: "2026-01-07",
    },
    {
      week_number: 3,
      weekly_weight: 0.85,
      weekly_feed_intake: 380,
      weekly_mortality: 3,
      flock_age_days: 21,
      week_start_date: "2026-01-15",
      week_end_date: "2026-01-21",
    },
  ],
});
// هفتهٔ بدون رکورد (همان ساختاری که weekly.service → calculateWeeks می‌سازد)
const missingWeek = {
  week_number: 2,
  existsInDb: false,
  flock_age_days: 14,
  week_start_date: "2026-01-08",
  week_end_date: "2026-01-14",
  weekly_weight: null,
  weekly_feed_intake: null,
  weekly_mortality: 0,
};
hallC.weeks = [hallC.savedWeeks[0], missingWeek, hallC.savedWeeks[1]];
hallC.weeks[2] = {
  ...hallC.weeks[2],
  weekly_feed_intake: null,
  daily_feed_intake: null,
};

const weekKeyC = `p${hallC.id}`;

// ---------- کِیس‌ها: هر کِیس = خروجی کامل renderFullReport در یک سناریو ----------
const CUSTOMER = { full_name: "مشتری تست" };
const ALL_GROUPS = ["population", "weight", "growth", "feed", "details"];
const cases = [
  {
    // W1 — گزارش کامل دو سالن + جدول تجمعی «کل گله»
    name: "W1.renderFullReport-گزارش-کامل-دو-سالن",
    anchors: [
      "<!DOCTYPE html>",
      "</html>",
      "شاخص‌های عملکردی هفتگی — کل گله",
      "گله 12 — کل 2 سالن",
      "سالن A | راس 308",
      "سالن A، سالن B",
      '<table class="week-table metrics-table">',
      "جزئیات ثبت هفتگی",
    ],
    run: () =>
      weeklyRenderer.renderFullReport(
        CUSTOMER,
        [hallA, hallB],
        [],
        groupFlocksByFlock([hallA, hallB]),
      ),
  },
  {
    // W2 — سازگاری عقب‌رو: بدون آرگومان گروه
    name: "W2.renderFullReport-بدون-گروه",
    anchors: ['<!DOCTYPE html>', '<table class="week-table metrics-table">'],
    run: () => weeklyRenderer.renderFullReport(CUSTOMER, [hallA, hallB], []),
  },
  {
    // W3 — هفتهٔ ثبت‌نشده + هفتهٔ ناقص: همهٔ هشدارها فعال
    name: "W3.renderFullReport-گپ-و-هفتهٔ-ناقص",
    anchors: [
      'class="report-alert"',
      "هفته بدون ثبت اطلاعات",
      "هفته ناقص",
      "بدون خوراک",
      'class="week-missing"',
      "❌ ثبت نشده",
      "week-partial",
      "gap-badge",
      "warn-stat",
    ],
    run: () => weeklyRenderer.renderFullReport(CUSTOMER, [hallC], []),
  },
  {
    // W4 — فیلتر گروه‌ها: فقط «وزن»
    name: "W4.renderFullReport-فقط-وزن",
    anchors: ["افزایش وزن (kg)", "report-groups-note", "⚖️ وزن"],
    absent: [
      "دان کل (kg)",
      "جمعیت ابتدای هفته",
      "FCR",
      "جزئیات ثبت هفتگی",
      "🛒 خوراک و ضریب تبدیل",
    ],
    run: () =>
      weeklyRenderer.renderFullReport(CUSTOMER, [hallC], [], [], {
        selectedGroups: ["weight"],
      }),
  },
  {
    // W5 — همهٔ گروه‌ها به‌صورت صریح (بدون رگرسیون ستون‌ها)
    name: "W5.renderFullReport-همهٔ-گروه‌ها-صریح",
    anchors: [
      "دان کل (kg)",
      "جمعیت ابتدای هفته",
      "جزئیات ثبت هفتگی",
      "همهٔ شاخص‌ها",
    ],
    run: () =>
      weeklyRenderer.renderFullReport(CUSTOMER, [hallC], [], [], {
        selectedGroups: ALL_GROUPS,
      }),
  },
  {
    // W6 — انتخاب بازهٔ هفته‌ها
    name: "W6.renderFullReport-بازهٔ-هفته",
    anchors: [
      "week-range-chip",
      "🎯",
      "هفته بدون ثبت اطلاعات",
      "gap-outside-note",
      "خارج از انتخاب شماست",
    ],
    absent: ['class="week-partial"'],
    run: () =>
      weeklyRenderer.renderFullReport(CUSTOMER, [hallC], [], [], {
        weekSelection: { shared: { preset: "range", from: 1, to: 2 } },
      }),
  },
  {
    // W7 — گلهٔ بدون هیچ هفتهٔ انتخابی → حذف از گزارش + خط اطلاعی
    name: "W7.renderFullReport-گلهٔ-بدون-هفتهٔ-انتخابی",
    anchors: ["به‌خاطر انتخاب‌نشدن هیچ هفته‌ای", "سالن C"],
    absent: ['<table class="week-table metrics-table">'],
    run: () =>
      weeklyRenderer.renderFullReport(CUSTOMER, [hallC], [], [], {
        weekSelection: { shared: null, overrides: { [weekKeyC]: [] } },
      }),
  },
  {
    // W8 — انتخاب مشترک + تنظیم سفارشی هر گله (کلید p<placementId>)
    name: "W8.renderFullReport-انتخاب-هرگله",
    anchors: [
      "شاخص‌های عملکردی هفتگی — کل گله",
      "هفته</strong> از",
      "انتخاب سفارشی",
    ],
    run: () =>
      weeklyRenderer.renderFullReport(
        CUSTOMER,
        [hallA, hallB, hallC],
        [],
        groupFlocksByFlock([hallA, hallB, hallC]),
        {
          weekSelection: {
            shared: { preset: "all" },
            overrides: { [`p${hallC.id}`]: [3] },
          },
        },
      ),
  },
  {
    // W9 — ترتیب سالن‌ها با ورودی معکوس (A → آخر)
    name: "W9.renderFullReport-ترتیب-سالن‌های-معکوس",
    anchors: ["سالن A، سالن B، سالن C"],
    run: () =>
      weeklyRenderer.renderFullReport(
        CUSTOMER,
        [hallC, hallB, hallA],
        [],
        groupFlocksByFlock([hallC, hallB, hallA]),
      ),
  },
  {
    // W10 — حالت خالی: هیچ گله فعالی
    name: "W10.renderFullReport-حالت-خالی",
    anchors: ["هیچ گله فعالی وجود ندارد", "📭"],
    run: () => weeklyRenderer.renderFullReport(CUSTOMER, [], [], []),
  },
  {
    // W11 — کاربر ناشناس: شاخهٔ fallback نام/نقش از localStorage خالی
    name: "W11.renderFullReport-کاربر-ناشناس",
    setup: () => {
      userRaw = null;
    },
    anchors: ["کاربر ناشناس", "(کاربر)", "گزارش توسط سامانه"],
    run: () => weeklyRenderer.renderFullReport(CUSTOMER, [hallA], []),
  },
  {
    // W12 — مشتری ناقص: همهٔ فیلدها «-»
    name: "W12.renderFullReport-مشتری-ناقص",
    anchors: ["اطلاعات مشتری", '<span class="value">-</span>'],
    run: () => weeklyRenderer.renderFullReport({}, [hallA], []),
  },
];

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
// نرمال‌سازی پایان خط: نگهبان «برابری محتوا» را می‌سنجد، نه قرارداد پایان خط
// (core.autocrlf=true در این مخزن می‌تواند همان فایل LF را روی checkout به CRLF
// تبدیل کند و بی‌دلیل همهٔ هش‌ها را بشکند).
const normalizeNewlines = (payload) => payload.replace(/\r\n/g, "\n");

check(
  "متد هدف weeklyRenderer.renderFullReport موجود است",
  typeof weeklyRenderer?.renderFullReport === "function",
);

const captured = {};
let mainHtml = "";
for (const testCase of cases) {
  userRaw = DEFAULT_USER;
  storage.clear();
  testCase.setup?.();
  const payload = normalizeNewlines(await testCase.run());
  captured[testCase.name] = {
    bytes: Buffer.byteLength(payload, "utf8"),
    sha256: sha256(payload),
  };
  if (testCase.name.startsWith("W1.")) mainHtml = payload;
  for (const anchor of testCase.anchors ?? []) {
    check(`${testCase.name} → انکر «${anchor}»`, payload.includes(anchor));
  }
  for (const anchor of testCase.absent ?? []) {
    check(`${testCase.name} → غیبت «${anchor}»`, !payload.includes(anchor));
  }
}

// ===== پیش‌نیاز پایداری اسنپ‌شات: ساعت باید تثبیت‌شده باشد =====
const mainCase = cases.find((testCase) => testCase.name.startsWith("W1."));
userRaw = DEFAULT_USER;
const mainAgain = normalizeNewlines(await mainCase.run());
check(
  "دو اجرای متوالی کِیس اصلی هش یکسان می‌دهند (تثبیت ساعت/زمان)",
  sha256(mainAgain) === captured[mainCase.name].sha256,
);
check(
  "پابرگ گزارش تاریخ/ساعت و نام دریافت‌کننده را درج می‌کند",
  mainHtml.includes("دریافت گزارش توسط") &&
    mainHtml.includes("تاریخ: <strong>") &&
    mainHtml.includes("ساعت: <strong>"),
);

// ===== اسنپ‌شات طلایی: برابری بایت‌به‌بایت =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${JSON.stringify(
      {
        note: "اسنپ‌شات خروجی متد غول هفتگی (renderFullReport)، گرفته‌شده پیش از موج برش بدنه (۳.۲e). هر کِیس = خروجی کامل متد در یک سناریو. بازتولید: npm run test:weekly:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        frozenClockUtc: new Date(FROZEN_MS).toISOString(),
        source: "HEAD پیش از برش بدنه — git tag pre-weekly-body-split",
        note2:
          "خروجی به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (ارقام فارسی، جداکنندهٔ هزارگان، تاریخ شمسی)؛ هارنس ساعت را تثبیت و TZ را روی Asia/Tehran قفل می‌کند، پس مقایسه در همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/weekly-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check(
    "اسنپ‌شات طلایی docs/weekly-body-golden.json موجود است",
    false,
    "با --snapshot بساز",
  );
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
      !!expected &&
        expected.sha256 === digest.sha256 &&
        expected.bytes === digest.bytes,
      expected
        ? `انتظار ${expected.sha256.slice(0, 10)}/${expected.bytes}B · دریافت ${digest.sha256.slice(0, 10)}/${digest.bytes}B`
        : "این کِیس در اسنپ‌شات نیست",
    );
  }
}

const failed = results.filter((ok) => !ok).length;
if (failed) {
  console.log(
    `\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ متد هفتگی`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n✅ هر ${results.length} بررسی موفق — خروجی renderFullReport بایت‌به‌بایت پایدار است`,
  );
}
