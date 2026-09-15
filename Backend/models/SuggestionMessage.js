// ============================================================
// models/SuggestionMessage.js
// پیام‌های داخل یک گفتگوی «نظرات و پیشنهادات»
// sender_type: user (کاربر) یا admin (ادمین)
// read_at: زمان خوانده‌شدن پیام توسط طرف مقابل = رسید خواندن
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const SuggestionMessage = sequelize.define(
  "SuggestionMessage",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    suggestion_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "suggestions", key: "id" },
      comment: "گفتگوی مربوطه",
    },
    sender_type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: { isIn: [["user", "admin"]] },
    },
    sender_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "شناسهٔ کاربر/ادمین فرستنده",
    },
    sender_name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "زمان خواندن توسط طرف مقابل (رسید خواندن)",
    },
  },
  {
    tableName: "suggestion_messages",
    timestamps: true,
    updatedAt: false,
    underscored: true,
  },
);

module.exports = SuggestionMessage;
