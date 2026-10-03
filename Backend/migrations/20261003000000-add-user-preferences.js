"use strict";

// ============================================================
//  «تنظیمات کاربر» — افزودن ستون users.preferences
// ------------------------------------------------------------
//  • ستون JSONB سبک برای تنظیمات شخصی کاربر
//    (توست، اعلان پیام‌ها، چیدمان نمودارها، تم…)
//  • idempotent است: اگر ستون موجود باشد، دست نمی‌زند
//  • اجرا:   npm run db:migrate
//  • برگشت:  npm run db:rollback
// ============================================================

const TABLE = "users";

const columnNames = async (queryInterface, table) => {
  const description = await queryInterface.describeTable(table);
  return Object.keys(description || {});
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await columnNames(queryInterface, TABLE);

    if (!columns.includes("preferences")) {
      await queryInterface.addColumn(TABLE, "preferences", {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: "تنظیمات شخصی کاربر (JSON): توست/اعلان‌ها/چیدمان نمودار/تم",
      });
    }
  },

  async down(queryInterface) {
    const columns = await columnNames(queryInterface, TABLE);

    if (columns.includes("preferences")) {
      await queryInterface.removeColumn(TABLE, "preferences");
    }
  },
};
