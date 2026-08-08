const { Sequelize } = require("sequelize");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// تبدیل ایمن رمز عبور به رشته و حذف کوتیشن‌های اضافی
const dbPassword = String(process.env.DB_PASSWORD || "").replace(/"/g, "");

// اتصال به PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || "SKB-CRM", // اسم دیتابیس
  process.env.DB_USER || "postgres", // اسم کاربر
  dbPassword, // رمز عبور (به صورت رشته و بدون کوتیشن)
  {
    host: process.env.DB_HOST, // آدرس سرور دیتابیس
    port: process.env.DB_PORT, // پورت دیتابیس
    dialect: "postgres", // نوع دیتابیس (پستگرس)
    timezone: "+03:30", // ✅ اضافه کن - منطقه زمانی ایران
    logging: false, // لاگ‌ها رو نشون نده (اختیاری)
    pool: {
      max: 15, // حداکثر ۱۵ اتصال همزمان
      min: 2, // حداقل ۲ اتصال همیشه آماده
      acquire: 45000, // ۴۵ ثانیه زمان انتظار
      idle: 20000, // ۲۰ ثانیه بیکاری قبل از بسته شدن
    },
  },
);

// تابع برای تست و برقراری اتصال
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Successfully connected to PostgreSQL.");

    // synchronize همه مدل‌ها با دیتابیس (خودکار جدول میسازه)
    // await sequelize.sync({ alter: false });
    console.log("✅ Models synchronized successfully.");
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1); // خروج از برنامه اگه نتونست وصل بشه
  }
};

module.exports = { sequelize, connectDB };
