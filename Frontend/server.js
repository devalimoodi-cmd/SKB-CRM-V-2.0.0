// server.js (نسخه اصلاح شده برای ساختار جدید)

const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ✅ مسیرهای استاتیک
// ============================================

const srcPath = path.join(__dirname, "src");

// 1. Assets (تصاویر، فونت‌ها)
app.use("/assets", express.static(path.join(srcPath, "assets")));

// 2. Core (هسته اصلی)
app.use("/core", express.static(path.join(srcPath, "core")));

// 3. Features (ماژول‌های اصلی)
app.use("/features", express.static(path.join(srcPath, "features")));

// 4. Shared (کامپوننت‌های اشتراکی)
app.use("/shared", express.static(path.join(srcPath, "shared")));

// 5. Styles (استایل‌های سراسری)
app.use("/styles", express.static(path.join(srcPath, "styles")));

// 6. Vendor (کتابخانه‌ها)
app.use("/vendor", express.static(path.join(srcPath, "vendor")));

// 7. Pages (صفحات HTML)
app.use("/pages", express.static(path.join(srcPath, "pages")));

// 8. Public (فایل‌های عمومی)
app.use("/public", express.static(path.join(srcPath, "public")));

// 9. ✅ Node Modules (کتابخانه‌های npm)
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));

// ============================================
// ✅ API Proxy (به بک‌اند)
// ============================================

const API_URL = process.env.API_URL || "http://localhost:5000/api";

app.use("/api", async (req, res) => {
  if (!req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  try {
    const targetUrl = `${API_URL}${req.originalUrl.replace("/api", "")}`;
    console.log(`🔄 Proxy: ${req.method} ${targetUrl}`);

    const options = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...req.headers,
      },
    };

    delete options.headers.host;
    delete options.headers.connection;
    delete options.headers["content-length"];

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const data = await response.json();

    res.status(response.status).json(data);
  } catch (error) {
    console.error("❌ Proxy error:", error);
    res.status(500).json({
      success: false,
      message: "خطا در ارتباط با سرور",
      error: error.message,
    });
  }
});

// ============================================
// ✅ صفحات اصلی (مسیرها)
// ============================================

// صفحه اصلی
app.get("/", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "dashboard.html"));
});

// لاگین
app.get("/login", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "login.html"));
});

// پنل ادمین
app.get("/admin", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "admin-panel.html"));
});

// اطلاعات مشتری
app.get("/customer-info", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "customer-info.html"));
});

// لیست مشتریان
app.get("/customers", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "customer-list.html"));
});

// بوکمارک‌ها
app.get("/bookmarks", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "bookmarks.html"));
});

// پیامک
app.get("/sms", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "sms.html"));
});

// تنظیمات اولیه
app.get("/setup-admin", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "setup-admin.html"));
});

// ============================================
// ✅ 404
// ============================================
app.use((req, res) => {
  res.status(404).sendFile(path.join(srcPath, "pages", "404.html"));
});

// ============================================
// ✅ شروع سرور
// ============================================
app.listen(PORT, () => {
  console.log(`\n✅ Server is running on http://localhost:${PORT}`);
  console.log(`\n📁 Source path: ${srcPath}`);
  console.log(`\n📌 Routes:`);
  console.log(`   /            → صفحه اصلی (داشبورد)`);
  console.log(`   /login       → صفحه ورود`);
  console.log(`   /admin       → پنل مدیریت`);
  console.log(`   /customer-info → اطلاعات مشتری`);
  console.log(`   /customers   → لیست مشتریان`);
  console.log(`   /bookmarks   → بوکمارک‌ها`);
  console.log(`   /sms         → مدیریت پیامک`);
  console.log(`   /setup-admin → تنظیمات اولیه`);
  console.log(`\n🔗 API Proxy: /api/* → ${API_URL}/*`);
  console.log(
    `\n📦 Node Modules: /node_modules/* → ${path.join(__dirname, "node_modules")}`,
  );
});
