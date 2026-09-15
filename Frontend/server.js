// server.js (نسخه اصلاح شده برای ساختار جدید)

const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();

// ✅ اگر Nginx روی همین ماشین جلوتر از این سرور باشد، آی‌پی واقعی کاربر
// از X-Forwarded-For خوانده می‌شود و به بک‌اند هم پاس داده می‌شود.
app.set("trust proxy", "loopback");

// ✅ هدرهای امنیتی برای صفحات HTML خود سایت
// (CSP عمداً تنظیم نشده چون صفحات این پروژه اسکریپت/هندلر inline دارند)
app.use((req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );
  next();
});
const PORT = process.env.PORT || 3000;

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// ✅ مسیرهای استاتیک
// ============================================

const srcPath = path.join(__dirname, "src");

// ============================================
// ✅ نسخه‌دهی خودکار دارایی‌ها + سیاست کش
// ------------------------------------------------------------
// مشکل قبلی: همهٔ JSها با `no-store` فرستاده می‌شدند؛ یعنی در هر بازدید
// (و هر رفرش) مرورگر همهٔ ~۴۰ فایل را دوباره دانلود می‌کرد → روی اینترنت
// ضعیف کارخانه بسیار کند بود.
// راه‌حل:
//   ۱) هنگام سرو HTML، به آدرس CSSها و اسکریپت‌های کلاسیک محلی یک `?v=<نسخه>`
//      اضافه می‌شود (نسخه از جدیدترین زمان تغییر فایل‌ها ساخته می‌شود)
//   ۲) فایل‌های نسخه‌دار: کش یک‌سالهٔ immutable (بدون درخواست دوباره)
//   ۳) ⛔ تگ‌های <script type="module"> هرگز نسخه‌دار نمی‌شوند
//      URL یک ماژول ES «هویت» آن است؛ اگر در HTML `?v=` بگذاریم ولی همان فایل
//      با `import "…/x.js"` (بدون ?v) هم صدا زده شود، مرورگر آن را ماژول دوم
//      می‌بیند و **دو بار اجرا** می‌کند → دو سینگلتون، دو شنوندهٔ click روی یک
//      دکمه و دو درخواست برای یک کلیک (باگ واقعی: ثبت دوبارهٔ پیام تماس با ما)
//   ۴) ماژول‌ها و importهای داخلی: کش ۶۰ ثانیه‌ای + ETag (پاسخ ۳۰۴ سبک)
//   ۵) HTML: همیشه no-cache (با ETag → پاسخ ۳۰۴ سبک)
// ============================================
const ASSET_VERSION = computeAssetVersion();

function computeAssetVersion() {
  const roots = [
    path.join(srcPath, "core"),
    path.join(srcPath, "features"),
    path.join(srcPath, "shared"),
    path.join(srcPath, "styles"),
    path.join(srcPath, "assets"),
  ];
  let newest = 0;
  let count = 0;

  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (/\.(js|css)$/i.test(entry.name)) {
        try {
          const stat = fs.statSync(abs);
          if (stat.mtimeMs > newest) newest = stat.mtimeMs;
          count += 1;
        } catch {
          /* فایل در دسترس نیست */
        }
      }
    }
  };
  roots.forEach(walk);

  const stamp = new Date(newest || Date.now())
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "");
  return `${stamp}-${count}`;
}

const assetCacheHeaders = (req, res, next) => {
  const ext = path.extname(req.path || "").toLowerCase();
  const isScript = ext === ".js" || ext === ".mjs" || ext === ".css" || ext === ".map";

  if (ext === ".html" || ext === "") {
    res.setHeader("Cache-Control", "no-cache");
  } else if (isScript) {
    if (req.query && (req.query.v || req.query.version)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      res.setHeader("Cache-Control", "private, max-age=60, must-revalidate");
    }
  } else {
    res.setHeader("Cache-Control", "public, max-age=86400");
  }
  next();
};

// 1. Assets (تصاویر، فونت‌ها)
app.use("/assets", assetCacheHeaders, express.static(path.join(srcPath, "assets")));

