const ChickPlacement = require("../models/ChickPlacement");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Hall = require("../models/Hall");
const Flock = require("../models/Flock");
const Unit = require("../models/Unit");
const ChickenBreed = require("../models/ChickenBreed");
const {
  validateChickPlacement,
} = require("../validations/chickPlacementValidation");
const { successResponse, errorResponse } = require("../utils/response");

// ============================================
// محاسبه شماره بعدی گله برای (مشتری + واحد)
// ============================================
const getNextFlockNumber = async (customer_id, unit_id) => {
  const last = await Flock.findOne({
    where: { customer_id, unit_id },
    order: [["flock_number", "DESC"]],
    attributes: ["flock_number"],
  });
  return (last ? parseInt(last.flock_number) : 0) + 1;
};

// ============================================
// ساخت رکورد گله جدید
// ============================================
const createFlockRecord = async (customer_id, unit_id, placement_date) => {
  const nextNumber = await getNextFlockNumber(customer_id, unit_id);
  return Flock.create({
    customer_id,
    unit_id,
    flock_number: nextNumber,
    placement_date,
    status: "active",
  });
};

// ============================================
// تعیین گله برای یک جوجه‌ریزی
// (انتخاب صریح: پیوستن به گله مشخص / شروع گله جدید / پیش‌فرض امن)
// ============================================
const resolveFlock = async ({
  customer_id,
  unit_id,
  placement_date,
  flock_id,
  start_new_flock,
}) => {
  // ۱) شروع صریح گله جدید (کنار گله‌های فعال موجود)
  if (start_new_flock) {
    return createFlockRecord(customer_id, unit_id, placement_date);
  }

  // ۲) اگر گله مشخص شده، بررسی اعتبار آن
  if (flock_id) {
    const flock = await Flock.findOne({ where: { id: flock_id, customer_id } });
    if (!flock) {
      const err = new Error("گله یافت نشد");
      err.status = 404;
      throw err;
    }
    if (parseInt(flock.unit_id) !== parseInt(unit_id)) {
      const err = new Error("گله متعلق به این واحد نیست");
      err.status = 400;
      throw err;
    }
    if (flock.status !== "active") {
      const err = new Error("گله مورد نظر فعال نیست");
      err.status = 400;
      throw err;
    }
    return flock;
  }

  // ۳) بدون انتخاب صریح: پیوستن به جدیدترین گله فعالِ دارای حداقل یک سالن فعال؛
  //    وگرنه ساخت گله جدید. (گله‌های فعالِ بی‌سالن بسته نمی‌شوند — پایان صریح دارند)
  const activeFlocks = await Flock.findAll({
    where: { customer_id, unit_id, status: "active" },
    order: [["placement_date", "DESC"]],
  });
  for (const f of activeFlocks) {
    const activeCnt = await ChickPlacement.count({
      where: { flock_id: f.id, is_active: true },
    });
    if (activeCnt > 0) return f;
  }

  // ۴) ساخت گله جدید
  return createFlockRecord(customer_id, unit_id, placement_date);
};

// ============================================
// ایجاد جوجه‌ریزی جدید (زیر یک گله)
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
      flock_id, // اختیاری — برای «پیوستن به گله مشخص»
      start_new_flock, // اختیاری — «شروع گله جدید» صریح
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

    // واحد الزامی است (گله در سطح واحد تعریف می‌شود)
    if (!unit_id) {
      return errorResponse(res, "شناسه واحد الزامی است", 400);
    }
    const unit = await Unit.findByPk(unit_id);
    if (!unit) {
      return errorResponse(res, "واحد یافت نشد", 404);
    }
    if (hall.unit_id && parseInt(hall.unit_id) !== parseInt(unit_id)) {
      return errorResponse(res, "سالن متعلق به این واحد نیست", 400);
    }

    // فقط یک جوجه‌ریزی فعال در هر سالن
    const activeInHall = await ChickPlacement.findOne({
      where: { hall_id, is_active: true },
    });
    if (activeInHall) {
      return errorResponse(
        res,
        "سالن در حال حاضر دارای جوجه‌ریزی فعال است؛ ابتدا دوره فعلی را پایان دهید",
        400,
      );
    }

    // پیدا کردن / ساخت گله
    let flock;
    try {
      flock = await resolveFlock({
        customer_id,
        unit_id,
        placement_date,
        flock_id,
        start_new_flock: !!start_new_flock,
      });
    } catch (resolveError) {
      return errorResponse(res, resolveError.message, resolveError.status || 400);
    }

    const chickPlacement = await ChickPlacement.create({
      customer_id,
      unit_id,
      hall_id,
      placement_date,
      flock_id: flock.id,
      // شماره گله در سطح گله است؛ اینجا فقط برای سازگاری ذخیره می‌شود
      flock_number: flock.flock_number,
      chick_source_id: chick_source_id || null,
      breed_id: breed_id || null,
      chick_age_on_arrival: chick_age_on_arrival || 1,
      avg_initial_weight: avg_initial_weight || null,
      total_chicks_count: total_chicks_count || null,
      placement_density: placement_density || null,
    });

    successResponse(
      res,
      { ...chickPlacement.toJSON(), flock },
      "جوجه‌ریزی با موفقیت ثبت شد",
      201,
    );
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
      if (req.body[field] === undefined) continue;
      // شماره گله اکنون در سطح گله/دوره است؛ فقط مقدار مثبت معتبر است (0 → نادیده)
      if (field === "flock_number") {
        const fn = parseInt(req.body[field]);
        if (!isNaN(fn) && fn > 0) updateData[field] = fn;
        continue;
      }
      updateData[field] = req.body[field];
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
