// ============================================================
//  گارد «آدرس پایهٔ API» — موج ۱۳.۲۴
// ------------------------------------------------------------
//  چه چیزی را قفل می‌کند؟
//   ۱) روی سرور پروژه (پورت ۳۰۰۰) آدرس API **هم‌مبدأ** «/api» است؛
//      یعنی نه CORS لازم است نه پورت ۵۰۰۰ روی دستگاه (گوشی/adb reverse).
//      پیش از این آدرس مطلق http://localhost:5000/api بود ⇒ روی گوشی
//      با خطای «Failed to fetch» می‌خورد.
//   ۲) مسیرهایی که پروکسی ندارند (file:// و Live Server روی ۵۵۰۰)
//      همچنان آدرس مطلق می‌گیرند (سازگاری با توسعهٔ بدون npm start).
//   ۳) شبکهٔ داخلی/دامنهٔ واقعی → «/api» (پروکسی خودکار سرور فرانت).
//   ۴) override دستی (window.__API_BASE_URL__) همیشه اولویت دارد.
//   ۵) api.service.js خطای شبکه را به پیام فارسی + پرچم
//      `isNetworkError` تبدیل می‌کند (نه «Failed to fetch» خام).
//
//  اجرا:  npm run test:api-base       (در پوشهٔ Frontend)
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

// ============================================================
// ۰) بارگذاری ماژول config بدون مرورگر
// ------------------------------------------------------------
// config.const.js در ابتدا localStorage می‌خواند؛ در Node فقط همین
// یک تزریق لازم است (window عمداً تعریف نمی‌شود تا شاخهٔ سرور اجرا شود).
// ============================================================
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const configModule = await import("./src/core/constants/config.const.js");
const { resolveApiBaseUrl } = configModule;

const loc = (hostname, port = "", protocol = "http:") => ({ protocol, hostname, port });

// ============================================================
// ۱) پورت ۳۰۰۰ = سرور فرانت پروژه ⇒ هم‌مبدأ
// ============================================================
check(
  "۱۳.۲۴ · API: http://localhost:3000 ⇒ «/api» (هم‌مبدأ، بدون CORS و بدون پورت ۵۰۰۰)",
  resolveApiBaseUrl(loc("localhost", "3000")) === "/api",
);

check(
  "۱۳.۲۴ · API: 127.0.0.1:3000 و [::1]:3000 هم «/api» می‌دهند",
  resolveApiBaseUrl(loc("127.0.0.1", "3000")) === "/api" &&
    resolveApiBaseUrl(loc("[::1]", "3000")) === "/api",
);

check(
  "۱۳.۲۴ · API: گوشی/شبکهٔ محلی با IP لپ‌تاپ (…:3000) ⇒ «/api»",
  resolveApiBaseUrl(loc("192.168.1.50", "3000")) === "/api" &&
    resolveApiBaseUrl(loc("192.168.168.72", "3000")) === "/api",
);

check(
  "۱۳.۲۴ · API: دامنهٔ واقعی/سرور (با یا بدون پورت) ⇒ «/api»",
  resolveApiBaseUrl(loc("skb-crm.ir", "")) === "/api" &&
    resolveApiBaseUrl(loc("skb-crm.ir", "8433")) === "/api" &&
    resolveApiBaseUrl(loc("192.168.168.72", "")) === "/api",
);

// ============================================================
// ۲) مسیرهای بدون پروکسی: آدرس مطلق بک‌اند لوکال
// ============================================================
check(
  "۱۳.۲۴ · API: Live Server روی ۵۵۰۰ پروکسی ندارد ⇒ آدرس مطلق بک‌اند",
  resolveApiBaseUrl(loc("localhost", "5500")) === "http://localhost:5000/api" &&
    resolveApiBaseUrl(loc("127.0.0.1", "5500")) === "http://localhost:5000/api",
);

check(
  "۱۳.۲۴ · API: localhost بدون پورت و file:// ⇒ آدرس مطلق (رفتار قبلی حفظ شد)",
  resolveApiBaseUrl(loc("localhost", "")) === "http://localhost:5000/api" &&
    resolveApiBaseUrl(loc("", "", "file:")) === "http://localhost:5000/api" &&
    resolveApiBaseUrl(null) === "http://localhost:5000/api",
);

// ============================================================
// ۳) override دستی
// ============================================================
check(
  "۱۳.۲۴ · API: window.__API_BASE_URL__ همیشه اولویت دارد",
  resolveApiBaseUrl(loc("localhost", "3000"), "https://api.example.com/api") ===
    "https://api.example.com/api" &&
    resolveApiBaseUrl(loc("skb-crm.ir", ""), "/custom/api") === "/custom/api",
);


// ============================================================
// ۴) سیم‌کشی فایل‌ها
// ============================================================
const CONFIG_SRC = read("Frontend/src/core/constants/config.const.js");
const API_SERVICE = read("Frontend/src/core/services/api.service.js");
const LOGIN_HTML = read("Frontend/src/pages/login.html");

check(
  "۱۳.۲۴ · config.const.js: قاعدهٔ پورت ۳۰۰۰ ⇒ «/api» صریح است",
  /LOOPBACK_HOSTS/.test(CONFIG_SRC) &&
    /port === "3000"/.test(CONFIG_SRC) &&
    /return "\/api";/.test(CONFIG_SRC) &&
    /export const resolveApiBaseUrl/.test(CONFIG_SRC),
);

check(
  "۱۳.۲۴ · config.const.js: تصاویر /uploads با API هم‌مبدأ خالی می‌شوند (پروکسی)",
  /window\.API_URL = String\(CONFIG\.API_BASE_URL \|\| ""\)/.test(CONFIG_SRC) &&
    /replace\(\s*\/\\\/api\\\/\?\$\/, ""\)/.test(CONFIG_SRC),
);

check(
  "۱۳.۲۴ · api.service.js: خطای شبکه به پیام فارسی + پرچم isNetworkError تبدیل می‌شود",
  /isNetworkError\(error\) \{/.test(API_SERVICE) &&
    /toRequestError\(error, endpoint\) \{/.test(API_SERVICE) &&
    /ارتباط با سرور برقرار نشد/.test(API_SERVICE) &&
    (API_SERVICE.match(/throw this\.toRequestError\(error, endpoint\);/g) || []).length === 3,
);

check(
  "۱۳.۲۴ · api.service.js: AbortError به‌عنوان خطای شبکه گزارش نمی‌شود",
  /name === "AbortError"\) return false;/.test(API_SERVICE),
);

check(
  "۱۳.۲۴ · login.html: بررسی /api/ping برای پیام گویا (هم‌مبدأ، بدون توکن)",
  /fetch\('\/api\/ping'/.test(LOGIN_HTML) && /probeServer\(\);/.test(LOGIN_HTML),
);

// ============================================================
// جمع‌بندی
// ============================================================
const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log("");
console.log(`📊 API base guard: ${passed}/${results.length} PASS`);

if (failed > 0) {
  console.error(`❌ ${failed} بررسی ناموفق بود.`);
  process.exitCode = 1;
}
