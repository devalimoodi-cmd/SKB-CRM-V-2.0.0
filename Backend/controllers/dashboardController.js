// ================================================================
// controllers/dashboardController.js
// ================================================================

const { sequelize } = require("../config/database");
const { Op } = require("sequelize");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const ChickPlacement = require("../models/ChickPlacement");
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
    const { customerId, flockId } = req.query;

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
// صادر کردن توابع
// ================================================================
module.exports = {
  getActiveFlocks,
  getCustomerDetails,
  getSummary,
  getChartsData,
};
