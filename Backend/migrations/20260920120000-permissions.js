"use strict";

// ============================================================
//  ایجاد جداول «سطوح دسترسی» (Roles & Permissions)
// ------------------------------------------------------------
//  • role_permissions      : استثناهای سطح دسترسی هر نقش
//  • user_permissions      : استثنای سطح دسترسی یک کاربر خاص
//  • permission_audit_logs : گزارش تغییرات سطوح دسترسی
//
//  ⭐ سیاست: کاتالوگ (Backend/config/permissions.js) منبع حقیقت است و
//     این جدول‌ها فقط «استثناها» را نگه می‌دارند؛ پس این مایگریشن
//     هیچ داده‌ای seed نمی‌کند.
//  • idempotent است: اگر جدول از قبل وجود داشته باشد، دوباره ساخته نمی‌شود
//  • اجرا:  npm run db:migrate      سپس  npm run db:verify
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/db/README.md
// ============================================================

const tableNames = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName));
};

const timestamps = (Sequelize) => ({
  created_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.fn("now"),
  },
  updated_at: {
    type: Sequelize.DATE,
    allowNull: false,
    defaultValue: Sequelize.fn("now"),
  },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await tableNames(queryInterface);

    // ===== ۱) سطح دسترسی نقش‌ها =====
    if (!existing.includes("role_permissions")) {
      await queryInterface.createTable("role_permissions", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        role: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: "super_admin | admin | sub_admin | expert | customer",
        },
        permission_key: {
          type: Sequelize.STRING(80),
          allowNull: false,
          comment: "کلید مجوز مطابق config/permissions.js",
        },
        allowed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "users.id — چه کسی تغییر داد",
        },
        ...timestamps(Sequelize),
      });

      await queryInterface.addIndex("role_permissions", ["role"], {
        name: "role_permissions_role",
      });
      await queryInterface.addIndex("role_permissions", ["permission_key"], {
        name: "role_permissions_permission_key",
      });
      await queryInterface.addIndex(
        "role_permissions",
        ["role", "permission_key"],
        { unique: true, name: "role_permissions_role_key_unique" },
      );
    }

    // ===== ۲) سطح دسترسی اختصاصی کاربر =====
    if (!existing.includes("user_permissions")) {
      await queryInterface.createTable("user_permissions", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
          comment: "users.id",
        },
        permission_key: {
          type: Sequelize.STRING(80),
          allowNull: false,
          comment: "کلید مجوز مطابق config/permissions.js",
        },
        allowed: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
        },
        updated_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "users.id — چه کسی تنظیم کرد",
        },
        ...timestamps(Sequelize),
      });

      await queryInterface.addIndex("user_permissions", ["user_id"], {
        name: "user_permissions_user_id",
      });
      await queryInterface.addIndex(
        "user_permissions",
        ["user_id", "permission_key"],
        { unique: true, name: "user_permissions_user_key_unique" },
      );
    }

    // ===== ۳) گزارش تغییرات سطوح دسترسی =====
    if (!existing.includes("permission_audit_logs")) {
      await queryInterface.createTable("permission_audit_logs", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        actor_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "users.id — انجام‌دهندهٔ تغییر",
        },
        target_type: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: "role | user",
        },
        target_id: {
          type: Sequelize.STRING(40),
          allowNull: true,
          comment: "نام نقش یا شناسهٔ کاربر",
        },
        permission_key: {
          type: Sequelize.STRING(80),
          allowNull: true,
          comment: "کلید مجوز (خالی = عملیات گروهی)",
        },
        old_value: { type: Sequelize.STRING(20), allowNull: true },
        new_value: { type: Sequelize.STRING(20), allowNull: true },
        batch_id: {
          type: Sequelize.STRING(40),
          allowNull: true,
          comment: "شناسهٔ یک ذخیرهٔ گروهی",
        },
        note: { type: Sequelize.STRING(255), allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("now"),
        },
      });

      await queryInterface.addIndex("permission_audit_logs", ["actor_id"], {
        name: "permission_audit_logs_actor_id",
      });
      await queryInterface.addIndex(
        "permission_audit_logs",
        ["target_type", "target_id"],
        { name: "permission_audit_logs_target" },
      );
      await queryInterface.addIndex("permission_audit_logs", ["created_at"], {
        name: "permission_audit_logs_created_at",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("permission_audit_logs");
    await queryInterface.dropTable("user_permissions");
    await queryInterface.dropTable("role_permissions");
  },
};
