const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// ============================================================
// «نوع مشتری» (گوشتی / تخم‌گذار / مرغ مادر / سایر)
// ------------------------------------------------------------
// این جدول یک «جدول دیکشنری» است و از تنظیمات سیستم
// (پنل مدیریت ← مدیریت دیکشنری) قابل کم/زیاد کردن آیتم‌ها است.
// ============================================================

const CustomerType = sequelize.define(
  "CustomerType",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: { msg: "این نام قبلاً ثبت شده است" },
      validate: { notEmpty: { msg: "نام نوع مشتری الزامی است" } },
    },
    description: { type: DataTypes.TEXT, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { tableName: "customer_types", timestamps: true, underscored: true },
);

module.exports = CustomerType;
