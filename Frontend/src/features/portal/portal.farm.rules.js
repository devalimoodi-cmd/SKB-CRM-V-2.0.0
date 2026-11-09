// ============================================================
// features/portal/portal.farm.rules.js
// قواعد «درخواست‌های فارم» سمت کلاینت — موج ۱۳.۱۵
// ------------------------------------------------------------
//  چرا فایل جدا شد؟
//   • تا ۱۳.۱۴ مشخصات فرم در رندرر بود و فهرست کلیدهای payload
//     در `portal.api.js` دستی تکرار می‌شد ⇒ دو منبع برای یک قاعده.
//   • از ۱۳.۱۵ فرم‌ها ۱۸ نوع‌اند؛ یک منبع (`FARM_FORM_SPEC`) هم
//     رندر را می‌سازد، هم payload را تایپ می‌کند، هم برچسب خلاصه.
//
//  منبع حقیقت سرور: Backend/services/portalRequestRules.js
//  ⚠️ این آینه فقط برای «تجربهٔ بهتر» است (خطای فوری پیش از ارسال و
//     بدنهٔ تمیز). امنیت با همان فهرست سفیدِ سرور تأمین می‌شود.
//  🔒 عمداً غایب: customer_id · status · id · reviewed_by · role ·
//     unit_id/hall_id در جزئیات سالن (سرور از ردیف سالن می‌سازد).
//
//  انواع فیلد (type):
//   text · tel · number · date · textarea · static · check · radio
//   unit · hall · placement · flock · dict · multi · items
//  فیلدهای `payload: false` فقط برای انتخاب/فیلتر UI هستند و هرگز
//  به بدنهٔ درخواست نمی‌روند (مثل دوره در ویرایش/حذف هفته).
// ============================================================

// سقف‌های آینه‌ای از سرور (MAX_LIST_ITEMS / MAX_ID_LIST_ITEMS / MAX_NOTE_LENGTH)
export const FARM_MAX_LIST_ITEMS = 60;
export const FARM_MAX_ID_LIST_ITEMS = 100;
export const FARM_MAX_NOTE_LENGTH = 300;
export const FARM_MAX_PENDING = 10;

// ============================================================
// ۱) گروه‌بندی نوع‌ها (۱۸ نوع در ۵ گروه — ترتیب نمایش)
// ============================================================
export const FARM_FORM_GROUPS = [
  {
    key: "unit",
    label: "واحد مرغداری",
    icon: "fa-building",
    types: ["unit_create", "unit_update", "unit_delete"],
  },
  {
    key: "hall",
    label: "سالن",
    icon: "fa-warehouse",
    types: ["hall_create", "hall_update", "hall_delete"],
  },
  {
    key: "hall_details",
    label: "اطلاعات تکمیلی سالن",
    icon: "fa-screwdriver-wrench",
    types: [
      "hall_physical_save",
      "hall_system_save",
      "hall_water_feed_save",
      "hall_hygiene_save",
    ],
  },
  {
    key: "placement",
    label: "دوره (جوجه‌ریزی)",
    icon: "fa-egg",
    types: [
      "placement_create",
      "placement_update",
      "placement_activate",
      "placement_deactivate",
      "placement_delete",
    ],
  },
  {
    key: "weekly",
    label: "اطلاعات هفتگی",
    icon: "fa-calendar-days",
    types: ["weekly_create", "weekly_update", "weekly_delete"],
  },
];

