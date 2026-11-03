"use strict";

// ============================================================
//  «ردّ فعالیت» — ستون customer_id روی activity_logs  (موج ۱۲.۵)
// ------------------------------------------------------------
//  ⭐ چرا این ستون؟
//    تا پیش از این، پرسشِ «همهٔ تغییرات این مشتری چه بود؟» بی‌جواب
//    بود: ردیف‌های سالن/گله/مدیریت هفتگی/گزارش بازدید موجودیت خودشان
//    را داشتند و در بسترِ پروندهٔ مشتری دیده نمی‌شدند.
//    با customer_id هر ردیف می‌تواند به مشتریِ مالکش وصل شود
//    (POST /api/halls با customer_id در بدنه ⇒ ردیف با customer_id).
//  • بدون FOREIGN KEY — مثل user_id: تاریخچه پس از حذف مشتری هم می‌ماند
//  • ایندکس مرکب (customer_id, created_at) ⇒ «تازه‌ترین تغییرات این مشتری»
//  • idempotent است (describeTable / showIndex) ⇒ اجرای دوباره بی‌خطر
//  • اجرا:   npm run db:migrate   سپس  npm run db:verify
//  • برگشت:  npm run db:rollback  (فقط ستون/ایندکس را برمی‌دارد، نه جدول)
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "activity_logs";
const COLUMN = "customer_id";

const INDEX = {
  name: "activity_logs_customer",
  fields: [COLUMN, "created_at"],
};

// ستون‌های فعلی جدول (اگر جدول نبود ⇒ آرایهٔ خالی)
const describe = async (queryInterface) => {
  try {
    return await queryInterface.describeTable(TABLE);
  } catch {
    return null;
  }
};

const indexNames = async (queryInterface) => {
  try {
    const indexes = await queryInterface.showIndex(TABLE);
    return (indexes || []).map((index) => index.name);
  } catch {
    return [];
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await describe(queryInterface);

    // مایگریشن ساخت جدول باید قبل از این اجرا شده باشد؛ اگر نه،
    // اینجا کاری نمی‌کنیم و پیام می‌دهیم (به‌جای خطای مبهم).
    if (!columns) {
      console.warn(
        `⚠️ [migration] جدول ${TABLE} نیست — ستون ${COLUMN} اضافه نشد.` +
          ` اول 20261004020000-create-activity-logs را اجرا کن.`,
      );
      return;
    }

    if (!columns[COLUMN]) {
      await queryInterface.addColumn(TABLE, COLUMN, {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment:
          "مشتریِ مرتبط با رویداد (بدون FK — تاریخچه پس از حذف مشتری می‌ماند)",
      });
    }

    const currentIndexes = await indexNames(queryInterface);
    if (!currentIndexes.includes(INDEX.name)) {
      await queryInterface.addIndex(TABLE, INDEX.fields, {
        name: INDEX.name,
      });
    }
  },

  async down(queryInterface) {
    const currentIndexes = await indexNames(queryInterface);
    if (currentIndexes.includes(INDEX.name)) {
      await queryInterface.removeIndex(TABLE, INDEX.name);
    }

    const columns = await describe(queryInterface);
    if (columns && columns[COLUMN]) {
      await queryInterface.removeColumn(TABLE, COLUMN);
    }
  },
};
