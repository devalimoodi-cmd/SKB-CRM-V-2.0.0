// ============================================================
// services/registrationRules.js
// منطق خالص «ثبت‌نام عمومی + صف تأیید» — فاز ۱۳.۶
// ------------------------------------------------------------
// چرا این فایل جدا شد؟ (هم‌الگو با otpRules / sessionRules / activityRules)
//   ۱) تست گارد می‌تواند قانون‌ها را **بدون دیتابیس** بسنجد
//   ۲) قواعد یک‌جا دیده می‌شوند: فیلدهای سفید، اعتبارسنجی، گذار وضعیت
//   ۳) هیچ تابعی در این فایل I/O ندارد (بدون await، بدون دیتابیس)
// ------------------------------------------------------------
// 🔒 اصول امنیتی:
//   • فقط «فیلدهای سفید» به لایهٔ داده می‌روند ⇒ role/status/customer_id
//     ارسالی از سمت کاربر هرگز اعمال نمی‌شود (ضد mass-assignment).
//   • درخواست همیشه pending است؛ گذار مجاز فقط pending → approved|rejected.
//   • خروجی عمومی (`publicRequestView`) هیچ ستون حساسی ندارد.
//   • رمز خام در هیچ خروجی/لاگ این فایل برنمی‌گردد.
// ============================================================
"use strict";

const STATUS = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" };
const STATUSES = [STATUS.PENDING, STATUS.APPROVED, STATUS.REJECTED];

// ⚠️ حداقل رمز ثبت‌نام عمومی ۸ است (مدل User روی ۶ می‌ماند تا حساب‌های
//    قدیمی نشکنند؛ این سخت‌گیری فقط برای حساب‌های تازه است).
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 100;
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 100;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 100;
const MAX_CUSTOMER_CODE_LENGTH = 50;
const MAX_NOTE_LENGTH = 500;
const MIN_REJECT_REASON = 3;
const MAX_REJECT_REASON = 300;

// فیلدهایی که «کاربر مهمان» اجازهٔ ارسالشان را دارد — و بس.
const ALLOWED_FIELDS = [
  "first_name",
  "last_name",
  "username",
  "email",
  "mobile_number",
  "password",
  "confirm_password",
  "requested_customer_code",
  "note",
];

// فیلدهایی که در بدنه **دیده شدنشان** هم ارزش هشدار دارد (تلاش ارتقای نقش)
const FORBIDDEN_FIELDS = ["role", "status", "customer_id", "created_by", "active"];

// ============================================
// ابزارهای پایه
// ============================================
// ارقام فارسی/عربی → لاتین (کاربر موبایل را با کیبورد فارسی می‌نویسد)
const normalizeDigits = (value) =>
  String(value ?? "")
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

const cleanText = (value) =>
  normalizeDigits(value).replace(/[\u200c\u200f\u200e]/g, "").trim();

// فاصله‌های تکراری → یک فاصله (نام‌ها)
const cleanName = (value) => cleanText(value).replace(/\s+/g, " ");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value));

const maskMobile = (value) => {
  const digits = normalizeDigits(value).replace(/\D/g, "");
  if (digits.length < 7) return "";
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
};

// آیا این مقدار یک bcrypt hash است؟ (محافظ در برابر هشِ دوباره)
const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(String(value || ""));


