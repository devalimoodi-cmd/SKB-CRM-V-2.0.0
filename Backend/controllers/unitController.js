const { parsePagination } = require("../utils/pagination");
const Unit = require("../models/Unit");
const UnitStatus = require("../models/UnitStatus");
const UnitExpert = require("../models/UnitExpert");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Hall = require("../models/Hall");
const { successResponse, errorResponse } = require("../utils/response");
// ✅ موج ۱۳.۱۲: منطق نوشتن واحد به services/farm/unitWrite منتقل شد تا
//    مسیر تأیید درخواست مشتری (پورتال) هم همان قاعده را اجرا کند:
//    نام خودکار سالن‌ها، فهرست سفید ویرایش و حذف آبشاری — یک نسخه.
const unitWrite = require("../services/farm/unitWrite");
const { sendFarmError } = require("../services/farm/httpBridge");

// ============================================
// ایجاد واحد مرغداری جدید
// ============================================
const createUnit = async (req, res) => {
  try {
    const { unit, customer } = await unitWrite.createUnit(req.body);

    return successResponse(
      res,
      {
        id: unit.id,
        unit_name: unit.unit_name,
        customer_name: customer.full_name,
        is_active: unit.is_active,
      },
      "واحد مرغداری با موفقیت ایجاد شد",
      201,
    );
  } catch (error) {
    console.error("خطا در ایجاد واحد:", error);
    return sendFarmError(res, error, "خطا در ایجاد واحد");
  }
};

// ============================================
// دریافت لیست واحدها (با قابلیت فیلتر)
// ============================================
const getUnits = async (req, res) => {
  try {
    const {
      customer_id,
      is_active,
      sort = "id",
      order = "DESC",
    } = req.query;

    // ✅ صفحه‌بندی با سقف
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 20,
    });
    const where = {};

    if (customer_id) where.customer_personal_information_id = customer_id;
    if (is_active !== undefined) where.is_active = is_active === "true";

    const validSortFields = ["id", "unit_name", "created_at", "hall_count"];
    const sortField = validSortFields.includes(sort) ? sort : "id";
    const sortOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const { count, rows } = await Unit.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortField, sortOrder]],
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
        {
          model: UnitStatus,
          as: "status",
          attributes: ["id", "name", "color"],
        },
        {
          model: UnitExpert,
          as: "experts",
          attributes: [
            "id",
            "expert_name",
            "expert_phone",
            "expert_role",
            "is_active",
          ],
          required: false,
        },
      ],
    });

    successResponse(
      res,
      {
        units: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          totalPages: Math.ceil(count / limit),
          limit: parseInt(limit),
        },
      },
      "لیست واحدها دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت واحدها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت یک واحد با شناسه
