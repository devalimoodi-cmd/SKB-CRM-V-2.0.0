const HallWaterFeed = require("../models/HallWaterFeed");
const { successResponse, errorResponse } = require("../utils/response");
// ✅ موج ۱۳.۱۲: نوشتن آب‌خوری/دان‌خوری به services/farm/hallDetailsWrite منتقل شد
const hallDetailsWrite = require("../services/farm/hallDetailsWrite");
const { sendFarmError } = require("../services/farm/httpBridge");

const createOrUpdateWaterFeed = async (req, res) => {
  try {
    const { record, created } = await hallDetailsWrite.saveWaterFeed(req.body);

    return successResponse(
      res,
      record,
      created
        ? "اطلاعات آب‌خوری و دان‌خوری ایجاد شد"
        : "اطلاعات آب‌خوری و دان‌خوری بروزرسانی شد",
      created ? 201 : 200,
    );
  } catch (error) {
    return sendFarmError(res, error, "خطا در ثبت اطلاعات آب‌خوری و دان‌خوری");
  }
};

const getWaterFeedByHallId = async (req, res) => {
  try {
    const { hall_id } = req.params;
    const waterFeed = await HallWaterFeed.findOne({ where: { hall_id } });
    // نبود اطلاعات آبخوری و دانخوری برای یک سالن حالت عادی است، نه خطا
    if (!waterFeed)
      return successResponse(
        res,
        null,
        "اطلاعات آبخوری و دانخوری برای این سالن ثبت نشده است",
      );
    successResponse(res, waterFeed, "اطلاعات آبخوری و دانخوری دریافت شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

const deleteWaterFeed = async (req, res) => {
  try {
    const { id } = req.params;
    const waterFeed = await HallWaterFeed.findByPk(id);
    if (!waterFeed)
      return errorResponse(res, "اطلاعات آبخوری و دانخوری یافت نشد", 404);
    await waterFeed.destroy();
    successResponse(res, null, "اطلاعات آبخوری و دانخوری حذف شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createOrUpdateWaterFeed,
  getWaterFeedByHallId,
  deleteWaterFeed,
};
