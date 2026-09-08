const CustomerPersonalInfo = require("../models/CustomerPersonalInfo.js");
const User = require("../models/User.js");
const {
  validateCustomerData,
} = require("../validations/customerValidation.js");
const { Op } = require("sequelize");
const { successResponse, errorResponse } = require("../utils/response");

// ============================================
// مقدار پیش‌فرض برای تاریخ تولد
// ============================================
const DEFAULT_BIRTHDATE = "2000-01-01";

// ============================================
// مقدار پیش‌فرض برای ایمیل
// ============================================
function getDefaultEmail(fullName, mobileNumber) {
  const lastFourDigits = mobileNumber?.replace(/\D/g, "").slice(-4) || "0000";
  return `temp${lastFourDigits}@temp.skb-crm.ir`;
}

// ============================================
// ثبت مشتری جدید
// ============================================
const registerCustomer = async (req, res) => {
  try {
    console.log("📝 دریافت درخواست ثبت مشتری:", req.body);

    // 1. اعتبارسنجی داده‌ها
    const validation = validateCustomerData(req.body);
    if (!validation.isValid) {
      return errorResponse(
        res,
        "خطا در اعتبارسنجی داده‌ها",
        400,
        validation.errors,
      );
    }

    // 2. بررسی تکراری بودن شماره موبایل
    const existingCustomer = await CustomerPersonalInfo.findOne({
      where: { mobile_number: req.body.mobile_number },
    });

    if (existingCustomer) {
      return errorResponse(
        res,
        `شماره موبایل '${req.body.mobile_number}' قبلاً ثبت شده است`,
        400,
      );
    }

    // ✅ دریافت کد پایدار مشتری از سکوئنس اختصاصی (حتی بعد از حذف رکوردها بازاستفاده نمی‌شود)
    let customerCode = null;
    try {
      const [seqRows] = await CustomerPersonalInfo.sequelize.query(
        "SELECT nextval('customer_code_seq') AS code",
      );
      customerCode = Number(seqRows?.[0]?.code);
    } catch (e) {
      console.error("❌ خطا در دریافت کد مشتری از سکوئنس:", e.message);
    }

    // ✅ دریافت userId از توکن
    const userId = req.user?.id || null;
    console.log(`👤 کاربر ثبت‌کننده: ${userId}`);

    // ✅ تنظیم ایمیل
    let email = req.body.email?.trim();
    if (!email || email === "") {
      email = getDefaultEmail(req.body.full_name, req.body.mobile_number);
      console.log(`📧 ایمیل پیش‌فرض ایجاد شد: ${email}`);
    }

    // ✅ تنظیم تاریخ تولد
    const dateOfBirth = req.body.date_of_birth || DEFAULT_BIRTHDATE;

    // ایجاد مشتری جدید
    const customer = await CustomerPersonalInfo.create({
      customer_code: customerCode,
      collection_name: req.body.collection_name || null,
      full_name: req.body.full_name,
      farm_name: req.body.farm_name,
      email: email,
      mobile_number: req.body.mobile_number,
      messaging_number: req.body.messaging_number || null,
      date_of_birth: dateOfBirth,
      experience_years: req.body.experience_years,
      education_level: req.body.education_level,
      sales_department: req.body.sales_department,
      gender: req.body.gender,
      province: req.body.province,
      county: req.body.county,
      postal_code: req.body.postal_code,
      farm_address: req.body.farm_address,
      active: true,
      status: "active",
      created_by: userId,
      updated_by: userId,
      skb_how_know: req.body.skb_how_know || null,
    });

    console.log("✅ مشتری با موفقیت ثبت شد، ID:", customer.id);
    console.log(`👤 ثبت‌کننده: ${userId}`);

    successResponse(
      res,
      {
        id: customer.id,
        customer_code: customer.customer_code,
        full_name: customer.full_name,
        email: customer.email,
        mobile_number: customer.mobile_number,
        date_of_birth: customer.date_of_birth,
        created_by: customer.created_by,
        updated_by: customer.updated_by,
      },
      `مشتری با شناسه ${customer.id} با موفقیت ثبت شد`,
      201,
    );
  } catch (error) {
    console.error("❌ خطا در ثبت مشتری:", error);

    if (error.name === "SequelizeValidationError") {
      return errorResponse(res, error.errors[0].message, 400);
    }

    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors?.[0]?.path || "اطلاعات";
      return errorResponse(res, `فیلد '${field}' قبلاً ثبت شده است`, 400);
    }

    errorResponse(res, "خطا در ثبت مشتری: " + error.message, 500);
  }
};

