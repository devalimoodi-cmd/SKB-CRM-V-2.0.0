const HallSystem = require("../models/HallSystem");
const HallSystemItem = require("../models/HallSystemItem");
const Hall = require("../models/Hall");
const { successResponse, errorResponse } = require("../utils/response");

// ============================================
// ایجاد یا بروزرسانی اطلاعات سیستم‌های سالن (+ جزئیات چندنوعی)
// ============================================
const createOrUpdateSystem = async (req, res) => {
  try {
    const {
      hall_id,
      unit_id,
      fan_count,
      fan_size,
      fan_capacity,
      heater_count,
      heating_system_id,
      cooling_system_id,
      ventilation_system_id,
      water_inlet_system_id,
      lighting_system_id,
      notes,
      items,
    } = req.body;

    // اعتبارسنجی
    if (!hall_id) {
      return errorResponse(res, "شناسه سالن الزامی است", 400);
    }

    const hall = await Hall.findByPk(hall_id);
    if (!hall) {
      return errorResponse(res, "سالن یافت نشد", 404);
    }

    let system = await HallSystem.findOne({ where: { hall_id } });
    const isNew = !system;
    if (!system) {
      system = await HallSystem.create({
        hall_id,
        unit_id: unit_id || null,
      });
    }

    await system.update({
      unit_id: unit_id !== undefined ? unit_id : system.unit_id,
      fan_count: fan_count !== undefined ? fan_count : system.fan_count,
      fan_size: fan_size !== undefined ? fan_size : system.fan_size,
      fan_capacity:
        fan_capacity !== undefined ? fan_capacity : system.fan_capacity,
      heater_count:
        heater_count !== undefined ? heater_count : system.heater_count,
      heating_system_id:
        heating_system_id !== undefined
          ? heating_system_id
          : system.heating_system_id,
      cooling_system_id:
        cooling_system_id !== undefined
          ? cooling_system_id
          : system.cooling_system_id,
      ventilation_system_id:
        ventilation_system_id !== undefined
          ? ventilation_system_id
          : system.ventilation_system_id,
      water_inlet_system_id:
        water_inlet_system_id !== undefined
          ? water_inlet_system_id
          : system.water_inlet_system_id,
      lighting_system_id:
        lighting_system_id !== undefined
          ? lighting_system_id
          : system.lighting_system_id,
      notes: notes !== undefined ? notes : system.notes,
    });

    // ذخیره ردیف‌های جزئیات (جایگزینی کامل)
    if (Array.isArray(items)) {
      await HallSystemItem.destroy({ where: { system_id: system.id } });
      const rows = items
        .map((it) => {
          const category = String(it.category || "").trim();
          if (!category) return null;
          return {
            system_id: system.id,
            category,
            type_id: it.type_id ? parseInt(it.type_id) : null,
            quantity: Math.max(1, parseInt(it.quantity) || 1),
            spec: it.spec ? String(it.spec).trim() : null,
          };
        })
        .filter(Boolean);
      if (rows.length) await HallSystemItem.bulkCreate(rows);
    }

    const full = await HallSystem.findOne({
      where: { id: system.id },
      include: [
        {
          model: HallSystemItem,
          attributes: ["id", "category", "type_id", "quantity", "spec"],
          required: false,
        },
      ],
    });

    successResponse(
      res,
      full,
      isNew
        ? "اطلاعات سیستم‌های سالن ایجاد شد"
        : "اطلاعات سیستم‌های سالن بروزرسانی شد",
      isNew ? 201 : 200,
    );
  } catch (error) {
    console.error("خطا در ایجاد/بروزرسانی سیستم‌های سالن:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت اطلاعات سیستم‌های سالن
// ============================================
const getSystemByHallId = async (req, res) => {
  try {
    const { hall_id } = req.params;

    if (!hall_id) {
      return errorResponse(res, "شناسه سالن الزامی است", 400);
    }

    const system = await HallSystem.findOne({
      where: { hall_id },
      include: [
        {
          model: HallSystemItem,
          attributes: ["id", "category", "type_id", "quantity", "spec"],
          required: false,
        },
      ],
    });

    // نبود اطلاعات سیستم‌ها برای یک سالن حالت عادی است، نه خطا
    if (!system) {
      return successResponse(
        res,
        null,
        "اطلاعات سیستم‌ها برای این سالن ثبت نشده است",
      );
    }

    successResponse(res, system, "اطلاعات سیستم‌های سالن دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت اطلاعات سیستم‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف اطلاعات سیستم‌های سالن
// ============================================
const deleteSystem = async (req, res) => {
  try {
    const { id } = req.params;

    const system = await HallSystem.findByPk(id);
    if (!system) {
      return errorResponse(res, "اطلاعات سیستم‌ها یافت نشد", 404);
    }

    await system.destroy();
    successResponse(res, null, "اطلاعات سیستم‌های سالن حذف شد");
  } catch (error) {
    console.error("خطا در حذف اطلاعات سیستم‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createOrUpdateSystem,
  getSystemByHallId,
  deleteSystem,
};
