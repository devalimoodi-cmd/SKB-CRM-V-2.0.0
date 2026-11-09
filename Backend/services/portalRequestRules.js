// ============================================================
// services/portalRequestRules.js
// قواعد خالصِ «درخواست‌های فارم» — موج ۱۳.۱۱
// ------------------------------------------------------------
//  این فایل هیچ کوئری‌ای نمی‌زند و هیچ ماژول دیتابیسی نمی‌شناسد؛
//  فقط تصمیم می‌گیرد «چه چیزی مجاز است» و «چه وضعیتی درست است».
//  چرا جدا؟
//   ۱) صف کارشناس و فرم مشتری باید **یک** منبع اعتبارسنجی داشته
//      باشند؛ اگر دو نسخه شود، تأیید کارشناس چیزی را می‌پذیرد که
//      فرم رد می‌کند (یا بدتر: برعکس).
//   ۲) تست بدون دیتابیس می‌تواند همین منطق را اجرا کند
//      (Backend/portal-request-test.mjs).
// ------------------------------------------------------------
// 🔒 قواعد تغییرناپذیر:
//  ۱) `sanitizePayload` فقط کلیدهای سفیدِ همان نوع را نگه می‌دارد؛
//     `customer_id` / `status` / `reviewed_by` / هر کلید دیگرِ بدنه
//     **حذف** می‌شود. هیچ کنترلری بدنهٔ خام را ذخیره نمی‌کند.
//  ۲) `validatePayload` برای واحد/جوجه‌ریزی به همان اعتبارسنجی‌های
//     موجود (validations/*) تکیه می‌کند تا قاعده دو نسخه نشود؛
//     فیلدهایی که مشتری پر نمی‌کند (مثل مدیر واحد) در لایهٔ اعمال
//     از پروندهٔ مشتری تکمیل می‌شوند (services/portalRequestService).
//  ۳) گذارهای وضعیت تابع‌اند، نه آرایهٔ مقادیر دمدستی: هر تغییری
//     باید از approvalPatch/rejectionPatch/cancelPatch بگذرد.
//  ۴) نمای خروجی مشتری هرگز ستون‌های ممیزی (IP/User-Agent/بازبین)
//     را برنمی‌گرداند.
// ============================================================
"use strict";

const { validateUnitData } = require("../validations/unitValidation");
const {
  validateChickPlacement,
} = require("../validations/chickPlacementValidation");
// ✅ ۱۳.۱۳: اعتبارسنجی/فهرست سفید «اطلاعات تکمیلی سالن» از یک منبع
// (همان ماژولی که مسیر کارشناس اجرا می‌کند ⇒ نسخهٔ دوم ساخته نمی‌شود).
const {
  HALL_DETAIL_VALIDATORS,
  HALL_DETAIL_FIELDS,
} = require("../validations/hallDetailValidation");

// ============================================
// ۱) انواع درخواست و برچسب‌ها
// ============================================
const REQUEST_TYPES = [
  {
    key: "unit_create",
    label: "ثبت واحد مرغداری",
    description: "افزودن یک واحد تازه به پروندهٔ خودتان",
    icon: "fa-building",
  },
  {
    key: "hall_create",
    label: "ثبت سالن",
    description: "افزودن سالن به یکی از واحدهای موجود شما",
    icon: "fa-warehouse",
  },
  {
    key: "placement_create",
    label: "ثبت جوجه‌ریزی",
    description: "ثبت دورهٔ تازه در یکی از سالن‌های شما",
    icon: "fa-egg",
  },
  // --------------------------------------------
  // ✅ ۱۳.۱۳ — ویرایش/حذف واحد و سالن
  // --------------------------------------------
  {
    key: "unit_update",
    label: "ویرایش واحد مرغداری",
    description: "اصلاح نام، آدرس، ظرفیت یا اطلاعات تماس واحد",
    icon: "fa-pen-to-square",
    destructive: false,
    target: "unit_id",
  },
  {
    key: "unit_delete",
    label: "حذف واحد مرغداری",
    description:
      "حذف واحد همراه همهٔ سالن‌ها، دوره‌ها، هفته‌ها و بازدیدهای آن (بازگشت‌ناپذیر)",
    icon: "fa-trash-can",
    destructive: true,
    target: "unit_id",
  },
  {
    key: "hall_update",
    label: "ویرایش سالن",
    description: "اصلاح نام، شماره، ظرفیت یا مشخصات ساختمانی سالن",
    icon: "fa-pen-to-square",
    destructive: false,
    target: "hall_id",
  },
  {
    key: "hall_delete",
    label: "حذف سالن",
    description: "حذف سالن از واحد (سوابق بازدید و هفته‌ها دست‌نخورده می‌ماند)",
    icon: "fa-trash-can",
    destructive: true,
    target: "hall_id",
  },
  // --------------------------------------------
  // ✅ ۱۳.۱۳ — اطلاعات تکمیلی سالن (چهار حوزه)
  // --------------------------------------------
  {
    key: "hall_physical_save",
    label: "ثبت اطلاعات فیزیکی سالن",
    description: "ابعاد، مساحت و نوع کف سالن",
    icon: "fa-ruler-combined",
    destructive: false,
    target: "hall_id",
  },
  {
    key: "hall_system_save",
    label: "ثبت سیستم‌های سالن",
    description: "گرمایش، سرمایش، تهویه، فن، روشنایی و ردیف‌های تجهیزات",
    icon: "fa-fan",
    destructive: false,
    target: "hall_id",
  },
  {
    key: "hall_water_feed_save",
    label: "ثبت آب‌خوری و دان‌خوری",
    description: "نوع آب‌خوری/دان‌خوری و تعداد خطوط آب و دان",
    icon: "fa-droplet",
    destructive: false,
    target: "hall_id",
  },
  {
    key: "hall_hygiene_save",
    label: "ثبت بهداشت سالن",
    description: "تاریخ شست‌وشو، ضدعفونی و نوع مادهٔ ضدعفونی",
    icon: "fa-pump-medical",
    destructive: false,
    target: "hall_id",
  },
];

