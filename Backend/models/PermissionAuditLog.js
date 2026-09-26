const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// ============================================================
// permission_audit_logs — گزارش تغییرات سطوح دسترسی
// ------------------------------------------------------------
// هر تغییر (نقش یا کاربر) یک ردیف می‌سازد: چه کسی، چه چیزی،
// از چه مقداری به چه مقداری و در کدام «دستهٔ ذخیره» (batch_id).
// فقط created_at دارد (ردیف‌ها هرگز ویرایش نمی‌شوند).
// ============================================================

const PermissionAuditLog = sequelize.define(
  "PermissionAuditLog",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    actor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "users.id — انجام‌دهندهٔ تغییر",
    },
    target_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "role | user",
    },
    target_id: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment: "نام نقش یا شناسهٔ کاربر",
    },
    permission_key: {
      type: DataTypes.STRING(80),
      allowNull: true,
      comment: "کلید مجوز (خالی = عملیات گروهی مثل بازنشانی کل)",
    },
    old_value: { type: DataTypes.STRING(20), allowNull: true },
    new_value: { type: DataTypes.STRING(20), allowNull: true },
    batch_id: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment: "شناسهٔ یک ذخیرهٔ گروهی (چند کلید با هم)",
    },
    note: { type: DataTypes.STRING(255), allowNull: true },
  },
  {
    tableName: "permission_audit_logs",
    timestamps: true,
    updatedAt: false,
    underscored: true,
    indexes: [
      { fields: ["actor_id"], name: "permission_audit_logs_actor_id" },
      {
        fields: ["target_type", "target_id"],
        name: "permission_audit_logs_target",
      },
      { fields: ["created_at"], name: "permission_audit_logs_created_at" },
    ],
  },
);

module.exports = PermissionAuditLog;
