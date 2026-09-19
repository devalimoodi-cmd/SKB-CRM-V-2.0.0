const CustomerPersonalInfo = require("../models/CustomerPersonalInfo.js");
const User = require("../models/User.js");
const CustomerType = require("../models/CustomerType.js");
const {
  validateCustomerData,
  toEnglishDigits,
} = require("../validations/customerValidation.js");
const { Op } = require("sequelize");
const { successResponse, errorResponse } = require("../utils/response");
// ✅ جستجوی زندهٔ لیست مشتریان (نرمال‌سازی فارسی + ستون‌محور)
const {
  buildCustomerSearchWhere,
} = require("../utils/search.js");

const sequelize = CustomerPersonalInfo.sequelize;

// ✅ شمارهٔ مشتری از این عدد شروع میشود (ترتیبی و پشت‌سرهم)
const CUSTOMER_CODE_START = Number(process.env.CUSTOMER_CODE_START || 1000);
// تعداد تلاش مجدد در صورت تداخل همزمانیِ شماره
const CUSTOMER_CODE_ATTEMPTS = 3;

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
// نرمال‌سازی کد ملی
// ارقام فارسی/عربی → انگلیسی، حذف فاصله و خط تیره
// خروجی: رشته ۱۰ رقمی یا null (اگر خالی باشد)
// ============================================
function normalizeNationalCode(value) {
  if (value === null || value === undefined) return null;
  const digits = toEnglishDigits(String(value)).replace(/\D/g, "");
  if (digits === "") return null;
  return digits.slice(0, 10);
}

// ============================================
// بررسی معتبر بودن «نوع مشتری» (وجود + فعال بودن)
// خروجی: { ok, message?, value? }
// ============================================
async function resolveCustomerType(customerTypeId) {
  if (
    customerTypeId === undefined ||
    customerTypeId === null ||
    String(customerTypeId).trim() === ""
  ) {
    return { ok: false, message: "فیلد 'نوع مشتری' الزامی است" };
  }

  const id = Number(toEnglishDigits(String(customerTypeId)).trim());
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "فیلد 'نوع مشتری' باید از فهرست انتخاب شود" };
  }

  const customerType = await CustomerType.findByPk(id);
  if (!customerType) {
    return { ok: false, message: "نوع مشتری انتخاب‌شده یافت نشد" };
  }
  if (customerType.active === false) {
    return {
      ok: false,
      message: "نوع مشتری انتخاب‌شده غیرفعال است؛ نوع دیگری انتخاب کنید",
    };
  }

  return { ok: true, value: customerType.id };
}

