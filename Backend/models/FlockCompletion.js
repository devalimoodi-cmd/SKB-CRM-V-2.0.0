const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const FlockCompletion = sequelize.define(
  "FlockCompletion",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    chick_placement_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    period_id: { type: DataTypes.INTEGER, allowNull: true },
    hall_id: { type: DataTypes.INTEGER, allowNull: false },
    completion_date: { type: DataTypes.DATEONLY, allowNull: false },
    completion_type: {
      type: DataTypes.STRING(50),
      defaultValue: "completed",
    },
    final_week_number: { type: DataTypes.INTEGER, allowNull: false },
    total_feed_intake: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    final_avg_weight: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    total_mortality: { type: DataTypes.INTEGER, allowNull: true },
    mortality_rate: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    production_index: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    completed_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "flock_completions",
    timestamps: true,
    underscored: true,
  },
);

module.exports = FlockCompletion;
