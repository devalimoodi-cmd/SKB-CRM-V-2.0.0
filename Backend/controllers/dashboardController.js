// ================================================================
// controllers/dashboardController.js
// ================================================================

const { sequelize } = require("../config/database");
const { Op } = require("sequelize");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const ChickPlacement = require("../models/ChickPlacement");
const Flock = require("../models/Flock");
const WeeklyManagement = require("../models/WeeklyManagement");
const Hall = require("../models/Hall");
const Unit = require("../models/Unit");
const User = require("../models/User");
const ChickenBreed = require("../models/ChickenBreed");
const ChickSource = require("../models/ChickSource");

// ================================================================
// ✅ اضافه کردن مدل‌های مرتبط با مدیریت هفتگی
// ================================================================
const WeeklyDisease = require("../models/WeeklyDisease");
const WeeklyVaccine = require("../models/WeeklyVaccine");
const WeeklyMedicine = require("../models/WeeklyMedicine");
const WeeklyFeed = require("../models/WeeklyFeed");
const WeeklySuggestion = require("../models/WeeklySuggestion");
const Disease = require("../models/Disease");
const Vaccine = require("../models/Vaccine");
const Medicine = require("../models/Medicine");
const FeedType = require("../models/FeedType");
const SuggestionType = require("../models/SuggestionType");
const Bookmark = require("../models/Bookmark");
const SmsLog = require("../models/SmsLog");
const BreedWeightStandard = require("../models/BreedWeightStandard");

const { successResponse, errorResponse } = require("../utils/response");

// ================================================================
// توابع کمکی (Helpers)
// ================================================================

