// ============================================================
// services/otpRules.js
// منطق خالص «کد یک‌بارمصرف ورود» — فاز ۱۳.۱
// ------------------------------------------------------------
// چرا این فایل جدا شد؟ (هم‌الگو با sessionRules.js / activityRules.js)
//   ۱) تستِ گارد می‌تواند منطق را **بدون اتصال به دیتابیس** بسنجد
//      (otpService خودش به مدل‌ها/سرویس پیامک وابسته است)
//   ۲) قانون‌ها یک‌جا دیده می‌شوند: TTL، سقف تلاش، فاصلهٔ ارسال مجدد
//   ۳) هیچ تابعی در این فایل I/O ندارد (بدون await، بدون دیتابیس)
// ------------------------------------------------------------
// 🔒 اصول امنیتی:
//   • کد خام هرگز ذخیره/لاگ نمی‌شود؛ فقط SHA-256(code + ":" + OTP_PEPPER)
//   • مقایسه با timingSafeEqual ⇒ مقاوم به حملات زمان‌سنجی
//   • تولید کد با crypto.randomInt ⇒ بدون مولد شبه‌تصادفی و قابل‌پیش‌بینی
// ============================================================
"use strict";

const crypto = require("crypto");

// قالب پیش‌فرض: «لاگین در سیستم-اصلی» (شناسهٔ تأییدشده با کارفرما)
const DEFAULT_TEMPLATE_ID = 514103;

// نگاشت هدفِ چالش به متغیر محیطی قالب
const TEMPLATE_ENV = {
  login: "SMS_TEMPLATE_OTP_LOGIN",
  register: "SMS_TEMPLATE_OTP_REGISTER",
  reset_password: "SMS_TEMPLATE_OTP_RESET",
};

// نام پارامترهای قالب sms.ir (تأییدشده: OTP نه CODE)
const PARAM_NAME = "NAME";
const PARAM_OTP = "OTP";
const PARAM_TIME = "TIME";

// هدف‌های مجاز (اگر هدف ناشناخته بیاید، «login» در نظر گرفته می‌شود)
const PURPOSES = ["login", "register", "reset_password"];

// ============================================
// ابزارهای پایه
// ============================================
const positiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const ttlSeconds = () => positiveInt(process.env.LOGIN_OTP_TTL_SECONDS, 180);
const resendSeconds = () =>
  positiveInt(process.env.LOGIN_OTP_RESEND_SECONDS, 60);
const maxAttempts = () => positiveInt(process.env.LOGIN_OTP_MAX_ATTEMPTS, 5);
const maxPerHour = () => positiveInt(process.env.LOGIN_OTP_MAX_PER_HOUR, 8);
const maxResends = () => positiveInt(process.env.LOGIN_OTP_MAX_RESENDS, 5);
const retentionDays = () =>
  positiveInt(process.env.LOGIN_OTP_RETENTION_DAYS, 7);
const purgeIntervalHours = () =>
  positiveInt(process.env.LOGIN_OTP_PURGE_INTERVAL_HOURS, 6);

// ✅ دقیقه‌های اعلام‌شده در قالب = همان TTL (۳ دقیقه)
const ttlMinutes = () => Math.max(1, Math.ceil(ttlSeconds() / 60));

// ============================================
// آیا ورود دومرحله‌ای اجباری است؟
// ------------------------------------------------------------
// • مقدار صریح در .env همیشه برنده است.
// • اگر تنظیم نشده باشد: در production روشن و در توسعه خاموش
//   (تا توسعهٔ محلی بدون پیامک قفل نشود) ⇒ «امن به‌صورت پیش‌فرض».
// ============================================
const isEnforced = () => {
  const raw = String(process.env.LOGIN_OTP_ENFORCE ?? "")
    .trim()
    .toLowerCase();
  if (raw === "") return process.env.NODE_ENV === "production";
  return raw === "true" || raw === "1" || raw === "yes";
};

// کد تست فقط بیرون از production پذیرفته می‌شود (برای e2e)
const testCode = () => {
  if (process.env.NODE_ENV === "production") return null;
  const raw = String(process.env.LOGIN_OTP_TEST_CODE || "").trim();
  return raw || null;
};

// ============================================
// هش و مقایسهٔ کد
// ============================================
const pepper = () => String(process.env.OTP_PEPPER || "");

const hashCode = (code) =>
  crypto
    .createHash("sha256")
    .update(`${String(code)}:${pepper()}`)
    .digest("hex");

