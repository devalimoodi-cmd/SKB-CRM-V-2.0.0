// ============================================================
// models/Suggestion.js
// «نظرات و پیشنهادات» — سرِ گفتگو (thread) بین کاربر و ادمین
// هر گفتگو یک کاربر دارد (فقط کاربران لاگین‌شده) و پیام‌هایش در
// جدول suggestion_messages ذخیره می‌شود.
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Suggestion = sequelize.define(
  "Suggestion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
      comment: "کاربری که گفتگو را شروع کرده است",
    },
    // ✅ به‌جای ENUM از STRING استفاده می‌کنیم (سازگار با ساختار فعلی پروژه)
    subject: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "suggestion",
      validate: {
        isIn: [["suggestion", "complaint", "bug", "question", "other"]],
      },
      comment: "نوع پیام: پیشنهاد/انتقاد/اشکال/سؤال/سایر",
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: "خلاصهٔ پیام اول (برای نمایش در فهرست)",
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "new",
      validate: {
        isIn: [["new", "in_progress", "answered", "closed"]],
      },
    },
    // ===== رسید خواندن (دو طرفه) =====
    admin_unread: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "پیام تازه‌ای هست که ادمین نخوانده",
    },
    user_unread: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "پاسخ تازه‌ای هست که کاربر نخوانده (بج پاکت هدر)",
    },
    messages_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    last_message_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_sender: {
      type: DataTypes.STRING(10),
      allowNull: true,
      validate: { isIn: [["user", "admin"]] },
    },
    page_url: {
      type: DataTypes.STRING(300),
      allowNull: true,
      comment: "صفحه‌ای که پیام از آن ارسال شده",
    },
    ip: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(300),
      allowNull: true,
    },
    answered_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "ادمینی که پاسخ داده است",
    },
    answered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "suggestions",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Suggestion;