// ============================================================
// ۲) نوع‌های درخواست — برچسب‌ها آینهٔ سرور (key/label/icon/target)
// ============================================================
export const FARM_REQUEST_TYPES = [
  { key: "unit_create", label: "ثبت واحد مرغداری", icon: "fa-building", target: "unit_id" },
  { key: "hall_create", label: "ثبت سالن", icon: "fa-warehouse", target: "hall_id" },
  { key: "placement_create", label: "ثبت جوجه‌ریزی", icon: "fa-egg", target: "hall_id" },
  { key: "unit_update", label: "ویرایش واحد مرغداری", icon: "fa-pen-to-square", target: "unit_id" },
  { key: "unit_delete", label: "حذف واحد مرغداری", icon: "fa-trash-can", target: "unit_id", destructive: true },
  { key: "hall_update", label: "ویرایش سالن", icon: "fa-pen-to-square", target: "hall_id" },
  { key: "hall_delete", label: "حذف سالن", icon: "fa-trash-can", target: "hall_id", destructive: true },
  { key: "hall_physical_save", label: "ثبت اطلاعات فیزیکی سالن", icon: "fa-ruler-combined", target: "hall_id" },
  { key: "hall_system_save", label: "ثبت سیستم‌های سالن", icon: "fa-fan", target: "hall_id" },
  { key: "hall_water_feed_save", label: "ثبت آب‌خوری و دان‌خوری", icon: "fa-droplet", target: "hall_id" },
  { key: "hall_hygiene_save", label: "ثبت بهداشت سالن", icon: "fa-pump-medical", target: "hall_id" },
  { key: "placement_update", label: "ویرایش جوجه‌ریزی", icon: "fa-pen-to-square", target: "placement_id" },
  { key: "placement_delete", label: "حذف جوجه‌ریزی", icon: "fa-trash-can", target: "placement_id", destructive: true },
  { key: "placement_activate", label: "فعال‌سازی دوره", icon: "fa-circle-play", target: "placement_id" },
  { key: "placement_deactivate", label: "پایان دوره", icon: "fa-circle-stop", target: "placement_id" },
  { key: "weekly_create", label: "ثبت اطلاعات هفتگی", icon: "fa-calendar-plus", target: "chick_placement_id" },
  { key: "weekly_update", label: "ویرایش اطلاعات هفتگی", icon: "fa-calendar-check", target: "weekly_id" },
  { key: "weekly_delete", label: "حذف اطلاعات هفتگی", icon: "fa-calendar-xmark", target: "weekly_id", destructive: true },
];

export const FARM_TYPE_KEYS = FARM_REQUEST_TYPES.map((item) => item.key);

// چهار نوع «حذف» (سرور: DESTRUCTIVE_TYPES) — تأیید دوم اجباری است
export const FARM_DESTRUCTIVE_TYPES = FARM_REQUEST_TYPES.filter(
  (item) => item.destructive,
).map((item) => item.key);

export const farmIsDestructive = (type) =>
  FARM_DESTRUCTIVE_TYPES.includes(String(type || "").trim());

// گروه هر نوع (برای تب‌های گروه‌بندی‌شده)
const GROUP_OF_TYPE = FARM_FORM_GROUPS.reduce((acc, group) => {
  group.types.forEach((type) => {
    acc[type] = group.key;
  });
  return acc;
}, {});

export const farmTypeGroupOf = (type) =>
  GROUP_OF_TYPE[String(type || "").trim()] || "";

// نوع پیش‌فرض تب (اولین نوعی که مشتری بیشترین نیاز را دارد)
export const FARM_DEFAULT_TYPE = "unit_create";

// ============================================================
// ۳) سازنده‌های کوتاه فیلد (خوانایی مشخصات فرم)
// ============================================================
const text = (key, label, extra = {}) => ({ key, label, type: "text", ...extra });
const tel = (key, label, extra = {}) => ({ key, label, type: "tel", ...extra });
const num = (key, label, extra = {}) => ({ key, label, type: "number", ...extra });
const date = (key, label, extra = {}) => ({ key, label, type: "date", ...extra });
const memo = (key, label, extra = {}) => ({
  key,
  label,
  type: "textarea",
  maxLength: 300,
  rows: 2,
  ...extra,
});
const dict = (key, label, dictKey, extra = {}) => ({
  key,
  label,
  type: "dict",
  dict: dictKey,
  ...extra,
});
const multi = (key, label, dictKey, extra = {}) => ({
  key,
  label,
  type: "multi",
  dict: dictKey,
  ...extra,
});
const unitSelect = (extra = {}) => ({
  key: "unit_id",
  label: "واحد",
  type: "unit",
  required: true,
  ...extra,
});
const hallSelect = (extra = {}) => ({
  key: "hall_id",
  label: "سالن",
  type: "hall",
  required: true,
  ...extra,
});
const placementSelect = (label = "دوره (جوجه‌ریزی)", extra = {}) => ({
  key: "chick_placement_id",
  label,
  type: "placement",
  required: true,
  ...extra,
});
// توضیح آزاد مشتری برای کارشناس (همیشه آخرین فیلد)
const noteField = () => memo("note", "توضیح برای کارشناس");

