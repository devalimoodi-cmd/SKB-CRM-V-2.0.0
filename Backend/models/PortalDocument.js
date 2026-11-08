// ============================================================
// models/PortalDocument.js
// «مدارک من» — مدارکی که مشتری از پورتال آپلود می‌کند (موج ۱۳.۱۰)
// ------------------------------------------------------------
// 🔒 قواعد تغییرناپذیر:
//  ۱) هر کوئری روی این مدل باید با `customer_id` همراه باشد
//     (کنترلر آن را از req.customerScopeId می‌گذارد).
//  ۲) `paranoid: true` ⇒ حذف مدرک «نرم» است: ردیف از دید مشتری
//     ناپدید می‌شود ولی فایل روی دیسک می‌ماند (ممیزی کارشناس).
//     Sequelize خودش `deleted_at IS NULL` را به همهٔ کوئری‌ها
//     (از جمله count/sum سهمیه و findOne مالکیت) اضافه می‌کند.
//  ۳) `file_path` هرگز در خروجی API نمی‌آید (فقط سمت سرور).
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const PortalDocument = sequelize.define(
  "PortalDocument",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "صاحب پرونده — فقط از توکن (req.customerScopeId)",
    },
    uploaded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "کاربر آپلودکننده (بدون FK)",
    },
    title: { type: DataTypes.STRING(120), allowNull: false },
    kind: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "other",
      comment: "id_card | license | invoice | other",
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "نام اصلی — فقط نمایش",
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: false,
      comment: "مسیر نسبی داخل private/portal_documents",
    },
    file_size: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    mime_type: { type: DataTypes.STRING(100), allowNull: false },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "چه کسی حذف نرم کرد",
    },
  },
  {
    tableName: "portal_documents",
    timestamps: true,
    underscored: true,
    // ✅ حذف نرم — هم‌الگو با Hall/Unit/UnitExpert
    paranoid: true,
  },
);

module.exports = PortalDocument;
