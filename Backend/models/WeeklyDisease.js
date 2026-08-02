const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WeeklyDisease = sequelize.define(
  "WeeklyDisease",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    weekly_management_id: { type: DataTypes.INTEGER, allowNull: false },
    disease_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر به true
    period_id: { type: DataTypes.INTEGER, allowNull: true },
    hall_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر به true
    chick_placement_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "weekly_diseases", timestamps: true, underscored: true },
);

module.exports = WeeklyDisease;
