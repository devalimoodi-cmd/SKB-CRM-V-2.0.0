const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Period = sequelize.define(
  "Period",
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
    period_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام دوره الزامی است" },
        len: { args: [3, 100], msg: "نام دوره باید بین 3 تا 100 کاراکتر باشد" },
      },
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        isDate: { msg: "تاریخ شروع معتبر نیست" },
      },
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: { msg: "تاریخ پایان معتبر نیست" },
        isAfterStartDate(value) {
          if (value && this.start_date && value <= this.start_date) {
            throw new Error("تاریخ پایان باید بعد از تاریخ شروع باشد");
          }
        },
      },
    },
    status: {
      type: DataTypes.STRING(20), // ✅ به جای ENUM
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: {
          args: [["pending", "active", "completed", "cancelled"]],
          msg: "وضعیت نامعتبر است",
        },
      },
    },
    period_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: { args: [1], msg: "شماره دوره باید حداقل 1 باشد" },
      },
    },
  },
  {
    tableName: "periods",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Period;
