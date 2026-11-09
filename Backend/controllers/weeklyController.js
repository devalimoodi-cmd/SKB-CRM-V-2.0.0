const WeeklyManagement = require("../models/WeeklyManagement");
const WeeklyDisease = require("../models/WeeklyDisease");
const WeeklyVaccine = require("../models/WeeklyVaccine");
const WeeklyMedicine = require("../models/WeeklyMedicine");
const WeeklyFeed = require("../models/WeeklyFeed");
const WeeklySuggestion = require("../models/WeeklySuggestion");
const { parsePagination } = require("../utils/pagination");

const Disease = require("../models/Disease");
const Vaccine = require("../models/Vaccine");
const Medicine = require("../models/Medicine");
const FeedType = require("../models/FeedType");
const SuggestionType = require("../models/SuggestionType");
const User = require("../models/User"); // ← مهم!

const { successResponse, errorResponse } = require("../utils/response");
// ✅ موج ۱۳.۱۲: نوشتن اطلاعات هفتگی (اعتبارسنجی، ترتیب هفته‌ها، شش جدول
//    و تراکنش) به services/farm/weeklyWrite منتقل شد تا مسیر تأیید
//    درخواست مشتری همان قاعده را اجرا کند.
const weeklyWrite = require("../services/farm/weeklyWrite");
const { sendFarmError } = require("../services/farm/httpBridge");

// (توابع کمکی نوشتن هفتگی به services/farm/weeklyWrite منتقل شدند.)
// ============================================
// ایجاد اطلاعات هفتگی جدید - اصلاح شده
// ============================================
const createWeeklyRecord = async (req, res) => {
  try {
    const { record } = await weeklyWrite.createWeekly(req.body);

    return successResponse(
      res,
      record,
      "اطلاعات هفتگی با موفقیت ثبت شد",
      201,
    );
  } catch (error) {
    console.error("خطا در ثبت اطلاعات هفتگی:", error);
    return sendFarmError(res, error, "خطا در ثبت اطلاعات هفتگی");
  }
};

