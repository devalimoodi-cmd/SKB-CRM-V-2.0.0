"use strict";

// ============================================================
//  ستون payload روی login_challenges — موج ۱۳.۸
// ------------------------------------------------------------
//  چه چیزی اضافه می‌شود؟
//    • payload (JSONB، nullable): دادهٔ همراهِ همان چالش.
// ------------------------------------------------------------
//  چرا لازم است؟
//    • از ۱۳.۸ مشتری می‌تواند شمارهٔ موبایلش را از پورتال عوض کند.
//      تغییر باید با «کد پیامکی به شمارهٔ جدید» تأیید شود، ولی جدول
//      login_challenges تا امروز جایی برای نگه‌داشتن «شمارهٔ جدیدِ
//      در انتظار تأیید» نداشت (فقط mobile_masked برای نمایش).
//    • بدون این ستون باید شمارهٔ جدید در حافظهٔ سرور نگه داشته می‌شد
//      (با ری‌استارت گم می‌شود) یا در ستون نامرتبط نوشته می‌شد (خطر
//      لو رفتن/تفسیر غلط).
//    • payload فقط با چالش‌های purpose="profile_mobile" پر می‌شود؛
//      چالش‌های ورود همان‌طور NULL می‌مانند ⇒ صفر تغییر رفتاری در ۱۳.۱.
//    • 🔒 هیچ‌گاه کد خام در payload نوشته نمی‌شود (فقط شمارهٔ جدید).
// ------------------------------------------------------------
//  idempotent است: اگر ستون موجود باشد کاری نمی‌کند.
//  اجرا:   npm run db:migrate     سپس  npm run db:verify
//  برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "login_challenges";
const COLUMN = "payload";

const columnNames = async (queryInterface) => {
  try {
    const description = await queryInterface.describeTable(TABLE);
    return Object.keys(description || {});
  } catch {
    // جدول هنوز ساخته نشده است (مایگریشن ۱۳.۱ اجرا نشده) ⇒ کاری نیست
    return [];
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await columnNames(queryInterface);
    if (columns.length === 0) return;
    if (columns.includes(COLUMN)) return;

    await queryInterface.addColumn(TABLE, COLUMN, {
      type: Sequelize.JSONB,
      allowNull: true,
      comment:
        "دادهٔ همراه چالش (فقط purpose=profile_mobile: شمارهٔ جدید در انتظار تأیید) — هرگز کد خام ذخیره نمی‌شود",
    });
  },

  async down(queryInterface) {
    const columns = await columnNames(queryInterface);
    if (!columns.includes(COLUMN)) return;
    await queryInterface.removeColumn(TABLE, COLUMN);
  },
};
