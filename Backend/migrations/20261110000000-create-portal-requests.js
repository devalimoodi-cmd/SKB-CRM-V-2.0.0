"use strict";

// ============================================================
//  جدول «درخواست‌های فارم» (portal_requests) — موج ۱۳.۱۱
// ------------------------------------------------------------
//  چه چیزی می‌سازد؟
//    صفِ درخواست‌های مشتری برای ساخت رکوردهای فارم:
//      unit_create      ← ثبت واحد مرغداری
//      hall_create      ← ثبت سالن در یکی از واحدهای خودم
//      placement_create ← ثبت جوجه‌ریزی در سالن خودم
//
//  🔑 چرا جدول صف و نه نوشتن مستقیم؟
//    «الگوی ب» = درخواست مشتری + تأیید کارشناس. تا لحظهٔ تأیید،
//    هیچ ردیفی در units/halls/chick_placements ساخته نمی‌شود؛
//    بنابراین دادهٔ عملیاتی سامانه هرگز با ورودی تأییدنشده آلوده
//    نمی‌شود و کارشناس فرصت بازبینی/اصلاح دارد.
// ------------------------------------------------------------
//  🔒 اصول امنیتی رعایت‌شده در ساختار:
//   • `customer_id` **فقط** از توکن (req.customerScopeId) پر می‌شود؛
//     برای همین ستون ایندکس دارد و هیچ مسیری آن را از بدنه نمی‌خواند.
//   • `payload` فیلدهای سفیدِ همان نوع را نگه می‌دارد (پاک‌سازی در
//     services/portalRequestRules — کلیدهای ناشناخته همان‌جا حذف
//     می‌شوند؛ هرگز کلید خام بدنه ذخیره نمی‌شود).
//   • `status` مجموعهٔ بسته‌ای دارد: pending | approved | rejected | cancelled
//     (اعتبار در سرویس قواعد سنجیده می‌شود؛ اینجا فقط پیش‌فرض pending).
//   • `reviewed_by` / `submitted_by` بدون FOREIGN KEY (هم‌الگو با
//     registration_requests/login_challenges) تا تاریخچه پس از
//     حذف کاربر یا کارشناس بازبین باقی بماند.
//   • حذف نداریم: درخواست لغوشده هم می‌ماند (سابقهٔ تصمیم).
// ------------------------------------------------------------
//  idempotent است: اگر جدول/ایندکس موجود باشد کاری نمی‌کند.
//  اجرا:   npm run db:migrate     سپس  npm run db:verify
//  برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "portal_requests";

// ایندکس‌ها را خودمان می‌سازیم تا نامشان با verify-db یکی باشد
const INDEXES = [
  {
    name: "portal_requests_customer_status_created",
    sql: `("customer_id", "status", "created_at")`,
    comment: "فهرست درخواست‌های یک پرونده (صفحهٔ «درخواست‌های من»)",
  },
  {
    name: "portal_requests_status_created",
    sql: `("status", "created_at")`,
    comment: "صف کارشناس: «در انتظار» به‌ترتیب تازه‌ترین",
  },
  {
    name: "portal_requests_type_status",
    sql: `("request_type", "status")`,
    comment: "فیلتر صف بر اساس نوع درخواست",
  },
];

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
        customer_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          comment:
            "صاحب پرونده — فقط از req.customerScopeId (توکن) پر می‌شود، نه از بدنهٔ درخواست",
        },
        request_type: {
          type: Sequelize.STRING(30),
          allowNull: false,
          comment: "unit_create | hall_create | placement_create",
        },
        status: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "pending",
          comment: "pending | approved | rejected | cancelled",
        },
        payload: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
          comment:
            "فیلدهای سفیدِ همان نوع (پاک‌سازی در services/portalRequestRules)",
        },
        submitted_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "شناسهٔ کاربر مشتری که درخواست را فرستاد (بدون FK)",
        },
        submitted_ip: {
          type: Sequelize.STRING(45),
          allowNull: true,
          comment: "IP ثبت درخواست — فقط برای ممیزی، در خروجی API نمی‌آید",
        },
        submitted_user_agent: {
          type: Sequelize.STRING(255),
          allowNull: true,
          comment: "User-Agent ثبت درخواست — فقط برای ممیزی",
        },
        reviewed_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "کارشناس/مدیر بازبین (بدون FK — تاریخچه می‌ماند)",
        },
        reviewed_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "زمان تأیید/رد",
        },
        reject_reason: {
          type: Sequelize.STRING(300),
          allowNull: true,
          comment: "دلیل رد — به مشتری نشان داده می‌شود",
        },
        applied_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "زمان اعمال در جداول اصلی (فقط در وضعیت approved)",
        },
        result_entity_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "شناسهٔ ردیف ساخته‌شده در جدول مقصد (unit/hall/placement)",
        },
        result_summary: {
          type: Sequelize.STRING(300),
          allowNull: true,
          comment: "خلاصهٔ نتیجه برای نمایش در پورتال (مثلاً «سالن ۳ ثبت شد»)",
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    }

    const indexes = await indexNames(queryInterface, TABLE);
    for (const item of INDEXES) {
      if (indexes.includes(item.name)) continue;
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS "${item.name}" ON "${TABLE}" ${item.sql}`,
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
