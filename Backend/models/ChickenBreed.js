const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ChickenBreed = sequelize.define(
  "ChickenBreed",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: { msg: "این کد قبلاً ثبت شده است" },
      validate: {
        notEmpty: { msg: "کد نژاد الزامی است" },
      },
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: { msg: "این نام قبلاً ثبت شده است" },
      validate: {
        notEmpty: { msg: "نام نژاد الزامی است" },
      },
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
    tableName: "chicken_breeds",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ChickenBreed;
