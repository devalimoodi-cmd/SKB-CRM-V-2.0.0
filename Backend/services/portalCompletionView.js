// ============================================================
// services/portalCompletionView.js
// «پایان دوره» و «گزارش نهایی دوره» — نمای مشتری (موج ۱۳.۱۹)
// ------------------------------------------------------------
//  چرا فایل جدا و **خالص**؟
//   • گارد تست (`portal-completion-test.mjs`) همین فایل را در Node
//     اجرا می‌کند: فهرست سفید، عددسازی، تجمیع سالن‌ها و متن هشدارها
//     باید بدون دیتابیس قابل سنجش باشند (هم‌الگو با flockMetrics).
//   • «فهرست سفید» یک قرارداد امنیتی است: هر ستونی که این‌جا نباشد،
//     از مسیر پورتال بیرون نمی‌رود.
//
//  🔒 قواعد سخت (تغییرناپذیر):
//   ۱) خروجی همیشه از LIST_KEYS / DETAIL_KEYS ساخته می‌شود؛ هیچ کلید
//      ناشناخته‌ای از ردیف DB کپی نمی‌شود (pick فقط کلید سفید می‌خواند).
//   ۲) **اقتصاد گله هرگز بیرون نمی‌رود**: price_per_kg، income_total،
//      chick_cost، feed_cost، medication_cost، fuel_cost، labor_cost،
//      other_cost، total_cost، net_profit، profit_percent ⇒ این فیلدها
//      در هیچ فهرستی نیستند. تصمیم مالی با کارشناس است، نه با
//      شمارنده‌های پورتال.
//   ۳) completed_by (کاربر کارشناس) و notes (یادداشت داخلی) هم بیرون
//      نمی‌روند — همان قاعدهٔ «گزارش بازدید» در ۱۳.۴.
//   ۴) customer_id هرگز در خروجی نیست (اسکوپ با توکن سنجیده شده).
//   ۵) همهٔ محاسبه‌ها از services/flockMetrics.js می‌آید؛ این فایل
//      هیچ فرمول دومی برای FCR/تلفات/وزن نمی‌سازد.
// ============================================================
"use strict";

const {
  summarizeWeeks,
  aggregateFlock,
  buildFlockTrend,
  round,
  toNumber,
  toInt,
} = require("./flockMetrics");

// ✅ ۱۳.۱۸: فهرست «هرگزها» یک‌جا در config/portalSchema است (نه دو نسخه)
const { FORBIDDEN_FIELDS } = require("../config/portalSchema");

// ============================================================
// ۱) انواع پایان دوره (برچسب یکتا برای UI)
// ============================================================
const COMPLETION_TYPES = [
  { key: "completed", label: "پایان عادی", tone: "ok" },
  { key: "culled", label: "حذف گله", tone: "warn" },
  { key: "emergency", label: "پایان اضطراری", tone: "danger" },
];

const TYPE_LABELS = COMPLETION_TYPES.reduce((map, item) => {
  map[item.key] = item.label;
  return map;
}, {});

const typeLabelOf = (type) => {
  const key = String(type ?? "").trim().toLowerCase();
  if (!key) return "";
  return TYPE_LABELS[key] || key;
};

// ============================================================
// ۲) فهرست سفید ستون‌ها
// ------------------------------------------------------------
//  ⚠️ DB_ATTRIBUTES همان چیزی است که سرویس از Sequelize می‌خواند؛
//     LIST/DETAIL کلیدهای خروجی HTTP هستند. تفاوت‌شان عمدی است:
//     notes/completed_by/اقتصاد حتی از DB خوانده هم نمی‌شوند.
// ============================================================
const DB_ATTRIBUTES = [
  "id",
  "flock_id",
  "unit_id",
  "hall_id",
  "completion_date",
  "completion_type",
  "confirmed_by_customer",
  "initial_chicks_count",
  "final_chicks_count",
  "initial_avg_weight",
  "slaughter_age_days",
  "slaughter_age_end_days",
  "slaughter_age_method",
  "slaughter_date",
  "slaughter_end_date",
  "slaughterhouse_name",
  "transport_mortality",
  "total_sent",
  "total_live_weight",
  "avg_live_weight",
  "final_week_number",
  "total_feed_intake",
  "final_avg_weight",
  "total_mortality",
  "mortality_rate",
  "final_fcr",
  "feed_basis",
  "epi",
  "adg_grams",
  "total_weight_gain_kg",
  "survival_percent",
  "system_fcr",
  "system_survival_percent",
];

