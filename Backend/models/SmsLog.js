// ================================================================
// models/SmsLog.js - نسخه کامل با فیلدهای جدید
// ================================================================

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const SmsLog = sequelize.define(
  "SmsLog",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "customer_personal_information",
        key: "id",
      },
    },
    flock_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "شناسه گله",
    },
    week_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "شماره هفته",
    },
    mobile: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: { msg: "شماره موبایل الزامی است" },
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: { msg: "متن پیام الزامی است" },
      },
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "نوع پیام: reminder, week_reminder, confirmation, etc",
    },
    template_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "شناسه قالب استفاده شده",
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: "pending",
      validate: {
        isIn: [["pending", "sent", "delivered", "failed", "cancelled"]],
      },
    },
    delivery_state: {
      type: DataTypes.SMALLINT, // ✅ به جای TINYINT
      allowNull: true,
      comment:
        "وضعیت تحویل از سرویس: 1=رسیده, 2=نرسیده, 3=رسیده به مخابرات, ...",
    },
    message_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: "شناسه پیامک از سرویس",
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "خطا در صورت وجود",
    },
    sent_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
    },
    sent_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "sms_logs",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["customer_id"] },
      { fields: ["flock_id"] },
      { fields: ["mobile"] },
      { fields: ["status"] },
      { fields: ["sent_by"] },
      { fields: ["sent_at"] },
      { fields: ["message_id"] },
    ],
  },
);

module.exports = SmsLog;
