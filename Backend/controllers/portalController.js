// ============================================================
// controllers/portalController.js
// «پورتال مشتری» — دادهٔ خواندنیِ پروندهٔ خودِ مشتری (فاز ۱۳.۲ و ۱۳.۳)
// ------------------------------------------------------------
// 🔒 سه قانون تغییرناپذیر:
//  ۱) هیچ شناسه‌ای از پارامترهای درخواست (آدرس، بدنه، مسیر) خوانده نمی‌شود.
//     تنها منبع، req.customerScopeId است (که middleware/customerScope.js
//     از users.customer_id توکن ساخته است).
//     ⚠️ تنها استثنا در ۱۳.۳: page/limit برای صفحه‌بندی (parsePagination).
//  ۲) هر کوئری با where: { customer_id: customerId } اجرا می‌شود
//     (بازهٔ داده = یک پرونده، نه کل دیتابیس).
//  ۳) خروجی فقط «خواندنی» و حداقلی است: شمارنده‌ها + ۳ ردیف آخر
//     (+ در ۱۳.۳: فهرست‌های صفحه‌بندی‌شدهٔ سالن/گله/هفته/بازدید).
//     هیچ فیلد حساس/مالی/داخلی به مشتری نمی‌رسد: کد ملی، کد پستی،
//     آدرس مزرعه، شمارهٔ پیام‌رسان، مسیر فایل پیوست و متن گزارش بازدید
//     هرگز در خروجی نیستند.
// ============================================================
"use strict";

const { Op } = require("sequelize");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Hall = require("../models/Hall");
const Flock = require("../models/Flock");
const WeeklyManagement = require("../models/WeeklyManagement");
const VisitReport = require("../models/VisitReport");
const { normalizeCustomerId } = require("../services/customerScopeRules");
const { parsePagination } = require("../utils/pagination");
const { successResponse, errorResponse } = require("../utils/response");

// سقف ردیف‌های «آخرین‌ها» (پورتال سبک بماند)
const LATEST_LIMIT = 3;

const toPlain = (row) =>
  row && typeof row.get === "function" ? row.get({ plain: true }) : row || {};

// DECIMAL در سکوئلایز به رشته می‌آید؛ برای کلاینت عدد می‌فرستیم
const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// ===== نمایش حداقلی پرونده (بدون کد ملی، ایمیل، آدرس و ...) =====
const customerView = (row) => ({
  id: row.id,
  customer_code: row.customer_code ?? null,
  full_name: row.full_name || "",
  farm_name: row.farm_name || "",
  province: row.province || "",
  county: row.county || "",
  mobile_number: row.mobile_number || "",
  active: Boolean(row.active),
  status: row.status || "",
});

const flockView = (row) => ({
  id: row.id,
  flock_number: row.flock_number ?? null,
  placement_date: row.placement_date || null,
  status: row.status || "",
});

const weekView = (row) => ({
  id: row.id,
  week_number: row.week_number ?? null,
  week_start_date: row.week_start_date || null,
  week_end_date: row.week_end_date || null,
  weekly_weight: toNumber(row.weekly_weight),
  weekly_mortality: toNumber(row.weekly_mortality),
});

const visitView = (row) => ({
  id: row.id,
  visit_date: row.visit_date || null,
  status: row.status || "unread",
});


