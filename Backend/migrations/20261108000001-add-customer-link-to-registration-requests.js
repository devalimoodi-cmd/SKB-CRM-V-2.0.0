"use strict";

// ============================================================
//  دو ستون ممیزی «پروندهٔ مشتری» روی registration_requests — موج ۱۳.۷
// ------------------------------------------------------------
//  چه چیزی اضافه می‌شود؟
//    • created_customer_id : پروندهٔ مشتری‌ای که در تأیید به کاربر متصل شد
//      (یا پروندهٔ تازه‌ای که در همان تراکنش ساخته شد).
//    • customer_created    : آیا در همین تأیید پروندهٔ مشتری *تازه* ساخته شد؟
//      (true = متقاضی پرونده نداشت و مدیر «ثبت مشتری جدید» را زد)
// ------------------------------------------------------------
//  چرا لازم است؟
//    • ثبت‌نام عمومی می‌تواند دو مسیر داشته باشد: اتصال به پروندهٔ موجود یا
//      ساخت پروندهٔ تازه برای کسی که هنوز پرونده ندارد (درخواست کاربر).
//    • ممیزی بعدی باید بداند حساب هر درخواست به کدام پرونده وصل شده و
//      کدام‌ها پروندهٔ تازه ساخته‌اند (گزارش/پیگیری).
//    • بدون FOREIGN KEY (هم‌الگو با reviewed_by/created_user_id) تا تاریخچه
//      پس از حذف مشتری/کاربر باقی بماند.
// ------------------------------------------------------------
//  idempotent است: اگر ستون‌ها موجود باشند کاری نمی‌کند.
//  اجرا:   npm run db:migrate     سپس  npm run db:verify
//  برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "registration_requests";

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

    if (!columns.includes("created_customer_id")) {
      await queryInterface.addColumn(TABLE, "created_customer_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment:
          "پروندهٔ مشتری متصل‌شده/ساخته‌شده در تأیید (ممیزی، بدون FK)",
      });
    }

    if (!columns.includes("customer_created")) {
      await queryInterface.addColumn(TABLE, "customer_created", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment:
          "آیا در تأیید، پروندهٔ مشتری تازه ساخته شد؟ (ثبت‌نام مشتری بدون پرونده)",
      });
    }
  },

  async down(queryInterface) {
    const columns = await columnNames(queryInterface);
    if (columns.includes("customer_created")) {
      await queryInterface.removeColumn(TABLE, "customer_created");
    }
    if (columns.includes("created_customer_id")) {
      await queryInterface.removeColumn(TABLE, "created_customer_id");
    }
  },
};
