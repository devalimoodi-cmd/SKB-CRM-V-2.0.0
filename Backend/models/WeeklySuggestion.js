const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WeeklySuggestion = sequelize.define(
  "WeeklySuggestion",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    weekly_management_id: { type: DataTypes.INTEGER, allowNull: false },
    suggestion_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر
    unit_id: { type: DataTypes.INTEGER, allowNull: true },
    hall_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر
    chick_placement_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "weekly_suggestions", timestamps: true, underscored: true },
);

module.exports = WeeklySuggestion;