// ============================================================
// ۴) مشخصات فرم هر نوع — ترتیب فیلدها = ترتیب فرم کارشناس
// ------------------------------------------------------------
//  `required` فقط برای تجربهٔ بهتر است؛ سرور فیلدهای نیامده را با
//  placeholder می‌سنجد و «هیچ تغییری» را با nothing_to_change رد می‌کند.
// ============================================================
// ============================================================
// ۳.۱) فیلدهای مشترک «اطلاعات هفتگی»
// ------------------------------------------------------------
//  ترتیب = ترتیب کارت هفتگی کارشناس (weekly.cards):
//  هفته/تاریخ‌ها → تلفات → وزن → دان → خاموشی → آیتم‌ها → توضیحات
//  ⚠️ تاریخ‌ها و شمارهٔ هفته در فرم کارشناس مخفی و محاسبه‌شده‌اند؛
//     پورتال آن‌ها را نشان می‌دهد ولی با انتخاب دوره خودکار پر می‌کند
//     (portal.farm.weeks.js → weekPlanFor).
// ============================================================
const WEEKLY_FIELDS = () => [
  num("week_number", "شمارهٔ هفته", {
    required: true,
    min: 1,
    max: 60,
    step: 1,
    hint: "با انتخاب دوره خودکار پر می‌شود",
  }),
  date("week_start_date", "شروع هفته", { required: true }),
  date("week_end_date", "پایان هفته", { required: true }),
  num("flock_age_days", "سن گله (روز)", { required: true, min: 0, step: 1 }),
  num("weekly_mortality", "تلفات هفته (قطعه)", {
    required: true,
    min: 0,
    step: 1,
  }),
  num("weekly_weight", "وزن هفته (گرم)", {
    required: true,
    min: 0,
    step: "any",
  }),
  num("daily_feed_intake", "دان روزانه (گرم)", { min: 0, step: "any" }),
  num("weekly_feed_intake", "دان هفتگی (کیلوگرم)", {
    min: 0,
    step: "any",
    hint: "تقریباً ۷ برابر دان روزانه است",
  }),
  num("blackout_hours", "ساعت خاموشی", { min: 0, max: 24, step: "any" }),
  multi("disease_ids", "بیماری‌ها", "diseases"),
  multi("vaccine_ids", "واکسن‌ها", "vaccines"),
  multi("medicine_ids", "داروها", "medicines"),
  multi("feed_type_ids", "نوع خوراک", "feed_types"),
  multi("suggestion_ids", "پیشنهادها", "suggestion_types"),
  memo("additional_notes", "توضیحات هفته", { maxLength: 1000, rows: 3 }),
];

