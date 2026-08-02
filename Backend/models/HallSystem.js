const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const HallSystem = sequelize.define(
  "HallSystem",
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
      allowNull: true, // ✅ به جای false
      references: {
        model: "periods",
        key: "id",
      },
    },
    fan_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد فن‌ها",
    },
    fan_size: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "اندازه فن‌ها (مثلاً 36 اینچ)",
    },
    fan_capacity: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "ظرفیت فن‌ها (مثلاً 20000 CFM)",
    },
    heater_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد هیترها",
    },
    heating_system_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "نوع سیستم گرمایش (ارجاع به دیکشنری heating_systems)",
    },
    cooling_system_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "نوع سیستم سرمایش (ارجاع به دیکشنری cooling_systems)",
    },
    ventilation_system_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "نوع سیستم تهویه (ارجاع به دیکشنری ventilation_systems)",
    },
    water_inlet_system_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "نوع سیستم ورودی بهداشتی (ارجاع به دیکشنری water_inlet_types)",
    },
    lighting_system_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "نوع سیستم روشنایی (ارجاع به دیکشنری lighting_systems)",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "توضیحات اضافی",
    },
  },
  {
    tableName: "hall_systems",
    timestamps: true,
    underscored: true,
  },
);

module.exports = HallSystem;
