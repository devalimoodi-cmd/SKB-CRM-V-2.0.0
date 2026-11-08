// ============================================================
// services/registrationService.js
// هستهٔ دادهٔ «ثبت‌نام عمومی + صف تأیید» — فاز ۱۳.۶
// ------------------------------------------------------------
// نقش این سرویس:
//   ۱) ساخت درخواست (هش رمز + بررسی تکراری‌ها)
//   ۲) فهرست/شمارش صف برای منوی مدیر
//   ۳) تأیید (در تراکنش: ساخت کاربر مشتری + بستن درخواست)
//   ۴) رد (با دلیل اجباری)
// ------------------------------------------------------------
// 🔒 تصمیم‌های امنیتی (غیرقابل مذاکره):
//   • رمز خام هرگز ذخیره/لاگ نمی‌شود؛ فقط bcrypt(10) در password_hash.
//   • کاربر ساخته‌شده **همیشه** role="customer" و status="active" است و
//     `customer_id` آن **اجباری** است (مشتریِ فعالِ بی‌پرونده = پورتال ۴۰۳).
//   • چون `users.password` در hook مدل User هش می‌شود، ساخت کاربر در تأیید
//     با `hooks: false` انجام می‌شود تا هشِ موجود دوباره هش نشود.
//   • تأیید/رد با «کِلِیم اتمیک» (UPDATE ... WHERE status='pending') انجام
//     می‌شود ⇒ دو مدیر همزمان هرگز دو حساب از یک درخواست نمی‌سازند.
//   • هر خطا fail-closed است و تراکنش را برمی‌گرداند (بدون حساب نیمه‌کاره).
// ============================================================
"use strict";

const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const RegistrationRequest = require("../models/RegistrationRequest");
const User = require("../models/User");
const CustomerPersonalInfo = require("../models/CustomerPersonalInfo");
const CustomerType = require("../models/CustomerType");
const { sequelize } = require("../config/database");
const rules = require("./registrationRules");

const HASH_ROUNDS = 10;

// پیام‌های تکراری (یک‌جا، تا کنترلر و تست هم‌منبع باشند)
const DUPLICATE_MESSAGES = {
  email: "این ایمیل قبلاً ثبت شده است",
  username: "این نام کاربری قبلاً ثبت شده است",
  mobile_number: "این شماره موبایل قبلاً ثبت شده است",
};

const PENDING_EXISTS_MESSAGE =
  "درخواست ثبت‌نام شما با همین اطلاعات در حال بررسی است؛ لطفاً منتظر تأیید بمانید";

// آیا خطای Sequelize مربوط به ایندکس یکتای جزئی صف است؟
const isPendingUniqueViolation = (error) =>
  error?.name === "SequelizeUniqueConstraintError" &&
  /registration_requests_pending_/.test(
    String(error?.parent?.constraint || error?.original?.constraint || ""),
  );

// آیا خطای Sequelize مربوط به یکتایی کاربران است؟ (کدام فیلد؟)
const userDuplicateField = (error) => {
  const fields = error?.fields || {};
  const constraint = String(
    error?.parent?.constraint || error?.original?.constraint || "",
  );
  if (Object.prototype.hasOwnProperty.call(fields, "customer_id")) return "customer_id";
  if (Object.prototype.hasOwnProperty.call(fields, "email")) return "email";
  if (Object.prototype.hasOwnProperty.call(fields, "username")) return "username";
  if (Object.prototype.hasOwnProperty.call(fields, "mobile_number")) {
    return "mobile_number";
  }
  if (/customer_id/.test(constraint)) return "customer_id";
  if (/email/.test(constraint)) return "email";
  if (/username/.test(constraint)) return "username";
  if (/mobile_number/.test(constraint)) return "mobile_number";
  return "";
};

