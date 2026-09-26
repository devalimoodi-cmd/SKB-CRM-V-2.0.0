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

const { weeklyRenderer, renderHistoryWeekMatrix } = await import(
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

// ============================================================
//  ✅ انتخاب گروه‌های شاخص + آلارم هفته‌های ثبت‌نشده/ناقص
// ============================================================

// سالنی که هفتهٔ ۲ آن ثبت نشده است (خط زمانی: ۱ ✅ · ۲ ❌ · ۳ ✅)
const hallC = buildHall({
  hallName: "سالن C",
  chicks: 800,
  records: [
    { week_number: 1, weekly_weight: 0.19, weekly_feed_intake: 180, weekly_mortality: 4, flock_age_days: 7, week_start_date: "2026-01-01", week_end_date: "2026-01-07" },
    { week_number: 3, weekly_weight: 0.85, weekly_feed_intake: 380, weekly_mortality: 3, flock_age_days: 21, week_start_date: "2026-01-15", week_end_date: "2026-01-21" },
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
// هفتهٔ ناقص: رکورد دارد ولی خوراک آن ثبت نشده
hallC.weeks[2] = { ...hallC.weeks[2], weekly_feed_intake: null, daily_feed_intake: null };

const htmlGaps = weeklyRenderer.renderFullReport(
  { full_name: "مشتری تست" },
  [hallC],
  [],
);

check(
  "گزارش گلهٔ دارای گپ، بنر هشدار هفته‌های ثبت‌نشده می‌سازد",
  htmlGaps.includes('class="report-alert"') &&
    htmlGaps.includes("هفته بدون ثبت اطلاعات"),
);
check(
  "هشدار هفتهٔ ناقص (بدون خوراک) هم نمایش داده می‌شود",
  htmlGaps.includes("هفته ناقص") && htmlGaps.includes("بدون خوراک"),
);
check(
  "ردیف «❌ ثبت نشده» برای هفتهٔ بدون رکورد در جدول شاخص‌ها درج می‌شود",
  htmlGaps.includes('class="week-missing"') &&
    htmlGaps.includes("❌ ثبت نشده"),
);
check(
  "وضعیت هفتهٔ ناقص در جدول با ⚠️ و کلاس week-partial علامت می‌خورد",
  htmlGaps.includes("week-partial") &&
    htmlGaps.includes("وزن یا خوراک این هفته ثبت نشده است"),
);
check(
  "نشان فشردهٔ گپ در نوار متای گله می‌آید",
  htmlGaps.includes("gap-badge") &&
    htmlGaps.includes("گله با هفتهٔ ثبت‌نشده/ناقص"),
);
check(
  "کارت خلاصه «گله با هفتهٔ ثبت‌نشده/ناقص» به کارت‌های گزارش اضافه می‌شود",
  htmlGaps.includes("warn-stat") && htmlGaps.includes("گله با هفتهٔ ثبت‌نشده/ناقص"),
);

// ===== فیلتر گروه‌ها: فقط «وزن» =====
const htmlWeightOnly = weeklyRenderer.renderFullReport(
  { full_name: "مشتری تست" },
  [hallC],
  [],
  [],
  { selectedGroups: ["weight"] },
);

check(
  "با انتخاب فقط «وزن» ستون‌های خوراک و جمعیت حذف می‌شوند",
  htmlWeightOnly.includes("افزایش وزن (kg)") &&
    !htmlWeightOnly.includes("دان کل (kg)") &&
    !htmlWeightOnly.includes("جمعیت ابتدای هفته") &&
    !htmlWeightOnly.includes("FCR"),
);
check(
  "با انتخاب فقط «وزن» جدول «جزئیات ثبت هفتگی» رندر نمی‌شود",
  !htmlWeightOnly.includes("جزئیات ثبت هفتگی"),
);
check(
  "یادداشت شاخص‌های انتخابی در بالای گزارش درج می‌شود",
  htmlWeightOnly.includes("report-groups-note") &&
    htmlWeightOnly.includes("⚖️ وزن") &&
    !htmlWeightOnly.includes("🛒 خوراک و ضریب تبدیل"),
);
check(
  "گزارش با انتخاب همهٔ گروه‌ها همان ستون‌های قبلی را دارد (بدون رگرسیون)",
  htmlGaps.includes("دان کل (kg)") &&
    htmlGaps.includes("جمعیت ابتدای هفته") &&
    htmlGaps.includes("جزئیات ثبت هفتگی") &&
    htmlGaps.includes("همهٔ شاخص‌ها"),
);

// ===== ماتریس تاریخچهٔ هفتگی =====
const matrixAll = renderHistoryWeekMatrix([hallC.savedWeeks[0], hallC.savedWeeks[1]]);
check(
  "ماتریس تاریخچه با انتخاب پیش‌فرض همهٔ گروه‌ها را دارد",
  matrixAll.includes("🐔 جمعیت، تلفات و زنده‌مانی") &&
    matrixAll.includes("⚖️ وزن") &&
    matrixAll.includes("🚀 رشد") &&
    matrixAll.includes("🛒 خوراک و ضریب تبدیل") &&
    matrixAll.includes("📋 جزئیات ثبت هفتگی"),
);
const matrixGrowth = renderHistoryWeekMatrix(
  [hallC.savedWeeks[0], hallC.savedWeeks[1]],
  ["growth"],
);
check(
  "ماتریس تاریخچه با انتخاب «رشد» فقط جدول رشد را می‌سازد",
  matrixGrowth.includes("🚀 رشد") &&
    !matrixGrowth.includes("⚖️ وزن") &&
    !matrixGrowth.includes("خوراک روزانه (کیلوگرم)") &&
    !matrixGrowth.includes("جمعیت ابتدای هفته"),
);
const matrixTimeline = renderHistoryWeekMatrix(hallC.weeks, ["population"]);
check(
  "هفتهٔ بدون ثبت در ماتریس تاریخچه ستون ❌ می‌گیرد",
  matrixTimeline.includes("week-missing-col") &&
    matrixTimeline.includes("❌ ثبت نشده") &&
    matrixTimeline.includes("هفته 2 ❌"),
);
check(
  "ماتریس خالی از هفته پیام مناسب می‌دهد",
  renderHistoryWeekMatrix([], ["weight"]).includes("گروه شاخصی") ===
    false &&
    renderHistoryWeekMatrix([]).includes("ثبت هفتگی"),
);

// ============================================================
//  🎯 انتخاب هفته‌ها (per flock) + مبنا و خطوط اطلاعی
// ============================================================

const weekKeyC = `p${hallC.id}`;
const htmlWeekRange = weeklyRenderer.renderFullReport(
  { full_name: "مشتری تست" },
  [hallC],
  [],
  [],
  { weekSelection: { shared: { preset: "range", from: 1, to: 2 } } },
);

check(
  "انتخاب بازه: فقط هفته‌های ۱ و ۲ در جدول شاخص‌ها می‌آید (هفتهٔ ۳ نمی‌آید)",
  htmlWeekRange.includes("<td>هفته 1</td>") &&
    htmlWeekRange.includes("هفته 2") &&
    !htmlWeekRange.includes("<td>هفته 3"),
);
check(
  "چیپ محدودهٔ هفته‌ها («🎯») در نوار متای گله درج می‌شود",
  htmlWeekRange.includes("week-range-chip") && htmlWeekRange.includes("🎯"),
);
check(
  "هشدار ثبت هفتگی فقط روی هفته‌های انتخابی محاسبه می‌شود (هفتهٔ ۲ = بدون ثبت)",
  htmlWeekRange.includes("هفته بدون ثبت اطلاعات") &&
    !htmlWeekRange.includes('class="week-partial"'),
);
check(
  "خط اطلاعی «هفتهٔ مشکل‌دار خارج از انتخاب» نمایش داده می‌شود",
  htmlWeekRange.includes("gap-outside-note") &&
    htmlWeekRange.includes("خارج از انتخاب شماست"),
);
check(
  "جدول «جزئیات ثبت هفتگی» هم فقط هفته‌های انتخابی را دارد",
  (htmlWeekRange.match(/>هفته 3</g) || []).length === 0,
);

// گله‌ای که هیچ هفته‌ای برایش انتخاب نشده → از گزارش حذف می‌شود
const htmlWeekExcluded = weeklyRenderer.renderFullReport(
  { full_name: "مشتری تست" },
  [hallC],
  [],
  [],
  { weekSelection: { shared: null, overrides: { [weekKeyC]: [] } } },
);
check(
  "گلهٔ بدون هفتهٔ انتخابی از گزارش حذف و در خط اطلاعی اعلام می‌شود",
  !htmlWeekExcluded.includes('<table class="week-table metrics-table">') &&
    htmlWeekExcluded.includes("به‌خاطر انتخاب‌نشدن هیچ هفته‌ای") &&
    htmlWeekExcluded.includes("سالن C"),
);

// تنظیم سفارشی هر گله در گزارش چندگله‌ای (کلید p<placementId>)
const htmlPerFlock = weeklyRenderer.renderFullReport(
  { full_name: "مشتری تست" },
  [hallA, hallB, hallC],
  [],
  groupFlocksByFlock([hallA, hallB, hallC]),
  {
    weekSelection: {
      shared: { preset: "all" },
      overrides: { [`p${hallC.id}`]: [3] },
    },
  },
);
check(
  "انتخاب مشترک + تنظیم سفارشی: هر سه سالن + جدول تجمعی «کل گله» رندر می‌شود",
  (htmlPerFlock.match(/<table class="week-table metrics-table">/g) || []).length === 4 &&
    htmlPerFlock.includes("شاخص‌های عملکردی هفتگی — کل گله"),
);
check(
  "یادداشت شاخص‌ها، خلاصهٔ انتخاب هفته‌ها را هم نشان می‌دهد",
  htmlPerFlock.includes("هفته</strong> از") &&
    htmlPerFlock.includes("انتخاب سفارشی"),
);

// ماتریس تاریخچه: فیلتر ستون‌ها بر اساس هفته‌های انتخابی
const matrixFiltered = renderHistoryWeekMatrix(
  hallC.weeks,
  ["population"],
  { weekNumbers: [1, 3] },
);
check(
  "ماتریس تاریخچه فقط ستون‌های هفته‌های انتخاب‌شده را می‌سازد",
  matrixFiltered.includes("هفته 1") &&
    matrixFiltered.includes("هفته 3") &&
    !matrixFiltered.includes("هفته 2"),
);

// ============================================================
//  🔤 ترتیب سالن‌ها در گزارش: همیشه A → آخر (حتی با ورودی معکوس)
// ============================================================

const htmlHallOrder = weeklyRenderer.renderFullReport(
  { full_name: "مشتری تست" },
  [hallC, hallB, hallA],
  [],
  groupFlocksByFlock([hallC, hallB, hallA]),
);
// ترتیب بخش‌های تفکیک سالن‌ها (آخرین رخداد = بخش اختصاصی همان سالن)
const idxA = htmlHallOrder.lastIndexOf("سالن A | راس 308");
const idxB = htmlHallOrder.lastIndexOf("سالن B | راس 308");
const idxC = htmlHallOrder.lastIndexOf("سالن C | راس 308");
check(
  "ترتیب بخش‌های سالن در گزارش کامل = A → B → C (با ورودی معکوس C,B,A)",
  idxA > -1 && idxB > idxA && idxC > idxB,
  `A=${idxA} B=${idxB} C=${idxC}`,
);
check(
  "ترتیب نام سالن‌ها در جدول تجمعی «کل گله» هم A → B → C است",
  htmlHallOrder.includes("سالن A، سالن B، سالن C"),
  `has=${htmlHallOrder.includes("سالن A، سالن B، سالن C")}`,
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ RENDER ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