// ============================================
// اعتبارسنجی فرم ثبت‌نام عمومی
// ------------------------------------------------------------
// خروجی: { ok, errors: {field: message}, values: {...فیلدهای سفید} }
// ⚠️ هیچ‌کدام از فیلدهای FORBIDDEN در values بازتولید نمی‌شوند.
// ============================================
const validateRegistration = (body = {}) => {
  const errors = {};
  const input = body || {};

  const first_name = cleanName(input.first_name);
  const last_name = cleanName(input.last_name);
  const username = cleanText(input.username).toLowerCase();
  const email = cleanText(input.email).toLowerCase();
  const mobile_number = normalizeDigits(input.mobile_number).replace(/\D/g, "");
  const password = String(input.password ?? "");
  const confirm_password = String(input.confirm_password ?? input.confirmPassword ?? "");
  const requested_customer_code = cleanText(input.requested_customer_code);
  const note = cleanText(input.note);

  if (first_name.length < MIN_NAME_LENGTH || first_name.length > MAX_NAME_LENGTH) {
    errors.first_name = `نام باید بین ${MIN_NAME_LENGTH} تا ${MAX_NAME_LENGTH} کاراکتر باشد`;
  }
  if (last_name.length < MIN_NAME_LENGTH || last_name.length > MAX_NAME_LENGTH) {
    errors.last_name = `نام خانوادگی باید بین ${MIN_NAME_LENGTH} تا ${MAX_NAME_LENGTH} کاراکتر باشد`;
  }
  if (
    username.length < MIN_USERNAME_LENGTH ||
    username.length > MAX_USERNAME_LENGTH ||
    !/^[a-z0-9._-]+$/.test(username)
  ) {
    errors.username =
      "نام کاربری باید ۳ تا ۱۰۰ کاراکتر و شامل حروف انگلیسی، رقم، نقطه، خط تیره یا زیرخط باشد";
  }
  if (!email || email.length > MAX_EMAIL_LENGTH || !isEmail(email)) {
    errors.email = "ایمیل معتبر نیست";
  }
  if (!/^09[0-9]{9}$/.test(mobile_number)) {
    errors.mobile_number = "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `رمز عبور باید حداقل ${MIN_PASSWORD_LENGTH} کاراکتر باشد`;
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.password = `رمز عبور حداکثر ${MAX_PASSWORD_LENGTH} کاراکتر است`;
  } else if (confirm_password !== "" && password !== confirm_password) {
    errors.confirm_password = "تکرار رمز عبور با رمز یکسان نیست";
  }
  if (requested_customer_code.length > MAX_CUSTOMER_CODE_LENGTH) {
    errors.requested_customer_code = `کد/نام پرونده حداکثر ${MAX_CUSTOMER_CODE_LENGTH} کاراکتر است`;
  }
  if (note.length > MAX_NOTE_LENGTH) {
    errors.note = `توضیح حداکثر ${MAX_NOTE_LENGTH} کاراکتر است`;
  }

  const values = {
    first_name,
    last_name,
    username,
    email,
    mobile_number,
    password,
    requested_customer_code: requested_customer_code || null,
    note: note || null,
  };

  return { ok: Object.keys(errors).length === 0, errors, values };
};

// ============================================
// ساخت ردیف درخواست (فقط فیلدهای سفید)
// ------------------------------------------------------------
// ⚠️ `password` عمداً اینجا نیست: هش‌کردن در registrationService انجام می‌شود
//    تا این فایل «خالص» بماند و رمز خام در هیچ خروجی این ماژول نباشد.
// ============================================
const buildRequestRow = (values = {}, ctx = {}) => {
  const userAgent = String(ctx.userAgent ?? "").slice(0, 255);
  const ip = String(ctx.ip ?? "").slice(0, 45);

  return {
    first_name: values.first_name,
    last_name: values.last_name,
    username: values.username,
    email: values.email,
    mobile_number: values.mobile_number,
    requested_customer_code: values.requested_customer_code || null,
    note: values.note || null,
    status: STATUS.PENDING,
    ip: ip || null,
    user_agent: userAgent || null,
  };
};

// آیا بدنه تلاش کرده فیلدهای ممنوع را ست کند؟ (برای لاگ هشدار، نه رد کردن)
const forbiddenFieldsIn = (body = {}) =>
  FORBIDDEN_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(body || {}, field));


// ============================================
// گذارهای وضعیت (فقط pending → approved | rejected)
// ============================================
const canReview = (request = {}) => {
  const status = String(request?.status || "");
  if (status === STATUS.PENDING) return { ok: true };
  if (status === STATUS.APPROVED) {
    return { ok: false, message: "این درخواست قبلاً تأیید شده است" };
  }
  if (status === STATUS.REJECTED) {
    return { ok: false, message: "این درخواست قبلاً رد شده است" };
  }
  return { ok: false, message: "وضعیت درخواست نامشخص است" };
};

