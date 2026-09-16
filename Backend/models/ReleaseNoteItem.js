// ============================================================
// models/ReleaseNoteItem.js
// آیتم‌های یک «بیانیهٔ تغییرات» (دسته‌بندی‌شده)
// category: new (ویژگی جدید) | improved (بهبود) | fixed (رفع باگ) | security (امنیت)
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ReleaseNoteItem = sequelize.define(
  "ReleaseNoteItem",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    release_note_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "release_notes", key: "id" },
      comment: "نسخه‌ای که این آیتم به آن تعلق دارد",
    },
    category: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "new",
      validate: { isIn: [["new", "improved", "fixed", "security"]] },
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tag: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "برچسب کوتاه (مثل: جدید / بهبود / رفع باگ / امنیت)",
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "ترتیب نمایش داخل دستهٔ خودش",
    },
  },
  {
    tableName: "release_note_items",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ReleaseNoteItem;