// ============================================
const getUnitById = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findByPk(id, {
      include: [
        {
          model: CustomerPersonalInfo,
          as: "customer",
          attributes: ["id", "full_name", "farm_name", "mobile_number"],
        },
        {
          model: UnitStatus,
          as: "status",
          attributes: ["id", "name", "color"],
        },
        {
          model: UnitExpert,
          as: "experts",
          attributes: [
            "id",
            "expert_name",
            "expert_phone",
            "expert_role",
            "is_active",
          ],
          required: false,
        },
        {
          model: Hall,
          as: "halls",
          attributes: ["id", "hall_name", "hall_number", "is_active"],
          required: false,
        },
      ],
    });

    if (!unit) {
      return errorResponse(res, "واحد یافت نشد", 404);
    }

    successResponse(res, unit, "اطلاعات واحد دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت واحد:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی واحد
// ============================================
const updateUnit = async (req, res) => {
  try {
    const { unit, renamedHalls, unitNameChanged } = await unitWrite.updateUnit(
      req.params.id,
      req.body,
    );

    return successResponse(
      res,
      { ...unit.toJSON(), renamed_halls: renamedHalls },
      unitNameChanged && renamedHalls > 0
        ? `واحد و نام ${renamedHalls} سالن زیرمجموعه بروزرسانی شد`
        : "واحد با موفقیت بروزرسانی شد",
    );
  } catch (error) {
    console.error("خطا در بروزرسانی واحد:", error);
    return sendFarmError(res, error, "خطا در بروزرسانی واحد");
  }
};

// ============================================
// حذف واحد با حذف آبشاری کامل
// (همه سالن‌ها، گله‌ها، اطلاعات مرتبط و وابستگی‌ها حذف می‌شوند)
// ============================================
const deleteUnit = async (req, res) => {
  try {
    await unitWrite.deleteUnit(req.params.id);

    return successResponse(
      res,
      null,
      "واحد و تمام سالن‌ها و گله‌های مرتبط با موفقیت حذف شدند",
    );
  } catch (error) {
    console.error("خطا در حذف واحد:", error);
    return sendFarmError(res, error, "خطا در حذف واحد");
  }
};

// ============================================
// فعال/غیرفعال کردن واحد
// ============================================
const toggleUnitStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const unit = await Unit.findByPk(id);
    if (!unit) return errorResponse(res, "واحد یافت نشد", 404);

    await unit.update({ is_active });

    successResponse(res, unit, `واحد ${is_active ? "فعال" : "غیرفعال"} شد`);
  } catch (error) {
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// مدیریت کارشناسان واحد
// ============================================

// دریافت کارشناسان یک واحد
const getUnitExperts = async (req, res) => {
  try {
    const { unitId } = req.params;
    const unit = await Unit.findByPk(unitId);
    if (!unit) return errorResponse(res, "واحد یافت نشد", 404);

    const experts = await UnitExpert.findAll({
      where: { unit_id: unitId },
      order: [["id", "ASC"]],
    });

    successResponse(res, experts, "لیست کارشناسان واحد دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت کارشناسان واحد:", error);
    errorResponse(res, error.message, 500);
  }
};

// افزودن کارشناس به واحد
const addUnitExpert = async (req, res) => {
  try {
    const { unitId } = req.params;
    const { expert_name, expert_phone, expert_role, is_active } = req.body;

    // اعتبارسنجی کارشناس
    if (!expert_name || !expert_name.toString().trim()) {
      return errorResponse(res, "نام کارشناس الزامی است", 400);
    }
    if (expert_name.toString().length > 50) {
      return errorResponse(res, "نام کارشناس حداکثر 50 کاراکتر باشد", 400);
    }
    if (!expert_phone) {
      return errorResponse(res, "شماره تماس کارشناس الزامی است", 400);
    }
    if (!/^[0-9]{11}$/.test(String(expert_phone).replace(/\D/g, ""))) {
      return errorResponse(res, "شماره تماس کارشناس باید 11 رقم باشد", 400);
    }
    if (!expert_role || !expert_role.toString().trim()) {
      return errorResponse(res, "نقش کارشناس الزامی است", 400);
    }
    if (expert_role.toString().length > 50) {
      return errorResponse(res, "نقش کارشناس حداکثر 50 کاراکتر باشد", 400);
    }

    const unit = await Unit.findByPk(unitId);
    if (!unit) return errorResponse(res, "واحد یافت نشد", 404);

    const expert = await UnitExpert.create({
      unit_id: unitId,
      expert_name: expert_name.toString().trim(),
      expert_phone: expert_phone.toString().trim(),
      expert_role: expert_role.toString().trim(),
      is_active: is_active !== undefined ? is_active : true,
    });

    successResponse(res, expert, "کارشناس با موفقیت به واحد اضافه شد", 201);
  } catch (error) {
    console.error("خطا در افزودن کارشناس:", error);
    errorResponse(res, error.message, 500);
  }
};

// بروزرسانی کارشناس واحد
const updateUnitExpert = async (req, res) => {
  try {
    const { unitId, expertId } = req.params;
    const expert = await UnitExpert.findOne({
      where: { id: expertId, unit_id: unitId },
    });
    if (!expert) return errorResponse(res, "کارشناس یافت نشد", 404);

    const updateData = {};
    const allowedFields = [
      "expert_name",
      "expert_phone",
      "expert_role",
      "is_active",
    ];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    await expert.update(updateData);
    successResponse(res, expert, "کارشناس با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا در بروزرسانی کارشناس:", error);
    errorResponse(res, error.message, 500);
  }
};

// حذف کارشناس واحد
const deleteUnitExpert = async (req, res) => {
  try {
    const { unitId, expertId } = req.params;
    const expert = await UnitExpert.findOne({
      where: { id: expertId, unit_id: unitId },
    });
    if (!expert) return errorResponse(res, "کارشناس یافت نشد", 404);

    await expert.destroy();
    successResponse(res, null, "کارشناس با موفقیت حذف شد");
  } catch (error) {
    console.error("خطا در حذف کارشناس:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت وضعیت‌های واحد
// ============================================
const getUnitStatuses = async (req, res) => {
  try {
    const statuses = await UnitStatus.findAll({
      where: { active: true },
      order: [["sort_order", "ASC"]],
    });
    successResponse(res, statuses, "لیست وضعیت‌های واحد دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت وضعیت‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

module.exports = {
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  deleteUnit,
  toggleUnitStatus,
  getUnitExperts,
  addUnitExpert,
  updateUnitExpert,
  deleteUnitExpert,
  getUnitStatuses,
};