// کلیدهای «فهرست» (کارت‌های پنل پایان دوره)
const LIST_KEYS = [
  "id",
  "flock_id",
  "unit_id",
  "hall_id",
  "completion_date",
  "completion_type",
  "completion_type_label",
  "confirmed_by_customer",
  "initial_chicks_count",
  "final_chicks_count",
  "slaughter_date",
  "slaughter_age_days",
  "total_feed_intake",
  "final_avg_weight",
  "total_mortality",
  "mortality_rate",
  "survival_percent",
  "final_fcr",
  "epi",
  "adg_grams",
  "total_weight_gain_kg",
  "feed_basis",
];

// کلیدهای «جزئیات» (گزارش نهایی) = فهرست + اطلاعات کشتار/مبنای سیستمی
const DETAIL_EXTRA_KEYS = [
  "slaughter_age_end_days",
  "slaughter_age_method",
  "slaughter_end_date",
  "slaughterhouse_name",
  "transport_mortality",
  "total_sent",
  "total_live_weight",
  "avg_live_weight",
  "final_week_number",
  "system_fcr",
  "system_survival_percent",
];

const DETAIL_KEYS = [...LIST_KEYS, ...DETAIL_EXTRA_KEYS];

// ستون‌های ریز هر سالن (flock_completion_halls)
const HALL_DB_ATTRIBUTES = [
  "id",
  "chick_placement_id",
  "hall_id",
  "initial_chicks_count",
  "final_chicks_count",
  "slaughter_age_days",
  "final_week_number",
  "total_feed_intake",
  "final_avg_weight",
  "total_mortality",
  "mortality_rate",
  "system_fcr",
  "sent_to_slaughter_count",
  "live_weight_kg",
];

// ستون‌های هفته‌ای که موتور روند لازم دارد (نه بیشتر)
const WEEK_ATTRIBUTES = [
  "id",
  "chick_placement_id",
  "week_number",
  "week_start_date",
  "week_end_date",
  "flock_age_days",
  "weekly_feed_intake",
  "weekly_weight",
  "weekly_mortality",
];

// ============================================================
// ۳) تعریف شاخص‌ها (برچسب/یکا از سرور ⇒ UI فهرست دومی ندارد)
// ============================================================
const METRICS = [
  { key: "initial_chicks_count", label: "جوجه‌ریزی اولیه", unit: "قطعه", kind: "int" },
  { key: "final_chicks_count", label: "جوجهٔ نهایی", unit: "قطعه", kind: "int" },
  { key: "survival_percent", label: "درصد زنده‌مانی", unit: "٪", kind: "decimal", digits: 2 },
  { key: "final_fcr", label: "ضریب تبدیل نهایی", unit: "", kind: "decimal", digits: 3 },
  { key: "final_avg_weight", label: "میانگین وزن نهایی", unit: "کیلوگرم", kind: "decimal", digits: 3 },
  { key: "total_feed_intake", label: "خوراک مصرفی کل", unit: "کیلوگرم", kind: "decimal", digits: 2 },
  { key: "adg_grams", label: "رشد روزانه (ADG)", unit: "گرم/روز", kind: "decimal", digits: 2 },
  { key: "epi", label: "شاخص اروپایی (EPI)", unit: "", kind: "decimal", digits: 2 },
  { key: "slaughter_age_days", label: "سن کشتار", unit: "روز", kind: "int" },
];

const HALL_METRICS = [
  { key: "initial_chicks_count", label: "جوجه‌ریزی", unit: "قطعه", kind: "int" },
  { key: "final_chicks_count", label: "مانده", unit: "قطعه", kind: "int" },
  { key: "total_mortality", label: "تلفات", unit: "قطعه", kind: "int" },
  { key: "mortality_rate", label: "تلفات", unit: "٪", kind: "decimal", digits: 2 },
  { key: "final_avg_weight", label: "وزن نهایی", unit: "کیلوگرم", kind: "decimal", digits: 3 },
  { key: "total_feed_intake", label: "خوراک", unit: "کیلوگرم", kind: "decimal", digits: 2 },
  { key: "system_fcr", label: "FCR", unit: "", kind: "decimal", digits: 2 },
  { key: "sent_to_slaughter_count", label: "ارسال به کشتار", unit: "قطعه", kind: "int" },
  { key: "live_weight_kg", label: "وزن زنده", unit: "کیلوگرم", kind: "decimal", digits: 2 },
];

