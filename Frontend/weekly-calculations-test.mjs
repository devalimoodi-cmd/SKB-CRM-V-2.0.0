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
} from "./src/features/customer-info/sections/weekly/weekly.aggregation.js";

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

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
