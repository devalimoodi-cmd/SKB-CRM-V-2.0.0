const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// ردیف‌های جزئیات سیستم‌های سالن: «چند نوع از هر دسته» + «تعداد هر نوع» + سایز فن‌ها
const HallSystemItem = sequelize.define(
  "HallSystemItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    system_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "hall_systems", key: "id" },
    },
    category: {
      type: DataTypes.STRING(30),
      allowNull: true,
      comment: "دسته: heating | cooling | ventilation | fan | sanitary | lighting",
    },
    type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "شناسه نوع از دیکشنری مربوط (برای فن می‌تواند خالی باشد)",
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: "تعداد از این نوع",
    },
    spec: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "مشخصه/سایز (مثلاً فن ۳۶ اینچ یا ظرفیت) — برای سازگاری داده‌های قدیمی",
    },
    size: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "اندازه/قطر فن (مثلاً ۳۶ اینچ)",
    },
    capacity: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "ظرفیت هوادهی فن (مترمکعب بر ساعت)",
    },
  },
  {
    tableName: "hall_system_items",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["system_id"] }, { fields: ["category"] }],
  },
);

module.exports = HallSystemItem;
