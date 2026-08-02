const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const FeederType = sequelize.define(
  "FeederType",
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
      validate: { notEmpty: { msg: "نام دستگاه دانخوری الزامی است" } },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: "feeder_types",
    timestamps: true,
    underscored: true,
  },
);

module.exports = FeederType;
