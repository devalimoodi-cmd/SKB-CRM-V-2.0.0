"use strict";

// ============================================================
//  «ردّ فعالیت» (Activity Log) — جدول activity_logs  (فاز ۱۲.۲)
// ------------------------------------------------------------
//  • هر تغییرِ وضعیت (POST/PUT/PATCH/DELETE) + ورود/خروج یک ردیف می‌سازد
//    ⇒ پاسخ به «چه کسی، چه زمانی، کدام رکورد را تغییر داد؟»
//  • سبک‌سازی مسیر درخواست: نوشتن در دیتابیس از مسیر پاسخ جدا است
//    (بافر در حافظه + flush دسته‌ای در services/activityService.js)
//  • بدون FOREIGN KEY + عکسِ username/role مثل user_sessions
//    ⇒ تاریخچه پس از حذف کاربر هم می‌ماند
//  • idempotent است: اگر جدول/ایندکس از قبل باشد، دست نمی‌زند
//    (showAllTables / showIndex)
//  • اجرا:   npm run db:migrate   سپس  npm run db:verify
//  • برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "activity_logs";

const INDEXES = [
  // پرکاربردترین کوئری پنل: «ردّ فعالیت یک کاربر، تازه‌ترین اول»
  { name: "activity_logs_user_id_created_at", fields: ["user_id", "created_at"] },
  // «تاریخچهٔ تغییرات یک رکورد خاص» (مثلاً همین مشتری)
  { name: "activity_logs_entity", fields: ["entity", "entity_id"] },
  // مرتب‌سازی/نگهداشت (پاک‌سازی قدیمی‌ها با created_at)
  { name: "activity_logs_created_at", fields: ["created_at"] },
  // فیلتر بر اساس نوع عمل (ایجاد/حذف/ورود/خروج)
  { name: "activity_logs_action", fields: ["action"] },
];

const tableNames = async (queryInterface) => {
  try {
    const description = await queryInterface.showAllTables();
    return (description || []).map((entry) =>
      typeof entry === "string" ? entry : entry?.tableName || entry?.name || "",
    );
  } catch {
    return [];
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
    const existing = await tableNames(queryInterface);

    if (!existing.includes(TABLE)) {
      await queryInterface.createTable(TABLE, {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "کاربر (بدون FK تا تاریخچه پس از حذف کاربر بماند)",
        },
        username: {
          type: Sequelize.STRING(100),
          allowNull: true,
          comment: "عکس نام کاربری در لحظهٔ رویداد",
        },
        role: {
          type: Sequelize.STRING(20),
          allowNull: true,
          comment: "عکس نقش کاربر در لحظهٔ رویداد",
        },
        action: {
          type: Sequelize.STRING(20),
          allowNull: false,
          comment: "create | update | delete | read | login | logout",
        },
        method: {
          type: Sequelize.STRING(10),
          allowNull: false,
          comment: "متد HTTP",
        },
        path: {
          type: Sequelize.STRING(300),
          allowNull: false,
          comment: "مسیر واقعی درخواست (بدون query)",
        },
        route: {
          type: Sequelize.STRING(300),
          allowNull: true,
          comment: "الگوی مسیر Express (مثل /:id) برای الگوکاوی",
        },
        entity: {
          type: Sequelize.STRING(80),
          allowNull: true,
          comment: "موجودیت هدف (customers / halls / users ...)",
        },
        entity_id: {
          type: Sequelize.STRING(64),
          allowNull: true,
          comment: "شناسهٔ رکورد هدف (رشته: عدد یا UUID)",
        },
        status_code: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "کد پاسخ HTTP",
        },
        success: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: "آیا عملیات موفق بود؟ (۲xx/۳xx)",
        },
        ip: {
          type: Sequelize.STRING(64),
          allowNull: true,
          comment: "آی‌پی درخواست‌کننده",
        },
        user_agent: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: "User-Agent مرورگر/دستگاه",
        },
        session_id: {
          type: Sequelize.STRING(64),
          allowNull: true,
          comment: "sid نشست (برای همبستگی با user_sessions — هرگز در API بیرون نمی‌رود)",
        },
        fields: {
          type: Sequelize.JSONB,
          allowNull: true,
          comment:
            "نام فیلدهای بدنه (مقدار فقط با ACTIVITY_LOG_VALUES=true · فیلدهای حساس همیشه ***)",
        },
        summary: {
          type: Sequelize.STRING(500),
          allowNull: true,
          comment: "شرح فارسی رویداد برای نمایش سریع در پنل",
        },
        duration_ms: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "مدت پردازش درخواست (میلی‌ثانیه)",
        },
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
    }

    // ===== ایندکس‌ها (هر کدام مستقل و idempotent) =====
    const currentIndexes = await indexNames(queryInterface);

    for (const index of INDEXES) {
      if (!currentIndexes.includes(index.name)) {
        await queryInterface.addIndex(TABLE, index.fields, { name: index.name });
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
