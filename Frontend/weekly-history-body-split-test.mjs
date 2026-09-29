// ============================================================
//  تست برابری بدنهٔ متد غول تاریخچهٔ هفتگی — گارد موج برش بدنه (۳.۲g)
//  اجرا:  npm run test:weekly:history:body                  (در پوشهٔ Frontend)
//         npm run test:weekly:history:body -- --snapshot    (بازتولید اسنپ‌شات طلایی)
// ------------------------------------------------------------
//  چرا؟ `weeklyHistoryHtmlMethods.buildWeeklyHistoryHTML`
//  (`weekly.report.history.html.js:36` · ۳۳۶ خط) بزرگ‌ترین متد مخزن است و «برش بدنه»
//  می‌خورد (کد از داخل متد به تابع‌های ماژول‌محلی منتقل می‌شود) بدون تغییر فایل یا رفتار.
//  روش سنجش دو لایه است (هم‌سبک گاردهای موج‌های ۳.۲d/e/f):
//    ۱) «انکر»های رفتاری: زیررشته‌های ساختاری خروجی زنده (PASS/FAIL).
//    ۲) «اسنپ‌شات طلایی»: sha256 کل HTML خروجی در
//       docs/weekly-history-body-golden.json (پیش از برش) ⇒ هر بایت تغییر، FAIL.
//  ⚠️ متد از `new Date()` و `Intl.DateTimeFormat("fa-IR")` استفاده می‌کند ⇒ ساعت تثبیت و
//     TZ روی Asia/Tehran قفل شده است؛ بدون آن هیچ اسنپ‌شاتی پایدار نیست.
//  ⚠️ اگر عمداً رفتار خروجی تغییر کرد، اول:
//     npm run test:weekly:history:body -- --snapshot
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

// ---------- استاب‌های حداقلی مرورگر (قبل از import) ----------
globalThis.window = globalThis.window || { location: { search: "" } };
globalThis.document = globalThis.document || {
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
};
const store = new Map();
let userRaw = null; // localStorage خالی ⇒ شاخهٔ «کاربر ناشناس»
globalThis.localStorage = {
  getItem: (k) =>
    k === "user" ? userRaw : store.has(k) ? store.get(k) : null,
  setItem: (k, v) => {
    if (k === "user") userRaw = String(v);
    else store.set(k, String(v));
  },
  removeItem: (k) => {
    if (k === "user") userRaw = null;
    else store.delete(k);
  },
};

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};
const info = (message) => console.log(`ℹ️  ${message}`);

// ---------- import ماژول‌های واقعی ----------
const { weeklyService: svc } = await import(
  "./src/features/customer-info/sections/weekly/weekly.service.js"
);
const { calculateWeekMetrics } = await import(
  "./src/features/customer-info/sections/weekly/weekly.calculations.js"
);