function calculateFlockAge(placementDate) {
  const today = new Date();
  const start = new Date(placementDate);
  if (start > today) return 0;
  const diffTime = today - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

function calculateCurrentWeek(placementDate) {
  const today = new Date();
  const start = new Date(placementDate);
  if (start > today) return 1;
  const diffTime = today - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

function calculateWeekRange(placementDate, weekNumber) {
  const start = new Date(placementDate);
  if (start > new Date()) {
    const today = new Date();
    return {
      weekStartDate: today.toISOString().split("T")[0],
      weekEndDate: today.toISOString().split("T")[0],
    };
  }
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + (weekNumber - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    weekStartDate: weekStart.toISOString().split("T")[0],
    weekEndDate: weekEnd.toISOString().split("T")[0],
  };
}

// ================================================================
// توابع کمکی (Helpers)
// ================================================================

// ================================================================
// توابع کمکی (Helpers)
// ================================================================

function calculateStatus(weekEndDate) {
  const today = new Date();
  const endDate = new Date(weekEndDate);
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  const diffTime = endDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // ❌ سررسید شده یا امروز سررسید می‌شود (قرمز)
  // شامل: روزهای منفی (گذشته) و 0 (امروز)
  if (diffDays <= 0) return "danger";

  // ✅ 1 تا 2 روز مانده (سبز - نزدیک به سررسید)
  if (diffDays <= 2) return "success";

  // 🟢 عادی (آبی) - بیشتر از 2 روز مانده
  return "normal";
}

// ================================================================
// ۱. دریافت لیست گله‌های فعال با وضعیت سررسید
// ================================================================
const getActiveFlocks = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const whereCondition = { is_active: true };

    const flocks = await ChickPlacement.findAll({
      where: whereCondition,
      include: [
        {
          model: CustomerPersonalInfo,
          attributes: [
            "id",
            "full_name",
            "farm_name",
            "mobile_number",
            "county",
            "province",
          ],
        },
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
        {
          model: Unit,
          as: "unit",
          attributes: ["id", "unit_name"],
        },
        {
          model: ChickenBreed, // ✅ اضافه کردن نژاد
          as: "breed",
          attributes: ["id", "name"],
        },
      ],
      order: [["placement_date", "DESC"]],
    });

    let result = [];
    let dangerCount = 0;
    let successCount = 0;
    let normalCount = 0;
    let totalActiveFlocks = flocks.length;

    for (const flock of flocks) {
      const flockData = flock.toJSON();
      const flockAge = calculateFlockAge(flockData.placement_date);
      const currentWeek = calculateCurrentWeek(flockData.placement_date);
      const weekRange = calculateWeekRange(
        flockData.placement_date,
        currentWeek,
      );
      const statusResult = calculateStatus(weekRange.weekEndDate);

      if (statusResult === "danger") dangerCount++;
      else if (statusResult === "success") successCount++;
      else normalCount++;

      if (status && status !== "all" && statusResult !== status) continue;

      if (search && search.trim() !== "") {
        const customerName = flockData.CustomerPersonalInfo?.full_name || "";
        const farmName = flockData.CustomerPersonalInfo?.farm_name || "";
        const searchLower = search.toLowerCase().trim();
        if (
          !customerName.toLowerCase().includes(searchLower) &&
          !farmName.toLowerCase().includes(searchLower)
        ) {
          continue;
        }
      }

      // ✅ دریافت هفته‌های ثبت‌شده گله (برای استپر هفتگی)
      let completedWeeks = [];
      try {
        const weekRecords = await WeeklyManagement.findAll({
          where: { chick_placement_id: flockData.id },
          attributes: ["week_number"],
        });
        completedWeeks = weekRecords.map((w) => w.week_number);
      } catch (weekError) {
        console.error("⚠️ خطا در دریافت هفته‌های گله:", weekError.message);
      }

      // ✅ دریافت تعداد بوکمارک‌های فعال این گله
      let bookmarkCount = 0;
      try {
        bookmarkCount = await Bookmark.count({
          where: {
            customer_id: flockData.CustomerPersonalInfo?.id || 0,
            flock_id: flockData.id,
            status: "active",
          },
        });
      } catch (bookmarkError) {
        console.error("⚠️ خطا در دریافت بوکمارک‌ها:", bookmarkError.message);
      }

      // ✅ دریافت آخرین پیامک ارسالی امروز برای این گله (نشانگر انجام تسک)
      let smsLog = null;
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const foundSms = await SmsLog.findOne({
          where: {
            flock_id: flockData.id,
            sent_at: { [Op.between]: [startOfDay, endOfDay] },
          },
          order: [["sent_at", "DESC"]],
          include: [
            {
              model: User,
              as: "sender",
              attributes: ["id", "first_name", "last_name", "username"],
            },
          ],
        });
        if (foundSms) {
          const smsData = foundSms.toJSON();
          smsLog = {
            status: smsData.status,
            message_id: smsData.message_id,
            sent_at: smsData.sent_at,
            delivered_at: smsData.delivered_at,
            sender: smsData.sender || null,
          };
        }
      } catch (smsError) {
        console.error("⚠️ خطا در دریافت لاگ پیامک گله:", smsError.message);
      }

      result.push({
        customer: {
          id: flockData.CustomerPersonalInfo?.id,
          name: flockData.CustomerPersonalInfo?.full_name || "نامشخص",
          farmName: flockData.CustomerPersonalInfo?.farm_name || "نامشخص",
          phone: flockData.CustomerPersonalInfo?.mobile_number || "-",
          city: flockData.CustomerPersonalInfo?.county || "-",
          province: flockData.CustomerPersonalInfo?.province || "-",
        },
        flock: {
          id: flockData.id,
          flockNumber: flockData.flock_number,
          hallName: flockData.Hall?.hall_name || "سالن نامشخص",
          unitName: flockData.unit?.unit_name || "-",
          breedName: flockData.breed?.name || "-",
          placementDate: flockData.placement_date,
          weekNumber: currentWeek,
          weekStartDate: weekRange.weekStartDate,
          weekEndDate: weekRange.weekEndDate,
          flockAge: flockAge,
          status: statusResult,
          daysRemaining:
            statusResult === "danger"
              ? 0
              : statusResult === "success"
                ? Math.ceil(
                    (new Date(weekRange.weekEndDate) - new Date()) /
                      (1000 * 60 * 60 * 24),
                  )
                : -1,
          // ✅ داده‌های جدید برای کارت TaskCard
          completedWeeks: completedWeeks,
          bookmarkCount: bookmarkCount,
        },
        smsLog,
      });
    }

    const total = result.length;
    const paginatedResult = result.slice(offset, offset + parseInt(limit));

    successResponse(
      res,
      {
        flocks: paginatedResult,
        pagination: {
          total: total,
          page: parseInt(page),
          totalPages: Math.ceil(total / limit),
          limit: parseInt(limit),
        },
        summary: {
          dangerCount,
          successCount,
          normalCount,
          totalActiveFlocks,
        },
      },
      "لیست گله‌های فعال دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت گله‌های فعال:", error);
    errorResponse(res, error.message, 500);
  }
};