// ============================================================
// ۴) مشخصات فرم هر نوع — ترتیب فیلدها = ترتیب فرم کارشناس
// ------------------------------------------------------------
//  `required` فقط برای تجربهٔ بهتر است؛ سرور فیلدهای نیامده را با
//  placeholder می‌سنجد و «هیچ تغییری» را با nothing_to_change رد می‌کند.
// ============================================================
export const FARM_FORM_SPEC = {
  // ---------- واحد ----------
  unit_create: [
    text("unit_name", "نام واحد", { required: true, maxLength: 100 }),
    text("address", "آدرس واحد", { required: true, maxLength: 500 }),
    num("hall_count", "تعداد سالن", { required: true, min: 1, max: 99, step: 1 }),
    num("capacity", "ظرفیت (قطعه)", { required: true, min: 0, step: 1 }),
    text("manager_name", "نام مدیر واحد", { maxLength: 100 }),
    tel("manager_phone", "تلفن مدیر (۱۱ رقم)"),
    num("longitude", "طول جغرافیایی", { step: "any" }),
    num("latitude", "عرض جغرافیایی", { step: "any" }),
    noteField(),
  ],
  unit_update: [
    unitSelect(),
    text("unit_name", "نام واحد", { required: true, maxLength: 100 }),
    text("address", "آدرس واحد", { required: true, maxLength: 500 }),
    num("hall_count", "تعداد سالن", { required: true, min: 1, max: 99, step: 1 }),
    num("capacity", "ظرفیت (قطعه)", { required: true, min: 0, step: 1 }),
    text("manager_name", "نام مدیر واحد", { required: true, maxLength: 100 }),
    tel("manager_phone", "تلفن مدیر (۱۱ رقم)", { required: true }),
    num("longitude", "طول جغرافیایی", { step: "any" }),
    num("latitude", "عرض جغرافیایی", { step: "any" }),
    noteField(),
  ],
  unit_delete: [
    unitSelect(),
    text("confirm_name", "نام واحد را برای تأیید بنویسید", {
      required: true,
      maxLength: 100,
      hint: "عیناً همان نامی که در فهرست واحدها می‌بینید (حساس به بزرگی/کوچکی حرف نیست)",
    }),
    noteField(),
  ],

  // ---------- سالن ----------
  hall_create: [
    unitSelect(),
    text("hall_name", "نام سالن", { required: true, maxLength: 100 }),
    text("hall_number", "شمارهٔ سالن (خالی = خودکار)", {
      maxLength: 50,
      hint: "اگر خالی بماند، سرور شمارهٔ بعدی را می‌سازد",
    }),
    num("nominal_capacity", "ظرفیت اسمی (قطعه)", { min: 0, step: 1 }),
    num("altitude_above_sea", "ارتفاع از سطح دریا (متر)", { step: "any" }),
    dict("hall_type_id", "نوع سالن", "hall_types"),
    num("construction_year", "سال ساخت", { min: 1300, max: 1500, step: 1 }),
    text("operator_name", "نام اپراتور", { maxLength: 100 }),
    noteField(),
  ],
  hall_update: [
    hallSelect(),
    text("hall_name", "نام سالن", { required: true, maxLength: 100 }),
    text("hall_number", "شمارهٔ سالن", { maxLength: 50 }),
    num("nominal_capacity", "ظرفیت اسمی (قطعه)", { min: 0, step: 1 }),
    num("altitude_above_sea", "ارتفاع از سطح دریا (متر)", { step: "any" }),
    dict("hall_type_id", "نوع سالن", "hall_types"),
    num("construction_year", "سال ساخت", { min: 1300, max: 1500, step: 1 }),
    text("operator_name", "نام اپراتور", { maxLength: 100 }),
    noteField(),
  ],
  hall_delete: [hallSelect(), noteField()],

  // ---------- اطلاعات تکمیلی سالن ----------
  hall_physical_save: [
    hallSelect(),
    num("length", "طول (متر)", { min: 0, step: "any" }),
    num("width", "عرض (متر)", { min: 0, step: "any" }),
    num("height", "ارتفاع (متر)", { min: 0, step: "any" }),
    num("area", "مساحت (مترمربع)", {
      min: 0,
      step: "any",
      hint: "با تغییر طول/عرض خودکار پر می‌شود",
    }),
    dict("floor_type_id", "نوع کف", "floor_types"),
    memo("notes", "توضیحات فیزیکی سالن"),
    noteField(),
  ],
  hall_system_save: [
    hallSelect(),
    num("fan_count", "تعداد فن", { min: 0, step: 1 }),
    text("fan_size", "اندازهٔ فن", { maxLength: 50 }),
    text("fan_capacity", "ظرفیت فن", { maxLength: 50 }),
    num("heater_count", "تعداد هیتر", { min: 0, step: 1 }),
    dict("heating_system_id", "سیستم گرمایش", "heating_systems"),
    dict("cooling_system_id", "سیستم سرمایش", "cooling_systems"),
    dict("ventilation_system_id", "سیستم تهویه", "ventilation_types"),
    dict("water_inlet_system_id", "ورودی آب", "water_inlet_types"),
    dict("lighting_system_id", "سیستم روشنایی", "lighting_systems"),
    memo("notes", "توضیحات سیستم‌ها"),
    { key: "items", label: "ردیف‌های تجهیزات", type: "items" },
    noteField(),
  ],
  hall_water_feed_save: [
    hallSelect(),
    dict("waterer_type_id", "نوع آب‌خوری", "waterer_types"),
    dict("feeder_type_id", "نوع دان‌خوری", "feeder_types"),
    num("water_lines_count", "تعداد خط آب", { min: 0, step: 1 }),
    num("feed_lines_count", "تعداد خط دان", { min: 0, step: 1 }),
    {
      key: "auto_feed_system",
      label: "سیستم دان‌رسانی خودکار",
      type: "radio",
      options: [
        { value: "true", label: "دارد" },
        { value: "false", label: "ندارد" },
      ],
    },
    memo("notes", "توضیحات آب/دان"),
    noteField(),
  ],
  hall_hygiene_save: [
    hallSelect(),
    date("last_wash_date", "تاریخ آخرین شست‌وشو"),
    date("last_disinfect_date", "تاریخ آخرین ضدعفونی"),
    text("disinfectant_type", "نوع مادهٔ ضدعفونی", { maxLength: 100 }),
    memo("description", "توضیحات بهداشتی", { maxLength: 500 }),
    noteField(),
  ],

  // ---------- دوره (جوجه‌ریزی) ----------
  placement_create: [
    unitSelect(),
    hallSelect(),
    date("placement_date", "تاریخ جوجه‌ریزی", { required: true }),
    dict("chick_source_id", "مبدأ جوجه", "chick_sources", { required: true }),
    dict("breed_id", "نژاد", "breeds", { required: true }),
    num("chick_age_on_arrival", "سن در ورود (روز)", { min: 0, step: 1 }),
    num("avg_initial_weight", "میانگین وزن اولیه (گرم)", {
      required: true,
      min: 0,
      step: "any",
    }),
    num("total_chicks_count", "تعداد کل جوجه", {
      required: true,
      min: 0,
      step: 1,
    }),
    num("placement_density", "تراکم (قطعه در متر)", { min: 0, step: "any" }),
    { key: "flock_id", label: "افزودن به گلهٔ موجود", type: "flock" },
    { key: "start_new_flock", label: "شروع گلهٔ جدید", type: "check" },
    noteField(),
  ],
  placement_update: [
    {
      key: "placement_id",
      label: "دوره",
      type: "placement",
      required: true,
      filter: "all",
    },
    date("placement_date", "تاریخ جوجه‌ریزی", { required: true }),
    num("flock_number", "شمارهٔ گله", { min: 0, step: 1 }),
    dict("chick_source_id", "مبدأ جوجه", "chick_sources", { required: true }),
    dict("breed_id", "نژاد", "breeds", { required: true }),
    num("chick_age_on_arrival", "سن در ورود (روز)", { min: 0, step: 1 }),
    num("avg_initial_weight", "میانگین وزن اولیه (گرم)", {
      required: true,
      min: 0,
      step: "any",
    }),
    num("total_chicks_count", "تعداد کل جوجه", {
      required: true,
      min: 0,
      step: 1,
    }),
    num("placement_density", "تراکم (قطعه در متر)", { min: 0, step: "any" }),
    noteField(),
  ],
  placement_delete: [
    { key: "placement_id", label: "دوره", type: "placement", required: true },
    noteField(),
  ],
  placement_activate: [
    {
      key: "placement_id",
      label: "دوره (غیرفعال)",
      type: "placement",
      required: true,
      filter: "inactive",
    },
    noteField(),
  ],
  placement_deactivate: [
    {
      key: "placement_id",
      label: "دوره (فعال)",
      type: "placement",
      required: true,
      filter: "active",
    },
    noteField(),
  ],

  // ---------- اطلاعات هفتگی ----------
  weekly_create: [
    placementSelect("دوره (فعال)", { filter: "active" }),
    ...WEEKLY_FIELDS(),
    noteField(),
  ],
  weekly_update: [
    // فقط برای انتخاب هفته — به payload نمی‌رود (weekly_id کافی است)
    placementSelect("دوره", { filter: "all", payload: false }),
    {
      key: "weekly_id",
      label: "هفته",
      type: "week",
      required: true,
      hint: "با انتخاب هفته، اعداد فعلیِ همان هفته در فرم پر می‌شود",
    },
    ...WEEKLY_FIELDS(),
    noteField(),
  ],
  weekly_delete: [
    placementSelect("دوره", { filter: "all", payload: false }),
    { key: "weekly_id", label: "هفته", type: "week", required: true },
    noteField(),
  ],
};

