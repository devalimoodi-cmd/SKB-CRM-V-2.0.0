const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const HallType = sequelize.define(
  "HallType",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: { msg: "این نام قبلاً ثبت شده است" },
      validate: {
        notEmpty: { msg: "نام نوع سالن الزامی است" },
      },
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
    tableName: "hall_types",
    timestamps: true,
    underscored: true,
  },
);

module.exports = HallType;