const REQUEST_TYPE_KEYS = REQUEST_TYPES.map((item) => item.key);

const typeOf = (key) => REQUEST_TYPES.find((item) => item.key === key) || null;

const typeLabel = (key) => {
  const found = typeOf(key);
  return found ? found.label : String(key || "");
};

const isRequestType = (key) => Boolean(typeOf(key));

// ✅ ۱۳.۱۳: انواع «حذف» برای هشدار مودال بازبینی و مستندات
const DESTRUCTIVE_TYPES = REQUEST_TYPES.filter((item) => item.destructive).map(
  (item) => item.key,
);

const isDestructiveType = (key) => DESTRUCTIVE_TYPES.includes(key);

// ستون شناسهٔ ردیف هدفِ هر نوع (برای بررسی مالکیت در لایهٔ اعمال)
const targetFieldOf = (key) => {
  const found = typeOf(key);
  return found ? found.target || null : null;
};

// ============================================
// ۲) وضعیت‌ها
// ------------------------------------------------------------
//  pending   = در انتظار بازبینی کارشناس (تنها وضعیت قابل تأیید/رد)
//  approved  = تأیید و اعمال شد (ردیف واقعی ساخته شد)
//  rejected  = رد شد (دلیل اجباری است و به مشتری نشان داده می‌شود)
//  cancelled = خود مشتری پیش از بازبینی لغو کرد
// ============================================
const PENDING_STATUS = "pending";

const REQUEST_STATUSES = [
  { key: "pending", label: "در انتظار تأیید کارشناس", tone: "warning" },
  { key: "approved", label: "تأییدشده", tone: "success" },
  { key: "rejected", label: "ردشده", tone: "danger" },
  { key: "cancelled", label: "لغوشده", tone: "muted" },
];

const REQUEST_STATUS_KEYS = REQUEST_STATUSES.map((item) => item.key);

const statusOf = (key) =>
  REQUEST_STATUSES.find((item) => item.key === key) || null;

const statusLabel = (key) => {
  const found = statusOf(key);
  return found ? found.label : String(key || "");
};

const isStatus = (key) => Boolean(statusOf(key));

// فیلتر وضعیت/نوع: مقدار ناشناخته ⇒ «همه» (null)، نه خطا
const normalizeStatusFilter = (value) => {
  const raw = String(value == null ? "" : value).trim();
  if (!raw || raw === "all" || raw === "همه") return null;
  return isStatus(raw) ? raw : null;
};

const normalizeTypeFilter = (value) => {
  const raw = String(value == null ? "" : value).trim();
  if (!raw || raw === "all" || raw === "همه") return null;
  return isRequestType(raw) ? raw : null;
};
// ============================================
// ۳) سقف‌ها
// ------------------------------------------------------------
//  MAX_PENDING_REQUESTS: صف کارشناس نباید با ثبت انبوه پر شود؛
//  ۱۰ درخواست باز برای هر پرونده سقف منطقی است (بقیه اول تعیین
//  تکلیف شوند). MAX_PAYLOAD_BYTES: payload در یک ستون JSONB
//  می‌نشیند.
//  ⚠️ ۱۳.۱۳: سقف از ۴KB به ۸KB رفت؛ چون `hall_system_save` می‌تواند
//  تا ۶۰ ردیف تجهیزات داشته باشد (همان سقف اعتبارسنج کارشناس) و
//  ۴KB برای یک درخواست کامل کافی نبود. بقیهٔ انواع از همین سقف
//  مشترک استفاده می‌کنند و همچنان کران‌دار است.
// ============================================
const MAX_PENDING_REQUESTS = 10;
const MAX_PAYLOAD_BYTES = 8192;
// سقف ردیف‌های تجهیزات (همان سقف اعتبارسنج کارشناس) — این‌جا تعریف
// می‌شود تا هم پیام فارسی و هم sanitize از یک عدد بخوانند.
const MAX_LIST_ITEMS = 60;
const MIN_REASON_LENGTH = 3;
const MAX_REASON_LENGTH = 300;
const MAX_NOTE_LENGTH = 300;

