const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WeeklyFeed = sequelize.define(
  "WeeklyFeed",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    weekly_management_id: { type: DataTypes.INTEGER, allowNull: false },
    feed_type_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر
    unit_id: { type: DataTypes.INTEGER, allowNull: true },
    hall_id: { type: DataTypes.INTEGER, allowNull: true }, // ✅ تغییر
    chick_placement_id: { type: DataTypes.INTEGER, allowNull: true },
  },
  { tableName: "weekly_feeds", timestamps: true, underscored: true },
);

module.exports = WeeklyFeed;
