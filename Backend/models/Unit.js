const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Unit = sequelize.define(
  "Unit",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_personal_information_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "customer_personal_information",
        key: "id",
      },
    },
    unit_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام واحد الزامی است" },
        len: { args: [3, 100], msg: "نام واحد باید بین 3 تا 100 کاراکتر باشد" },
      },
    },
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: "طول جغرافیایی واحد",
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
      comment: "عرض جغرافیایی واحد",
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "آدرس واحد مرغداری",
    },
    hall_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: { args: [1], msg: "تعداد سالن‌ها باید حداقل 1 باشد" },
      },
      comment: "تعداد سالن‌های واحد",
    },
    manager_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "نام مدیر واحد",
    },
    manager_phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: "شماره تماس مدیر واحد",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
      comment: "فعال یا غیرفعال بودن واحد",
    },
    unit_status_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "unit_statuses",
        key: "id",
      },
      comment: "وضعیت واحد (ارجاع به جدول unit_statuses)",
    },
  },
  {
    tableName: "units",
    timestamps: true,
    underscored: true,
    paranoid: true,
    indexes: [
      {
        unique: true,
        fields: ["customer_personal_information_id", "unit_name"],
      },
    ],
  },
);

module.exports = Unit;
