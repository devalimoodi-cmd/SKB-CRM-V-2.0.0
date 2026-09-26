const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// ============================================================
// user_permissions — «سطح دسترسی اختصاصی یک کاربر»
// ------------------------------------------------------------
// • فقط مواردی که با پیش‌فرض نقش تفاوت دارند اینجا ذخیره می‌شوند.
// • برای «بازگردانی به نقش» کافی است ردیف حذف شود.
// • ساخت/تغییر ساختار فقط با مایگریشن:
//   migrations/20260920120000-permissions.js
// ============================================================

const UserPermission = sequelize.define(
  "UserPermission",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "users.id",
    },
    permission_key: {
      type: DataTypes.STRING(80),
      allowNull: false,
      comment: "کلید مجوز مطابق config/permissions.js",
    },
    allowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "users.id — چه کسی این مجوز را تنظیم کرد",
    },
  },
  {
    tableName: "user_permissions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["user_id", "permission_key"],
        name: "user_permissions_user_key_unique",
      },
      { fields: ["user_id"], name: "user_permissions_user_id" },
    ],
  },
);

module.exports = UserPermission;
