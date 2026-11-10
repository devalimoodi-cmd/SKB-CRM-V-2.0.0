// ============================================================
// controllers/portalCompletionController.js
// «پایان دوره» و «گزارش نهایی دوره» — سمت مشتری (موج ۱۳.۱۹)
// ------------------------------------------------------------
//  دو مسیر GET:
//    GET /api/portal/completions       ⇒ فهرست پایان دوره‌های خودم
//    GET /api/portal/completions/:id   ⇒ روند کامل یک دورهٔ خودم
//
// 🔒 قواعد تغییرناپذیر (هم‌راستا با بقیهٔ پورتال):
//   ۱) customer_id **فقط** از req.customerScopeId می‌آید (توکن)؛ هیچ
//      فیلدی از بدنه/کوئری برای شناسهٔ مشتری خوانده نمی‌شود.
//   ۲) ردیف غیرخودی ⇒ ۴۰۴ (requireOwnedRow در مسیر + دوباره در
//      سرویس) تا وجود رکورد مشتری دیگر لو نرود.
//   ۳) خروجی همیشه از services/portalCompletionView می‌آید
//      (فهرست سفید؛ بدون اقتصاد گله/یادداشت داخلی/کاربر کارشناس).
//   ۴) فقط خواندن؛ هیچ نوشتنی در این کنترلر نیست.
// ============================================================
"use strict";

const { successResponse, errorResponse } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");
const service = require("../services/portalCompletionService");
const {
  COMPLETION_TYPES,
  METRICS,
  HALL_METRICS,
} = require("../services/portalCompletionView");

// سقف صفحه مثل بقیهٔ فهرست‌های پورتال (portalController.paging)
const PAGE_DEFAULT = 20;
const PAGE_MAX = 50;

const MESSAGES = {
  unlinked:
    "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
  list_failed: "خطا در دریافت فهرست پایان دوره‌ها",
  report_failed: "خطا در دریافت گزارش نهایی دوره",
};

// شناسهٔ پروندهٔ همین کاربر — فقط از توکن
const scopeIdOf = (req) => {
  const id = Number(req.customerScopeId || req.portalScopeId || 0);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// صفحه‌بندی امن: فقط page/limit، سقف ۵۰
const paging = (query) =>
  parsePagination(query, { defaultLimit: PAGE_DEFAULT, maxLimit: PAGE_MAX });

// نگاشت خطای سرویس به پاسخ HTTP (پیام فارسی سرویس حفظ می‌شود)
const failure = (res, error, fallback) => {
  const status = Number(error && error.status) || 500;
  if (status >= 500) {
    console.error("❌ خطا در پایان دورهٔ پورتال:", error.message);
  }
  return errorResponse(
    res,
    status >= 500 ? fallback : error.message,
    status,
    Array.isArray(error && error.errors) ? error.errors : null,
  );
};

// ============================================
// GET /api/portal/completions
// ------------------------------------------------------------
//  فهرست صفحه‌بندی‌شده + برچسب انواع + تعریف شاخص‌ها (برای کارت‌ها)
//  ⚠️ برچسب/یکای هر شاخص از سرور می‌آید تا فرانت فهرست دوم نسازد.
// ============================================
const listMyCompletions = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, MESSAGES.unlinked, 403);

    const { page, limit, offset } = paging(req.query);
    const { items, total } = await service.listCompletionsFor({
      customerId,
      limit,
      offset,
    });

    return successResponse(
      res,
      {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: limit > 0 ? Math.ceil(total / limit) : 0,
        },
        meta: {
          scope: "self",
          types: COMPLETION_TYPES,
          metrics: METRICS,
          hall_metrics: HALL_METRICS,
        },
      },
      "پایان دوره‌های شما",
    );
  } catch (error) {
    return failure(res, error, MESSAGES.list_failed);
  }
};

// ============================================
// GET /api/portal/completions/:id
// ------------------------------------------------------------
//  گزارش نهایی یک دوره (ریز سالن‌ها + روند هفتگی + دارو/واکسن).
//  🔒 ردیف از requireOwnedRow آمده (۴۰۴ برای دورهٔ غیرخودی) و سرویس
//  هم با customer_id دوباره می‌سنجد.
// ============================================
const getMyCompletion = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, MESSAGES.unlinked, 403);

    const row = req.ownedRow;
    if (!row) {
      return errorResponse(
        res,
        "پایان دوره‌ای با این شناسه برای پروندهٔ شما ثبت نشده است",
        404,
      );
    }

    const report = await service.completionReportFor({
      customerId,
      completionId: row.id,
    });

    return successResponse(res, report, "گزارش نهایی دوره");
  } catch (error) {
    return failure(res, error, MESSAGES.report_failed);
  }
};

module.exports = {
  listMyCompletions,
  getMyCompletion,
};
