// ============================================================
// controllers/portalController.js
// «پورتال مشتری» — دادهٔ خواندنیِ پروندهٔ خودِ مشتری
// (فاز ۱۳.۲، ۱۳.۳ و ۱۳.۴)
// ------------------------------------------------------------
// 🔒 قوانین تغییرناپذیر:
//  ۱) شناسهٔ «پرونده» (customer_id) هرگز از پارامترهای درخواست خوانده
//     نمی‌شود. تنها منبع، req.customerScopeId است (که
//     middleware/customerScope.js از users.customer_id توکن ساخته است).
//     ⚠️ از ۱۳.۴ یک استثنای محدود: شناسهٔ «ردیف خودم» در مسیر
//     (req.params.id / req.params.attachmentId) — فقط برای جزئیات یک
//     هفته/بازدید/پیوست. این شناسه همیشه همراه customer_id در همان
//     WHERE می‌آید و ردیف غیرخودی پاسخ ۴۰۴ می‌گیرد (نه ۴۰۳) تا وجود
//     ردیف مشتری دیگر لو نرود.
//  ۲) هر کوئری روی دادهٔ مشتری با customer_id همراه است
//     (بازهٔ داده = یک پرونده، نه کل دیتابیس). جدول‌های فرزند
//     (weekly_*، attachments، visit_report_halls) از طریق «والدِ
//     تأییدشده» خوانده می‌شوند، چون customer_id آن‌ها null‌پذیر است و
//     ردیف‌های قدیمی آن را خالی دارند.
//  ۳) خروجی فقط «خواندنی» و حداقلی است. هرگز بیرون نمی‌رود: کد ملی،
//     کد پستی، آدرس مزرعه، شمارهٔ پیام‌رسان، مسیر فیزیکی فایل پیوست
//     (file_path)، نام/شناسهٔ کارشناس بازدید و یادداشت‌های داخلی هفته.
// ============================================================
"use strict";

const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Hall = require("../models/Hall");
const Flock = require("../models/Flock");
const WeeklyManagement = require("../models/WeeklyManagement");
const WeeklyDisease = require("../models/WeeklyDisease");
const WeeklyMedicine = require("../models/WeeklyMedicine");
const WeeklyVaccine = require("../models/WeeklyVaccine");
const WeeklyFeed = require("../models/WeeklyFeed");
const Disease = require("../models/Disease");
const Medicine = require("../models/Medicine");
const Vaccine = require("../models/Vaccine");
const FeedType = require("../models/FeedType");
const VisitReport = require("../models/VisitReport");
const VisitReportAttachment = require("../models/VisitReportAttachment");
const VisitReportHall = require("../models/VisitReportHall");
const { normalizeCustomerId } = require("../services/customerScopeRules");
const { userHasPermission } = require("../middleware/permissions");
const { parsePagination } = require("../utils/pagination");
const { successResponse, errorResponse } = require("../utils/response");
// ✅ موج ۱۳.۸ — پروفایل «خودم» (فهرست سفید + قواعد خالص)
const CustomerType = require("../models/CustomerType");
const User = require("../models/User");
const {
  PROFILE_EDITABLE,
  PROFILE_LOCKED,
  validateProfilePatch,
  changedFields,
} = require("../services/portalProfileRules");
const { maskMobile } = require("../services/registrationRules");

// سقف ردیف‌های «آخرین‌ها» (پورتال سبک بماند)
const LATEST_LIMIT = 3;

// ریشهٔ مجاز فایل‌های پیوست (هیچ فایلی بیرون این پوشه سرو نمی‌شود)
const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");


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

