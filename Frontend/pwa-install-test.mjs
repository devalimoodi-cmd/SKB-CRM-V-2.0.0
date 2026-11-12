// ============================================================
//  گارد «نصب‌پذیری PWA» — موج ۱۳.۲۴
// ------------------------------------------------------------
//  چرا این گارد؟
//   کاربر روی گوشی نمی‌توانست پورتال را نصب کند، چون مرورگر رویداد
//   `beforeinstallprompt` را هرگز نمی‌فرستاد. طبق معیار Chrome برای
//   نصب‌پذیری، manifest باید «آیکون ۱۹۲×۱۹۲ و ۵۱۲×۵۱۲» داشته باشد و
//   خودِ صفحه هم به manifest و service worker وصل باشد.
//
//  چه چیزی را قفل می‌کند؟
//   ۱) manifest: فیلدهای اجباری + icons با اندازهٔ ۱۹۲/۵۱۲ (+ maskable)
//   ۲) فایل آیکون‌ها واقعاً روی دیسک هستند و **ابعادشان** با sizes
//      اعلام‌شده یکی است (خواندن هدر IHDR خودِ PNG — نه اعتماد به JSON)
//   ۳) login.html و portal.html به manifest/آیکون وصل‌اند (کاربر روی
//      صفحهٔ ورود می‌ایستد؛ بدون این، نصب هیچ‌وقت پیشنهاد نمی‌شود)
//   ۴) pwa.service.js: ثبت service worker + نگه‌داشتن رویداد نصب،
//      idempotent، بدون alert و بدون کش‌کردن دادهٔ مشتری
//   ۵) sw.js همان قاعدهٔ دادهٔ ۱۳.۸/۱۳.۹ را نگه داشته است
//   ۶) اسکریپت ساخت آیکون‌ها موجود است (بازتولیدپذیری)
//
//  اجرا:  npm run test:pwa       (در پوشهٔ Frontend)
// ============================================================
import fs from "node:fs";
import path from "node:path";

const here = import.meta.dirname;
const ROOT = path.join(here, "..");

