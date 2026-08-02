const HallPhysicalInfo = require("../models/HallPhysicalInfo");
const Hall = require("../models/Hall");
const { successResponse, errorResponse } = require("../utils/response");

const createOrUpdatePhysicalInfo = async (req, res) => {
  try {
    const {
      hall_id,
      period_id,
      length,
      width,
      height,
      area,
      floor_type_id,
      notes,
    } = req.body;

    if (!hall_id) return errorResponse(res, "شناسه سالن الزامی است", 400);

    const hall = await Hall.findByPk(hall_id);
    if (!hall) return errorResponse(res, "سالن یافت نشد", 404);

    let physicalInfo = await HallPhysicalInfo.findOne({ where: { hall_id } });

    if (physicalInfo) {
      await physicalInfo.update({
        period_id: period_id !== undefined ? period_id : physicalInfo.period_id,
        length: length !== undefined ? length : physicalInfo.length,
        width: width !== undefined ? width : physicalInfo.width,
        height: height !== undefined ? height : physicalInfo.height,
        area: area !== undefined ? area : physicalInfo.area,
        floor_type_id:
          floor_type_id !== undefined
            ? floor_type_id
            : physicalInfo.floor_type_id,
        notes: notes !== undefined ? notes : physicalInfo.notes,
      });
      return successResponse(res, physicalInfo, "اطلاعات فیزیکی بروزرسانی شد");
    } else {
      physicalInfo = await HallPhysicalInfo.create({
        hall_id,
        period_id: period_id || null,
        length: length || null,
        width: width || null,
        height: height || null,
        area: area || null,
        floor_type_id: floor_type_id || null,
        notes: notes || null,
      });
      return successResponse(res, physicalInfo, "اطلاعات فیزیکی ایجاد شد", 201);
    }
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

const getPhysicalInfoByHallId = async (req, res) => {
  try {
    const { hall_id } = req.params;
    const physicalInfo = await HallPhysicalInfo.findOne({ where: { hall_id } });
    if (!physicalInfo)
      return errorResponse(res, "اطلاعات فیزیکی یافت نشد", 404);
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
