// ============================================================
//  تست محاسبات خالص «پایان دوره گله» (بدون سرور و بدون دیتابیس)
//  اجرا:  npm run test:flock-calc      (در پوشهٔ Backend)
// ------------------------------------------------------------
//  این تست روی services/flockCompletionCalc.js کار می‌کند؛ همان
//  توابعی که قبلاً داخل controllers/flockCompletionController.js
//  تعریف شده بودند و اکنون تنها منبع محاسبات پایان دوره‌اند.
//  پوشش: شاخص‌های سیستمی، ریز سالن، تجمیع سرگله و محاسبهٔ
//  سن/تاریخ کشتار در سه روش range / direct / weighted.
// ============================================================
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  calculateSystemData,
  buildHallDetail,
  aggregateHallDetails,
  toIsoDate,
  addDaysToIso,
  ageDaysBetween,
  SLAUGHTER_METHODS,
  computeSlaughterFields,
} = require("./services/flockCompletionCalc.js");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

// ===== دادهٔ نمونه: گلهٔ ۱۰۰۰ قطعه‌ای با دو هفته ثبت‌شده =====
const weeks = [
  {
    week_number: 2,
    weekly_feed_intake: "420",
    weekly_mortality: "5",
    weekly_weight: "0.45",
    flock_age_days: 14,
  },
  {
    week_number: 1,
    weekly_feed_intake: "190",
    weekly_mortality: "10",
    weekly_weight: "0.19",
    flock_age_days: 7,
  },
];

// ============================================================
// ۱) calculateSystemData
// ============================================================
const sys = calculateSystemData(weeks, 1000);
check(
  "شاخص‌های سیستمی: کل خوراک دو هفته = ۶۱۰ کیلوگرم",
  sys.system_total_feed === 610,
  `feed=${sys.system_total_feed}`,
);
check(
  "شاخص‌های سیستمی: تلفات کل = ۱۵ و قطعات نهایی = ۹۸۵",
  sys.total_mortality === 15 && sys.final_chicks_count === 985,
  `mortality=${sys.total_mortality} final=${sys.final_chicks_count}`,
);
check(
  "شاخص‌های سیستمی: آخرین وزن = ۰٫۴۵ و هفته/سن نهایی = ۲ / ۱۴ روز",
  sys.system_last_weight === 0.45 &&
    sys.final_avg_weight === 0.45 &&
    sys.final_week_number === 2 &&
    sys.slaughter_age_days === 14,
  `weight=${sys.system_last_weight} week=${sys.final_week_number} age=${sys.slaughter_age_days}`,
);
check(
  "شاخص‌های سیستمی: ضریب تبدیل = خوراک ÷ آخرین وزن = ۱۳۵۵٫۵۶",
  sys.system_fcr === 1355.56,
  `fcr=${sys.system_fcr}`,
);
check(
  "شاخص‌های سیستمی: ترتیب هفته‌های به‌هم‌ریخته اثری بر نتیجه ندارد",
  sys.system_total_feed === calculateSystemData([...weeks].reverse(), 1000).system_total_feed,
);
check(
  "شاخص‌های سیستمی: بدون وزن معتبر → fcr و وزن نهایی null و هفتهٔ نهایی ۱",
  (() => {
    const s = calculateSystemData([], 100);
    return (
      s.system_fcr === null &&
      s.system_last_weight === null &&
      s.final_avg_weight === null &&
      s.final_week_number === 1 &&
      s.slaughter_age_days === null &&
      s.final_chicks_count === 100 &&
      s.system_total_feed === 0
    );
  })(),
);
check(
  "شاخص‌های سیستمی: تلفات بیش از قطعات اولیه → قطعات نهایی صفر (نه منفی)",
  calculateSystemData([{ week_number: 1, weekly_mortality: 1200 }], 1000)
    .final_chicks_count === 0,
);

// ============================================================
// ۲) buildHallDetail
// ============================================================
const placement = {
  id: 7,
  hall_id: 3,
  flock_id: 9,
  customer_id: 5,
  unit_id: null,
  total_chicks_count: 1000,
};
const detail = buildHallDetail(placement, weeks);
check(
  "ریز سالن: شناسه‌ها و قطعات از جوجه‌ریزی خوانده می‌شوند",
  detail.chick_placement_id === 7 &&
    detail.hall_id === 3 &&
    detail.flock_id === 9 &&
    detail.customer_id === 5 &&
    detail.initial_chicks_count === 1000 &&
    detail.final_chicks_count === 985,
);
check(
  "ریز سالن: درصد تلفات = تلفات ÷ قطعات اولیه × ۱۰۰ = ۱٫۵",
  detail.mortality_rate === 1.5,
  `rate=${detail.mortality_rate}`,
);
check(
  "ریز سالن: وزن ابتدایی پیش‌فرض ۰٫۰۴ گرم‌ِ سازگار با ثبت‌های قبلی",
  detail.initial_avg_weight === 0.04,
);
check(
  "ریز سالن: بدون قطعهٔ اولیه → درصد تلفات صفر (بدون تقسیم بر صفر)",
  buildHallDetail({ id: 1, total_chicks_count: 0 }, []).mortality_rate === 0,
);