// ============================================================
// ابزارهای «پروندهٔ مشتری تازه» (موج ۱۳.۷)
// ------------------------------------------------------------
// چرا اینجا و نه در کوئری دیگری؟ چون تأیید ثبت‌نام باید **یک تراکنش**
// باشد: یا هم پروندهٔ مشتری و هم کاربر ساخته می‌شود، یا هیچ‌کدام.
// نکته: قاعدهٔ شماره‌دهی دقیقاً همان قاعدهٔ customerRegistrationController
// است (MAX(customer_code)+1 زیر قفل جدول) تا شماره‌ها یک‌دست بمانند.
// ============================================================
const CUSTOMER_CODE_START = Number(process.env.CUSTOMER_CODE_START || 1000);
const DEFAULT_CUSTOMER_BIRTHDATE = "2000-01-01";

// خطای دسته‌بندی‌شده (کد + پیام) برای نگاشت به HTTP در کنترلر
const codedError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

// شمارهٔ مشتری ترتیبی = بزرگ‌ترین شمارهٔ موجود + ۱ (زیر قفل جدول)
const nextCustomerCode = async (transaction) => {
  await sequelize.query(
    "LOCK TABLE customer_personal_information IN SHARE ROW EXCLUSIVE MODE",
    { transaction },
  );

  const [rows] = await sequelize.query(
    `SELECT COALESCE(MAX(customer_code), :start - 1) + 1 AS code
       FROM customer_personal_information`,
    { replacements: { start: CUSTOMER_CODE_START }, transaction },
  );

  return Number(rows?.[0]?.code);
};

// ایمیل آزاد برای پروندهٔ تازه (ستون email یکتاست ⇒ fallback امن)
const pickCustomerEmail = async ({ preferred, mobileNumber, requestId, transaction }) => {
  const lastFour = String(mobileNumber || "").replace(/\D/g, "").slice(-4) || "0000";
  const candidates = [];
  if (preferred) candidates.push(String(preferred).trim().toLowerCase());
  candidates.push(`temp${lastFour}@temp.skb-crm.ir`);
  candidates.push(`reg${requestId}@temp.skb-crm.ir`);

  for (const candidate of candidates) {
    if (!candidate) continue;
    const taken = await CustomerPersonalInfo.findOne({
      where: { email: candidate },
      attributes: ["id"],
      transaction,
    });
    if (!taken) return candidate;
  }

  return null;
};

// ساخت پروندهٔ مشتری تازه از دادهٔ «فیلد سفید» درخواست
const createCustomerForRequest = async (values, request, reviewerId, transaction) => {
  // ۱) موبایل متقاضی نباید از قبل در پرونده‌های مشتریان باشد
  //    (اگر باشد، مدیر باید همان پرونده را انتخاب کند — نه پروندهٔ تکراری)
  const sameMobile = await CustomerPersonalInfo.findOne({
    where: { mobile_number: request.mobile_number },
    attributes: ["id"],
    transaction,
  });
  if (sameMobile) {
    throw codedError(
      "CUSTOMER_MOBILE_TAKEN",
      "این شمارهٔ موبایل از قبل در پرونده‌های مشتریان وجود دارد؛ همان پرونده را انتخاب کنید",
    );
  }

  // ۲) ایمیل آزاد (ایمیل درخواست اگر آزاد باشد، وگرنه temp/reg)
  const email = await pickCustomerEmail({
    preferred: request.email,
    mobileNumber: request.mobile_number,
    requestId: request.id,
    transaction,
  });
  if (!email) {
    throw codedError(
      "CUSTOMER_EMAIL_TAKEN",
      "ساخت پروندهٔ مشتری تازه ممکن نشد (تداخل ایمیل)؛ دوباره تلاش کنید",
    );
  }

  // ۳) شمارهٔ مشتری ترتیبی + ساخت ردیف
  const customerCode = await nextCustomerCode(transaction);

  try {
    return await CustomerPersonalInfo.create(
      {
        customer_code: customerCode,
        full_name: values.full_name,
        customer_type_id: values.customer_type_id,
        national_code: values.national_code,
        farm_name: values.farm_name,
        province: values.province,
        county: values.county,
        farm_address: values.farm_address,
        collection_name: values.collection_name,
        email,
        mobile_number: request.mobile_number,
        date_of_birth: DEFAULT_CUSTOMER_BIRTHDATE,
        active: true,
        status: "active",
        created_by: reviewerId ?? null,
        updated_by: reviewerId ?? null,
      },
      { transaction },
    );
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      const constraint = String(
        error?.parent?.constraint || error?.original?.constraint || "",
      );
      if (/mobile_number/.test(constraint)) {
        throw codedError(
          "CUSTOMER_MOBILE_TAKEN",
          "این شمارهٔ موبایل از قبل در پرونده‌های مشتریان وجود دارد؛ همان پرونده را انتخاب کنید",
        );
      }
      throw codedError(
        "CUSTOMER_EMAIL_TAKEN",
        "ساخت پروندهٔ مشتری تازه ممکن نشد (تداخل یکتایی)؛ دوباره تلاش کنید",
      );
    }

    if (error?.name === "SequelizeValidationError") {
      throw codedError(
        "CUSTOMER_INVALID",
        error.errors?.[0]?.message || "اطلاعات پروندهٔ مشتری معتبر نیست",
      );
    }

    throw error;
  }
};