// ============================================================
// ۵) مشتقات spec (یک منبع — بدون فهرست دستی دوم)
// ============================================================

// شناسهٔ DOM هر فیلد (portal.farm.js از همین می‌خواند)
export const farmFieldId = (key) => `farmField_${key}`;

export const farmSpecOf = (type) => FARM_FORM_SPEC[String(type || "").trim()] || [];

// فیلدهایی که واقعاً به payload می‌روند (payload: false = فقط UI)
export const farmPayloadFieldsOf = (type) =>
  farmSpecOf(type).filter((field) => field.payload !== false);

// کلیدهای سفید payload هر نوع — مشتق از spec (نه فهرست دستی)
export const farmPayloadKeysOf = (type) =>
  farmPayloadFieldsOf(type).map((field) => field.key);

export const FARM_PAYLOAD_KEYS = FARM_TYPE_KEYS.reduce((acc, type) => {
  acc[type] = farmPayloadKeysOf(type);
  return acc;
}, {});

// برچسب فارسی فیلدها برای خلاصهٔ payload در فهرست درخواست‌ها
export const FARM_FIELD_LABEL = FARM_TYPE_KEYS.reduce((acc, type) => {
  farmSpecOf(type).forEach((field) => {
    if (!acc[field.key]) acc[field.key] = field.label;
  });
  return acc;
}, {});