// ---------- فیکسچرها (هم‌سان با weekly-history-render-test.mjs) ----------
const flockLike = {
  total_chicks_count: 1000,
  avg_initial_weight: 42,
  standards: [],
};
const rec = (n, weight, feed) => ({
  week_number: n,
  existsInDb: true,
  weekly_weight: weight,
  weekly_feed_intake: feed,
  weekly_mortality: 5,
  flock_age_days: n * 7,
  week_start_date: `2026-01-${String((n - 1) * 7 + 1).padStart(2, "0")}`,
  week_end_date: `2026-01-${String(n * 7).padStart(2, "0")}`,
  diseases: [],
  vaccines: [],
  medicines: [],
  feedTypes: [],
  suggestions: [],
});
const saved = [rec(1, 0.19, 190), rec(3, 0.85, 380)];
saved.forEach((w) => {
  w.metrics = calculateWeekMetrics({
    flock: flockLike,
    weeks: saved,
    weekNumber: w.week_number,
    formValues: {},
  });
});
const allWeeks = [
  saved[0],
  {
    week_number: 2,
    existsInDb: false,
    flock_age_days: 14,
    week_start_date: "2026-01-08",
    week_end_date: "2026-01-14",
  },
  saved[1],
];
const timeline = {
  placementDate: "2026-01-01",
  endDate: "2026-01-22",
  endWeek: 4,
  source: "slaughter-end-date",
  confidence: "high",
  isActive: false,
  lastSavedWeek: 3,
};
const makeBlock = (over = {}) => ({
  flock: { id: 7, flock_number: 12, unit: { unit_name: "واحد الف" } },
  completion: {
    initial_chicks_count: 1000,
    final_chicks_count: 980,
    total_mortality: 20,
    system_fcr: 1.6,
    slaughter_age_days: 40,
  },
  halls: [
    {
      placement: {
        id: 11,
        hall_id: 1,
        placement_date: "2026-01-01",
        total_chicks_count: 1000,
      },
      hallName: "سالن A",
      weeks: saved,
      allWeeks,
      audit: null,
      timeline,
    },
  ],
  ...over,
});
const blocks = [makeBlock()];
const blocksReversedHalls = [
  makeBlock({
    halls: [
      { ...blocks[0].halls[0], hallName: "سالن B" },
      { ...blocks[0].halls[0], hallName: "سالن A" },
    ],
  }),
];
const blocksMinimal = [
  makeBlock({
    completion: {
      initial_chicks_count: null,
      final_chicks_count: null,
      total_mortality: null,
      system_fcr: null,
      slaughter_age_days: null,
    },
    halls: [
      {
        ...blocks[0].halls[0],
        weeks: [],
        allWeeks: [],
        audit: null,
        timeline: null,
      },
    ],
  }),
];
const blocksTwoFlocks = [
  makeBlock(),
  makeBlock({
    flock: { id: 8, flock_number: 13, unit: { unit_name: "واحد ب" } },
    halls: [
      {
        ...blocks[0].halls[0],
        hallName: "سالن B",
        placement: { ...blocks[0].halls[0].placement, id: 12, hall_id: 2 },
      },
    ],
  }),
];

const render = (customer, blocksArg, options) =>
  svc.buildWeeklyHistoryHTML(customer, blocksArg, options);

const CUSTOMER = { full_name: "تست" };
const setUser = (user) => {
  userRaw = user === null ? null : JSON.stringify(user);
};
const ALL_GROUPS = ["population", "weight", "growth", "feed", "details"];

