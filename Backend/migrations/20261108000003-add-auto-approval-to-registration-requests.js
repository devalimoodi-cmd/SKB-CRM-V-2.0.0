"use strict";

// ============================================================
//  دو ستون «تأیید خودکار» روی registration_requests — موج ۱۳.۷.۳
// ------------------------------------------------------------
//  چه چیزی اضافه می‌شود؟
//    • auto_approved      : آیا این درخواست **بدون بازبینی مدیر** تأیید شد؟
//    • auto_approve_error : اگر تأیید خودکار ممکن نشد، دلیلش (برای مدیر)
// ------------------------------------------------------------
//  چرا لازم است؟
//    • با روشن‌بودن پرچم registration_auto_approve، درخواست بی‌درنگ تأیید
//      می‌شود و reviewed_by آن NULL می‌ماند؛ بدون این ستون «تأیید خودکار» از
//      «تأیید دستیِ یک مدیرِ حذف‌شده» قابل تفکیک نیست.
//    • اگر تأیید خودکار انجام نشود (مثلاً موبایل از قبل پروندهٔ مشتری دارد)
//      درخواست در صف می‌ماند و دلیلِ آن در auto_approve_error ثبت می‌شود تا
//      مدیر بداند چرا این ردیف هنوز «در انتظار» است.
//    • auto_approved پیش‌فرض false است تا همهٔ ردیف‌های موجود بی‌تغییر بمانند.
// ------------------------------------------------------------
//  idempotent است: اگر ستون‌ها موجود باشند کاری نمی‌کند.
//  اجرا:   npm run db:migrate     سپس  npm run db:verify
//  برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "registration_requests";

// آخرین ستون حذف می‌شود، اولین ستون اول اضافه می‌شود (ترتیب برگشت مهم است)
const COLUMNS = [
  {
    name: "auto_approved",
    definition: (Sequelize) => ({
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment:
        "آیا این درخواست بدون بازبینی مدیر (تأیید خودکار) تأیید شد؟ (reviewed_by در این حالت NULL است)",
    }),
  },
  {
    name: "auto_approve_error",
    definition: (Sequelize) => ({
      type: Sequelize.STRING(200),
      allowNull: true,
      comment:
        "دلیل ناموفق‌بودن تأیید خودکار (درخواست در این حالت در صف pending می‌ماند)",
    }),
  },
];

const columnNames = async (queryInterface) => {
  try {
    const description = await queryInterface.describeTable(TABLE);
    return Object.keys(description || {});
  } catch {
    // جدول هنوز ساخته نشده است (مایگریشن ۱۳.۶ اجرا نشده) ⇒ کاری برای انجام نیست
    return [];
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await columnNames(queryInterface);
    if (columns.length === 0) return;

    for (const column of COLUMNS) {
      if (columns.includes(column.name)) continue;
      await queryInterface.addColumn(TABLE, column.name, column.definition(Sequelize));
    }
  },

  async down(queryInterface) {
    const columns = await columnNames(queryInterface);
    for (const column of [...COLUMNS].reverse()) {
      if (!columns.includes(column.name)) continue;
      await queryInterface.removeColumn(TABLE, column.name);
    }
  },
};
