// ============================================================
// controllers/portalDashboardController.js
// «داشبورد تحلیلی پورتال مشتری» — فاز ۱۳.۸
// ------------------------------------------------------------
//  چرا فایل جدا از dashboardController؟
//   dashboardController.getChartsData/getAnalysisData برای کارکنان
//   نوشته شده‌اند و customerId را از کوئری می‌گیرند. اگر پورتال همان
//   مسیرها را باز می‌کرد، مشتری می‌توانست customerId هر کس دیگری را
//   بفرستد. این‌جا:
//     ۱) customerId از req.customerScopeId «تحمیل» می‌شود،
//     ۲) flockId/flockGroupId با middleware/portalOwnership سنجیده
//        می‌شود (قبل از رسیدن به کنترلر)،
//     ۳) هیچ لیست مشتری/کارشناسی به کلاینت نمی‌رود.
//   دادهٔ نمودار همان دادهٔ ماژول کارشناسان است (بدون دوباره‌نویسی
//   منطق محاسبات) — فقط مرزِ داده سخت‌تر است.
//
// 🔒 قواعد:
//   • مقایسه فقط بین گله‌های خودِ مشتری (تصمیم کارفرما در ۱۳.۸)
//   • هرگز customerId از بدنه/کوئری خوانده نمی‌شود
//   • کلیدهای customer.portal.chart.* فقط برچسب نمایش را کنترل می‌کنند
//     و در همین پاسخ به‌صورت charts:{...} برمی‌گردند
// ============================================================
"use strict";

const { Op } = require("sequelize");
const ChickPlacement = require("../models/ChickPlacement");
const Flock = require("../models/Flock");
const Hall = require("../models/Hall");
const WeeklyManagement = require("../models/WeeklyManagement");
const dashboardController = require("./dashboardController");
const {
  scopeIdOf,
  scopedRequest,
} = require("../services/portalDashboardScope");
const { userHasPermission } = require("../middleware/permissions");
const { successResponse, errorResponse } = require("../utils/response");

const denyUnlinked = (res) =>
  errorResponse(
    res,
    "حساب شما به پروندهٔ مشتری متصل نشده است؛ برای اتصال با مدیر سیستم تماس بگیرید",
    403,
  );

const toPlain = (row) =>
  row && typeof row.get === "function" ? row.get({ plain: true }) : row || {};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// ============================================
// GET /api/portal/dashboard/options
// ------------------------------------------------------------
// لیست «گزینه‌های نمودار» فقط از پروندهٔ خودم:
//   • flocks  → دوره‌های گله (Flock)  → برای انتخاب «کل گله»
//   • halls   → جوجه‌ریزی‌های فعال/گذشته + نام سالن → برای انتخاب «سالن»
//   • charts  → کدام نمودار برای این حساب مجاز است (کلیدهای chart.*)
// ============================================
const getMyDashboardOptions = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const scope = { customer_id: customerId };

    const [flockRows, placementRows] = await Promise.all([
      Flock.findAll({
        where: { ...scope },
        attributes: ["id", "flock_number", "placement_date", "status", "ended_at"],
        order: [
          ["placement_date", "DESC"],
          ["id", "DESC"],
        ],
        limit: 50,
      }),
      ChickPlacement.findAll({
        where: { ...scope },
        attributes: ["id", "flock_id", "hall_id", "placement_date", "is_active"],
        order: [
          ["placement_date", "DESC"],
          ["id", "DESC"],
        ],
        limit: 200,
      }),
    ]);

    const hallIds = [
      ...new Set(
        placementRows.map((row) => toNumber(toPlain(row).hall_id)).filter(Boolean),
      ),
    ];
    const hallRows = hallIds.length
      ? await Hall.findAll({
          where: { id: { [Op.in]: hallIds }, ...scope },
          attributes: ["id", "hall_name"],
        })
      : [];
    const hallName = new Map(
      hallRows.map((row) => {
        const plain = toPlain(row);
        return [plain.id, plain.hall_name || `سالن ${plain.id}`];
      }),
    );

    const [
      canWeight,
      canGain,
      canMortality,
      canFeed,
      canFcr,
      canStandards,
    ] = await Promise.all([
      userHasPermission(req, "customer.portal.chart.weight"),
      userHasPermission(req, "customer.portal.chart.gain"),
      userHasPermission(req, "customer.portal.chart.mortality"),
      userHasPermission(req, "customer.portal.chart.feed"),
      userHasPermission(req, "customer.portal.chart.fcr"),
      userHasPermission(req, "customer.portal.chart.standards"),
    ]);

    return successResponse(
      res,
      {
        flocks: flockRows.map((row) => {
          const plain = toPlain(row);
          return {
            id: plain.id,
            flock_number: plain.flock_number ?? null,
            placement_date: plain.placement_date || null,
            status: plain.status || "",
            is_active: plain.status === "active",
          };
        }),
        halls: placementRows.map((row) => {
          const plain = toPlain(row);
          return {
            id: plain.id,
            flock_id: plain.flock_id ?? null,
            hall_id: plain.hall_id ?? null,
            hall_name: hallName.get(plain.hall_id) || "",
            placement_date: plain.placement_date || null,
            is_active: Boolean(plain.is_active),
          };
        }),
        charts: {
          weight: canWeight,
          gain: canGain,
          mortality: canMortality,
          feed: canFeed,
          fcr: canFcr,
          standards: canStandards,
        },
        meta: { scope: "self", generated_at: new Date().toISOString() },
      },
      "گزینه‌های نمودار شما",
    );
  } catch (error) {
    console.error("❌ خطا در گزینه‌های داشبورد پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت گزینه‌های نمودار", 500);
  }
};

