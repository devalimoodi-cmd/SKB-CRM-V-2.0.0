// ============================================================
// models/RegistrationRequest.js
// «درخواست‌های ثبت‌نام» — صف عمومی ثبت‌نام مشتری (فاز ۱۳.۶)
// ------------------------------------------------------------
// ⚠️ این جدول «کاربر» نیست: تا تأیید مدیر هیچ ردیفی در users ساخته نمی‌شود.
// ⚠️ رمز فقط به‌صورت bcrypt hash ذخیره می‌شود (services/registrationService).
// ⚠️ بدون FK به users (هم‌الگو با LoginChallenge / ActivityLog) تا تاریخچه
//    پس از حذف کاربر/مدیر بازبین باقی بماند.
// ------------------------------------------------------------
// منطق خالص (اعتبارسنجی، فیلدهای سفید، گذارهای وضعیت) در
// services/registrationRules.js است؛ این فایل فقط تعریف ستون‌هاست.
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const RegistrationRequest = sequelize.define(
  "RegistrationRequest",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام الزامی است" },
        len: { args: [2, 100], msg: "نام باید بین 2 تا 100 کاراکتر باشد" },
      },
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام خانوادگی الزامی است" },
        len: { args: [2, 100], msg: "نام خانوادگی باید بین 2 تا 100 کاراکتر باشد" },
      },
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام کاربری الزامی است" },
        len: { args: [3, 100], msg: "نام کاربری باید حداقل 3 کاراکتر باشد" },
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "ایمیل الزامی است" },
        isEmail: { msg: "ایمیل معتبر نیست" },
      },
    },
    mobile_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: "شماره موبایل الزامی است" },
        is: { args: /^09[0-9]{9}$/, msg: "شماره موبایل معتبر نیست" },
      },
    },
    // ⚠️ هرگز رمز خام؛ همیشه bcrypt hash (قبل از create در سرویس محاسبه می‌شود)
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password_hash",
    },
    requested_customer_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "requested_customer_code",
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // ===== موج ۱۳.۷.۲ — اطلاعات پروندهٔ مشتری از فرم عمومی =====
    // ⚠️ همه NULL-پذیر: درخواست‌های قدیمی و فرم‌های ناقص نباید بشکنند.
    // ⚠️ بدون FK به customer_types (هم‌الگو با created_customer_id)؛ درستی
    //    مقدار (وجود + فعال بودن) در services/registrationService سنجیده می‌شود.
    customer_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "customer_type_id",
    },
    national_code: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "national_code",
      validate: {
        // همان قاعدهٔ CustomerPersonalInfo: فقط ۱۰ رقم عددی (بدون رقم کنترلی)
        isNationalCode(value) {
          if (value === null || value === undefined || value === "") return;
          if (!/^[0-9]{10}$/.test(String(value).trim())) {
            throw new Error("کد ملی باید ۱۰ رقم باشد");
          }
        },
      },
    },
    farm_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: "farm_name",
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    county: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: {
          args: [["pending", "approved", "rejected"]],
          msg: "وضعیت درخواست معتبر نیست",
        },
      },
    },
    reject_reason: {
      type: DataTypes.STRING(300),
      allowNull: true,
      field: "reject_reason",
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "reviewed_by",
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reviewed_at",
    },
    created_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_user_id",
    },
    // موج ۱۳.۷ — ممیزی پروندهٔ مشتری
    created_customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_customer_id",
    },
    customer_created: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "customer_created",
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "user_agent",
    },
  },
  {
    tableName: "registration_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      { name: "registration_requests_status_created_at", fields: ["status", "created_at"] },
    ],
  },
);

module.exports = RegistrationRequest;
