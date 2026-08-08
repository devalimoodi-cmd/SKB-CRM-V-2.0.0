// BackEnd/sync-db.js
const { sequelize } = require("./config/database");
require("./models/associations");

async function syncDatabase() {
  try {
    console.log("🔄 شروع همگام‌سازی دیتابیس...");

    // اصلاح رکوردهای فاقد کاربر معتبر (created_by/updated_by)
    const { sequelize: sq } = require("./config/database");
    await sq.query(
      `UPDATE "customer_personal_information" SET "created_by" = NULL WHERE "created_by" IS NOT NULL AND "created_by" NOT IN (SELECT id FROM users)`,
    );
    await sq.query(
      `UPDATE "customer_personal_information" SET "updated_by" = NULL WHERE "updated_by" IS NOT NULL AND "updated_by" NOT IN (SELECT id FROM users)`,
    );
    console.log("✅ رکوردهای ناسازگار اصلاح شدند");

    // ✅ استفاده از alter: true برای حفظ داده‌ها
    await sequelize.sync({ alter: true });

    console.log("✅ همگام‌سازی با موفقیت انجام شد!");
    process.exit(0);
  } catch (error) {
    console.error("❌ خطا در همگام‌سازی:", error);
    process.exit(1);
  }
}

syncDatabase();
