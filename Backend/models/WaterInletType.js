const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WaterInletType = sequelize.define(
  "WaterInletType",
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
      validate: { notEmpty: { msg: "نام سیستم ورودی بهداشتی الزامی است" } },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "water_inlet_types",
    timestamps: true,
    underscored: true,
  },
);

module.exports = WaterInletType;