// ============================================================
// ۴) «هرگزها» — سنجش در زمان بارگذاری ماژول
// ------------------------------------------------------------
//  اگر روزی کسی price_per_kg یا notes را به یکی از فهرست‌های سفید
//  اضافه کند، این ماژول بالا نمی‌آید (خطای صریح در استارت سرور)
//  — بهتر از لو رفتن خاموش در اولین درخواست مشتری.
// ============================================================
const WHITELIST_KEYS = [
  ...DB_ATTRIBUTES,
  ...HALL_DB_ATTRIBUTES,
  ...WEEK_ATTRIBUTES,
  ...LIST_KEYS,
  ...DETAIL_KEYS,
  ...METRICS.map((metric) => metric.key),
  ...HALL_METRICS.map((metric) => metric.key),
];

const LEAKED_FIELDS = WHITELIST_KEYS.filter((key) =>
  FORBIDDEN_FIELDS.includes(key),
);

if (LEAKED_FIELDS.length) {
  throw new Error(
    `پورتال: فیلد ممنوع در فهرست سفید «پایان دوره»: ${LEAKED_FIELDS.join(", ")}`,
  );
}

// ============================================================
// ۵) ابزارهای خالص (بدون DB)
// ============================================================
const plainOf = (row) => {
  if (!row) return {};
  if (typeof row.get === "function") return row.get({ plain: true });
  return row;
};

// فقط کلید سفید خوانده می‌شود (هیچ پراکندگی از ردیف DB)
const pick = (source, key) =>
  source && Object.prototype.hasOwnProperty.call(source, key)
    ? source[key]
    : null;

// عدد یا null (۰ با «ثبت نشده» اشتباه نشود)
const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const intOrNull = (value) => {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.trunc(parsed);
};

// تاریخ فقط YYYY-MM-DD (بدون ساعت/منطقه)
const dateOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  return raw ? raw.slice(0, 10) : null;
};

const INT_OUT_KEYS = [
  "id",
  "flock_id",
  "unit_id",
  "hall_id",
  "initial_chicks_count",
  "final_chicks_count",
  "slaughter_age_days",
  "slaughter_age_end_days",
  "final_week_number",
  "total_mortality",
  "transport_mortality",
  "total_sent",
];

const DECIMAL_OUT_KEYS = [
  "total_feed_intake",
  "final_avg_weight",
  "mortality_rate",
  "survival_percent",
  "final_fcr",
  "epi",
  "adg_grams",
  "total_weight_gain_kg",
  "system_fcr",
  "system_survival_percent",
  "initial_avg_weight",
  "total_live_weight",
  "avg_live_weight",
];

const DATE_OUT_KEYS = ["completion_date", "slaughter_date", "slaughter_end_date"];

// نگاشت امن یک مقدار DB به شکل خروجی (همهٔ مقادیر JSON-پذیر)
const normalizeValue = (key, raw) => {
  if (key === "completion_type_label") return typeLabelOf(raw);
  if (DATE_OUT_KEYS.includes(key)) return dateOrNull(raw);
  if (INT_OUT_KEYS.includes(key)) return intOrNull(raw);
  if (DECIMAL_OUT_KEYS.includes(key)) return numberOrNull(raw);
  if (key === "confirmed_by_customer") return Boolean(raw);
  if (key === "feed_basis") {
    const basis = raw ? String(raw).trim().toLowerCase() : "";
    return basis === "declared" ? "declared" : "system";
  }
  if (key === "slaughter_age_method") return raw ? String(raw).trim() : "";
  if (key === "slaughterhouse_name") {
    const name = raw === null || raw === undefined ? "" : String(raw).trim();
    return name || "";
  }
  return raw === undefined ? null : raw;
};

const rowView = (row, keys) => {
  const plain = plainOf(row);
  return keys.reduce((out, key) => {
    if (key === "completion_type_label") {
      out[key] = typeLabelOf(plain.completion_type);
      return out;
    }
    out[key] = normalizeValue(key, pick(plain, key));
    return out;
  }, {});
};

// ============================================================
// ۵) فهرست «پایان دوره‌های من»
// ============================================================
const completionListRow = (row) => rowView(row, LIST_KEYS);

