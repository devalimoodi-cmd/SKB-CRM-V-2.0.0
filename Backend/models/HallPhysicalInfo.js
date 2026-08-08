const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const HallPhysicalInfo = sequelize.define(
  "HallPhysicalInfo",
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
    unit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "units",
        key: "id",
      },
      comment: "شناسه واحد مرغداری",
    },
    length: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "طول سالن (متر)",
    },
    width: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "عرض سالن (متر)",
    },
    height: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "ارتفاع سالن (متر)",
    },
    area: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "مساحت سالن (متر مربع)",
    },
    floor_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "نوع کفپوش (ارجاع به دیکشنری floor_types)",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "توضیحات اضافی",
    },
  },
  {
    tableName: "hall_physical_info",
    timestamps: true,
    underscored: true,
  },
);

module.exports = HallPhysicalInfo;
