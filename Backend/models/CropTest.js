const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const CropTest = sequelize.define(
  "CropTest",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "customer_personal_information",
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
    },
    hall_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "halls",
        key: "id",
      },
    },
    chick_placement_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "chick_placements",
        key: "id",
      },
    },
    test_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: "تاریخ تست معتبر نیست" },
      },
    },
    week_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    sample_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد نمونه‌ها",
    },
    empty_crop_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد چین‌دان خالی",
    },
    full_crop_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد چین‌دان پر",
    },
    abnormal_crop_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "تعداد چین‌دان غیرعادی",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "crop_test",
    timestamps: true,
    underscored: true,
  },
);

module.exports = CropTest;