// ============================================================
// ۶) تجمیع ریز سالن‌ها (ورودی aggregateFlock)
// ------------------------------------------------------------
//  ⚠️ نام کلیدها عمداً به شکل flockMetrics است تا «موتور» یکی بماند.
// ============================================================
const hallMetricInput = (row) => {
  const plain = plainOf(row);
  return {
    initialChicks: toInt(pick(plain, "initial_chicks_count")),
    finalChicks: toInt(pick(plain, "final_chicks_count")),
    totalMortality: toInt(pick(plain, "total_mortality")),
    totalFeed: toNumber(pick(plain, "total_feed_intake")),
    lastWeight: toNumber(pick(plain, "final_avg_weight")),
    lastAgeDays: toInt(pick(plain, "slaughter_age_days")),
    lastWeekNumber: toInt(pick(plain, "final_week_number")),
    // هفته‌ها در flock_completion_halls ذخیره نمی‌شوند؛ شمارش واقعی
    // از ردیف‌های هفتگی می‌آید (در totals بازنویسی می‌شود)
    weeksCount: 0,
  };
};

const hallRowView = (row, hallNameById = {}) => {
  const plain = plainOf(row);
  const hallId = intOrNull(pick(plain, "hall_id"));
  const name = hallId === null ? "" : String(hallNameById[String(hallId)] || "");
  return {
    hall_id: hallId,
    hall_name: name,
    chick_placement_id: intOrNull(pick(plain, "chick_placement_id")),
    initial_chicks_count: intOrNull(pick(plain, "initial_chicks_count")),
    final_chicks_count: intOrNull(pick(plain, "final_chicks_count")),
    total_mortality: intOrNull(pick(plain, "total_mortality")),
    mortality_rate: numberOrNull(pick(plain, "mortality_rate")),
    final_avg_weight: numberOrNull(pick(plain, "final_avg_weight")),
    total_feed_intake: numberOrNull(pick(plain, "total_feed_intake")),
    system_fcr: numberOrNull(pick(plain, "system_fcr")),
    sent_to_slaughter_count: intOrNull(pick(plain, "sent_to_slaughter_count")),
    live_weight_kg: numberOrNull(pick(plain, "live_weight_kg")),
    slaughter_age_days: intOrNull(pick(plain, "slaughter_age_days")),
    final_week_number: intOrNull(pick(plain, "final_week_number")),
  };
};

// ============================================================
// ۷) جمع دارو/واکسن بر اساس نام (شناسه در خروجی نمی‌آید)
// ============================================================
const summarizeNames = (rows = []) => {
  const counts = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const name = String((row && row.name) || "").trim();
    if (!name) return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (a, b) =>
        b.count - a.count || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
};

// ============================================================
// ۸) هشدارهای صادقانهٔ گزارش (بدون دادهٔ ساختگی)
// ============================================================
const buildNotices = ({ hallCount, trend, totals, stored, weekCount }) => {
  const notices = [];

  if (!hallCount) {
    notices.push(
      "ریز سالن‌های این دوره ثبت نشده است؛ اعداد این صفحه فقط از ردیف کلی پایان دوره می‌آید.",
    );
  }
  if (!weekCount) {
    notices.push(
      "هفته‌ای برای این دوره ثبت نشده است؛ روند وزن و ضریب تبدیل تجمعی محاسبه نمی‌شود.",
    );
  } else if (!trend) {
    notices.push("سری روند هفتگی قابل محاسبه نبود (وزن یا خوراک ثبت‌نشده).");
  }
  if (totals && totals.fcr === null) {
    notices.push(
      "برای محاسبهٔ ضریب تبدیل، «وزن نهایی»، «جوجهٔ نهایی» و «خوراک» لازم است؛ تا آن زمان این شاخص خالی می‌ماند.",
    );
  }
  if (
    totals &&
    stored &&
    totals.fcr !== null &&
    stored.final_fcr !== null &&
    Math.abs(round(totals.fcr - stored.final_fcr, 3)) >= 0.05
  ) {
    notices.push(
      "ضریب تبدیل ثبت‌شده با محاسبهٔ سیستمی اختلاف دارد؛ هر دو عدد نمایش داده می‌شود و تصمیم نهایی با کارشناس است.",
    );
  }
  return notices;
};

// ============================================================
// ۹) گزارش نهایی یک دوره
// ------------------------------------------------------------
//  ورودی‌ها همه «ردیف خوانده‌شده و اسکوپ‌شده» هستند؛ این تابع هیچ
//  کوئری/IO ندارد. خروجی:
//    completion  → ردیف پایان دوره (فهرست سفید کامل)
//    totals      → تجمیع سالن‌ها با flockMetrics.aggregateFlock
//    stored      → اعدادی که کارشناس در فرم ثبت کرده (برای مقایسه)
//    weekly      → جمع‌بندی هفته‌ها با flockMetrics.summarizeWeeks
//    halls       → ریز هر سالن + نام سالن
//    trend       → سری هفتگی تجمیعی (نمودار)
//    medicines / vaccines → جمع بر اساس نام
//    notices     → هشدارهای صادقانه
// ============================================================
const EMPTY_TOTALS = {
  initialChicks: 0,
  finalChicks: 0,
  totalMortality: 0,
  mortalityRate: 0,
  survivalRate: 100,
  totalFeed: 0,
  lastWeight: null,
  lastWeekNumber: null,
  ageDays: null,
  weeksCount: 0,
  fcr: null,
};

