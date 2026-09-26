// ================================================================
//  کاتالوگ گروه‌های شاخص «گزارش مدیریت هفتگی»
// ----------------------------------------------------------------
//  ❓ چرا این فایل؟ پیش از این گروه‌های شاخص فقط داخل رندرر
//  (renderHistoryWeekMatrix) و به‌صورت ستون‌های سخت‌کدشدهٔ جدول
//  ۱۴ستونی وجود داشتند؛ پس کاربر نمی‌توانست انتخاب کند کدام شاخص‌ها
//  در گزارش بیاید. اکنون این فایل «منبع واحد» است و سه مصرف‌کننده
//  دارد: مودال انتخاب کاربر (weekly.service) · رندر جدول‌ها
//  (weekly.renderer) · تست‌های خالص (weekly-calculations-test).
// ================================================================

export const REPORT_GROUPS = [
  {
    key: "population",
    title: "🐔 جمعیت، تلفات و زنده‌مانی",
    hint: "جمعیت ابتدا و انتهای هفته، تلفات و درصدها، زنده‌مانی",
  },
  {
    key: "weight",
    title: "⚖️ وزن",
    hint: "میانگین وزن هفتگی، وزن کل گله و افزایش وزن",
  },
  {
    key: "growth",
    title: "🚀 رشد",
    hint: "ADG هفتگی و تجمعی (گرم به ازای هر پرنده در روز)",
  },
  {
    key: "feed",
    title: "🛒 خوراک و ضریب تبدیل",
    hint: "دان مصرفی، سرانهٔ مصرف هفتگی/روزانه و FCR",
  },
  {
    key: "details",
    title: "📋 جزئیات ثبت هفتگی",
    hint: "بازهٔ تاریخ، سن، خاموشی، بیماری/واکسن/دارو، پیشنهادات و توضیحات",
  },
];

export const ALL_GROUP_KEYS = REPORT_GROUPS.map((group) => group.key);

// کلید ذخیرهٔ انتخاب کاربر (هم‌الگوی skb_dashboard_chart_layout)
export const REPORT_GROUP_STORAGE_KEY = "skb_weekly_report_groups";

const GROUP_KEY_SET = new Set(ALL_GROUP_KEYS);

/**
 * نرمال‌سازی انتخاب کاربر:
 *  - ورودی نامعتبر/خالی → همهٔ گروه‌ها (رفتار پیش‌فرض = گزارش کامل)
 *  - حذف مقادیر ناشناخته و تکراری
 *  - خروجی همیشه با ترتیب کاتالوگ (نه ترتیب کلیک کاربر)
 */
export function normalizeGroups(selected) {
  if (!Array.isArray(selected)) return [...ALL_GROUP_KEYS];
  const picked = new Set(selected.filter((key) => GROUP_KEY_SET.has(key)));
  if (picked.size === 0) return [...ALL_GROUP_KEYS];
  return ALL_GROUP_KEYS.filter((key) => picked.has(key));
}

export function isGroupSelected(selected, key) {
  return normalizeGroups(selected).includes(key);
}

/** فقط گروه‌های انتخاب‌شده (برای مودال گزارش و متن‌های راهنما) */
export function groupsForKeys(selected) {
  const keys = normalizeGroups(selected);
  return REPORT_GROUPS.filter((group) => keys.includes(group.key));
}

// ================================================================
//  ستون‌های جدول «📈 شاخص‌های عملکردی هفتگی» (قبلاً هارد‌کد بود)
//  هر ستون: کلید + گروه + برچسب + تولتیپ + نوع قالب‌بندی + مقدارگیر
//  (قالب‌بندی اعداد در رندرر انجام می‌شود تا این فایل خالص بماند)
// ================================================================

