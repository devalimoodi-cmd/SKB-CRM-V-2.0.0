// ✅ محافظ‌های سراسری پروسه (خطای مدیریت‌نشده / Promise ردشده)
// باید قبل از هر require دیگری نصب شود تا خطاهای زمان راه‌اندازی هم لاگ شوند.
const { installProcessGuards } = require("./utils/processGuards");
installProcessGuards();

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

// ✅ بارگذاری .env در همان ابتدا (قبل از هر require دیگر)
// بعضی ماژولها (مثل middleware/rateLimit) در زمان import از process.env میخوانند
// و اگر dotenv دیرتر اجرا شود، مقادیر .env نادیده گرفته میشوند.
// (dotenv در بالای فایل اجرا میشود)
dotenv.config({ quiet: true });

const { connectDB } = require("./config/database");
const path = require("path");
const os = require("os");
const { protect, authorize } = require("./middleware/auth");
const { errorResponse } = require("./utils/response");
const {
  applySecurityHeaders,
  apiLimiter,
} = require("./middleware/rateLimit");

// Routes
const customerRegistrationRoutes = require("./routes/customerRegistrationRoutes");
const cityRoutes = require("./routes/cityRoutes");
const userRoutes = require("./routes/userRoutes");
const unitRoutes = require("./routes/unitRoutes");
const dictionaryRoutes = require("./routes/dictionaryRoutes");
const hallRoutes = require("./routes/hallRoutes");
const hallPhysicalInfoRoutes = require("./routes/hallPhysicalInfoRoutes");
const hallSystemRoutes = require("./routes/hallSystemRoutes");
const hallWaterFeedRoutes = require("./routes/hallWaterFeedRoutes");
const hallHygieneRoutes = require("./routes/hallHygieneRoutes");
const chickPlacementRoutes = require("./routes/chickPlacementRoutes");
const flockRoutes = require("./routes/flockRoutes");
const weeklyRoutes = require("./routes/weeklyRoutes");
const breedStandardRoutes = require("./routes/breedStandardRoutes");

const weatherRoutes = require("./routes/weatherRoutes");
const smsRoutes = require("./routes/smsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const bookmarkRoutes = require("./routes/bookmarkRoutes");
const customerHeaderRoutes = require("./routes/customerHeaderRoutes");
const flockCompletionRoutes = require("./routes/flockCompletionRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const visitReportRoutes = require("./routes/visitReportRoutes");
const captchaRoutes = require("./routes/captchaRoutes");
const suggestionRoutes = require("./routes/suggestionRoutes");
const publicRoutes = require("./routes/publicRoutes");

// ================== ###==========

// ارتباط بین جداول دیتابیس
require("./models/associations");
// ===

const app = express();

// ✅ این سرور پشت پروکسی فرانت‌اند (هم‌ماشین) است
// با این تنظیم، آی‌پی واقعی کاربر از X-Forwarded-For خوانده می‌شود
// (لازم برای Rate Limit و لاگ‌های درست)
app.set("trust proxy", "loopback");

// ============================================
// Middlewareها -
// ============================================

// CORS - باید اول باشد
// ✅ هدرهای امنیتی (بدون پکیج خارجی - در middleware/rateLimit.js)
app.use(applySecurityHeaders);

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
      // ✅ سرور اختصاصی
      "http://192.168.168.72:3000",
      "http://192.168.168.72",
      "http://192.168.168.72:5000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// برای دریافت JSON
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// ✅ محدودیت نرخ درخواست برای همهٔ APIها (ضد Brute-force / سوءاستفاده)
// قابل غیرفعال‌سازی در تست با RATE_LIMIT_DISABLED=true
app.use("/api", apiLimiter);

// ============================================
// ✅ سرو فایل‌های آپلودی (تصاویر/پیوست‌های گزارش بازدید)
// نکته: این مسیر «عمومی» است چون در <img>/<video>/<iframe> داخل برنامه
// استفاده می‌شود و مرورگر روی این درخواست‌ها هدر Authorization نمی‌فرستد.
// برای کم‌کردن ریسک:
//   ۱) پسوندهای اجرایی/اسکریپتی هرگز سرو نمی‌شوند (۴۰۴)
//   ۲) nosniff → مرورگر نوع فایل را حدس نزند
//   ۳) انواع غیرتصویری به‌صورت دانلود (attachment) فرستاده می‌شوند تا
//      محتوای آپلودشده داخل مبدأ برنامه اجرا نشود
//   ۴) لیست‌کردن پوشه‌ها و فایل‌های مخفی غیرفعال است
// ============================================
const UPLOADS_BLOCKED_EXT = new Set([
  ".html",
  ".htm",
  ".xhtml",
  ".shtml",
  ".js",
  ".mjs",
  ".cjs",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".xml",
  ".xsl",
  ".svg",
  ".svgz",
  ".php",
  ".asp",
  ".aspx",
  ".jsp",
  ".cgi",
  ".pl",
  ".py",
  ".rb",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
  ".vbs",
  ".wsf",
  ".jar",
  ".exe",
  ".dll",
  ".msi",
  ".scr",
  ".com",
  ".pif",
]);

const UPLOADS_INLINE_EXT = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".bmp",
  ".ico",
  ".avif",
  ".pdf",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".mp3",
  ".wav",
  ".ogg",
  ".txt",
  ".csv",
]);

