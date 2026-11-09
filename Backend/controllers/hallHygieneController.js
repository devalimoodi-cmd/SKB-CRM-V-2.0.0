const HallHygiene = require("../models/HallHygiene");
const { successResponse, errorResponse } = require("../utils/response");
// ✅ موج ۱۳.۱۲: نوشتن بهداشت سالن به services/farm/hallDetailsWrite منتقل شد
const hallDetailsWrite = require("../services/farm/hallDetailsWrite");
const { sendFarmError } = require("../services/farm/httpBridge");

// ============================================
// ایجاد یا بروزرسانی اطلاعات بهداشت و ضدعفونی (Upsert)
// ============================================
const createOrUpdateHygiene = async (req, res) => {
  try {
    const { record, created } = await hallDetailsWrite.saveHygiene(req.body);

    return successResponse(
      res,
      record,
      created
        ? "اطلاعات بهداشت و ضدعفونی ایجاد شد"
        : "اطلاعات بهداشت و ضدعفونی بروزرسانی شد",
      created ? 201 : 200,
    );
  } catch (error) {
    console.error("خطا در ثبت اطلاعات بهداشت سالن:", error);
    return sendFarmError(res, error, "خطا در ثبت اطلاعات بهداشت سالن");
  }
};

// ============================================
// دریافت اطلاعات بهداشت یک سالن
// ============================================
const getHygieneByHallId = async (req, res) => {
  try {
    const { hall_id } = req.params;
    const hygiene = await HallHygiene.findOne({ where: { hall_id } }); // فقط یک رکورد

    if (!hygiene) {
      return errorResponse(res, "اطلاعات بهداشتی برای این سالن یافت نشد", 404);
    }
    successResponse(res, hygiene, "اطلاعات بهداشت و ضدعفونی دریافت شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف اطلاعات بهداشت سالن
// ============================================
const deleteHygiene = async (req, res) => {
  try {
    const { id } = req.params;
    const hygiene = await HallHygiene.findByPk(id);
    if (!hygiene) return errorResponse(res, "رکورد بهداشت یافت نشد", 404);
    await hygiene.destroy();
    successResponse(res, null, "رکورد بهداشت حذف شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createOrUpdateHygiene,
  getHygieneByHallId,
  deleteHygiene,
};
