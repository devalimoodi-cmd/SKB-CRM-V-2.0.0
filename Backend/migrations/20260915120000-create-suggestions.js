"use strict";

// ============================================================
//  ایجاد جداول «نظرات و پیشنهادات» (گفتگوی کاربر ↔ ادمین)
// ------------------------------------------------------------
//  • idempotent است: اگر جدول از قبل وجود داشته باشد، دوباره ساخته نمی‌شود
//    (تا اجرای دوباره روی دیتابیس فعلی/سرور خطا ندهد)
//  • اجرا:  npm run db:migrate
// ============================================================

const tableNames = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName));
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await tableNames(queryInterface);

    if (!existing.includes("suggestions")) {
      await queryInterface.createTable("suggestions", {
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
          comment: "کاربری که گفتگو را شروع کرده است",
        },
        subject: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "suggestion",
          comment: "suggestion | complaint | bug | question | other",
        },
        title: { type: Sequelize.STRING(150), allowNull: false },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "new",
          comment: "new | in_progress | answered | closed",
        },
        admin_unread: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        user_unread: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        messages_count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
        last_message_at: { type: Sequelize.DATE, allowNull: true },
        last_sender: { type: Sequelize.STRING(10), allowNull: true },
        page_url: { type: Sequelize.STRING(300), allowNull: true },
        ip: { type: Sequelize.STRING(64), allowNull: true },
        user_agent: { type: Sequelize.STRING(300), allowNull: true },
        answered_by: { type: Sequelize.INTEGER, allowNull: true },
        answered_at: { type: Sequelize.DATE, allowNull: true },
        closed_at: { type: Sequelize.DATE, allowNull: true },
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

      await queryInterface.addIndex("suggestions", ["user_id"]);
      await queryInterface.addIndex("suggestions", ["status"]);
      await queryInterface.addIndex("suggestions", ["admin_unread"]);
      await queryInterface.addIndex("suggestions", ["user_unread"]);
      await queryInterface.addIndex("suggestions", ["last_message_at"]);
    }

    if (!existing.includes("suggestion_messages")) {
      await queryInterface.createTable("suggestion_messages", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        suggestion_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "suggestions", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        sender_type: {
          type: Sequelize.STRING(10),
          allowNull: false,
          comment: "user | admin",
        },
        sender_id: { type: Sequelize.INTEGER, allowNull: true },
        sender_name: { type: Sequelize.STRING(120), allowNull: true },
        body: { type: Sequelize.TEXT, allowNull: false },
        read_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "زمان خواندن توسط طرف مقابل (رسید خواندن)",
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("now"),
        },
      });

      await queryInterface.addIndex("suggestion_messages", ["suggestion_id"]);
      await queryInterface.addIndex("suggestion_messages", ["created_at"]);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("suggestion_messages");
    await queryInterface.dropTable("suggestions");
  },
};
