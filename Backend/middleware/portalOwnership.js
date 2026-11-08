// ============================================================
// middleware/portalOwnership.js
// «مرزِ مالکیت ردیف» برای پورتال مشتری — فاز ۱۳.۸
// ------------------------------------------------------------
//  چرا این میان‌افزار لازم شد؟
//   تا ۱۳.۷ پورتال فقط «فهرست‌های اسکوپ‌شده» داشت؛ از ۱۳.۸ داشبورد
//   تحلیلی شناسهٔ «گله/سالن» را در کوئری می‌گیرد. اگر آن شناسه بدون
//   بررسی به کنترلر برسد، مشتری می‌تواند دادهٔ گلهٔ دیگری را ببیند.
//
// 🔒 قواعد:
//  ۱) منبع اسکوپ = req.customerScopeId (فقط از توکن، نه از کلاینت)
//  ۲) هر ردیف/مرجع با «همان customer_id» در همان کوئری سنجیده می‌شود
//  ۳) ردیف غیرخودی → ۴۰۴ (وجود ردیف لو نمی‌رود) · شناسهٔ بد → ۴۰۰
//  ۴) مقدار غایب در کوئری (مثل flockId) ⇒ عبور بی‌اثر
//  ۵) هر رد، یک خط لاگ کوتاه دارد (بدون دادهٔ حساس)
// ============================================================
"use strict";

const {
  normalizeScopeId,
  ownershipDecision,
  referenceDecision,
  ownershipPayload,
  ownershipAuditLine,
  ownershipStatus,
} = require("../services/portalOwnershipRules");

// پاسخ رد استاندارد
const deny = (req, res, reason, rowId) => {
  console.warn(
    ownershipAuditLine({
      userId: req.user?.id,
      role: req.user?.role,
      reason,
      method: req.method,
      url: req.originalUrl,
      rowId,
    }),
  );
  return res.status(ownershipStatus(reason)).json(ownershipPayload(reason));
};

const scopeOf = (req) =>
  normalizeScopeId(req.customerScopeId) ||
  normalizeScopeId(req.customerScope?.customerId);

// ============================================
// ۱) ردیفی که شناسه‌اش در مسیر/کوئری است و باید مالِ همین مشتری باشد
// ------------------------------------------------------------
// options:
//   model   مدل سکوئلایز (Flock / ChickPlacement / Hall / WeeklyManagement…)
//   source  "params" | "query" | "body"   (پیش‌فرض "params")
//   key     نام پارامتر (پیش‌فرض "id")
//   field   ستون مالکیت (پیش‌فرض "customer_id")
//   store   نام کلید روی req برای ردیف تأییدشده (پیش‌فرض "ownedRow")
//   label   برچسب فارسی برای لاگ/پیام
// ============================================
const requireOwnedRow =
  ({ model, source = "params", key = "id", field = "customer_id", store = "ownedRow", label = "ردیف" } = {}) =>
  async (req, res, next) => {
    try {
      if (!req.user) return deny(req, res, "unauthenticated");
      if (!model) return next();

      const bucket =
        source === "params" ? req.params : source === "body" ? req.body : req.query;
      const raw = bucket ? bucket[key] : undefined;

      const decision = referenceDecision({ value: raw, scopeId: scopeOf(req) });
      if (!decision.ok) return deny(req, res, decision.reason, raw);

      // غایب ⇒ این میان‌افزار کاری ندارد
      if (decision.id === null) return next();

      const scopeId = scopeOf(req);
      const row = await model.findOne({
        where: { id: decision.id, [field]: scopeId },
      });

      if (!row) {
        // ممکن است ردیف باشد ولی مال دیگری ⇒ پاسخ یکسان ۴۰۴
        return deny(req, res, "not_owner", decision.id);
      }

      const verdict = ownershipDecision({ row, scopeId, field });
      if (!verdict.ok) return deny(req, res, verdict.reason, decision.id);

      req[store] = row;
      req.ownedRowId = decision.id;
      return next();
    } catch (error) {
      console.error(`❌ خطا در بررسی مالکیت ${label}:`, error.message);
      return res.status(500).json({
        success: false,
        message: "خطا در بررسی دسترسی به ردیف",
      });
    }
  };

// ============================================
// ۲) «پروندهٔ خودم» — درخواست بدون اسکوپ رد می‌شود (بدون کوئری)
// ------------------------------------------------------------
// مسیرهای نوشتن (مثل ویرایش پروفایل) به‌جای تکیه بر requireCustomerLink
// از این هم می‌گذرند تا حتی اگر ترتیب زنجیره تغییر کرد، نوشتنِ بدون
// پرونده ممکن نباشد.
const requireOwnScope = (req, res, next) => {
  if (!req.user) return deny(req, res, "unauthenticated");
  const scopeId = scopeOf(req);
  if (!scopeId) return deny(req, res, "missing_scope");
  req.portalScopeId = scopeId;
  return next();
};

module.exports = {
  requireOwnedRow,
  requireOwnScope,
};
