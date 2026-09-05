// ================================================================
// models/FlockCompletionHall.js
// ریز پایان دوره «گله» به‌ازای هر سالن (فیزیکی per سالن)
// هر گله در flock_completions یک رکورد کلی دارد + N ردیف این جدول (per سالن)
// ================================================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const FlockCompletionHall = sequelize.define(
  "FlockCompletionHall",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    flock_completion_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "flock_completions",
        key: "id",
      },
      comment: "شناسه رکورد پایان دوره گله",
    },
    flock_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "flocks",
        key: "id",
      },
    },
    chick_placement_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "chick_placements",
        key: "id",
      },
      comment: "جوجه‌ریزی همان سالن",
    },
    hall_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "سالن",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    unit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // ===== ریز اطلاعات per سالن =====
    initial_chicks_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    final_chicks_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    initial_avg_weight: {
      type: DataTypes.DECIMAL(6, 3),
      allowNull: true,
    },
    slaughter_age_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    final_week_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    total_feed_intake: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    final_avg_weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total_mortality: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    mortality_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    system_fcr: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
    },
    system_last_weight: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    system_total_feed: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
  },
  {
    tableName: "flock_completion_halls",
    timestamps: true,
    underscored: true,
    paranoid: false,
    indexes: [
      { fields: ["flock_completion_id"] },
      { fields: ["flock_id"] },
      { fields: ["chick_placement_id"] },
      { fields: ["hall_id"] },
    ],
  },
);

module.exports = FlockCompletionHall;