const LIMITS = {
  max_pending: MAX_PENDING_REQUESTS,
  max_payload_bytes: MAX_PAYLOAD_BYTES,
  min_reason_length: MIN_REASON_LENGTH,
  max_reason_length: MAX_REASON_LENGTH,
  max_note_length: MAX_NOTE_LENGTH,
};

// ============================================
// ۴) پیام‌های فارسی (یک منبع — کنترلرها از همین‌ها می‌خوانند)
// ============================================
const REQUEST_MESSAGES = {
  unlinked:
    "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
  invalid_type: "نوع درخواست معتبر نیست",
  invalid_status: "وضعیت درخواست معتبر نیست",
  payload_empty: "هیچ داده‌ای برای ثبت ارسال نشده است",
  payload_too_large: "حجم اطلاعات درخواست بیش از حد مجاز است",
  validation_failed: "اطلاعات درخواست کامل یا معتبر نیست",
  too_many_pending: `حداکثر ${MAX_PENDING_REQUESTS} درخواست در انتظار تأیید می‌توانید داشته باشید؛ ابتدا وضعیت درخواست‌های قبلی مشخص شود`,
  duplicate_pending:
    "درخواست مشابهی از شما در انتظار تأیید است؛ تا تعیین تکلیف آن، درخواست تکراری ثبت نمی‌شود",
  not_found: "درخواست یافت نشد",
  already_reviewed: "این درخواست قبلاً بررسی شده است",
  reason_required: `دلیل رد الزامی است (حداقل ${MIN_REASON_LENGTH} کاراکتر)`,
  cancel_only_pending: "فقط درخواست‌های در انتظار تأیید قابل لغو هستند",
  apply_failed: "اعمال درخواست ناموفق بود؛ هیچ تغییری در داده‌ها ثبت نشد",
  unit_not_found: "واحد انتخاب‌شده در پروندهٔ شما نیست",
  hall_not_found: "سالن انتخاب‌شده در پروندهٔ شما نیست",
  hall_unit_mismatch: "سالن انتخاب‌شده متعلق به این واحد نیست",
  unit_name_taken: "واحدی با این نام در پروندهٔ شما ثبت شده است",
  hall_number_taken: "سالنی با این شماره در این واحد وجود دارد",
  hall_busy:
    "این سالن در حال حاضر جوجه‌ریزی فعال دارد؛ ابتدا دورهٔ فعلی را پایان دهید",
  flock_not_found: "گلهٔ انتخاب‌شده در پروندهٔ شما نیست",
  flock_not_active: "گلهٔ انتخاب‌شده فعال نیست",
  flock_unit_mismatch: "گلهٔ انتخاب‌شده متعلق به این واحد نیست",
  manager_info_missing:
    "نام و شمارهٔ مدیر واحد نه در درخواست بود و نه در پروندهٔ شما؛ لطفاً آن را در درخواست بنویسید",
  note_too_long: `توضیح درخواست حداکثر ${MAX_NOTE_LENGTH} کاراکتر است`,
  // ✅ ۱۳.۱۳ — ویرایش/حذف/جزئیات
  nothing_to_change: "هیچ تغییری برای ثبت ارسال نشده است",
  confirm_name_required:
    "برای حذف واحد باید نام واحد را عیناً در فیلد تأیید بنویسید",
  confirm_name_mismatch:
    "نام واردشده برای تأیید حذف با نام فعلی واحد مطابقت ندارد",
  hall_detail_hall_missing: "سالن انتخاب‌شده در پروندهٔ شما نیست",
  too_many_items: `حداکثر ${MAX_LIST_ITEMS} ردیف تجهیزات برای هر سالن مجاز است`,
};
// ============================================
// ۵) فهرست سفید payload به‌ازای هر نوع
// ------------------------------------------------------------
//  ⚠️ هیچ‌کدام از این فهرست‌ها `customer_id`، `status`، `id`،
//  `reviewed_by` یا `unit_status_id` را ندارد؛ پس حتی اگر کلاینت
//  آن‌ها را بفرستد، در sanitizePayload حذف می‌شوند.
// ============================================
// ✅ ۱۳.۱۳: فهرست سفید چهار حوزهٔ جزئیات سالن از همان ماژول کارشناس
// می‌آید (`HALL_DETAIL_FIELDS`). فقط دو تغییر عمدی:
//   • `unit_id` حذف می‌شود ⇒ مشتری نمی‌تواند جزئیات را به واحد دیگری بچسباند
//     (لایهٔ اعمال آن را از خود ردیف سالن تکمیل می‌کند).
//   • `note` (توضیح درخواست) و در سیستم‌ها `items` اضافه می‌شوند.
const hallDetailPayloadKeys = (type, extra = []) => [
  ...(HALL_DETAIL_FIELDS[type] || []).filter((key) => key !== "unit_id"),
  ...extra,
  "note",
];

