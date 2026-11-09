const Hall = require("../models/Hall");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Unit = require("../models/Unit");
const ChickPlacement = require("../models/ChickPlacement");
const { successResponse, errorResponse } = require("../utils/response");

// ===== ایمپورت متغیر های دریافت  تمام  اطلاعات سالن
const HallPhysicalInfo = require("../models/HallPhysicalInfo");
const HallSystem = require("../models/HallSystem");
const HallSystemItem = require("../models/HallSystemItem");
const HallWaterFeed = require("../models/HallWaterFeed");
const HallHygiene = require("../models/HallHygiene");
// ✅ موج ۱۳.۱۲: نوشتن سالن (شمارهٔ خودکار، همگام‌سازی hall_count و حذف
//    منطقی) به services/farm/hallWrite منتقل شد تا پورتال هم همان
//    قاعده را پس از تأیید اجرا کند.
const hallWrite = require("../services/farm/hallWrite");
const { sendFarmError } = require("../services/farm/httpBridge");

// ============================================
// همگام‌سازی تعداد واقعی سالن‌های یک واحد (units.hall_count)
// ------------------------------------------------------------
// ✅ موج ۱۳.۱۲: این تابع به services/farm/hallWrite منتقل شد
//    (همان منطق، یک نسخه برای کارشناس و پورتال).
// ============================================

// ============================================
// ایجاد سالن جدید
// ============================================