// ۱۳.۴: ردیف فهرست بازدید + دو نشانهٔ کمکی
// (خودِ متن گزارش و فهرست پیوست‌ها فقط در اندپوینت جزئیات می‌آید)
const visitListView = (row, attachmentCount) => ({
  ...visitView(row),
  has_report: Boolean(String(row.report_text || "").trim()),
  attachment_count: Number.isInteger(attachmentCount) ? attachmentCount : 0,
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

    // ✅ ۱۳.۵: بخشی که مدیر برای نقش/کاربرِ مشتری بسته است، در خلاصه هم
    //    لو نمی‌رود: شمارندهٔ آن null می‌شود (کارت مربوطه در UI حذف
    //    می‌شود) و «آخرین ردیف‌ها»ی آن خالی برمی‌گردد.
    //    کلیدها: customer.portal.{halls,flocks,weeks,visits}
    // ✅ ۱۳.۸: تب‌های «پروفایل من» و «داشبورد تحلیلی» هم کلید مستقل دارند.
    const [
      canHalls,
      canFlocks,
      canWeeks,
      canVisits,
      canProfile,
      canProfileEdit,
      canDashboard,
      canDashboardAnalysis,
      canDashboardCompare,
      canDashboardExport,
      canFarm,
      canFarmRequest,
      canFarmCancel,
      canCompletion,
      canCompletionReport,
    ] = await Promise.all([
      userHasPermission(req, "customer.portal.halls"),
      userHasPermission(req, "customer.portal.flocks"),
      userHasPermission(req, "customer.portal.weeks"),
      userHasPermission(req, "customer.portal.visits"),
      userHasPermission(req, "customer.portal.profile"),
      userHasPermission(req, "customer.portal.profile.edit"),
      userHasPermission(req, "customer.portal.dashboard"),
      userHasPermission(req, "customer.portal.dashboard.analysis"),
      userHasPermission(req, "customer.portal.dashboard.compare"),
      userHasPermission(req, "customer.portal.dashboard.export"),
      // ✅ موج ۱۳.۱۱ — «درخواست‌های فارم» (الگوی ب)
      userHasPermission(req, "customer.portal.farm"),
      userHasPermission(req, "customer.portal.farm.request"),
      userHasPermission(req, "customer.portal.farm.cancel"),
      // ✅ موج ۱۳.۱۹ — «پایان دوره» + گزارش تفصیلی آن
      userHasPermission(req, "customer.portal.completion"),
      userHasPermission(req, "customer.portal.completion.report"),
    ]);

    const sections = {
      halls: canHalls,
      flocks: canFlocks,
      weeks: canWeeks,
      visits: canVisits,
      profile: canProfile,
      dashboard: canDashboard,
      // ✅ تب «درخواست‌های فارم» — تا تأیید کارشناس چیزی ساخته نمی‌شود
      farm: canFarm,
      // ✅ ۱۳.۱۹: «پایان دوره» و «گزارش نهایی» — گزارش نهایی فقط با
      //    هر دو کلید (فهرست + تفصیل) باز می‌شود تا پنل هرگز بدون
      //    انتخابگر دوره به کاربر نشان داده نشود.
      completion: canCompletion,
      finalReport: Boolean(canCompletion && canCompletionReport),
    };

    // null = «این بخش بسته است» (با 0 اشتباه نشود)
    const orNull = (allowed, value) => (allowed ? value : null);

    return successResponse(
      res,
      {
        customer: customerView(toPlain(customerRow)),
        link: {
          linked: true,
          user_id: req.user?.id ?? null,
          customer_id: customerId,
        },
        // ✅ منبع حقیقت برای فرانت: کدام تب‌ها برای این حساب باز است
        sections,
        // ✅ ۱۳.۸: قابلیت‌های درون‌تبی (ویرایش پروفایل/تحلیل/مقایسه)
        features: {
          can_edit_profile: Boolean(canProfile && canProfileEdit),
          dashboard_analysis: Boolean(canDashboard && canDashboardAnalysis),
          dashboard_compare: Boolean(canDashboard && canDashboardCompare),
          dashboard_export: Boolean(canDashboard && canDashboardExport),
          // ✅ ۱۳.۱۱: فقط گیت دکمه‌ها — اعمال واقعی پس از تأیید کارشناس
          farm_request: Boolean(canFarm && canFarmRequest),
          farm_cancel: Boolean(canFarm && canFarmCancel),
          // ✅ ۱۳.۱۹: دکمهٔ «مشاهدهٔ گزارش نهایی» روی کارت پایان دوره
          completion_report: Boolean(canCompletion && canCompletionReport),
        },
        counters: {
          halls: orNull(canHalls, hallsTotal),
          active_halls: orNull(canHalls, hallsActive),
          active_flocks: orNull(canFlocks, flocksActive),
          weeks_recorded: orNull(canWeeks, weeksRecorded),
          unread_visits: orNull(canVisits, visitsUnread),
        },
        latest: {
          flocks: canFlocks
            ? latestFlocks.map((row) => flockView(toPlain(row)))
            : [],
          weeks: canWeeks
            ? latestWeeks.map((row) => weekView(toPlain(row)))
            : [],
          visits: canVisits
            ? latestVisits.map((row) => visitView(toPlain(row)))
            : [],
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

// ============================================
// کمک‌های موج ۱۳.۴ (جزئیات ردیف + دانلود امن)
// ============================================
// شناسهٔ ردیف در مسیر: فقط عدد صحیح مثبت و کوتاه
// (ضد تزریق/سرریز؛ «۱۲abc» یا «-۳» همان‌جا ۴۰۰ می‌گیرد)
const ROW_ID_PATTERN = /^\d{1,9}$/;

const parseRowId = (value) => {
  const raw = String(value === null || value === undefined ? "" : value).trim();
  if (!ROW_ID_PATTERN.test(raw)) return null;
  const parsed = Number(raw);
  return parsed > 0 ? parsed : null;
};

// نام سالن‌ها با کوئری دومِ اسکوپ‌شده (هم‌الگو با فهرست هفته‌ها؛ include ممنوع)
const scopedHallNames = async (customerId, hallIds) => {
  const unique = [
    ...new Set((hallIds || []).filter((id) => Number.isInteger(id) && id > 0)),
  ];
  const nameById = new Map();
  if (unique.length === 0) return nameById;

  const halls = await Hall.findAll({
    where: { customer_id: customerId, id: { [Op.in]: unique } },
    attributes: ["id", "hall_name"],
  });
  halls.forEach((row) => {
    const plain = toPlain(row);
    nameById.set(plain.id, plain.hall_name || "");
  });
  return nameById;
};

// نام کاتالوگ (بیماری/واکسن/دارو/خوراک) — فقط ستون نام
const catalogNames = async (Model, ids) => {
  const unique = [
    ...new Set((ids || []).filter((id) => Number.isInteger(id) && id > 0)),
  ];
  const nameById = new Map();
  if (unique.length === 0) return nameById;

  const rows = await Model.findAll({
    where: { id: { [Op.in]: unique } },
    attributes: ["id", "name"],
  });
  rows.forEach((row) => {
    const plain = toPlain(row);
    nameById.set(plain.id, plain.name || "");
  });
  return nameById;
};

// [{ id, name }] — خروجی جزئیات هفته
const nameList = (ids, nameById) =>
  (ids || []).map((id) => ({ id, name: nameById.get(id) || "" }));

// شناسه‌های ستون کلید خارجی از ردیف‌های فرزند (فقط عدد مثبت)
const idsOf = (rows, field) =>
  (rows || [])
    .map((row) => toPlain(row)[field])
    .filter((id) => Number.isInteger(id) && id > 0);

// مسیر فایل پیوست: باید داخل uploads/ باشد (ضد path traversal)
const resolveUploadPath = (filePath) => {
  const raw = String(filePath || "").trim();
  if (!raw) return null;

  const rootPrefix = UPLOADS_ROOT + path.sep;
  const candidates = path.isAbsolute(raw)
    ? [path.resolve(raw)]
    : [path.resolve(raw), path.resolve(__dirname, "..", raw)];

  return candidates.find((candidate) => candidate.startsWith(rootPrefix)) || null;
};

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

// ===== جزئیات هفته (۱۳.۴): همان نگاشت فهرست + چهار گروه کاتالوگ =====
// ⚠️ additional_notes و service_expert_id عمداً در خروجی نیستند.
const weekFullView = (row, hallName, groups) => ({
  ...weekDetailView(row, hallName),
  diseases: groups.diseases,
  vaccines: groups.vaccines,
  medicines: groups.medicines,
  feeds: groups.feeds,
});

// ===== پیوست‌ها: فقط متادیتا؛ file_path هرگز بیرون نمی‌رود =====
const attachmentView = (row) => ({
  id: row.id,
  file_name: row.file_name || "",
  file_size: row.file_size ?? null,
  mime_type: row.mime_type || "",
});

// ===== گزارش بازدید (۱۳.۴): متن + نام سالن‌ها، بدون هویت کارشناس =====
const visitReportView = (row, hallNames) => ({
  id: row.id,
  visit_date: row.visit_date || null,
  status: row.status || "unread",
  report_text: String(row.report_text || ""),
  hall_names: hallNames,
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
// فهرست بازدیدها: تاریخ، وضعیت و دو نشانهٔ کمکی (has_report،
// attachment_count). خودِ متن گزارش و فهرست پیوست‌ها فقط از
// اندپوینت جزئیات (/visits/:id) و با کلید مجوز جدا می‌آید.
// ============================================
const getMyVisits = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const { page, limit, offset } = paging(req.query);
    const scope = { customer_id: customerId };

    const { rows, count } = await VisitReport.findAndCountAll({
      where: { ...scope },
      // report_text فقط برای محاسبهٔ «has_report» خوانده می‌شود و
      // هرگز در پاسخ فهرست قرار نمی‌گیرد (متن فقط در /visits/:id)
      attributes: ["id", "visit_date", "status", "report_text"],
      order: [
        ["visit_date", "DESC"],
        ["id", "DESC"],
      ],
      limit,
      offset,
    });

    const plains = rows.map((row) => toPlain(row));
    const reportIds = plains
      .map((row) => row.id)
      .filter((id) => Number.isInteger(id) && id > 0);

    // شمارش پیوست‌ها با یک کوئری گروهی برای همین صفحه
    const attachmentCountById = new Map();
    if (reportIds.length > 0) {
      const grouped = await VisitReportAttachment.count({
        where: { visit_report_id: { [Op.in]: reportIds } },
        group: ["visit_report_id"],
      });
      (grouped || []).forEach((row) => {
        const plain = toPlain(row);
        attachmentCountById.set(
          plain.visit_report_id,
          Number(plain.count) || 0,
        );
      });
    }

    return successResponse(
      res,
      pagedPayload(
        plains.map((row) =>
          visitListView(row, attachmentCountById.get(row.id)),
        ),
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

// ============================================
// GET /api/portal/weeks/:id   (فاز ۱۳.۴)
// ------------------------------------------------------------
// جزئیات یک هفتهٔ مدیریتی + چهار گروه کاتالوگ (بیماری/واکسن/دارو/خوراک).
// 🔒 شناسهٔ مسیر فقط «ردیف خودم» است: در همان کوئری همراه customer_id
//    می‌آید و ردیف غیرخودی ۴۰۴ می‌گیرد (نه ۴۰۳، تا وجودش لو نرود).
//    جدول‌های فرزند از طریق والدِ تأییدشده خوانده می‌شوند.
// ============================================
const getMyWeekDetail = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const weekId = parseRowId(req.params.id);
    if (!weekId) {
      return errorResponse(res, "شناسهٔ هفتهٔ مدیریتی نامعتبر است", 400);
    }

    const weekRow = await WeeklyManagement.findOne({
      where: { id: weekId, customer_id: customerId },
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
    });

    if (!weekRow) {
      return errorResponse(res, "این هفتهٔ مدیریتی در پروندهٔ شما یافت نشد", 404);
    }

    const plain = toPlain(weekRow);

    const [diseaseRows, vaccineRows, medicineRows, feedRows] =
      await Promise.all([
        WeeklyDisease.findAll({
          where: { weekly_management_id: weekId },
          attributes: ["disease_id"],
        }),
        WeeklyVaccine.findAll({
          where: { weekly_management_id: weekId },
          attributes: ["vaccine_id"],
        }),
        WeeklyMedicine.findAll({
          where: { weekly_management_id: weekId },
          attributes: ["medicine_id"],
        }),
        WeeklyFeed.findAll({
          where: { weekly_management_id: weekId },
          attributes: ["feed_type_id"],
        }),
      ]);

    const diseaseIds = idsOf(diseaseRows, "disease_id");
    const vaccineIds = idsOf(vaccineRows, "vaccine_id");
    const medicineIds = idsOf(medicineRows, "medicine_id");
    const feedIds = idsOf(feedRows, "feed_type_id");

    const [diseaseNames, vaccineNames, medicineNames, feedNames, hallNames] =
      await Promise.all([
        catalogNames(Disease, diseaseIds),
        catalogNames(Vaccine, vaccineIds),
        catalogNames(Medicine, medicineIds),
        catalogNames(FeedType, feedIds),
        scopedHallNames(customerId, [plain.hall_id]),
      ]);

    return successResponse(
      res,
      {
        week: weekFullView(plain, hallNames.get(plain.hall_id), {
          diseases: nameList(diseaseIds, diseaseNames),
          vaccines: nameList(vaccineIds, vaccineNames),
          medicines: nameList(medicineIds, medicineNames),
          feeds: nameList(feedIds, feedNames),
        }),
        meta: { scope: "self", generated_at: new Date().toISOString() },
      },
      "جزئیات هفتهٔ مدیریتی پروندهٔ شما",
    );
  } catch (error) {
    console.error("❌ خطا در جزئیات هفتهٔ پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت جزئیات هفتهٔ مدیریتی", 500);
  }
};

// ============================================
// GET /api/portal/visits/:id   (فاز ۱۳.۴)
// ------------------------------------------------------------
// متن گزارش + فهرست پیوست‌ها (فقط متادیتا) + نام سالن‌های بازدیدشده.
// ⚠️ نام/شناسهٔ کارشناس، file_path و created_by هرگز بیرون نمی‌روند.
// ============================================
const getMyVisitDetail = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const visitId = parseRowId(req.params.id);
    if (!visitId) {
      return errorResponse(res, "شناسهٔ بازدید نامعتبر است", 400);
    }

    const visitRow = await VisitReport.findOne({
      where: { id: visitId, customer_id: customerId },
      attributes: ["id", "visit_date", "status", "report_text"],
    });

    if (!visitRow) {
      return errorResponse(res, "این بازدید در پروندهٔ شما یافت نشد", 404);
    }

    const plain = toPlain(visitRow);

    const [attachmentRows, hallRows] = await Promise.all([
      VisitReportAttachment.findAll({
        where: { visit_report_id: visitId },
        attributes: ["id", "file_name", "file_size", "mime_type"],
        order: [["id", "ASC"]],
      }),
      VisitReportHall.findAll({
        where: { visit_report_id: visitId },
        attributes: ["hall_id"],
      }),
    ]);

    const hallNames = await scopedHallNames(
      customerId,
      idsOf(hallRows, "hall_id"),
    );

    return successResponse(
      res,
      {
        visit: visitReportView(plain, Array.from(hallNames.values())),
        attachments: attachmentRows.map((row) => attachmentView(toPlain(row))),
        meta: { scope: "self", generated_at: new Date().toISOString() },
      },
      "جزئیات بازدید پروندهٔ شما",
    );
  } catch (error) {
    console.error("❌ خطا در جزئیات بازدید پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت جزئیات بازدید", 500);
  }
};

// ============================================
// GET /api/portal/visits/:id/attachments/:attachmentId   (فاز ۱۳.۴)
// ------------------------------------------------------------
// 🔒 سه سد پشت‌سرهم:
//   ۱) بازدید باید متعلق به همین پرونده باشد (customer_id در همان WHERE)
//   ۲) پیوست باید متعلق به همان بازدید باشد (کلید خارجی، نه فقط id)
//   ۳) مسیر فایل باید داخل uploads/ باشد (ضد path traversal) و موجود باشد
// ============================================
const downloadMyAttachment = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const visitId = parseRowId(req.params.id);
    const attachmentId = parseRowId(req.params.attachmentId);
    if (!visitId || !attachmentId) {
      return errorResponse(res, "شناسهٔ بازدید یا پیوست نامعتبر است", 400);
    }

    const owned = await VisitReport.count({
      where: { id: visitId, customer_id: customerId },
    });
    if (!owned) {
      return errorResponse(res, "این بازدید در پروندهٔ شما یافت نشد", 404);
    }

    const attachmentRow = await VisitReportAttachment.findOne({
      where: { id: attachmentId, visit_report_id: visitId },
      attributes: ["id", "file_name", "file_path"],
    });
    if (!attachmentRow) {
      return errorResponse(res, "پیوست موردنظر یافت نشد", 404);
    }

    const attachment = toPlain(attachmentRow);
    const resolved = resolveUploadPath(attachment.file_path);
    if (!resolved) {
      console.warn(
        `⚠️ [portal] مسیر پیوست خارج از uploads بود (id=${attachment.id})`,
      );
      return errorResponse(res, "دسترسی به این فایل مجاز نیست", 403);
    }

    if (!fs.existsSync(resolved)) {
      return errorResponse(res, "فایل این پیوست در سرور موجود نیست", 404);
    }

    // لاگ حسابرسی سبک (بدون دادهٔ حساس — فقط شناسه‌ها)
    console.info(
      `📎 [portal] دانلود پیوست ${attachment.id} (بازدید ${visitId}) برای پرونده ${customerId}`,
    );

    const downloadName =
      path.basename(String(attachment.file_name || "").trim()) ||
      path.basename(resolved);

    return res.download(resolved, downloadName);
  } catch (error) {
    console.error("❌ خطا در دانلود پیوست پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت فایل پیوست", 500);
  }
};

// ============================================
// GET /api/portal/profile   (فاز ۱۳.۸)
// ------------------------------------------------------------
// 🔒 خروجی: فقط پروندهٔ خودم + فهرست فیلدهای قابل ویرایش.
//    شمارهٔ موبایل ماسک‌شده می‌آید (تغییرش مسیر پیامکی جدا دارد) و
//    هیچ ستون داخلی (created_by/updated_by/sales_department) بیرون نمی‌رود.
// ============================================
const PROFILE_ATTRIBUTES = [
  "id",
  "customer_code",
  "customer_type_id",
  "full_name",
  "farm_name",
  "collection_name",
  "national_code",
  "email",
  "date_of_birth",
  "experience_years",
  "education_level",
  "gender",
  "province",
  "county",
  "postal_code",
  "farm_address",
  "messaging_number",
  "skb_how_know",
  "mobile_number",
  "active",
  "status",
  "updated_by",
  "updated_at",
];

// نگاشت امن: فقط کلیدهای سفید + وضعیت ویرایش
const profileView = (row, { customerType = null, userId = null } = {}) => {
  const plain = toPlain(row);
  const fields = {};
  PROFILE_EDITABLE.forEach((field) => {
    const value = plain[field];
    fields[field] =
      value === null || value === undefined
        ? ""
        : value instanceof Date
          ? value.toISOString().slice(0, 10)
          : String(value);
  });

  return {
    id: plain.id,
    customer_code: plain.customer_code ?? null,
    // 🔒 نوع مشتری فقط خواندنی است (مشتری نمی‌تواند عوضش کند)
    customer_type: customerType
      ? { id: customerType.id, name: customerType.name || "" }
      : plain.customer_type_id
        ? { id: plain.customer_type_id, name: "" }
        : null,
    fields,
    mobile: {
      masked: maskMobile(plain.mobile_number),
      // 🌟 تغییر شماره فقط با کد پیامکی (نه با همین PATCH)
      change_requires_otp: true,
    },
    active: Boolean(plain.active),
    status: plain.status || "",
    // 🌟 نشانهٔ «آخرین ویرایش توسط خودِ مشتری» (نه کارشناس)
    edited_by_customer: Boolean(
      userId && Number(plain.updated_by) === Number(userId),
    ),
    updated_at: plain.updated_at || null,
  };
};

const getMyProfile = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const row = await CustomerPersonalInfo.findByPk(customerId, {
      attributes: PROFILE_ATTRIBUTES,
    });
    if (!row) return errorResponse(res, "پروندهٔ مشتری یافت نشد", 404);

    const plain = toPlain(row);
    const customerType = plain.customer_type_id
      ? await CustomerType.findByPk(plain.customer_type_id, {
          attributes: ["id", "name"],
        })
      : null;

    const canEdit = await userHasPermission(req, "customer.portal.profile.edit");

    return successResponse(
      res,
      {
        profile: profileView(row, {
          customerType: customerType ? toPlain(customerType) : null,
          userId: req.user?.id ?? null,
        }),
        can_edit: canEdit,
        editable_fields: PROFILE_EDITABLE,
        locked_fields: PROFILE_LOCKED,
        meta: { scope: "self", generated_at: new Date().toISOString() },
      },
      "پروفایل شما",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت پروفایل پورتال:", error.message);
    return errorResponse(res, "خطا در دریافت پروفایل", 500);
  }
};

// ============================================
// PUT /api/portal/profile   (فاز ۱۳.۸)
// ------------------------------------------------------------
// 🔒 تنها مسیر *نوشتن* پروفایل در پورتال:
//   • فهرست سفید (PROFILE_EDITABLE) — نه یک فیلد بیشتر
//   • customer_type_id / active / status / customer_code قابل تغییر نیستند
//   • mobile_number در همین مسیر نادیده گرفته می‌شود (مسیر OTP جدا)
//   • داده بی‌درنگ فعال است (بدون صف تأیید) — تصمیم کارفرما در ۱۳.۸
// ============================================
const updateMyProfile = async (req, res) => {
  try {
    const customerId = scopeIdOf(req);
    if (!customerId) return denyUnlinked(res);

    const patch = validateProfilePatch(req.body);
    if (!patch.ok) {
      return res.status(400).json({
        success: false,
        code: "PORTAL_PROFILE_INVALID",
        message: "اطلاعات ارسالی معتبر نیست",
        errors: patch.errors,
        timestamp: new Date().toISOString(),
      });
    }

    const row = await CustomerPersonalInfo.findByPk(customerId, {
      attributes: PROFILE_ATTRIBUTES,
    });
    if (!row) return errorResponse(res, "پروندهٔ مشتری یافت نشد", 404);

    const before = toPlain(row);
    const changes = changedFields(before, patch.values);

    if (changes.length === 0) {
      return successResponse(
        res,
        {
          changed: [],
          profile: profileView(row, { userId: req.user?.id ?? null }),
          // اگر کلاینت خواسته بود موبایل را همین‌جا عوض کند، راهنمایی می‌شود
          mobile_hint: patch.mobileAttempted
            ? "تغییر شمارهٔ موبایل فقط با کد پیامکی انجام می‌شود"
            : null,
        },
        "تغییری برای ثبت وجود نداشت",
      );
    }

    // ایمیل یکتاست (در پرونده‌ها و در حساب‌های کاربری) ⇒ پیش از نوشتن بسنج
    if (changes.includes("email") && patch.values.email) {
      const email = patch.values.email;
      const [sameCustomer, sameUser] = await Promise.all([
        CustomerPersonalInfo.count({
          where: { email: { [Op.iLike]: email }, id: { [Op.ne]: customerId } },
        }),
        User.count({ where: { email: { [Op.iLike]: email } } }),
      ]);
      if (sameCustomer > 0 || sameUser > 0) {
        return res.status(409).json({
          success: false,
          code: "PORTAL_PROFILE_EMAIL_TAKEN",
          message: "این ایمیل قبلاً ثبت شده است",
          errors: { email: "این ایمیل قبلاً ثبت شده است" },
          timestamp: new Date().toISOString(),
        });
      }
    }

    // اعمال تغییرات (به‌همراه ثبت اینکه آخرین ویرایش از سمت خودِ مشتری بود)
    const patchValues = {};
    changes.forEach((field) => {
      patchValues[field] = patch.values[field];
    });
    patchValues.updated_by = req.user?.id ?? null;

    await row.update(patchValues);

    const fresh = await CustomerPersonalInfo.findByPk(customerId, {
      attributes: PROFILE_ATTRIBUTES,
    });

    console.info(
      `📝 [portal:profile] پرونده ${customerId} توسط کاربر ${req.user?.id} ویرایش شد — فیلدها: ${changes.join(
        ",",
      )}`,
    );

    return successResponse(
      res,
      {
        changed: changes,
        profile: profileView(fresh || row, { userId: req.user?.id ?? null }),
        edited_by_customer: true,
        mobile_hint: patch.mobileAttempted
          ? "تغییر شمارهٔ موبایل فقط با کد پیامکی انجام می‌شود"
          : null,
        meta: { scope: "self", generated_at: new Date().toISOString() },
      },
      "پروفایل شما به‌روزرسانی شد",
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        code: "PORTAL_PROFILE_DUPLICATE",
        message: "مقداری از اطلاعات با پروندهٔ دیگری تکراری است",
        timestamp: new Date().toISOString(),
      });
    }
    if (error?.name === "SequelizeValidationError") {
      const errors = {};
      (error.errors || []).forEach((item) => {
        errors[item.path] = item.message;
      });
      return res.status(400).json({
        success: false,
        code: "PORTAL_PROFILE_INVALID",
        message: "اطلاعات ارسالی معتبر نیست",
        errors,
        timestamp: new Date().toISOString(),
      });
    }
    console.error("❌ خطا در به‌روزرسانی پروفایل پورتال:", error.message);
    return errorResponse(res, "خطا در ذخیرهٔ پروفایل", 500);
  }
};

module.exports = {
  getPortalSummary,
  getMyHalls,
  getMyFlocks,
  getMyWeeks,
  getMyVisits,
  getMyWeekDetail,
  getMyVisitDetail,
  downloadMyAttachment,
  getMyProfile,
  updateMyProfile,
};

