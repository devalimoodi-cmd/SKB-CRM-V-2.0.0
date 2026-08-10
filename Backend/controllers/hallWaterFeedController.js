const HallWaterFeed = require("../models/HallWaterFeed");
const Hall = require("../models/Hall");
const { successResponse, errorResponse } = require("../utils/response");

const createOrUpdateWaterFeed = async (req, res) => {
  try {
    const {
      hall_id,
      unit_id,
      waterer_type_id,
      feeder_type_id,
      water_lines_count,
      feed_lines_count,
      auto_feed_system,
      notes,
    } = req.body;

    if (!hall_id) return errorResponse(res, "شناسه سالن الزامی است", 400);

    const hall = await Hall.findByPk(hall_id);
    if (!hall) return errorResponse(res, "سالن یافت نشد", 404);

    let waterFeed = await HallWaterFeed.findOne({ where: { hall_id } });

    if (waterFeed) {
      await waterFeed.update({
        unit_id: unit_id !== undefined ? unit_id : waterFeed.unit_id,
        waterer_type_id:
          waterer_type_id !== undefined
            ? waterer_type_id
            : waterFeed.waterer_type_id,
        feeder_type_id:
          feeder_type_id !== undefined
            ? feeder_type_id
            : waterFeed.feeder_type_id,
        water_lines_count:
          water_lines_count !== undefined
            ? water_lines_count
            : waterFeed.water_lines_count,
        feed_lines_count:
          feed_lines_count !== undefined
            ? feed_lines_count
            : waterFeed.feed_lines_count,
        auto_feed_system:
          auto_feed_system !== undefined
            ? auto_feed_system
            : waterFeed.auto_feed_system,
        notes: notes !== undefined ? notes : waterFeed.notes,
      });
      return successResponse(
        res,
        waterFeed,
        "اطلاعات آبخوری و دانخوری بروزرسانی شد",
      );
    } else {
      waterFeed = await HallWaterFeed.create({
        hall_id,
        unit_id: unit_id || null,
        waterer_type_id: waterer_type_id || null,
        feeder_type_id: feeder_type_id || null,
        water_lines_count: water_lines_count || null,
        feed_lines_count: feed_lines_count || null,
        auto_feed_system: auto_feed_system || false,
        notes: notes || null,
      });
      return successResponse(
        res,
        waterFeed,
        "اطلاعات آبخوری و دانخوری ایجاد شد",
        201,
      );
    }
  } catch (error) {
    errorResponse(res, error.message, 500);
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