const validateRejectReason = (raw) => {
  const reason = cleanText(raw);
  if (reason.length < MIN_REJECT_REASON) {
    return {
      ok: false,
      message: `دلیل رد الزامی است (حداقل ${MIN_REJECT_REASON} کاراکتر)`,
      value: "",
    };
  }
  if (reason.length > MAX_REJECT_REASON) {
    return {
      ok: false,
      message: `دلیل رد حداکثر ${MAX_REJECT_REASON} کاراکتر است`,
      value: "",
    };
  }
  return { ok: true, value: reason };
};

const approvalPatch = ({ reviewerId, userId, now = new Date() } = {}) => ({
  status: STATUS.APPROVED,
  reviewed_by: reviewerId ?? null,
  reviewed_at: now,
  created_user_id: userId ?? null,
  reject_reason: null,
});

const rejectionPatch = ({ reviewerId, reason, now = new Date() } = {}) => ({
  status: STATUS.REJECTED,
  reviewed_by: reviewerId ?? null,
  reviewed_at: now,
  reject_reason: reason,
});

// ============================================
// خروجی‌های API (هیچ‌گاه password_hash)
// ============================================
// آنچه «مدیر بازبین» می‌بیند: کل دادهٔ درخواست بدون هش رمز.
const adminRequestView = (row = {}) => ({
  id: row.id,
  first_name: row.first_name,
  last_name: row.last_name,
  username: row.username,
  email: row.email,
  mobile_number: row.mobile_number,
  mobile_masked: maskMobile(row.mobile_number),
  requested_customer_code: row.requested_customer_code || null,
  note: row.note || null,
  status: row.status,
  reject_reason: row.reject_reason || null,
  reviewed_by: row.reviewed_by ?? null,
  reviewed_at: row.reviewed_at || null,
  created_user_id: row.created_user_id ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// پاسخ «ثبت درخواست» به کاربر مهمان — حداقلی و بدون شناسهٔ داخلی
const publicRequestView = () => ({
  status: STATUS.PENDING,
  message:
    "درخواست ثبت‌نام شما ثبت شد. پس از بررسی و تأیید مدیر، می‌توانید وارد شوید.",
});


// ============================================
// پرچم سراسری «ثبت‌نام عمومی باز است؟»
// ------------------------------------------------------------
// • پیش‌فرض بسته است (امن به‌صورت پیش‌فرض).
// • مقدار از تنظیمات سراسری (settingsController: registration_enabled) می‌آید؛
//   هم صفحهٔ ثبت‌نام و هم اندپوینت همین یک منبع را می‌خوانند.
// ============================================
const isRegistrationEnabled = (settingValue) => {
  if (settingValue === true) return true;
  const raw = String(settingValue ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
};

// فیلتر وضعیت صف (query منوی مدیر) — نامعتبر → همه
const normalizeStatusFilter = (raw) => {
  const value = String(raw ?? "").trim().toLowerCase();
  return STATUSES.includes(value) ? value : null;
};

module.exports = {
  // ثابت‌ها
  STATUS,
  STATUSES,
  ALLOWED_FIELDS,
  FORBIDDEN_FIELDS,
  MIN_PASSWORD_LENGTH,
  MIN_REJECT_REASON,
  MAX_REJECT_REASON,
  // ابزارهای پایه
  normalizeDigits,
  cleanText,
  isEmail,
  maskMobile,
  isBcryptHash,
  // اعتبارسنجی/ساخت ردیف
  validateRegistration,
  buildRequestRow,
  forbiddenFieldsIn,
  // گذار وضعیت
  canReview,
  validateRejectReason,
  approvalPatch,
  rejectionPatch,
  // خروجی API
  adminRequestView,
  publicRequestView,
  // پرچم و فیلتر
  isRegistrationEnabled,
  normalizeStatusFilter,
};
