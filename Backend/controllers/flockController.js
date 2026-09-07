// ================================================================
// controllers/flockController.js
// مدیریت «گله» (دوره پرورش) در سطح واحد مرغداری
// ================================================================

const Flock = require("../models/Flock");
const ChickPlacement = require("../models/ChickPlacement");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Unit = require("../models/Unit");
const Hall = require("../models/Hall");
const ChickenBreed = require("../models/ChickenBreed");
const FlockCompletion = require("../models/FlockCompletion");
const { Op } = require("sequelize");
const { successResponse, errorResponse } = require("../utils/response");

// محاسبه شماره بعدی گله برای (مشتری + واحد)
const getNextFlockNumber = async (customer_id, unit_id) => {
  const last = await Flock.findOne({
    where: { customer_id, unit_id },
    order: [["flock_number", "DESC"]],
    attributes: ["flock_number"],
  });
  return (last ? parseInt(last.flock_number) : 0) + 1;
};

// include مشترک برای لیست گله‌ها
const placementInclude = [
  {
    model: ChickPlacement,
    as: "placements",
    separate: true,
    include: [
      { model: Hall, attributes: ["id", "hall_name", "nominal_capacity"] },
      {
        model: ChickenBreed,
        as: "breed",
        attributes: ["id", "name"],
        required: false,
      },
    ],
  },
];

