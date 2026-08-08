const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Hall = sequelize.define(
  "Hall",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    hall_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    hall_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    hall_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    nominal_capacity: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    altitude_above_sea: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    hall_type_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    construction_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    service_expert_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    operator_name: {
      // ← فیلد جدید (نام اپراتور)
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    hall_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: "فعال یا غیرفعال بودن سالن",
    },
  },
  {
    tableName: "halls",
    timestamps: true,
    underscored: true,
    paranoid: true, // ← حذف منطقی (deletedAt)
    indexes: [
      {
        unique: true,
        fields: ["customer_id", "unit_id", "hall_number"],
      },
    ],
  },
);

module.exports = Hall;