const ALLOWED_PAYLOAD_KEYS = {
  unit_create: [
    "unit_name",
    "address",
    "hall_count",
    "capacity",
    "longitude",
    "latitude",
    "manager_name",
    "manager_phone",
    "note",
  ],
  hall_create: [
    "unit_id",
    "hall_name",
    "hall_number",
    "nominal_capacity",
    "altitude_above_sea",
    "hall_type_id",
    "construction_year",
    "operator_name",
    "note",
  ],
  placement_create: [
    "unit_id",
    "hall_id",
    "placement_date",
    "chick_source_id",
    "breed_id",
    "chick_age_on_arrival",
    "avg_initial_weight",
    "total_chicks_count",
    "placement_density",
    "flock_id",
    "start_new_flock",
    "note",
  ],
  // ✅ ۱۳.۱۳ — ویرایش/حذف
  unit_update: [
    "unit_id",
    "unit_name",
    "address",
    "hall_count",
    "capacity",
    "longitude",
    "latitude",
    "manager_name",
    "manager_phone",
    "note",
  ],
  unit_delete: ["unit_id", "confirm_name", "note"],
  hall_update: [
    "hall_id",
    "hall_name",
    "hall_number",
    "nominal_capacity",
    "altitude_above_sea",
    "hall_type_id",
    "construction_year",
    "operator_name",
    "note",
  ],
  hall_delete: ["hall_id", "note"],
  // ✅ ۱۳.۱۳ — اطلاعات تکمیلی سالن (بدون `unit_id`: از خود سالن مشتق می‌شود)
  hall_physical_save: hallDetailPayloadKeys("hall_physical_save"),
  hall_system_save: hallDetailPayloadKeys("hall_system_save", ["items"]),
  hall_water_feed_save: hallDetailPayloadKeys("hall_water_feed_save"),
  hall_hygiene_save: hallDetailPayloadKeys("hall_hygiene_save"),
};

// فیلدهای عددی (تبدیل + «خالی ⇒ حذف»)
const NUMERIC_FIELDS = {
  unit_create: ["hall_count", "capacity", "longitude", "latitude"],
  hall_create: [
    "unit_id",
    "nominal_capacity",
    "altitude_above_sea",
    "hall_type_id",
    "construction_year",
  ],
  placement_create: [
    "unit_id",
    "hall_id",
    "chick_source_id",
    "breed_id",
    "chick_age_on_arrival",
    "avg_initial_weight",
    "total_chicks_count",
    "placement_density",
    "flock_id",
  ],
  // ✅ ۱۳.۱۳
  unit_update: ["unit_id", "hall_count", "capacity", "longitude", "latitude"],
  unit_delete: ["unit_id"],
  hall_update: [
    "hall_id",
    "nominal_capacity",
    "altitude_above_sea",
    "hall_type_id",
    "construction_year",
  ],
  hall_delete: ["hall_id"],
  hall_physical_save: [
    "hall_id",
    "length",
    "width",
    "height",
    "area",
    "floor_type_id",
  ],
  hall_system_save: [
    "hall_id",
    "fan_count",
    "heater_count",
    "heating_system_id",
    "cooling_system_id",
    "ventilation_system_id",
    "water_inlet_system_id",
    "lighting_system_id",
  ],
  hall_water_feed_save: [
    "hall_id",
    "waterer_type_id",
    "feeder_type_id",
    "water_lines_count",
    "feed_lines_count",
  ],
  hall_hygiene_save: ["hall_id"],
};

// فیلدهای منطقی
const BOOLEAN_FIELDS = {
  unit_create: [],
  hall_create: [],
  placement_create: ["start_new_flock"],
  unit_update: [],
  unit_delete: [],
  hall_update: [],
  hall_delete: [],
  hall_physical_save: [],
  hall_system_save: [],
  hall_water_feed_save: ["auto_feed_system"],
  hall_hygiene_save: [],
};

// فیلدهای تاریخ (رشتهٔ ISO — همان چیزی که سکوئلایز می‌پذیرد)
const DATE_FIELDS = {
  unit_create: [],
  hall_create: [],
  placement_create: ["placement_date"],
  unit_update: [],
  unit_delete: [],
  hall_update: [],
  hall_delete: [],
  hall_physical_save: [],
  hall_system_save: [],
  hall_water_feed_save: [],
  hall_hygiene_save: ["last_wash_date", "last_disinfect_date"],
};

// حداکثر طول رشته‌ها (کلیدهایی که اینجا نیستند: ۱۰۰)
const TEXT_LIMITS = {
  unit_name: 100,
  address: 500,
  manager_name: 100,
  manager_phone: 20,
  hall_name: 100,
  hall_number: 50,
  operator_name: 100,
  placement_date: 30,
  note: MAX_NOTE_LENGTH,
  // ✅ ۱۳.۱۳
  confirm_name: 100,
  length: 20,
  width: 20,
  height: 20,
  area: 20,
  fan_size: 50,
  fan_capacity: 50,
  notes: 300,
  disinfectant_type: 100,
  description: 500,
};

