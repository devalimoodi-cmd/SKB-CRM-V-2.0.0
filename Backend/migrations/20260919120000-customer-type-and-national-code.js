"use strict";

// ============================================================
//  «نوع مشتری» + «کد ملی» مشتری
// ------------------------------------------------------------
//  • ساخت جدول دیکشنری customer_types (گوشتی / تخم‌گذار / مرغ مادر / سایر)
//    همراه با چهار آیتم پیش‌فرض
//  • افزودن national_code و customer_type_id به customer_personal_information
//  • idempotent است: اجرای دوباره روی دیتابیس فعلی/سرور خطا نمی‌دهد
//  • اجرا:  npm run db:migrate
//  • برگشت: npm run db:rollback
// ============================================================

const tableNames = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "string" ? t : t.tableName));
};

const columnNames = async (queryInterface, table) => {
  const description = await queryInterface.describeTable(table);
  return Object.keys(description || {});
};

const CUSTOMER_TABLE = "customer_personal_information";

// چهار نوع پیش‌فرض مشتری (طبق درخواست کارفرما)
const DEFAULT_CUSTOMER_TYPES = [
  { name: "گوشتی", description: "پرورش مرغ گوشتی", sort_order: 1 },
  { name: "تخم‌گذار", description: "پرورش مرغ تخم‌گذار", sort_order: 2 },
  { name: "مرغ مادر", description: "پرورش مرغ مادر", sort_order: 3 },
  { name: "سایر", description: "سایر انواع پرورش", sort_order: 4 },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await tableNames(queryInterface);
    const now = new Date();

    // ===== ۱) جدول دیکشنری «نوع مشتری» =====
    if (!tables.includes("customer_types")) {
      await queryInterface.createTable("customer_types", {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        name: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        description: { type: Sequelize.TEXT, allowNull: true },
        sort_order: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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

      await queryInterface.addIndex("customer_types", ["active"]);
    }

    // ===== ۲) چهار آیتم پیش‌فرض (فقط اگر جدول خالی باشد) =====
    // اگر ادمین آیتم‌ها را تغییر داده باشد، دوباره seed نمی‌کنیم
    const [countRows] = await queryInterface.sequelize.query(
      'SELECT COUNT(*)::int AS total FROM "customer_types"',
    );
    if (Number(countRows?.[0]?.total || 0) === 0) {
      await queryInterface.bulkInsert(
        "customer_types",
        DEFAULT_CUSTOMER_TYPES.map((item) => ({
          ...item,
          active: true,
          created_at: now,
          updated_at: now,
        })),
      );
    }

    // ===== ۳) ستون‌های جدید مشتری =====
    const customerColumns = await columnNames(queryInterface, CUSTOMER_TABLE);

    if (!customerColumns.includes("national_code")) {
      await queryInterface.addColumn(CUSTOMER_TABLE, "national_code", {
        type: Sequelize.STRING(10),
        allowNull: true,
        comment: "کد ملی ۱۰ رقمی مشتری (اختیاری)",
      });
    }

    if (!customerColumns.includes("customer_type_id")) {
      await queryInterface.addColumn(CUSTOMER_TABLE, "customer_type_id", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "customer_types", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
        comment: "نوع مشتری (کلید خارجی به customer_types)",
      });

      await queryInterface.addIndex(CUSTOMER_TABLE, ["customer_type_id"]);
    }
  },

  async down(queryInterface) {
    const customerColumns = await columnNames(queryInterface, CUSTOMER_TABLE);

    if (customerColumns.includes("customer_type_id")) {
      await queryInterface.removeColumn(CUSTOMER_TABLE, "customer_type_id");
    }
    if (customerColumns.includes("national_code")) {
      await queryInterface.removeColumn(CUSTOMER_TABLE, "national_code");
    }

    const tables = await tableNames(queryInterface);
    if (tables.includes("customer_types")) {
      await queryInterface.dropTable("customer_types");
    }
  },
};