const createHall = async (req, res) => {
  try {
    const { hall } = await hallWrite.createHall(req.body);
    return successResponse(res, hall, "سالن با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا در ایجاد سالن:", error);
    return sendFarmError(res, error, "خطا در ایجاد سالن");
  }
};
// ============================================
// دریافت لیست سالن‌های یک مشتری و واحد
// ============================================
const getHallsByCustomer = async (req, res) => {
  try {
    const { customer_id, unit_id } = req.query;

    const where = {};
    if (customer_id) where.customer_id = customer_id;
    if (unit_id) where.unit_id = unit_id;

    const halls = await Hall.findAll({
      where,
      include: [
        {
          model: CustomerPersonalInfo,
          attributes: ["id", "full_name", "farm_name"],
        },
        {
          model: Unit,
          as: "unit",
          attributes: ["id", "unit_name", "address"],
        },
      ],
      order: [["hall_number", "ASC"]],
    });

    successResponse(res, halls, "لیست سالن‌ها دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت سالن‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت یک سالن با ID
// ============================================
const getHallById = async (req, res) => {
  try {
    const { id } = req.params;

    const hall = await Hall.findByPk(id, {
      include: [
        { model: CustomerPersonalInfo, attributes: ["full_name", "farm_name"] },
        { model: Unit, as: "unit", attributes: ["unit_name", "address"] },
      ],
    });

    if (!hall) {
      return errorResponse(res, "سالن یافت نشد", 404);
    }

    successResponse(res, hall, "اطلاعات سالن دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت سالن:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی سالن
// ============================================
const updateHall = async (req, res) => {
  try {
    const { hall } = await hallWrite.updateHall(req.params.id, req.body);
    return successResponse(
      res,
      hall,
      "اطلاعات سالن با موفقیت بروزرسانی شد",
    );
  } catch (error) {
    console.error("خطا در بروزرسانی سالن:", error);
    return sendFarmError(res, error, "خطا در بروزرسانی سالن");
  }
};

// ============================================
// حذف منطقی سالن
// ============================================
const deleteHall = async (req, res) => {
  try {
    await hallWrite.deleteHall(req.params.id);
    return successResponse(
      res,
      null,
      "سالن با موفقیت حذف شد (حذف منطقی)",
    );
  } catch (error) {
    console.error("خطا در حذف سالن:", error);
    return sendFarmError(res, error, "خطا در حذف سالن");
  }
};

// غیرفعال کردن سالن
const toggleHallStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const hall = await Hall.findByPk(id);
    if (!hall) return errorResponse(res, "سالن یافت نشد", 404);

    await hall.update({ is_active });

    successResponse(res, hall, `سالن ${is_active ? "فعال" : "غیرفعال"} شد`);
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// خلاصه ظرفیت واحدهای مرغداری مشتری
//  unitCapacity       = ظرفیت کل تعریف‌شده واحد (فیلد capacity)
//  totalCapacity      = مجموع ظرفیت اسمی سالن‌های فعال واحد
//  remainingCapacity  = مجموع ظرفیت سالن‌های فعال − ظرفیت سالن‌های دارای جوجه‌ریزی فعال
// ============================================
const getUnitCapacitySummary = async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    if (!customerId) {
      return errorResponse(res, "شناسه مشتری الزامی است", 400);
    }

    const units = await Unit.findAll({
      where: { customer_personal_information_id: customerId },
      attributes: ["id", "unit_name", "capacity"],
      order: [["id", "ASC"]],
    });
    const halls = await Hall.findAll({
      where: { customer_id: customerId },
      attributes: [
        "id",
        "unit_id",
        "hall_name",
        "nominal_capacity",
        "is_active",
      ],
    });
    const placements = await ChickPlacement.findAll({
      where: { customer_id: customerId, is_active: true },
      attributes: ["id", "hall_id"],
    });
    const activeHallIds = new Set(
      placements.map((p) => p.hall_id).filter((v) => v !== null),
    );

    const summary = (units || []).map((unit) => {
      const unitHalls = (halls || []).filter(
        (h) => h.unit_id === unit.id && h.is_active !== false,
      );
      const totalCapacity = unitHalls.reduce(
        (sum, h) => sum + (Number(h.nominal_capacity) || 0),
        0,
      );
      const occupiedHalls = unitHalls.filter((h) =>
        activeHallIds.has(h.id),
      );
      const occupiedCapacity = occupiedHalls.reduce(
        (sum, h) => sum + (Number(h.nominal_capacity) || 0),
        0,
      );
      return {
        unitId: unit.id,
        unitName: unit.unit_name,
        unitCapacity: Number(unit.capacity) || 0,
        totalCapacity,
        occupiedCapacity,
        remainingCapacity: Math.max(totalCapacity - occupiedCapacity, 0),
        hallCount: unitHalls.length,
        occupiedHallCount: occupiedHalls.length,
        activePlacementCount: placements.filter((p) =>
          unitHalls.some((h) => h.id === p.hall_id),
        ).length,
      };
    });

    successResponse(res, summary, "خلاصه ظرفیت واحدها دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت خلاصه ظرفیت:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت اطلاعات کامل سالن (همراه با فیزیکی، سیستم‌ها، آبخوری، بهداشت)
// ============================================
const getHallFullInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const hall = await Hall.findByPk(id, {
      include: [
        {
          model: HallPhysicalInfo,
          attributes: [
            "id",
            "length",
            "width",
            "height",
            "area",
            "floor_type_id",
            "notes",
          ],
        },
        {
          model: HallSystem,
          attributes: [
            "id",
            "fan_count",
            "fan_size",
            "fan_capacity",
            "heater_count",
            "heating_system_id",
            "cooling_system_id",
            "ventilation_system_id",
            "water_inlet_system_id",
            "lighting_system_id",
            "notes",
          ],
          include: [
            {
              model: HallSystemItem,
              attributes: ["id", "category", "type_id", "quantity", "spec", "size", "capacity"],
              required: false,
            },
          ],
        },
        {
          model: HallWaterFeed,
          attributes: [
            "id",
            "waterer_type_id",
            "feeder_type_id",
            "water_lines_count",
            "feed_lines_count",
            "auto_feed_system",
            "notes",
          ],
        },
        {
          model: HallHygiene,
          limit: 10,
          order: [["created_at", "DESC"]],
          attributes: [
            "id",
            "last_wash_date",
            "last_disinfect_date",
            "disinfectant_type",
            "description",
            "created_at",
          ],
        },
        {
          model: CustomerPersonalInfo,
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
        {
          model: Unit,
          as: "unit",
          attributes: ["id", "unit_name", "address", "is_active"],
        },
      ],
    });

    if (!hall) {
      return errorResponse(res, "سالن یافت نشد", 404);
    }

    successResponse(res, hall, "اطلاعات کامل سالن دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت اطلاعات کامل سالن:", error);
    errorResponse(res, error.message, 500);
  }
};
// ============================================

module.exports = {
  createHall,
  getHallsByCustomer,
  getHallById,
  updateHall,
  deleteHall,
  toggleHallStatus,
  getHallFullInfo,
  getUnitCapacitySummary,
};
