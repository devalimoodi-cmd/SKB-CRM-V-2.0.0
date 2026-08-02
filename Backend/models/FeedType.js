// models/FeedType.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const FeedType = sequelize.define(
  "FeedType",
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
      validate: { notEmpty: { msg: "نام خوراک الزامی است" } },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    feed_stage: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    protein_percentage: {
      type: DataTypes.DECIMAL(5, 2),
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
    tableName: "feed_types",
    timestamps: true,
    underscored: true,
  },
);

module.exports = FeedType;
