const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const PeriodStatus = sequelize.define(
  "PeriodStatus",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: { msg: "این نام قبلاً ثبت شده است" },
      validate: { notEmpty: { msg: "نام وضعیت الزامی است" } },
    },
    description: { type: DataTypes.TEXT, allowNull: true },
    color: { type: DataTypes.STRING(20), defaultValue: "#6c757d" },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { tableName: "period_statuses", timestamps: true, underscored: true },
);

module.exports = PeriodStatus;