// ============================================
// ۵.۱) فیلدهای آرایه‌ای (ردیف‌های تجهیزات سالن)
// ------------------------------------------------------------
//  ✅ ۱۳.۱۳: تنها جایی که payload آرایه دارد `hall_system_save.items`
//  است. هر ردیف فقط کلیدهای سفیدِ خودش را دارد و ردیف بدون «دسته»
//  (همان قاعدهٔ hallDetailsWrite.normalizeItems) حذف می‌شود.
//  ⚠️ عمداً ردیف‌های با «دستهٔ ناشناخته» حذف نمی‌شوند؛ اعتبارسنج
//  همان ماژول کارشناس آن‌ها را با پیام روشن رد می‌کند.
// ============================================
const LIST_FIELDS = {
  hall_system_save: ["items"],
};

const LIST_ITEM_ALLOWED_KEYS = [
  "category",
  "type_id",
  "quantity",
  "spec",
  "size",
  "capacity",
];

const LIST_ITEM_NUMERIC_KEYS = ["type_id", "quantity"];

// ⚠️ سقف ردیف‌ها همان `MAX_LIST_ITEMS` بالاست (۶۰)؛ یکی بیشتر
// می‌خوانیم تا اگر کاربر بیشتر فرستاد، اعتبارسنج پیام «حداکثر ۶۰ ردیف»
// بدهد (نه اینکه اضافه‌ها بی‌صدا بریده شوند).

const MAX_ITEM_TEXT = {
  category: 20,
  spec: 100,
  size: 50,
  capacity: 50,
};

// ارقام فارسی/عربی ⇒ لاتین (کاربر موبایل معمولاً ارقام فارسی می‌فرستد)
const normalizeDigits = (value) =>
  String(value == null ? "" : value)
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660));

// متن: trim + حذف کاراکترهای کنترلی + بریدن طول
// ⚠️ ارقام فارسی در متن آزاد (آدرس/توضیح) دست‌نخورده می‌مانند؛
//    تبدیل رقم فقط برای فیلدهای عددی/تاریخ انجام می‌شود.
const normalizeText = (value, maxLength = 100) => {
  if (value === null || value === undefined) return null;
  const clean = String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return null;
  return clean.slice(0, maxLength);
};

// عدد: «۱۲۳» ⇒ 123 · «abc» ⇒ NaN (در اعتبارسنجی خطا می‌شود)
const toNumber = (value) => {
  const raw = normalizeDigits(value).replace(/[٫,]/g, ".").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : NaN;
};
// ============================================
// ۶) پاک‌سازی payload
// ------------------------------------------------------------
//  ورودی: بدنهٔ خام کلاینت — خروجی: فقط کلیدهای سفیدِ همان نوع.
//  ⚠️ این تابع تنها دروازهٔ ورود داده به ستون payload است.
// ============================================
// ✅ ۱۳.۱۳: فیلدهای متنی‌ای که «رقم» هستند و باید ارقام فارسی/عربی
// آن‌ها لاتین شود (کاربر موبایل معمولاً با صفحه‌کلید فارسی تایپ می‌کند).
// ⚠️ این فقط برای همین دو کلید است؛ متن‌های آزاد (آدرس/توضیح) دست‌نخورده
// می‌مانند — همان قاعدهٔ قبلی.
const DIGIT_TEXT_FIELDS = ["hall_number", "manager_phone"];

// پاک‌سازی یک ردیف تجهیزات (کلیدهای سفید + عددی‌ها + برش متن)
const sanitizeListItems = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_LIST_ITEMS + 1)
    .map((item) => {
      const source = item && typeof item === "object" ? item : {};
      const row = {};
      for (const key of LIST_ITEM_ALLOWED_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
        if (LIST_ITEM_NUMERIC_KEYS.includes(key)) {
          const parsed = toNumber(source[key]);
          if (parsed !== null) row[key] = parsed;
          continue;
        }
        const text = normalizeText(source[key], MAX_ITEM_TEXT[key] || 50);
        if (text !== null) row[key] = text;
      }
      // ردیف بدون دسته بی‌معناست (همان قاعدهٔ normalizeItems کارشناس)
      return row.category ? row : null;
    })
    .filter(Boolean);
};

const sanitizePayload = (type, body) => {
  const allowed = ALLOWED_PAYLOAD_KEYS[type];
  if (!allowed) return {};

  const source = body && typeof body === "object" ? body : {};
  const numerics = NUMERIC_FIELDS[type] || [];
  const booleans = BOOLEAN_FIELDS[type] || [];
  const dates = DATE_FIELDS[type] || [];
  const lists = LIST_FIELDS[type] || [];

  const payload = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const value = source[key];

    if (lists.includes(key)) {
      // `sanitizeListItems` حداکثر ۶۱ ردیف برمی‌گرداند (یک بیشتر از
      // سقف) تا اعتبارسنج اگر بیشتر فرستاده شده، پیام روشن بدهد.
      payload[key] = sanitizeListItems(value);
      continue;
    }

    if (numerics.includes(key)) {
      const parsed = toNumber(value);
      if (parsed !== null) payload[key] = parsed;
      continue;
    }

    if (booleans.includes(key)) {
      payload[key] =
        value === true ||
        value === "true" ||
        value === "on" ||
        value === 1 ||
        value === "1";
      continue;
    }

    if (dates.includes(key)) {
      const text = normalizeText(value, TEXT_LIMITS[key] || 30);
      if (text) payload[key] = text;
      continue;
    }

    const text = normalizeText(
      DIGIT_TEXT_FIELDS.includes(key) ? normalizeDigits(value) : value,
      TEXT_LIMITS[key] || 100,
    );
    if (text !== null) payload[key] = text;
  }

  return payload;
};