const cases = [
  {
    // H1 — حالت پایه (کاربر ناشناس): همهٔ هفته‌ها + هشدار هفتهٔ بدون ثبت
    name: "H1.buildWeeklyHistoryHTML-حالت-پایه",
    setup: () => setUser(null),
    anchors: [
      "<!DOCTYPE html>",
      "🕓 گزارش تاریخچه",
      "هفته 1",
      "هفته 2",
      "هفته 3",
      'class="history-hall"',
      "🧩 سالن A",
      "مبنای پایان",
      "week-missing-col",
      "هفته بدون ثبت اطلاعات",
    ],
    run: () => render(CUSTOMER, blocks, {}),
  },
  {
    // H2 — کاربر لاگین‌شده (نام دریافت‌کننده از localStorage)
    name: "H2.buildWeeklyHistoryHTML-کاربر-لاگین‌شده",
    setup: () => setUser({ fullName: "مدیر تست", first_name: "", last_name: "" }),
    anchors: ["<!DOCTYPE html>", "مدیر تست"],
    run: () => render(CUSTOMER, blocks, {}),
  },
  {
    // H3 — انتخاب هفتهٔ ۱ و ۳ + فقط گروه «جمعیت»
    name: "H3.buildWeeklyHistoryHTML-انتخاب-هفته-و-گروه",
    setup: () => setUser(null),
    anchors: [
      "هفته 1",
      "هفته 3",
      "week-range-chip",
      "جمعیت، تلفات و زنده‌مانی",
      "خارج از انتخاب شماست",
    ],
    absent: ["هفته 2", "🚀 رشد"],
    run: () =>
      render(CUSTOMER, blocks, {
        selectedGroups: ["population"],
        weekSelection: { shared: null, overrides: { f7: [1, 3] } },
      }),
  },
  {
    // H4 — گلهٔ بدون هیچ هفتهٔ انتخابی ⇒ حذف + خط اطلاعی
    name: "H4.buildWeeklyHistoryHTML-گلهٔ-بدون-انتخاب",
    setup: () => setUser(null),
    anchors: ["به‌خاطر انتخاب‌نشدن هیچ هفته‌ای"],
    absent: ['class="history-hall"'],
    run: () =>
      render(CUSTOMER, blocks, {
        weekSelection: { shared: null, overrides: { f7: [] } },
      }),
  },
  {
    // H5 — ترتیب سالن‌ها با ورودی معکوس (A → آخر)
    name: "H5.buildWeeklyHistoryHTML-ترتیب-سالن‌ها",
    setup: () => setUser(null),
    anchors: ["🧩 سالن A", "🧩 سالن B"],
    run: () => render(CUSTOMER, blocksReversedHalls, {}),
  },
  {
    // H6 — دو گله در یک گزارش
    name: "H6.buildWeeklyHistoryHTML-دو-گله",
    setup: () => setUser(null),
    anchors: ["🧩 سالن A", "🧩 سالن B", "هفته 1"],
    run: () => render(CUSTOMER, blocksTwoFlocks, {}),
  },
];

cases.push(
  {
    // H7 — رکورد حداقلی/قدیمی: completion تهی، بدون هفته و بدون تایم‌لاین
    name: "H7.buildWeeklyHistoryHTML-رکورد-حداقلی",
    setup: () => setUser(null),
    anchors: ["<!DOCTYPE html>", "🧩 سالن A"],
    run: () => render(CUSTOMER, blocksMinimal, {}),
  },
  {
    // H8 — بلوک خالی
    name: "H8.buildWeeklyHistoryHTML-بلوک-خالی",
    setup: () => setUser(null),
    anchors: ["<!DOCTYPE html>"],
    absent: ['class="history-hall"'],
    run: () => render(CUSTOMER, [], {}),
  },
  {
    // H9 — مشتری ناقص
    name: "H9.buildWeeklyHistoryHTML-مشتری-ناقص",
    setup: () => setUser(null),
    anchors: ["<!DOCTYPE html>", "🧩 سالن A"],
    run: () => render({}, blocks, {}),
  },
  {
    // H10 — همهٔ گروه‌ها به‌صورت صریح
    name: "H10.buildWeeklyHistoryHTML-همهٔ-گروه‌ها-صریح",
    setup: () => setUser(null),
    anchors: ["جمعیت، تلفات و زنده‌مانی", "🚀 رشد", "خوراک"],
    run: () => render(CUSTOMER, blocks, { selectedGroups: ALL_GROUPS }),
  },
  {
    // H11 — انتخاب مشترک «همه» + تنظیم سفارشی گله
    name: "H11.buildWeeklyHistoryHTML-انتخاب-مشترک-و-سفارشی",
    setup: () => setUser(null),
    anchors: ["هفته 3", "week-range-chip", "انتخاب سفارشی"],
    run: () =>
      render(CUSTOMER, blocks, {
        weekSelection: { shared: { preset: "all" }, overrides: { f7: [3] } },
      }),
  },
  {
    // H12 — دو گله با انتخاب هفته‌های متفاوت
    name: "H12.buildWeeklyHistoryHTML-دو-گله-انتخاب-مجزا",
    setup: () => setUser(null),
    anchors: ["🧩 سالن A", "🧩 سالن B", "هفته 1"],
    run: () =>
      render(CUSTOMER, blocksTwoFlocks, {
        weekSelection: { shared: null, overrides: { f8: [1] } },
      }),
  },
);