// 2. Core (هسته اصلی)
app.use("/core", assetCacheHeaders, express.static(path.join(srcPath, "core")));

// 3. Features (ماژول‌های اصلی)
app.use(
  "/features",
  assetCacheHeaders,
  express.static(path.join(srcPath, "features")),
);

// 4. Shared (کامپوننت‌های اشتراکی)
app.use(
  "/shared",
  assetCacheHeaders,
  express.static(path.join(srcPath, "shared")),
);

// 5. Styles (استایل‌های سراسری)
app.use("/styles", assetCacheHeaders, express.static(path.join(srcPath, "styles")));

// 6. Vendor (کتابخانه‌ها)
app.use("/vendor", assetCacheHeaders, express.static(path.join(srcPath, "vendor")));

// 7. Pages (صفحات HTML)
app.use(
  "/pages",
  assetCacheHeaders,
  express.static(path.join(srcPath, "pages")),
);

// 8. Public (فایل‌های عمومی)
app.use("/public", assetCacheHeaders, express.static(path.join(srcPath, "public")));

// 9. ✅ Node Modules (کتابخانه‌های npm)
app.use(
  "/node_modules",
  assetCacheHeaders,
  express.static(path.join(__dirname, "node_modules")),
);

// ============================================
// ✅ نسخه‌دهی خودکار آدرس دارایی‌ها در صفحات HTML
// به‌جای تغییر دستی ~۲۵۰ تگ <script>/<link> در فایل‌های HTML، هنگام سرو هر
// صفحه به آدرس CSSها و اسکریپت‌های کلاسیک محلی یک `?v=<ASSET_VERSION>` اضافه
// می‌شود. نتیجه: مرورگر آن‌ها را یک‌ساله کش می‌کند و با هر استقرار نسخه عوض
// می‌شود → هم سرعت بالا، هم بدون «کش کهنه».
//
// ⛔ اما تگ‌های `type="module"` نسخه‌دار **نمی‌شوند**:
// ماژول‌های ES با URL شناسایی می‌شوند؛ اگر تگ HTML آدرس نسخه‌دار
// (`x.service.js?v=1`) بدهد و همان فایل با `import "../x.service.js"` هم
// استفاده شده باشد، مرورگر دو ماژول جدا می‌سازد و فایل **دو بار اجرا** می‌شود.
// نتیجهٔ آن: دو نمونهٔ سینگلتون → دو شنوندهٔ click روی یک دکمه → دو درخواست
// برای یک کلیک (همین باگ باعث ثبت دوبارهٔ پیام در صفحهٔ «تماس با ما» شده بود).
// کش ماژول‌ها از مسیر «۶۰ ثانیه + ETag» تأمین می‌شود که هم سریع است و هم بعد از
// استقرار، حداکثر تا ۶۰ ثانیه با یک ۳۰۴ سبک به‌روز می‌شود.
// ============================================
const LOCAL_ASSET_PATH = /\/(core|features|shared|styles|assets|vendor)\//;

const isModuleScriptTag = (tag) =>
  /\btype\s*=\s*(?:"module"|'module'|module)(?=\s|>|$)/i.test(tag);

const versionizeAssetUrl = (match, prefix, quote, url) => {
  if (/^(?:[a-z]+:)?\/\//i.test(url)) return match; // آدرس خارجی
  if (/(?:^|[?&])v=/.test(url)) return match; // قبلاً نسخه خورده
  if (url.includes("node_modules/")) return match; // کتابخانه‌های npm
  if (!LOCAL_ASSET_PATH.test(url)) return match;
  return `${prefix}${quote}${url}?v=${ASSET_VERSION}${quote}`;
};

const rewriteAssetUrls = (html) => {
  let output = String(html);

  // ۱) تگ‌های <script …> — فقط اسکریپت‌های کلاسیک (نه module)
  output = output.replace(/<script\b[^>]*>/gi, (tag) => {
    if (isModuleScriptTag(tag)) return tag;
    return tag.replace(
      /(\bsrc\s*=\s*)(["'])([^"']+?\.js(?:\?[^"']*)?)\2/i,
      versionizeAssetUrl,
    );
  });

  // ۲) لینک‌های CSS (و هر href دیگر) — ماژول ES از این مسیر لود نمی‌شود
  output = output.replace(
    /(\bhref\s*=\s*)(["'])([^"']+?\.(?:js|css)(?:\?[^"']*)?)\2/gi,
    versionizeAssetUrl,
  );

  return output;
};

