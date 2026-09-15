// ============================================================
// ✅ محافظ‌های سراسری پروسه (Process Guards)
// ------------------------------------------------------------
// چرا لازم است؟
// این سرور برای مانیتورینگ ۲۴ ساعته روی ماشین کارخانه اجرا می‌شود.
// اگر یک Promise مدیریت‌نشده یا خطای همگام رخ دهد و هندلر نصب نباشد:
//   • در Node 15+ یک rejection مدیریت‌نشده، پروسه را با کد غیرصفر می‌بندد
//   • خطای مدیریت‌نشده بدون هیچ لاگ مفیدی، سرور را از دسترس خارج می‌کند
// پس اینجا:
//   ۱) rejection را لاگ می‌کنیم و سرویس را زنده نگه می‌داریم
//   ۲) خطای مدیریت‌نشده را لاگ می‌کنیم و با کد ۱ خارج می‌شویم
//      (اسکریپت start-backend.bat در حلقه دوباره آن را بالا می‌آورد)
// ============================================================

let installed = false;

const installProcessGuards = (options = {}) => {
  if (installed) return false; // فقط یک بار (در تست‌ها/ری‌لودها دوباره نصب نشود)
  installed = true;

  const exit = typeof options.exit === "function" ? options.exit : process.exit;

  // ---- ۱) Promise مدیریت‌نشده ----
  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    console.error("❌ Unhandled Promise Rejection:", error.message);
    if (error.stack) console.error(error.stack);
    console.error(
      "⚠️  سرور به کار خود ادامه می‌دهد؛ این خطا را در کد پیدا و اصلاح کنید.",
    );
  });

  // ---- ۲) خطای مدیریت‌نشده ----
  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error?.message || error);
    if (error?.stack) console.error(error.stack);
    console.error(
      "🚨 وضعیت برنامه نامعلوم است → خروج کنترل‌شده (start-backend.bat دوباره سرور را بالا می‌آورد)",
    );
    try {
      exit(1);
    } catch {
      /* در حالت تست ممکن است exit پیاده‌سازی نشده باشد */
    }
  });

  return true;
};

module.exports = { installProcessGuards };
