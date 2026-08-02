const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const VentilationType = sequelize.define(
  "VentilationType",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: "این نام قبلاً ثبت شده است" },
      validate: { notEmpty: { msg: "نام سیستم تهویه الزامی است" } },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ventilation_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "طبیعی, مکانیکی, ترکیبی, تونلی",
    },
    fan_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "محوری, گریز از مرکز, سقفی, دیواری",
    },
    air_flow_direction: {
      type: DataTypes.STRING(30),
      allowNull: true,
      comment: "افقی, عمودی, متقاطع",
    },
    automatic_control: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: "automatic_control",
    },
    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "ventilation_types",
    timestamps: true,
    underscored: true,
  },
);

module.exports = VentilationType;
