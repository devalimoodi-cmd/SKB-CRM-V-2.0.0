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
// ۱) ساخت درخواست ثبت‌نام
// ============================================================
const createRequest = async (values = {}, ctx = {}) => {
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
const approveRequest = async ({ id, reviewerId, customerId } = {}) => {
  const requestId = Number(id);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return { ok: false, code: "NOT_FOUND", message: "درخواست یافت نشد" };
  }

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
        now: new Date(),
      }),
      { transaction },
    );

    await transaction.commit();
    transaction = null;

    return { ok: true, user, request };
  } catch (error) {
    if (transaction) await transaction.rollback();

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
  DUPLICATE_MESSAGES,
  PENDING_EXISTS_MESSAGE,
  isPendingUniqueViolation,
  userDuplicateField,
  createRequest,
  listRequests,
  pendingCount,
  findRequest,
  approveRequest,
  rejectRequest,
};