// حجم payload به بایت (UTF-8) — همان چیزی که در JSONB می‌نشیند
const payloadSizeBytes = (payload) => {
  try {
    return Buffer.byteLength(JSON.stringify(payload || {}), "utf8");
  } catch {
    return 0;
  }
};

// آیا payload «خالی» است؟ (هیچ فیلد معناداری ندارد)
const isPayloadEmpty = (payload) =>
  !payload || Object.keys(payload).length === 0;

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

const isIntInRange = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;
// ============================================
// ۷) اعتبارسنجی payload
// ------------------------------------------------------------
//  خروجی همیشه { isValid, errors: [] } است (هم‌شکل با validations/*).
//  برای واحد/جوجه‌ریزی به همان اعتبارسنجی‌های موجود تکیه می‌کنیم تا
//  قاعدهٔ «چه چیزی معتبر است» دو نسخه نشود؛ فقط شناسهٔ مشتری و
//  فیلدهایی که مشتری پر نمی‌کند با مقدار خنثی پر می‌شوند.
// ============================================
const validateUnitPayload = (payload) => {
  // اعتبارسنجی موجود، وجود «مدیر» را الزامی می‌داند؛ مشتری آن را
  // همیشه نمی‌داند ⇒ در درخواست اختیاری است و در زمان اعمال از
  // پروندهٔ مشتری تکمیل می‌شود (portalRequestService).
  const probe = {
    ...payload,
    customer_personal_information_id: 1,
    manager_name: payload.manager_name || "درخواست پورتال",
    manager_phone: payload.manager_phone || "00000000000",
  };
  const errors = validateUnitData(probe).errors.slice();

  if (
    payload.manager_phone &&
    !/^[0-9]{11}$/.test(String(payload.manager_phone))
  ) {
    errors.push("شمارهٔ تماس مدیر باید ۱۱ رقم باشد");
  }

  return { isValid: errors.length === 0, errors };
};

// ------------------------------------------------------------
//  ✅ ۱۳.۱۳: این تابع به `validateHallFields` شکسته شد تا «ثبت سالن»
//  و «ویرایش سالن» یک قاعده داشته باشند؛ ثبت = unit و نام اجباری،
//  ویرایش = هیچ‌کدام اجباری نیست (فقط اگر فرستاده شدند بررسی می‌شوند).
// ------------------------------------------------------------
const validateHallFields = (
  payload,
  { requireUnit = true, requireName = true } = {},
) => {
  const errors = [];

  if (requireUnit && !isPositiveInt(payload.unit_id)) {
    errors.push("شناسهٔ واحد الزامی است");
  }
  if (!payload.hall_name) {
    if (requireName) errors.push("نام سالن الزامی است");
  } else if (payload.hall_name.length < 2) {
    errors.push("نام سالن باید حداقل ۲ کاراکتر باشد");
  }
  if (payload.hall_number !== undefined) {
    if (!/^[0-9]{1,3}$/.test(String(payload.hall_number))) {
      errors.push("شمارهٔ سالن باید عددی بین ۱ تا ۹۹۹ باشد");
    }
  }
  if (
    payload.nominal_capacity !== undefined &&
    !isIntInRange(payload.nominal_capacity, 1, 200000)
  ) {
    errors.push("ظرفیت اسمی سالن باید عددی بین ۱ تا ۲۰۰,۰۰۰ باشد");
  }
  if (
    payload.altitude_above_sea !== undefined &&
    !isIntInRange(payload.altitude_above_sea, -500, 9000)
  ) {
    errors.push("ارتفاع از سطح دریا باید عددی بین ۵۰۰- تا ۹,۰۰۰ باشد");
  }
  if (
    payload.hall_type_id !== undefined &&
    !isPositiveInt(payload.hall_type_id)
  ) {
    errors.push("نوع سالن معتبر نیست");
  }
  if (
    payload.construction_year !== undefined &&
    !isIntInRange(payload.construction_year, 1300, 2100)
  ) {
    errors.push("سال ساخت باید عددی بین ۱۳۰۰ تا ۲۱۰۰ باشد");
  }

  return { isValid: errors.length === 0, errors };
};

const validateHallPayload = (payload) => validateHallFields(payload);

