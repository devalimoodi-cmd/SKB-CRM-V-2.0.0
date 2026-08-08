const HallHygiene = require("../models/HallHygiene");
const Hall = require("../models/Hall");
const { successResponse, errorResponse } = require("../utils/response");

// ============================================
// ایجاد یا بروزرسانی اطلاعات بهداشت و ضدعفونی (Upsert)
// ============================================
const createOrUpdateHygiene = async (req, res) => {
  try {
    const {
      hall_id,
      customer_id,
      unit_id,
      last_wash_date,
      last_disinfect_date,
      disinfectant_type,
      description,
    } = req.body;

    if (!hall_id) return errorResponse(res, "شناسه سالن الزامی است", 400);

    const hall = await Hall.findByPk(hall_id);
    if (!hall) return errorResponse(res, "سالن یافت نشد", 404);

    // بررسی وجود رکورد قبلی برای این سالن
    let hygiene = await HallHygiene.findOne({ where: { hall_id } });

    if (hygiene) {
      // بروزرسانی رکورد موجود
      await hygiene.update({
        unit_id: unit_id !== undefined ? unit_id : hygiene.unit_id,
        last_wash_date:
          last_wash_date !== undefined
            ? last_wash_date
            : hygiene.last_wash_date,
        last_disinfect_date:
          last_disinfect_date !== undefined
            ? last_disinfect_date
            : hygiene.last_disinfect_date,
        disinfectant_type:
          disinfectant_type !== undefined
            ? disinfectant_type
            : hygiene.disinfectant_type,
        description:
          description !== undefined ? description : hygiene.description,
        updated_at: new Date(),
      });
      return successResponse(
        res,
        hygiene,
        "اطلاعات بهداشت و ضدعفونی بروزرسانی شد",
      );
    } else {
      // ایجاد رکورد جدید
      hygiene = await HallHygiene.create({
        hall_id,
        customer_id,
        unit_id: unit_id || null,
        last_wash_date: last_wash_date || null,
        last_disinfect_date: last_disinfect_date || null,
        disinfectant_type: disinfectant_type || null,
        description: description || null,
      });
      return successResponse(
        res,
        hygiene,
        "اطلاعات بهداشت و ضدعفونی ایجاد شد",
        201,
      );
    }
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
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
