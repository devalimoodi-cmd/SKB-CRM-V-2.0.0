// scripts/sync-db.js   (قبلاً: BackEnd/sync-db.js — آن مسیر قدیمی دیگر معتبر نیست)
// ------------------------------------------------------------
// ⛔ هشدار جدی: این اسکریپت legacy است و از sequelize.sync({ alter: true })
//    استفاده می‌کند که می‌تواند ستون/ایندکس را حذف یا نوع را تغییر دهد.
//    در همهٔ مسیرهای عادی (استقرار، افزودن جدول/ستون) «مایگریشن» اجرا کن:
//        npm run db:migrate   &&   npm run db:verify
//    اجرای این اسکریپت فقط با اجازهٔ صریح و بعد از بکاپ:
//        ALLOW_DB_SYNC=true npm run db:sync
// ------------------------------------------------------------
const syncAllowed =
  String(process.env.ALLOW_DB_SYNC || "").toLowerCase() === "true" &&
  process.env.NODE_ENV !== "production";

if (!syncAllowed) {
  console.error("⛔ اجرای sync-db مسدود شد.");
  console.error(
    "   این اسکریپت legacy است (alter: true) و ممکن است ساختار دیتابیس را تغییر دهد.",
  );
  console.error("   برای ساخت/به‌روزرسانی جدول‌ها:");
  console.error("       npm run db:migrate  &&  npm run db:verify");
  console.error("   اگر واقعاً لازم است (فقط بعد از بکاپ):");
  console.error("       ALLOW_DB_SYNC=true npm run db:sync");
  if (String(process.env.NODE_ENV || "") === "production") {
    console.error("   ⚠️ روی سرور production این اسکریپت هرگز اجرا نمی‌شود.");
  }
  process.exit(1);
}

const { sequelize } = require("../config/database");
require("../models/associations");
require("../models/AppSetting"); // اطمینان از ساخت جدول app_settings در sync

async function syncDatabase() {
  try {
    console.log("🔄 شروع همگام‌سازی دیتابیس...");

    // اصلاح رکوردهای فاقد کاربر معتبر (created_by/updated_by)
    const { sequelize: sq } = require("../config/database");
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

    // سکوئنس اختصاصی کد پایدار مشتری (هرگز به عقب برنمی‌گردد و کد حذف‌شده بازاستفاده نمی‌شود)
    await sq.query(`CREATE SEQUENCE IF NOT EXISTS customer_code_seq START WITH 1001`);
    // اختصاص کد به مشتریان فعلی که هنوز کد ندارند
    await sq.query(
      `UPDATE "customer_personal_information" SET "customer_code" = nextval('customer_code_seq') WHERE "customer_code" IS NULL`,
    );
    // ایندکس یکتای کد مشتری
    await sq.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_code ON "customer_personal_information"("customer_code")`,
    );

    console.log("✅ همگام‌سازی با موفقیت انجام شد!");
    process.exit(0);
  } catch (error) {
    console.error("❌ خطا در همگام‌سازی:", error);
    process.exit(1);
  }
}

syncDatabase();
