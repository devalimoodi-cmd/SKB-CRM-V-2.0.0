const WeeklyManagement = require("../models/WeeklyManagement");
const WeeklyDisease = require("../models/WeeklyDisease");
const WeeklyVaccine = require("../models/WeeklyVaccine");
const WeeklyMedicine = require("../models/WeeklyMedicine");
const WeeklyFeed = require("../models/WeeklyFeed");
const WeeklySuggestion = require("../models/WeeklySuggestion");
const ChickPlacement = require("../models/ChickPlacement");
const Hall = require("../models/Hall");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Unit = require("../models/Unit");
const {
  validateWeeklyData,
  validateMultipleItems,
} = require("../validations/weeklyValidation");

const Disease = require("../models/Disease");
const Vaccine = require("../models/Vaccine");
const Medicine = require("../models/Medicine");
const FeedType = require("../models/FeedType");
const SuggestionType = require("../models/SuggestionType");
const User = require("../models/User"); // ← مهم!

const { successResponse, errorResponse } = require("../utils/response");
const { Op } = require("sequelize");

// ============================================
// تابع کمکی: بررسی وجود و فعال بودن گله
// ============================================
const checkFlockIsActive = async (chick_placement_id) => {
  const flock = await ChickPlacement.findByPk(chick_placement_id);
  if (!flock) return { error: "گله یافت نشد" };
  // استفاده از is_active به جای is_flock_active
  if (!flock.is_active)
    return {
      error: "این گله غیرفعال شده است و نمی‌توان اطلاعات هفتگی ثبت کرد",
    };
  return { flock };
};
// ============================================
// تابع کمکی: بررسی وجود هفته تکراری
// ============================================
const checkDuplicateWeek = async (
  chick_placement_id,
  week_number,
  excludeId = null,
) => {
  const where = { chick_placement_id, week_number };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await WeeklyManagement.findOne({ where });
  return existing;
};

// ============================================
// تابع کمکی: بررسی ترتیب هفته‌ها
// ============================================
const checkWeekOrder = async (chick_placement_id, week_number) => {
  if (week_number === 1) return { isValid: true };

  const previousWeek = await WeeklyManagement.findOne({
    where: { chick_placement_id, week_number: week_number - 1 },
  });

  if (!previousWeek) {
    return {
      isValid: false,
      error: `قبل از ثبت هفته ${week_number}، باید هفته ${week_number - 1} ثبت شود`,
    };
  }
  return { isValid: true };
};

// ============================================
// تابع کمکی: ذخیره آیتم‌های چندگانه (بیماری، واکسن و ...) - اصلاح شده
// ============================================
const saveMultipleItems = async (Model, foreignKey, items, baseData) => {
  if (!items || !Array.isArray(items) || items.length === 0) return [];

  const records = [];
  for (const itemId of items) {
    if (itemId && !isNaN(parseInt(itemId))) {
      const record = {
        weekly_management_id: baseData.weekly_management_id,
        [foreignKey]: parseInt(itemId),
        customer_id: baseData.customer_id || null,
        unit_id: baseData.unit_id || null,
        hall_id: baseData.hall_id || null,
        chick_placement_id: baseData.chick_placement_id || null,
      };
      records.push(record);
    }
  }

  if (records.length === 0) return [];
  return await Model.bulkCreate(records);
};