// ============================================================
// ابزارهای «دیکشنری» فرم عمومی (موج ۱۳.۷.۲)
// ------------------------------------------------------------
//   • نوع مشتری: باید وجود داشته و فعال باشد (کلید customer_types)
//   • استان/شهرستان: باید در دیکشنری cities موجود و **هم‌جفت** باشند
//     (شهرستانِ استانِ دیگر پذیرفته نمی‌شود)
// ⚠️ fail-open فقط زمانی که دیکشنری cities خالی/در دسترس نیست؛ ثبت‌نام
//    عمومی نباید به‌خاطر یک جدول جانبی کاملاً قفل شود.
// ============================================================
const assertCustomerTypeActive = async (customerTypeId) => {
  const typeId = Number(customerTypeId);
  if (!Number.isInteger(typeId) || typeId <= 0) {
    return {
      ok: false,
      field: "customer_type_id",
      message: "نوع مشتری را از فهرست انتخاب کنید",
    };
  }

  const type = await CustomerType.findByPk(typeId, {
    attributes: ["id", "name", "active"],
  });
  if (!type) {
    return {
      ok: false,
      field: "customer_type_id",
      message: "نوع مشتری انتخاب‌شده یافت نشد",
    };
  }
  if (type.active === false) {
    return {
      ok: false,
      field: "customer_type_id",
      message: "نوع مشتری انتخاب‌شده غیرفعال است؛ نوع دیگری انتخاب کنید",
    };
  }

  return { ok: true };
};

// آیا دیکشنری استان/شهرستان قابل استفاده است؟ (جدول cities پر است؟)
const regionDictionaryUsable = async () => {
  try {
    const [rows] = await sequelize.query("SELECT 1 AS ok FROM cities LIMIT 1");
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    console.warn("⚠️ دیکشنری شهرها در دسترس نیست؛ بررسی استان/شهرستان رد شد:", error?.message);
    return false;
  }
};

// جفت «استان ⇒ شهرستان» باید در دیکشنری رسمی باشد
const assertRegionPair = async ({ province = null, county = null } = {}) => {
  const provinceName = String(province || "").trim();
  const countyName = String(county || "").trim();

  if (!provinceName && !countyName) return { ok: true };
  if (!provinceName && countyName) {
    return {
      ok: false,
      field: "county",
      message: "برای انتخاب شهرستان، ابتدا استان را انتخاب کنید",
    };
  }

  if (!(await regionDictionaryUsable())) return { ok: true };

  const [provinceRows] = await sequelize.query(
    "SELECT 1 AS ok FROM cities WHERE state_name = :province LIMIT 1",
    { replacements: { province: provinceName } },
  );
  if (!Array.isArray(provinceRows) || provinceRows.length === 0) {
    return {
      ok: false,
      field: "province",
      message: "استان انتخاب‌شده در فهرست رسمی استان‌ها نیست",
    };
  }

  if (!countyName) return { ok: true };

  const [countyRows] = await sequelize.query(
    "SELECT 1 AS ok FROM cities WHERE state_name = :province AND city_name = :county LIMIT 1",
    { replacements: { province: provinceName, county: countyName } },
  );
  if (!Array.isArray(countyRows) || countyRows.length === 0) {
    return {
      ok: false,
      field: "county",
      message: "شهرستان انتخاب‌شده در استان انتخابی نیست",
    };
  }

  return { ok: true };
};

