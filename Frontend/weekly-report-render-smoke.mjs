// ============================================================
//  اسموک‌تست رندر «گزارش کامل مدیریت هفتگی»
//  هدف: تضمین اینکه جدول تجمعی «کل گله» ساخته می‌شود، پیش از
//  بخش‌های سالن‌ها می‌آید و جدول‌های هر سالن هم حفظ می‌شوند.
//  (موقت — فقط برای اعتبارسنجی این تغییر)
// ============================================================
globalThis.window = globalThis.window || {};
globalThis.document = globalThis.document || {};
globalThis.localStorage = {
  getItem: () =>
    JSON.stringify({ username: "tester", role: "admin", first_name: "تست" }),
};

const { weeklyRenderer } = await import(
  "./src/features/customer-info/sections/weekly/weekly.renderer.js"
);
const { groupFlocksByFlock } = await import(
  "./src/features/customer-info/sections/weekly/weekly.aggregation.js"
);
const { calculateWeekMetrics } = await import(
  "./src/features/customer-info/sections/weekly/weekly.calculations.js"
);

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
    { week_number: 1, weekly_weight: 0.19, weekly_feed_intake: 190, weekly_mortality: 10, flock_age_days: 7, week_start_date: "2026-01-01", week_end_date: "2026-01-07" },
    { week_number: 2, weekly_weight: 0.45, weekly_feed_intake: 420, weekly_mortality: 5, flock_age_days: 14, week_start_date: "2026-01-08", week_end_date: "2026-01-14" },
  ],
});
const hallB = buildHall({
  hallName: "سالن B",
  chicks: 500,
  records: [
    { week_number: 1, weekly_weight: 0.21, weekly_feed_intake: 95, weekly_mortality: 2, flock_age_days: 7, week_start_date: "2026-01-01", week_end_date: "2026-01-07" },
  ],
});

const groups = groupFlocksByFlock([hallA, hallB]);
const html = weeklyRenderer.renderFullReport(
  { full_name: "مشتری تست" },
  [hallA, hallB],
  [],
  groups,
);

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const groupTitleIndex = html.indexOf("شاخص‌های عملکردی هفتگی — کل گله");
const flockTitleIndex = html.indexOf("🐔 گله 12</div>");
const hallAIndex = html.indexOf("سالن A | راس 308");

check("HTML گزارش تولید شد", html.includes("<!DOCTYPE html>"));
check(
  "بخش «کل ۲ سالن» در گزارش هست",
  html.includes("گله 12 — کل 2 سالن"),
  `count=${(html.match(/کل 2 سالن/g) || []).length}`,
);
check("جدول تجمعی «کل گله» رندر شد", groupTitleIndex > -1);
check(
  "جدول «کل گله» پیش از بخش‌های سالن‌ها می‌آید",
  groupTitleIndex > -1 && flockTitleIndex > groupTitleIndex,
  `group=${groupTitleIndex} flock=${flockTitleIndex}`,
);
check(
  "جدول شاخص‌های هر سالن هم حفظ شده (۲ جدول + ۱ جدول کل گله)",
  (html.match(/<table class="week-table metrics-table">/g) || []).length === 3,
  `tables=${(html.match(/<table class="week-table metrics-table">/g) || []).length}`,
);
check(
  "جدول کل گله اعداد تجمعی را نشان می‌دهد (جمعیت ۱٬۵۰۰ و تلفات ۱۲)",
  groupTitleIndex > -1 &&
    html.slice(groupTitleIndex).includes("۱٬۵۰۰") &&
    html.slice(groupTitleIndex).includes(">۱۲<"),
);
check(
  "سالن A بخش مستقل خود را دارد",
  hallAIndex > -1 && html.indexOf("سالن B | راس 308") > -1,
);
check(
  "گزارش بدون آرگومان گروه هم کار می‌کند (سازگاری عقب‌رو)",
  weeklyRenderer
    .renderFullReport({ full_name: "مشتری تست" }, [hallA, hallB], [])
    .includes("metrics-table"),
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ RENDER ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
