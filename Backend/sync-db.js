// BackEnd/sync-db.js
const { sequelize } = require("./config/database");
require("./models/associations");
require("./models/AppSetting"); // اطمینان از ساخت جدول app_settings در sync

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

    // حذف ایندکس یکتای قدیمی شماره گله از chick_placements
    // (شماره گله به سطح گله/دوره منتقل شده است)
    try {
      await sq.query(`DROP INDEX IF EXISTS "unique_flock_number_per_customer"`);
      console.log("✅ ایندکس یکتای قدیمی شماره گله حذف شد");
    } catch (indexError) {
      console.log("ℹ️ ایندکس یکتای قدیمی موجود نبود:", indexError.message);
    }

    // حذف constraint/ایندکس یکتای قدیمی پایان دوره per سالن از flock_completions
    // (پایان دوره اکنون در سطح گله است و یکتا per flock_id)
    const legacyCompletionIndexes = [
      "flock_completions_chick_placement_id_key",
      "flock_completions_chick_placement_id_unique",
    ];
    for (const idx of legacyCompletionIndexes) {
      try {
        await sq.query(`DROP INDEX IF EXISTS "${idx}"`);
        console.log(`✅ ایندکس یکتای قدیمی ${idx} حذف شد`);
      } catch (indexError) {
        console.log(`ℹ️ ایندکس ${idx} موجود نبود`);
      }
    }

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
