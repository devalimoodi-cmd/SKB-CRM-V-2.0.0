// BackEnd/sync-db.js
const { sequelize } = require("./config/database");
require("./models/associations");

async function syncDatabase() {
  try {
    console.log("🔄 شروع همگام‌سازی دیتابیس...");

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
