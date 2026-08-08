// ================================================================
// dictionary.schemas.js - تعریف Schema هر جدول دیکشنری
// چون ستون‌های هر جدول دیکشنری متفاوت است، این فایل به‌صورت
// مرکزی تعریف می‌کند که هر جدول چه فیلدهایی دارد و چطور نمایش داده شود.
// ================================================================

export const DICTIONARY_SCHEMAS = {
  // ==================== انواع سالن ====================
  "hall-types": {
    title: "انواع سالن",
    icon: "fa-warehouse",
    canToggle: false,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
    ],
  },

  // ==================== مبدا جوجه ====================
  "chick-sources": {
    title: "مبدا جوجه",
    icon: "fa-truck",
    canToggle: false,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
    ],
  },

  // ==================== نژاد جوجه ====================
  "chicken-breeds": {
    title: "نژاد جوجه",
    icon: "fa-dna",
    canToggle: false,
    fields: [
      { key: "code", label: "کد", type: "text", required: true },
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
    ],
  },

  // ==================== سیستم سرمایشی ====================
  "cooling-systems": {
    title: "سیستم‌های سرمایشی",
    icon: "fa-snowflake",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== بیماری‌ها ====================
  diseases: {
    title: "بیماری‌ها",
    icon: "fa-virus",
    canToggle: true,
    fields: [
      { key: "name", label: "نام بیماری", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "treatment", label: "درمان", type: "textarea" },
      { key: "category", label: "دسته‌بندی", type: "text" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== انواع خوراک ====================
  "feed-types": {
    title: "انواع خوراک",
    icon: "fa-wheat-awn",
    canToggle: true,
    fields: [
      { key: "name", label: "نام خوراک", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "feed_stage", label: "مرحله تغذیه", type: "text" },
      { key: "protein_percentage", label: "درصد پروتئین", type: "number" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== انواع دانخوری ====================
  "feeder-types": {
    title: "انواع دانخوری",
    icon: "fa-bowl-food",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== انواع کفپوش ====================
  "floor-types": {
    title: "انواع کفپوش",
    icon: "fa-border-all",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== سیستم گرمایشی ====================
  "heating-systems": {
    title: "سیستم‌های گرمایشی",
    icon: "fa-fire",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== سیستم روشنایی ====================
  "lighting-systems": {
    title: "سیستم‌های روشنایی",
    icon: "fa-lightbulb",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== داروها ====================
  medicines: {
    title: "داروها",
    icon: "fa-capsules",
    canToggle: true,
    fields: [
      { key: "name", label: "نام دارو", type: "text", required: true },
      { key: "generic_name", label: "نام ژنریک", type: "text" },
      { key: "category", label: "دسته‌بندی", type: "text" },
      { key: "manufacturer", label: "تولیدکننده", type: "text" },
      { key: "dosage_form", label: "فرم دارویی", type: "text" },
      { key: "unit", label: "واحد", type: "text" },
      { key: "concentration", label: "غلظت", type: "text" },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "indication", label: "موارد مصرف", type: "textarea" },
      { key: "contraindication", label: "موارد منع مصرف", type: "textarea" },
      { key: "side_effects", label: "عوارض جانبی", type: "textarea" },
      { key: "withdrawal_time", label: "دوره پرهیز (روز)", type: "number" },
      { key: "storage_condition", label: "شرایط نگهداری", type: "text" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== انواع پیشنهاد ====================
  "suggestion-types": {
    title: "انواع پیشنهاد",
    icon: "fa-lightbulb",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "icon", label: "آیکون", type: "text" },
      { key: "color", label: "رنگ", type: "color" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== واکسن‌ها ====================
  vaccines: {
    title: "واکسن‌ها",
    icon: "fa-syringe",
    canToggle: true,
    fields: [
      { key: "name", label: "نام واکسن", type: "text", required: true },
      { key: "trade_name", label: "نام تجاری", type: "text" },
      { key: "manufacturer", label: "تولیدکننده", type: "text" },
      { key: "vaccine_type", label: "نوع واکسن", type: "text" },
      { key: "administration_method", label: "روش مصرف", type: "text" },
      { key: "target_disease", label: "بیماری هدف", type: "text" },
      { key: "age_days", label: "سن مصرف", type: "text" },
      { key: "booster_needed", label: "نیاز به بوستر", type: "boolean" },
      { key: "booster_days", label: "فاصله بوستر (روز)", type: "number" },
      { key: "immunity_duration", label: "مدت ایمنی (روز)", type: "number" },
      { key: "storage_temp", label: "دمای نگهداری", type: "text" },
      { key: "dilution_ratio", label: "نسبت رقیق‌سازی", type: "text" },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "precautions", label: "نکات احتیاطی", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== سیستم تهویه ====================
  "ventilation-types": {
    title: "سیستم‌های تهویه",
    icon: "fa-fan",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "ventilation_method", label: "روش تهویه", type: "text" },
      { key: "fan_type", label: "نوع فن", type: "text" },
      { key: "air_flow_direction", label: "جهت جریان هوا", type: "text" },
      { key: "automatic_control", label: "کنترل اتوماتیک", type: "boolean" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== سیستم ورودی آب ====================
  "water-inlet-types": {
    title: "سیستم‌های ورودی آب",
    icon: "fa-faucet",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== انواع آبخوری ====================
  "waterer-types": {
    title: "انواع آبخوری",
    icon: "fa-glass-water",
    canToggle: true,
    fields: [
      { key: "name", label: "نام", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "waterer_category", label: "دسته‌بندی", type: "text" },
      { key: "material", label: "جنس", type: "text" },
      { key: "capacity", label: "ظرفیت", type: "text" },
      { key: "bird_count", label: "تعداد پرنده", type: "number" },
      { key: "automatic", label: "اتوماتیک", type: "boolean" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },

  // ==================== وضعیت دوره ====================
  "period-statuses": {
    title: "وضعیت دوره‌ها",
    icon: "fa-flag",
    canToggle: true,
    fields: [
      { key: "name", label: "نام وضعیت", type: "text", required: true },
      { key: "description", label: "توضیحات", type: "textarea" },
      { key: "color", label: "رنگ", type: "color" },
      { key: "sort_order", label: "ترتیب", type: "number" },
      { key: "active", label: "فعال", type: "boolean" },
    ],
  },
};

// ================================================================
// متادیتای عمومی برای هر schema
// ================================================================
export const getDictionarySchema = (key) => DICTIONARY_SCHEMAS[key] || null;

export const getAllDictionaryKeys = () => Object.keys(DICTIONARY_SCHEMAS);

export const getAllDictionarySchemas = () => DICTIONARY_SCHEMAS;
