const ChickPlacement = require("../models/ChickPlacement");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Hall = require("../models/Hall");
const Unit = require("../models/Unit");
const ChickenBreed = require("../models/ChickenBreed");
const {
  validateChickPlacement,
} = require("../validations/chickPlacementValidation");
const { successResponse, errorResponse } = require("../utils/response");

// ============================================
// ایجاد جوجه‌ریزی جدید
// ============================================
const createChickPlacement = async (req, res) => {
  try {
    const validation = validateChickPlacement(req.body);
    if (!validation.isValid) {
      return errorResponse(res, validation.errors[0], 400, validation.errors);
    }

    const {
      customer_id,
      unit_id,
      hall_id,
      placement_date,
      flock_number,
      chick_source_id,
      breed_id,
      chick_age_on_arrival,
      avg_initial_weight,
      total_chicks_count,
      placement_density,
    } = req.body;

    // بررسی وجود مشتری
    const customer = await CustomerPersonalInfo.findOne({
      where: { id: customer_id, active: true },
    });
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد یا غیرفعال است", 404);
    }

    // بررسی وجود سالن
    const hall = await Hall.findByPk(hall_id);
    if (!hall) {
      return errorResponse(res, "سالن یافت نشد", 404);
    }

    // بررسی یکتایی شماره گله برای این مشتری
    const existingFlock = await ChickPlacement.findOne({
      where: { customer_id, flock_number },
    });
    if (existingFlock) {
      return errorResponse(
        res,
        `شماره گله ${flock_number} قبلاً برای این مشتری ثبت شده است`,
        400,
      );
    }

    // اگر unit_id ارسال شده، بررسی وجود واحد
    if (unit_id) {
      const unit = await Unit.findByPk(unit_id);
      if (!unit) {
        return errorResponse(res, "واحد یافت نشد", 404);
      }
    }

    const chickPlacement = await ChickPlacement.create({
      customer_id,
      unit_id: unit_id || null,
      hall_id,
      placement_date,
      flock_number,
      chick_source_id: chick_source_id || null,
      breed_id: breed_id || null,
      chick_age_on_arrival: chick_age_on_arrival || 1,
      avg_initial_weight: avg_initial_weight || null,
      total_chicks_count: total_chicks_count || null,
      placement_density: placement_density || null,
    });

    successResponse(res, chickPlacement, "جوجه‌ریزی با موفقیت ثبت شد", 201);
  } catch (error) {
    console.error("خطا در ثبت جوجه‌ریزی:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت لیست جوجه‌ریزی‌ها (با فیلتر)
// ============================================
const getChickPlacements = async (req, res) => {
  try {
    const {
      customer_id,
      unit_id,
      hall_id,
      id,
      is_active,
      page = 1,
      limit = 20,
    } = req.query;
    const where = {};

    if (id) where.id = id;
    if (customer_id) where.customer_id = customer_id;
    if (unit_id) where.unit_id = unit_id;
    if (hall_id) where.hall_id = hall_id;

    if (is_active === "true") where.is_active = true;
    else if (is_active === "false") where.is_active = false;

    const offset = (page - 1) * limit;

    const { count, rows } = await ChickPlacement.findAndCountAll({
      where,
      include: [
        {
          model: ChickenBreed,
          as: "breed",
          attributes: ["id", "name", "code"],
          required: false,
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [["placement_date", "DESC"]],
    });

    successResponse(
      res,
      {
        placements: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
      "لیست جوجه‌ریزی‌ها دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت جوجه‌ریزی‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت یک جوجه‌ریزی با ID
// ============================================
const getChickPlacementById = async (req, res) => {
  try {
    const { id } = req.params;
    const chickPlacement = await ChickPlacement.findByPk(id);

    if (!chickPlacement) {
      return errorResponse(res, "جوجه‌ریزی یافت نشد", 404);
    }

    successResponse(res, chickPlacement, "اطلاعات جوجه‌ریزی دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت جوجه‌ریزی:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت جوجه‌ریزی بر اساس سالن (آخرین یا فعال)
// ============================================
const getChickPlacementByHallId = async (req, res) => {
  try {
    const { hall_id } = req.params;
    const chickPlacement = await ChickPlacement.findOne({
      where: { hall_id },
      order: [["placement_date", "DESC"]],
    });

    if (!chickPlacement) {
      return errorResponse(res, "جوجه‌ریزی برای این سالن یافت نشد", 404);
    }

    successResponse(res, chickPlacement, "اطلاعات جوجه‌ریزی سالن دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت جوجه‌ریزی سالن:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی جوجه‌ریزی
// ============================================
const updateChickPlacement = async (req, res) => {
  try {
    const { id } = req.params;
    const chickPlacement = await ChickPlacement.findByPk(id);
    if (!chickPlacement) {
      return errorResponse(res, "جوجه‌ریزی یافت نشد", 404);
    }

    const allowedFields = [
      "unit_id",
      "placement_date",
      "flock_number",
      "chick_source_id",
      "breed_id",
      "chick_age_on_arrival",
      "avg_initial_weight",
      "total_chicks_count",
      "placement_density",
    ];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    await chickPlacement.update(updateData);
    successResponse(res, chickPlacement, "جوجه‌ریزی با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا در بروزرسانی جوجه‌ریزی:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف جوجه‌ریزی
// ============================================
const deleteChickPlacement = async (req, res) => {
  try {
    const { id } = req.params;
    const chickPlacement = await ChickPlacement.findByPk(id);
    if (!chickPlacement) {
      return errorResponse(res, "جوجه‌ریزی یافت نشد", 404);
    }

    await chickPlacement.destroy();
    successResponse(res, null, "جوجه‌ریزی با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا در حذف جوجه‌ریزی:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// فعال کردن یک جوجه‌ریزی (و غیرفعال کردن قبلی همان سالن)
// ============================================
const activateChickPlacement = async (req, res) => {
  try {
    const { id } = req.params;
    const newPlacement = await ChickPlacement.findByPk(id);

    if (!newPlacement) {
      return errorResponse(res, "جوجه‌ریزی یافت نشد", 404);
    }

    if (newPlacement.is_active) {
      return errorResponse(res, "این جوجه‌ریزی قبلاً فعال شده است", 400);
    }

    // غیرفعال کردن جوجه‌ریزی فعال قبلی همان سالن
    await ChickPlacement.update(
      { is_active: false },
      { where: { hall_id: newPlacement.hall_id, is_active: true } },
    );

    // فعال کردن جوجه‌ریزی جدید
    await newPlacement.update({ is_active: true });

    successResponse(
      res,
      newPlacement,
      "جوجه‌ریزی با موفقیت فعال شد و دوره قبلی غیرفعال گردید",
    );
  } catch (error) {
    console.error("خطا در فعال‌سازی جوجه‌ریزی:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// غیرفعال کردن یک جوجه‌ریزی (پایان دوره بدون جایگزین)
// ============================================
const deactivateChickPlacement = async (req, res) => {
  try {
    const { id } = req.params;
    const placement = await ChickPlacement.findByPk(id);

    if (!placement) {
      return errorResponse(res, "جوجه‌ریزی یافت نشد", 404);
    }

    if (!placement.is_active) {
      return errorResponse(res, "این جوجه‌ریزی قبلاً غیرفعال شده است", 400);
    }

    await placement.update({ is_active: false });
    successResponse(res, placement, "دوره جوجه‌ریزی با موفقیت پایان یافت");
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

const getActiveChickPlacementByHallId = async (req, res) => {
  try {
    const { hall_id } = req.params;
    const placement = await ChickPlacement.findOne({
      where: { hall_id, is_active: true },
    });

    if (!placement) {
      return errorResponse(res, "جوجه‌ریزی فعالی برای این سالن یافت نشد", 404);
    }

    successResponse(res, placement, "جوجه‌ریزی فعال سالن دریافت شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// تغییر وضعیت فعال/غیرفعال گله
// ============================================
const toggleChickPlacementStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const placement = await ChickPlacement.findByPk(id);
    if (!placement) {
      return errorResponse(res, "گله یافت نشد", 404);
    }

    // بررسی اینکه وضعیت جدید با وضعیت فعلی تفاوت دارد
    if (placement.is_active === is_active) {
      const statusText = is_active ? "فعال" : "غیرفعال";
      return errorResponse(res, `گله در حال حاضر ${statusText} است`, 400);
    }

    await placement.update({ is_active });

    const message = is_active
      ? "گله با موفقیت فعال شد"
      : "گله با موفقیت غیرفعال شد";
    successResponse(res, placement, message);
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createChickPlacement,
  getChickPlacements,
  getChickPlacementById,
  getChickPlacementByHallId,
  updateChickPlacement,
  deleteChickPlacement,
  activateChickPlacement,
  deactivateChickPlacement,
  getActiveChickPlacementByHallId,
  toggleChickPlacementStatus,
};
