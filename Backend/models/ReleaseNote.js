// ============================================================
// models/ReleaseNote.js
// «تغییرات جدید / What's New» — سرِ هر بیانیهٔ تغییرات (نسخه)
// آیتم‌های آن در جدول release_note_items و رسید دیدن کاربران در
// جدول release_note_views ذخیره می‌شود.
// وضعیت: draft (پیش‌نویس) | published (منتشرشده) | archived (آرشیو)
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ReleaseNote = sequelize.define(
  "ReleaseNote",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      validate: { is: /^\d+\.\d+\.\d+$/ },
      comment: "شماره نسخه، مثل: 2.1.0",
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: "تغییرات جدید",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // ✅ به‌جای ENUM از STRING استفاده می‌کنیم (سازگار با ساختار فعلی پروژه)
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "draft",
      validate: { isIn: [["draft", "published", "archived"]] },
    },
    audience: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "all",
      validate: { isIn: [["all", "customers", "experts", "admins"]] },
      comment: "مخاطب: همه | مشتریان | کارشناسان | ادمین‌ها",
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    tableName: "release_notes",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ReleaseNote;