// ============================================
// GET /api/portal/me
// ============================================
const getPortalSummary = async (req, res) => {
  try {
    // ✅ تنها منبع شناسه: اسکوپِ ساخته‌شده از توکن (نه از کلاینت)
    const customerId =
      normalizeCustomerId(req.customerScopeId) ||
      normalizeCustomerId(req.customerScope?.customerId);

    if (!customerId) {
      return errorResponse(
        res,
        "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
        403,
      );
    }

    const customerRow = await CustomerPersonalInfo.findByPk(customerId, {
      attributes: [
        "id",
        "customer_code",
        "full_name",
        "farm_name",
        "province",
        "county",
        "mobile_number",
        "active",
        "status",
      ],
    });

    if (!customerRow) {
      return errorResponse(res, "پروندهٔ مشتری یافت نشد", 404);
    }

    // ✅ مرزِ داده: همهٔ کوئری‌ها روی همین یک پرونده
    const scope = { customer_id: customerId };

    const [
      hallsTotal,
      hallsActive,
      flocksActive,
      weeksRecorded,
      visitsUnread,
      latestFlocks,
      latestWeeks,
      latestVisits,
    ] = await Promise.all([
      Hall.count({ where: { ...scope } }),
      Hall.count({ where: { ...scope, is_active: true } }),
      Flock.count({ where: { ...scope, status: "active" } }),
      WeeklyManagement.count({ where: { ...scope } }),
      VisitReport.count({ where: { ...scope, status: "unread" } }),
      Flock.findAll({
        where: { ...scope },
        attributes: ["id", "flock_number", "placement_date", "status"],
        order: [
          ["placement_date", "DESC"],
          ["id", "DESC"],
        ],
        limit: LATEST_LIMIT,
      }),
      WeeklyManagement.findAll({
        where: { ...scope },
        attributes: [
          "id",
          "week_number",
          "week_start_date",
          "week_end_date",
          "weekly_weight",
          "weekly_mortality",
        ],
        order: [
          ["week_start_date", "DESC"],
          ["id", "DESC"],
        ],
        limit: LATEST_LIMIT,
      }),
      VisitReport.findAll({
        where: { ...scope },
        attributes: ["id", "visit_date", "status"],
        order: [
          ["visit_date", "DESC"],
          ["id", "DESC"],
        ],
        limit: LATEST_LIMIT,
      }),
    ]);

    return successResponse(
      res,
      {
        customer: customerView(toPlain(customerRow)),
        link: {
          linked: true,
          user_id: req.user?.id ?? null,
          customer_id: customerId,
        },
        counters: {
          halls: hallsTotal,
          active_halls: hallsActive,
          active_flocks: flocksActive,
          weeks_recorded: weeksRecorded,
          unread_visits: visitsUnread,
        },
        latest: {
          flocks: latestFlocks.map((row) => flockView(toPlain(row))),
          weeks: latestWeeks.map((row) => weekView(toPlain(row))),
          visits: latestVisits.map((row) => visitView(toPlain(row))),
        },
        meta: {
          scope: "self",
          generated_at: new Date().toISOString(),
        },
      },
      "خلاصهٔ پورتال مشتری",
    );
  } catch (error) {
    console.error("❌ خطا در خلاصهٔ پورتال مشتری:", error.message);
    return errorResponse(res, "خطا در دریافت اطلاعات پورتال", 500);
  }
};

// ============================================
// فهرست‌های صفحه‌بندی‌شدهٔ پورتال (فاز ۱۳.۳)
// ------------------------------------------------------------
// 🔒 در همهٔ کنترلرهای زیر:
//   • شناسهٔ پرونده فقط از req.customerScopeId (ساخته‌شده از توکن)
//   • از req.query فقط page/limit خوانده می‌شود (parsePagination)
//   • هر کوئری با where: { customer_id: customerId } بسته می‌شود
// ============================================
const PORTAL_PAGE_DEFAULT = 20;
const PORTAL_PAGE_MAX = 50;

const paging = (query) =>
  parsePagination(query, {
    defaultLimit: PORTAL_PAGE_DEFAULT,
    maxLimit: PORTAL_PAGE_MAX,
  });

// شناسهٔ اسکوپ — تنها middleware می‌تواند آن را روی درخواست بنشاند
const scopeIdOf = (req) =>
  normalizeCustomerId(req.customerScopeId) ||
  normalizeCustomerId(req.customerScope?.customerId);

const denyUnlinked = (res) =>
  errorResponse(
    res,
    "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
    403,
  );

const pagedPayload = (items, total, page, limit) => ({
  items,
  pagination: {
    page,
    limit,
    total: Number.isInteger(total) ? total : 0,
    pages: limit > 0 ? Math.ceil((total || 0) / limit) : 0,
  },
  meta: { scope: "self", generated_at: new Date().toISOString() },
});

// ===== نگاشت امن ردیف‌ها (هیچ فیلد داخلی/حساس بیرون نمی‌رود) =====
const hallView = (row) => ({
  id: row.id,
  hall_name: row.hall_name || "",
  hall_number: row.hall_number ?? null,
  nominal_capacity: toNumber(row.nominal_capacity),
  is_active: Boolean(row.is_active),
});

const weekDetailView = (row, hallName) => ({
  id: row.id,
  week_number: row.week_number ?? null,
  week_start_date: row.week_start_date || null,
  week_end_date: row.week_end_date || null,
  flock_age_days: row.flock_age_days ?? null,
  weekly_weight: toNumber(row.weekly_weight),
  weekly_mortality: toNumber(row.weekly_mortality),
  weekly_feed_intake: toNumber(row.weekly_feed_intake),
  hall_name: hallName || "",
});