// ============================================================
// ۱) ساخت درخواست ثبت‌نام
// ============================================================
const createRequest = async (values = {}, ctx = {}) => {
  // ۰) دیکشنری‌ها (موج ۱۳.۷.۲): نوع مشتری فعال + جفت استان/شهرستان معتبر
  //    (پیش از هر کوئری سنگین/هش رمز، تا خطای فیلدی سریع برگردد)
  const typeCheck = await assertCustomerTypeActive(values.customer_type_id);
  if (!typeCheck.ok) return typeCheck;

  const regionCheck = await assertRegionPair({
    province: values.province,
    county: values.county,
  });
  if (!regionCheck.ok) return regionCheck;

  // ۱-الف) تکراری بودن مقابل حساب‌های موجود
  const existingUser = await User.findOne({
    where: {
      [Op.or]: [
        { email: values.email },
        { username: values.username },
        { mobile_number: values.mobile_number },
      ],
    },
    attributes: ["id", "email", "username", "mobile_number"],
  });

  if (existingUser) {
    if (existingUser.email === values.email) {
      return { ok: false, field: "email", message: DUPLICATE_MESSAGES.email };
    }
    if (existingUser.username === values.username) {
      return { ok: false, field: "username", message: DUPLICATE_MESSAGES.username };
    }
    return {
      ok: false,
      field: "mobile_number",
      message: DUPLICATE_MESSAGES.mobile_number,
    };
  }

  // ۱-ب) تکراری بودن مقابل درخواست‌های «باز» (صف)
  const pendingRequest = await RegistrationRequest.findOne({
    where: {
      status: rules.STATUS.PENDING,
      [Op.or]: [
        { email: values.email },
        { username: values.username },
        { mobile_number: values.mobile_number },
      ],
    },
    attributes: ["id", "email", "username", "mobile_number"],
  });

  if (pendingRequest) {
    return { ok: false, field: "pending", message: PENDING_EXISTS_MESSAGE };
  }

  // ۱-ج) هش رمز (تنها جایی که رمز خام لمس می‌شود)
  const password_hash = await bcrypt.hash(String(values.password), HASH_ROUNDS);

  const row = {
    ...rules.buildRequestRow(values, ctx),
    password_hash,
  };

  try {
    const request = await RegistrationRequest.create(row);
    return { ok: true, request };
  } catch (error) {
    // مسابقهٔ همزمان روی ایندکس یکتای جزئی ⇒ همان پیام «در حال بررسی»
    if (isPendingUniqueViolation(error)) {
      return { ok: false, field: "pending", message: PENDING_EXISTS_MESSAGE };
    }
    throw error;
  }
};

// ============================================================
// ۲) فهرست و شمارش صف (منوی مدیر)
// ============================================================
const listRequests = async ({ status = null, limit = 20, offset = 0 } = {}) => {
  const where = {};
  if (status) where.status = status;

  const { rows, count } = await RegistrationRequest.findAndCountAll({
    where,
    // مرتب‌سازی بر اساس «تازه‌ترین»؛ صف پیش‌فرض فقط pending را نشان می‌دهد
    // (فیلتر وضعیت در query انجام می‌شود، نه با ترتیب حروف الفبا)
    order: [["created_at", "DESC"]],
    limit,
    offset,
  });

  return { rows, count };
};


