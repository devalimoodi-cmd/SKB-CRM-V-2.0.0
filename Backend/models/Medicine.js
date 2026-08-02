const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Medicine = sequelize.define(
  "Medicine",
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
      validate: { notEmpty: { msg: "نام دارو الزامی است" } },
    },
    generic_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "generic_name",
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "آنتی‌بیوتیک، واکسن، ضدعفونی‌کننده، مکمل، ویتامین",
    },
    manufacturer: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    dosage_form: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "خوراکی، تزریقی، محلول در آب، اسپری",
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "mg, ml, g, cc, عدد",
    },
    concentration: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "مقدار ماده موثره (مثلاً 20%)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    indication: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "موارد مصرف",
    },
    contraindication: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "موارد منع مصرف",
    },
    side_effects: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "عوارض جانبی",
    },
    withdrawal_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "دوره پرهیز از مصرف (روز)",
    },
    storage_condition: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: "شرایط نگهداری",
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
    tableName: "medicines",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Medicine;
