const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Vaccine = sequelize.define(
  "Vaccine",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: "این نام قبلاً ثبت شده است" },
      validate: { notEmpty: { msg: "نام واکسن الزامی است" } },
    },
    trade_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "trade_name",
    },
    manufacturer: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    vaccine_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "زنده, کشته, تخفیف حدت یافته, نوترکیب",
    },
    administration_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "قطره چشمی, آشامیدنی, تزریقی, اسپری",
    },
    target_disease: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "بیماری هدف (مثل نیوکاسل، گامبورو، برونشیت)",
    },
    age_days: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "سن توصیه شده برای تزریق (مثلاً ۱-۷ روزگی)",
    },
    booster_needed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "booster_needed",
    },
    booster_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "فاصله تا دوز بعدی (روز)",
    },
    immunity_duration: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "مدت زمان ایمنی (روز)",
    },
    storage_temp: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "دمای نگهداری (مثلاً ۲-۸ درجه)",
    },
    dilution_ratio: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "نسبت رقیق‌سازی",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    precautions: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "نکات احتیاطی",
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "vaccines",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Vaccine;
