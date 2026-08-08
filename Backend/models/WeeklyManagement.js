const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WeeklyManagement = sequelize.define(
  "WeeklyManagement",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    unit_id: { type: DataTypes.INTEGER, allowNull: true },
    hall_id: { type: DataTypes.INTEGER, allowNull: false },
    chick_placement_id: { type: DataTypes.INTEGER, allowNull: false },
    week_start_date: { type: DataTypes.DATEONLY, allowNull: false },
    week_end_date: { type: DataTypes.DATEONLY, allowNull: false },
    week_number: { type: DataTypes.INTEGER, allowNull: false },
    flock_age_days: { type: DataTypes.INTEGER, allowNull: false },
    service_expert_id: { type: DataTypes.INTEGER, allowNull: true },
    daily_feed_intake: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    weekly_feed_intake: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    weekly_weight: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    weekly_mortality: { type: DataTypes.INTEGER, defaultValue: 0 },
    blackout_hours: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 24,
        isDecimal: true,
      },
    },
    additional_notes: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(50), defaultValue: "active" },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    tableName: "weekly_management",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["chick_placement_id", "week_number"],
        name: "unique_week_per_flock",
      },
    ],
  },
);

module.exports = WeeklyManagement;