export const METRICS_COLUMNS = [
  {
    key: "birdsStart",
    group: "population",
    label: "جمعیت ابتدای هفته",
    title: "جمعیت زنده در ابتدای همین هفته (جوجه‌ریزی اولیه منهای تلفات هفته‌های قبل)",
    type: "num",
    digits: 0,
    get: (m) => m.birdsStartOfWeek,
  },
  {
    key: "birdsEnd",
    group: "population",
    label: "جمعیت مانده",
    title: "جمعیت زندهٔ انتهای هفته",
    type: "num",
    digits: 0,
    get: (m) => m.birdsEndOfWeek,
  },
  {
    key: "survival",
    group: "population",
    label: "زنده‌مانی ٪",
    title: "درصد زنده‌مانی در همین هفته",
    type: "pct",
    digits: 2,
    get: (m) => m.weeklySurvivalPercent,
  },
  {
    key: "mortalityPct",
    group: "population",
    label: "تلفات ٪",
    title: "درصد تلفات در همین هفته",
    type: "pct",
    digits: 2,
    get: (m) => m.weeklyMortalityPercent,
  },
  {
    key: "mortality",
    group: "population",
    label: "تلفات (قطعه)",
    title: "تعداد تلفات ثبت‌شده در همین هفته (قطعه)",
    type: "num",
    digits: 0,
    get: (m) => m.mortalityThisWeek,
  },
  {
    key: "weight",
    group: "weight",
    label: "وزن (kg)",
    title: "میانگین وزن هفتگی گله",
    type: "num",
    digits: 3,
    get: (m) => m.weight,
  },
  {
    key: "totalWeight",
    group: "weight",
    label: "وزن کل (kg)",
    title: "وزن زندهٔ کل گله (میانگین وزن × جمعیت مانده)",
    type: "num",
    digits: 1,
    get: (m) => m.totalLiveWeight,
  },
  {
    key: "weightGain",
    group: "weight",
    label: "افزایش وزن (kg)",
    title: "اختلاف وزن این هفته با هفتهٔ قبل",
    type: "num",
    digits: 3,
    get: (m) => m.weightGain,
  },
  {
    key: "adg",
    group: "growth",
    label: "ADG (g)",
    title: "میانگین رشد روزانه در همین هفته (گرم)",
    type: "num",
    digits: 1,
    get: (m) => m.dailyGainGrams,
  },
  {
    key: "feed",
    group: "feed",
    label: "دان کل (kg)",
    title: "مجموع دان مصرفی تا این هفته",
    type: "num",
    digits: 1,
    get: (m) => m.cumulativeFeed,
  },
  {
    key: "feedPerBird",
    group: "feed",
    label: "سرانه (kg)",
    title: "مجموع دان مصرفی تا این هفته ÷ جمعیت ابتدای هفته (کیلوگرم به ازای هر قطعه)",
    type: "num",
    digits: 3,
    get: (m) => m.cumulativeFeedPerBird,
  },
  {
    key: "dailyFeedPerBird",
    group: "feed",
    label: "سرانه روزانه (g)",
    title: "(دان مصرفی همان هفته ÷ ۷) ÷ جمعیت ابتدای هفته (گرم به ازای هر قطعه در روز)",
    type: "num",
    digits: 1,
    get: (m) => m.dailyFeedPerBird,
  },
  {
    key: "fcr",
    group: "feed",
    label: "FCR",
    title: "ضریب تبدیل خوراک (تجمیعی تا این هفته)",
    type: "num",
    digits: 3,
    get: (m) => m.fcr,
  },
];

/** ستون‌های قابل نمایش بر اساس گروه‌های انتخاب‌شده */
export function metricsColumnsFor(selected) {
  const keys = normalizeGroups(selected);
  return METRICS_COLUMNS.filter((column) => keys.includes(column.group));
}

/** برچسب خوانا از انتخاب کاربر (در هدر گزارش چاپ می‌شود) */
export function selectedGroupsLabel(selected) {
  const keys = normalizeGroups(selected);
  if (keys.length === ALL_GROUP_KEYS.length) return "همهٔ شاخص‌ها";
  return groupsForKeys(keys)
    .map((group) => group.title)
    .join("، ");
}