// ✅ ۱۳.۱۶: نوع و دیکشنری هر کلید payload — مشتق از spec (نه فهرست دوم)
// ------------------------------------------------------------
//  چرا لازم شد؟ نمایش «نامدار» payload (نام نژاد به‌جای `breed_id: 3`
//  و نام بیماری‌ها به‌جای «۵ مورد») در پورتال و صف کارشناس به این
//  دو نقشه نیاز دارد. اگر دستی نوشته می‌شد، سومین نسخهٔ قواعد
//  ساخته می‌شد؛ این‌جا از همان spec مشتق می‌شود.
export const FARM_FIELD_TYPE = FARM_TYPE_KEYS.reduce((acc, type) => {
  farmSpecOf(type).forEach((field) => {
    if (!acc[field.key]) acc[field.key] = field.type || "text";
  });
  return acc;
}, {});

export const FARM_FIELD_DICT = FARM_TYPE_KEYS.reduce((acc, type) => {
  farmSpecOf(type).forEach((field) => {
    if (field.dict && !acc[field.key]) acc[field.key] = field.dict;
  });
  return acc;
}, {});

// برچسب/آیکون نوع (برای کارت درخواست‌های من)
export const farmTypeMeta = (type) =>
  FARM_REQUEST_TYPES.find((item) => item.key === String(type || "").trim()) || null;

// فیلد «هدف» هر نوع (فقط برای پیام‌های UI — سرور خودش target دارد)
export const farmTargetFieldOf = (type) =>
  (farmTypeMeta(type) || {}).target || "unit_id";

