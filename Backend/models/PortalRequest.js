// ============================================================
// models/PortalRequest.js
// «درخواست‌های فارم» — درخواست مشتری برای ساخت واحد/سالن/جوجه‌ریزی
// موج ۱۳.۱۱ (الگوی ب: درخواست مشتری + تأیید کارشناس)
// ------------------------------------------------------------
// 🔒 قواعد تغییرناپذیر:
//  ۱) هر کوئری روی این مدل باید با `customer_id` همراه باشد
//     (کنترلر آن را از req.customerScopeId می‌گذارد) — به‌جز صف
//     کارشناس که عمداً بدون اسکوپ است و کلید مجوز جدا دارد.
//  ۲) `payload` فقط فیلدهای سفید را نگه می‌دارد؛ پاک‌سازی در
//     services/portalRequestRules انجام می‌شود، نه در کنترلر.
//  ۳) این جدول «سند تصمیم» است: حذف نداریم. درخواست لغوشده با
//     status='cancelled' می‌ماند (paranoid عمداً خاموش است).
//  ۴) هیچ ردیفی در units/halls/chick_placements تا لحظهٔ تأیید
//     ساخته نمی‌شود (خدمات در services/portalRequestService).
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const { REQUEST_STATUSES, REQUEST_TYPES } = require("../services/portalRequestRules");

const PortalRequest = sequelize.define(
  "PortalRequest",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "صاحب پرونده — فقط از توکن (req.customerScopeId)",
    },
    request_type: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        isIn: {
          args: [REQUEST_TYPES.map((item) => item.key)],
          msg: "نوع درخواست معتبر نیست",
        },
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "pending",
      validate: {
        isIn: {
          args: [REQUEST_STATUSES.map((item) => item.key)],
          msg: "وضعیت درخواست معتبر نیست",
        },
      },
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: "فیلدهای سفیدِ همان نوع (پاک‌سازی‌شده)",
    },
    submitted_by: { type: DataTypes.INTEGER, allowNull: true },
    submitted_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: "فقط ممیزی — در خروجی API نمی‌آید",
    },
    submitted_user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: "فقط ممیزی — در خروجی API نمی‌آید",
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "کارشناس/مدیر بازبین (بدون FK)",
    },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
    reject_reason: {
      type: DataTypes.STRING(300),
      allowNull: true,
      comment: "دلیل رد — به مشتری نشان داده می‌شود",
    },
    applied_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "زمان اعمال در جداول اصلی",
    },
    result_entity_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "شناسهٔ ردیف ساخته‌شده در جدول مقصد",
    },
    result_summary: {
      type: DataTypes.STRING(300),
      allowNull: true,
      comment: "خلاصهٔ نتیجه برای نمایش در پورتال",
    },
  },
  {
    tableName: "portal_requests",
    timestamps: true,
    underscored: true,
    indexes: [
      { name: "portal_requests_customer_status_created", fields: ["customer_id", "status", "created_at"] },
      { name: "portal_requests_status_created", fields: ["status", "created_at"] },
      { name: "portal_requests_type_status", fields: ["request_type", "status"] },
    ],
  },
);

module.exports = PortalRequest;
