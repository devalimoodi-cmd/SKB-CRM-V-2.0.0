const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const SuggestionType = sequelize.define(
  "SuggestionType",
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
      validate: { notEmpty: { msg: "نام نوع پیشنهاد الزامی است" } },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "آیکون برای نمایش در فرانت‌اند",
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "رنگ برای نمایش (مثلاً #FF0000)",
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
    tableName: "suggestion_types",
    timestamps: true,
    underscored: true,
  },
);

module.exports = SuggestionType;
