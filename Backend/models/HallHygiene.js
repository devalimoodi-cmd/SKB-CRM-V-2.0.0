const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const HallHygiene = sequelize.define(
  "HallHygiene",
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
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "customer_personal_information",
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
    last_wash_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "آخرین تاریخ شستشو",
    },
    last_disinfect_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "آخرین تاریخ ضدعفونی",
    },
    disinfectant_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "نوع ماده ضدعفونی مصرف شده",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "توضیحات اضافی",
    },
  },
  {
    tableName: "hall_hygiene",
    timestamps: true,
    underscored: true,
  },
);

module.exports = HallHygiene;