// ============================================
// GET /api/portal/dashboard/summary
// ------------------------------------------------------------
// خلاصهٔ آماری «فقط خودم» — به‌جای dashboardController.getSummary که
// شمار کل مشتریان و کل گله‌های سیستم را برمی‌گرداند (برای مشتری ممنوع).
// ============================================
const getMyDashboardSummary = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const scope = { customer_id: customerId };

    const [hallsTotal, activePlacements, weeksRows] = await Promise.all([
      Hall.count({ where: { ...scope } }),
      ChickPlacement.count({ where: { ...scope, is_active: true } }),
      WeeklyManagement.findAll({
        where: { ...scope },
        attributes: [
          "week_number",
          "week_start_date",
          "weekly_weight",
          "weekly_mortality",
          "weekly_feed_intake",
        ],
        order: [
          ["week_start_date", "DESC"],
          ["id", "DESC"],
        ],
        limit: 500,
      }),
    ]);

    const weeks = weeksRows.map((row) => toPlain(row));
    const weights = weeks.map((row) => toNumber(row.weekly_weight)).filter((v) => v !== null);
    const mortality = weeks.reduce(
      (sum, row) => sum + (toNumber(row.weekly_mortality) || 0),
      0,
    );
    const feed = weeks.reduce((sum, row) => sum + (toNumber(row.weekly_feed_intake) || 0), 0);
    const latestWeek = weeks[0]?.week_number ?? null;

    return successResponse(
      res,
      {
        halls: hallsTotal,
        active_flocks: activePlacements,
        weeks_recorded: weeks.length,
        latest_week: latestWeek,
        avg_weekly_weight: weights.length
          ? Number((weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(2))
          : null,
        total_mortality: mortality,
        total_feed: Number(feed.toFixed(2)),
        // ⚠️ FCR در این خلاصه محاسبه نمی‌شود: بدون «تعداد اولیهٔ جوجه» هر
        //    عددی گمراه‌کننده است؛ نمودار FCR از مسیر charts می‌آید.
        meta: { scope: "self", generated_at: new Date().toISOString() },
      },
      "خلاصهٔ آماری پروندهٔ شما",
    );
  } catch (error) {
    console.error("❌ خطا در خلاصهٔ داشبورد پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت خلاصهٔ آماری", 500);
  }
};

// ============================================
// دادهٔ نمودارها — «تحمیل اسکوپ سپس واگذاری»
// ------------------------------------------------------------
//  چرا واگذاری (delegate) و نه بازنویسی؟
//   منطق محاسبهٔ نمودارها (~۳۰۰ خط) در dashboardController است؛
//   دوباره‌نویسی آن یعنی دو منبع حقیقت و واگرایی عددی بین پنل کارشناس
//   و پورتال مشتری. این‌جا فقط مرزِ داده سخت می‌شود:
//     customerId ← req.customerScopeId   (هر مقدار کلاینت دور ریخته می‌شود)
//     flockId / flockGroupId ← قبلاً با portalOwnership سنجیده شده است
//
//  ⚠️ موج ۱۳.۱۰.۱ — باگ ۵۰۰:
//   Express 5، `req.query` را getter-only تعریف می‌کند؛ پس این الگوی
//   قبلی (`req.query = forcedQuery(req)`) در حالت strict یک TypeError
//   می‌داد و پورتال به‌جای نمودار، ۵۰۰ می‌گرفت. الان اسکوپ با
//   `scopedRequest` (پروکسی، بدون دست‌زدن به req اصلی) ساخته می‌شود.
// ============================================
const getMyCharts = async (req, res) => {
  try {
    if (!scopeIdOf(req)) return denyUnlinked(res);

    return await dashboardController.getChartsData(scopedRequest(req), res);
  } catch (error) {
    console.error("❌ خطا در نمودارهای داشبورد پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت دادهٔ نمودارها", 500);
  }
};

const getMyAnalysis = async (req, res) => {
  try {
    if (!scopeIdOf(req)) return denyUnlinked(res);

    return await dashboardController.getAnalysisData(scopedRequest(req), res);
  } catch (error) {
    console.error("❌ خطا در تحلیل‌های داشبورد پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت تحلیل‌ها", 500);
  }
};

module.exports = {
  getMyDashboardOptions,
  getMyDashboardSummary,
  getMyCharts,
  getMyAnalysis,
};
