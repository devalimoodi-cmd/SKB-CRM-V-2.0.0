const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const CustomerPersonalInfo = sequelize.define(
  "CustomerPersonalInfo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "کد پایدار مشتری (کسب‌وکاری) - از سکوئنس جداگانه و هرگز بازاستفاده نمی‌شود",
    },
    collection_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: "collection_name",
    },
    full_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: { msg: "نام و نام خانوادگی الزامی است" },
        len: { args: [3, 200], msg: "نام باید بین 3 تا 200 کاراکتر باشد" },
      },
    },
    farm_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      field: "farm_name",
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "temp@skb-crm.ir",
      validate: {
        isEmail: { msg: "ایمیل معتبر نیست" },
      },
    },
    mobile_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: { msg: "شماره موبایل الزامی است" },
        is: { args: /^[0-9]+$/, msg: "شماره موبایل باید عدد باشد" },
        len: { args: [10, 15], msg: "شماره موبایل باید بین 10 تا 15 رقم باشد" },
      },
    },
    messaging_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "messaging_number",
      validate: {
        is: { args: /^[0-9]+$/, msg: "شماره پیامرسان باید عدد باشد" },
      },
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: "2000-01-01",
      field: "date_of_birth",
    },
    experience_years: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "experience_years",
    },
    education_level: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "education_level",
    },
    sales_department: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "sales_department",
    },
    gender: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    province: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    county: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    postal_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "postal_code",
      validate: {
        is: { args: /^[0-9]+$/, msg: "کد پستی باید عدد باشد" },
      },
    },
    farm_address: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "farm_address",
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by",
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "updated_by",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
      field: "status",
    },
    skb_how_know: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "skb_how_know",
    },
  },
  {
    tableName: "customer_personal_information",
    timestamps: true, // ✅ این باید true باشد
    underscored: true, // ✅ استفاده از underscores برای نام فیلدها
    createdAt: "created_at", // ✅ نام فیلد created_at
    updatedAt: "updated_at", // ✅ نام فیلد updated_at
    indexes: [
      {
        unique: true,
        fields: ["email"],
      },
      {
        unique: true,
        fields: ["mobile_number"],
      },
      {
        fields: ["full_name"],
      },
      {
        fields: ["province"],
      },
    ],
  },
);

module.exports = CustomerPersonalInfo;
