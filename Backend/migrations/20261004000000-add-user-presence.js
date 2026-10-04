"use strict";

// ============================================================
//  «حضور کاربران» (Presence) — افزودن ستون users.last_seen_at
// ------------------------------------------------------------
//  • ستون TIMESTAMPTZ سبک برای «آخرین لحظهٔ فعالیت دیده‌شدهٔ کاربر»
//  • فرقش با ستون موجود online_status چیست؟
//        online_status : وضعیت صریح — هنگام ورود true، هنگام خروج false
//        last_seen_at  : آخرین فعالیت واقعی (heartbeat / هر درخواست احراز‌شده)
//    کاربر «آنلاین» است اگر «صریحاً آفلاین نباشد» و
//        (now - last_seen_at) <= PRESENCE_ONLINE_WINDOW_SECONDS
//    ⇒ باگ «آنلاین همیشه» رفع می‌شود: اگر مرورگر بسته شود، اینترنت/برق قطع شود
//      یا تب ساعت‌ها رها شود، کاربر خودبه‌خود آفلاین حساب می‌شود.
//  • idempotent است: اگر ستون/ایندکس از قبل باشد، دست نمی‌زند
//  • اجرا:   npm run db:migrate   سپس  npm run db:verify
//  • برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/db/README.md
// ============================================================

const TABLE = "users";
const COLUMN = "last_seen_at";
const INDEX_NAME = "users_last_seen_at";

const columnNames = async (queryInterface, table) => {
  const description = await queryInterface.describeTable(table);
  return Object.keys(description || {});
};

const indexNames = async (queryInterface, table) => {
  const indexes = await queryInterface.showIndex(table);
  return (indexes || []).map((index) => index.name);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await columnNames(queryInterface, TABLE);

    if (!columns.includes(COLUMN)) {
      await queryInterface.addColumn(TABLE, COLUMN, {
        // در Postgres معادل TIMESTAMPTZ است (با timezone تنظیم‌شدهٔ پروژه)
        type: Sequelize.DATE,
        allowNull: true,
        comment: "آخرین فعالیت دیده‌شدهٔ کاربر (heartbeat) — مرجعِ آنلاین‌بودن",
      });
    }

    const indexes = await indexNames(queryInterface, TABLE);
    if (!indexes.includes(INDEX_NAME)) {
      await queryInterface.addIndex(TABLE, [COLUMN], { name: INDEX_NAME });
    }
  },

  async down(queryInterface) {
    const indexes = await indexNames(queryInterface, TABLE);
    if (indexes.includes(INDEX_NAME)) {
      await queryInterface.removeIndex(TABLE, INDEX_NAME);
    }

    const columns = await columnNames(queryInterface, TABLE);
    if (columns.includes(COLUMN)) {
      await queryInterface.removeColumn(TABLE, COLUMN);
    }
  },
};