// ============================================================
// ۳) aggregateHallDetails
// ============================================================
const details = [
  detail,
  {
    initial_chicks_count: 500,
    final_chicks_count: 480,
    total_mortality: 20,
    total_feed_intake: 300,
    final_week_number: 2,
    slaughter_age_days: 14,
    final_avg_weight: 2,
    initial_avg_weight: 0.04,
  },
];
const agg = aggregateHallDetails(details);
check(
  "تجمیع سرگله: جمع قطعات/تلفات/خوراک = ۱۵۰۰ / ۳۵ / ۹۱۰",
  agg.initial_chicks_count === 1500 &&
    agg.final_chicks_count === 1465 &&
    agg.total_mortality === 35 &&
    agg.total_feed_intake === 910,
  `init=${agg.initial_chicks_count} final=${agg.final_chicks_count} feed=${agg.total_feed_intake}`,
);
check(
  "تجمیع سرگله: درصد تلفات = ۲٫۳۳",
  agg.mortality_rate === 2.33,
  `rate=${agg.mortality_rate}`,
);
check(
  "تجمیع سرگله: وزن نهایی «میانگین وزنی بر قطعات باقی‌مانده» = ۰٫۹۶",
  agg.final_avg_weight === 0.96 && agg.system_last_weight === 0.96,
  `weight=${agg.final_avg_weight}`,
);
check(
  "تجمیع سرگله: وزن ابتدایی وزنی = ۰٫۰۴ (سه رقم اعشار)",
  agg.initial_avg_weight === 0.04,
  `initial=${agg.initial_avg_weight}`,
);
check(
  "تجمیع سرگله: ضریب تبدیل گله = خوراک ÷ (وزن نهایی × قطعات) = ۰٫۶۵",
  agg.system_fcr === 0.65,
  `fcr=${agg.system_fcr}`,
);
check(
  "تجمیع سرگله: بیشترین هفته و بیشترین سن کشتار بین سالن‌ها",
  agg.final_week_number === 2 && agg.slaughter_age_days === 14,
);
check(
  "تجمیع سرگله: بدون قطعهٔ باقی‌مانده → وزن‌ها و fcr نامعلوم (null)",
  (() => {
    const a = aggregateHallDetails([
      { final_chicks_count: 0, initial_chicks_count: 0, final_avg_weight: 0 },
    ]);
    return (
      a.final_avg_weight === null &&
      a.system_last_weight === null &&
      a.system_fcr === null &&
      a.mortality_rate === 0
    );
  })(),
);

// ============================================================
// ۴) ابزارهای تاریخ (toIsoDate / addDaysToIso / ageDaysBetween)
// ============================================================
check(
  "toIsoDate: ISO کامل → فقط بخش تاریخ",
  toIsoDate("2024-01-29T10:30:00.000Z") === "2024-01-29",
);
check(
  "toIsoDate: قالب ۲۰۲۴/۱/۹ → 2024-01-09 (صفر پیشوندی)",
  toIsoDate("2024/1/9") === "2024-01-09",
  toIsoDate("2024/1/9"),
);
check(
  "toIsoDate: خالی/نامعتبر → null",
  toIsoDate("") === null &&
    toIsoDate(null) === null &&
    toIsoDate("29/01/2024") === null,
);
check(
  "addDaysToIso: گذر از ماه (۱۱ بهمن → ۲۱ بهمن) و سال کبیسه",
  addDaysToIso("2024-01-30", 10) === "2024-02-09" &&
    addDaysToIso("2024-02-28", 2) === "2024-03-01",
  `${addDaysToIso("2024-01-30", 10)} / ${addDaysToIso("2024-02-28", 2)}`,
);
check("addDaysToIso: ورودی نامعتبر → null", addDaysToIso("bad-date", 3) === null);
check(
  "ageDaysBetween: مبنا = اختلاف تاریخ با جوجه‌ریزی + ۱ روز",
  ageDaysBetween("2024-01-10", "2024-01-10") === 1 &&
    ageDaysBetween("2024-01-10", "2024-01-29") === 20 &&
    ageDaysBetween("2024-01-10", "2024-02-08") === 30,
  `same=${ageDaysBetween("2024-01-10", "2024-01-10")} d20=${ageDaysBetween("2024-01-10", "2024-01-29")}`,
);
check(
  "ageDaysBetween: تاریخ قبل از جوجه‌ریزی یا ورودی ناقص → null",
  ageDaysBetween("2024-01-10", "2024-01-05") === null &&
    ageDaysBetween(null, "2024-01-05") === null,
);
check(
  "SLAUGHTER_METHODS: فقط سه روش مجاز range/direct/weighted",
  SLAUGHTER_METHODS instanceof Set &&
    SLAUGHTER_METHODS.size === 3 &&
    SLAUGHTER_METHODS.has("range") &&
    SLAUGHTER_METHODS.has("direct") &&
    SLAUGHTER_METHODS.has("weighted"),
);