app.use(
  "/uploads",
  (req, res, next) => {
    let urlPath = (req.path || "").split("?")[0];
    try {
      urlPath = decodeURIComponent(urlPath);
    } catch {
      /* مسیر انکود‌نشده نامعتبر → مثل قبل ادامه بده */
    }
    const ext = path.extname(urlPath).toLowerCase();

    if (UPLOADS_BLOCKED_EXT.has(ext)) {
      return errorResponse(res, "این نوع فایل قابل سرو نیست", 404);
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    if (!UPLOADS_INLINE_EXT.has(ext)) {
      // فایل‌های ناشناخته/غیرتصویری: دانلود به‌جای اجرا در مرورگر
      res.setHeader("Content-Disposition", "attachment");
    }
    return next();
  },
  express.static(path.join(__dirname, "uploads"), {
    index: false,
    dotfiles: "deny",
  }),
);

// ============================================
// ✅ بررسی سلامت سرویس (عمومی - بدون احراز هویت)
// برای تست پروکسی فرانت‌اند و دسترسی از بیرون شبکه
// ============================================
// ✅ کپچای صفحهٔ ورود (عمومی - بدون احراز هویت)
app.use("/api/captcha", captchaRoutes);

// ============================================
// ✅ تنظیمات نمایشی UI (عمومی — بدون احراز هویت)
// فقط کلیدهای غیرحساس مثل loader_style (لودر سیستمی)
// ============================================
app.use("/api/public", publicRoutes);

// ============================================
// ✅ «نظرات و پیشنهادات» (فقط کاربران لاگین‌شده)
// ============================================
app.use("/api/suggestions", suggestionRoutes);

app.get("/api/ping", (req, res) => {
  res.json({
    success: true,
    message: "SKB-CRM API is running",
    port: Number(process.env.PORT || 5000),
    time: new Date().toISOString(),
  });
});

// اتصال به دیتابیس
connectDB();

// ============================================
// مسیرهای API
// ============================================
app.use("/api/customers", customerRegistrationRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/users", userRoutes);

// مسیرهای تست
app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});

app.get(
  "/health",
  protect,
  authorize("admin", "super_admin", "sub_admin", "expert"),
  (req, res) => {
    res.json({ status: "OK", timestamp: new Date().toISOString() });
  },
);

// تنظیمات سراسری برنامه
app.use("/api/settings", settingsRoutes);

// =================
// مسیرهای جداول دیکشنری
// =================
app.use("/api/dictionary", dictionaryRoutes);
// =================

// ================مسیر تعریف و مدیریت واحدهای مرغداری============
app.use("/api/units", unitRoutes);
// ===============مسیر تعریف و مدیریت واحدهای مرغداری ============

// ==================== روت‌های مدیریت سالن ====================
app.use("/api/halls", hallRoutes);
app.use("/api/hall-physical-info", hallPhysicalInfoRoutes);
app.use("/api/hall-systems", hallSystemRoutes);
app.use("/api/hall-water-feed", hallWaterFeedRoutes);
app.use("/api/hall-hygiene", hallHygieneRoutes);
// ==================================================

// ================================  تعریف دوره جوجه ریزی ها =========
app.use("/api/chick-placements", chickPlacementRoutes);

// ================================  گله (دوره پرورش) =========
app.use("/api/flocks", flockRoutes);

// ========================================================================

// =========================== مدیریت هفتگی ======================
app.use("/api/weekly", weeklyRoutes);
// ===============

// ==================== استانداردهای وزنی نژادها ====================
app.use("/api/breed-standards", breedStandardRoutes);
// ===================================================================

//================  گزارش بازدید ===================
app.use("/api/visit-reports", visitReportRoutes);

// ================================================

