const HallPhysicalInfo = require("../models/HallPhysicalInfo");
const { successResponse, errorResponse } = require("../utils/response");
// ✅ موج ۱۳.۱۲: نوشتن اطلاعات فیزیکی به services/farm/hallDetailsWrite منتقل شد
const hallDetailsWrite = require("../services/farm/hallDetailsWrite");
const { sendFarmError } = require("../services/farm/httpBridge");

const createOrUpdatePhysicalInfo = async (req, res) => {
  try {
    const { record, created } = await hallDetailsWrite.savePhysicalInfo(
      req.body,
    );

    return successResponse(
      res,
      record,
      created ? "اطلاعات فیزیکی ایجاد شد" : "اطلاعات فیزیکی بروزرسانی شد",
      created ? 201 : 200,
    );
  } catch (error) {
    return sendFarmError(res, error, "خطا در ثبت اطلاعات فیزیکی");
  }
};

const getPhysicalInfoByHallId = async (req, res) => {
  try {
    const { hall_id } = req.params;
    const physicalInfo = await HallPhysicalInfo.findOne({ where: { hall_id } });
    // نبود اطلاعات فیزیکی برای یک سالن حالت عادی است، نه خطا
    if (!physicalInfo)
      return successResponse(
        res,
        null,
        "اطلاعات فیزیکی برای این سالن ثبت نشده است",
      );
    successResponse(res, physicalInfo, "اطلاعات فیزیکی دریافت شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

const deletePhysicalInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const physicalInfo = await HallPhysicalInfo.findByPk(id);
    if (!physicalInfo)
      return errorResponse(res, "اطلاعات فیزیکی یافت نشد", 404);
    await physicalInfo.destroy();
    successResponse(res, null, "اطلاعات فیزیکی حذف شد");
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createOrUpdatePhysicalInfo,
  getPhysicalInfoByHallId,
  deletePhysicalInfo,
};
