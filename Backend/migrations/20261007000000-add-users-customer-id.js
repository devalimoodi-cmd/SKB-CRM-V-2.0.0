"use strict";

// ============================================================
//  «پیوند حساب کاربر با پروندهٔ مشتری» — افزودن ستون users.customer_id
// ------------------------------------------------------------
//  • هدف (فاز ۱۳.۰): هر حساب با نقش «مشتری» بداند صاحب کدام پروندهٔ
//    مشتری است (customer_personal_information.id) تا:
//        – پس از ورود، مستقیم به «/customer-info?id=...» همان پرونده برود
//        – پورتال مشتری (فاز ۱۳.۲) و کنسول مجوز (فاز ۱۳.۴) لنگر داشته باشند
//  • یکتاست: هر پروندهٔ مشتری حداکثر یک حساب ورود دارد
//    (در Postgres چند NULL در ایندکس یکتا مجاز است ⇒ بقیهٔ نقش‌ها آزادند)
//  • ON DELETE SET NULL: حذف پروندهٔ مشتری حساب را حذف نمی‌کند؛ فقط پیوند
//    پاک می‌شود (ورود با پیام «حساب به پرونده متصل نیست» ادامه می‌یابد)
//  • idempotent است: اگر ستون/ایندکس/کلید خارجی از قبل باشد، دست نمی‌زند
//  • اجرا:   npm run db:migrate   سپس  npm run db:verify
//  • برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/db/README.md
// ============================================================

const TABLE = "users";
const COLUMN = "customer_id";
const INDEX_NAME = "users_customer_id_unique";
const FK_NAME = "users_customer_id_fk";
const TARGET_TABLE = "customer_personal_information";

const columnNames = async (queryInterface, table) => {
  const description = await queryInterface.describeTable(table);
  return Object.keys(description || {});
};

const indexNames = async (queryInterface, table) => {
  const indexes = await queryInterface.showIndex(table);
  return (indexes || []).map((index) => index.name);
};

// کلید خارجی: showConstraint در برخی نسخه‌ها برای «نبودِ» کلید خطا نمی‌دهد
// و مقدار خالی برمی‌گرداند ⇒ نبودِ آن را باور می‌کنیم. برای قطعیت از
// pg_constraint می‌پرسیم (تنها منبع حقیقت در Postgres).
const constraintExists = async (queryInterface, table, name) => {
  const [rows] = await queryInterface.sequelize.query(
    "SELECT 1 FROM pg_constraint WHERE conname = :name AND conrelid = :table::regclass",
    { replacements: { name, table } },
  );
  return Array.isArray(rows) && rows.length > 0;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await columnNames(queryInterface, TABLE);

    if (!columns.includes(COLUMN)) {
      await queryInterface.addColumn(TABLE, COLUMN, {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment:
          "پروندهٔ مشتری این حساب ورود (فقط نقش customer) — فاز ۱۳.۰",
      });
    }

    const indexes = await indexNames(queryInterface, TABLE);
    if (!indexes.includes(INDEX_NAME)) {
      await queryInterface.addIndex(TABLE, [COLUMN], {
        name: INDEX_NAME,
        unique: true,
      });
    }

    if (!(await constraintExists(queryInterface, TABLE, FK_NAME))) {
      await queryInterface.addConstraint(TABLE, {
        fields: [COLUMN],
        type: "foreign key",
        name: FK_NAME,
        references: { table: TARGET_TABLE, field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
    }
  },

  async down(queryInterface) {
    if (await constraintExists(queryInterface, TABLE, FK_NAME)) {
      await queryInterface.removeConstraint(TABLE, FK_NAME);
    }

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