// ============================================
// دریافت لیست اطلاعات هفتگی (با فیلتر) - اصلاح کامل
// ============================================
const getWeeklyRecords = async (req, res) => {
  try {
    const {
      customer_id,
      hall_id,
      chick_placement_id,
      week_number,
    } = req.query;

    // ✅ صفحه‌بندی با سقف
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const where = {};

    if (customer_id) where.customer_id = parseInt(customer_id);
    if (hall_id) where.hall_id = parseInt(hall_id);
    if (chick_placement_id)
      where.chick_placement_id = parseInt(chick_placement_id);
    if (week_number) where.week_number = parseInt(week_number);

    console.log("📊 جستجوی هفته‌ها با شرط:", where);

    const { count, rows } = await WeeklyManagement.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["week_number", "ASC"]],
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
          attributes: ["id", "first_name", "last_name", "username"],
          required: false,
        },
      ],
    });

    console.log(`✅ ${rows.length} هفته یافت شد`);

    // فرمت کردن خروجی
    const formattedRows = rows.map((record) => {
      const recordJSON = record.toJSON();
      return {
        ...recordJSON,
        diseases:
          recordJSON.WeeklyDiseases?.map((d) => d.disease?.name).filter(
            Boolean,
          ) || [],
        vaccines:
          recordJSON.WeeklyVaccines?.map((v) => v.vaccine?.name).filter(
            Boolean,
          ) || [],
        medicines:
          recordJSON.WeeklyMedicines?.map((m) => m.medicine?.name).filter(
            Boolean,
          ) || [],
        feedTypes:
          recordJSON.WeeklyFeeds?.map((f) => f.feedType?.name).filter(
            Boolean,
          ) || [],
        suggestions:
          recordJSON.WeeklySuggestions?.map(
            (s) => s.suggestionType?.name,
          ).filter(Boolean) || [],
        disease_ids:
          recordJSON.WeeklyDiseases?.map((d) => d.disease_id).filter(Boolean) ||
          [],
        vaccine_ids:
          recordJSON.WeeklyVaccines?.map((v) => v.vaccine_id).filter(Boolean) ||
          [],
        medicine_ids:
          recordJSON.WeeklyMedicines?.map((m) => m.medicine_id).filter(
            Boolean,
          ) || [],
        feed_type_ids:
          recordJSON.WeeklyFeeds?.map((f) => f.feed_type_id).filter(Boolean) ||
          [],
        suggestion_ids:
          recordJSON.WeeklySuggestions?.map((s) => s.suggestion_id).filter(
            Boolean,
          ) || [],
        expertName: recordJSON.service_expert
          ? `${recordJSON.service_expert.first_name || ""} ${recordJSON.service_expert.last_name || ""}`.trim() ||
            "-"
          : "-",
        WeeklyDiseases: undefined,
        WeeklyVaccines: undefined,
        WeeklyMedicines: undefined,
        WeeklyFeeds: undefined,
        WeeklySuggestions: undefined,
        service_expert: undefined,
      };
    });

    successResponse(
      res,
      {
        records: formattedRows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
      "لیست اطلاعات هفتگی دریافت شد",
    );
  } catch (error) {
    console.error("❌ خطا در دریافت اطلاعات هفتگی:", error);
    errorResponse(res, error.message, 500);
  }
};
// ============================================
// دریافت یک رکورد هفتگی با ID
// ============================================
// ============================================
// دریافت یک رکورد هفتگی با ID - اصلاح شده
// ============================================
const getWeeklyRecordById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await WeeklyManagement.findByPk(id, {
      include: [
        {
          model: WeeklyDisease,
          as: "WeeklyDiseases",
          attributes: ["disease_id"],
        },
        {
          model: WeeklyVaccine,
          as: "WeeklyVaccines",
          attributes: ["vaccine_id"],
        },
        {
          model: WeeklyMedicine,
          as: "WeeklyMedicines",
          attributes: ["medicine_id"],
        },
        {
          model: WeeklyFeed,
          as: "WeeklyFeeds",
          attributes: ["feed_type_id"],
        },
        {
          model: WeeklySuggestion,
          as: "WeeklySuggestions",
          attributes: ["suggestion_id"],
        },
      ],
    });

    if (!record) {
      return errorResponse(res, "اطلاعات هفتگی یافت نشد", 404);
    }

    // فرمت کردن خروجی
    const recordJSON = record.toJSON();
    const formattedRecord = {
      ...recordJSON,
      disease_ids:
        recordJSON.WeeklyDiseases?.map((d) => d.disease_id).filter(Boolean) ||
        [],
      vaccine_ids:
        recordJSON.WeeklyVaccines?.map((v) => v.vaccine_id).filter(Boolean) ||
        [],
      medicine_ids:
        recordJSON.WeeklyMedicines?.map((m) => m.medicine_id).filter(Boolean) ||
        [],
      feed_type_ids:
        recordJSON.WeeklyFeeds?.map((f) => f.feed_type_id).filter(Boolean) ||
        [],
      suggestion_ids:
        recordJSON.WeeklySuggestions?.map((s) => s.suggestion_id).filter(
          Boolean,
        ) || [],
      WeeklyDiseases: undefined,
      WeeklyVaccines: undefined,
      WeeklyMedicines: undefined,
      WeeklyFeeds: undefined,
      WeeklySuggestions: undefined,
    };

    successResponse(res, formattedRecord, "اطلاعات هفتگی دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};
// ================================================================

// ================================================================
// controllers/weeklyController.js - اصلاح getWeeklyRecordsByFlock
// ================================================================

const getWeeklyRecordsByFlock = async (req, res) => {
  try {
    const { chick_placement_id } = req.params;

    if (!chick_placement_id) {
      return errorResponse(res, "شناسه گله الزامی است", 400);
    }

    const records = await WeeklyManagement.findAll({
      where: { chick_placement_id: parseInt(chick_placement_id) },
      order: [["week_number", "ASC"]],
      include: [
        {
          model: WeeklyDisease,
          as: "WeeklyDiseases", // ✅ alias درست
          include: [
            {
              model: Disease,
              as: "disease", // ✅ alias درست
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
          as: "service_expert", // ✅ alias درست
          attributes: ["id", "first_name", "last_name"],
          required: false,
        },
      ],
    });

    // فرمت کردن خروجی
    const formattedRecords = records.map((record) => {
      const recordJSON = record.toJSON();
      return {
        ...recordJSON,
        diseases:
          recordJSON.WeeklyDiseases?.map((d) => d.disease?.name).filter(
            Boolean,
          ) || [],
        vaccines:
          recordJSON.WeeklyVaccines?.map((v) => v.vaccine?.name).filter(
            Boolean,
          ) || [],
        medicines:
          recordJSON.WeeklyMedicines?.map((m) => m.medicine?.name).filter(
            Boolean,
          ) || [],
        feedTypes:
          recordJSON.WeeklyFeeds?.map((f) => f.feedType?.name).filter(
            Boolean,
          ) || [],
        suggestions:
          recordJSON.WeeklySuggestions?.map(
            (s) => s.suggestionType?.name,
          ).filter(Boolean) || [],
        disease_ids:
          recordJSON.WeeklyDiseases?.map((d) => d.disease_id).filter(Boolean) ||
          [],
        vaccine_ids:
          recordJSON.WeeklyVaccines?.map((v) => v.vaccine_id).filter(Boolean) ||
          [],
        medicine_ids:
          recordJSON.WeeklyMedicines?.map((m) => m.medicine_id).filter(
            Boolean,
          ) || [],
        feed_type_ids:
          recordJSON.WeeklyFeeds?.map((f) => f.feed_type_id).filter(Boolean) ||
          [],
        suggestion_ids:
          recordJSON.WeeklySuggestions?.map((s) => s.suggestion_id).filter(
            Boolean,
          ) || [],
        expertName: recordJSON.service_expert
          ? `${recordJSON.service_expert.first_name || ""} ${recordJSON.service_expert.last_name || ""}`.trim() ||
            "-"
          : "-",
        WeeklyDiseases: undefined,
        WeeklyVaccines: undefined,
        WeeklyMedicines: undefined,
        WeeklyFeeds: undefined,
        WeeklySuggestions: undefined,
        service_expert: undefined,
      };
    });

    successResponse(res, formattedRecords, "لیست هفته‌های گله دریافت شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};
// ============================================
// ============================================
// بروزرسانی اطلاعات هفتگی - اصلاح شده
// ============================================
const updateWeeklyRecord = async (req, res) => {
  try {
    const { record } = await weeklyWrite.updateWeekly(req.params.id, req.body);

    return successResponse(
      res,
      record,
      "اطلاعات هفتگی با موفقیت بروزرسانی شد",
    );
  } catch (error) {
    console.error("خطا در بروزرسانی اطلاعات هفتگی:", error);
    return sendFarmError(res, error, "خطا در بروزرسانی اطلاعات هفتگی");
  }
};
// ============================================
// حذف اطلاعات هفتگی
// ============================================
const deleteWeeklyRecord = async (req, res) => {
  try {
    await weeklyWrite.deleteWeekly(req.params.id);
    return successResponse(res, null, "اطلاعات هفتگی با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا در حذف اطلاعات هفتگی:", error);
    return sendFarmError(res, error, "خطا در حذف اطلاعات هفتگی");
  }
};

module.exports = {
  createWeeklyRecord,
  getWeeklyRecords,
  getWeeklyRecordById,
  getWeeklyRecordsByFlock,
  updateWeeklyRecord,
  deleteWeeklyRecord,
};
