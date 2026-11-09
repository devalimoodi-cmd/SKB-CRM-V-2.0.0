const HallSystem = require("../models/HallSystem");
const HallSystemItem = require("../models/HallSystemItem");
const { successResponse, errorResponse } = require("../utils/response");
// ✅ موج ۱۳.۱۲: نوشتن سیستم‌های سالن به services/farm/hallDetailsWrite
//    منتقل شد تا پورتال هم پس از تأیید همان قاعده را اجرا کند.
const hallDetailsWrite = require("../services/farm/hallDetailsWrite");
const { sendFarmError } = require("../services/farm/httpBridge");

// ============================================
// ایجاد یا بروزرسانی اطلاعات سیستم‌های سالن (+ جزئیات چندنوعی)
// ============================================
const createOrUpdateSystem = async (req, res) => {
  try {
    const { record, created } = await hallDetailsWrite.saveSystem(req.body);

    return successResponse(
      res,
      record,
      created
        ? "اطلاعات سیستم‌های سالن ایجاد شد"
        : "اطلاعات سیستم‌های سالن بروزرسانی شد",
      created ? 201 : 200,
    );
  } catch (error) {
    console.error("خطا در ایجاد/بروزرسانی سیستم‌های سالن:", error);
    return sendFarmError(
      res,
      error,
      "خطا در ایجاد/بروزرسانی سیستم‌های سالن",
    );
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
          attributes: ["id", "category", "type_id", "quantity", "spec", "size", "capacity"],
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