// ================================================================
// ۱.۵. دریافت کارت‌های گله (دوره پرورش) — سطح گله با سالن‌های عضو
// ================================================================
const getActiveFlockCards = async (req, res) => {
  try {
    const { status } = req.query;

    const flocks = await Flock.findAll({
      where: { status: "active" },
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name", "mobile_number", "province", "county"],
        },
        {
          model: Unit,
          as: "unit",
          attributes: ["id", "unit_name"],
        },
        {
          model: ChickPlacement,
          as: "placements",
          include: [
            { model: Hall, attributes: ["id", "hall_name"] },
            { model: ChickenBreed, as: "breed", attributes: ["id", "name"] },
          ],
        },
      ],
      order: [["placement_date", "ASC"]],
    });

    let dangerCount = 0;
    let successCount = 0;
    let normalCount = 0;
    const result = [];

    for (const fl of flocks) {
      const fd = fl.toJSON();
      const placements = fd.placements || [];
      const activePlacements = placements.filter((p) => p.is_active);
      if (activePlacements.length === 0) continue; // گله‌های در آستانه بسته‌شدن خودکار

      const cust = fd.customer || {};

      // ── وضعیت هر سالن (بر اساس تاریخ جوجه‌ریزی همان سالن) ──
      const placementIds = placements.map((p) => p.id);
      const weekRows = placementIds.length
        ? await WeeklyManagement.findAll({
            where: { chick_placement_id: { [Op.in]: placementIds } },
            attributes: [
              "chick_placement_id",
              "week_number",
              "week_start_date",
              "week_end_date",
              "weekly_weight",
              "weekly_mortality",
              "weekly_feed_intake",
            ],
          })
        : [];
      const recordedWeeksByPlacement = {};
      const completeWeeksByPlacement = {};
      const rowsByPlacement = {};
      weekRows.forEach((w) => {
        if (!recordedWeeksByPlacement[w.chick_placement_id]) {
          recordedWeeksByPlacement[w.chick_placement_id] = [];
        }
        recordedWeeksByPlacement[w.chick_placement_id].push(w.week_number);

        if (!rowsByPlacement[w.chick_placement_id]) {
          rowsByPlacement[w.chick_placement_id] = [];
        }
        rowsByPlacement[w.chick_placement_id].push({
          week_number: w.week_number,
          week_start_date: w.week_start_date,
          week_end_date: w.week_end_date,
        });

        // هفته کامل: وزن، تلفات و خوراک — هر سه مقدار دارند (تلفات صفر مجاز است)
        const hasWeight =
          w.weekly_weight !== null &&
          w.weekly_weight !== undefined &&
          String(w.weekly_weight).trim() !== "";
        const hasLoss =
          w.weekly_mortality !== null &&
          w.weekly_mortality !== undefined &&
          String(w.weekly_mortality).trim() !== "";
        const hasFeed =
          w.weekly_feed_intake !== null &&
          w.weekly_feed_intake !== undefined &&
          String(w.weekly_feed_intake).trim() !== "";
        if (hasWeight && hasLoss && hasFeed) {
          if (!completeWeeksByPlacement[w.chick_placement_id]) {
            completeWeeksByPlacement[w.chick_placement_id] = [];
          }
          completeWeeksByPlacement[w.chick_placement_id].push(w.week_number);
        }
      });

      // ── آخرین پیامک امروز برای هر سالن (نشانگر وضعیت تسک روی کارت) ──
      const todaySmsByPlacement = {};
      if (placementIds.length) {
        try {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date();
          endOfDay.setHours(23, 59, 59, 999);
          const smsRows = await SmsLog.findAll({
            where: {
              flock_id: { [Op.in]: placementIds },
              sent_at: { [Op.between]: [startOfDay, endOfDay] },
            },
            order: [["sent_at", "DESC"]],
            include: [
              {
                model: User,
                as: "sender",
                attributes: ["id", "first_name", "last_name", "username"],
              },
            ],
          });
          smsRows.forEach((r) => {
            if (todaySmsByPlacement[r.flock_id]) return;
            const d = r.toJSON();
            todaySmsByPlacement[r.flock_id] = {
              status: d.status,
              message_id: d.message_id,
              sent_at: d.sent_at,
              delivered_at: d.delivered_at,
              sender: d.sender || null,
            };
          });
        } catch (smsError) {
          console.error("⚠️ خطا در دریافت لاگ پیامک سالن‌های گله:", smsError.message);
        }
      }

      const halls = placements.map((p) => {
        const age = calculateFlockAge(p.placement_date);
        const week = calculateCurrentWeek(p.placement_date);
        const range = calculateWeekRange(p.placement_date, week);
        const recorded = recordedWeeksByPlacement[p.id] || [];
        const complete = completeWeeksByPlacement[p.id] || [];
        const rows = rowsByPlacement[p.id] || [];

        // هفته‌های معوق: بر اساس تقویم/تاریخ‌های ذخیره‌شده خودِ رکورد هفتگی
        const overdueWeeks = [];
        if (p.is_active) {
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);

          // دوشنبه‌ی هفته‌ی جوجه‌ریزی = آغاز هفته ۱ در تقویم ثبت هفتگی
          const placementStart = new Date(p.placement_date);
          placementStart.setHours(0, 0, 0, 0);
          const mondayAnchor = new Date(placementStart);
          mondayAnchor.setDate(
            placementStart.getDate() - ((placementStart.getDay() + 6) % 7),
          );
          const week1Row = rows.find((r) => Number(r.week_number) === 1);
          const week1Start = week1Row?.week_start_date
            ? new Date(week1Row.week_start_date)
            : mondayAnchor;
          week1Start.setHours(0, 0, 0, 0);

          const rowByWeek = {};
          rows.forEach((r) => {
            rowByWeek[Number(r.week_number)] = r;
          });
          const lastRowWeek = rows.length
            ? Math.max(...rows.map((r) => Number(r.week_number)))
            : 0;
          const ceiling = Math.max(week, lastRowWeek);

          for (let w = 1; w <= ceiling; w++) {
            const r = rowByWeek[w];
            if (r) {
              // هفته رکورد دارد: اگر نامکمل باشد و پایانش گذشته/امروز = معوق
              if (complete.includes(w)) continue;
              const end = new Date(r.week_end_date);
              end.setHours(0, 0, 0, 0);
              if (end <= todayStart) overdueWeeks.push(w);
            } else {
              // هفته رکورد ندارد: پایان موردانتظار طبق تقویم هفتگی
              const expEnd = new Date(week1Start);
              expEnd.setDate(week1Start.getDate() + (w - 1) * 7 + 6);
              if (expEnd <= todayStart) overdueWeeks.push(w);
            }
          }
        }

        const fallbackStatus = calculateStatus(range.weekEndDate);
        const hallStatus = p.is_active
          ? overdueWeeks.length > 0
            ? "danger"
            : fallbackStatus === "danger"
              ? "success" // هفته جاری تمام شده ولی کامل است → دیگر قرمز نیست
              : fallbackStatus
          : null;

        return {
          id: p.id,
          hallId: p.hall_id,
          hallName: p.Hall?.hall_name || `سالن ${p.hall_id}`,
          breedName: p.breed?.name || "-",
          isActive: p.is_active,
          placementDate: p.placement_date,
          ageDays: age,
          weekNumber: week,
          weekStartDate: range.weekStartDate,
          weekEndDate: range.weekEndDate,
          status: hallStatus,
          completedWeeks: recorded,
          completeWeeks: complete,
          overdueWeeks: overdueWeeks,
          smsLog: todaySmsByPlacement[p.id] || null,
        };
      });

      // ── وضعیت گله: بدترین/نزدیک‌ترین سالن فعال ──
      const activeHalls = halls.filter((h) => h.isActive);
      const worstStatus = activeHalls.some((h) => h.status === "danger")
        ? "danger"
        : activeHalls.some((h) => h.status === "success")
          ? "success"
          : "normal";

      if (status && status !== "all" && status !== worstStatus) continue;
      if (worstStatus === "danger") dangerCount++;
      else if (worstStatus === "success") successCount++;
      else normalCount++;

      // سن گله از تاریخ تعریف گله
      const flockAge = calculateFlockAge(fd.placement_date);
      const flockWeek = calculateCurrentWeek(fd.placement_date);
      const flockRange = calculateWeekRange(fd.placement_date, flockWeek);

      result.push({
        customer: {
          id: cust.id,
          name: cust.full_name || "نامشخص",
          farmName: cust.farm_name || "نامشخص",
          city: cust.county || cust.province || "-",
          phone: cust.mobile_number || "-",
        },
        flock: {
          id: fd.id,
          flockNumber: fd.flock_number,
          unitId: fd.unit_id,
          unitName: fd.unit?.unit_name || "-",
          placementDate: fd.placement_date,
          flockAge: flockAge,
          weekNumber: flockWeek,
          weekStartDate: flockRange.weekStartDate,
          weekEndDate: flockRange.weekEndDate,
          status: worstStatus,
          halls: halls,
        },
      });
    }

    successResponse(
      res,
      {
        flocks: result,
        summary: {
          dangerCount,
          successCount,
          normalCount,
          total: result.length,
        },
      },
      "کارت‌های گله دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت کارت‌های گله:", error);
    errorResponse(res, error.message, 500);
  }
};

