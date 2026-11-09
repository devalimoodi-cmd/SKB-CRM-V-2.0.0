const ChickPlacement = require("../models/ChickPlacement");
const ChickenBreed = require("../models/ChickenBreed");
const { successResponse, errorResponse } = require("../utils/response");
const { parsePagination } = require("../utils/pagination");
// ✅ موج ۱۳.۱۲: منطق نوشتن جوجه‌ریزی به services/farm/placementWrite منتقل
//    شد؛ همان فایل «کدام گله؟» را از services/flockResolver می‌گیرد، پس
//    ماژول کارشناس و مسیر تأیید پورتال دقیقاً یک قاعده دارند (یک منبع).
const placementWrite = require("../services/farm/placementWrite");
const { sendFarmError } = require("../services/farm/httpBridge");


// ============================================
// ایجاد جوجه‌ریزی جدید (زیر یک گله)
// ============================================
const createChickPlacement = async (req, res) => {
  // ✅ تراکنش داخل سرویس مدیریت می‌شود: اگر ساخت گله یا ثبت جوجه‌ریزی
  // شکست بخورد، هیچ ردیف نیمه‌کاره‌ای نمی‌ماند (همان رفتار قبلی).
  try {
    const { placement, flock } = await placementWrite.createPlacement(
      req.body,
    );

    return successResponse(
      res,
      { ...placement.toJSON(), flock },
      "جوجه‌ریزی با موفقیت ثبت شد",
      201,
    );
  } catch (error) {
    console.error("خطا در ثبت جوجه‌ریزی:", error);
    return sendFarmError(res, error, "خطا در ثبت جوجه‌ریزی");
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
    } = req.query;

    // ✅ صفحه‌بندی با سقف
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const where = {};

    if (id) where.id = id;
    if (customer_id) where.customer_id = customer_id;
    if (unit_id) where.unit_id = unit_id;
    if (hall_id) where.hall_id = hall_id;

    if (is_active === "true") where.is_active = true;
    else if (is_active === "false") where.is_active = false;

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
    const { placement } = await placementWrite.updatePlacement(
      req.params.id,
      req.body,
    );
    return successResponse(res, placement, "جوجه‌ریزی با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا در بروزرسانی جوجه‌ریزی:", error);
    return sendFarmError(res, error, "خطا در بروزرسانی جوجه‌ریزی");
  }
};

// ============================================
// حذف یک «گله/دوره» کامل به همراه همه جوجه‌ریزی‌های سالن‌های عضو
// ============================================
const deleteFlockGroup = async (req, res) => {
  try {
    const { flock, removedPlacements } = await placementWrite.deleteFlockGroup(
      req.params.flockId,
    );

    return successResponse(
      res,
      { removedPlacements },
      `گله شماره ${flock.flock_number} و ${removedPlacements} جوجه‌ریزی آن حذف شد`,
    );
  } catch (error) {
    console.error("خطا در حذف گله:", error);
    return sendFarmError(res, error, "خطا در حذف گله");
  }
};

// ============================================
// حذف جوجه‌ریزی
// ============================================
const deleteChickPlacement = async (req, res) => {
  try {
    await placementWrite.deletePlacement(req.params.id);
    return successResponse(res, null, "جوجه‌ریزی با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا در حذف جوجه‌ریزی:", error);
    return sendFarmError(res, error, "خطا در حذف جوجه‌ریزی");
  }
};

// ============================================
// فعال کردن یک جوجه‌ریزی (و غیرفعال کردن قبلی همان سالن)
// ============================================
const activateChickPlacement = async (req, res) => {
  try {
    const { placement } = await placementWrite.activatePlacement(
      req.params.id,
    );
    return successResponse(
      res,
      placement,
      "جوجه‌ریزی با موفقیت فعال شد و دوره قبلی غیرفعال گردید",
    );
  } catch (error) {
    console.error("خطا در فعال‌سازی جوجه‌ریزی:", error);
    return sendFarmError(res, error, "خطا در فعال‌سازی جوجه‌ریزی");
  }
};

// ============================================
// غیرفعال کردن یک جوجه‌ریزی (پایان دوره بدون جایگزین)
// ============================================
const deactivateChickPlacement = async (req, res) => {
  try {
    const { placement } = await placementWrite.deactivatePlacement(
      req.params.id,
    );
    return successResponse(
      res,
      placement,
      "دوره جوجه‌ریزی با موفقیت پایان یافت",
    );
  } catch (error) {
    console.error("خطا در پایان دوره جوجه‌ریزی:", error);
    return sendFarmError(res, error, "خطا در پایان دوره جوجه‌ریزی");
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
  deleteFlockGroup,
  activateChickPlacement,
  deactivateChickPlacement,
  getActiveChickPlacementByHallId,
  toggleChickPlacementStatus,
};
