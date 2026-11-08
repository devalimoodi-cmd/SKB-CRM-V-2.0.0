"use strict";

// ============================================================
//  جدول «مدارک من» (portal_documents) — موج ۱۳.۱۰
// ------------------------------------------------------------
//  چه چیزی می‌سازد؟
//    • مدارکی که *خودِ مشتری* از پورتال آپلود می‌کند (کارت ملی، جواز،
//      فاکتور…). تا امروز پورتال فقط «دانلود پیوست کارشناس» داشت و هیچ
//      مسیری برای «مشتری ⇒ سرور» با فایل وجود نداشت.
// ------------------------------------------------------------
//  🔒 اصول امنیتی رعایت‌شده در ساختار:
//   • `customer_id` همیشه از توکن می‌آید (req.customerScopeId) و برای
//     همین ستون ایندکس دارد؛ هیچ مسیری شناسهٔ مشتری را از کلاینت نمی‌گیرد.
//   • `file_path` = مسیر **نسبی** داخل پوشهٔ خصوصی
//     (Backend/private/portal_documents) — نه زیر uploads/ که در
//     server.js بدون احراز هویت سرو می‌شود. فایل فقط با
//     GET /api/portal/documents/:id/file و توکن معتبر بیرون می‌آید.
//   • `file_name` فقط برای «نمایش» است؛ نام فایل روی دیسک تصادفی است
//     تا نام اصلی (که ممکن است فارسی/حاوی مسیر باشد) به دیسک نرسد.
//   • `deleted_at` + `deleted_by` = حذف **نرم**. حذف مدرک از پورتال،
//     ردیف را از دید مشتری پنهان می‌کند ولی فایل را نگه می‌دارد
//     (ممیزی/بازبینی کارشناس) ⇒ هیچ UNLINK ای در پروژه نیست.
//   • `uploaded_by` بدون FOREIGN KEY (هم‌الگو با login_challenges/
//     registration_requests) تا تاریخچه پس از حذف کاربر بماند.
// ------------------------------------------------------------
//  idempotent است: اگر جدول/ایندکس موجود باشد کاری نمی‌کند.
//  اجرا:   npm run db:migrate     سپس  npm run db:verify
//  برگشت:  npm run db:rollback
//  ⛔ هرگز sequelize.sync نزن — رجوع: Backend/migrations/README.md
// ============================================================

const TABLE = "portal_documents";

// ایندکس‌ها را خودمان می‌سازیم تا نامشان با verify-db یکی باشد
const INDEXES = [
  {
    name: "portal_documents_customer_created",
    sql: `("customer_id", "created_at")`,
    comment: "فهرست مدارک یک پرونده (تازه‌ترین اول)",
  },
  {
    name: "portal_documents_customer_kind",
    sql: `("customer_id", "kind")`,
    comment: "سهمیهٔ هر نوع مدرک برای یک پرونده",
  },
  {
    name: "portal_documents_deleted_at",
    sql: `("deleted_at")`,
    comment: "حذف نرم — پاک‌سازی/بازبینی بعدی",
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
        uploaded_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment:
            "شناسهٔ کاربر آپلودکننده (بدون FK — تاریخچه پس از حذف کاربر می‌ماند)",
        },
        title: {
          type: Sequelize.STRING(120),
          allowNull: false,
          comment: "برچسب مدرک (پاک‌سازی‌شده در services/portalDocumentRules)",
        },
        kind: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "other",
          comment: "id_card | license | invoice | other",
        },
        file_name: {
          type: Sequelize.STRING(255),
          allowNull: false,
          comment: "نام اصلی فایل — فقط برای نمایش؛ نام روی دیسک تصادفی است",
        },
        file_path: {
          type: Sequelize.STRING(500),
          allowNull: false,
          comment:
            "مسیر نسبی داخل private/portal_documents — هرگز به کلاینت فرستاده نمی‌شود",
        },
        file_size: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
          comment: "حجم بایت (سقف ۵MB در middleware/upload.js)",
        },
        mime_type: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: "image/jpeg | image/png | image/webp | application/pdf",
        },
        deleted_by: {
          type: Sequelize.INTEGER,
          allowNull: true,
          comment: "چه کسی حذف (نرم) کرد — پیش از destroy نوشته می‌شود",
        },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
        deleted_at: {
          type: Sequelize.DATE,
          allowNull: true,
          comment: "حذف نرم (paranoid) — فایل روی دیسک باقی می‌ماند",
        },
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
