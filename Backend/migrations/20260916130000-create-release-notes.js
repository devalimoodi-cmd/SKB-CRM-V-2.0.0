"use strict";

// ============================================================
//  ایجاد جداول «تغییرات جدید / What's New»
// ------------------------------------------------------------
//  • release_notes      : هر «نسخه / بیانیهٔ تغییرات»
//  • release_note_items : آیتم‌های دسته‌بندی‌شدهٔ هر نسخه
//  • release_note_views : رسید دیدن هر کاربر (+ «دیگر نشان نده»)
//  • idempotent است: اگر جدول از قبل وجود داشته باشد، دوباره ساخته نمی‌شود
//    (تا اجرای دوباره روی دیتابیس فعلی/سرور خطا ندهد)
//  • اجرا:  npm run db:migrate      سپس  npm run db:verify
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/db/README.md
// ============================================================

const tableNames = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName));
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await tableNames(queryInterface);

    // ===== ۱) نسخه‌ها / بیانیه‌های تغییرات =====
    if (!existing.includes("release_notes")) {
      await queryInterface.createTable("release_notes", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        version: {
          type: Sequelize.STRING(20),
          allowNull: false,
          unique: true,
          comment: "شماره نسخه، مثل: 2.1.0",
        },
        title: {
          type: Sequelize.STRING(150),
          allowNull: false,
          defaultValue: "تغییرات جدید",
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: "توضیح کوتاه بالای مودال",
        },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "draft",
          comment: "draft | published | archived",
        },
        audience: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "all",
          comment: "all | customers | experts | admins",
        },
        published_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "زمان انتشار (آینده = انتشار زمان‌بندی‌شده)",
        },
        created_by: { type: Sequelize.INTEGER, allowNull: true },
        updated_by: { type: Sequelize.INTEGER, allowNull: true },
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

      await queryInterface.addIndex("release_notes", ["status"]);
      await queryInterface.addIndex("release_notes", ["audience"]);
      await queryInterface.addIndex("release_notes", ["published_at"]);
    }

    // ===== ۲) آیتم‌های هر نسخه =====
    if (!existing.includes("release_note_items")) {
      await queryInterface.createTable("release_note_items", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        release_note_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "release_notes", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        category: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "new",
          comment: "new | improved | fixed | security",
        },
        title: { type: Sequelize.STRING(200), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        tag: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: "برچسب کوتاه (مثل: جدید / بهبود)",
        },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
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

      await queryInterface.addIndex("release_note_items", ["release_note_id"]);
      await queryInterface.addIndex("release_note_items", ["category"]);
    }
    // ===== ۳) رسید دیدن هر کاربر (+ «دیگر نشان نده») =====
    if (!existing.includes("release_note_views")) {
      await queryInterface.createTable("release_note_views", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        release_note_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "release_notes", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        seen_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("now"),
        },
        dont_show_again: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: "کاربر «دیگر نشان نده» را زده است",
        },
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

      await queryInterface.addIndex("release_note_views", ["release_note_id"]);
      await queryInterface.addIndex("release_note_views", ["user_id"]);
      await queryInterface.addIndex("release_note_views", ["release_note_id", "user_id"], {
        unique: true,
        name: "release_note_views_release_user_unique",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("release_note_views");
    await queryInterface.dropTable("release_note_items");
    await queryInterface.dropTable("release_notes");
  },
};