// ============================================
// ✅ لودر سیستمی (تنظیم از پنل ادمین → تنظیمات سیستم)
// ------------------------------------------------------------
//  • دو حالت: classic (دایرهٔ چرخان) و logo (لوگوی ستاره کیان)
//    مارک‌آپ هر دو در shared/components/Loader/loader.html و
//    CSS آن‌ها در shared/components/Loader/loader.css است.
//  • مقدار loader_style از اندپوینت عمومی بک‌اند خوانده و کش می‌شود
//    (/api/public/ui-settings) و هر ۶۰ ثانیه تازه می‌شود.
//  • اتریبیوت data-loader روی تگ <html> و بلوک لودر بلافاصله بعد از
//    <body> تزریق می‌شود → نمایش فوری و بدون فلاش (نیازی به JS نیست).
//  • فقط در صفحه‌های سنگین سیستم تزریق می‌شود (LOADER_PAGES).
// ============================================
const LOADER_PAGES = new Set([
  "dashboard.html",
  "customer-list.html",
  "customer-info.html",
  "admin-panel.html",
]);
const LOADER_STYLE_DEFAULT = "classic";
const LOADER_CSS_URL = "/shared/components/Loader/loader.css";
const UI_SETTINGS_REFRESH_MS = 60 * 1000;

let uiSettings = { loader_style: LOADER_STYLE_DEFAULT };
let loaderMarkup = "";
try {
  loaderMarkup = fs.readFileSync(
    path.join(srcPath, "shared", "components", "Loader", "loader.html"),
    "utf8",
  );
} catch {
  console.warn("⚠️ مارک‌آپ لودر پیدا نشد؛ لودر سیستمی تزریق نمی‌شود");
}

const normalizeLoaderStyle = (value) =>
  String(value || "")
    .toLowerCase()
    .trim() === "logo"
    ? "logo"
    : LOADER_STYLE_DEFAULT;

