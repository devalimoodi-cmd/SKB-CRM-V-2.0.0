// ================================================================
// controllers/breedStandardController.js
// مدیریت استانداردهای وزنی نژادها (جدول breed_weight_standards)
// ================================================================

const BreedWeightStandard = require("../models/BreedWeightStandard");
const ChickenBreed = require("../models/ChickenBreed");
const { successResponse, errorResponse } = require("../utils/response");
const { Op } = require("sequelize");

// ============================================
// دریافت لیست استانداردها (با فیلتر نژاد/هفته)
// ============================================
const getBreedStandards = async (req, res) => {
  try {
    const { breed_id, week_number, active = "true" } = req.query;
    const where = {};

    if (breed_id) where.breed_id = breed_id;
    if (week_number) where.week_number = week_number;
    if (active === "true") where.is_active = true;
    else if (active === "false") where.is_active = false;
    else if (active === "all") delete where.is_active;

    const standards = await BreedWeightStandard.findAll({
      where,
      include: [
        {
          model: ChickenBreed,
          as: "breed",
          attributes: ["id", "name", "code"],
          required: false,
        },
      ],
      order: [
        ["breed_id", "ASC"],
        ["week_number", "ASC"],
      ],
    });

    successResponse(res, standards, "لیست استانداردهای نژاد دریافت شد");
  } catch (error) {
    console.error("❌ خطا در دریافت استانداردهای نژاد:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت یک استاندارد با ID
// ============================================
const getBreedStandardById = async (req, res) => {
  try {
    const { id } = req.params;
    const standard = await BreedWeightStandard.findByPk(id, {
      include: [
        {
          model: ChickenBreed,
          as: "breed",
          attributes: ["id", "name", "code"],
          required: false,
        },
      ],
    });

    if (!standard) {
      return errorResponse(res, "استاندارد یافت نشد", 404);
    }

    successResponse(res, standard, "استاندارد نژاد دریافت شد");
  } catch (error) {
    console.error("❌ خطا در دریافت استاندارد:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// ایجاد استاندارد جدید
// ============================================
const createBreedStandard = async (req, res) => {
  try {
    const {
      breed_id,
      week_number,
      age_days,
      target_weight,
      min_weight,
      max_weight,
      standard_fcr,
      standard_feed_intake,
      source_type,
      source_description,
      is_active,
      is_default,
    } = req.body;

    if (!breed_id) {
      return errorResponse(res, "شناسه نژاد الزامی است", 400);
    }
    if (!week_number) {
      return errorResponse(res, "شماره هفته الزامی است", 400);
    }
    if (target_weight === undefined || target_weight === null) {
      return errorResponse(res, "وزن هدف الزامی است", 400);
    }

    const breed = await ChickenBreed.findByPk(breed_id);
    if (!breed) {
      return errorResponse(res, "نژاد یافت نشد", 404);
    }

    // بررسی تکراری نبودن (نژاد + هفته)
    const existing = await BreedWeightStandard.findOne({
      where: { breed_id, week_number },
    });
    if (existing) {
      return errorResponse(
        res,
        `استاندارد هفته ${week_number} برای این نژاد قبلاً ثبت شده است`,
        400,
      );
    }

    const standard = await BreedWeightStandard.create({
      breed_id,
      week_number,
      age_days: age_days !== undefined ? age_days : week_number * 7,
      target_weight,
      min_weight: min_weight !== undefined ? min_weight : null,
      max_weight: max_weight !== undefined ? max_weight : null,
      standard_fcr: standard_fcr !== undefined ? standard_fcr : null,
      standard_feed_intake:
        standard_feed_intake !== undefined ? standard_feed_intake : null,
      source_type: source_type || "user",
      source_description: source_description || null,
      is_active: is_active !== undefined ? is_active : true,
      is_default: is_default || false,
      created_by: req.user ? req.user.id : null,
    });

    successResponse(res, standard, "استاندارد نژاد با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("❌ خطا در ایجاد استاندارد:", error);
    if (error.message.includes("قبلاً ثبت شده")) {
      return errorResponse(res, error.message, 400);
    }
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی استاندارد
// ============================================
const updateBreedStandard = async (req, res) => {
  try {
    const { id } = req.params;
    const standard = await BreedWeightStandard.findByPk(id);
    if (!standard) {
      return errorResponse(res, "استاندارد یافت نشد", 404);
    }

    const allowedFields = [
      "breed_id",
      "week_number",
      "age_days",
      "target_weight",
      "min_weight",
      "max_weight",
      "standard_fcr",
      "standard_feed_intake",
      "source_type",
      "source_description",
      "is_active",
      "is_default",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    // اگر شماره هفته یا نژاد تغییر کرد، از تکراری نبودن مطمئن شو
    if (updateData.breed_id || updateData.week_number) {
      const newBreedId = updateData.breed_id || standard.breed_id;
      const newWeek = updateData.week_number || standard.week_number;
      const dup = await BreedWeightStandard.findOne({
        where: {
          breed_id: newBreedId,
          week_number: newWeek,
          id: { [Op.ne]: id },
        },
      });
      if (dup) {
        return errorResponse(
          res,
          `استاندارد هفته ${newWeek} برای این نژاد قبلاً ثبت شده است`,
          400,
        );
      }
    }

    updateData.updated_by = req.user ? req.user.id : null;
    await standard.update(updateData);

    successResponse(res, standard, "استاندارد نژاد با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("❌ خطا در بروزرسانی استاندارد:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف استاندارد
// ============================================
const deleteBreedStandard = async (req, res) => {
  try {
    const { id } = req.params;
    const standard = await BreedWeightStandard.findByPk(id);
    if (!standard) {
      return errorResponse(res, "استاندارد یافت نشد", 404);
    }

    await standard.destroy();
    successResponse(res, null, "استاندارد نژاد با موفقیت حذف شد");
  } catch (error) {
    console.error("❌ خطا در حذف استاندارد:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  getBreedStandards,
  getBreedStandardById,
  createBreedStandard,
  updateBreedStandard,
  deleteBreedStandard,
};

