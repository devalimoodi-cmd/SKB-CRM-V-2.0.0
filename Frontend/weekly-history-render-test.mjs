// ============================================================
//  تست رندر «گزارش تاریخچه هفتگی» (سطح سرویس — بدون مرورگر)
//  هدف: تضمین اینکه انتخاب گروه‌های شاخص و انتخاب هفته‌های هر گله
//  روی ماتریس‌ها/هشدارها/چیپ‌ها درست اعمال می‌شود.
//  اجرا:  npm run test:weekly:history      (در پوشهٔ Frontend)
// ============================================================
globalThis.window = globalThis.window || { location: { search: "" } };
globalThis.document = globalThis.document || {
  addEventListener: () => {},
  querySelector: () => null,
  getElementById: () => null,
};
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { weeklyService: svc } = await import(
  "./src/features/customer-info/sections/weekly/weekly.service.js"
);
const { calculateWeekMetrics } = await import(
  "./src/features/customer-info/sections/weekly/weekly.calculations.js"
);

const flockLike = { total_chicks_count: 1000, avg_initial_weight: 42, standards: [] };
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
  { week_number: 2, existsInDb: false, flock_age_days: 14, week_start_date: "2026-01-08", week_end_date: "2026-01-14" },
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

const blocks = [
  {
    flock: { id: 7, flock_number: 12, unit: { unit_name: "واحد الف" } },
    completion: { initial_chicks_count: 1000, final_chicks_count: 980, total_mortality: 20, system_fcr: 1.6, slaughter_age_days: 40 },
    halls: [
      {
        placement: { id: 11, hall_id: 1, placement_date: "2026-01-01", total_chicks_count: 1000 },
        hallName: "سالن A",
        weeks: saved,
        allWeeks,
        audit: null,
        timeline,
      },
    ],
  },
];

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// حالت ۱: بدون انتخاب هفته (رفتار قبلی)
const htmlAll = svc.buildWeeklyHistoryHTML({ full_name: "تست" }, blocks, {});
check(
  "بدون انتخاب هفته: ماتریس همهٔ هفته‌ها را دارد (۱، ۲، ۳)",
  htmlAll.includes("هفته 1") && htmlAll.includes("هفته 2") && htmlAll.includes("هفته 3"),
);
check(
  "چیپ مبنای پایان دوره در هدر سالن می‌آید",
  htmlAll.includes("مبنای پایان") && htmlAll.includes("تاریخ پایان کشتار"),
);
check(
  "هفتهٔ بدون ثبت و هشدار آن نمایش داده می‌شود",
  htmlAll.includes("week-missing-col") && htmlAll.includes("هفته بدون ثبت اطلاعات"),
);

// حالت ۲: انتخاب هفتهٔ ۱ و ۳ برای همان گله (f7)
const htmlSelected = svc.buildWeeklyHistoryHTML({ full_name: "تست" }, blocks, {
  selectedGroups: ["population"],
  weekSelection: { shared: null, overrides: { f7: [1, 3] } },
});
check(
  "انتخاب هفتهٔ ۱ و ۳: ستون هفتهٔ ۲ (بدون ثبت) حذف می‌شود",
  htmlSelected.includes("هفته 1") &&
    htmlSelected.includes("هفته 3") &&
    !htmlSelected.includes("هفته 2"),
);
check(
  "چیپ محدودهٔ هفته‌ها و خلاصهٔ ابتدای گزارش درج می‌شود",
  htmlSelected.includes("week-range-chip") && htmlSelected.includes("هفته‌ها:"),
);
check(
  "خط اطلاعی «خارج از انتخاب» برای هفته‌های مشکل‌دار باقی‌مانده",
  htmlSelected.includes("خارج از انتخاب شماست"),
);
check(
  "با انتخاب فقط «جمعیت» سایر ماتریس‌ها رندر نمی‌شوند",
  htmlSelected.includes("جمعیت، تلفات و زنده‌مانی") &&
    !htmlSelected.includes("🚀 رشد"),
);

// حالت ۳: گلهٔ بدون هیچ هفتهٔ انتخابی
const htmlExcluded = svc.buildWeeklyHistoryHTML({ full_name: "تست" }, blocks, {
  weekSelection: { shared: null, overrides: { f7: [] } },
});
check(
  "گلهٔ بدون هفتهٔ انتخابی حذف و در خط اطلاعی اعلام می‌شود",
  !htmlExcluded.includes('class="history-hall"') &&
    htmlExcluded.includes("به‌خاطر انتخاب‌نشدن هیچ هفته‌ای"),
);

// ============================================================
//  🔤 ترتیب سالن‌ها در گزارش تاریخچه: A → آخر (حتی با ورودی معکوس)
// ============================================================
const blocksReversedHalls = [
  {
    ...blocks[0],
    halls: [
      { ...blocks[0].halls[0], hallName: "سالن B" },
      { ...blocks[0].halls[0], hallName: "سالن A" },
    ],
  },
];
const htmlHallsOrder = svc.buildWeeklyHistoryHTML(
  { full_name: "تست" },
  blocksReversedHalls,
  {},
);
check(
  "ترتیب بخش‌های سالن در گزارش تاریخچه = A → B (با ورودی معکوس B,A)",
  htmlHallsOrder.indexOf("🧩 سالن A") > -1 &&
    htmlHallsOrder.indexOf("🧩 سالن B") > -1 &&
    htmlHallsOrder.indexOf("🧩 سالن A") < htmlHallsOrder.indexOf("🧩 سالن B"),
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ HISTORY RENDER ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
