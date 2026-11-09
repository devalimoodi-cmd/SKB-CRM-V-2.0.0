// ============================================================
// controllers/portalFarmController.js
// «درخواست‌های فارم» — سمت مشتری (موج ۱۳.۱۱)
// ------------------------------------------------------------
//  مشتری از این‌جا «درخواست» می‌فرستد؛ هیچ ردیفی در
//  units/halls/chick_placements نوشته نمی‌شود. نوشتن واقعی فقط پس
//  از تأیید کارشناس در portalRequestAdminController انجام می‌شود.
//
// 🔒 قواعد تغییرناپذیر (هم‌راستا با بقیهٔ پورتال):
//  ۱) `customer_id` **فقط** از `req.customerScopeId` می‌آید (توکن)؛
//     هیچ فیلدی از بدنه/کوئری برای شناسهٔ مشتری خوانده نمی‌شود.
//  ۲) ردیف غیرخودی ⇒ ۴۰۴ (با requireOwnedRow در مسیر + دوباره در
//     سرویس) تا وجود درخواست مشتری دیگر لو نرود.
//  ۳) پاک‌سازی/اعتبارسنجی payload در services/portalRequestRules
//     است — این کنترلر هیچ قاعدهٔ دومی ندارد.
//  ۴) خروجی همیشه از نمای customerRequestView می‌آید (بدون IP/UA).
// ============================================================
"use strict";

const { successResponse, errorResponse } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");
const service = require("../services/portalRequestService");
const {
  LIMITS,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  REQUEST_MESSAGES,
  customerRequestView,
  normalizeStatusFilter,
} = require("../services/portalRequestRules");

// شناسهٔ پروندهٔ همین کاربر — فقط از توکن
const scopeIdOf = (req) => {
  const id = Number(req.customerScopeId || req.portalScopeId || 0);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// برچسب‌های مشترک UI (نوع/وضعیت/سقف‌ها) — یک منبع: سرویس قواعد
const uiMeta = (counts = null) => ({
  types: REQUEST_TYPES.map((item) => ({
    key: item.key,
    label: item.label,
    description: item.description,
    icon: item.icon,
    // ✅ ۱۳.۱۳: کلاینت باید بداند این نوع «حذف» است (هشدار/تأیید دوم)
    destructive: Boolean(item.destructive),
    target: item.target || null,
  })),
  statuses: REQUEST_STATUSES.map((item) => ({
    key: item.key,
    label: item.label,
    tone: item.tone,
  })),
  limits: LIMITS,
  counts,
});

// نگاشت خطای سرویس به پاسخ HTTP (پیام فارسی سرویس حفظ می‌شود)
const failure = (res, error, fallback) => {
  const status = Number(error && error.status) || 500;
  if (status >= 500) {
    console.error("❌ خطا در درخواست‌های فارم پورتال:", error.message);
  }
  return errorResponse(
    res,
    status >= 500 ? fallback : error.message,
    status,
    Array.isArray(error && error.errors) ? error.errors : null,
  );
};

// ============================================
// GET /api/portal/farm/options
// ------------------------------------------------------------
// واحدها/سالن‌های خودم + گله‌های فعال + دیکشنری حداقلی + سقف‌ها
// ============================================
const getFarmOptions = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, REQUEST_MESSAGES.unlinked, 403);

    const [options, counts] = await Promise.all([
      service.optionsFor(customerId),
      service.countsOf(customerId),
    ]);

    return successResponse(
      res,
      { options, meta: uiMeta(counts) },
      "گزینه‌های درخواست‌های شما",
    );
  } catch (error) {
    return failure(res, error, "خطا در دریافت گزینه‌های درخواست");
  }
};

// ============================================
// GET /api/portal/farm/requests
// ============================================
const listMyRequests = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, REQUEST_MESSAGES.unlinked, 403);

    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
    });

    const status = normalizeStatusFilter(req.query.status);
    const { rows, count, counts } = await service.listMyRequests({
      customerId,
      status,
      limit,
      offset,
    });

    return successResponse(
      res,
      {
        items: rows.map((row) => customerRequestView(row)),
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.max(1, Math.ceil(count / limit)),
        },
        meta: uiMeta(counts),
      },
      "درخواست‌های شما",
    );
  } catch (error) {
    return failure(res, error, "خطا در دریافت درخواست‌ها");
  }
};

// ============================================
// POST /api/portal/farm/requests
// ------------------------------------------------------------
//  بدنهٔ پیشنهادی: { request_type, payload:{…} }  یا  { type, …فیلدها }
//  هر دو پشتیبانی می‌شود تا کلاینت ساده‌تر باشد؛ ولی **فقط** کلیدهای
//  سفید همان نوع ذخیره می‌شوند (sanitizePayload).
// ============================================
const createMyRequest = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, REQUEST_MESSAGES.unlinked, 403);

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const type = body.request_type || body.type;
    const payloadSource =
      body.payload && typeof body.payload === "object" ? body.payload : body;

    const request = await service.createRequest({
      customerId,
      userId: req.user && req.user.id ? req.user.id : null,
      type,
      body: payloadSource,
      ip: req.ip,
      userAgent: req.get ? req.get("user-agent") : null,
    });

    return successResponse(
      res,
      {
        request: customerRequestView(request),
        meta: uiMeta(await service.countsOf(customerId)),
      },
      "درخواست شما ثبت شد و پس از تأیید کارشناس اعمال می‌شود",
      201,
    );
  } catch (error) {
    return failure(res, error, "خطا در ثبت درخواست");
  }
};

// ============================================
// POST /api/portal/farm/requests/:id/cancel
// ------------------------------------------------------------
//  ردیف مالکیت‌سنجی‌شده از requireOwnedRow می‌آید (۴۰۴ برای غیرخودی)
// ============================================
const cancelMyRequest = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, REQUEST_MESSAGES.unlinked, 403);

    const row = req.ownedRow;
    if (!row) return errorResponse(res, REQUEST_MESSAGES.not_found, 404);

    const updated = await service.cancelMyRequest({
      customerId,
      requestId: row.id,
    });

    return successResponse(
      res,
      { request: customerRequestView(updated) },
      "درخواست شما لغو شد",
    );
  } catch (error) {
    return failure(res, error, "خطا در لغو درخواست");
  }
};

// ============================================
// GET /api/portal/farm/halls/:id   — ✅ ۱۳.۱۳
// ------------------------------------------------------------
//  جزئیات یک سالن خودم (برای پیش‌پرکردن فرم ویرایش/ثبت جزئیات).
//  🔒 ردیف از `requireOwnedRow` آمده (۴۰۴ برای سالن غیرخودی) و
//  `customer_id` هرگز از مسیر/کوئری خوانده نمی‌شود.
// ============================================
const getMyHall = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return errorResponse(res, REQUEST_MESSAGES.unlinked, 403);

    const row = req.ownedRow;
    if (!row) return errorResponse(res, REQUEST_MESSAGES.hall_not_found, 404);

    const data = await service.hallDetailsFor({
      customerId,
      hallId: row.id,
    });

    return successResponse(res, data, "جزئیات سالن");
  } catch (error) {
    return failure(res, error, "خطا در دریافت جزئیات سالن");
  }
};

module.exports = {
  getFarmOptions,
  getMyHall,
  listMyRequests,
  createMyRequest,
  cancelMyRequest,
};
