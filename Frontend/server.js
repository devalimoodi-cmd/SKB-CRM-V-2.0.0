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

// ✅ گزینه عدم ذخیره در کش برای JS (تا مرورگر نسخه جدید را بگیرد)
const noStoreCache = {
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store");
  },
};

// 1. Assets (تصاویر، فونت‌ها)
app.use("/assets", express.static(path.join(srcPath, "assets")));

// 2. Core (هسته اصلی)
app.use("/core", express.static(path.join(srcPath, "core"), noStoreCache));

// 3. Features (ماژول‌های اصلی)
app.use(
  "/features",
  express.static(path.join(srcPath, "features"), noStoreCache),
);

// 4. Shared (کامپوننت‌های اشتراکی)
app.use("/shared", express.static(path.join(srcPath, "shared"), noStoreCache));

// 5. Styles (استایل‌های سراسری)
app.use("/styles", express.static(path.join(srcPath, "styles")));

// 6. Vendor (کتابخانه‌ها)
app.use("/vendor", express.static(path.join(srcPath, "vendor")));

// 7. Pages (صفحات HTML)
app.use("/pages", express.static(path.join(srcPath, "pages"), noStoreCache));

// 8. Public (فایل‌های عمومی)
app.use("/public", express.static(path.join(srcPath, "public")));

// 9. ✅ Node Modules (کتابخانه‌های npm)
app.use("/node_modules", express.static(path.join(__dirname, "node_modules")));

// ============================================
// ✅ API Proxy (به بک‌اند)
// - بدنهٔ JSON: همان JSON پارس‌شده
// - بدنهٔ FormData/فایل: خام و دست‌نخورده (stream)
// - پاسخ: همان‌طور که هست (JSON/فایل/متن) بدون تغییر
// ============================================

const { Readable } = require("node:stream");
const fs = require("node:fs");

// ✅ لاگ خطاهای پروکسی در فایل (برای تشخیص «بک‌اند خواب است»)
const LOG_DIR = path.join(__dirname, "logs");
const logProxyError = (message) => {
  try {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(
      path.join(LOG_DIR, "proxy-error.log"),
      `[${new Date().toISOString()}] ${message}\n`,
    );
  } catch {
    /* بی‌صدا رد شو - لاگ نباید خودش خطا بدهد */
  }
};

// کاندیدهای بک‌اند؛ اولین موردی که جواب بدهد استفاده می‌شود
const API_TARGETS = [
  process.env.API_URL,
  "http://127.0.0.1:5000/api",
  "http://localhost:5000/api",
  "http://192.168.168.72:5000/api",
].filter(Boolean);

let activeApiTarget = null; // آخرین تارگت سالم (برای سرعت)

// هدرهایی که نباید به بک‌اند منتقل شوند
const SKIP_HEADERS = new Set([
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
  "accept-encoding",
  "transfer-encoding",
]);

const buildForwardHeaders = (req) => {
  const headers = {};
  Object.entries(req.headers).forEach(([key, value]) => {
    if (!SKIP_HEADERS.has(key.toLowerCase()) && value !== undefined) {
      headers[key] = value;
    }
  });
  return headers;
};

app.use("/api", async (req, res) => {
  if (!req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ success: false, message: "Not found" });
  }

  const apiPath = req.originalUrl.replace(/^\/api/, "") || "/";
  const contentType = String(req.headers["content-type"] || "");
  const hasBody = !["GET", "HEAD", "OPTIONS"].includes(req.method);

  // ===== آماده‌سازی بدنه =====
  let body;
  let duplex;

  if (hasBody) {
    if (contentType.includes("application/json")) {
      body =
        req.body && Object.keys(req.body).length
          ? JSON.stringify(req.body)
          : undefined;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      body = new URLSearchParams(req.body || {}).toString();
    } else {
      // FormData / فایل / باینری → بدنهٔ خام بدون هیچ تغییری
      body = Readable.toWeb(req);
      duplex = "half";
    }
  }

  const targets = activeApiTarget
    ? [activeApiTarget, ...API_TARGETS.filter((t) => t !== activeApiTarget)]
    : API_TARGETS;

  let lastError = null;

  for (const base of targets) {
    const targetUrl = `${base.replace(/\/+$/, "")}${apiPath}`;

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: buildForwardHeaders(req),
        body,
        duplex,
        signal: AbortSignal.timeout(120000),
      });

      activeApiTarget = base;
      console.log(`🔄 Proxy: ${req.method} ${targetUrl} → ${response.status}`);

      res.status(response.status);

      const resContentType = response.headers.get("content-type");
      const resDisposition = response.headers.get("content-disposition");
      if (resContentType) res.setHeader("Content-Type", resContentType);
      if (resDisposition) {
        res.setHeader("Content-Disposition", resDisposition);
      }

      if (!response.body) return res.end();

      // ✅ پاسخ را همان‌طور که هست (JSON یا فایل) عبور بده
      return Readable.fromWeb(response.body).pipe(res);
    } catch (error) {
      lastError = error;
      if (activeApiTarget === base) activeApiTarget = null;
      const failMsg = `${req.method} ${targetUrl} → ${error.message}`;
      console.error(`❌ Proxy failed (${base}):`, error.message);
      logProxyError(failMsg);
    }
  }

  res.status(502).json({
    success: false,
    message: "خطا در ارتباط با سرور",
    error: lastError ? lastError.message : "Unknown error",
  });
});

