// ============================================================
// middleware/customerScope.js
// «مرزِ دادهٔ مشتری» سمت سرور — فاز ۱۳.۲
// ------------------------------------------------------------
//  سه میان‌افزار:
//  ۱) attachCustomerScope   → req.customerScope (اطلاع فقط، چیزی رد نمی‌شود)
//  ۲) requireCustomerLink   → مشتریِ بدون پروندهٔ متصل ⇒ ۴۰۳ روشن
//  ۳) enforceSelfCustomer   → مشتری فقط پروندهٔ خودش را می‌بیند
//  ۴) allowCustomerRead     → بستهٔ آماده برای آینده (authorize + اسکوپ)
//
// 🔒 قواعد:
//  • منبع حقیقت = req.user.customer_id (auth.js از دیتابیس می‌خواند)
//  • شناسهٔ درخواستی (?id= / :id / body) هرگز بر پروندهٔ مشتری اولویت ندارد
//  • نقش‌های کارکنان از این میان‌افزارها «بی‌تغییر» عبور می‌کنند
//    ⇒ صفر تغییر رفتاری در ۲۰ مسیر موجود
//  • هر تلاش رد‌شده در لاگ سرور ثبت می‌شود (بدون دادهٔ حساس)
// ============================================================
"use strict";

const { authorize } = require("./auth");
const {
  CUSTOMER_ROLE,
  SCOPE_CODES,
  SCOPE_MESSAGES,
  isCustomerRole,
  normalizeCustomerId,
  resolveScopeCustomerId,
  scopeAuditLine,
} = require("../services/customerScopeRules");

// ===== پاسخ ۴۰۳ مشترک =====
const denyScope = (res, reason) =>
  res.status(403).json({
    success: false,
    code: SCOPE_CODES[reason] || SCOPE_CODES.other_customer,
    reason,
    message: SCOPE_MESSAGES[reason] || SCOPE_MESSAGES.other_customer,
    timestamp: new Date().toISOString(),
  });

// ===== ۰) بررسی احراز هویت (بدون وابستگی به protect) =====
const requireUser = (req, res) => {
  if (req.user) return true;
  res.status(401).json({
    success: false,
    code: SCOPE_CODES.unauthenticated,
    message: SCOPE_MESSAGES.unauthenticated,
  });
  return false;
};

// ===== ۱) الحاق «نگاه اجمالی» به درخواست (بدون رد کردن) =====
const attachCustomerScope = (req, res, next) => {
  if (!req.user) return next();

  const isCustomer = isCustomerRole(req.user.role);
  const customerId = isCustomer ? normalizeCustomerId(req.user.customer_id) : null;

  req.customerScope = {
    role: req.user.role,
    isCustomer,
    isStaff: !isCustomer,
    // برای مشتری: پروندهٔ متصل؛ برای کارکنان: null (اسکوپ معنا ندارد)
    customerId,
    // مشتریِ متصل = قابل استفاده؛ کارکنان همیشه true
    linked: isCustomer ? customerId !== null : true,
  };
  if (customerId) req.customerScopeId = customerId;

  return next();
};

// ===== ۲) مشتریِ بدون پروندهٔ متصل ⇒ ۴۰۳ =====
const requireCustomerLink = (req, res, next) => {
  if (!requireUser(req, res)) return undefined;
  if (!isCustomerRole(req.user.role)) return next();

  const result = resolveScopeCustomerId({
    role: req.user.role,
    ownCustomerId: req.user.customer_id,
  });

  if (!result.ok) {
    console.warn(
      scopeAuditLine({
        userId: req.user.id,
        role: req.user.role,
        reason: result.reason,
        method: req.method,
        url: req.originalUrl,
      }),
    );
    return denyScope(res, result.reason);
  }

  req.customerScopeId = result.id;
  return next();
};

// ===== ۳) «فقط پروندهٔ خودم» برای مشتری =====
// گزینه‌ها:
//   source = "query" | "params" | "body"
//   key    = نام فیلد (پیش‌فرض: id)
const readRequested = (req, source, key) => {
  if (source === "params") return req.params ? req.params[key] : undefined;
  if (source === "body") return req.body ? req.body[key] : undefined;
  return req.query ? req.query[key] : undefined;
};

const enforceSelfCustomer =
  ({ source = "query", key = "id" } = {}) =>
  (req, res, next) => {
    if (!requireUser(req, res)) return undefined;
    if (!isCustomerRole(req.user.role)) return next();

    const requested = readRequested(req, source, key);
    const result = resolveScopeCustomerId({
      role: req.user.role,
      ownCustomerId: req.user.customer_id,
      requested,
    });

    if (!result.ok) {
      console.warn(
        scopeAuditLine({
          userId: req.user.id,
          role: req.user.role,
          reason: result.reason,
          method: req.method,
          url: req.originalUrl,
          requestedId: requested ?? "-",
        }),
      );
      return denyScope(res, result.reason);
    }

    req.customerScopeId = result.id;

    // ✅ فاز ۱۳.۳ — «تزریق اجباری» شناسهٔ تأییدشده (نه فقط وقتی کلاینت
    //    خودش پارامتر را فرستاده باشد).
    //    چرا؟ اگر مسیری «لیست» باشد و کنترلر بر پایهٔ *وجود* همان پارامتر
    //    فیلتر بسازد (الگوی رایج: if (customer_id) where.customer_id = ...)
    //    آن‌گاه مشتریِ بدون پارامتر، فیلتری نمی‌فرستد و همهٔ ردیف‌های
    //    *همهٔ* مشتریان را می‌گیرد. با این تزریق، کنترلر همیشه فیلتر دارد.
    if (source === "query") {
      if (!req.query) req.query = {};
      req.query[key] = String(result.id);
    } else if (source === "body") {
      if (!req.body || typeof req.body !== "object") req.body = {};
      req.body[key] = String(result.id);
    }
    // source === "params" ⇒ تطابق قبلاً در resolveScopeCustomerId تایید
    // شده است (مقدار همان شناسهٔ خودِ مشتری بود) ⇒ بازنویسی لازم نیست.

    return next();
  };

// ===== ۴) بستهٔ آماده: authorize + اسکوپ =====
// نمونهٔ استفاده در موج‌های بعد (۱۳.۳):
//   router.get("/:id", protect,
//     requirePermission("customers.view"),
//     ...allowCustomerRead({ source: "params", key: "id" }),
//     controller);
//   ⚠️ در ۱۳.۲ به هیچ مسیر موجودی اضافه نشده است.
const allowCustomerRead = ({ source = "query", key = "id", roles = [] } = {}) => [
  authorize(...new Set([...roles, CUSTOMER_ROLE])),
  enforceSelfCustomer({ source, key }),
];

module.exports = {
  attachCustomerScope,
  requireCustomerLink,
  enforceSelfCustomer,
  allowCustomerRead,
};
