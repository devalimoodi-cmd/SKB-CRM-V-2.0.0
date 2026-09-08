const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// ================================================================
// AppSetting - تنظیمات سراسری برنامه (key/value)
// ================================================================
const AppSetting = sequelize.define(
  "AppSetting",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "کلید تنظیم (مثلاً auto_welcome_sms)",
    },
    value: {
      type: DataTypes.STRING(500),
      allowNull: false,
      defaultValue: "true",
      comment: "مقدار تنظیم (برای boolean: 'true' | 'false')",
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "id" },
      comment: "آخرین کاربری که تنظیم را تغییر داده",
    },
  },
  {
    tableName: "app_settings",
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ["key"] }],
  },
);

module.exports = AppSetting;
