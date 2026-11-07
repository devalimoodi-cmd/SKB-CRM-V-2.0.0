// ============================================================
// controllers/portalController.js
// «پورتال مشتری» — خلاصهٔ خواندنیِ پروندهٔ خودِ مشتری (فاز ۱۳.۲)
// ------------------------------------------------------------
// 🔒 سه قانون تغییرناپذیر:
//  ۱) هیچ شناسه‌ای از پارامترهای درخواست (آدرس، بدنه، مسیر) خوانده نمی‌شود.
//     تنها منبع، req.customerScopeId است (که middleware/customerScope.js
//     از users.customer_id توکن ساخته است).
//  ۲) هر کوئری با where: { customer_id: customerId } اجرا می‌شود
//     (بازهٔ داده = یک پرونده، نه کل دیتابیس).
//  ۳) خروجی فقط «خواندنی» و حداقلی است: شمارنده‌ها + ۳ ردیف آخر.
//     هیچ فیلد حساس/مالی/داخلی به مشتری نمی‌رسد.
// ============================================================
"use strict";

const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Hall = require("../models/Hall");
const Flock = require("../models/Flock");
const WeeklyManagement = require("../models/WeeklyManagement");
const VisitReport = require("../models/VisitReport");
const { normalizeCustomerId } = require("../services/customerScopeRules");
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

module.exports = {
  getPortalSummary,
};