// ============================================================
// ۳) تأیید درخواست → ساخت کاربر مشتری (تراکنشی)
// ------------------------------------------------------------
// ورودی: { id, reviewerId, customerId }
// خروجی: { ok:true, user, request } یا { ok:false, code, message }
//   code: NOT_FOUND | ALREADY_REVIEWED | INVALID_CUSTOMER | CUSTOMER_NOT_FOUND
//         | DUPLICATE_* | CUSTOMER_LINK_TAKEN | INVALID_STATE
// ============================================================
const approveRequest = async ({
  id,
  reviewerId,
  customerId,
  customerMode = rules.CUSTOMER_MODE.EXISTING,
  newCustomer = null,
} = {}) => {
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, code: "NOT_FOUND", message: "درخواست یافت نشد" };
  }

  // حالت پروندهٔ مشتری: موجود (existing) یا ساخت پروندهٔ تازه (new)
  const mode = rules.normalizeCustomerMode(customerMode);
  if (!mode) {
    return {
      ok: false,
      code: "INVALID_MODE",
      message: "حالت پروندهٔ مشتری نامعتبر است",
    };
  }
  const creatingCustomer = mode === rules.CUSTOMER_MODE.NEW;

  let newCustomerValues = null;

  if (creatingCustomer) {
    // ۰) درخواست باید هنوز pending باشد (پیش‌بررسی قبل از تراکنش)
    const pending = await RegistrationRequest.findByPk(requestId);
    if (!pending || pending.status !== rules.STATUS.PENDING) {
      return {
        ok: false,
        code: "ALREADY_REVIEWED",
        message: "این درخواست وجود ندارد یا قبلاً بررسی شده است",
      };
    }

    // ۱) اعتبارسنجی خالص دادهٔ پروندهٔ تازه (پیش از باز کردن تراکنش)
    const checked = rules.validateNewCustomer(newCustomer, pending);
    if (!checked.ok) {
      return {
        ok: false,
        code: "INVALID_NEW_CUSTOMER",
        message: "اطلاعات پروندهٔ مشتری تازه کامل نیست",
        errors: checked.errors,
      };
    }

    // ۲) نوع مشتری باید وجود داشته و فعال باشد
    const customerType = await CustomerType.findByPk(checked.values.customer_type_id, {
      attributes: ["id", "active"],
    });
    if (!customerType) {
      return {
        ok: false,
        code: "CUSTOMER_TYPE_NOT_FOUND",
        message: "نوع مشتری انتخاب‌شده یافت نشد",
      };
    }
    if (customerType.active === false) {
      return {
        ok: false,
        code: "CUSTOMER_TYPE_INACTIVE",
        message: "نوع مشتری انتخاب‌شده غیرفعال است؛ نوع دیگری انتخاب کنید",
      };
    }

    newCustomerValues = checked.values;
  } else {
    const customer = Number(customerId);
    if (!Number.isInteger(customer) || customer <= 0) {
      return {
        ok: false,
        code: "INVALID_CUSTOMER",
        message:
          "برای تأیید، انتخاب پروندهٔ مشتری الزامی است (بدون پرونده، پورتال مشتری قابل استفاده نیست)",
      };
    }

    const customerProfile = await CustomerPersonalInfo.findByPk(customer, {
      attributes: ["id"],
    });
    if (!customerProfile) {
      return {
        ok: false,
        code: "CUSTOMER_NOT_FOUND",
        message: "پروندهٔ مشتری با این شناسه یافت نشد",
      };
    }
  }

  let transaction = null;
  try {
    transaction = await sequelize.transaction();

    // کِلِیم اتمیک: فقط اگر هنوز pending باشد می‌توانیم جلو برویم
    const [claimed] = await RegistrationRequest.update(
      { status: rules.STATUS.APPROVED },
      { where: { id: requestId, status: rules.STATUS.PENDING }, transaction },
    );

    if (!claimed) {
      await transaction.rollback();
      transaction = null;
      return {
        ok: false,
        code: "ALREADY_REVIEWED",
        message: "این درخواست وجود ندارد یا قبلاً بررسی شده است",
      };
    }

    const request = await RegistrationRequest.findByPk(requestId, { transaction });

    // ── پروندهٔ مشتری (موج ۱۳.۷) ──────────────────────────────
    // existing → همان customer_id انتخاب مدیر
    // new      → ساخت پروندهٔ تازه از دادهٔ فیلد سفید (در همین تراکنش)
    let customer = null;
    let customerCreated = false;

    if (creatingCustomer) {
      const createdCustomer = await createCustomerForRequest(
        newCustomerValues,
        request,
        reviewerId,
        transaction,
      );
      customer = createdCustomer.id;
      customerCreated = true;
    } else {
      customer = Number(customerId);
    }

    // ⚠️ hooks:false عمدی است — رمز از قبل bcrypt شده و نباید دوباره هش شود
    const user = await User.create(
      {
        first_name: request.first_name,
        last_name: request.last_name,
        username: request.username,
        email: request.email,
        mobile_number: request.mobile_number,
        password: request.password_hash,
        role: "customer",
        status: "active",
        customer_id: customer,
        created_by: reviewerId ?? null,
        updated_by: reviewerId ?? null,
      },
      { transaction, hooks: false },
    );

    await request.update(
      rules.approvalPatch({
        reviewerId,
        userId: user.id,
        customerId: customer,
        customerCreated,
        now: new Date(),
      }),
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    return { ok: true, user, request, customerId: customer, customerCreated };
  } catch (error) {
    if (transaction) await transaction.rollback();

    // خطاهای دسته‌بندی‌شدهٔ ساخت پروندهٔ مشتری تازه (موج ۱۳.۷)
    if (
      error?.code === "CUSTOMER_MOBILE_TAKEN" ||
      error?.code === "CUSTOMER_EMAIL_TAKEN" ||
      error?.code === "CUSTOMER_INVALID"
    ) {
      return { ok: false, code: error.code, message: error.message };
    }

    if (error?.name === "SequelizeUniqueConstraintError") {
      const field = userDuplicateField(error);
      if (field === "customer_id") {
        return {
          ok: false,
          code: "CUSTOMER_LINK_TAKEN",
          message: "این پروندهٔ مشتری قبلاً به حساب کاربری دیگری متصل شده است",
        };
      }
      if (field === "email" || field === "username" || field === "mobile_number") {
        return {
          ok: false,
          code: `DUPLICATE_${field.toUpperCase()}`,
          message: DUPLICATE_MESSAGES[field],
          field,
        };
      }
      return {
        ok: false,
        code: "DUPLICATE",
        message: "حسابی با این مشخصات از قبل وجود دارد",
      };
    }

    if (error?.name === "SequelizeValidationError") {
      return {
        ok: false,
        code: "INVALID_STATE",
        message: error.errors?.[0]?.message || "دادهٔ درخواست معتبر نیست",
      };
    }

    throw error;
  }
};

