// ============================================================
// services/customerScopeRules.js
// منطق خالص «مرزِ دادهٔ مشتری» (Customer data scope) — فاز ۱۳.۲
// ------------------------------------------------------------
// چرا این فایل جدا شد؟ (هم‌الگو با otpRules.js / sessionRules.js)
//   ۱) گارد تست می‌تواند قانون‌ها را **بدون دیتابیس** اجرا کند
//      (middleware/customerScope.js به express و مدل‌ها وابسته است)
//   ۲) تنها یک منبع حقیقت برای پاسخ به این پرسش:
//      «این کاربر مجاز است کدام customer_id را ببیند؟»
//   ۳) هیچ تابعی در این فایل I/O ندارد (بدون await، بدون دیتابیس، بدون express)
// ------------------------------------------------------------
// 🔒 اصل امنیتیِ محوری:
//   منبع حقیقت «توکنِ سرور» است، نه کلاینت.
//   stateService.customerId در localStorage و پارامتر ?id= همگی
//   **ورودیِ غیرقابل‌اعتماد** هستند؛ مقدار نهایی همیشه از
//   req.user.customer_id (که auth.js از دیتابیس می‌خواند) می‌آید.
// ============================================================
"use strict";

// نقش «مشتری» (تنها نقشی که داده‌اش محدود به یک پرونده است)
const CUSTOMER_ROLE = "customer";

// نقش‌های کارکنان (دسترسی سازمانی؛ مشمول اسکوپِ «فقط خودم» نیستند)
const STAFF_ROLES = ["super_admin", "admin", "sub_admin", "expert"];

// ===== دلایل تصمیم (برای پاسخ ۴۰۳ و لاگ) =====
const SCOPE_REASONS = {
  SELF: "self", // درخواست مجاز، پروندهٔ خودِ مشتری
  ROLE_BYPASS: "role_bypass", // نقش کارمند ⇒ اسکوپِ «خودم» اعمال نمی‌شود
  NO_LINK: "no_link", // حساب مشتری بدون پروندهٔ متصل
  BAD_ID: "bad_id", // شناسهٔ درخواستی نامعتبر (غیرعددی/صفر/منفی)
  OTHER_CUSTOMER: "other_customer", // تلاش برای دیدن پروندهٔ مشتری دیگر
};

// ===== کدهای خطای ماشین‌خوان (کلاینت/گارد روی آن‌ها تکیه می‌کند) =====
const SCOPE_CODES = {
  no_link: "CUSTOMER_LINK_MISSING",
  bad_id: "CUSTOMER_SCOPE_BAD_ID",
  other_customer: "CUSTOMER_SCOPE_DENIED",
  unauthenticated: "UNAUTHENTICATED",
};

// ===== پیام‌های فارسی (کاربرپسند، بدون افشای ساختار داخلی) =====
const SCOPE_MESSAGES = {
  no_link:
    "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
  bad_id: "شناسهٔ مشتری در درخواست معتبر نیست",
  other_customer: "دسترسی به پروندهٔ سایر مشتریان مجاز نیست",
  unauthenticated: "احراز هویت نشده است",
};

// ============================================
// ابزارهای پایه
// ============================================

// شناسهٔ معتبر = عدد صحیحِ مثبتِ امن (۱، ۲، ...)
//   ⚠️ «۱۲» درست است؛ «۱.۵»، «-۳»، «0»، «abc»، «12abc» و true همه null
const normalizeCustomerId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "object") return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const isCustomerRole = (role) =>
  String(role ?? "")
    .trim()
    .toLowerCase() === CUSTOMER_ROLE;

const isStaffRole = (role) =>
  STAFF_ROLES.includes(
    String(role ?? "")
      .trim()
      .toLowerCase(),
  );

// آیا درخواست «شناسه‌ای» فرستاده است؟ (تهی/undefined ⇒ نه)
const hasRequestedId = (value) =>
  !(value === undefined || value === null || String(value).trim() === "");

// ============================================
// تصمیم اصلی: کدام customer_id مجاز است؟
// ------------------------------------------------------------
// ورودی:
//   role          نقش کاربر (از توکن/دیتابیس)
//   ownCustomerId پروندهٔ متصل به حساب (از users.customer_id)
//   requested     شناسهٔ درخواستی کلاینت (query/param/body) — غیرقابل‌اعتماد
// خروجی:
//   { ok, id, reason, message, code }
// ============================================
const resolveScopeCustomerId = ({
  role,
  ownCustomerId,
  requested,
} = {}) => {
  // ۱) نقش کارمند: محدود به «خودم» نیست؛ شناسهٔ درخواستی همان می‌ماند
  if (!isCustomerRole(role)) {
    return {
      ok: true,
      id: normalizeCustomerId(requested),
      reason: SCOPE_REASONS.ROLE_BYPASS,
      message: "",
      code: null,
    };
  }

  // ۲) نقش مشتری بدون پروندهٔ متصل ⇒ حتی «خودش» هم وجود ندارد
  const own = normalizeCustomerId(ownCustomerId);
  if (!own) {
    return {
      ok: false,
      id: null,
      reason: SCOPE_REASONS.NO_LINK,
      message: SCOPE_MESSAGES.no_link,
      code: SCOPE_CODES.no_link,
    };
  }

  // ۳) مشتریِ متصل بدون شناسهٔ درخواستی ⇒ پروندهٔ خودش
  if (!hasRequestedId(requested)) {
    return {
      ok: true,
      id: own,
      reason: SCOPE_REASONS.SELF,
      message: "",
      code: null,
    };
  }

  // ۴) شناسهٔ درخواستی نامعتبر ⇒ رد (هرگز به «خودش» تفسیر نمی‌شود)
  const wanted = normalizeCustomerId(requested);
  if (!wanted) {
    return {
      ok: false,
      id: null,
      reason: SCOPE_REASONS.BAD_ID,
      message: SCOPE_MESSAGES.bad_id,
      code: SCOPE_CODES.bad_id,
    };
  }

  // ۵) شناسهٔ مشتریِ دیگر ⇒ رد
  if (wanted !== own) {
    return {
      ok: false,
      id: null,
      reason: SCOPE_REASONS.OTHER_CUSTOMER,
      message: SCOPE_MESSAGES.other_customer,
      code: SCOPE_CODES.other_customer,
    };
  }

  // ۶) شناسهٔ درخواستی = پروندهٔ خودش ⇒ مجاز
  return {
    ok: true,
    id: own,
    reason: SCOPE_REASONS.SELF,
    message: "",
    code: null,
  };
};

// ============================================
// خط گزارش تلاشِ رد‌شده (audit trail سبک — بدون دادهٔ حساس)
// ============================================
const scopeAuditLine = ({
  userId = "-",
  role = "-",
  reason = "-",
  method = "-",
  url = "-",
  requestedId = "-",
} = {}) =>
  `🚫 [customer-scope] ${method} ${url} — کاربر ${userId} (نقش «${role}») ` +
  `دلیل: ${reason} — شناسهٔ درخواستی: ${requestedId}`;

module.exports = {
  // ---- ثابت‌ها ----
  CUSTOMER_ROLE,
  STAFF_ROLES,
  SCOPE_REASONS,
  SCOPE_CODES,
  SCOPE_MESSAGES,
  // ---- ابزارهای خالص ----
  normalizeCustomerId,
  isCustomerRole,
  isStaffRole,
  hasRequestedId,
  // ---- تصمیم‌گیری ----
  resolveScopeCustomerId,
  scopeAuditLine,
};
