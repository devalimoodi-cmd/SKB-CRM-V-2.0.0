// ============================================================
//  تست محاسبات «مدیریت هفتگی» (توابع خالص — بدون نیاز به مرورگر/سرور)
//  اجرا:  npm run test:weekly      (در پوشهٔ Frontend)
// ------------------------------------------------------------
//  چرا؟ ستون‌های «تلفات (قطعه)» و «سرانه هفتگی (kg)» جدول
//  «📈 شاخص‌های عملکردی هفتگی» از همین متریک‌ها ساخته می‌شوند؛
//  این تست مبنای فرمول‌ها را تضمین می‌کند.
// ============================================================
import {
  calculateWeekMetrics,
  birdsStartOfWeek,
  birdsEndOfWeek,
  cumulativeMortality,
  weeklyMortalityPercent,
  cumulativeFeed,
} from "./src/features/customer-info/sections/weekly/weekly.calculations.js";
import {
  flockGroupKey,
  buildFlockGroupAggregate,
  groupFlocksByFlock,
  compareHallNames,
  hallNameOf,
  sortFlocksByHall,
  sortHallNames,
} from "./src/features/customer-info/sections/weekly/weekly.aggregation.js";
import {
  REPORT_GROUPS,
  ALL_GROUP_KEYS,
  METRICS_COLUMNS,
  metricsColumnsFor,
  normalizeGroups,
  isGroupSelected,
  selectedGroupsLabel,
} from "./src/features/customer-info/sections/weekly/weekly.report.groups.js";
import {
  WEEK_STATUS,
  TIMELINE_SOURCE,
  auditWeeks,
  mergeAudits,
  expectedWeekLimit,
  formatWeekList,
  resolveFlockTimelineEnd,
  scopeAuditToWeeks,
  timelineBasisLabel,
  weekAuditStatus,
  weekNumberOfDate,
} from "./src/features/customer-info/sections/weekly/weekly.audit.js";
import {
  WEEK_PRESET,
  buildWeekTimeline,
  effectiveWeeksFor,
  issuesOutsideSelection,
  mergeWeekTimelines,
  normalizeWeekSelection,
  resolvePresetWeeks,
  resolveWeekRule,
  summarizeWeekSelection,
  unionWeekSelection,
  weekSelectionLabel,
} from "./src/features/customer-info/sections/weekly/weekly.report.weeks.js";

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// ===== دادهٔ نمونه: ۱۰۰۰ جوجه، دو هفته ثبت‌شده =====
const flock = {
  total_chicks_count: 1000,
  avg_initial_weight: 42, // گرم
  standards: [],
};
const weeks = [
  {
    week_number: 1,
    existsInDb: true,
    weekly_weight: 0.19,
    weekly_feed_intake: 190,
    weekly_mortality: 10,
    flock_age_days: 7,
  },
  {
    week_number: 2,
    existsInDb: true,
    weekly_weight: 0.45,
    weekly_feed_intake: 420,
    weekly_mortality: 5,
    flock_age_days: 14,
  },
];

const w1 = calculateWeekMetrics({ flock, weeks, weekNumber: 1, formValues: {} });
const w2 = calculateWeekMetrics({ flock, weeks, weekNumber: 2, formValues: {} });

// ===== جمعیت =====
check(
  "جمعیت ابتدای هفتهٔ ۱ = ۱۰۰۰ قطعه",
  w1.birdsStartOfWeek === 1000,
  `start=${w1.birdsStartOfWeek}`,
);
check(
  "جمعیت ماندهٔ پایان هفتهٔ ۱ = ۹۹۰ قطعه (۱۰۰۰ − ۱۰)",
  w1.birdsEndOfWeek === 990,
  `end=${w1.birdsEndOfWeek}`,
);
check(
  "جمعیت ابتدای هفتهٔ ۲ = ۹۹۰ قطعه (کسر تلفات هفتهٔ قبل)",
  w2.birdsStartOfWeek === 990,
  `start=${w2.birdsStartOfWeek}`,
);
check(
  "جمعیت ماندهٔ پایان هفتهٔ ۲ = ۹۸۵ قطعه",
  w2.birdsEndOfWeek === 985,
  `end=${w2.birdsEndOfWeek}`,
);

// ===== تلفات (ستون جدید «تلفات (قطعه)») =====
check(
  "تعداد تلفات هفتهٔ ۱ = ۱۰ قطعه",
  w1.mortalityThisWeek === 10,
  `mortality=${w1.mortalityThisWeek}`,
);
check(
  "تعداد تلفات هفتهٔ ۲ = ۵ قطعه",
  w2.mortalityThisWeek === 5,
  `mortality=${w2.mortalityThisWeek}`,
);
check(
  "درصد تلفات هفتهٔ ۱ = ۱٪ (۱۰ ÷ ۱۰۰۰)",
  Math.abs(w1.weeklyMortalityPercent - 1) < 0.01,
  `pct=${w1.weeklyMortalityPercent}`,
);
check(
  "درصد تلفات هفتهٔ ۲ ≈ ۰.۵۱٪ (۵ ÷ ۹۹۰)",
  Math.abs(w2.weeklyMortalityPercent - (5 / 990) * 100) < 0.01,
  `pct=${w2.weeklyMortalityPercent}`,
);

// ===== سرانه (ستون جدید «سرانه هفتگی (kg)») =====
check(
  "سرانهٔ هفتگی هفتهٔ ۱ = ۰.۱۹ kg/قطعه (۱۹۰ ÷ ۱۰۰۰)",
  Math.abs(w1.weeklyFeedPerBird - 0.19) < 0.001,
  `weekly=${w1.weeklyFeedPerBird}`,
);
check(
  "سرانهٔ هفتگی هفتهٔ ۲ ≈ ۰.۴۲۴ kg/قطعه (۴۲۰ ÷ ۹۹۰)",
  Math.abs(w2.weeklyFeedPerBird - 420 / 990) < 0.001,
  `weekly=${w2.weeklyFeedPerBird}`,
);

