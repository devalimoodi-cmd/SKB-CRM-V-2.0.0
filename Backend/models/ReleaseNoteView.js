// ============================================================
// models/ReleaseNoteView.js
// رسید دیدن یک نسخه توسط یک کاربر (برای «یک‌بار نمایش» و
// «دیگر نشان نده»). یک رکورد یکتا برای هر (نسخه، کاربر).
// ============================================================
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ReleaseNoteView = sequelize.define(
  "ReleaseNoteView",
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
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "id" },
    },
    seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    dont_show_again: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "کاربر تیک «دیگر نشان نده» را زده است",
    },
  },
  {
    tableName: "release_note_views",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["release_note_id", "user_id"], unique: true },
    ],
  },
);

module.exports = ReleaseNoteView;