const results = [];
const check = (name, ok, extra = "") => {
  results.push(Boolean(ok));
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${extra ? " :: " + extra : ""}`);
};

const read = (rel) => {
  try {
    return fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
};

const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// ابعاد واقعی PNG از هدر IHDR (بدون هیچ کتابخانه‌ای)
const pngSize = (rel) => {
  try {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    if (buf.length < 24) return null;
    if (buf.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return null;
    if (buf.subarray(12, 16).toString("ascii") !== "IHDR") return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
};

const MANIFEST_PATH = "Frontend/src/public/manifest.webmanifest";
const MANIFEST_RAW = read(MANIFEST_PATH);

let manifest = null;
try {
  manifest = JSON.parse(MANIFEST_RAW);
} catch {
  manifest = null;
}

// ============================================================
// ۱) manifest معتبر است؟
// ============================================================
check(
  "۱۳.۲۴ · manifest: JSON معتبر با فیلدهای اجباری نصب‌پذیری",
  Boolean(manifest) &&
    typeof manifest.name === "string" &&
    manifest.name.length > 0 &&
    typeof manifest.short_name === "string" &&
    manifest.short_name.length > 0 &&
    manifest.start_url === "/portal" &&
    manifest.display === "standalone" &&
    manifest.scope === "/" &&
    manifest.dir === "rtl" &&
    manifest.lang === "fa" &&
    /^#[0-9a-f]{6}$/i.test(manifest.theme_color || "") &&
    /^#[0-9a-f]{6}$/i.test(manifest.background_color || ""),
);

check(
  "۱۳.۲۴ · manifest: prefer_related_applications هرگز true نیست",
  Boolean(manifest) && manifest.prefer_related_applications !== true,
);

// ============================================================
// ۲) آیکون‌ها: اندازهٔ اعلام‌شده + وجود فایل واقعی
// ============================================================
const icons = Array.isArray(manifest?.icons) ? manifest.icons : [];
const iconEntry = (sizes, purpose) =>
  icons.find((icon) => icon.sizes === sizes && (icon.purpose || "any") === purpose);

const icon192 = iconEntry("192x192", "any");
const icon512 = iconEntry("512x512", "any");
const maskable512 = iconEntry("512x512", "maskable");

check(
  "۱۳.۲۴ · manifest: آیکون ۱۹۲×۱۹۲ (any) تعریف شده است",
  Boolean(icon192) && icon192.type === "image/png",
  icon192 ? icon192.src : "missing",
);

check(
  "۱۳.۲۴ · manifest: آیکون ۵۱۲×۵۱۲ (any) تعریف شده است",
  Boolean(icon512) && icon512.type === "image/png",
  icon512 ? icon512.src : "missing",
);

check(
  "۱۳.۲۴ · manifest: آیکون ۵۱۲×۵۱۲ maskable (اندروید adaptive) تعریف شده است",
  Boolean(maskable512) && maskable512.type === "image/png",
  maskable512 ? maskable512.src : "missing",
);

const toDiskPath = (src) => `Frontend/src${String(src || "")}`;
const iconFiles = [
  { entry: icon192, expect: 192 },
  { entry: icon512, expect: 512 },
  { entry: maskable512, expect: 512 },
];

check(
  "۱۳.۲۴ · icons: همهٔ آیکون‌های manifest روی دیسک هستند و ابعادشان با sizes یکی است",
  iconFiles.every(({ entry, expect }) => {
    if (!entry || !String(entry.src || "").startsWith("/assets/")) return false;
    const size = pngSize(toDiskPath(entry.src));
    return Boolean(size) && size.width === expect && size.height === expect;
  }),
  iconFiles.map(({ entry }) => (entry ? entry.src : "?")).join(" | "),
);

check(
  "۱۳.۲۴ · icons: هیچ آیکون غیرمربع به‌عنوان آیکون نصب اعلام نشده است",
  icons.every((icon) => {
    const match = /^(\d+)x(\d+)$/.exec(String(icon.sizes || ""));
    if (!match) return true; // مثل "any" برای SVG
    return match[1] === match[2];
  }),
);


// ============================================================
// ۳) آیکون اپل + اسکریپت بازتولید آیکون‌ها
// ============================================================
const APPLE_ICON = "Frontend/src/assets/images/pwa/apple-touch-icon-180.png";
const appleSize = pngSize(APPLE_ICON);

check(
  "۱۳.۲۴ · icons: آیکون اپل‌تاک ۱۸۰×۱۸۰ برای iOS موجود است",
  Boolean(appleSize) && appleSize.width === 180 && appleSize.height === 180,
);

check(
  "۱۳.۲۴ · icons: اسکریپت ساخت آیکون‌ها موجود است (بازتولیدپذیر، بدون وابستگی npm)",
  exists("Frontend/scripts/generate-pwa-icons.ps1") &&
    /icon-192\.png/.test(read("Frontend/scripts/generate-pwa-icons.ps1")) &&
    /icon-maskable-512\.png/.test(read("Frontend/scripts/generate-pwa-icons.ps1")) &&
    /apple-touch-icon-180\.png/.test(read("Frontend/scripts/generate-pwa-icons.ps1")),
);

// ============================================================
// ۴) صفحه‌ها به manifest/آیکون وصل‌اند
// ============================================================
const LOGIN_HTML = read("Frontend/src/pages/login.html");
const PORTAL_HTML = read("Frontend/src/pages/portal.html");

check(
  "۱۳.۲۴ · login.html: manifest + theme-color + آیکون اپل (کاربر روی صفحهٔ ورود می‌ایستد)",
  /<link rel="manifest" href="\/manifest\.webmanifest">/.test(LOGIN_HTML) &&
    /<meta name="theme-color" content="#2c7a6e">/.test(LOGIN_HTML) &&
    /<link rel="apple-touch-icon" href="\/assets\/images\/pwa\/apple-touch-icon-180\.png">/.test(
      LOGIN_HTML,
    ),
);

check(
  "۱۳.۲۴ · login.html: pwa.service.js بارگذاری می‌شود (ثبت SW + نگه‌داشتن رویداد نصب)",
  /<script type="module" src="\/core\/services\/pwa\.service\.js"><\/script>/.test(LOGIN_HTML),
);

check(
  "۱۳.۲۴ · portal.html: manifest و ثبت درون‌خطی service worker دست‌نخورده مانده‌اند",
  /<link rel="manifest" href="\/manifest\.webmanifest">/.test(PORTAL_HTML) &&
    /navigator\.serviceWorker\.register\('\/sw\.js', \{ scope: '\/' \}\)/.test(PORTAL_HTML) &&
    /<link rel="apple-touch-icon" href="\/assets\/images\/pwa\/apple-touch-icon-180\.png">/.test(
      PORTAL_HTML,
    ),
);

// ============================================================
// ۵) pwa.service.js
// ============================================================
const PWA_SERVICE = read("Frontend/src/core/services/pwa.service.js");

check(
  "۱۳.۲۴ · pwa.service.js: ثبت service worker با scope «/» و مسیر /sw.js",
  /PWA_SW_URL = "\/sw\.js"/.test(PWA_SERVICE) &&
    /PWA_SW_SCOPE = "\/"/.test(PWA_SERVICE) &&
    /navigator\.serviceWorker\s*\.register\(PWA_SW_URL, \{ scope: PWA_SW_SCOPE \}\)/.test(
      PWA_SERVICE,
    ) &&
    /const registerServiceWorker/.test(PWA_SERVICE),
);

check(
  "۱۳.۲۴ · pwa.service.js: رویداد نصب نگه داشته می‌شود (preventDefault + prompt)",
  /"beforeinstallprompt"/.test(PWA_SERVICE) &&
    /event\.preventDefault\(\)/.test(PWA_SERVICE) &&
    /"appinstalled"/.test(PWA_SERVICE) &&
    /window\.__skbInstallPrompt = event;/.test(PWA_SERVICE),
);

check(
  "۱۳.۲۴ · pwa.service.js: تزریق تگ‌ها idempotent است (تکراری نمی‌سازد)",
  /if \(hasTag\(doc, spec\)\) return;/.test(PWA_SERVICE) &&
    /doc\.querySelector\(/.test(PWA_SERVICE) &&
    /doc\.head\.appendChild\(element\)/.test(PWA_SERVICE),
);

check(
  "۱۳.۲۴ · pwa.service.js: هیچ داده/پاسخی کش نمی‌شود و alert ندارد",
  !/caches\./.test(PWA_SERVICE) && !/\balert\s*\(/.test(PWA_SERVICE),
);

check(
  "۱۳.۲۴ · pwa.service.js: خطاها بی‌خطر رد می‌شوند (نبود PWA صفحه را نمی‌شکند)",
  /\.catch\(\(error\) => \{/.test(PWA_SERVICE) &&
    /console\.info\(/.test(PWA_SERVICE) &&
    /return null;/.test(PWA_SERVICE),
);

// ============================================================
// ۶) service worker: قاعدهٔ داده دست‌نخورده
// ============================================================
const SW_SRC = read("Frontend/src/public/sw.js");

check(
  "۱۳.۲۴ · sw.js: همچنان فقط /offline.html را precache می‌کند (قاعدهٔ دادهٔ ۱۳.۹)",
  /const SHELL_ASSETS = \["\/offline\.html"\]/.test(SW_SRC) &&
    /const OFFLINE_URL = "\/offline\.html"/.test(SW_SRC) &&
    !/caches\.put\(/.test(SW_SRC) &&
    /if \(url\.pathname\.startsWith\("\/api\/"\)\) return;/.test(SW_SRC),
);

check(
  "۱۳.۲۴ · sw.js: پوستهٔ آفلاین موجود است",
  exists("Frontend/src/public/offline.html"),
);

// ============================================================
// ۷) سرو فایل‌ها از سرور فرانت
// ============================================================
const SERVER_SRC = read("Frontend/server.js");

check(
  "۱۳.۲۴ · server.js: manifest با نوع درست و sw.js با Service-Worker-Allowed سرو می‌شوند",
  /"\/manifest\.webmanifest": \{/.test(SERVER_SRC) &&
    /application\/manifest\+json; charset=utf-8/.test(SERVER_SRC) &&
    /Service-Worker-Allowed/.test(SERVER_SRC) &&
    /"Cache-Control", "no-cache"/.test(SERVER_SRC),
);

check(
  "۱۳.۲۴ · server.js: آیکون‌ها از همان مسیر /assets (پوشهٔ src/assets) سرو می‌شوند",
  /app\.use\(\s*"\/assets",\s*assetCacheHeaders,\s*express\.static\(path\.join\(srcPath, "assets"\)\),?\s*\)/.test(
    SERVER_SRC,
  ) &&
    exists("Frontend/src/assets/images/pwa/icon-192.png"),
);

// ============================================================
// جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log("");
console.log(`📊 PWA install guard: ${passed}/${results.length} PASS`);

if (failed > 0) {
  console.error(`❌ ${failed} بررسی ناموفق بود.`);
  process.exitCode = 1;
}