// ============================================================
// ۴) رد درخواست (با دلیل اجباری)
// ============================================================
const rejectRequest = async ({ id, reviewerId, reason } = {}) => {
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, code: "NOT_FOUND", message: "درخواست یافت نشد" };
  }

  const checked = rules.validateRejectReason(reason);
  if (!checked.ok) {
    return { ok: false, code: "INVALID_REASON", message: checked.message };
  }

  const [claimed] = await RegistrationRequest.update(
    rules.rejectionPatch({ reviewerId, reason: checked.value }),
    { where: { id: requestId, status: rules.STATUS.PENDING } },
  );

  if (!claimed) {
    return {
      ok: false,
      code: "ALREADY_REVIEWED",
      message: "این درخواست وجود ندارد یا قبلاً بررسی شده است",
    };
  }

  const request = await RegistrationRequest.findByPk(requestId);
  return { ok: true, request };
};

const pendingCount = () =>
  RegistrationRequest.count({ where: { status: rules.STATUS.PENDING } });

const findRequest = (id) => RegistrationRequest.findByPk(id);

module.exports = {
  HASH_ROUNDS,
  CUSTOMER_CODE_START,
  DEFAULT_CUSTOMER_BIRTHDATE,
  DUPLICATE_MESSAGES,
  PENDING_EXISTS_MESSAGE,
  isPendingUniqueViolation,
  userDuplicateField,
  nextCustomerCode,
  pickCustomerEmail,
  createCustomerForRequest,
  // دیکشنری‌های فرم عمومی (موج ۱۳.۷.۲)
  assertCustomerTypeActive,
  regionDictionaryUsable,
  assertRegionPair,
  createRequest,
  listRequests,
  pendingCount,
  findRequest,
  approveRequest,
  rejectRequest,
};
