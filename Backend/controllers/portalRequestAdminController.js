// ============================================================
// controllers/portalRequestAdminController.js
// صف «درخواست‌های پورتال» — سمت کارشناس/مدیر (موج ۱۳.۱۱)
// ------------------------------------------------------------
//  🔑 این کنترلر تنها جایی است که درخواست مشتری به **نوشتن واقعی**
//  در units/halls/chick_placements تبدیل می‌شود.
//
//  🔒 قواعد تغییرناپذیر:
//   ۱) کل مسیرها با کلید مجوز محافظت می‌شوند:
//        portal.requests.view   ← فهرست/جزئیات/شمارنده
//        portal.requests.review ← تأیید/رد
//      هیچ‌کدام `authorize("customer")` ندارند، پس مشتری هم به آن‌ها
//      دسترسی ندارد (زنجیرهٔ پورتال فقط نقش مشتری را می‌پذیرد).
//   ۲) اعمال درخواست در **تراکنش** با قفل ردیف انجام می‌شود
//      (services/portalRequestService) ⇒ دو مدیر هم‌زمان نمی‌توانند
//      یک درخواست را دو بار اعمال کنند.
//   ۳) کارشناس می‌تواند payload را پیش از تأیید اصلاح کند؛ همان
//      فیلتر سفید و همان اعتبارسنجی روی نسخهٔ اصلاح‌شده اجرا می‌شود.
//   ۴) دلیل رد اجباری است (حداقل ۳ کاراکتر) و به مشتری نشان داده
//      می‌شود.
// ============================================================
"use strict";

const { successResponse, errorResponse } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");
const service = require("../services/portalRequestService");
const {
  LIMITS,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  adminRequestView,
  normalizeStatusFilter,
  normalizeTypeFilter,
} = require("../services/portalRequestRules");

const reviewerIdOf = (req) => (req.user && req.user.id ? req.user.id : null);

const filtersMeta = () => ({
  types: REQUEST_TYPES.map((item) => ({
    key: item.key,
    label: item.label,
    // ✅ ۱۳.۱۳: کارشناس پیش از تأیید باید بداند این نوع «حذف/آبشاری» است
    destructive: Boolean(item.destructive),
    target: item.target || null,
  })),
  statuses: REQUEST_STATUSES.map((item) => ({
    key: item.key,
    label: item.label,
    tone: item.tone,
  })),
  limits: LIMITS,
});

const failure = (res, error, fallback) => {
  const status = Number(error && error.status) || 500;
  if (status >= 500) {
    console.error("❌ خطا در صف درخواست‌های پورتال:", error.message);
  }
  return errorResponse(
    res,
    status >= 500 ? fallback : error.message,
    status,
    Array.isArray(error && error.errors) ? error.errors : null,
  );
};

// ============================================
// GET /api/portal-requests        (فیلتر: status/type/search)
// ============================================
const listRequests = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const { rows, count, pending } = await service.listQueue({
      status: normalizeStatusFilter(req.query.status),
      type: normalizeTypeFilter(req.query.type),
      search: req.query.search || "",
      limit,
      offset,
    });

    return successResponse(
      res,
      {
        items: rows.map((row) => adminRequestView(row)),
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.max(1, Math.ceil(count / limit)),
        },
        pending,
        meta: filtersMeta(),
      },
      "صف درخواست‌های پورتال",
    );
  } catch (error) {
    return failure(res, error, "خطا در دریافت صف درخواست‌ها");
  }
};

// ============================================
// GET /api/portal-requests/pending-count   (نشان منو)
// ============================================
const getPendingCount = async (req, res) => {
  try {
    const pending = await service.pendingQueueCount();
    return successResponse(res, { pending }, "شمارندهٔ درخواست‌های در انتظار");
  } catch (error) {
    return failure(res, error, "خطا در شمارش درخواست‌های در انتظار");
  }
};

// ============================================
// GET /api/portal-requests/dictionaries       — ✅ ۱۳.۱۶
// ------------------------------------------------------------
//  چرا این مسیر تازه لازم شد؟
//   مودال بازبینی باید `breed_id: 3` را «راس ۳۰۸» و پنج آرایهٔ
//   شناسهٔ هفتگی را با نام نشان دهد؛ بدون نام، کارشناس «۵ مورد»
//   را تأیید می‌کند.
//
//  🔒 چرا از /api/dictionary استفاده نشد؟
//   آن ۱۶ مسیر کلید مجوز `dictionary.*.view` (مدیریتی) می‌خواهند؛
//   بازبین صف نباید به کلیدهای مدیریت دیکشنری مجهز شود. این مسیر
//   فقط `{id,name}` ردیف‌های **فعال** را پشت همان
//   `portal.requests.view` می‌دهد و هیچ مدل دادهٔ مشتری را لمس نمی‌کند.
// ============================================
const getDictionaries = async (req, res) => {
  try {
    const dictionaries = await service.staffDictionariesFor();
    return successResponse(
      res,
      { dictionaries },
      "دیکشنری‌های موردنیاز بازبینی درخواست‌ها",
    );
  } catch (error) {
    return failure(res, error, "خطا در دریافت دیکشنری‌ها");
  }
};

// ============================================
// GET /api/portal-requests/:id
// ------------------------------------------------------------
//  ✅ ۱۳.۱۶: به‌همراه `context` — نام کوتاه واحد/سالن/دوره/هفته‌ای
//  که این درخواست تغییر می‌دهد (کارشناس بداند روی چه ردیفی تأیید
//  می‌زند). زمینه با `customer_id` همان درخواست اسکوپ می‌شود.
// ============================================
const getRequest = async (req, res) => {
  try {
    const row = await service.getRequest(req.params.id);
    const context = await service.contextForRequest(row);
    return successResponse(
      res,
      { request: adminRequestView(row), context },
      "جزئیات درخواست",
    );
  } catch (error) {
    return failure(res, error, "خطا در دریافت درخواست");
  }
};

// ============================================
// POST /api/portal-requests/:id/approve
// ------------------------------------------------------------
//  بدنهٔ اختیاری: { payload: {…} }  ⇒ اصلاح مقادیر پیش از تأیید
// ============================================
const approveRequest = async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const override =
      body.payload && typeof body.payload === "object" ? body.payload : null;

    const row = await service.approveRequest({
      requestId: req.params.id,
      reviewerId: reviewerIdOf(req),
      payloadOverride: override,
    });

    return successResponse(
      res,
      { request: adminRequestView(row) },
      "درخواست تأیید و در سیستم اعمال شد",
    );
  } catch (error) {
    return failure(res, error, "خطا در تأیید درخواست");
  }
};

// ============================================
// POST /api/portal-requests/:id/reject
// ============================================
const rejectRequest = async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const row = await service.rejectRequest({
      requestId: req.params.id,
      reviewerId: reviewerIdOf(req),
      reason: body.reason || body.reject_reason,
    });

    return successResponse(
      res,
      { request: adminRequestView(row) },
      "درخواست رد شد و دلیل برای مشتری ثبت گردید",
    );
  } catch (error) {
    return failure(res, error, "خطا در رد درخواست");
  }
};

module.exports = {
  listRequests,
  getPendingCount,
  getRequest,
  // ✅ ۱۳.۱۶: دیکشنری‌های فقط-خواندنی صف (نام‌دار کردن payload)
  getDictionaries,
  approveRequest,
  rejectRequest,
};
