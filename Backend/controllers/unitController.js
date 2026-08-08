const { sequelize } = require("../config/database");
const Unit = require("../models/Unit");
const UnitStatus = require("../models/UnitStatus");
const UnitExpert = require("../models/UnitExpert");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const Hall = require("../models/Hall");
const { validateUnitData } = require("../validations/unitValidation");
const { successResponse, errorResponse } = require("../utils/response");

// ============================================
// ایجاد واحد مرغداری جدید
// ============================================
const createUnit = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const validation = validateUnitData(req.body);
    if (!validation.isValid) {
      return errorResponse(res, validation.errors[0], 400, validation.errors);
    }

    const {
      customer_personal_information_id,
      unit_name,
      longitude,
      latitude,
      address,
      hall_count,
      manager_name,
      manager_phone,
      is_active,
      unit_status_id,
      experts = [],
    } = req.body;

    const customer = await CustomerPersonalInfo.findOne({
      where: { id: customer_personal_information_id, active: true },
    });
    if (!customer) {
      return errorResponse(res, "مشتری معتبر یافت نشد", 404);
    }

    // بررسی وضعیت واحد (اگر ارسال شده باشد)
    let finalStatusId = unit_status_id;
    if (!finalStatusId) {
      const activeStatus = await UnitStatus.findOne({
        where: { name: "active", active: true },
        transaction,
      });
      finalStatusId = activeStatus ? activeStatus.id : null;
    }

    const unit = await Unit.create(
      {
        customer_personal_information_id,
        unit_name,
        longitude: longitude || null,
        latitude: latitude || null,
        address: address || null,
        hall_count: hall_count || null,
        manager_name: manager_name || null,
        manager_phone: manager_phone || null,
        is_active: is_active !== undefined ? is_active : true,
        unit_status_id: finalStatusId,
      },
      { transaction },
    );

    // ایجاد کارشناسان واحد (اگر ارسال شده باشند)
    if (Array.isArray(experts) && experts.length > 0) {
      const expertRecords = experts.map((expert) => ({
        unit_id: unit.id,
        expert_name: expert.expert_name,
        expert_phone: expert.expert_phone || null,
        expert_role: expert.expert_role || null,
        is_active: expert.is_active !== undefined ? expert.is_active : true,
      }));
      await UnitExpert.bulkCreate(expertRecords, { transaction });
    }

    await transaction.commit();

    successResponse(
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
    await transaction.rollback();
    console.error("خطا در ایجاد واحد:", error);
    errorResponse(res, error.message, 500);
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
      page = 1,
      limit = 20,
    } = req.query;
    const where = {};

    if (customer_id) where.customer_personal_information_id = customer_id;
    if (is_active !== undefined) where.is_active = is_active === "true";

    const validSortFields = ["id", "unit_name", "created_at", "hall_count"];
    const sortField = validSortFields.includes(sort) ? sort : "id";
    const sortOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const offset = (page - 1) * limit;

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
    const { id } = req.params;
    const unit = await Unit.findByPk(id);
    if (!unit) {
      return errorResponse(res, "واحد یافت نشد", 404);
    }

    const updateData = {};
    const allowedFields = [
      "unit_name",
      "longitude",
      "latitude",
      "address",
      "hall_count",
      "manager_name",
      "manager_phone",
      "is_active",
      "unit_status_id",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // اگر unit_status_id ارسال شده، بررسی وجود آن
    if (updateData.unit_status_id) {
      const status = await UnitStatus.findByPk(updateData.unit_status_id);
      if (!status) {
        return errorResponse(res, "وضعیت واحد معتبر نیست", 400);
      }
    }

    await unit.update(updateData);
    successResponse(res, unit, "واحد با موفقیت بروزرسانی شد");
  } catch (error) {
    console.error("خطا در بروزرسانی واحد:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف منطقی واحد
// ============================================
const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findByPk(id);
    if (!unit) {
      return errorResponse(res, "واحد یافت نشد", 404);
    }

    await unit.destroy(); // حذف منطقی (deleted_at پر می‌شود)

    successResponse(res, null, "واحد با موفقیت حذف شد (حذف منطقی)");
  } catch (error) {
    console.error("خطا در حذف واحد:", error);
    errorResponse(res, error.message, 500);
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

    if (!expert_name) {
      return errorResponse(res, "نام کارشناس الزامی است", 400);
    }

    const unit = await Unit.findByPk(unitId);
    if (!unit) return errorResponse(res, "واحد یافت نشد", 404);

    const expert = await UnitExpert.create({
      unit_id: unitId,
      expert_name,
      expert_phone: expert_phone || null,
      expert_role: expert_role || null,
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