// ============================================
// ✅ پروکسی فایل‌های آپلودی بک‌اند (تصاویر/پیوست‌ها) → هم‌مبدأ
// تا تصاویر از همان دامنهٔ سایت لود شوند (بدون نیاز به پورت ۵۰۰۰)
// ============================================
app.use("/uploads", async (req, res) => {
  const filePath = req.originalUrl.replace(/^\/uploads/, "") || "/";

  for (const base of API_TARGETS) {
    const origin = base.replace(/\/api\/?$/, "");
    const targetUrl = `${origin}/uploads${filePath}`;

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: buildForwardHeaders(req),
        signal: AbortSignal.timeout(60000),
      });

      if (response.status === 404) continue; // شاید روی تارگت دیگری باشد

      res.status(response.status);

      const resContentType = response.headers.get("content-type");
      if (resContentType) res.setHeader("Content-Type", resContentType);
      res.setHeader("Cache-Control", "public, max-age=86400");

      if (!response.body) return res.end();

      return Readable.fromWeb(response.body).pipe(res);
    } catch (error) {
      console.error(`❌ Uploads proxy failed (${targetUrl}):`, error.message);
      logProxyError(`[uploads] ${req.method} ${targetUrl} -> ${error.message}`);
    }
  }

  res.status(404).json({ success: false, message: "File not found" });
});

// ============================================
// ✅ صفحات اصلی (مسیرها)
// ============================================

// صفحه اصلی
app.get("/", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "dashboard.html"));
});

// ✅ ریدایرکت‌های با پسوند .html (برای سازگاری با app.service.js)
// index.html → داشبورد
app.get("/index.html", (req, res) => {
  res.redirect("/");
});

// dashboard.html → داشبورد
app.get("/dashboard.html", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "dashboard.html"));
});

// لاگین
app.get("/login", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "login.html"));
});

// لاگین با پسوند html (app.service.js به این ریدایرکت می‌کند)
app.get("/login.html", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "login.html"));
});

// پنل ادمین
app.get("/admin", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "admin-panel.html"));
});

// پنل ادمین با پسوند html
app.get("/admin-panel.html", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "admin-panel.html"));
});

// اطلاعات مشتری
app.get("/customer-info", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "customer-info.html"));
});

// اطلاعات مشتری با پسوند html
app.get("/customer-info.html", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "customer-info.html"));
});

// لیست مشتریان
app.get("/customers", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "customer-list.html"));
});

// لیست مشتریان با پسوند html
app.get("/customer-list.html", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "customer-list.html"));
});

// بوکمارک‌ها
app.get("/bookmarks", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "bookmarks.html"));
});

// بوکمارک‌ها با پسوند html
app.get("/bookmarks.html", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "bookmarks.html"));
});

// پیامک
app.get("/sms", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "sms.html"));
});

// پیامک با پسوند html
app.get("/sms.html", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "sms.html"));
});

// تنظیمات اولیه
app.get("/setup-admin", (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "setup-admin.html"));
});

// تنظیمات اولیه با پسوند html
app.get("/setup-admin.html", (req, res) => {
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
  console.log(
    `\n🔗 API Proxy: /api/* → ${activeApiTarget || API_TARGETS.join(" | ")}/*`,
  );
  console.log(`\n🖼️ Uploads Proxy: /uploads/* → بک‌اند /uploads/*`);
  console.log(
    `\n📦 Node Modules: /node_modules/* → ${path.join(__dirname, "node_modules")}`,
  );
});