// ============================================
// دریافت لیست مشتری‌ها
// ============================================
const getAllCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await CustomerPersonalInfo.findAndCountAll({
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "first_name", "last_name", "username"],
        },
      ],
    });

    successResponse(
      res,
      {
        customers: rows,
        pagination: {
          total: count,
          page,
          totalPages: Math.ceil(count / limit),
          limit,
        },
      },
      "لیست مشتری‌ها دریافت شد",
    );
  } catch (error) {
    console.error("خطا در دریافت مشتری‌ها:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// حذف مشتری (فقط سوپرادمین)
// ============================================
const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ شروع حذف مشتری ${id}...`);

    // ✅ بررسی وجود مشتری
    const customer = await CustomerPersonalInfo.findByPk(id);
    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    // ✅ بررسی دسترسی - فقط سوپرادمین
    const user = req.user;
    if (!user || user.role !== "super_admin") {
      return errorResponse(
        res,
        "فقط مدیر اصلی (سوپرادمین) می‌تواند مشتری را حذف کند",
        403,
      );
    }

    // ✅ حذف با Sequelize (CASCADE خودکار)
    await customer.destroy();

    console.log(`✅ مشتری ${id} و تمام اطلاعات مرتبط حذف شدند`);

    successResponse(
      res,
      null,
      `مشتری ${id} و تمام اطلاعات مرتبط با موفقیت حذف شد`,
    );
  } catch (error) {
    console.error("❌ خطا در حذف مشتری:", error);

    if (error.name === "SequelizeForeignKeyConstraintError") {
      return errorResponse(
        res,
        `خطا در حذف: جدول ${error.table} به این رکورد وابسته است.`,
        400,
        { detail: error.message },
      );
    }

    errorResponse(res, error.message, 500);
  }
};

// ============================================
// فعال/غیرفعال کردن مشتری
// ============================================
const toggleCustomerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    // ✅ تشخیص وضعیت از body یا path
    let newStatus = active;
    if (newStatus === undefined) {
      const path = req.path;
      if (path.includes("enable")) {
        newStatus = true;
      } else if (path.includes("disable")) {
        newStatus = false;
      }
    }

    if (newStatus === undefined) {
      return errorResponse(res, "وضعیت جدید مشخص نشده است", 400);
    }

    const customer = await CustomerPersonalInfo.findByPk(id);

    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    // ✅ دریافت userId برای updated_by
    const userId = req.user?.id || null;

    await customer.update({
      active: newStatus,
      updated_by: userId,
      // updated_at به‌صورت خودکار توسط Sequelize به‌روز می‌شود
    });

    const statusText = newStatus ? "فعال" : "غیرفعال";
    successResponse(
      res,
      { id: customer.id, active: customer.active },
      `مشتری با موفقیت ${statusText} شد`,
    );
  } catch (error) {
    console.error("خطا در تغییر وضعیت مشتری:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// دریافت یک مشتری
// ============================================
const getCustomerById = async (req, res) => {
  try {
    const customer = await CustomerPersonalInfo.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
        {
          model: User,
          as: "updater",
          attributes: ["id", "first_name", "last_name", "username", "email"],
        },
      ],
    });

    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    successResponse(res, customer, "اطلاعات مشتری دریافت شد");
  } catch (error) {
    console.error("خطا در دریافت مشتری:", error);
    errorResponse(res, error.message, 500);
  }
};

// ============================================
// بروزرسانی مشتری - اصلاح شده نهایی
// ============================================
const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const customer = await CustomerPersonalInfo.findByPk(id);

    if (!customer) {
      return errorResponse(res, "مشتری یافت نشد", 404);
    }

    // ✅ اعتبارسنجی داده‌های بروزرسانی
    const validation = validateCustomerData(updateData);
    if (!validation.isValid) {
      return errorResponse(
        res,
        "خطا در اعتبارسنجی داده‌ها",
        400,
        validation.errors,
      );
    }

    // ✅ دریافت userId از توکن (کاربر لاگین شده)
    const userId = req.user?.id || null;
    console.log(`👤 کاربر بروزرسانی‌کننده: ${userId}`);

    // ✅ اگر ایمیل خالی است، مقدار پیش‌فرض بگذار
    if (!updateData.email || updateData.email.trim() === "") {
      updateData.email = getDefaultEmail(
        updateData.full_name || customer.full_name,
        updateData.mobile_number || customer.mobile_number,
      );
    }

    // ✅ اگر تاریخ تولد خالی است، مقدار پیش‌فرض بگذار
    if (!updateData.date_of_birth) {
      updateData.date_of_birth = DEFAULT_BIRTHDATE;
    }

    // ✅ بررسی تکراری نبودن موبایل
    if (updateData.mobile_number) {
      const existingCustomer = await CustomerPersonalInfo.findOne({
        where: {
          mobile_number: updateData.mobile_number,
          id: { [Op.ne]: id },
        },
      });
      if (existingCustomer) {
        return errorResponse(res, "این شماره موبایل قبلاً ثبت شده است", 400);
      }
    }

    // ✅ تنظیم updated_by
    updateData.updated_by = userId;

    // ✅ بروزرسانی (Sequelize به‌طور خودکار updated_at را به‌روز می‌کند)
    await customer.update(updateData);

    // ✅ دریافت اطلاعات بروز شده با include کامل
    const updatedCustomer = await CustomerPersonalInfo.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "first_name", "last_name", "username"],
        },
        {
          model: User,
          as: "updater",
          attributes: ["id", "first_name", "last_name", "username"],
        },
      ],
    });

    console.log(`✅ مشتری ${id} بروزرسانی شد توسط: ${userId}`);
    console.log(`📅 تاریخ بروزرسانی: ${updatedCustomer.updated_at}`);

    successResponse(
      res,
      updatedCustomer,
      "اطلاعات مشتری با موفقیت بروزرسانی شد",
    );
  } catch (error) {
    console.error("خطا در بروزرسانی مشتری:", error);

    if (error.name === "SequelizeUniqueConstraintError") {
      return errorResponse(res, "ایمیل یا شماره موبایل قبلاً ثبت شده است", 400);
    }

    errorResponse(res, error.message, 500);
  }
};
module.exports = {
  registerCustomer,
  getAllCustomers,
  deleteCustomer,
  toggleCustomerStatus,
  getCustomerById,
  updateCustomer,
};
