// ============================================================
// validations/hallDetailValidation.js
// قاعدهٔ «اطلاعات تکمیلی سالن» — موج ۱۳.۱۲
// ------------------------------------------------------------
//  چهار حوزه: فیزیکی، سیستم‌ها، آب/دان، بهداشت.
//  چرا فایل جدا و «خالص»؟
//   ۱) پورتال باید همان قاعده‌ای را اجرا کند که کارشناس اجرا می‌کند؛
//      اگر قاعده در کنترلر بنشیند، پورتال ناچار به کپی می‌شود.
//   ۲) این فایل هیچ مدل/دیتابیسی را import نمی‌کند، پس تست بدون
//      دیتابیس قابل اجراست (Backend/farm-write-test.mjs).
//   ۳) فهرست‌های سفید (FIELDS) هم این‌جا هستند تا لایهٔ پورتال برای
//      پاک‌سازی payload نسخهٔ دوم نسازد.
//
// 🔒 قواعد:
//   • خروجی همیشه { isValid, errors: [] } است (هم‌شکل validations/*).
//   • متن‌ها trim می‌شوند؛ عددی‌های خالی مجازند (null).
//   • تاریخ‌ها فقط YYYY-MM-DD می‌پذیرند (هم‌شکل ستون DATEONLY).
// ============================================================
"use strict";

const SYSTEM_ITEM_CATEGORIES = [
  "heating",
  "cooling",
  "ventilation",
  "fan",
  "sanitary",
  "lighting",
];

const PHYSICAL_FIELDS = [
  "hall_id",
  "unit_id",
  "length",
  "width",
  "height",
  "area",
  "floor_type_id",
  "notes",
];

const SYSTEM_FIELDS = [
  "hall_id",
  "unit_id",
  "fan_count",
  "fan_size",
  "fan_capacity",
  "heater_count",
  "heating_system_id",
  "cooling_system_id",
  "ventilation_system_id",
  "water_inlet_system_id",
  "lighting_system_id",
  "notes",
];

const WATER_FEED_FIELDS = [
  "hall_id",
  "unit_id",
  "waterer_type_id",
  "feeder_type_id",
  "water_lines_count",
  "feed_lines_count",
  "auto_feed_system",
  "notes",
];

const HYGIENE_FIELDS = [
  "hall_id",
  "unit_id",
  "last_wash_date",
  "last_disinfect_date",
  "disinfectant_type",
  "description",
];

const isBlank = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

const isNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const inRange = (value, min, max) => isNumber(value) && value >= min && value <= max;

const isIsoDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());

const textLength = (value) =>
  typeof value === "string" ? value.trim().length : 0;

// اعتبارسنجی مشترک «شناسه سالن»
const requireHallId = (payload, errors) => {
  if (isBlank(payload.hall_id)) {
    errors.push("شناسه سالن الزامی است");
    return;
  }
  if (!inRange(payload.hall_id, 1, Number.MAX_SAFE_INTEGER)) {
    errors.push("شناسه سالن معتبر نیست");
  }
};

const done = (errors) => ({ isValid: errors.length === 0, errors });

// ============================================
// ۱) اطلاعات فیزیکی
// ============================================
const validateHallPhysical = (payload = {}) => {
  const errors = [];
  requireHallId(payload, errors);

  const positive = [
    ["length", "طول سالن"],
    ["width", "عرض سالن"],
    ["height", "ارتفاع سالن"],
    ["area", "مساحت سالن"],
  ];
  for (const [key, label] of positive) {
    if (isBlank(payload[key])) continue;
    if (!inRange(payload[key], 0.1, 100000)) {
      errors.push(`${label} باید عددی مثبت باشد`);
    }
  }

  if (!isBlank(payload.floor_type_id) && !inRange(payload.floor_type_id, 1, 1e9)) {
    errors.push("نوع کف سالن معتبر نیست");
  }
  if (textLength(payload.notes) > 300) {
    errors.push("توضیحات حداکثر ۳۰۰ کاراکتر است");
  }

  return done(errors);
};

// ============================================
// ۲) سیستم‌های سالن (+ ردیف‌های تجهیزات)
// ============================================
const validateHallSystemItems = (items) => {
  const errors = [];
  if (items === undefined || items === null) return errors;
  if (!Array.isArray(items)) {
    errors.push("فهرست تجهیزات باید آرایه باشد");
    return errors;
  }
  if (items.length > 60) {
    errors.push("حداکثر ۶۰ ردیف تجهیزات برای هر سالن مجاز است");
    return errors;
  }

  items.forEach((item, index) => {
    const row = index + 1;
    const category = String((item && item.category) || "").trim();
    if (!category) {
      errors.push(`دستهٔ ردیف ${row} تجهیزات الزامی است`);
      return;
    }
    if (!SYSTEM_ITEM_CATEGORIES.includes(category)) {
      errors.push(`دستهٔ ردیف ${row} تجهیزات معتبر نیست`);
    }
    if (!isBlank(item.type_id) && !inRange(item.type_id, 1, 1e9)) {
      errors.push(`نوع ردیف ${row} تجهیزات معتبر نیست`);
    }
    if (!isBlank(item.quantity) && !inRange(item.quantity, 1, 999)) {
      errors.push(`تعداد ردیف ${row} تجهیزات باید بین ۱ تا ۹۹۹ باشد`);
    }
    if (textLength(item.spec) > 100 || textLength(item.size) > 50) {
      errors.push(`مشخصهٔ ردیف ${row} تجهیزات بیش از حد طولانی است`);
    }
    if (textLength(item.capacity) > 50) {
      errors.push(`ظرفیت ردیف ${row} تجهیزات بیش از حد طولانی است`);
    }
  });

  return errors;
};

