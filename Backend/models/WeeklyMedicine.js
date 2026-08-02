const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WeeklyMedicine = sequelize.define(
  "WeeklyMedicine",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    weekly_management_id: { type: DataTypes.INTEGER, allowNull: false },
    medicine_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر
    period_id: { type: DataTypes.INTEGER, allowNull: true },
    hall_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر
    chick_placement_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "weekly_medicines", timestamps: true, underscored: true },
);

module.exports = WeeklyMedicine;
