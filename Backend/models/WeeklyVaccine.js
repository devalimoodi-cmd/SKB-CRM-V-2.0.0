const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WeeklyVaccine = sequelize.define(
  "WeeklyVaccine",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    weekly_management_id: { type: DataTypes.INTEGER, allowNull: false },
    vaccine_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر
    unit_id: { type: DataTypes.INTEGER, allowNull: true },
    hall_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر
    chick_placement_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "weekly_vaccines", timestamps: true, underscored: true },
);

module.exports = WeeklyVaccine;