// ===== سرانهٔ روزانه (ستون موجود) =====
check(
  "سرانهٔ روزانهٔ هفتهٔ ۱ ≈ ۲۷.۱ گرم/قطعه",
  Math.abs(w1.dailyFeedPerBird - (190 / 7 / 1000) * 1000) < 0.1,
  `daily=${w1.dailyFeedPerBird}`,
);
check(
  "سرانهٔ روزانهٔ هفتهٔ ۲ ≈ ۶۰.۶ گرم/قطعه",
  Math.abs(w2.dailyFeedPerBird - (420 / 7 / 990) * 1000) < 0.1,
  `daily=${w2.dailyFeedPerBird}`,
);

// ===== تجمعی‌ها =====
check(
  "دان کل تا هفتهٔ ۲ = ۶۱۰ کیلوگرم",
  w2.cumulativeFeed === 610,
  `cum=${w2.cumulativeFeed}`,
);
check(
  "تلفات تجمعی تا هفتهٔ ۲ = ۱۵ قطعه",
  cumulativeMortality({ 1: 10, 2: 5 }, 2) === 15,
);

// ===== توابع پایه (حالت‌های مرزی) =====
check(
  "بدون تلفات: جمعیت پایان هفته = جمعیت ابتدا",
  birdsEndOfWeek(100, {}, 1) === 100,
  `end=${birdsEndOfWeek(100, {}, 1)}`,
);
check(
  "جمعیت صفر: درصد تلفات → null (بدون تقسیم بر صفر)",
  weeklyMortalityPercent(0, { 1: 5 }, 1) === null,
);
check(
  "جمعیت ابتدای هفتهٔ ۳ = ۱۰۰۰ − ۱۵ = ۹۸۵",
  birdsStartOfWeek(1000, { 1: 10, 2: 5 }, 3) === 985,
  `start=${birdsStartOfWeek(1000, { 1: 10, 2: 5 }, 3)}`,
);
check(
  "مجموع دان با اعشار درست جمع می‌شود",
  cumulativeFeed({ 1: 100, 2: 250.5 }, 2) === 350.5,
);

// ===== «سرانه» (تجمعی) = مجموع دان تا این هفته ÷ جمعیت ابتدای هفته =====
check(
  "سرانه در هفتهٔ ۱ = ۰.۱۹ kg/قطعه (و برابر سرانهٔ هفتگی — ثابت ریاضی)",
  Math.abs(w1.cumulativeFeedPerBird - 0.19) < 0.001 &&
    w1.cumulativeFeedPerBird === w1.weeklyFeedPerBird,
  `cum=${w1.cumulativeFeedPerBird} weekly=${w1.weeklyFeedPerBird}`,
);
check(
  "سرانه در هفتهٔ ۲ ≈ ۰.۶۱۶ kg/قطعه (۶۱۰ ÷ ۹۹۰)",
  Math.abs(w2.cumulativeFeedPerBird - 610 / 990) < 0.001,
  `cum=${w2.cumulativeFeedPerBird}`,
);
check(
  "سرانه با جمعیت صفر → null (بدون تقسیم بر صفر)",
  (() => {
    try {
      const zero = calculateWeekMetrics({
        flock: { total_chicks_count: 0, avg_initial_weight: 42, standards: [] },
        weeks,
        weekNumber: 1,
        formValues: {},
      });
      return zero.cumulativeFeedPerBird === null;
    } catch {
      return false;
    }
  })(),
);

// ============================================================
//  آزمون جدول تجمعی «کل گله» (یک گله = چند سالن)
// ============================================================