// تنها نوع شناخته‌شده؛ هر چیز دیگر ⇒ خطای روشن پیش از ارسال
export const farmTypeKey = (raw) => {
  const key = String(raw === null || raw === undefined ? "" : raw).trim();
  if (!FARM_TYPE_KEYS.includes(key)) {
    throw new Error("نوع درخواست نامعتبر است");
  }
  return key;
};

// ============================================================
// ۶) نرمال‌سازی مقادیر (آینهٔ sanitizePayload سرور)
// ------------------------------------------------------------
//  🔒 payload هرگز کلید ناشناخته ندارد: فقط کلیدهای spec همان نوع.
// ============================================================

// ارقام فارسی/عربی ⇒ لاتین + ممیز فارسی ⇒ نقطه (هم‌قاعده با سرور)
const toNumeric = (value) => {
  const raw = String(value === null || value === undefined ? "" : value)
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[٫,]/g, ".")
    .trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

// آرایهٔ شناسه: عدد مثبت، بدون تکرار، سقف ۱۰۰ (هم‌قاعده با sanitizeIdList)
const idListOf = (value) => {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.slice(0, FARM_MAX_ID_LIST_ITEMS).forEach((item) => {
    const parsed = toNumeric(item);
    if (!Number.isInteger(parsed) || parsed <= 0) return;
    if (!out.includes(parsed)) out.push(parsed);
  });
  return out;
};

// ردیف تجهیزات: فقط کلیدهای سفید سرور (LIST_ITEM_ALLOWED_KEYS) و
// ردیف بدون «دسته» دور ریخته می‌شود (همان قاعدهٔ normalizeItems).
const ITEM_TEXT_KEYS = ["category", "spec", "size", "capacity"];
const ITEM_NUMERIC_KEYS = ["type_id", "quantity"];

const itemRowOf = (row) => {
  const source = row && typeof row === "object" ? row : {};
  const out = {};
  ITEM_NUMERIC_KEYS.forEach((key) => {
    const parsed = toNumeric(source[key]);
    if (parsed !== null) out[key] = parsed;
  });
  ITEM_TEXT_KEYS.forEach((key) => {
    const value = String(source[key] === null || source[key] === undefined ? "" : source[key])
      .trim()
      .slice(0, 100);
    if (value) out[key] = value;
  });
  return out.category ? out : null;
};

// بدنهٔ payload: فقط کلیدهای سفید همان نوع + نرمال‌سازی سبک
export const farmPayload = (type, input = {}) => {
  const key = farmTypeKey(type);
  const source = input && typeof input === "object" ? input : {};
  const payload = {};

  farmPayloadFieldsOf(key).forEach((field) => {
    if (!Object.prototype.hasOwnProperty.call(source, field.key)) return;
    const raw = source[field.key];

    if (field.type === "items") {
      const rows = Array.isArray(raw) ? raw : [];
      const items = rows
        .slice(0, FARM_MAX_LIST_ITEMS)
        .map(itemRowOf)
        .filter(Boolean);
      if (items.length) payload[field.key] = items;
      return;
    }

    if (field.type === "multi") {
      // آرایهٔ خالی هم معنا دارد: «همهٔ آیتم‌ها برداشته شود»
      payload[field.key] = idListOf(raw);
      return;
    }

    if (field.type === "check" || field.type === "radio") {
      payload[field.key] =
        raw === true || raw === "true" || raw === "on" || raw === 1 || raw === "1";
      return;
    }

    if (field.key === "note") {
      const note = String(raw === null || raw === undefined ? "" : raw)
        .trim()
        .slice(0, FARM_MAX_NOTE_LENGTH);
      if (note) payload[field.key] = note;
      return;
    }

    if (field.type === "number") {
      const parsed = toNumeric(raw);
      if (parsed !== null) payload[field.key] = parsed;
      return;
    }

    const text = String(raw === null || raw === undefined ? "" : raw).trim();
    if (!text) return;
    payload[field.key] = text.slice(0, field.maxLength || 100);
  });

  return payload;
};




