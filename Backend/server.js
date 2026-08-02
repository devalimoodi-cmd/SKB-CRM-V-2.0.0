const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { connectDB } = require("./config/database");
const path = require("path");
const os = require("os");

// Routes
const customerRegistrationRoutes = require("./routes/customerRegistrationRoutes");
const cityRoutes = require("./routes/cityRoutes");
const userRoutes = require("./routes/userRoutes");
const periodRoutes = require("./routes/periodRoutes");
const dictionaryRoutes = require("./routes/dictionaryRoutes");
const hallRoutes = require("./routes/hallRoutes");
const hallPhysicalInfoRoutes = require("./routes/hallPhysicalInfoRoutes");
const hallSystemRoutes = require("./routes/hallSystemRoutes");
const hallWaterFeedRoutes = require("./routes/hallWaterFeedRoutes");
const hallHygieneRoutes = require("./routes/hallHygieneRoutes");
const chickPlacementRoutes = require("./routes/chickPlacementRoutes");
const weeklyRoutes = require("./routes/weeklyRoutes");

const weatherRoutes = require("./routes/weatherRoutes");
const smsRoutes = require("./routes/smsRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const bookmarkRoutes = require("./routes/bookmarkRoutes");
const customerHeaderRoutes = require("./routes/customerHeaderRoutes");

// ================== ###==========

// ارتباط بین جداول دیتابیس
require("./models/associations");
// ===

dotenv.config();

const app = express();

// ============================================
// Middlewareها -
// ============================================

// CORS - باید اول باشد
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// برای دریافت JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// برای سرو فایل‌های استاتیک (عکس‌ها)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// =================
// مسیرهای جداول دیکشنری
// =================
app.use("/api/dictionary", dictionaryRoutes);
// =================

// ================مسیر تعریف و مدیریت دوره ها============
app.use("/api/periods", periodRoutes);
// ===============مسیر تعریف و مدیریت دوره ها ============

// ==================== روت‌های مدیریت سالن ====================
app.use("/api/halls", hallRoutes);
app.use("/api/hall-physical-info", hallPhysicalInfoRoutes);
app.use("/api/hall-systems", hallSystemRoutes);
app.use("/api/hall-water-feed", hallWaterFeedRoutes);
app.use("/api/hall-hygiene", hallHygieneRoutes);
// ==================================================

// ================================  تعریف دوره جوجه ریزی ها =========
app.use("/api/chick-placements", chickPlacementRoutes);

// ========================================================================

// =========================== مدیریت هفتگی ======================
app.use("/api/weekly", weeklyRoutes);
// ===============

//================  گزارش بازدید ===================
const visitReportRoutes = require("./routes/visitReportRoutes");
app.use("/api/visit-reports", visitReportRoutes);

// ================================================

// ============================مسیرهای تست و مانیتورینگ============================
app.get("/", (req, res) => {
  res.json({ message: "Server is running!" });
});

app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// مانیتورینگ ساده سرور
app.get("/api/server-status", (req, res) => {
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
app.use("/api/customers", customerRegistrationRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/users", userRoutes);
app.use("/api/customer-header", customerHeaderRoutes);
// =========

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Server status: http://localhost:${PORT}/api/server-status`);
});

// --------------------
