"use strict";

// ============================================================
//  ترتیبی‌سازی «شمارهٔ مشتری» (customer_code)
// ------------------------------------------------------------
//  چرا؟ تا پیش از این، کد از سکوئنس `customer_code_seq` گرفته می‌شد
//  که «قبل از درج» و «بیرون از تراکنش» صدا زده می‌شد؛ چون سکانس هرگز
//  rollback نمی‌شود، هر ثبت ناموفق یا مشتری حذف‌شده یک کد را می‌سوزاند
//  و شماره‌ها غیرترتیبی می‌شدند (مثلاً ۱۰۰۰، ۱۰۰۳، ۱۰۰۵).
//
//  این مایگریشن:
//   ۱) همهٔ مشتریان را بر اساس `id` از شمارهٔ شروع (پیش‌فرض ۱۰۰۰)
//      به‌صورت پشت‌سرهم بازشماره‌گذاری می‌کند
//   ۲) ستون را NOT NULL می‌کند (دیگر هیچ مشتری بدون کد نمی‌ماند)
//   ۳) سکانس قدیمی را با max همگام می‌کند تا مسیر legacy کد تکراری نسازد
//
//  ⚠️ کدهای فعلی تغییر می‌کنند (طبق تأیید کارفرما).
//  idempotent است: اجرای دوباره همان نتیجه را می‌دهد.
//  اجرا:  npm run db:migrate     سپس  npm run db:verify
// ============================================================

const TABLE = "customer_personal_information";
const SEQUENCE = "customer_code_seq";
// جابه‌جایی موقت برای اینکه در میانهٔ بازشماره‌گذاری با ایندکس یکتا تداخل نشود
const TEMP_OFFSET = 1000000;

const tableNames = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName));
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await tableNames(queryInterface);
    if (!existing.includes(TABLE)) return;

    const columns = await queryInterface.describeTable(TABLE);
    if (!columns.customer_code) {
      await queryInterface.addColumn(TABLE, "customer_code", {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment:
          "شمارهٔ مشتری (کسب‌وکاری) - ترتیبی و پایدار؛ هرگز بازاستفاده نمی‌شود",
      });
    }

    const start = Number(process.env.CUSTOMER_CODE_START || 1000);
    const startNumber = Number.isFinite(start) ? start : 1000;
    const q = queryInterface.sequelize;

    // ۱) جابه‌جایی موقت همهٔ کدهای موجود (خارج از بازهٔ واقعی)
    await q.query(
      `UPDATE "${TABLE}" SET "customer_code" = COALESCE("customer_code", 0) + ${TEMP_OFFSET}`,
    );

    // ۲) شماره‌گذاری پشت‌سرهم از شمارهٔ شروع، بر اساس id
    await q.query(
      `UPDATE "${TABLE}" AS c
          SET "customer_code" = ${startNumber - 1} + t.rn
         FROM (
           SELECT id, row_number() OVER (ORDER BY id) AS rn
             FROM "${TABLE}"
         ) AS t
        WHERE c.id = t.id`,
    );

    // ۳) هیچ مشتری نباید بدون شماره بماند
    await q.query(
      `ALTER TABLE "${TABLE}" ALTER COLUMN "customer_code" SET NOT NULL`,
    );

    // ۴) همگام‌سازی سکانس قدیمی با بزرگ‌ترین شماره (برای مسیرهای legacy)
    await q.query(
      `CREATE SEQUENCE IF NOT EXISTS ${SEQUENCE} START WITH ${startNumber}`,
    );
    const [rows] = await q.query(
      `SELECT COALESCE(MAX("customer_code"), ${startNumber - 1})::int AS max_code FROM "${TABLE}"`,
    );
    const maxCode = Number(rows?.[0]?.max_code ?? startNumber - 1);
    await q.query(`SELECT setval('${SEQUENCE}', ${maxCode + 1}, false)`);
  },

  // بازشماره‌گذاری داده، بازگشت معناداری ندارد (کدهای قبلی قابل بازیابی نیستند)
  async down() {
    /* no-op */
  },
};
