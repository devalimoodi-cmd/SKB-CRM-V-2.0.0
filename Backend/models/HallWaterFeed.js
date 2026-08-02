const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const HallWaterFeed = sequelize.define(
  "HallWaterFeed",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    hall_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "halls",
        key: "id",
      },
    },
    period_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "periods",
        key: "id",
      },
    },
    waterer_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "نوع آبخوری (ارجاع به دیکشنری waterer_types)",
    },
    feeder_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "نوع دانخوری (ارجاع به دیکشنری feeder_types)",
    },
    water_lines_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد خطوط آبخوری",
    },
    feed_lines_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد خطوط دانخوری",
    },
    auto_feed_system: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "سیستم دان دهی اتوماتیک (دارد/ندارد)",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "توضیحات اضافی",
    },
  },
  {
    tableName: "hall_water_feed",
    timestamps: true,
    underscored: true,
  },
);

module.exports = HallWaterFeed;
