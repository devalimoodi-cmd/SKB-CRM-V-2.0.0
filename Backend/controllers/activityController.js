// ============================================================
// controllers/activityController.js
// «ردّ فعالیت» (فاز ۱۲.۲) — لایهٔ HTTP
// ------------------------------------------------------------
// • GET /api/activity           : فهرست ردّ فعالیت (مدیر + مجوز)
// • GET /api/activity/summary   : خلاصهٔ آماری (مدیر + مجوز)
// • GET /api/activity/:id       : جزئیات یک ردیف (مدیر + مجوز)
// ------------------------------------------------------------
// ⚠️ هویتِ مشاهده‌گر از توکن می‌آید؛ فیلترها فقط query هستند.
// ⚠️ خروجی همیشه از rules.buildItem عبور می‌کند ⇒ `session_id`
//    (و هر ستون داخلی دیگر) هرگز به کلاینت نمی‌رسد.
// ============================================================
"use strict";

const activityService = require("../services/activityService");
const rules = require("../services/activityRules");
const { parsePagination } = require("../utils/pagination");
const { successResponse, errorResponse } = require("../utils/response");

const isTruthy = (value) => String(value ?? "").toLowerCase() === "true";
const isFalsy = (value) => String(value ?? "").toLowerCase() === "false";

// اولین کلید غیرخالی (پشتیبانی از snake_case و camelCase)
const pick = (query = {}, ...names) => {
  for (const name of names) {
    const value = query[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

// ساخت where از query (همه فیلترها اختیاری)
const buildWhere = (query = {}) => {
  const where = {};

  const userId = pick(query, "user_id", "userId");
  if (userId !== null) {
    const parsed = Number(userId);
    if (Number.isInteger(parsed) && parsed > 0) where.user_id = parsed;
  }

  const action = pick(query, "action");
  if (action) where.action = String(action).slice(0, 20);

  const entity = pick(query, "entity");
  if (entity) where.entity = String(entity).slice(0, 80);

  const entityId = pick(query, "entity_id", "entityId");
  if (entityId) where.entity_id = String(entityId).slice(0, 64);

  // ?customer_id=12 ⇒ همهٔ تغییرات یک مشتری (موج ۱۲.۵)
  //   ⚠️ ستون INTEGER است ⇒ فقط عدد صحیح مثبت پذیرفته می‌شود
  //      (مقدار نامعتبر ⇒ فیلتر نادیده گرفته می‌شود، نه خطای ۴۰۰،
  //       هم‌الگوی user_id).
  const customerId = pick(query, "customer_id", "customerId");
  if (customerId !== null) {
    const parsed = Number(String(customerId).trim());
    if (Number.isInteger(parsed) && parsed > 0) where.customer_id = parsed;
  }

  const method = pick(query, "method");
  if (method) where.method = String(method).toUpperCase().slice(0, 10);

  // ?success=true|false ⇒ فقط موفق‌ها یا فقط ناموفق‌ها
  const success = pick(query, "success");
  if (success !== null) {
    if (isTruthy(success)) where.success = true;
    else if (isFalsy(success)) where.success = false;
  }

  // ?from=2026-01-01&to=2026-02-01 ⇒ بازهٔ created_at
  const range = activityService.between(
    pick(query, "from", "date_from"),
    pick(query, "to", "date_to"),
  );
  if (range) where.created_at = range;

  return where;
};

// ===== فهرست =====
const list = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 25,
      maxLimit: 100,
    });

    const where = buildWhere(req.query);
    const { count, rows } = await activityService.list({ where, limit, offset });
    const now = Date.now();

    return successResponse(
      res,
      {
        activities: rows.map((row) => rules.buildItem(row, now)),
        where_keys: Object.keys(where),
        config: rules.config(),
        pagination: {
          page,
          limit,
          total: count,
          total_pages: Math.max(1, Math.ceil(count / limit)),
        },
      },
      "ردّ فعالیت کاربران",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت ردّ فعالیت:", error.message);
    return errorResponse(res, "خطا در دریافت ردّ فعالیت", 500);
  }
};

// ===== خلاصه =====
const summary = async (req, res) => {
  try {
    const data = await activityService.summary({
      limit: Number(req.query.limit) || 1000,
    });

    return successResponse(
      res,
      { ...data, config: rules.config() },
      "خلاصهٔ ردّ فعالیت",
    );
  } catch (error) {
    console.error("❌ خطا در خلاصهٔ ردّ فعالیت:", error.message);
    return errorResponse(res, "خطا در دریافت خلاصهٔ ردّ فعالیت", 500);
  }
};

// ===== جزئیات یک ردیف =====
const detail = async (req, res) => {
  try {
    const rawId = String(req.params.id || "");
    if (!/^\d+$/.test(rawId)) {
      return errorResponse(res, "شناسهٔ ردیف معتبر نیست", 400);
    }

    const row = await activityService.getById(Number(rawId));
    if (!row) return errorResponse(res, "ردّ فعالیت یافت نشد", 404);

    return successResponse(
      res,
      { activity: rules.buildItem(row, Date.now()) },
      "جزئیات ردّ فعالیت",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت ردّ فعالیت:", error.message);
    return errorResponse(res, "خطا در دریافت ردّ فعالیت", 500);
  }
};

module.exports = { list, summary, detail, buildWhere };
