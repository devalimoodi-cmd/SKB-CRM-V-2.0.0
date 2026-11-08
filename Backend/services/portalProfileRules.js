// ============================================================
// services/portalProfileRules.js
// «قواعد خالص ویرایش پروفایل از پورتال مشتری» — فاز ۱۳.۸
// ------------------------------------------------------------
//  چرا فایل جدا و بدون I/O؟
//   • تنها مسیر *نوشتن* پورتال همین‌جاست؛ هر چه این‌جا باشد باید
//     بدون دیتابیس تست شود (مثل registrationRules / otpRules).
//   • فهرست سفید این‌جاست، پس کنترلر هیچ فیلدی را «دستی» انتخاب نمی‌کند.
//
// 🔒 قوانین تغییرناپذیر:
//  ۱) فقط کلیدهای PROFILE_EDITABLE از بدنه خوانده می‌شوند؛ بقیه در
//     ignored گزارش می‌شوند (نه خطا) تا کلاینت قدیمی نشکند.
//  ۲) هرگز قابل ویرایش نیست: id · customer_code · customer_type_id ·
//     mobile_number (مسیر جدا با کد پیامکی) · active · status ·
//     sales_department (داخلی) · created_by/updated_by.
//     ⇒ مشتری نمی‌تواند «نوع مشتری»، «وضعیت» یا «کد پرونده» را عوض کند.
//  ۳) شمارهٔ موبایل فقط با چالش پیامکی تغییر می‌کند
//     (purpose = PROFILE_MOBILE_PURPOSE در services/otpService).
// ============================================================
"use strict";

const { normalizeDigits, cleanText, isEmail } = require("./registrationRules");

// ============================================
// ۱) تعریف فیلدهای قابل ویرایش
// ------------------------------------------------------------
// kind: name | text | digits | email | date | choice
// ============================================
const PROFILE_FIELDS = {
  full_name: {
    title: "نام و نام خانوادگی",
    kind: "name",
    min: 3,
    max: 200,
    required: true,
  },
  farm_name: { title: "نام مرغداری", kind: "text", max: 200 },
  collection_name: { title: "نام مجموعه", kind: "text", max: 200 },
  national_code: { title: "کد ملی", kind: "digits", exact: 10 },
  email: { title: "ایمیل", kind: "email", max: 100 },
  date_of_birth: { title: "تاریخ تولد", kind: "date" },
  experience_years: { title: "سابقهٔ کار", kind: "text", max: 50 },
  education_level: { title: "سطح تحصیلات", kind: "text", max: 20 },
  gender: { title: "جنسیت", kind: "choice", choices: ["مرد", "زن"] },
  province: { title: "استان", kind: "text", max: 50 },
  county: { title: "شهرستان", kind: "text", max: 50 },
  postal_code: { title: "کد پستی", kind: "digits", exact: 10 },
  farm_address: { title: "آدرس مرغداری", kind: "text", max: 1000 },
  messaging_number: { title: "شمارهٔ پیام‌رسان", kind: "digits", min: 10, max: 15 },
  skb_how_know: { title: "نحوهٔ آشنایی با شرکت", kind: "text", max: 100 },
};

// فهرست سفید (ترتیب نمایش هم همین است)
const PROFILE_EDITABLE = Object.keys(PROFILE_FIELDS);

// فیلدهایی که حتی اگر در بدنه بیایند نادیده گرفته می‌شوند
// (mobile_number عمداً این‌جاست: مسیر جدا دارد)
const PROFILE_LOCKED = [
  "id",
  "customer_code",
  "customer_type_id",
  "mobile_number",
  "active",
  "status",
  "sales_department",
  "created_by",
  "updated_by",
];

// purpose چالش پیامکی «تغییر شمارهٔ موبایل از پروفایل»
// ⚠️ قالب پیامک: otpRules.templateIdFor برای purpose ناشناخته به قالب
//    ورود برمی‌گردد ⇒ بدون کلید تنظیمات جدید و بدون قالب تازه کار می‌کند.
const PROFILE_MOBILE_PURPOSE = "profile_mobile";

// شمارهٔ موبایل: ۱۱ رقم و شروع با ۰۹ (هم‌قاعده با فرم ثبت‌نام ۱۳.۷)
const MOBILE_PATTERN = /^09[0-9]{9}$/;

const hasOwn = (obj, key) =>
  Object.prototype.hasOwnProperty.call(obj || {}, key);

// ارقام فارسی/عربی → لاتین و تبدیل «+۹۸»/«۰۰۹۸»/«۹۸» به «۰۹»
const normalizeMobileInput = (value) => {
  let digits = normalizeDigits(value).replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith("98")) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("9")) digits = `0${digits}`;
  return digits;
};

const isValidMobile = (value) => MOBILE_PATTERN.test(String(value || ""));

// خروجی: مقدار نرمال‌شدهٔ یک فیلد (یا null برای خالی)
const normalizeField = (field, raw) => {
  const spec = PROFILE_FIELDS[field];
  if (!spec) return null;
  if (raw === null || raw === undefined) return null;

  if (spec.kind === "digits") {
    const digits = normalizeDigits(raw).replace(/\D/g, "");
    return digits === "" ? null : digits;
  }

  const text = cleanText(raw);
  if (text === "") return null;

  if (spec.kind === "name") return text.replace(/\s+/g, " ");
  if (spec.kind === "email") return text.toLowerCase();
  return text;
};

// ============================================
// ۳) اعتبارسنجی
// ============================================
const isValidIsoDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // اعتبار تقویمی واقعی (۳۱ فروردین نیست، ۳۰ فوریه نیست …)
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const isFutureDate = (value) =>
  String(value) > new Date().toISOString().slice(0, 10);