const validateHallSystem = (payload = {}) => {
  const errors = [];
  requireHallId(payload, errors);

  const counts = [
    ["fan_count", "تعداد فن"],
    ["heater_count", "تعداد هیتر"],
  ];
  for (const [key, label] of counts) {
    if (isBlank(payload[key])) continue;
    if (!inRange(payload[key], 0, 500)) {
      errors.push(`${label} باید عددی بین ۰ تا ۵۰۰ باشد`);
    }
  }

  const dictionaries = [
    ["heating_system_id", "سیستم گرمایش"],
    ["cooling_system_id", "سیستم سرمایش"],
    ["ventilation_system_id", "سیستم تهویه"],
    ["water_inlet_system_id", "سیستم ورود آب"],
    ["lighting_system_id", "سیستم روشنایی"],
  ];
  for (const [key, label] of dictionaries) {
    if (isBlank(payload[key])) continue;
    if (!inRange(payload[key], 1, 1e9)) errors.push(`${label} معتبر نیست`);
  }

  if (textLength(payload.fan_size) > 50) {
    errors.push("سایز فن حداکثر ۵۰ کاراکتر است");
  }
  if (textLength(payload.fan_capacity) > 50) {
    errors.push("ظرفیت فن حداکثر ۵۰ کاراکتر است");
  }
  if (textLength(payload.notes) > 300) {
    errors.push("توضیحات حداکثر ۳۰۰ کاراکتر است");
  }

  errors.push(...validateHallSystemItems(payload.items));
  return done(errors);
};

// ============================================
// ۳) آب‌خوری و دان‌خوری
// ============================================
const validateHallWaterFeed = (payload = {}) => {
  const errors = [];
  requireHallId(payload, errors);

  const types = [
    ["waterer_type_id", "نوع آب‌خوری"],
    ["feeder_type_id", "نوع دان‌خوری"],
  ];
  for (const [key, label] of types) {
    if (isBlank(payload[key])) continue;
    if (!inRange(payload[key], 1, 1e9)) errors.push(`${label} معتبر نیست`);
  }

  const counts = [
    ["water_lines_count", "تعداد خط آب"],
    ["feed_lines_count", "تعداد خط دان"],
  ];
  for (const [key, label] of counts) {
    if (isBlank(payload[key])) continue;
    if (!inRange(payload[key], 0, 200)) {
      errors.push(`${label} باید عددی بین ۰ تا ۲۰۰ باشد`);
    }
  }

  if (textLength(payload.notes) > 300) {
    errors.push("توضیحات حداکثر ۳۰۰ کاراکتر است");
  }

  return done(errors);
};

// ============================================
// ۴) بهداشت و ضدعفونی
// ============================================
const validateHallHygiene = (payload = {}) => {
  const errors = [];
  requireHallId(payload, errors);

  const dates = [
    ["last_wash_date", "تاریخ آخرین شست‌وشو"],
    ["last_disinfect_date", "تاریخ آخرین ضدعفونی"],
  ];
  for (const [key, label] of dates) {
    if (isBlank(payload[key])) continue;
    if (!isIsoDate(payload[key])) {
      errors.push(`${label} باید به شکل ۲۰۲۶-۰۱-۰۱ باشد`);
    }
  }

  if (textLength(payload.disinfectant_type) > 100) {
    errors.push("نوع مادهٔ ضدعفونی حداکثر ۱۰۰ کاراکتر است");
  }
  if (textLength(payload.description) > 500) {
    errors.push("توضیحات حداکثر ۵۰۰ کاراکتر است");
  }

  return done(errors);
};

// نگاشت حوزه ⇒ اعتبارسنج (برای لایهٔ پورتال: یک منبع)
const HALL_DETAIL_VALIDATORS = {
  hall_physical_save: validateHallPhysical,
  hall_system_save: validateHallSystem,
  hall_water_feed_save: validateHallWaterFeed,
  hall_hygiene_save: validateHallHygiene,
};

// نگاشت حوزه ⇒ فهرست سفید payload
const HALL_DETAIL_FIELDS = {
  hall_physical_save: PHYSICAL_FIELDS,
  hall_system_save: SYSTEM_FIELDS,
  hall_water_feed_save: WATER_FEED_FIELDS,
  hall_hygiene_save: HYGIENE_FIELDS,
};

module.exports = {
  SYSTEM_ITEM_CATEGORIES,
  PHYSICAL_FIELDS,
  SYSTEM_FIELDS,
  WATER_FEED_FIELDS,
  HYGIENE_FIELDS,
  HALL_DETAIL_VALIDATORS,
  HALL_DETAIL_FIELDS,
  validateHallPhysical,
  validateHallSystem,
  validateHallSystemItems,
  validateHallWaterFeed,
  validateHallHygiene,
};