// ================================================================
// ۲. دریافت اطلاعات کامل مشتری برای مودال
// ================================================================
// ================================================================
// controllers/dashboardController.js - اصلاح تابع getCustomerDetails
// ================================================================

const getCustomerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { flockId } = req.query; // ✅ دریافت flockId از query string

    console.log(
      `📥 دریافت جزئیات مشتری ${id}${flockId ? ` با گله ${flockId}` : ""}`,
    );

    // ۱. دریافت اطلاعات مشتری
    const customer = await CustomerPersonalInfo.findByPk(id);
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    // ۲. دریافت گله‌های مشتری
    const flocks = await ChickPlacement.findAll({
      where: { customer_id: id },
      include: [
        {
          model: Hall,
          attributes: ["id", "hall_name", "nominal_capacity"],
        },
        {
          model: ChickenBreed, // ✅ اضافه کردن نژاد
          as: "breed",
          attributes: ["id", "name"],
        },
      ],
      order: [["placement_date", "DESC"]],
    });
    // ۳. دریافت واحدهای مشتری
    const units = await Unit.findAll({
      where: { customer_personal_information_id: id },
      order: [["created_at", "DESC"]],
    });

    // ۴. دریافت سالن‌های مشتری
    const halls = await Hall.findAll({
      where: { customer_id: id },
      attributes: ["id", "hall_name", "nominal_capacity"],
    });

    // ۵. دریافت تاریخچه هفتگی برای گله خاص
    let weeklyHistory = [];

    // ✅ اگر flockId مشخص شده، از همان گله استفاده کن
    let targetFlockId = flockId;

    // اگر flockId مشخص نشده، گله فعال را پیدا کن
    if (!targetFlockId) {
      const activeFlock = flocks.find((f) => f.is_active === true);
      targetFlockId = activeFlock?.id;
    }

    if (targetFlockId) {
      console.log(`📊 دریافت تاریخچه هفتگی برای گله ${targetFlockId}`);

      weeklyHistory = await WeeklyManagement.findAll({
        where: { chick_placement_id: parseInt(targetFlockId) },
        include: [
          {
            model: WeeklyDisease,
            as: "WeeklyDiseases",
            include: [
              {
                model: Disease,
                as: "disease",
                attributes: ["id", "name"],
              },
            ],
            attributes: ["disease_id"],
            required: false,
          },
          {
            model: WeeklyVaccine,
            as: "WeeklyVaccines",
            include: [
              {
                model: Vaccine,
                as: "vaccine",
                attributes: ["id", "name"],
              },
            ],
            attributes: ["vaccine_id"],
            required: false,
          },
          {
            model: WeeklyMedicine,
            as: "WeeklyMedicines",
            include: [
              {
                model: Medicine,
                as: "medicine",
                attributes: ["id", "name"],
              },
            ],
            attributes: ["medicine_id"],
            required: false,
          },
          {
            model: WeeklyFeed,
            as: "WeeklyFeeds",
            include: [
              {
                model: FeedType,
                as: "feedType",
                attributes: ["id", "name"],
              },
            ],
            attributes: ["feed_type_id"],
            required: false,
          },
          {
            model: WeeklySuggestion,
            as: "WeeklySuggestions",
            include: [
              {
                model: SuggestionType,
                as: "suggestionType",
                attributes: ["id", "name"],
              },
            ],
            attributes: ["suggestion_id"],
            required: false,
          },
          {
            model: User,
            as: "service_expert",
            attributes: ["id", "first_name", "last_name"],
            required: false,
          },
        ],
        order: [["week_number", "ASC"]],
      });
    }

    // ============================================
    // ✅ فرمت کردن گله‌ها
    // ============================================
    const formattedFlocks = flocks.map((f) => {
      const flock = f.toJSON();
      const flockAge = calculateFlockAge(flock.placement_date);
      const currentWeek = calculateCurrentWeek(flock.placement_date);
      const weekRange = calculateWeekRange(flock.placement_date, currentWeek);
      const status = calculateStatus(weekRange.weekEndDate);

      return {
        id: flock.id,
        flockNumber: flock.flock_number,
        hallName: flock.Hall?.hall_name || "سالن نامشخص",
        placementDate: flock.placement_date,
        weekNumber: currentWeek,
        weekStartDate: weekRange.weekStartDate,
        weekEndDate: weekRange.weekEndDate,
        flockAge: flockAge,
        isActive: flock.is_active,
        totalChicks: flock.total_chicks_count || 0,
        breed: flock.breed?.name || "-", // ✅ دریافت نام نژاد
        breedId: flock.breed_id,
      };
    });

    // ============================================
    // ✅ فرمت کردن واحدها
    // ============================================
    const formattedUnits = units.map((u) => ({
      id: u.id,
      name: u.unit_name,
      address: u.address || "-",
      is_active: u.is_active,
      statusText: u.is_active ? "✅ فعال" : "❌ غیرفعال",
      statusColor: u.is_active ? "#16a34a" : "#dc2626",
      statusBg: u.is_active ? "#dcfce7" : "#fee2e2",
    }));
    // ============================================
    // ✅ فرمت کردن سالن‌ها
    // ============================================
    const formattedHalls = halls.map((h) => ({
      id: h.id,
      name: h.hall_name,
      capacity: h.nominal_capacity || 0,
    }));

    // ============================================
    // ✅ فرمت کردن تاریخچه هفتگی با تمام فیلدها
    // ============================================
    // ============================================
    // ✅ فرمت کردن تاریخچه هفتگی (بدون تبدیل تاریخ در بک‌اند)
    // ============================================
    const formattedWeekly = weeklyHistory.map((w) => {
      const weekData = w.toJSON();

      const diseases =
        weekData.WeeklyDiseases?.map((wd) => wd.disease?.name).filter(
          Boolean,
        ) || [];
      const vaccines =
        weekData.WeeklyVaccines?.map((wv) => wv.vaccine?.name).filter(
          Boolean,
        ) || [];
      const medicines =
        weekData.WeeklyMedicines?.map((wm) => wm.medicine?.name).filter(
          Boolean,
        ) || [];
      const feedTypes =
        weekData.WeeklyFeeds?.map((wf) => wf.feedType?.name).filter(Boolean) ||
        [];
      const suggestions =
        weekData.WeeklySuggestions?.map((ws) => ws.suggestionType?.name).filter(
          Boolean,
        ) || [];

      const expertName = weekData.service_expert
        ? `${weekData.service_expert.first_name || ""} ${weekData.service_expert.last_name || ""}`.trim() ||
          "-"
        : "-";

      return {
        weekNumber: w.week_number,
        startDate: w.week_start_date, // ✅ تاریخ میلادی اصلی
        endDate: w.week_end_date, // ✅ تاریخ میلادی اصلی
        flockAgeDays: w.flock_age_days,
        expertName: expertName,
        dailyFeedIntake: w.daily_feed_intake || 0,
        feedIntake: w.weekly_feed_intake || 0,
        weight: w.weekly_weight || 0,
        mortality: w.weekly_mortality || 0,
        blackoutHours: w.blackout_hours || 0,
        diseases: diseases.join("، ") || "-",
        vaccines: vaccines.join("، ") || "-",
        medicines: medicines.join("، ") || "-",
        feedTypes: feedTypes.join("، ") || "-",
        suggestions: suggestions.join("، ") || "-",
        additionalNotes: w.additional_notes || "-",
      };
    });

    successResponse(
      res,
      {
        customer: {
          id: customer.id,
          name: customer.full_name,
          full_name: customer.full_name,
          farmName: customer.farm_name,
          phone: customer.mobile_number,
          city: customer.county || "-",
          province: customer.province || "-",
          address: customer.farm_address || "-",
        },
        flocks: formattedFlocks,
        units: formattedUnits,
        halls: formattedHalls,
        weeklyHistory: formattedWeekly,
      },
      "اطلاعات کامل مشتری دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت اطلاعات مشتری:", error);
    errorResponse(res, error.message, 500);
  }
};