// ===== اجرا: انکرهای رفتاری + هش sha256 هر کِیس =====
const GOLDEN_URL = new URL(
  "../docs/weekly-history-body-golden.json",
  import.meta.url,
);
const SNAPSHOT = process.argv.includes("--snapshot");
const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");
// نرمال‌سازی پایان خط (core.autocrlf روی checkout می‌تواند CRLF کند).
const normalizeNewlines = (payload) => payload.replace(/\r\n/g, "\n");

check(
  "متد هدف weeklyService.buildWeeklyHistoryHTML موجود است",
  typeof svc?.buildWeeklyHistoryHTML === "function",
);

const captured = {};
let mainHtml = "";
for (const testCase of cases) {
  store.clear();
  setUser(null);
  testCase.setup?.();
  const payload = normalizeNewlines(await testCase.run());
  captured[testCase.name] = {
    bytes: Buffer.byteLength(payload, "utf8"),
    sha256: sha256(payload),
  };
  if (testCase.name.startsWith("H1.")) mainHtml = payload;
  for (const anchor of testCase.anchors ?? []) {
    check(`${testCase.name} → انکر «${anchor}»`, payload.includes(anchor));
  }
  for (const anchor of testCase.absent ?? []) {
    check(`${testCase.name} → غیبت «${anchor}»`, !payload.includes(anchor));
  }
}

// ===== پیش‌نیاز پایداری اسنپ‌شات: ساعت تثبیت‌شده باشد =====
const firstCase = cases[0];
store.clear();
setUser(null);
firstCase.setup?.();
const firstAgain = normalizeNewlines(await firstCase.run());
check(
  "دو اجرای متوالی کِیس اول هش یکسان می‌دهند (تثبیت ساعت)",
  sha256(firstAgain) === captured[firstCase.name].sha256,
);
check(
  "خروجی کِیس پایه پوستهٔ کامل سند را دارد",
  mainHtml.includes("<!DOCTYPE html>") && mainHtml.includes("</html>"),
);

// ===== اسنپ‌شات طلایی: برابری بایت‌به‌بایت =====
if (SNAPSHOT) {
  fs.writeFileSync(
    GOLDEN_URL,
    `${JSON.stringify(
      {
        note: "اسنپ‌شات خروجی متد غول تاریخچهٔ هفتگی (buildWeeklyHistoryHTML)، گرفته‌شده پیش از موج برش بدنه (۳.۲g). هر کِیس = کل HTML برگشتی متد. بازتولید: npm run test:weekly:history:body -- --snapshot",
        node: process.version,
        locale: Intl.NumberFormat().resolvedOptions().locale,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        frozenClockUtc: new Date(FROZEN_MS).toISOString(),
        source: "HEAD پیش از برش بدنه — git tag pre-history-body-split",
        note2:
          "خروجی به locale/ICU و منطقهٔ زمانی محیط Node وابسته است (تاریخ/ساعت شمسی و ارقام فارسی)؛ هارنس ساعت را تثبیت و TZ را روی Asia/Tehran قفل می‌کند، پس مقایسه در همان محیطی معنا دارد که اسنپ‌شات گرفته شده است.",
        cases: captured,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  info(
    `اسنپ‌شات طلایی نوشته شد: docs/weekly-history-body-golden.json (${Object.keys(captured).length} کِیس)`,
  );
} else if (!fs.existsSync(GOLDEN_URL)) {
  check(
    "اسنپ‌شات طلایی docs/weekly-history-body-golden.json موجود است",
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
    `\n❌ ${failed} بررسی از ${results.length} ناموفق — گارد برش بدنهٔ گزارش تاریخچه`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `\n✅ هر ${results.length} بررسی موفق — خروجی buildWeeklyHistoryHTML بایت‌به‌بایت پایدار است`,
  );
}