// ساخت دادهٔ یک سالن، دقیقاً همان‌طور که سرویس گزارش می‌سازد
const buildHall = ({ hallName, chicks, initialWeight, records }) => {
  const hallFlock = {
    total_chicks_count: chicks,
    avg_initial_weight: initialWeight,
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

  return {
    id: `${hallName}-placement`,
    flock_id: 7,
    flock_number: 12,
    hall_id: hallName,
    hall_name: hallName,
    total_chicks_count: chicks,
    avg_initial_weight: initialWeight,
    breed_name: "راس 308",
    placement_date: "2026-01-01",
    is_active: true,
    standards: [],
    weeks: savedWeeks,
    savedWeeks,
    statistics: {},
  };
};

// سالن A: ۱۰۰۰ جوجه، دو هفته | سالن B: ۵۰۰ جوجه، یک هفته
const hallA = buildHall({
  hallName: "سالن A",
  chicks: 1000,
  initialWeight: 42,
  records: [
    { week_number: 1, weekly_weight: 0.19, weekly_feed_intake: 190, weekly_mortality: 10, flock_age_days: 7 },
    { week_number: 2, weekly_weight: 0.45, weekly_feed_intake: 420, weekly_mortality: 5, flock_age_days: 14 },
  ],
});
const hallB = buildHall({
  hallName: "سالن B",
  chicks: 500,
  initialWeight: 42,
  records: [
    { week_number: 1, weekly_weight: 0.21, weekly_feed_intake: 95, weekly_mortality: 2, flock_age_days: 7 },
  ],
});

// ===== کلید گروه‌بندی =====
check(
  "کلید گروه‌بندی گله از flock_id ساخته می‌شود و سالن‌ها یک گروه می‌شوند",
  flockGroupKey(hallA) === "f7" && flockGroupKey(hallB) === "f7",
  `${flockGroupKey(hallA)} / ${flockGroupKey(hallB)}`,
);
check(
  "بدون flock_id از شماره گله استفاده می‌شود (fallback)",
  flockGroupKey({ id: 1, flock_number: 99 }) === "n99",
  flockGroupKey({ id: 1, flock_number: 99 }),
);

// ===== تجمیع کل گله =====
const agg = buildFlockGroupAggregate({ halls: [hallA, hallB] });
const aw1 = agg?.savedWeeks?.[0]?.metrics;
const aw2 = agg?.savedWeeks?.[1]?.metrics;

check("جدول کل گله برای گلهٔ دو سالنه ساخته می‌شود", !!agg && agg.savedWeeks.length === 2);
check(
  "جمعیت ابتدای هفتهٔ ۱ کل گله = مجموع سالن‌ها = ۱۵۰۰",
  aw1?.birdsStartOfWeek === 1500,
  `start=${aw1?.birdsStartOfWeek}`,
);
check(
  "جمعیت ماندهٔ پایان هفتهٔ ۱ کل گله = ۱۴۸۸ (۱۵۰۰ − ۱۲)",
  aw1?.birdsEndOfWeek === 1488,
  `end=${aw1?.birdsEndOfWeek}`,
);
check(
  "تلفات هفتهٔ ۱ کل گله = مجموع تلفات سالن‌ها = ۱۲",
  aw1?.mortalityThisWeek === 12,
  `mortality=${aw1?.mortalityThisWeek}`,
);
check(
  "درصد تلفات هفتهٔ ۱ کل گله = ۱۲ ÷ ۱۵۰۰ = ۰.۸٪",
  Math.abs(aw1?.weeklyMortalityPercent - 0.8) < 0.0001,
  `pct=${aw1?.weeklyMortalityPercent}`,
);
check(
  "دان هفتهٔ ۱ کل گله = مجموع دان سالن‌ها = ۲۸۵ kg",
  aw1?.cumulativeFeed === 285,
  `feed=${aw1?.cumulativeFeed}`,
);
check(
  "سرانهٔ کل گله هفتهٔ ۱ = ۲۸۵ ÷ ۱۵۰۰ = ۰.۱۹ kg",
  Math.abs(aw1?.cumulativeFeedPerBird - 0.19) < 0.001,
  `perBird=${aw1?.cumulativeFeedPerBird}`,
);
check(
  "وزن کل گله = میانگین وزنی (۰.۱۹×۹۹۰ + ۰.۲۱×۴۹۸) ÷ ۱۴۸۸",
  Math.abs(
    aw1?.weight - (0.19 * 990 + 0.21 * 498) / 1488,
  ) < 0.001,
  `weight=${aw1?.weight}`,
);
check(
  "وزن کل (kg) کل گله = وزن وزنی خام × جمعیت مانده (≈ ۲۹۲.۷ kg)",
  Math.abs(
    aw1?.totalLiveWeight - ((0.19 * 990 + 0.21 * 498) / 1488) * 1488,
  ) < 0.05,
  `totalLiveWeight=${aw1?.totalLiveWeight}`,
);

// ===== هفتهٔ ۲ کل گله (سالن B فقط یک هفته دارد) =====
check(
  "جمعیت ابتدای هفتهٔ ۲ کل گله = ۱۴۸۸ (کسر تلفات هفتهٔ ۱)",
  aw2?.birdsStartOfWeek === 1488,
  `start=${aw2?.birdsStartOfWeek}`,
);
check(
  "دان تجمعی کل گله تا هفتهٔ ۲ = ۲۸۵ + ۴۲۰ = ۷۰۵ kg (سهم سالن B تکرار نمی‌شود)",
  aw2?.cumulativeFeed === 705,
  `feed=${aw2?.cumulativeFeed}`,
);
check(
  "سرانهٔ کل گله هفتهٔ ۲ = ۷۰۵ ÷ ۱۴۸۸",
  Math.abs(aw2?.cumulativeFeedPerBird - 705 / 1488) < 0.001,
  `perBird=${aw2?.cumulativeFeedPerBird}`,
);
check(
  "جمعیت ماندهٔ پایان هفتهٔ ۲ کل گله = ۱۴۸۸ − ۵ = ۱۴۸۳",
  aw2?.birdsEndOfWeek === 1483,
  `end=${aw2?.birdsEndOfWeek}`,
);
check(
  "FCR کل گله = دان تجمعی ÷ (وزن × جمعیت مانده) = ۷۰۵ ÷ (۰.۴۵ × ۱۴۸۳)",
  Math.abs(aw2?.fcr - 705 / (0.45 * 1483)) < 0.001,
  `fcr=${aw2?.fcr}`,
);
check(
  "زنده‌مانی تجمعی کل گله = ۱۴۸۳ ÷ ۱۵۰۰ ≈ ۹۸.۸۷٪",
  Math.abs(aw2?.cumulativeSurvivalPercent - (1483 / 1500) * 100) < 0.01,
  `survival=${aw2?.cumulativeSurvivalPercent}`,
);
check(
  "آمار کل گله: تلفات ۱۷ قطعه و خوراک ۷۰۵ kg",
  agg?.statistics?.totalMortality === 17 &&
    parseFloat(agg?.statistics?.totalFeed) === 705,
  `mortality=${agg?.statistics?.totalMortality} feed=${agg?.statistics?.totalFeed}`,
);

// ===== حالت‌های مرزی تجمیع =====
check(
  "گله بدون هیچ دادهٔ ثبت‌شده → null (جدول اضافه رندر نمی‌شود)",
  buildFlockGroupAggregate({
    halls: [{ savedWeeks: [], total_chicks_count: 100 }],
  }) === null,
);
check(
  "گله با مجموع جوجه صفر → null (بدون تقسیم بر صفر)",
  buildFlockGroupAggregate({
    halls: [
      {
        savedWeeks: [
          {
            week_number: 1,
            weekly_mortality: 0,
            weekly_feed_intake: 0,
            weekly_weight: 0.2,
          },
        ],
        total_chicks_count: 0,
      },
    ],
  }) === null,
);
check(
  "سالن بدون وزن ثبت‌شده، میانگین وزنی گله را خراب نمی‌کند",
  (() => {
    const noWeightHall = buildHall({
      hallName: "سالن C",
      chicks: 100,
      initialWeight: 40,
      records: [
        {
          week_number: 1,
          weekly_weight: null,
          weekly_feed_intake: 20,
          weekly_mortality: 1,
          flock_age_days: 7,
        },
      ],
    });
    const mixed = buildFlockGroupAggregate({ halls: [hallA, noWeightHall] });
    return (
      Math.abs(mixed.savedWeeks[0].metrics.weight - 0.19) < 0.001 &&
      mixed.savedWeeks[0].metrics.birdsStartOfWeek === 1100
    );
  })(),
);

// ===== گروه‌بندی جوجه‌ریزی‌ها بر اساس گله =====
const groups = groupFlocksByFlock([hallA, hallB]);
check(
  "گروه‌بندی: یک گله با دو سالن",
  groups.length === 1 && groups[0].halls.length === 2,
  `groups=${groups.length}`,
);
check(
  "گروه‌بندی: مجموع جوجه گله = ۱۵۰۰ و نام سالن‌ها حفظ می‌شود",
  groups[0]?.total_chicks_count === 1500 &&
    groups[0]?.halls.map((h) => h.hall_name).join("+") === "سالن A+سالن B",
  `chicks=${groups[0]?.total_chicks_count}`,
);
check(
  "گروه‌بندی: جدول تجمعی برای گروه ساخته می‌شود",
  groups[0]?.aggregate?.savedWeeks?.length === 2,
);
check(
  "گروه‌بندی: گله‌های با flock_id متفاوت جدا می‌شوند",
  groupFlocksByFlock([
    { id: 1, flock_id: 1, flock_number: 5 },
    { id: 2, flock_id: 2, flock_number: 5 },
  ]).length === 2,
);


check(
  "ستون جمعیت ابتدای هفته: ۱۰۰۰ (هفتهٔ ۱) و ۹۹۰ (هفتهٔ ۲)",
  w1.birdsStartOfWeek === 1000 && w2.birdsStartOfWeek === 990,
  `${w1.birdsStartOfWeek} / ${w2.birdsStartOfWeek}`,
);

// ============================================================
//  کاتالوگ گروه‌های شاخص گزارش (weekly.report.groups.js)
//  کاربر پیش از تولید گزارش انتخاب می‌کند کدام گروه‌ها بیاید
// ============================================================

check(
  "انتخاب خالی → همهٔ گروه‌ها (پیش‌فرض = گزارش کامل)",
  normalizeGroups([]).length === ALL_GROUP_KEYS.length &&
    normalizeGroups([]).join(",") === ALL_GROUP_KEYS.join(","),
);
check(
  "انتخاب نامعتبر (null) → همهٔ گروه‌ها",
  normalizeGroups(null).length === ALL_GROUP_KEYS.length,
);
check(
  "کلید تکراری یک‌بار حساب می‌شود و کلید ناشناخته حذف می‌شود",
  normalizeGroups(["weight", "weight", "unknown"]).join(",") === "weight",
);
check(
  "ترتیب خروجی همیشه ترتیب کاتالوگ است (نه ترتیب کلیک کاربر)",
  normalizeGroups(["details", "population"]).join(",") ===
    "population,details",
);
check(
  "isGroupSelected با انتخاب خالی → همهٔ گروه‌ها فعال‌اند",
  isGroupSelected([], "growth") === true &&
    isGroupSelected(["growth"], "feed") === false,
);
check(
  "کلیدهای گروه یکتا و شامل ۵ گروه درخواستی کاربر هستند",
  new Set(ALL_GROUP_KEYS).size === 5 &&
    ALL_GROUP_KEYS.join(",") === "population,weight,growth,feed,details",
);

// ===== نگاشت ستون‌های جدول «شاخص‌های عملکردی هفتگی» =====
check(
  "۱۳ ستون شاخص تعریف شده (۱ ستون هفته + ۱۳ = جدول ۱۴ستونی)",
  METRICS_COLUMNS.length === 13,
);
check(
  "کلید ستون‌ها یکتاست",
  new Set(METRICS_COLUMNS.map((c) => c.key)).size === METRICS_COLUMNS.length,
);
check(
  "هر گروه (به‌جز «جزئیات» که جدول مستقل دارد) حداقل یک ستون دارد",
  REPORT_GROUPS.filter((g) => g.key !== "details").every((g) =>
    METRICS_COLUMNS.some((c) => c.group === g.key),
  ) === true,
);
check(
  "گروه جمعیت → ۵ ستون (جمعیت/زنده‌مانی/تلفات)",
  metricsColumnsFor(["population"]).length === 5,
);
check(
  "گروه وزن → ۳ ستون",
  metricsColumnsFor(["weight"])
    .map((c) => c.label)
    .join("|") === "وزن (kg)|وزن کل (kg)|افزایش وزن (kg)",
);
check(
  "گروه رشد → فقط ستون ADG",
  metricsColumnsFor(["growth"]).length === 1,
);
check(
  "گروه خوراک → ۴ ستون (دان کل، سرانه، سرانه روزانه، FCR)",
  metricsColumnsFor(["feed"]).length === 4,
);
check(
  "گروه جزئیات ستون جدول شاخص‌ها ندارد (جدول مستقل دارد)",
  metricsColumnsFor(["details"]).length === 0,
);
check(
  "انتخاب همهٔ گروه‌ها همان ۱۳ ستون قبلی را می‌دهد (سازگاری عقب‌رو)",
  metricsColumnsFor(ALL_GROUP_KEYS).length === METRICS_COLUMNS.length,
);
check(
  "مقدارگیر ستون‌ها از متریک هفته خوانده می‌شود (وزن هفتهٔ ۲ = ۰.۴۵)",
  METRICS_COLUMNS.find((c) => c.key === "weight").get(w2) === 0.45 &&
    METRICS_COLUMNS.find((c) => c.key === "mortality").get(w1) === 10,
);
check(
  "برچسب «همهٔ شاخص‌ها» برای انتخاب کامل و عنوان گروه برای انتخاب جزئی",
  selectedGroupsLabel(ALL_GROUP_KEYS) === "همهٔ شاخص‌ها" &&
    selectedGroupsLabel(["growth"]) === "🚀 رشد",
);

// ============================================================
//  حسابرسی هفته‌های ثبت‌نشده/ناقص (weekly.audit.js)
//  هفتهٔ بدون رکورد = missing · رکورد بدون وزن/خوراک = partial
// ============================================================

const auditSample = auditWeeks(
  [
    { week_number: 1, existsInDb: true, weekly_weight: 0.19, weekly_feed_intake: 190 },
    { week_number: 2, existsInDb: false },
    {
      week_number: 3,
      existsInDb: true,
      weekly_weight: 0.8,
      weekly_feed_intake: null,
      daily_feed_intake: null,
    },
    { week_number: 4, existsInDb: true, weekly_weight: null, weekly_feed_intake: 400 },
    { week_number: 5, existsInDb: true, weekly_weight: 1.4, daily_feed_intake: 210 },
  ],
  "سالن A",
);

check(
  "هفتهٔ بدون رکورد → missing (شماره‌ها به ترتیب)",
  auditSample.missing.join(",") === "2",
  `missing=${auditSample.missing.join(",")}`,
);
check(
  "رکورد بدون خوراک → partial",
  auditSample.statuses[3] === WEEK_STATUS.PARTIAL &&
    auditSample.fields[3].join("+") === "خوراک",
  `fields=${auditSample.fields[3]?.join("+")}`,
);
check(
  "رکورد بدون وزن → partial",
  auditSample.statuses[4] === WEEK_STATUS.PARTIAL &&
    auditSample.fields[4].join("+") === "وزن",
);
check(
  "خوراک روزانه به‌جای هفتگی → هفتهٔ کامل",
  auditSample.statuses[5] === WEEK_STATUS.COMPLETE,
);
check(
  "آمار حسابرسی: ۴ ثبت‌شده، ۲ کامل، ۱ بدون ثبت، ۲ ناقص",
  auditSample.recorded === 4 &&
    auditSample.complete === 2 &&
    auditSample.missing.length === 1 &&
    auditSample.partial.length === 2,
);
check(
  "hasIssues فقط وقتی گپ یا نقص وجود دارد",
  auditSample.hasIssues === true &&
    auditWeeks([
      {
        week_number: 1,
        existsInDb: true,
        weekly_weight: 0.2,
        weekly_feed_intake: 200,
      },
    ]).hasIssues === false,
);
check(
  "رکورد خام API (بدون فلگ existsInDb) = ثبت‌شده (بدون هشدار کاذب)",
  weekAuditStatus({ week_number: 1, weekly_weight: 0.2, weekly_feed_intake: 200 }) ===
    WEEK_STATUS.COMPLETE,
);
check(
  "متن خوانای لیست هفته‌ها: «۳، ۵ و ۷»",
  formatWeekList([3, 5, 7], (n) => n.toLocaleString("fa-IR")) === "۳، ۵ و ۷" &&
    formatWeekList([4], (n) => n.toLocaleString("fa-IR")) === "۴",
);

// ===== ادغام سالن‌ها در سطح «کل گله» =====
const mergedAudit = mergeAudits([
  auditWeeks(
    [
      { week_number: 1, existsInDb: true, weekly_weight: 0.2, weekly_feed_intake: 200 },
      { week_number: 2, existsInDb: true, weekly_weight: 0.5, weekly_feed_intake: 400 },
      { week_number: 3, existsInDb: false },
    ],
    "سالن A",
  ),
  auditWeeks(
    [
      { week_number: 1, existsInDb: true, weekly_weight: 0.2, weekly_feed_intake: 200 },
      { week_number: 2, existsInDb: false },
      { week_number: 3, existsInDb: false },
    ],
    "سالن B",
  ),
]);

check(
  "کل گله: هفتهٔ کامل در همهٔ سالن‌ها → complete",
  mergedAudit.statuses[1] === WEEK_STATUS.COMPLETE,
);
check(
  "کل گله: هفتهٔ ثبت‌نشده در یک سالن → partial (با نام سالن)",
  mergedAudit.statuses[2] === WEEK_STATUS.PARTIAL &&
    mergedAudit.byWeek[2].missing.includes("سالن B"),
  `byWeek2=${JSON.stringify(mergedAudit.byWeek[2])}`,
);
check(
  "کل گله: هفتهٔ بدون ثبت در هیچ سالنی → missing",
  mergedAudit.statuses[3] === WEEK_STATUS.MISSING &&
    mergedAudit.missing.join(",") === "3",
);
check(
  "آمار کل گله: نام هر دو سالن و فهرست هفته‌های مشکل‌دار",
  mergedAudit.halls.join("+") === "سالن A+سالن B" &&
    mergedAudit.partial.join(",") === "2" &&
    mergedAudit.hasIssues === true,
);

// ===== سقف «هفتهٔ مورد انتظار» (جلوگیری از هشدار کاذب) =====
check(
  "گلهٔ فعال: سقف هفته تا امروز (۲۲ روز از ۱ ژانویه = هفتهٔ ۴)",
  expectedWeekLimit({
    placementDate: "2026-01-01",
    isActive: true,
    savedWeeks: [{ week_number: 1 }],
    today: new Date("2026-01-22T00:00:00Z"),
  }) === 4,
);
check(
  "گلهٔ بسته با «تاریخ پایان دوره» معتبر: سقف تا پایان دوره (۱۵ روز = هفتهٔ ۳)",
  expectedWeekLimit({
    placementDate: "2026-01-01",
    placement: { placement_date: "2026-01-01" },
    flock: { placement_date: "2026-01-01", status: "completed", ended_at: "2026-01-15" },
    savedWeeks: [{ week_number: 2 }],
    isActive: false,
  }) === 3,
  `endWeek=${expectedWeekLimit({
    placementDate: "2026-01-01",
    flock: { placement_date: "2026-01-01", status: "completed", ended_at: "2026-01-15" },
    savedWeeks: [{ week_number: 2 }],
    isActive: false,
  })}`,
);
check(
  "❗ تنها «تاریخ ثبت پایان دوره در سیستم» → سقف = آخرین هفتهٔ ثبت‌شده (نه تا امروز)",
  expectedWeekLimit({
    placementDate: "2026-01-01",
    isActive: false,
    savedWeeks: [{ week_number: 2 }],
    completion: { completion_date: "2026-09-26" },
    today: new Date("2026-09-26T00:00:00Z"),
  }) === 2,
);
check(
  "گلهٔ بسته بدون تاریخ پایان: سقف = آخرین هفتهٔ ثبت‌شده (بدون هشدار کاذب)",
  expectedWeekLimit({
    placementDate: "2026-01-01",
    isActive: false,
    savedWeeks: [{ week_number: 5 }],
  }) === 5,
);
check(
  "بدون تاریخ جوجه‌ریزی و بدون رکورد → سقف صفر (گزارش بدون هشدار)",
  expectedWeekLimit({ isActive: false, savedWeeks: [] }) === 0,
);

// ============================================================
//  🐞 رفع باگ: مبنای «پایان دوره» گله‌های تکمیل‌شده
//  (قبلاً تاریخ «ثبت پایان دوره در سیستم» = معمولاً امروز مبنا بود
//   و همهٔ هفته‌ها تا امروز «بدون ثبت» علامت می‌خوردند)
// ============================================================

const completedFlock = {
  placement_date: "2026-01-01",
  status: "completed",
  ended_at: "2026-09-26", // تاریخ ثبت پایان دوره = امروز (بدون ارزش)
};
const saved3Weeks = [
  { week_number: 1 },
  { week_number: 2 },
  { week_number: 3 },
];

const tlSlaughterRange = resolveFlockTimelineEnd({
  flock: completedFlock,
  completion: {
    completion_date: "2026-09-26",
    slaughter_date: "2026-01-15",
    slaughter_end_date: "2026-01-22",
  },
  savedWeeks: saved3Weeks,
  today: new Date("2026-09-26T00:00:00Z"),
});
check(
  "گلهٔ تکمیل‌شده: مبنا = تاریخ پایان کشتار (نه تاریخ ثبت در سیستم)",
  tlSlaughterRange.source === TIMELINE_SOURCE.SLAUGHTER_END_DATE &&
    tlSlaughterRange.endWeek === 4,
  `source=${tlSlaughterRange.source} endWeek=${tlSlaughterRange.endWeek}`,
);
check(
  "متن مبنای پایان برای گزارش خوانا است",
  timelineBasisLabel(tlSlaughterRange).includes("تاریخ پایان کشتار"),
);

const tlSlaughterAge = resolveFlockTimelineEnd({
  flock: completedFlock,
  completion: { slaughter_age_days: 40 },
  savedWeeks: saved3Weeks,
  today: new Date("2026-09-26T00:00:00Z"),
});
check(
  "در نبود تاریخ کشتار، «سن کشتار» مبنا می‌شود (۴۰ روز = هفتهٔ ۶)",
  tlSlaughterAge.source === TIMELINE_SOURCE.SLAUGHTER_AGE &&
    tlSlaughterAge.endWeek === 6,
  `source=${tlSlaughterAge.source} endWeek=${tlSlaughterAge.endWeek}`,
);

const tlEndedAt = resolveFlockTimelineEnd({
  flock: completedFlock,
  completion: { completion_date: "2026-09-26" },
  savedWeeks: saved3Weeks,
  today: new Date("2026-09-26T00:00:00Z"),
});
check(
  "با ended_at: مبنا «تاریخ پایان گله» است و به آخرین هفته محدود نمی‌شود (هفتهٔ ۳۹)",
  tlEndedAt.source === TIMELINE_SOURCE.ENDED_AT && tlEndedAt.endWeek === 39,
  `source=${tlEndedAt.source} endWeek=${tlEndedAt.endWeek}`,
);

const tlCompletionOnly = resolveFlockTimelineEnd({
  flock: { placement_date: "2026-01-01", status: "completed" },
  completion: { completion_date: "2026-09-26" },
  savedWeeks: saved3Weeks,
  today: new Date("2026-09-26T00:00:00Z"),
});
check(
  "❗ بدون تاریخ کشتار/پایان گله: سقف = آخرین هفتهٔ ثبت‌شده (باگ «تا امروز» رفع شد)",
  tlCompletionOnly.source === TIMELINE_SOURCE.COMPLETION_DATE &&
    tlCompletionOnly.endWeek === 3 &&
    tlCompletionOnly.confidence === "low",
  `source=${tlCompletionOnly.source} endWeek=${tlCompletionOnly.endWeek}`,
);

const tlNoDates = resolveFlockTimelineEnd({
  flock: { placement_date: "2026-01-01", status: "completed" },
  savedWeeks: saved3Weeks,
  today: new Date("2026-09-26T00:00:00Z"),
});
check(
  "گلهٔ بسته بدون هیچ تاریخ پایان: فقط تا آخرین هفتهٔ ثبت‌شده",
  tlNoDates.source === TIMELINE_SOURCE.LAST_WEEK && tlNoDates.endWeek === 3,
);

const tlFuture = resolveFlockTimelineEnd({
  flock: { placement_date: "2026-01-01", status: "completed" },
  completion: { slaughter_date: "2026-12-31" },
  savedWeeks: saved3Weeks,
  today: new Date("2026-01-22T00:00:00Z"),
});
check(
  "هرگز از امروز جلوتر نمی‌رود (تاریخ کشتار آینده)",
  tlFuture.endWeek === 4,
  `endWeek=${tlFuture.endWeek}`,
);

const tlActive = resolveFlockTimelineEnd({
  placement: { placement_date: "2026-01-01", is_active: true },
  savedWeeks: saved3Weeks,
  today: new Date("2026-01-22T00:00:00Z"),
});
check(
  "گلهٔ در جریان: مبنای پایان = امروز (هفتهٔ ۴)",
  tlActive.isActive === true &&
    tlActive.source === TIMELINE_SOURCE.TODAY &&
    tlActive.endWeek === 4,
);

check(
  "شمارهٔ هفته از تاریخ (۱ ژانویه → ۱ و ۲۲ ژانویه → ۴)",
  weekNumberOfDate("2026-01-01", "2026-01-01") === 1 &&
    weekNumberOfDate("2026-01-01", "2026-01-22") === 4,
);

const scopedAudit = scopeAuditToWeeks(auditSample, [3, 4]);
check(
  "محدودکردن هشدار به هفته‌های انتخابی (missing بیرون انتخاب حذف می‌شود)",
  scopedAudit.total === 2 &&
    scopedAudit.missing.length === 0 &&
    scopedAudit.partial.join(",") === "3,4",
  `total=${scopedAudit.total} missing=${scopedAudit.missing.length}`,
);

// ============================================================
//  🎯 انتخاب هفته‌های گزارش (weekly.report.weeks.js)
//  مدل ترکیبی: انتخاب مشترک (قاعده) + تنظیم جداگانهٔ هر گله
// ============================================================

const timelineA = buildWeekTimeline([
  { week_number: 1, existsInDb: true, weekly_weight: 0.2, weekly_feed_intake: 200 },
  { week_number: 2, existsInDb: false },
  { week_number: 3, existsInDb: true, weekly_weight: 0.8, weekly_feed_intake: 380 },
  { week_number: 4, existsInDb: false },
]);
const timelineB = buildWeekTimeline([
  { week_number: 1, existsInDb: true, weekly_weight: 0.2, weekly_feed_intake: 200 },
  { week_number: 2, existsInDb: true, weekly_weight: 0.5, weekly_feed_intake: 400 },
  { week_number: 3, existsInDb: false },
  { week_number: 4, existsInDb: false },
]);
const timelines = { A: timelineA, B: timelineB };

check(
  "خط زمانی: وضعیت هر هفته (ثبت‌شده/بدون ثبت) به‌درستی تعیین می‌شود",
  timelineA.length === 4 &&
    timelineA[0].status === WEEK_STATUS.COMPLETE &&
    timelineA[1].status === WEEK_STATUS.MISSING,
  `statuses=${timelineA.map((w) => w.status).join(",")}`,
);

check(
  "پریست «همه» همهٔ هفته‌های همان گله را می‌دهد",
  resolvePresetWeeks(WEEK_PRESET.ALL, timelineA).join(",") === "1,2,3,4",
);
check(
  "پریست «فقط ثبت‌شده» هفتهٔ بدون ثبت را حذف می‌کند",
  resolvePresetWeeks(WEEK_PRESET.RECORDED, timelineA).join(",") === "1,3",
);
check(
  "پریست «مشکل‌دار» فقط هفته‌های بدون ثبت/ناقص را می‌دهد",
  resolvePresetWeeks(WEEK_PRESET.ISSUES, timelineA).join(",") === "2,4",
);
check(
  "پریست «بازهٔ دلخواه» بین از/تا فیلتر می‌کند",
  resolvePresetWeeks(WEEK_PRESET.RANGE, timelineA, { from: 2, to: 3 }).join(",") ===
    "2,3" &&
    resolvePresetWeeks(WEEK_PRESET.RANGE, timelineA, { from: 3 }).join(",") === "3,4",
);

// پیش‌فرض (بدون انتخاب) = همهٔ هفته‌ها (سازگاری عقب‌رو)
check(
  "انتخاب نامعتبر/خالی → همهٔ هفته‌های همان گله (رفتار قبلی گزارش)",
  normalizeWeekSelection(null).shared === null &&
    effectiveWeeksFor(null, "A", timelineA).join(",") === "1,2,3,4",
);

// انتخاب مشترک «قاعده‌ای»: هر گله بر اساس هفته‌های خودش حل می‌شود
const sharedIssues = normalizeWeekSelection({
  shared: { preset: WEEK_PRESET.ISSUES },
});
check(
  "قاعدهٔ مشترک روی هر گله جداگانه حل می‌شود (مشکل‌دارهای هر گله)",
  effectiveWeeksFor(sharedIssues, "A", timelineA).join(",") === "2,4" &&
    effectiveWeeksFor(sharedIssues, "B", timelineB).join(",") === "3,4",
);

// تنظیم جداگانهٔ یک گله (override)
const mixed = normalizeWeekSelection({
  shared: { preset: WEEK_PRESET.ISSUES },
  overrides: { A: [1, 3] },
});
check(
  "تنظیم سفارشی یک گله فقط همان گله را تغییر می‌دهد",
  effectiveWeeksFor(mixed, "A", timelineA).join(",") === "1,3" &&
    effectiveWeeksFor(mixed, "B", timelineB).join(",") === "3,4",
);
check(
  "هفته‌ای که در گله وجود ندارد، در انتخاب سفارشی نادیده گرفته می‌شود",
  effectiveWeeksFor(normalizeWeekSelection({ overrides: { B: [1, 2, 9] } }), "B", timelineB).join(
    ",",
  ) === "1,2",
);
check(
  "انتخاب خالی برای یک گله → آن گله از گزارش حذف می‌شود",
  effectiveWeeksFor(normalizeWeekSelection({ overrides: { B: [] } }), "B", timelineB)
    .length === 0,
);

check(
  "اجتماع انتخاب سالن‌ها برای جدول «کل گله»",
  unionWeekSelection(
    normalizeWeekSelection({ overrides: { A: [1], B: [2] } }),
    ["A", "B"],
    timelines,
  ).join(",") === "1,2",
);

const mergedTimeline = mergeWeekTimelines([timelineA, timelineB]);
check(
  "ادغام خط زمانی سالن‌ها: هر دو کامل → complete · یک سالن → partial · هیچ‌کدام → missing",
  mergedTimeline.length === 4 &&
    mergedTimeline[0].status === WEEK_STATUS.COMPLETE &&
    mergedTimeline[1].status === WEEK_STATUS.PARTIAL &&
    mergedTimeline[3].status === WEEK_STATUS.MISSING,
  `statuses=${mergedTimeline.map((w) => w.status).join(",")}`,
);

check(
  "هفته‌های مشکل‌دار خارج از انتخاب شناسایی می‌شوند",
  issuesOutsideSelection(
    normalizeWeekSelection({ overrides: { A: [1] } }),
    "A",
    timelineA,
  ).join(",") === "2,4",
);

const summary = summarizeWeekSelection(
  normalizeWeekSelection({ shared: { preset: WEEK_PRESET.ALL }, overrides: { B: [] } }),
  timelines,
);
check(
  "خلاصهٔ انتخاب: شمارش هفته‌ها، گله‌های حذف‌شده و گله‌های سفارشی",
  summary.weeks === 4 &&
    summary.flocks === 1 &&
    summary.excluded === 1 &&
    summary.overridden === 1 &&
    summary.missing === 2,
  `weeks=${summary.weeks} flocks=${summary.flocks} excluded=${summary.excluded}`,
);

const faNum = (n) => n.toLocaleString("fa-IR");
check(
  "متن محدودهٔ انتخاب: بازهٔ پیوسته «۳ تا ۶» و لیست غیرپیوسته",
  weekSelectionLabel([3, 4, 5, 6], [1, 2, 3, 4, 5, 6, 7], faNum).includes("۳ تا ۶") &&
    weekSelectionLabel([1, 4, 6], [1, 2, 3, 4, 5, 6, 7], faNum).includes("۱، ۴، ۶") &&
    weekSelectionLabel([1, 2], [1, 2], faNum) === "همهٔ ۲ هفته",
);
check(
  "حل قاعدهٔ خام (آرایه/قاعده/خالی)",
  resolveWeekRule(null, timelineA).join(",") === "1,2,3,4" &&
    resolveWeekRule([2], timelineA).join(",") === "2" &&
    resolveWeekRule({ preset: WEEK_PRESET.RECORDED }, timelineA).join(",") === "1,3",
);

// ============================================================
//  🔤 ترتیب ثابت سالن‌ها در گزارش‌ها: از A به آخر (ترتیب طبیعی)
// ============================================================
check(
  "ترتیب لاتین: «سالن A» < «سالن B» < «سالن C»",
  compareHallNames("سالن A", "سالن B") < 0 &&
    compareHallNames("سالن C", "سالن B") > 0,
);
check(
  "حساس‌نبودن به بزرگی/کوچکی حروف: «سالن a» قبل از «سالن B»",
  compareHallNames("سالن a", "سالن B") < 0,
);
check(
  "اعداد به‌صورت عددی: «سالن ۲» قبل از «سالن ۱۰» (نه ترتیب متنی)",
  compareHallNames("سالن ۲", "سالن ۱۰") < 0 &&
    compareHallNames("سالن 10", "سالن 2") > 0,
);
check(
  "حروف لاتین قبل از فارسی و عدد: A < ب < ۱",
  compareHallNames("سالن A", "سالن ب") < 0 &&
    compareHallNames("سالن ب", "سالن ۱") < 0,
);
check(
  "نام کوتاه‌تر جلوتر می‌آید: «سالن A» قبل از «سالن AA»",
  compareHallNames("سالن A", "سالن AA") < 0,
);
check(
  "نام خالی/بدون نام → آخر فهرست",
  compareHallNames("", "سالن A") > 0 &&
    compareHallNames("سالن A", "") < 0 &&
    compareHallNames("", "") === 0,
);
check(
  "نام‌های هم‌ارز → ۰ (ترتیب پایدار حفظ می‌شود)",
  compareHallNames("سالن A", "سالن A") === 0,
);
check(
  "sortHallNames فهرست به‌هم‌ریخته را A→Z می‌کند",
  sortHallNames([
    "سالن C",
    "سالن ۱۰",
    "سالن A",
    "سالن ۲",
    "سالن B",
  ]).join(",") === "سالن A,سالن B,سالن C,سالن ۲,سالن ۱۰",
);
check(
  "hallNameOf نام سالن را از ساختارهای مختلف می‌خواند",
  hallNameOf({ hall_name: "سالن A" }) === "سالن A" &&
    hallNameOf({ hall: { hall_name: "سالن B" } }) === "سالن B" &&
    hallNameOf({ hallName: "سالن C" }) === "سالن C",
);
check(
  "sortFlocksByHall ورودی معکوس را مرتب می‌کند",
  sortFlocksByHall([
    { hall_name: "سالن C" },
    { hall_name: "سالن A" },
    { hall_name: "سالن B" },
  ])
    .map((h) => h.hall_name)
    .join("+") === "سالن A+سالن B+سالن C",
);
check(
  "گروه‌بندی گله: سالن‌ها همیشه A→Z مرتب می‌شوند (حتی با ورودی معکوس)",
  groupFlocksByFlock([
    { id: 1, flock_id: 9, hall_name: "سالن C" },
    { id: 2, flock_id: 9, hall_name: "سالن A" },
    { id: 3, flock_id: 9, hall_name: "سالن B" },
  ])[0].halls
    .map((h) => h.hall_name)
    .join("+") === "سالن A+سالن B+سالن C",
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