const completionReportView = ({
  completion,
  hallRows = [],
  weekRows = [],
  hallNameById = {},
  medicineRows = [],
  vaccineRows = [],
} = {}) => {
  const row = plainOf(completion);
  const halls = (Array.isArray(hallRows) ? hallRows : []).filter(Boolean);
  const weeks = (Array.isArray(weekRows) ? weekRows : []).filter(Boolean);
  const weekPlains = weeks.map((weekRow) => plainOf(weekRow));

  const aggregated = halls.length
    ? aggregateFlock(halls.map(hallMetricInput))
    : { ...EMPTY_TOTALS };

  // جوجهٔ اولیهٔ هر جوجه‌ریزی — برای «مرغ زنده» در سری روند
  const initialByPlacement = {};
  halls.forEach((hallRow) => {
    const plain = plainOf(hallRow);
    const placementId = String(pick(plain, "chick_placement_id") ?? "");
    if (!placementId) return;
    initialByPlacement[placementId] = toInt(
      pick(plain, "initial_chicks_count"),
    );
  });

  const trend = weekPlains.length
    ? buildFlockTrend(weekPlains, initialByPlacement)
    : null;

  const summary = summarizeWeeks(weekPlains, aggregated.initialChicks);

  const stored = {
    final_fcr: numberOrNull(pick(row, "final_fcr")),
    survival_percent: numberOrNull(pick(row, "survival_percent")),
    mortality_rate: numberOrNull(pick(row, "mortality_rate")),
    epi: numberOrNull(pick(row, "epi")),
    adg_grams: numberOrNull(pick(row, "adg_grams")),
    total_feed_intake: numberOrNull(pick(row, "total_feed_intake")),
    final_avg_weight: numberOrNull(pick(row, "final_avg_weight")),
    system_fcr: numberOrNull(pick(row, "system_fcr")),
    system_survival_percent: numberOrNull(
      pick(row, "system_survival_percent"),
    ),
  };

  const totals = {
    ...aggregated,
    // شمارش هفته‌ها از ردیف‌های واقعی (نه تخمین)
    weeksCount: weeks.length,
    feed_per_final_chick:
      aggregated.finalChicks > 0 && aggregated.totalFeed > 0
        ? round(aggregated.totalFeed / aggregated.finalChicks, 3)
        : null,
  };

  return {
    completion: rowView(row, DETAIL_KEYS),
    totals,
    stored,
    weekly: {
      weeks_count: weeks.length,
      total_feed: summary.totalFeed,
      total_mortality: summary.totalMortality,
      last_weight: summary.lastWeight,
      last_week_number: summary.lastWeekNumber,
      last_age_days: summary.lastAgeDays,
      fcr: summary.fcr,
    },
    halls: halls.map((hallRow) => hallRowView(hallRow, hallNameById)),
    trend,
    medicines: summarizeNames(medicineRows),
    vaccines: summarizeNames(vaccineRows),
    meta: {
      metrics: METRICS,
      hall_metrics: HALL_METRICS,
      types: COMPLETION_TYPES,
      feed_basis: normalizeValue("feed_basis", pick(row, "feed_basis")),
    },
    notices: buildNotices({
      hallCount: halls.length,
      trend,
      totals,
      stored,
      weekCount: weeks.length,
    }),
  };
};

module.exports = {
  COMPLETION_TYPES,
  METRICS,
  HALL_METRICS,
  LIST_KEYS,
  DETAIL_KEYS,
  DB_ATTRIBUTES,
  HALL_DB_ATTRIBUTES,
  WEEK_ATTRIBUTES,
  // ✅ ۱۳.۱۸: فهرست «هرگزها» از اسکیمای مشترک (برای گارد هم‌ترازی)
  FORBIDDEN_KEYS: FORBIDDEN_FIELDS,
  typeLabelOf,
  completionListRow,
  completionReportView,
  summarizeNames,
  hallRowView,
};