// خروجی: { field: "پیام فارسی" }
// ⚠️ فقط فیلدهایی بررسی می‌شوند که در PATCH حاضرند (ویرایش جزئی):
//    نبودِ یک کلید = «تغییر نده»، نه «خالی بگذار».
const profileValidationErrors = (values = {}, fields = null) => {
  const errors = {};
  const v = values || {};
  const target = Array.isArray(fields)
    ? fields.filter((field) => PROFILE_FIELDS[field])
    : Object.keys(v).filter((field) => PROFILE_FIELDS[field]);

  target.forEach((field) => {
    const spec = PROFILE_FIELDS[field];
    const value = v[field];

    if (spec.required && (value === null || value === undefined || String(value).trim() === "")) {
      errors[field] = `${spec.title} الزامی است`;
      return;
    }
    if (value === null || value === undefined) return;

    switch (spec.kind) {
      case "name":
      case "text": {
        const len = String(value).length;
        if (spec.min && len < spec.min) {
          errors[field] = `${spec.title} باید حداقل ${spec.min} کاراکتر باشد`;
        } else if (spec.max && len > spec.max) {
          errors[field] = `${spec.title} حداکثر ${spec.max} کاراکتر است`;
        }
        break;
      }
      case "digits": {
        const len = String(value).length;
        if (spec.exact && len !== spec.exact) {
          errors[field] = `${spec.title} باید ${spec.exact} رقم باشد`;
        } else if (spec.min && len < spec.min) {
          errors[field] = `${spec.title} باید حداقل ${spec.min} رقم باشد`;
        } else if (spec.max && len > spec.max) {
          errors[field] = `${spec.title} حداکثر ${spec.max} رقم است`;
        }
        break;
      }
      case "email": {
        const text = String(value);
        if (!isEmail(text)) errors[field] = "ایمیل معتبر نیست";
        else if (spec.max && text.length > spec.max) {
          errors[field] = `${spec.title} حداکثر ${spec.max} کاراکتر است`;
        }
        break;
      }
      case "date": {
        if (!isValidIsoDate(value)) {
          errors[field] = "تاریخ تولد باید به شکل ۱۹۹۹-۱۲-۳۱ باشد";
        } else if (isFutureDate(value)) {
          errors[field] = "تاریخ تولد نمی‌تواند در آینده باشد";
        }
        break;
      }
      case "choice": {
        if (!spec.choices.includes(String(value))) {
          errors[field] = `${spec.title} باید «${spec.choices.join("» یا «")}» باشد`;
        }
        break;
      }
      default:
        break;
    }
  });

  return errors;
};

// ============================================
// ۴) بدنه → { values, ignored }
// ------------------------------------------------------------
// • فقط کلیدهای سفید خوانده می‌شوند (whitelist-first)
// • ignored = کلیدهای ناشناخته/قفل (برای لاگ حسابرسی، نه خطا)
// ============================================
const sanitizeProfilePayload = (body = {}) => {
  const input = body && typeof body === "object" ? body : {};
  const values = {};
  const ignored = [];
  let mobileAttempted = false;

  Object.keys(input).forEach((field) => {
    if (field === "mobile_number") mobileAttempted = true;
    if (!PROFILE_EDITABLE.includes(field) && !ignored.includes(field)) {
      ignored.push(field);
    }
  });

  PROFILE_EDITABLE.forEach((field) => {
    if (!hasOwn(input, field)) return;
    values[field] = normalizeField(field, input[field]);
  });

  return { values, ignored, mobileAttempted };
};

// اعتبارسنجی کامل یک PATCH: نرمال‌سازی + قواعد + گزارش نادیده‌شده‌ها
const validateProfilePatch = (body = {}) => {
  const { values, ignored, mobileAttempted } = sanitizeProfilePayload(body);
  const errors = profileValidationErrors(values);

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values,
    ignored,
    mobileAttempted,
  };
};

// ============================================
// ۵) مقایسه با ردیف فعلی (بازخورد «چه چیزی تغییر کرد»)
// ============================================
const comparable = (value) => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

// خروجی: آرایهٔ نام فیلدهای تغییرکرده (فقط از کلیدهای همین PATCH)
const changedFields = (current = {}, values = {}) =>
  Object.keys(values || {}).filter(
    (field) => comparable(current[field]) !== comparable(values[field]),
  );

// ============================================
// ۶) تغییر شمارهٔ موبایل (مسیر جدا + کد پیامکی)
// ============================================
const validateMobileChange = ({ current, next } = {}) => {
  const errors = {};
  const currentMobile = normalizeMobileInput(current);
  const nextMobile = normalizeMobileInput(next);

  if (!isValidMobile(nextMobile)) {
    errors.mobile_number = "شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود";
  } else if (nextMobile === currentMobile) {
    errors.mobile_number = "شمارهٔ جدید با شمارهٔ فعلی یکسان است";
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    current: currentMobile,
    next: nextMobile,
  };
};

module.exports = {
  // ثابت‌ها
  PROFILE_FIELDS,
  PROFILE_EDITABLE,
  PROFILE_LOCKED,
  PROFILE_MOBILE_PURPOSE,
  MOBILE_PATTERN,
  // نرمال‌سازی/اعتبارسنجی
  hasOwn,
  normalizeMobileInput,
  isValidMobile,
  normalizeField,
  isValidIsoDate,
  profileValidationErrors,
  sanitizeProfilePayload,
  validateProfilePatch,
  changedFields,
  validateMobileChange,
};