// ================================================================
// ۳. دریافت خلاصه آماری
// ================================================================
const getSummary = async (req, res) => {
  try {
    const totalCustomers = await CustomerPersonalInfo.count({
      where: { active: true },
    });

    const activeFlocks = await ChickPlacement.count({
      where: { is_active: true },
    });

    const flocks = await ChickPlacement.findAll({
      where: { is_active: true },
      attributes: ["id", "placement_date"],
    });

    let dangerCount = 0;
    let successCount = 0;
    let normalCount = 0;

    for (const flock of flocks) {
      const currentWeek = calculateCurrentWeek(flock.placement_date);
      const weekRange = calculateWeekRange(flock.placement_date, currentWeek);
      const status = calculateStatus(weekRange.weekEndDate);

      if (status === "danger") dangerCount++;
      else if (status === "success") successCount++;
      else normalCount++;
    }

    successResponse(
      res,
      {
        totalCustomers,
        activeFlocks,
        dangerCount,
        successCount,
        normalCount,
        todayTasks: dangerCount,
      },
      "خلاصه آماری دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت خلاصه آماری:", error);
    errorResponse(res, error.message, 500);
  }
};

// ================================================================
// ۴. دریافت داده‌های نمودارها (اصلاح شده با پشتیبانی از flockId)
// ================================================================
const getChartsData = async (req, res) => {
  try {
    const { customerId, flockId, flockGroupId } = req.query;

    // ================================================================
    // حالت «کل گله» (چند سالن): تجمیع داده‌های هفتگی سالن‌های فعال گله
    // ================================================================
    if (flockGroupId) {
      const groupId = parseInt(flockGroupId);
      const flockRow = await Flock.findByPk(groupId, {
        include: [
          {
            model: CustomerPersonalInfo,
            as: "customer",
            attributes: ["id", "full_name", "farm_name"],
          },
        ],
      });

      if (!flockRow) {
        return successResponse(
          res,
          { flocks: [], flockGroupId: groupId },
          "گله مورد نظر یافت نشد",
        );
      }

      const placements = await ChickPlacement.findAll({
        where: { flock_id: groupId, is_active: true },
        include: [
          {
            model: WeeklyManagement,
            as: "weeklyManagements",
            order: [["week_number", "ASC"]],
          },
          { model: Hall, attributes: ["id", "hall_name"] },
        ],
        order: [["placement_date", "ASC"]],
      });

      if (placements.length === 0) {
        return successResponse(
          res,
          { flocks: [], flockGroupId: groupId },
          "سالن فعالی برای این گله وجود ندارد",
        );
      }

      // ── تجمیع به ازای شماره هفته ──
      const byWeek = {};
      placements.forEach((p) => {
        (p.weeklyManagements || []).forEach((w) => {
          const wk = parseInt(w.week_number) || 0;
          if (!wk) return;
          if (!byWeek[wk]) {
            byWeek[wk] = { weights: [], loss: 0, feed: 0 };
          }
          const weight = w.weekly_weight;
          if (
            weight !== null &&
            weight !== undefined &&
            weight !== "" &&
            !isNaN(parseFloat(weight))
          ) {
            byWeek[wk].weights.push(parseFloat(weight));
          }
          byWeek[wk].loss += parseInt(w.weekly_mortality) || 0;
          byWeek[wk].feed += parseFloat(w.weekly_feed_intake) || 0;
        });
      });

      const weekNums = Object.keys(byWeek)
        .map(Number)
        .sort((a, b) => a - b);
      const weighting = weekNums.map((wk) => {
        const ws = byWeek[wk].weights;
        return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 0;
      });
      const loss = weekNums.map((wk) => byWeek[wk].loss);
      const feed = weekNums.map((wk) => parseFloat(byWeek[wk].feed.toFixed(1)));
      const weekLabels = weekNums.map((wk) => `هفته ${wk}`);
      const activeHalls = placements.length;

      const totalLoss = loss.reduce((a, b) => a + b, 0);
      const totalFeed = feed.reduce((a, b) => a + b, 0);
      const totalWeeks = weekNums.length;
      const avgWeight =
        totalWeeks > 0
          ? weighting.reduce((a, b) => a + b, 0) / totalWeeks
          : 0;
      const maxWeight = totalWeeks > 0 ? Math.max(...weighting) : 0;
      const avgLoss = totalWeeks > 0 ? totalLoss / totalWeeks : 0;

      return successResponse(
        res,
        {
          customerId: flockRow.customer_id || null,
          flockGroupId: groupId,
          totalFlocks: activeHalls,
          scope: "flock",
          flocks: [
            {
              flockInfo: {
                id: groupId,
                flockNumber: flockRow.flock_number,
                hallName: `کل گله (${activeHalls} سالن فعال)`,
                customerName: flockRow.customer?.full_name || "نامشخص",
                farmName: flockRow.customer?.farm_name || "نامشخص",
                placementDate: flockRow.placement_date,
                isActive: flockRow.status === "active",
              },
              data: {
                weighting,
                loss,
                feed,
                weekLabels,
                weekNumbers: weekNums,
              },
              summary: {
                totalWeeks,
                avgWeight: avgWeight.toFixed(2),
                maxWeight: maxWeight.toFixed(2),
                totalLoss,
                avgLoss: avgLoss.toFixed(1),
                totalFeed: parseFloat(totalFeed.toFixed(1)),
              },
            },
          ],
        },
        "داده‌های تجمیعی گله دریافت شد",
      );
    }

    let whereCondition = { is_active: true };

    // ✅ اگر flockId ارسال شده، فقط آن گله را بگیر
    if (flockId) {
      whereCondition.id = parseInt(flockId);
    }
    // ✅ اگر customerId ارسال شده، گله‌های آن مشتری را بگیر
    else if (customerId) {
      whereCondition.customer_id = parseInt(customerId);
    }

    console.log(`📊 دریافت داده‌های نمودار با فیلتر:`, {
      customerId,
      flockId,
      whereCondition,
    });

    const flocks = await ChickPlacement.findAll({
      where: whereCondition,
      include: [
        {
          model: WeeklyManagement,
          as: "weeklyManagements",
          order: [["week_number", "ASC"]],
        },
        {
          model: CustomerPersonalInfo,
          attributes: ["id", "full_name", "farm_name"],
        },
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
      ],
      order: [["placement_date", "DESC"]],
    });

    if (flocks.length === 0) {
      return successResponse(
        res,
        {
          message: "هیچ گله فعالی با اطلاعات هفتگی وجود ندارد",
          flocks: [],
        },
        "داده‌ای برای نمایش وجود ندارد",
      );
    }

    const flocksData = flocks.map((flock) => {
      // ✅ مرتب‌سازی هفته‌ها بر اساس شماره هفته (اطمینان از ترتیب درست)
      const weeks = (flock.weeklyManagements || []).sort(
        (a, b) => (a.week_number || 0) - (b.week_number || 0),
      );

      // ✅ استخراج داده‌های هفتگی (بعد از مرتب‌سازی)
      const weightingData = weeks.map((w) => parseFloat(w.weekly_weight) || 0);
      const lossData = weeks.map((w) => parseInt(w.weekly_mortality) || 0);
      const feedData = weeks.map((w) => parseFloat(w.weekly_feed_intake) || 0);
      const weekLabels = weeks.map((w) => `هفته ${w.week_number}`);
      const weekNumbers = weeks.map((w) => w.week_number);

      // ✅ محاسبات آماری
      const totalWeeks = weeks.length;
      const avgWeight =
        totalWeeks > 0
          ? (weightingData.reduce((a, b) => a + b, 0) / totalWeeks).toFixed(2)
          : 0;
      const maxWeight =
        totalWeeks > 0 ? Math.max(...weightingData).toFixed(2) : 0;
      const totalLoss = lossData.reduce((a, b) => a + b, 0);
      const avgLoss = totalWeeks > 0 ? (totalLoss / totalWeeks).toFixed(1) : 0;
      const totalFeed = feedData.reduce((a, b) => a + b, 0);
      const avgFeed = totalWeeks > 0 ? (totalFeed / totalWeeks).toFixed(1) : 0;

      return {
        flockInfo: {
          id: flock.id,
          flockNumber: flock.flock_number,
          hallName: flock.Hall?.hall_name || "نامشخص",
          customerName: flock.CustomerPersonalInfo?.full_name || "نامشخص",
          farmName: flock.CustomerPersonalInfo?.farm_name || "نامشخص",
          placementDate: flock.placement_date,
          isActive: flock.is_active,
        },
        data: {
          weighting: weightingData,
          loss: lossData,
          feed: feedData,
          weekLabels: weekLabels,
          weekNumbers: weekNumbers,
        },
        summary: {
          totalWeeks: totalWeeks,
          avgWeight: avgWeight,
          maxWeight: maxWeight,
          totalLoss: totalLoss,
          avgLoss: avgLoss,
          totalFeed: totalFeed,
          avgFeed: avgFeed,
        },
      };
    });

    successResponse(
      res,
      {
        customerId: customerId || "all",
        flockId: flockId || null,
        totalFlocks: flocks.length,
        flocks: flocksData,
      },
      "داده‌های نمودارها دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت داده‌های نمودار:", error);
    errorResponse(res, error.message, 500);
  }
};
// ================================================================
// ۵. دریافت داده‌های تحلیلی نمودارهای داشبورد مشتری (نمودارهای داینامیک)
// ================================================================
const getAnalysisData = async (req, res) => {
  try {
    const { customerId } = req.query;

    const whereCondition = { is_active: true };
    if (customerId) whereCondition.customer_id = parseInt(customerId);

    const flocks = await ChickPlacement.findAll({
      where: whereCondition,
      include: [
        {
          model: WeeklyManagement,
          as: "weeklyManagements",
        },
        {
          model: CustomerPersonalInfo,
          attributes: ["id", "full_name", "farm_name"],
        },
        {
          model: Hall,
          attributes: ["id", "hall_name"],
        },
        {
          model: ChickenBreed,
          as: "breed",
          attributes: ["id", "name"],
        },
      ],
      order: [["placement_date", "DESC"]],
    });

    if (flocks.length === 0) {
      return successResponse(
        res,
        { flocks: [] },
        "داده‌ای برای نمایش وجود ندارد",
      );
    }

    // دریافت استانداردهای نژادها
    const breedIds = [...new Set(flocks.map((f) => f.breed_id))];
    const standards = await BreedWeightStandard.findAll({
      where: { breed_id: { [Op.in]: breedIds }, is_active: true },
      attributes: [
        "breed_id",
        "week_number",
        "age_days",
        "target_weight",
        "min_weight",
        "max_weight",
        "standard_fcr",
      ],
      order: [
        ["breed_id", "ASC"],
        ["week_number", "ASC"],
      ],
    });

    const flocksData = flocks.map((flock) => {
      const weeks = (flock.weeklyManagements || [])
        .sort((a, b) => (a.week_number || 0) - (b.week_number || 0))
        .map((w) => ({
          week_number: w.week_number,
          week_start_date: w.week_start_date,
          week_end_date: w.week_end_date,
          flock_age_days: w.flock_age_days,
          weekly_weight: parseFloat(w.weekly_weight) || null,
          weekly_mortality: parseInt(w.weekly_mortality) || 0,
          weekly_feed_intake: parseFloat(w.weekly_feed_intake) || null,
          daily_feed_intake: parseFloat(w.daily_feed_intake) || null,
          blackout_hours: parseFloat(w.blackout_hours) || 0,
        }));

      const flockStandards = standards
        .filter((s) => s.breed_id === flock.breed_id)
        .map((s) => ({
          week_number: s.week_number,
          age_days: s.age_days,
          target_weight: parseFloat(s.target_weight),
          min_weight: parseFloat(s.min_weight),
          max_weight: parseFloat(s.max_weight),
          standard_fcr: parseFloat(s.standard_fcr),
        }));

      return {
        flock: {
          id: flock.id,
          flockNumber: flock.flock_number,
          customerName: flock.CustomerPersonalInfo?.full_name || "نامشخص",
          farmName: flock.CustomerPersonalInfo?.farm_name || "نامشخص",
          hallName: flock.Hall?.hall_name || "نامشخص",
          breedId: flock.breed_id,
          breedName: flock.breed?.name || "نامشخص",
          placementDate: flock.placement_date,
          totalChicks: flock.total_chicks_count,
          avgInitialWeightGrams: flock.avg_initial_weight,
        },
        weeks: weeks,
        standards: flockStandards,
      };
    });

    successResponse(
      res,
      { flocks: flocksData },
      "داده‌های تحلیلی گله‌ها دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت داده‌های تحلیلی:", error);
    errorResponse(res, error.message, 500);
  }
};

// ================================================================
// صادر کردن توابع
// ================================================================
module.exports = {
  getActiveFlocks,
  getActiveFlockCards,
  getCustomerDetails,
  getSummary,
  getChartsData,
  getAnalysisData,
};