const validatePlacementPayload = (payload) => {
  const errors = validateChickPlacement({
    ...payload,
    customer_id: 1,
  }).errors.slice();

  if (!isPositiveInt(payload.unit_id)) {
    errors.push("شناسهٔ واحد الزامی است");
  }
  if (payload.placement_density !== undefined) {
    if (!isIntInRange(payload.placement_density, 1, 100)) {
      errors.push("تراکم جوجه‌ریزی باید عددی بین ۱ تا ۱۰۰ باشد");
    }
  }
  if (payload.flock_id !== undefined && !isPositiveInt(payload.flock_id)) {
    errors.push("گلهٔ انتخاب‌شده معتبر نیست");
  }

  return { isValid: errors.length === 0, errors };
};

// --------------------------------------------
// ۷.۴) ویرایش/حذف واحد  (✅ ۱۳.۱۳)
// ------------------------------------------------------------
//  برای «ویرایش» همان `validateUnitData` کارشناس اجرا می‌شود، ولی
//  فیلدهای اجباریِ نیامده با مقدار خنثی پر می‌شوند؛ پس فقط فیلدهایی
//  که مشتری واقعاً فرستاده بررسی می‌شوند (قاعدهٔ «ثبت» دست‌نخورده).
// --------------------------------------------
const UNIT_UPDATE_PLACEHOLDERS = {
  unit_name: "واحد",
  address: "بدون آدرس",
  hall_count: 1,
  capacity: 0,
  manager_name: "مدیر",
  manager_phone: "00000000000",
};

// کلیدهایی که «تغییر» حساب نمی‌شوند (شناسهٔ ردیف و توضیح درخواست)
const NON_CHANGE_KEYS = ["unit_id", "hall_id", "placement_id", "note", "confirm_name"];

const changeKeysOf = (payload) =>
  Object.keys(payload || {}).filter((key) => !NON_CHANGE_KEYS.includes(key));

const validateUnitUpdatePayload = (payload) => {
  const errors = [];

  if (!isPositiveInt(payload.unit_id)) {
    errors.push("شناسهٔ واحد الزامی است");
  }
  if (changeKeysOf(payload).length === 0) {
    errors.push(REQUEST_MESSAGES.nothing_to_change);
  }

  const filled = { ...payload };
  for (const [key, fallback] of Object.entries(UNIT_UPDATE_PLACEHOLDERS)) {
    if (filled[key] === undefined || filled[key] === null || filled[key] === "") {
      filled[key] = fallback;
    }
  }

  errors.push(...validateUnitPayload(filled).errors);
  return { isValid: errors.length === 0, errors };
};

const validateUnitDeletePayload = (payload) => {
  const errors = [];

  if (!isPositiveInt(payload.unit_id)) {
    errors.push("شناسهٔ واحد الزامی است");
  }
  if (!payload.confirm_name) {
    errors.push(REQUEST_MESSAGES.confirm_name_required);
  } else if (payload.confirm_name.trim().length < 2) {
    errors.push("نام واحد برای تأیید حذف معتبر نیست");
  }

  return { isValid: errors.length === 0, errors };
};

// --------------------------------------------
// ۷.۵) ویرایش/حذف سالن  (✅ ۱۳.۱۳)
// ------------------------------------------------------------
//  ⚠️ `unit_id` در فهرست سفید نیست ⇒ انتقال سالن بین واحدها از پورتال
//  ممکن نیست (عملیات کارشناس می‌ماند). شماره/نام/ظرفیت قابل ویرایش‌اند.
// --------------------------------------------
const validateHallUpdatePayload = (payload) => {
  const errors = [];

  if (!isPositiveInt(payload.hall_id)) {
    errors.push("شناسهٔ سالن الزامی است");
  }
  if (changeKeysOf(payload).length === 0) {
    errors.push(REQUEST_MESSAGES.nothing_to_change);
  }

  errors.push(
    ...validateHallFields(payload, { requireUnit: false, requireName: false })
      .errors,
  );

  return { isValid: errors.length === 0, errors };
};

const validateHallDeletePayload = (payload) => {
  const errors = [];
  if (!isPositiveInt(payload.hall_id)) {
    errors.push("شناسهٔ سالن الزامی است");
  }
  return { isValid: errors.length === 0, errors };
};

const PAYLOAD_VALIDATORS = {
  unit_create: validateUnitPayload,
  hall_create: validateHallPayload,
  placement_create: validatePlacementPayload,
  unit_update: validateUnitUpdatePayload,
  unit_delete: validateUnitDeletePayload,
  hall_update: validateHallUpdatePayload,
  hall_delete: validateHallDeletePayload,
};

// ✅ ۱۳.۱۳: چهار حوزهٔ جزئیات سالن دقیقاً همان اعتبارسنج کارشناس را
// اجرا می‌کنند (یک منبع) — نه نسخهٔ دوم.
for (const type of Object.keys(HALL_DETAIL_VALIDATORS)) {
  PAYLOAD_VALIDATORS[type] = (payload) =>
    HALL_DETAIL_VALIDATORS[type](payload);
}

// آیا این نوع اعتبارسنج payload دارد؟ (تست «هر نوع یک اعتبارسنج»)
const hasPayloadValidator = (type) =>
  typeof PAYLOAD_VALIDATORS[type] === "function";