// ============================================
// ایجاد اطلاعات هفتگی جدید - اصلاح شده
// ============================================
const createWeeklyRecord = async (req, res) => {
  try {
    // 1. اعتبارسنجی داده‌های اصلی
    const validation = validateWeeklyData(req.body);
    if (!validation.isValid) {
      return errorResponse(res, validation.errors[0], 400, validation.errors);
    }

    const {
      customer_id,
      unit_id,
      hall_id,
      chick_placement_id,
      week_start_date,
      week_end_date,
      week_number,
      flock_age_days,
      service_expert_id,
      daily_feed_intake,
      weekly_feed_intake,
      weekly_weight,
      weekly_mortality,
      blackout_hours,
      additional_notes,
      disease_ids,
      vaccine_ids,
      medicine_ids,
      feed_type_ids,
      suggestion_ids,
    } = req.body;

    // 2. بررسی وجود و فعال بودن گله
    const flockCheck = await checkFlockIsActive(chick_placement_id);
    if (flockCheck.error) {
      return errorResponse(res, flockCheck.error, 400);
    }

    // 3. بررسی وجود مشتری فعال
    const customer = await CustomerPersonalInfo.findOne({
      where: { id: customer_id, active: true },
    });
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد یا غیرفعال است", 404);
    }

    // 4. بررسی وجود سالن
    const hall = await Hall.findByPk(hall_id);
    if (!hall) {
      return errorResponse(res, "سالن یافت نشد", 404);
    }

    // 5. بررسی وجود واحد (اگر ارسال شده باشد)
    if (unit_id) {
      const unit = await Unit.findByPk(unit_id);
      if (!unit) {
        return errorResponse(res, "واحد یافت نشد", 404);
      }
    }

    // 6. بررسی هفته تکراری
    const duplicate = await checkDuplicateWeek(chick_placement_id, week_number);
    if (duplicate) {
      return errorResponse(
        res,
        `هفته ${week_number} برای این گله قبلاً ثبت شده است`,
        400,
      );
    }

    // 7. بررسی ترتیب هفته‌ها
    const orderCheck = await checkWeekOrder(chick_placement_id, week_number);
    if (!orderCheck.isValid) {
      return errorResponse(res, orderCheck.error, 400);
    }

    // 8. ایجاد رکورد اصلی
    const weeklyRecord = await WeeklyManagement.create({
      customer_id,
      unit_id: unit_id || null,
      hall_id,
      chick_placement_id,
      week_start_date,
      week_end_date,
      week_number,
      flock_age_days,
      service_expert_id: service_expert_id || null,
      daily_feed_intake: daily_feed_intake || null,
      weekly_feed_intake: weekly_feed_intake || null,
      weekly_weight: weekly_weight || null,
      weekly_mortality: weekly_mortality || 0,
      blackout_hours: blackout_hours || 0,
      additional_notes: additional_notes || null,
    });

    // ذخیره آیتم‌های چندگانه
    const baseData = {
      weekly_management_id: weeklyRecord.id,
      customer_id: customer_id,
      unit_id: unit_id || null,
      hall_id: hall_id,
      chick_placement_id: chick_placement_id,
    };

    // بیماری‌ها
    if (disease_ids && Array.isArray(disease_ids) && disease_ids.length > 0) {
      await saveMultipleItems(
        WeeklyDisease,
        "disease_id",
        disease_ids,
        baseData,
      );
    }

    // واکسن‌ها
    if (vaccine_ids && Array.isArray(vaccine_ids) && vaccine_ids.length > 0) {
      await saveMultipleItems(
        WeeklyVaccine,
        "vaccine_id",
        vaccine_ids,
        baseData,
      );
    }

    // داروها
    if (
      medicine_ids &&
      Array.isArray(medicine_ids) &&
      medicine_ids.length > 0
    ) {
      await saveMultipleItems(
        WeeklyMedicine,
        "medicine_id",
        medicine_ids,
        baseData,
      );
    }

    // نوع خوراک
    if (
      feed_type_ids &&
      Array.isArray(feed_type_ids) &&
      feed_type_ids.length > 0
    ) {
      await saveMultipleItems(
        WeeklyFeed,
        "feed_type_id",
        feed_type_ids,
        baseData,
      );
    }

    // پیشنهادات
    if (
      suggestion_ids &&
      Array.isArray(suggestion_ids) &&
      suggestion_ids.length > 0
    ) {
      await saveMultipleItems(
        WeeklySuggestion,
        "suggestion_id",
        suggestion_ids,
        baseData,
      );
    }

    // 10. دریافت رکورد کامل با تمام جزئیات
    // ✅ اضافه کردن as به همه include ها
    const completeRecord = await WeeklyManagement.findByPk(weeklyRecord.id, {
      include: [
        {
          model: WeeklyDisease,
          as: "WeeklyDiseases", // ✅ alias مهم
          attributes: ["disease_id"],
        },
        {
          model: WeeklyVaccine,
          as: "WeeklyVaccines", // ✅ alias مهم
          attributes: ["vaccine_id"],
        },
        {
          model: WeeklyMedicine,
          as: "WeeklyMedicines", // ✅ alias مهم
          attributes: ["medicine_id"],
        },
        {
          model: WeeklyFeed,
          as: "WeeklyFeeds", // ✅ alias مهم
          attributes: ["feed_type_id"],
        },
        {
          model: WeeklySuggestion,
          as: "WeeklySuggestions", // ✅ alias مهم
          attributes: ["suggestion_id"],
        },
      ],
    });

    // فرمت کردن خروجی
    const recordJSON = completeRecord.toJSON();
    const formattedComplete = {
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

    successResponse(
      res,
      formattedComplete,
      "اطلاعات هفتگی با موفقیت ثبت شد",
      201,
    );
  } catch (error) {
    console.error("خطا در ثبت اطلاعات هفتگی:", error);
    errorResponse(res, error.message, 500);
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
      page = 1,
      limit = 20,
    } = req.query;
    const where = {};

    if (customer_id) where.customer_id = parseInt(customer_id);
    if (hall_id) where.hall_id = parseInt(hall_id);
    if (chick_placement_id)
      where.chick_placement_id = parseInt(chick_placement_id);
    if (week_number) where.week_number = parseInt(week_number);

    console.log("📊 جستجوی هفته‌ها با شرط:", where);

    const offset = (page - 1) * limit;

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
    const { id } = req.params;
    const record = await WeeklyManagement.findByPk(id);

    if (!record) {
      return errorResponse(res, "اطلاعات هفتگی یافت نشد", 404);
    }

    // بررسی فعال بودن گله
    const flockCheck = await checkFlockIsActive(record.chick_placement_id);
    if (flockCheck.error) {
      return errorResponse(res, flockCheck.error, 400);
    }

    const allowedFields = [
      "week_start_date",
      "week_end_date",
      "flock_age_days",
      "service_expert_id",
      "daily_feed_intake",
      "weekly_feed_intake",
      "weekly_weight",
      "weekly_mortality",
      "blackout_hours",
      "additional_notes",
      "status",
      "is_active",
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    await record.update(updateData);

    // بروزرسانی آیتم‌های چندگانه (در صورت ارسال)
    const baseData = {
      weekly_management_id: record.id,
      customer_id: record.customer_id,
      unit_id: record.unit_id,
      hall_id: record.hall_id,
      chick_placement_id: record.chick_placement_id,
    };

    // حذف و ایجاد مجدد آیتم‌ها
    if (req.body.disease_ids) {
      await WeeklyDisease.destroy({
        where: { weekly_management_id: record.id },
      });
      if (req.body.disease_ids.length > 0) {
        await saveMultipleItems(
          WeeklyDisease,
          "disease_id",
          req.body.disease_ids,
          baseData,
        );
      }
    }
    if (req.body.vaccine_ids) {
      await WeeklyVaccine.destroy({
        where: { weekly_management_id: record.id },
      });
      if (req.body.vaccine_ids.length > 0) {
        await saveMultipleItems(
          WeeklyVaccine,
          "vaccine_id",
          req.body.vaccine_ids,
          baseData,
        );
      }
    }
    if (req.body.medicine_ids) {
      await WeeklyMedicine.destroy({
        where: { weekly_management_id: record.id },
      });
      if (req.body.medicine_ids.length > 0) {
        await saveMultipleItems(
          WeeklyMedicine,
          "medicine_id",
          req.body.medicine_ids,
          baseData,
        );
      }
    }
    if (req.body.feed_type_ids) {
      await WeeklyFeed.destroy({ where: { weekly_management_id: record.id } });
      if (req.body.feed_type_ids.length > 0) {
        await saveMultipleItems(
          WeeklyFeed,
          "feed_type_id",
          req.body.feed_type_ids,
          baseData,
        );
      }
    }
    if (req.body.suggestion_ids) {
      await WeeklySuggestion.destroy({
        where: { weekly_management_id: record.id },
      });
      if (req.body.suggestion_ids.length > 0) {
        await saveMultipleItems(
          WeeklySuggestion,
          "suggestion_id",
          req.body.suggestion_ids,
          baseData,
        );
      }
    }

    // ✅ اضافه کردن as به include
    const updatedRecord = await WeeklyManagement.findByPk(id, {
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

    // فرمت کردن خروجی
    const updatedJSON = updatedRecord.toJSON();
    const formattedUpdated = {
      ...updatedJSON,
      disease_ids:
        updatedJSON.WeeklyDiseases?.map((d) => d.disease_id).filter(Boolean) ||
        [],
      vaccine_ids:
        updatedJSON.WeeklyVaccines?.map((v) => v.vaccine_id).filter(Boolean) ||
        [],
      medicine_ids:
        updatedJSON.WeeklyMedicines?.map((m) => m.medicine_id).filter(
          Boolean,
        ) || [],
      feed_type_ids:
        updatedJSON.WeeklyFeeds?.map((f) => f.feed_type_id).filter(Boolean) ||
        [],
      suggestion_ids:
        updatedJSON.WeeklySuggestions?.map((s) => s.suggestion_id).filter(
          Boolean,
        ) || [],
      WeeklyDiseases: undefined,
      WeeklyVaccines: undefined,
      WeeklyMedicines: undefined,
      WeeklyFeeds: undefined,
      WeeklySuggestions: undefined,
    };

    successResponse(
      res,
      formattedUpdated,
      "اطلاعات هفتگی با موفقیت بروزرسانی شد",
    );
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};
// ============================================
// حذف اطلاعات هفتگی
// ============================================
const deleteWeeklyRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await WeeklyManagement.findByPk(id);

    if (!record) {
      return errorResponse(res, "اطلاعات هفتگی یافت نشد", 404);
    }

    // بررسی فعال بودن گله
    const flockCheck = await checkFlockIsActive(record.chick_placement_id);
    if (flockCheck.error) {
      return errorResponse(res, flockCheck.error, 400);
    }

    // حذف آیتم‌های مرتبط
    await WeeklyDisease.destroy({ where: { weekly_management_id: id } });
    await WeeklyVaccine.destroy({ where: { weekly_management_id: id } });
    await WeeklyMedicine.destroy({ where: { weekly_management_id: id } });
    await WeeklyFeed.destroy({ where: { weekly_management_id: id } });
    await WeeklySuggestion.destroy({ where: { weekly_management_id: id } });

    await record.destroy();
    successResponse(res, null, "اطلاعات هفتگی با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
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
