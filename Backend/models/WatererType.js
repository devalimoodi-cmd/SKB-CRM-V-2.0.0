const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WatererType = sequelize.define(
  "WatererType",
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
      validate: { notEmpty: { msg: "نام آبخوری الزامی است" } },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    waterer_category: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "نیپل, کاسه‌ای, خطی, سکویی, استوانه‌ای",
    },
    material: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "پلاستیکی, فلزی, استیل, گالوانیزه",
    },
    capacity: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "میزان ظرفیت (مثلاً 2 لیتر، 10 لیتر)",
    },
    bird_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد پرندگان پوشش داده شده توسط هر واحد",
    },
    automatic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    tableName: "waterer_types",
    timestamps: true,
    underscored: true,
  },
);

module.exports = WatererType;