// مقایسهٔ ثابت‌زمان (هر دو ورودی باید هشِ ۶۴ کاراکتری hex باشند)
// ⚠️ اعتبارسنجی قالب قبل از مقایسه: ورودی نامعتبر (مثل "zz") هرگز
//    «مساوی» تلقی نمی‌شود (Buffer.from روی hex نامعتبر، بافر خالی می‌سازد).
const HEX64 = /^[0-9a-f]{64}$/i;

const safeEqualHex = (left, right) => {
  if (!HEX64.test(String(left || "")) || !HEX64.test(String(right || ""))) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(
      Buffer.from(left, "hex"),
      Buffer.from(right, "hex"),
    );
  } catch {
    return false;
  }
};

// کد ۶ رقمی امنِ رمزنگاری (بدون مولد شبه‌تصادفی)
const newCode = () => String(crypto.randomInt(100000, 1000000));

const newChallengeId = () => crypto.randomBytes(24).toString("hex");

const maskMobile = (mobile) => {
  const value = String(mobile || "").trim();
  if (value.length < 8) return "";
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
};

const hashText = (text) =>
  text
    ? crypto.createHash("sha256").update(String(text)).digest("hex")
    : null;

const displayName = (user) => {
  const full = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  return full || user?.username || "کاربر";
};

// ============================================
// قالب پیامک
// ============================================
const templateIdFor = (purpose = "login") => {
  const envKey = TEMPLATE_ENV[purpose] || TEMPLATE_ENV.login;
  const raw =
    process.env[envKey] ||
    process.env.SMS_TEMPLATE_OTP_LOGIN ||
    DEFAULT_TEMPLATE_ID;
  const id = Number(String(raw).trim());
  return Number.isFinite(id) && id > 0 ? id : null;
};

// ============================================
// تشخیص وضعیت چالش (خالص — بدون دیتابیس)
// ============================================
const STATUS = {
  PENDING: "pending",
  CONSUMED: "consumed",
  EXPIRED: "expired",
  BLOCKED: "blocked",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

// آیا چالش قابل استفاده است؟ ⇒ null یعنی سالم، وگرنه دلیل
const challengeProblem = (row, now = Date.now()) => {
  if (!row) return "not_found";
  if (row.status === STATUS.CONSUMED) return "used";
  if (row.status === STATUS.BLOCKED) return "blocked";
  if (row.status !== STATUS.PENDING) return "expired";

  const expiresAt = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return "expired";

  const limit = positiveInt(row.max_attempts, maxAttempts());
  if (positiveInt(row.attempts, 0) >= limit) return "blocked";

  return null; // سالم
};

// آیا ارسال مجدد مجاز است؟ (فاصلهٔ اجباری + سقف تعداد)
const canResend = ({ row, now = Date.now() } = {}) => {
  if (!row) return { ok: false, reason: "not_found" };

  const problem = challengeProblem(row, now);
  if (problem) return { ok: false, reason: problem };

  if (positiveInt(row.resend_count, 0) >= maxResends()) {
    return { ok: false, reason: "resend_limit" };
  }

  const lastSent = new Date(row.last_sent_at).getTime();
  const gap = Number.isFinite(lastSent)
    ? Math.floor((now - lastSent) / 1000)
    : Infinity;

  const wait = resendSeconds();
  if (gap < wait) {
    return { ok: false, reason: "too_soon", waitSeconds: wait - gap };
  }

  return { ok: true };
};

// نرمال‌سازی کد ورودی (ارقام فارسی هم پذیرفته می‌شوند)
const normalizeCode = (code) => {
  const digits = String(code ?? "")
    .trim()
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^\d]/g, "");
  return digits.length === 6 ? digits : "";
};

module.exports = {
  // ---- ثابت‌ها ----
  DEFAULT_TEMPLATE_ID,
  TEMPLATE_ENV,
  PARAM_NAME,
  PARAM_OTP,
  PARAM_TIME,
  PURPOSES,
  STATUS,
  // ---- تنظیمات ----
  ttlSeconds,
  ttlMinutes,
  resendSeconds,
  maxAttempts,
  maxPerHour,
  maxResends,
  retentionDays,
  purgeIntervalHours,
  isEnforced,
  testCode,
  // ---- ابزارهای خالص ----
  positiveInt,
  pepper,
  hashCode,
  safeEqualHex,
  newCode,
  newChallengeId,
  maskMobile,
  hashText,
  displayName,
  templateIdFor,
  // ---- تصمیم‌گیری ----
  challengeProblem,
  canResend,
  normalizeCode,
};