// ============================================
// GET /api/portal/halls
// ============================================
const getMyHalls = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const { page, limit, offset } = paging(req.query);
    const scope = { customer_id: customerId };

    const { rows, count } = await Hall.findAndCountAll({
      where: { ...scope },
      attributes: [
        "id",
        "hall_name",
        "hall_number",
        "nominal_capacity",
        "is_active",
      ],
      order: [
        ["hall_name", "ASC"],
        ["id", "ASC"],
      ],
      limit,
      offset,
    });

    return successResponse(
      res,
      pagedPayload(
        rows.map((row) => hallView(toPlain(row))),
        count,
        page,
        limit,
      ),
      "سالن‌های پروندهٔ شما",
    );
  } catch (error) {
    console.error("❌ خطا در فهرست سالن‌های پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت سالن‌ها", 500);
  }
};

// ============================================
// GET /api/portal/flocks
// ============================================
const getMyFlocks = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const { page, limit, offset } = paging(req.query);
    const scope = { customer_id: customerId };

    const { rows, count } = await Flock.findAndCountAll({
      where: { ...scope },
      attributes: [
        "id",
        "flock_number",
        "placement_date",
        "status",
        "ended_at",
      ],
      order: [
        ["placement_date", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });

    return successResponse(
      res,
      pagedPayload(
        rows.map((row) => {
          const plain = toPlain(row);
          return { ...flockView(plain), ended_at: plain.ended_at || null };
        }),
        count,
        page,
        limit,
      ),
      "گله‌های پروندهٔ شما",
    );
  } catch (error) {
    console.error("❌ خطا در فهرست گله‌های پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت گله‌ها", 500);
  }
};

// ============================================
// GET /api/portal/weeks
// ============================================
const getMyWeeks = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const { page, limit, offset } = paging(req.query);
    const scope = { customer_id: customerId };

    const { rows, count } = await WeeklyManagement.findAndCountAll({
      where: { ...scope },
      attributes: [
        "id",
        "week_number",
        "week_start_date",
        "week_end_date",
        "flock_age_days",
        "weekly_weight",
        "weekly_mortality",
        "weekly_feed_intake",
        "hall_id",
      ],
      order: [
        ["week_start_date", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });

    const plains = rows.map((row) => toPlain(row));
    const hallIds = [
      ...new Set(
        plains
          .map((row) => row.hall_id)
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];

    // نام سالن با کوئری دومِ اسکوپ‌شده (include عمداً استفاده نمی‌شود تا
    // هیچ ستون ناخواسته‌ای از سالن به خروجی نشت نکند).
    const hallNameById = new Map();
    if (hallIds.length > 0) {
      const halls = await Hall.findAll({
        where: { ...scope, id: { [Op.in]: hallIds } },
        attributes: ["id", "hall_name"],
      });
      halls.forEach((row) => {
        const plain = toPlain(row);
        hallNameById.set(plain.id, plain.hall_name || "");
      });
    }

    return successResponse(
      res,
      pagedPayload(
        plains.map((row) => weekDetailView(row, hallNameById.get(row.hall_id))),
        count,
        page,
        limit,
      ),
      "هفته‌های مدیریتی پروندهٔ شما",
    );
  } catch (error) {
    console.error("❌ خطا در فهرست هفته‌های پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت هفته‌های مدیریتی", 500);
  }
};

// ============================================
// GET /api/portal/visits
// ------------------------------------------------------------
// فقط تاریخ و وضعیت: متن گزارش، پیوست‌ها و نام کارشناس
// در این موج عمداً بیرون نمی‌روند (موج ۱۳.۴ با کلید مجوز جدا).
// ============================================
const getMyVisits = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const { page, limit, offset } = paging(req.query);
    const scope = { customer_id: customerId };

    const { rows, count } = await VisitReport.findAndCountAll({
      where: { ...scope },
      attributes: ["id", "visit_date", "status"],
      order: [
        ["visit_date", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });

    return successResponse(
      res,
      pagedPayload(
        rows.map((row) => visitView(toPlain(row))),
        count,
        page,
        limit,
      ),
      "بازدیدهای پروندهٔ شما",
    );
  } catch (error) {
    console.error("❌ خطا در فهرست بازدیدهای پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت بازدیدها", 500);
  }
};

module.exports = {
  getPortalSummary,
  getMyHalls,
  getMyFlocks,
  getMyWeeks,
  getMyVisits,
};