// ============================================
// ایجاد گله جدید
// ============================================
const createFlock = async (req, res) => {
  try {
    const { customer_id, unit_id, placement_date, flock_number, notes } =
      req.body;

    if (!customer_id || !unit_id || !placement_date) {
      return errorResponse(
        res,
        "شناسه مشتری، شناسه واحد و تاریخ جوجه‌ریزی الزامی است",
        400,
      );
    }

    // بررسی مشتری
    const customer = await CustomerPersonalInfo.findOne({
      where: { id: customer_id, active: true },
    });
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد یا غیرفعال است", 404);
    }

    // بررسی واحد
    const unit = await Unit.findByPk(unit_id);
    if (!unit) {
      return errorResponse(res, "واحد یافت نشد", 404);
    }

    // چند گله فعال به‌صورت هم‌زمان در یک واحد مجاز است (نوبت‌های متفاوت کنار هم)
    // فقط یکتایی شماره گله و تعلق به واحد بررسی می‌شود

    // شماره گله: اگر داده نشده، بعدی
    const nextNumber =
      flock_number || (await getNextFlockNumber(customer_id, unit_id));

    // یکتایی شماره گله
    const exists = await Flock.findOne({
      where: { customer_id, unit_id, flock_number: nextNumber },
    });
    if (exists) {
      return errorResponse(
        res,
        `شماره گله ${nextNumber} قبلاً برای این واحد ثبت شده است`,
        400,
      );
    }

    const flock = await Flock.create({
      customer_id,
      unit_id,
      flock_number: nextNumber,
      placement_date,
      status: "active",
      notes: notes || null,
    });

    successResponse(res, flock, "گله با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا در ایجاد گله:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت لیست گله‌ها (با سالن‌ها)
// ============================================
const getFlocks = async (req, res) => {
  try {
    const { customer_id, unit_id, status, page = 1, limit = 50 } = req.query;
    const where = {};
    if (customer_id) where.customer_id = parseInt(customer_id);
    if (unit_id) where.unit_id = parseInt(unit_id);
    if (status && status !== "all") where.status = status;

    const offset = (page - 1) * limit;

    const { count, rows } = await Flock.findAndCountAll({
      where,
      include: [
        { model: Unit, as: "unit", attributes: ["id", "unit_name", "capacity"] },
        ...placementInclude,
      ],
      order: [["placement_date", "DESC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true,
    });

    successResponse(
      res,
      {
        flocks: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
      "لیست گله‌ها دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت گله‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت یک گله با جزئیات
// ============================================
const getFlockById = async (req, res) => {
  try {
    const { id } = req.params;
    const flock = await Flock.findByPk(id, {
      include: [
        {
          model: Unit,
          as: "unit",
          attributes: ["id", "unit_name", "capacity", "address"],
        },
        ...placementInclude,
        { model: FlockCompletion, as: "completions" },
      ],
    });

    if (!flock) {
      return errorResponse(res, "گله یافت نشد", 404);
    }

    // جمع‌بندی سریع: تعداد کل جوجه و تلفات (از جوجه‌ریزی سالن‌ها)
    const placements = flock.placements || [];
    const totalChicks = placements.reduce(
      (sum, p) => sum + (parseInt(p.total_chicks_count) || 0),
      0,
    );
    const activeHalls = placements.filter((p) => p.is_active).length;

    successResponse(
      res,
      {
        ...flock.toJSON(),
        summary: {
          totalChicks,
          activeHalls,
          totalHalls: placements.length,
        },
      },
      "اطلاعات گله دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت گله:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// پایان دادن به گله (completed / cancelled)
// ============================================
const endFlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = "completed", ended_at, notes } = req.body;

    if (!["completed", "cancelled"].includes(status)) {
      return errorResponse(
        res,
        "وضعیت پایانی باید completed یا cancelled باشد",
        400,
      );
    }

    const flock = await Flock.findByPk(id);
    if (!flock) {
      return errorResponse(res, "گله یافت نشد", 404);
    }
    if (flock.status !== "active") {
      return errorResponse(
        res,
        `این گله قبلاً با وضعیت ${flock.status} پایان یافته است`,
        400,
      );
    }

    await flock.update({
      status,
      ended_at: ended_at || new Date().toISOString().slice(0, 10),
      ...(notes ? { notes } : {}),
    });

    // غیرفعال کردن جوجه‌ریزی‌های فعال سالن‌های این گله
    await ChickPlacement.update(
      { is_active: false },
      { where: { flock_id: flock.id, is_active: true } },
    );

    successResponse(res, flock, "گله با موفقیت پایان یافت");
  } catch (error) {
    console.error("خطا در پایان دادن گله:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// صادرات
// ============================================
// ============================================
// بروزرسانی اطلاعات مشترک گله (Flock)
// ============================================
const updateFlock = async (req, res) => {
  try {
    const { id } = req.params;
    const flock = await Flock.findByPk(id);
    if (!flock) {
      return errorResponse(res, "گله یافت نشد", 404);
    }

    const updateData = {};
    let flockNumberChanged = false;

    if (req.body.flock_number !== undefined) {
      const fn = parseInt(req.body.flock_number);
      if (isNaN(fn) || fn < 1) {
        return errorResponse(res, "شماره گله باید عددی مثبت باشد", 400);
      }
      flockNumberChanged = fn !== parseInt(flock.flock_number);
      if (flockNumberChanged) {
        const duplicate = await Flock.findOne({
          where: {
            customer_id: flock.customer_id,
            unit_id: flock.unit_id,
            flock_number: fn,
            id: { [Op.ne]: flock.id },
          },
        });
        if (duplicate) {
          return errorResponse(
            res,
            `شماره گله ${fn} قبلاً برای این واحد ثبت شده است`,
            400,
          );
        }
      }
      updateData.flock_number = fn;
    }

    if (req.body.placement_date !== undefined) {
      updateData.placement_date = req.body.placement_date || null;
    }
    if (req.body.notes !== undefined) {
      updateData.notes = req.body.notes || null;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, "فیلدی برای بروزرسانی ارسال نشده است", 400);
    }

    await flock.update(updateData);

    // همگام‌سازی شماره گله روی جوجه‌ریزی‌های سالن‌های عضو
    if (flockNumberChanged) {
      await ChickPlacement.update(
        { flock_number: updateData.flock_number },
        { where: { flock_id: flock.id } },
      );
    }

    successResponse(res, flock, "اطلاعات گله با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا در بروزرسانی گله:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// تغییر وضعیت کل گله (فعال / غیرفعال)
// ============================================
const setFlockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive"].includes(status)) {
      return errorResponse(res, "وضعیت باید active یا inactive باشد", 400);
    }

    const flock = await Flock.findByPk(id);
    if (!flock) {
      return errorResponse(res, "گله یافت نشد", 404);
    }

    if (flock.status === status) {
      const statusText = status === "active" ? "فعال" : "غیرفعال";
      return errorResponse(res, `گله در حال حاضر ${statusText} است`, 400);
    }

    if (status === "inactive") {
      await flock.update({ status: "inactive" });
      await ChickPlacement.update(
        { is_active: false },
        { where: { flock_id: flock.id, is_active: true } },
      );
      return successResponse(
        res,
        { flock, activatedHalls: 0, skippedHalls: [] },
        "گله با موفقیت غیرفعال شد و از فهرست گله‌های فعال حذف گردید",
      );
    }

    // فعال‌سازی: وضعیت گله فعال + فعال‌کردن سالن‌هایی که گله/جوجه‌ریزی فعال دیگری ندارند
    await flock.update({ status: "active", ended_at: null });

    const placements = await ChickPlacement.findAll({
      where: { flock_id: flock.id },
    });
    let activatedHalls = 0;
    const skippedHalls = [];

    for (const p of placements) {
      const occupier = await ChickPlacement.findOne({
        where: {
          hall_id: p.hall_id,
          is_active: true,
          id: { [Op.ne]: p.id },
        },
      });
      if (occupier) {
        skippedHalls.push(p.hall_id);
        continue;
      }
      if (!p.is_active) {
        await p.update({ is_active: true });
      }
      activatedHalls++;
    }

    const message =
      skippedHalls.length > 0
        ? `گله فعال شد؛ ${skippedHalls.length} سالن به دلیل جوجه‌ریزی فعال دیگری در آن سالن غیرفعال ماند`
        : "گله با موفقیت فعال شد";

    successResponse(
      res,
      { flock, activatedHalls, skippedHalls },
      message,
    );
  } catch (error) {
    console.error("خطا در تغییر وضعیت گله:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createFlock,
  getFlocks,
  getFlockById,
  endFlock,
  updateFlock,
  setFlockStatus,
};
