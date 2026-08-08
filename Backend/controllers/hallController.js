const Hall = require("../models/Hall");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Unit = require("../models/Unit");
const { successResponse, errorResponse } = require("../utils/response");
const User = require("../models/User");
const { Op } = require("sequelize");

// ===== ایمپورت متغیر های دریافت  تمام  اطلاعات سالن
const HallPhysicalInfo = require("../models/HallPhysicalInfo");
const HallSystem = require("../models/HallSystem");
const HallWaterFeed = require("../models/HallWaterFeed");
const HallHygiene = require("../models/HallHygiene");

// ============================================
// ایجاد سالن جدید
// ============================================

const createHall = async (req, res) => {
  try {
    const {
      customer_id,
      unit_id,
      hall_name,
      hall_number,
      nominal_capacity,
      altitude_above_sea,
      hall_type_id,
      construction_year,
      service_expert_id,
      operator_name,
      hall_order,
    } = req.body;

    // اعتبارسنجی‌های الزامی
    if (!customer_id) return errorResponse(res, "شناسه مشتری الزامی است", 400);
    if (!unit_id) return errorResponse(res, "شناسه واحد الزامی است", 400);
    if (!hall_name) return errorResponse(res, "نام سالن الزامی است", 400);

    // بررسی وجود مشتری
    const customer = await CustomerPersonalInfo.findOne({
      where: { id: customer_id, active: true },
    });

    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد یا غیرفعال است", 404);
    }

    // بررسی وجود واحد
    const unit = await Unit.findByPk(unit_id);
    if (!unit) {
      return errorResponse(res, "واحد یافت نشد", 404);
    }

    // شماره‌گذاری اتوماتیک hall_number
    let finalHallNumber = hall_number;
    if (!finalHallNumber) {
      const lastHall = await Hall.findOne({
        where: { customer_id, unit_id },
        order: [["hall_number", "DESC"]],
      });
      finalHallNumber = lastHall ? parseInt(lastHall.hall_number || 0) + 1 : 1;
    }

    // محاسبه hall_order
    let finalHallOrder = hall_order;
    if (!finalHallOrder) {
      const lastHall = await Hall.findOne({
        where: { customer_id, unit_id },
        order: [["hall_order", "DESC"]],
      });
      finalHallOrder = lastHall ? lastHall.hall_order + 1 : 1;
    }

    const hall = await Hall.create({
      customer_id,
      unit_id,
      hall_name,
      hall_number: finalHallNumber.toString(),
      hall_order: finalHallOrder,
      nominal_capacity,
      altitude_above_sea,
      hall_type_id,
      construction_year,
      service_expert_id: service_expert_id || null,
      operator_name,
      is_active: true,
    });

    successResponse(res, hall, "سالن با موفقیت ایجاد شد", 201);
  } catch (error) {
    console.error("خطا در ایجاد سالن:", error);
    errorResponse(res, error.message, 500);
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
    const { id } = req.params;
    const hall = await Hall.findByPk(id);

    if (!hall) {
      return errorResponse(res, "سالن یافت نشد", 404);
    }

    await hall.update(req.body);

    successResponse(res, hall, "اطلاعات سالن با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا در بروزرسانی سالن:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف منطقی سالن
// ============================================
const deleteHall = async (req, res) => {
  try {
    const { id } = req.params;
    const hall = await Hall.findByPk(id);

    if (!hall) return errorResponse(res, "سالن یافت نشد", 404);

    await hall.destroy(); // حذف منطقی (deletedAt پر می‌شود)

    successResponse(res, null, "سالن با موفقیت حذف شد (حذف منطقی)");
  } catch (error) {
    console.error("خطا در حذف سالن:", error);
    errorResponse(res, error.message, 500);
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
};