// ============================================
// ثبت مشتری جدید
// ============================================
const registerCustomer = async (req, res) => {
  try {
    // ✅ لاگ خلاصه و ماسک‌شده (قبلاً کل req.body چاپ می‌شد و شامل
    // داده‌های شخصی مثل موبایل/کد ملی/ایمیل در لاگ پروداکشن می‌شد)
    if (process.env.NODE_ENV !== "production") {
      console.log("📝 درخواست ثبت مشتری دریافت شد:", {
        full_name: req.body?.full_name,
        mobile_number: req.body?.mobile_number
          ? `***${String(req.body.mobile_number).slice(-4)}`
          : null,
        customer_type_id: req.body?.customer_type_id ?? null,
        has_national_code: Boolean(req.body?.national_code),
      });
    }

    // 1. اعتبارسنجی داده‌ها (نوع مشتری اجباری است)
    const validation = validateCustomerData(req.body, {
      requireCustomerType: true,
    });
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

    // 2ب) بررسی معتبر بودن «نوع مشتری» انتخاب‌شده (وجود + فعال بودن)
    const customerType = await resolveCustomerType(req.body.customer_type_id);
    if (!customerType.ok) {
      return errorResponse(res, customerType.message, 400);
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
    // ✅ شمارهٔ مشتری ترتیبی = بزرگ‌ترین شمارهٔ موجود + ۱، داخل تراکنش؛
    //    پس اگر ثبت ناموفق شود هیچ شماره‌ای «سوخته» نمی‌شود
    //    (برخلاف nextval سکانس که rollback نمی‌شود).
    const customerPayload = {
      collection_name: req.body.collection_name || null,
      national_code: normalizeNationalCode(req.body.national_code),
      customer_type_id: customerType.value,
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
    };

    let customer = null;
    let lastError = null;

    for (
      let attempt = 1;
      attempt <= CUSTOMER_CODE_ATTEMPTS && !customer;
      attempt += 1
    ) {
      const transaction = await sequelize.transaction();
      try {
        // قفل جدول: از گرفتن شمارهٔ یکسان در ثبت‌های همزمان جلوگیری می‌کند
        await sequelize.query(
          "LOCK TABLE customer_personal_information IN SHARE ROW EXCLUSIVE MODE",
          { transaction },
        );

        const [codeRows] = await sequelize.query(
          `SELECT COALESCE(MAX(customer_code), :start - 1) + 1 AS code
             FROM customer_personal_information`,
          {
            replacements: { start: CUSTOMER_CODE_START },
            transaction,
          },
        );
        const customerCode = Number(codeRows?.[0]?.code);

        customer = await CustomerPersonalInfo.create(
          { ...customerPayload, customer_code: customerCode },
          { transaction },
        );

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        lastError = error;

        // فقط تداخل شماره را دوباره تلاش کن؛ بقیهٔ خطاها بالا می‌روند
        const isCodeRace =
          error?.name === "SequelizeUniqueConstraintError" &&
          String(error?.errors?.[0]?.path || "").includes("customer_code");
        if (!isCodeRace) throw error;

        console.warn(
          `⚠️ تلاش ${attempt}: شمارهٔ مشتری تکراری شد؛ دوباره تلاش می‌شود`,
        );
      }
    }

    if (!customer) {
      throw lastError || new Error("خطا در ثبت مشتری");
    }

    console.log(
      `✅ مشتری با موفقیت ثبت شد — شماره: ${customer.customer_code} / ID: ${customer.id}`,
    );
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
        national_code: customer.national_code,
        customer_type_id: customer.customer_type_id,
        created_by: customer.created_by,
        updated_by: customer.updated_by,
      },
      `مشتری با شماره ${customer.customer_code} با موفقیت ثبت شد`,
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
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // ✅ سقف ۱۰۰ رکورد در هر درخواست
    const offset = (page - 1) * limit;

    // ✅ جستجوی زنده: پیش‌تر پارامترهای search/searchColumn نادیده
    // گرفته می‌شدند و جدول فیلتر نمی‌شد (بودِ «سرچ کار نمی‌کند»).
    const searchWhere = buildCustomerSearchWhere(
      req.query.search,
      req.query.searchColumn,
    );

    // ✅ فیلتر مستقل «نوع مشتری» (فیلتر کنار نوار جستجو)
    // نکته: کلیدهای شرط جستجو از نوع Symbol هستند (Op.or/Op.and)، پس برای
    // تشخیص «خالی نبودن» نباید از Object.keys استفاده کرد؛ به‌جای آن فقط در
    // صورت وجود فیلتر، شرط جدید ساخته می‌شود تا فیلتر جستجو از دست نرود.
    const typeFilter = Number(req.query.customer_type_id);
    let where = searchWhere || undefined;
    if (Number.isInteger(typeFilter) && typeFilter > 0) {
      where = { ...(searchWhere || {}), customer_type_id: typeFilter };
    }

    const { count, rows } = await CustomerPersonalInfo.findAndCountAll({
      where,
      distinct: true,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "first_name", "last_name", "username"],
        },
        {
          model: CustomerType,
          as: "customer_type",
          attributes: ["id", "name"],
          required: false,
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
        {
          model: CustomerType,
          as: "customer_type",
          attributes: ["id", "name", "active"],
          required: false,
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
    // (اجباری بودن «نوع مشتری» در این مسیر جداگانه و با درنظرگرفتن
    //  مقدار فعلی مشتری بررسی می‌شود تا ویرایش مشتریان قدیمی قفل نشود)
    const validation = validateCustomerData(updateData, {
      requireCustomerType: false,
    });
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

    // ✅ بررسی «نوع مشتری» در ویرایش:
    //   • اگر در ورودی آمده باشد ⇒ باید معتبر و فعال باشد
    //   • اگر نیامده باشد و مشتری هم نوعی نداشته باشد ⇒ اجباری است
    //     (مشتریان قدیمی در اولین ویرایش باید نوع خود را تعیین کنند)
    const rawCustomerTypeId = updateData.customer_type_id;
    const sentCustomerType =
      rawCustomerTypeId !== undefined &&
      rawCustomerTypeId !== null &&
      String(rawCustomerTypeId).trim() !== "";

    if (sentCustomerType) {
      const resolvedType = await resolveCustomerType(rawCustomerTypeId);
      if (!resolvedType.ok) {
        return errorResponse(res, resolvedType.message, 400);
      }
      updateData.customer_type_id = resolvedType.value;
    } else if (!customer.customer_type_id) {
      return errorResponse(res, "فیلد 'نوع مشتری' الزامی است", 400);
    } else {
      delete updateData.customer_type_id;
    }

    // ✅ نرمال‌سازی کد ملی (در صورت ارسال؛ خالی = حذف مقدار)
    if (updateData.national_code !== undefined) {
      updateData.national_code = normalizeNationalCode(
        updateData.national_code,
      );
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
        {
          model: CustomerType,
          as: "customer_type",
          attributes: ["id", "name"],
          required: false,
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