// خواندن تنظیمات نمایشی از بک‌اند — اگر بک‌اند خواب بود، مقدار قبلی می‌ماند
const refreshUiSettings = async () => {
  // در حالت strict فقط API_URL استفاده می‌شود (مثل پروکسی) — تست‌ها هم
  // همین حالت را می‌گیرند تا به بک‌اند واقعی وصلی نشوند
  const targets = PROXY_STRICT
    ? [process.env.API_URL].filter(Boolean)
    : [
        process.env.API_URL,
        "http://127.0.0.1:5000/api",
        "http://localhost:5000/api",
      ].filter(Boolean);

  for (const target of targets) {
    try {
      const response = await fetch(`${target}/public/ui-settings`, {
        signal: AbortSignal.timeout(3000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const body = await response.json();
      if (body?.success && body.data) {
        uiSettings = { ...uiSettings, ...body.data };
        return true;
      }
    } catch {
      /* این تارگت در دسترس نیست → تارگت بعدی */
    }
  }
  return false;
};

const startUiSettingsRefresh = () => {
  refreshUiSettings();
  setInterval(refreshUiSettings, UI_SETTINGS_REFRESH_MS);
};

// تزریق اتریبیوت لودر + CSS + بلوک لودر در HTML صفحه
//  • صفحه‌های لیست سفید (LOADER_PAGES): اورلی تمام‌صفحه + حالت + CSS
//  • صفحه‌های دیگر: اگر لودر داخلی (data-skb-loader) داشته باشند،
//    فقط CSS + حالت تزریق می‌شود (بدون اورلی تمام‌صفحه)
const injectPageLoader = (html, filePath, overrideStyle) => {
  const fileName = path.basename(String(filePath)).toLowerCase();
  const isFullPageLoader = LOADER_PAGES.has(fileName);
  const hasInlineLoader = html.includes("data-skb-loader");

  if (!isFullPageLoader && !hasInlineLoader) return html;

  const style = normalizeLoaderStyle(overrideStyle || uiSettings.loader_style);

  // ۱) انتخاب حالت لودر روی تگ <html>
  // ✅ همیشه ست/اصلاح می‌شود — چون لودرهای داخل صفحه هم از همین حالت پیروی
  //    می‌کنند (shared/components/Loader/loader.service.js)
  let output = html.replace(/<html\b([^>]*)>/i, (match, attrs) => {
    if (/\bdata-loader\s*=/i.test(attrs)) {
      return match.replace(
        /\bdata-loader\s*=\s*("[^"]*"|'[^']*')/i,
        `data-loader="${style}"`,
      );
    }
    return `<html${attrs} data-loader="${style}">`;
  });

  // ۲) CSS لودر (نسخه‌دار → کش یک‌ساله)
  if (!output.includes(LOADER_CSS_URL)) {
    output = output.replace(
      /<\/head>/i,
      `    <link rel="stylesheet" href="${LOADER_CSS_URL}?v=${ASSET_VERSION}">\n</head>`,
    );
  }

  // ۳) اورلی تمام‌صفحه فقط برای صفحه‌های لیست سفید
  //    (اگر صفحه خودش اورلی داشته باشد یا مارک‌آپ در دسترس نباشد، تزریق نمی‌شود)
  if (!isFullPageLoader) return output;
  if (output.includes('id="pageLoadingOverlay"') || !loaderMarkup) return output;

  // ۳) بلوک لودر + مخفی‌کنندهٔ امن (بدون دیالوگ/وابستگی به JS)
  const loaderBlock = `
    <!-- ===== لودر سیستمی (تزریق خودکار — shared/components/Loader) ===== -->
    <div class="skb-page-loader" id="pageLoadingOverlay">
${loaderMarkup}
    </div>
    <script>
      // ✅ مخفی‌کنندهٔ امن: صفحه‌های خودشان هم می‌توانند window.hidePageLoader() را صدا بزنند
      (function () {
        var MAX_MS = 15000;
        window.hidePageLoader = function () {
          var el = document.getElementById("pageLoadingOverlay");
          if (!el || el.dataset.hidden === "1") return;
          el.dataset.hidden = "1";
          el.style.opacity = "0";
          setTimeout(function () {
            el.style.display = "none";
          }, 500);
        };
        setTimeout(window.hidePageLoader, MAX_MS);
      })();
    </script>
`;

  output = output.replace(/<body\b[^>]*>/i, (match) => `${match}\n${loaderBlock}`);
  return output;
};

const renderPageHtml = (html, filePath, overrideStyle) =>
  injectPageLoader(rewriteAssetUrls(html), filePath, overrideStyle);

app.use((req, res, next) => {
  const originalSendFile = res.sendFile.bind(res);
  res.sendFile = (filePath, options, callback) => {
    const isPageHtml =
      typeof filePath === "string" && /pages[\\/][^\\/]+\.html$/i.test(filePath);
    if (!isPageHtml) return originalSendFile(filePath, options, callback);

    return fs.readFile(filePath, "utf8", (error, html) => {
      if (error) {
        // ✅ اگر فایل صفحه وجود نداشت (مثلاً مسیر قدیمی/حذف‌شده) →
        // به‌جای خطای سرور، صفحهٔ ۴۰۴ نمایش داده شود
        const fallback = path.join(srcPath, "pages", "404.html");
        if (fs.existsSync(fallback) && filePath !== fallback) {
          return fs.readFile(fallback, "utf8", (fallbackError, fallbackHtml) => {
            if (fallbackError) return originalSendFile(filePath, options, callback);
            res.status(404);
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
            return res.send(rewriteAssetUrls(fallbackHtml));
          });
        }
        return originalSendFile(filePath, options, callback);
      }
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      // ✅ لودر سیستمی هم تزریق می‌شود (تنظیم از پنل ادمین)
      return res.send(renderPageHtml(html, filePath, req.query?.loader));
    });
  };
  next();
});

// ============================================
// ✅ API Proxy (به بک‌اند)
// - بدنهٔ JSON: همان JSON پارس‌شده
// - بدنهٔ FormData/فایل: خام و دست‌نخورده (stream)
// - پاسخ: همان‌طور که هست (JSON/فایل/متن) بدون تغییر
// ============================================

const { Readable } = require("node:stream");

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

// ✅ حالت سخت‌گیرانهٔ پروکسی (PROXY_STRICT=true)
// دلیل وجود: در حالت عادی، اگر API_URL اشتباه باشد یا بک‌اند اصلی بالا نباشد،
// درخواست‌ها بی‌صدا به کاندیدهای بعدی (مثلاً بک‌اند قدیمی روی پورت 5000) می‌روند
// و خطای پیکربندی پنهان می‌ماند. در حالت strict فقط API_URL استفاده می‌شود.
const PROXY_STRICT =
  String(process.env.PROXY_STRICT || "").toLowerCase() === "true";

const DEFAULT_API_TARGET = "http://127.0.0.1:5000/api";

// کاندیدهای بک‌اند؛ اولین موردی که جواب بدهد استفاده می‌شود
const API_TARGETS = PROXY_STRICT
  ? [process.env.API_URL || DEFAULT_API_TARGET]
  : [
      process.env.API_URL,
      DEFAULT_API_TARGET,
      "http://localhost:5000/api",
      "http://192.168.168.72:5000/api",
    ].filter(Boolean);

if (PROXY_STRICT) {
  console.log(`🔒 Proxy: حالت strict فعال — فقط ${API_TARGETS[0]} استفاده می‌شود`);
  if (!process.env.API_URL) {
    console.warn(
      "⚠️  PROXY_STRICT=true است ولی API_URL تعیین نشده → از " +
        DEFAULT_API_TARGET +
        " استفاده می‌شود. API_URL را در محیط تنظیم کنید.",
    );
  }
}

let activeApiTarget = null; // آخرین تارگت سالم (برای سرعت)

// ✅ حداکثر زمان انتظار برای بک‌اند
// آپلودهای بزرگ (تا ۵۰۰MB) به زمان بیشتری از حالت پیش‌فرض نیاز دارند
// قابل تغییر با متغیر محیطی: PROXY_TIMEOUT_MS
const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 600000); // ۱۰ دقیقه

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
  headers["x-forwarded-for"] = req.ip;
  headers["x-real-ip"] = req.ip;
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

  // ✅ ترتیب تلاش: تارگت سالم فعلی، سپس بقیهٔ کاندیدها (بدون تکرار)
  const targets = [
    ...new Set(
      (activeApiTarget ? [activeApiTarget, ...API_TARGETS] : API_TARGETS).filter(
        Boolean,
      ),
    ),
  ];

  let lastError = null;

  for (const base of targets) {
    const targetUrl = `${base.replace(/\/+$/, "")}${apiPath}`;

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: buildForwardHeaders(req),
        body,
        duplex,
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
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

// ===== صفحه‌های اطلاعاتی (عمومی، بدون نیاز به ورود) =====
app.get(["/about", "/about.html"], (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "about.html"));
});

app.get(["/contact", "/contact.html"], (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "contact.html"));
});

app.get(["/help", "/help.html"], (req, res) => {
  res.sendFile(path.join(srcPath, "pages", "help.html"));
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
// ✅ شروع به‌روزرسانی دوره‌ای تنظیمات نمایشی (لودر سیستمی)
startUiSettingsRefresh();

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
  console.log(`\n🏷️ Asset version: ${ASSET_VERSION} (نسخه‌دهی خودکار JS/CSS)`);
  console.log(
    `\n📦 Node Modules: /node_modules/* → ${path.join(__dirname, "node_modules")}`,
  );
});