// ============================مسیرهای تست و مانیتورینگ============================

// مانیتورینگ ساده سرور (فقط نقش‌های مدیریتی)
app.get(
  "/api/server-status",
  protect,
  authorize("admin", "super_admin", "sub_admin"),
  (req, res) => {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    data: {
      uptime: {
        seconds: uptime,
        human: `${days} روز ${hours} ساعت ${minutes} دقیقه ${seconds} ثانیه`,
      },
      memory: {
        total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
        used: (usedMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
        free: (freeMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
        percent: ((usedMem / totalMem) * 100).toFixed(1) + "%",
      },
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model,
        loadAverage: {
          "1min": os.loadavg()[0]?.toFixed(2) || 0,
          "5min": os.loadavg()[1]?.toFixed(2) || 0,
          "15min": os.loadavg()[2]?.toFixed(2) || 0,
        },
      },
      node: {
        version: process.version,
        env: process.env.NODE_ENV || "development",
        memoryUsage: process.memoryUsage(),
      },
    },
  });
});
// ============================مسیرهای تست و مانیتورینگ============================

// ================== اطلاعات آب و هوایی==============
// اضافه کردن در فایل اصلی
app.use("/api/weather", weatherRoutes);
// ========================اطلاعات آب و هوایی=========

// =========================== سرویس پیامک--------------
app.use("/api/sms", smsRoutes);

// --------------------------سرویس پیامک----------------

// -------- داشبورد کارشناس-----------
// در فایل server.js، بعد از سایر روت‌ها اضافه کن:

app.use("/api/dashboard", dashboardRoutes);
// ----------

// ----------- روت بوکمارک ها -------------
// در server.js، بعد از سایر روت‌ها اضافه کن:

app.use("/api/bookmarks", bookmarkRoutes);
// ------------------بوکمارک ها#-----------

// =============================== روت مربوط به اطلاعات هدر صفحه پروفایل =============
// (mount دوبارهٔ /api/customers، /api/cities و /api/users حذف شد — قبلاً بالای فایل mount شده‌اند)
app.use("/api/customer-header", customerHeaderRoutes);
// =========

// =============================== روت اطلاعات پایان دوره (Flock Completion) =============
app.use("/api/flock-completions", flockCompletionRoutes);
// =========

// ============================================
// ✅ مدیریت خطاهای عمومی (به‌صورت JSON، نه HTML)
// مخصوصاً خطاهای multer تا پیام واضح به کاربر برسد
// ============================================
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  // خطاهای آپلود فایل (multer)
  if (error && error.name === "MulterError") {
    const messages = {
      LIMIT_FILE_SIZE: "حجم فایل بیش از حد مجاز است",
      LIMIT_FILE_COUNT: "تعداد فایل‌های ارسالی بیش از حد مجاز است",
      LIMIT_UNEXPECTED_FILE: `فیلد فایل ناشناخته: ${error.field || ""}`,
      LIMIT_PART_COUNT: "تعداد بخش‌های درخواست بیش از حد مجاز است",
      LIMIT_FIELD_COUNT: "تعداد فیلدهای درخواست بیش از حد مجاز است",
    };
    return errorResponse(res, messages[error.code] || "خطا در آپلود فایل", 400);
  }

  // خطای فیلتر نوع فایل (فرمت غیرمجاز)
  if (error && /مجاز (نیست|است)/.test(String(error.message || ""))) {
    return errorResponse(res, error.message, 400);
  }

  // بدنهٔ JSON نامعتبر یا خیلی بزرگ
  if (error && error.type === "entity.parse.failed") {
    return errorResponse(res, "ساختار دادهٔ ارسالی معتبر نیست", 400);
  }
  if (error && error.type === "entity.too.large") {
    return errorResponse(res, "حجم دادهٔ ارسالی بیش از حد مجاز است", 413);
  }

  console.error("❌ Unhandled error:", error);
  return errorResponse(res, error?.message || "خطای غیرمنتظره", 500);
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Server status: http://localhost:${PORT}/api/server-status`);
});

// ✅ خطاهای سطح سرور (مثلاً پورت اشغال) با پیام واضح، نه خروج بی‌صدا
server.on("error", (error) => {
  if (error && error.code === "EADDRINUSE") {
    console.error(
      `❌ پورت ${PORT} در حال استفاده است. یک نمونهٔ دیگر از سرور در حال اجراست یا پورت را در .env تغییر دهید (PORT=5001).`,
    );
  } else {
    console.error("❌ خطای سرور:", error);
  }
  process.exit(1);
});

// --------------------
