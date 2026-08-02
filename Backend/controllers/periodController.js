const { sequelize } = require("../config/database");
const Period = require("../models/Period");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const { validatePeriodData } = require("../validations/periodValidation");
const { successResponse, errorResponse } = require("../utils/response");

// ============================================
// ایجاد دوره جدید
// ============================================
const createPeriod = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const validation = validatePeriodData(req.body);
    if (!validation.isValid) {
      return errorResponse(res, validation.errors[0], 400, validation.errors);
    }

    const {
      customer_personal_information_id,
      period_name,
      start_date,
      end_date,
      status,
    } = req.body;

    const customer = await CustomerPersonalInfo.findOne({
      where: { id: customer_personal_information_id, active: true },
    });
    if (!customer) {
      return errorResponse(res, "مشتری معتبر یافت نشد", 404);
    }

    // محاسبه شماره دوره بعدی برای این مشتری
    const lastPeriod = await Period.findOne({
      where: { customer_personal_information_id },
      order: [["period_number", "DESC"]],
      attributes: ["period_number"],
      transaction,
    });

    const nextPeriodNumber = lastPeriod ? lastPeriod.period_number + 1 : 1;

    const period = await Period.create(
      {
        customer_personal_information_id,
        period_name,
        start_date,
        end_date: end_date || null,
        status: status || "pending",
        period_number: nextPeriodNumber,
      },
      { transaction },
    );

    await transaction.commit();
    successResponse(
      res,
      {
        id: period.id,
        period_number: period.period_number,
        period_name: period.period_name,
        status: period.status,
        customer_name: customer.full_name, // ← نام مشتری
        customer_farm: customer.farm_name, // ← نام مزرعه (اختیاری)
      },
      "دوره با موفقیت ایجاد شد",
      201,
    );
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در ایجاد دوره:", error);
    errorResponse(res, error.message, 500);
  }
};
// ============================================
// دریافت لیست دوره‌ها (با قابلیت فیلتر)
// ============================================
const getPeriods = async (req, res) => {
  try {
    const {
      customer_id,
      status,
      sort = "period_number",
      order = "ASC",
      page = 1,
      limit = 20,
    } = req.query;
    const where = {};

    if (customer_id) where.customer_personal_information_id = customer_id;
    if (status) where.status = status;

    // معتبرسازی فیلد sort
    const validSortFields = [
      "period_number",
      "id",
      "start_date",
      "period_name",
    ];
    const sortField = validSortFields.includes(sort) ? sort : "period_number";
    const sortOrder = order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    const offset = (page - 1) * limit;

    const { count, rows } = await Period.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortField, sortOrder]],
      include: [
        {
          model: CustomerPersonalInfo,
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
      ],
    });

    successResponse(
      res,
      {
        periods: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
      "لیست دوره‌ها دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت دوره‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};
// ============================================
// دریافت یک دوره با شناسه
// ============================================
const getPeriodById = async (req, res) => {
  try {
    const { id } = req.params;
    const period = await Period.findByPk(id, {
      include: [
        {
          model: CustomerPersonalInfo,
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
      ],
    });

    if (!period) {
      return errorResponse(res, "دوره یافت نشد", 404);
    }

    successResponse(res, period, "اطلاعات دوره دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت دوره:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی دوره
// ============================================
const updatePeriod = async (req, res) => {
  try {
    const { id } = req.params;
    const period = await Period.findByPk(id);
    if (!period) {
      return errorResponse(res, "دوره یافت نشد", 404);
    }

    // فقط فیلدهایی که ارسال شده‌اند را به‌روز می‌کنیم
    const updateData = {};
    const allowedFields = ["period_name", "start_date", "end_date", "status"];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // اگر start_date یا end_date تغییر کرده، اعتبارسنجی ویژه انجام دهیم
    if (updateData.start_date || updateData.end_date) {
      const mergedData = { ...period.toJSON(), ...updateData };
      const validation = validatePeriodData(mergedData);
      if (!validation.isValid) {
        return errorResponse(res, validation.errors[0], 400, validation.errors);
      }
    }

    // اگر customer_personal_information_id تغییر کرده، بررسی کنیم
    if (req.body.customer_personal_information_id) {
      const customer = await CustomerPersonalInfo.findOne({
        where: { id: req.body.customer_personal_information_id, active: true },
      });
      if (!customer) {
        return errorResponse(res, "مشتری معتبر یافت نشد", 404);
      }
      updateData.customer_personal_information_id =
        req.body.customer_personal_information_id;
    }

    await period.update(updateData);
    successResponse(res, period, "دوره با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا در بروزرسانی دوره:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف منطقی دوره (تغییر وضعیت به cancelled)
// ============================================
// ============================================
// حذف منطقی دوره (تغییر وضعیت به cancelled) + غیرفعال کردن گله‌ها
// ============================================
const deletePeriod = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    // 1. پیدا کردن دوره
    const period = await Period.findByPk(id, { transaction });
    if (!period) {
      await transaction.rollback();
      return errorResponse(res, "دوره یافت نشد", 404);
    }

    // فقط در صورتی که دوره در وضعیت active یا pending باشد، می‌توان آن را لغو کرد
    if (period.status === "completed") {
      await transaction.rollback();
      return errorResponse(res, "دوره تکمیل شده قابل لغو نیست", 400);
    }
    if (period.status === "cancelled") {
      await transaction.rollback();
      return errorResponse(res, "دوره قبلاً لغو شده است", 400);
    }

    // 2. پیدا کردن گله‌های فعال این دوره
    const ChickPlacement = require("../models/ChickPlacement");
    const activeFlocks = await ChickPlacement.findAll({
      where: {
        period_id: id,
        is_active: true,
      },
      transaction,
    });

    // 3. غیرفعال کردن همه گله‌های فعال این دوره
    let deactivatedCount = 0;
    for (const flock of activeFlocks) {
      await flock.update({ is_active: false }, { transaction });
      deactivatedCount++;
    }

    // 4. لغو دوره + ثبت تاریخ پایان
    await period.update(
      {
        status: "cancelled",
        end_date: new Date(), // ✅ ثبت تاریخ پایان هنگام حذف
      },
      { transaction },
    );

    await transaction.commit();

    successResponse(
      res,
      {
        periodId: period.id,
        status: "cancelled",
        deactivatedFlocks: deactivatedCount,
      },
      `دوره با موفقیت لغو شد و ${deactivatedCount} گله غیرفعال شد`,
    );
  } catch (error) {
    await transaction.rollback();
    console.error("خطا در لغو دوره:", error);
    errorResponse(res, error.message, 500);
  }
};

// ===========دریافت آخرین شماره دوره برای یک مشتری (برای تعیین شماره دوره بعدی)==============
const getNextPeriodNumber = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await CustomerPersonalInfo.findOne({
      where: { id: customerId, active: true },
    });
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    const lastPeriod = await Period.findOne({
      where: { customer_personal_information_id: customerId },
      order: [["period_number", "DESC"]],
      attributes: ["period_number", "id"],
    });

    const nextNumber = lastPeriod ? lastPeriod.period_number + 1 : 1;
    const periodId = `P-${nextNumber.toString().padStart(3, "0")}`;
    const periodName = `دوره ${nextNumber}`;

    successResponse(
      res,
      {
        periodId, // برای نمایش: "P-001"
        periodName, // برای نمایش: "دوره 1"
        nextNumber, // عدد واقعی: 1
        lastPeriodId: lastPeriod ? lastPeriod.id : null, // id آخرین دوره (اختیاری)
      },
      "شماره دوره بعدی دریافت شد",
    );
  } catch (error) {
    console.error("خطا:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createPeriod,
  getPeriods,
  getPeriodById,
  updatePeriod,
  deletePeriod,
  getNextPeriodNumber,
};