// ============================================================
// ۵) computeSlaughterFields — روش «بازهٔ تاریخی» (range)
// ============================================================
const rangeOut = computeSlaughterFields(
  {
    slaughter_age_method: "range",
    slaughter_date: "2024-01-29",
    slaughter_end_date: "2024-02-08",
  },
  "2024-01-10",
  {},
);
check(
  "روش بازه: سن نهایی = میانگین دو سر بازه (۲۰ و ۳۰ → ۲۵ روز)",
  rangeOut.slaughter_age_days === 25 && rangeOut.slaughter_age_end_days === 30,
  `age=${rangeOut.slaughter_age_days} end=${rangeOut.slaughter_age_end_days}`,
);
check(
  "روش بازه: تاریخ‌ها دست‌نخورده و بدون ارسال چندمرحله‌ای",
  rangeOut.slaughter_date === "2024-01-29" &&
    rangeOut.slaughter_end_date === "2024-02-08" &&
    rangeOut.slaughter_shipments === null &&
    rangeOut.slaughter_age_method === "range",
);
check(
  "روش بازه: فقط یک تاریخ (بدون پایان) → سن همان تاریخ شروع",
  (() => {
    const out = computeSlaughterFields(
      { slaughter_age_method: "range", slaughter_date: "2024-01-29" },
      "2024-01-10",
      {},
    );
    return out.slaughter_age_days === 20 && out.slaughter_age_end_days === 20;
  })(),
);
check(
  "روش بازه: بدون تاریخ معتبر → سن از fallback سن",
  (() => {
    const out = computeSlaughterFields(
      { slaughter_age_method: "range", slaughter_date: "" },
      "2024-01-10",
      { age: 33 },
    );
    return out.slaughter_age_days === 33 && out.slaughter_end_date === null;
  })(),
);

// ============================================================
// ۶) computeSlaughterFields — روش «ورود مستقیم سن» (direct)
// ============================================================
const directOut = computeSlaughterFields(
  { slaughter_age_method: "direct", slaughter_age_days: "45" },
  "2024-01-10",
  {},
);
check(
  "روش مستقیم: سن ورودی = سن نهایی",
  directOut.slaughter_age_days === 45 && directOut.slaughter_age_method === "direct",
  `age=${directOut.slaughter_age_days}`,
);
check(
  "روش مستقیم: تاریخ کشتار = جوجه‌ریزی + (سن − ۱) روز → ۲۰۲۴-۰۲-۲۳",
  directOut.slaughter_date === "2024-02-23",
  `date=${directOut.slaughter_date}`,
);
check(
  "روش مستقیم: تاریخ پایان و ارسال‌ها پاک می‌شوند",
  directOut.slaughter_end_date === null && directOut.slaughter_shipments === null,
);
check(
  "روش مستقیم: سن خالی/صفر → سن از fallback سن",
  (() => {
    const out = computeSlaughterFields(
      { slaughter_age_method: "direct", slaughter_age_days: "0" },
      "2024-01-10",
      { age: 28 },
    );
    return out.slaughter_age_days === 28;
  })(),
);