const validatePayload = (type, payload) => {
  const validator = PAYLOAD_VALIDATORS[type];
  if (!validator) {
    return { isValid: false, errors: [REQUEST_MESSAGES.invalid_type] };
  }
  if (!payload || typeof payload !== "object") {
    return { isValid: false, errors: [REQUEST_MESSAGES.payload_empty] };
  }
  return validator(payload);
};
// ============================================
// ۸) گذارهای وضعیت (یک منبع — هیچ‌جا status دستی ست نمی‌شود)
// ============================================
const canReview = (status) => status === PENDING_STATUS;
const canCancel = (status) => status === PENDING_STATUS;

// دلیل رد: trim + بریدن طول؛ اگر کوتاه بود نامعتبر
const normalizeReason = (value) => {
  const text = normalizeText(value, MAX_REASON_LENGTH);
  return text && text.length >= MIN_REASON_LENGTH ? text : null;
};

const validateReason = (value) => {
  const text = normalizeReason(value);
  return text
    ? { isValid: true, value: text, errors: [] }
    : { isValid: false, value: null, errors: [REQUEST_MESSAGES.reason_required] };
};

const approvalPatch = ({
  reviewerId = null,
  now = new Date(),
  entityId = null,
  summary = null,
} = {}) => ({
  status: "approved",
  reviewed_by: reviewerId,
  reviewed_at: now,
  applied_at: now,
  result_entity_id: entityId,
  result_summary: summary ? String(summary).slice(0, 300) : null,
  reject_reason: null,
});

const rejectionPatch = ({ reviewerId = null, now = new Date(), reason } = {}) => ({
  status: "rejected",
  reviewed_by: reviewerId,
  reviewed_at: now,
  applied_at: null,
  result_entity_id: null,
  result_summary: null,
  reject_reason: normalizeReason(reason),
});

// لغو توسط خود مشتری: کارشناس بازبینی نکرده؛ فقط «زمان بسته‌شدن» ثبت می‌شود
const cancelPatch = ({ now = new Date() } = {}) => ({
  status: "cancelled",
  reviewed_at: now,
  reject_reason: null,
});

// ============================================
// ۹) نمای خروجی
// ------------------------------------------------------------
//  🔒 مشتری: بدون submitted_ip / submitted_user_agent / reviewed_by /
//  customer_id. کارشناس: همان + شناسهٔ پرونده و بازبین (برای پیگیری).
// ============================================
const plainOf = (row) =>
  row && typeof row.get === "function" ? row.get({ plain: true }) : row || {};

const payloadOf = (row) => {
  const payload = plainOf(row).payload;
  return payload && typeof payload === "object" ? payload : {};
};

const customerRequestView = (row) => {
  const plain = plainOf(row);
  const payload = payloadOf(row);
  return {
    id: Number(plain.id),
    type: plain.request_type,
    type_label: typeLabel(plain.request_type),
    status: plain.status,
    status_label: statusLabel(plain.status),
    payload,
    note: payload.note || null,
    created_at: plain.created_at || null,
    reviewed_at: plain.reviewed_at || null,
    applied_at: plain.applied_at || null,
    reject_reason: plain.reject_reason || null,
    result_entity_id:
      plain.result_entity_id == null ? null : Number(plain.result_entity_id),
    result_summary: plain.result_summary || null,
  };
};

const adminRequestView = (row) => {
  const plain = plainOf(row);
  return {
    ...customerRequestView(row),
    customer_id: Number(plain.customer_id),
    submitted_by: plain.submitted_by == null ? null : Number(plain.submitted_by),
    reviewed_by: plain.reviewed_by == null ? null : Number(plain.reviewed_by),
  };
};

// ============================================
// صادرات
// ============================================
module.exports = {
  REQUEST_TYPES,
  REQUEST_TYPE_KEYS,
  REQUEST_STATUSES,
  REQUEST_STATUS_KEYS,
  REQUEST_MESSAGES,
  ALLOWED_PAYLOAD_KEYS,
  NUMERIC_FIELDS,
  BOOLEAN_FIELDS,
  DATE_FIELDS,
  LIST_FIELDS,
  LIST_ITEM_ALLOWED_KEYS,
  MAX_LIST_ITEMS,
  DESTRUCTIVE_TYPES,
  PENDING_STATUS,
  LIMITS,
  MAX_PENDING_REQUESTS,
  MAX_PAYLOAD_BYTES,
  MIN_REASON_LENGTH,
  MAX_REASON_LENGTH,
  MAX_NOTE_LENGTH,
  isRequestType,
  isStatus,
  isDestructiveType,
  typeOf,
  typeLabel,
  targetFieldOf,
  hasPayloadValidator,
  statusOf,
  statusLabel,
  normalizeStatusFilter,
  normalizeTypeFilter,
  normalizeDigits,
  normalizeText,
  normalizeReason,
  validateReason,
  sanitizePayload,
  payloadSizeBytes,
  isPayloadEmpty,
  validatePayload,
  canReview,
  canCancel,
  approvalPatch,
  rejectionPatch,
  cancelPatch,
  customerRequestView,
  adminRequestView,
};





