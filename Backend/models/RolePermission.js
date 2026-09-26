const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// ============================================================
// role_permissions — «سطح دسترسی نقش‌ها»
// ------------------------------------------------------------
// • فقط «استثناها» ذخیره می‌شوند؛ نبودِ ردیف = پیش‌فرض کاتالوگ
//   (Backend/config/permissions.js)
// • مجوز مؤثر = user_permissions ← role_permissions ← پیش‌فرض کاتالوگ
// • ساخت/تغییر ساختار فقط با مایگریشن:
//   migrations/20260920120000-permissions.js
// ============================================================

const RolePermission = sequelize.define(
  "RolePermission",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "super_admin | admin | sub_admin | expert | customer",
    },
    permission_key: {
      type: DataTypes.STRING(80),
      allowNull: false,
      comment: "کلید مجوز مطابق config/permissions.js مثل customers.delete",
    },
    allowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "users.id — چه کسی آخرین بار تغییر داد",
    },
  },
  {
    tableName: "role_permissions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["role", "permission_key"],
        name: "role_permissions_role_key_unique",
      },
      { fields: ["role"], name: "role_permissions_role" },
      { fields: ["permission_key"], name: "role_permissions_permission_key" },
    ],
  },
);

module.exports = RolePermission;