// ============================================================
// ۷) computeSlaughterFields — روش «ارسال چندمرحله‌ای» (weighted)
// ============================================================
const weightedOut = computeSlaughterFields(
  {
    slaughter_age_method: "weighted",
    slaughter_shipments: [
      { age_days: "30", quantity: "100", date: "2024-02-01" },
      { age_days: "40", quantity: "300", date: "" },
      { age_days: "0", quantity: "50", date: "2024-02-02" },
      { age_days: "12", quantity: "0", date: "2024-02-03" },
    ],
  },
  "2024-01-10",
  {},
);
check(
  "روش چندمرحله‌ای: میانگین وزنی = (۳۰×۱۰۰ + ۴۰×۳۰۰) ÷ ۴۰۰ = ۳۸ روز",
  weightedOut.slaughter_age_days === 38,
  `age=${weightedOut.slaughter_age_days}`,
);
check(
  "روش چندمرحله‌ای: ردیف‌های بی‌اعتبار (سن/تعداد صفر) حذف می‌شوند",
  Array.isArray(weightedOut.slaughter_shipments) &&
    weightedOut.slaughter_shipments.length === 2,
  `rows=${weightedOut.slaughter_shipments?.length}`,
);
check(
  "روش چندمرحله‌ای: تاریخ ردیف بدون تاریخ از جوجه‌ریزی محاسبه می‌شود",
  weightedOut.slaughter_shipments[1].date === "2024-02-18",
  `derived=${weightedOut.slaughter_shipments[1].date}`,
);
check(
  "روش چندمرحله‌ای: تاریخ کشتار = کوچک‌ترین و تاریخ پایان = بزرگ‌ترین ارسال",
  weightedOut.slaughter_date === "2024-02-01" &&
    weightedOut.slaughter_end_date === "2024-02-18",
  `${weightedOut.slaughter_date} → ${weightedOut.slaughter_end_date}`,
);
check(
  "روش چندمرحله‌ای: یک ارسال → بدون تاریخ پایان (همان روز)",
  (() => {
    const out = computeSlaughterFields(
      {
        slaughter_age_method: "weighted",
        slaughter_shipments: [{ age_days: 35, quantity: 200, date: "2024-02-04" }],
      },
      "2024-01-10",
      {},
    );
    return (
      out.slaughter_age_days === 35 &&
      out.slaughter_date === "2024-02-04" &&
      out.slaughter_end_date === null
    );
  })(),
);
check(
  "روش چندمرحله‌ای: بدون ردیف معتبر → سن از fallback و بدون تاریخ",
  (() => {
    const out = computeSlaughterFields(
      { slaughter_age_method: "weighted", slaughter_shipments: [] },
      "2024-01-10",
      { age: 41 },
    );
    return (
      out.slaughter_age_days === 41 &&
      out.slaughter_date === null &&
      out.slaughter_end_date === null &&
      out.slaughter_shipments === null
    );
  })(),
);

// ============================================================
// ۸) computeSlaughterFields — رکوردهای قدیمی (بدون روش)
// ============================================================
const legacyOut = computeSlaughterFields(
  { slaughter_date: "2024-01-29", slaughter_end_date: "2024-02-08" },
  "2024-01-10",
  {},
);
check(
  "رکورد قدیمی: سن از تاریخ‌ها محاسبه می‌شود (۲۰ و ۳۰ روز)",
  legacyOut.slaughter_age_days === 20 && legacyOut.slaughter_age_end_days === 30,
  `age=${legacyOut.slaughter_age_days} end=${legacyOut.slaughter_age_end_days}`,
);
check(
  "رکورد قدیمی: سن صریح کارفرما جایگزین محاسبه نمی‌شود",
  (() => {
    const out = computeSlaughterFields(
      {
        slaughter_date: "2024-01-29",
        slaughter_end_date: "2024-02-08",
        slaughter_age_days: 22,
        slaughter_age_end_days: 32,
      },
      "2024-01-10",
      {},
    );
    return out.slaughter_age_days === 22 && out.slaughter_age_end_days === 32;
  })(),
);
check(
  "روش نامعتبر (چیز دیگری) مثل «بدون روش» رفتار می‌کند",
  (() => {
    const out = computeSlaughterFields(
      { slaughter_age_method: "unknown", slaughter_date: "2024-01-29" },
      "2024-01-10",
      {},
    );
    return out.slaughter_age_method === null && out.slaughter_age_days === 20;
  })(),
);
check(
  "بدون جوجه‌ریزی: ورودی‌ها بدون خطا و بدون محاسبهٔ سن برگردانده می‌شوند",
  (() => {
    const out = computeSlaughterFields(
      { slaughter_date: "2024-01-29", slaughter_age_days: 11 },
      null,
      {},
    );
    return out.slaughter_age_days === 11 && out.slaughter_date === "2024-01-29";
  })(),
);

const failed = results.filter((x) => !x).length;
console.log(failed === 0 ? "\n✅ ALL PASS" : `\n❌ ${failed} FAILED`);
process.exitCode = failed === 0 ? 0 : 1;
