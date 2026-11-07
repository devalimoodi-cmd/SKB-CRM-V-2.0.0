"use strict";

// ============================================================
//  جدول «درخواست‌های ثبت‌نام» (registration_requests) — فاز ۱۳.۶
// ------------------------------------------------------------
//  چرا این جدول و نه users.status='pending'؟
//    • در این موج (V3) کاربر تا **لحظهٔ تأیید مدیر** اصلاً ساخته نمی‌شود؛
//      صف درخواست‌ها جداست ⇒ جدول users هیچ ردیف نیمه‌کارهٔ عمومی نمی‌گیرد.
//    • هر درخواست یک «عکس» از دادهٔ متقاضی است؛ تأیید/رد آن ممیزی دارد.
//    • پاک‌کردن یک درخواست هرگز به حساب‌ها/پورتال دست نمی‌زند.
// ------------------------------------------------------------
//  🔒 اصول امنیتی رعایت‌شده در ساختار:
//   • `password_hash` = bcrypt(10) — رمز خام هرگز در دیتابیس/لاگ نمی‌نشیند.
//   • درخواست همیشه با status='pending' و بدون هیچ ستون role/status کاربر
//     ساخته می‌شود؛ نقش در لحظهٔ تأیید ثابت و «customer» است.
//   • سه ایندکس یکتای **جزئی** (WHERE status='pending') ⇒ هر موبایل/ایمیل/
//     نام کاربری حداکثر یک درخواستِ باز دارد (ضد اسپم و ضد صف تکراری)،
//     ولی درخواست ردشده مانع ثبت دوبارهٔ کاربر نمی‌شود.
//   • `reviewed_by` / `created_user_id` بدون FOREIGN KEY
//     (هم‌الگو با login_challenges/activity_logs) تا تاریخچه پس از حذف
//     کاربر بماند؛ `created_user_id` ردِّ ممیزیِ «از کدام درخواست ساخته شد».
// ------------------------------------------------------------
//  idempotent است: اجرای دوباره روی دیتابیس فعلی خطا نمی‌دهد.
//  اجرا:   npm run db:migrate     سپس  npm run db:verify
//  برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "registration_requests";
const PENDING_INDEXES = [
  { name: "registration_requests_pending_username_unique", column: "username" },
  { name: "registration_requests_pending_email_unique", column: "email" },
  { name: "registration_requests_pending_mobile_unique", column: "mobile_number" },
];
const STATUS_INDEX = "registration_requests_status_created_at";

const tableNames = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName));
};

const indexNames = async (queryInterface, table) => {
  try {
    const indexes = await queryInterface.showIndex(table);
    return (indexes || []).map((index) => index.name);
  } catch {
    return [];
  }
};


module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await tableNames(queryInterface);

    if (!existing.includes(TABLE)) {
      await queryInterface.createTable(TABLE, {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        first_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: "نام متقاضی (عکس لحظهٔ ثبت درخواست)",
        },
        last_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: "نام خانوادگی متقاضی",
        },
        username: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: "نام کاربری درخواستی (یکتایی نهایی هنگام تأیید در users سنجیده می‌شود)",
        },
        email: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: "ایمیل متقاضی",
        },
        mobile_number: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: "موبایل متقاضی (۰۹xxxxxxxxx)",
        },
        password_hash: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: "bcrypt(10) — رمز خام هرگز ذخیره نمی‌شود",
        },
        requested_customer_code: {
          type: Sequelize.STRING(50),
          allowNull: true,
          comment: "کد/نام پروندهٔ مشتری که متقاضی ادعا می‌کند (فقط برای کمک به بازبین)",
        },
        note: {
          type: Sequelize.TEXT,
          allowNull: true,
          comment: "توضیح اختیاری متقاضی",
        },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "pending",
          comment: "pending | approved | rejected",
        },
        reject_reason: {
          type: Sequelize.STRING(300),
          allowNull: true,
          comment: "دلیل رد (اجباری در عمل رد — کنترل‌شده در registrationRules)",
        },
        reviewed_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "شناسهٔ مدیر بازبین (بدون FK — تاریخچه پس از حذف کاربر می‌ماند)",
        },
        reviewed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "زمان تأیید/رد",
        },
        created_user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "کاربری که با تأیید این درخواست ساخته شد (ممیزی، بدون FK)",
        },
        ip: {
          type: Sequelize.STRING(45),
          allowNull: true,
          comment: "آی‌پی ثبت درخواست (ضد اسپم/ممیزی)",
        },
        user_agent: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: "User-Agent ثبت درخواست (بریده‌شده)",
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    const indexes = await indexNames(queryInterface, TABLE);

    // ایندکس‌های یکتای جزئی: فقط روی درخواست‌های «باز»
    // (در Postgres، ایندکس جزئی با WHERE پشتیبانی می‌شود)
    for (const item of PENDING_INDEXES) {
      if (!indexes.includes(item.name)) {
        await queryInterface.sequelize.query(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${item.name}" ON "${TABLE}" ("${item.column}") WHERE status = 'pending'`,
        );
      }
    }

    if (!indexes.includes(STATUS_INDEX)) {
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS "${STATUS_INDEX}" ON "${TABLE}" ("status", "created_at")`,
      );
    }
  },

  async down(queryInterface) {
    const existing = await tableNames(queryInterface);
    if (existing.includes(TABLE)) {
      await queryInterface.dropTable(TABLE);
    }
  },
};
