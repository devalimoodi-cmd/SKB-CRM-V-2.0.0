// ================================================================
// ✅ تشخیص خودکار آدرس API بر اساس مبدأ صفحه (موج ۱۳.۲۴)
// ----------------------------------------------------------------
// 🔴 مشکلی که این موج رفع می‌کند («Failed to fetch» روی گوشی):
//   پیش از این روی localhost آدرس **مطلق** `http://localhost:5000/api`
//   برمی‌گشت؛ یعنی درخواست لاگین cross-origin به پورت ۵۰۰۰ می‌رفت،
//   در حالی که خودِ صفحه و کپچا از پروکسی هم‌مبدأ `/api` می‌آمدند.
//   روی گوشی (adb reverse یا شبکهٔ محلی) یا پورت ۵۰۰۰ در دسترس نبود
//   یا مبدأ صفحه در فهرست مجاز CORS نبود ⇒ مرورگر فقط
//   «Failed to fetch» نشان می‌داد.
//
// ✅ قاعدهٔ تازه:
//   • صفحه از سرور پروژه (`Frontend/server.js` روی پورت ۳۰۰۰) یا از
//     دامنهٔ واقعی/شبکه سرو شود ⇒ همان‌مبدأ `/api` (پروکسی خودکار)
//     ⇒ نه CORS لازم است، نه دسترسی به پورت ۵۰۰۰ از دستگاه.
//   • فقط جایی که پروکسی وجود ندارد (file:// یا Live Server روی ۵۵۰۰)
//     آدرس مطلق بک‌اند لوکال استفاده می‌شود.
// ================================================================
const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const LOCAL_API_BASE_URL = "http://localhost:5000/api";

/**
 * آدرس پایهٔ API را از مبدأ صفحه حساب می‌کند.
 * تابع **خالص** است (به window دست نمی‌زند) تا در گارد-تست اجرا شود.
 * @param {{protocol?:string, hostname?:string, port?:string}|null} loc
 * @param {string} [override] - مقدار دستی window.__API_BASE_URL__
 * @returns {string} آدرس مطلق یا مسیر هم‌مبدأ «/api»
 */
export const resolveApiBaseUrl = (loc, override) => {
  // ✅ امکان تعیین دستی از بیرون (اختیاری)
  // مثال قبل از لود config:  window.__API_BASE_URL__ = "https://api.example.com/api"
  if (override) return String(override);

  // باز کردن مستقیم فایل (file://) → بک‌اند لوکال (هیچ پروکسی‌ای نیست)
  if (!loc || loc.protocol === "file:") return LOCAL_API_BASE_URL;

  const hostname = String(loc.hostname || "");
  const port = String(loc.port || "");

  if (LOOPBACK_HOSTS.includes(hostname)) {
    // ۳۰۰۰ = سرور فرانت پروژه (npm start) که /api را به بک‌اند پروکسی می‌کند
    if (port === "3000") return "/api";
    // هر سرور استاتیک دیگر (مثل Live Server روی ۵۵۰۰) پروکسی ندارد
    return LOCAL_API_BASE_URL;
  }

  // ✅ شبکهٔ داخلی، دامنهٔ واقعی و گوشی با IP لپ‌تاپ → پروکسی هم‌مبدأ
  // Frontend/server.js مسیر /api را به بک‌اند پروکسی می‌کند؛
  // بنابراین مرورگر فقط به پورتِ خودِ سایت نیاز دارد (نه پورت ۵۰۰۰)
  // و مشکل فایروال/عدم دسترسی به IP خصوصی از اینترنت حل می‌شود.
  return "/api";
};

const CONFIG = (() => {
  const ENV = localStorage.getItem("app_env") || "development";

  const detectApiBaseUrl = () => {
    if (typeof window === "undefined") return LOCAL_API_BASE_URL;
    return resolveApiBaseUrl(window.location, window.__API_BASE_URL__);
  };

  const detectedApi = detectApiBaseUrl();

  const configs = {
    development: {
      API_BASE_URL: detectedApi || "/api",
      APP_NAME: "SKB-CRM (Dev)",
      ENABLE_LOGS: true,
      DEFAULT_PAGE_SIZE: 10,
      // ✅ اضافه کن:
      TOKEN_KEY: "adminToken",
      USER_KEY: "user",
    },
    test: {
      API_BASE_URL: "http://test.skb-crm.ir/api",
      APP_NAME: "SKB-CRM (Test)",
      ENABLE_LOGS: true,
      DEFAULT_PAGE_SIZE: 10,
      // ✅ اضافه کن:
      TOKEN_KEY: "adminToken",
      USER_KEY: "user",
    },
    production: {
      API_BASE_URL: "https://api.skb-crm.ir/api",
      APP_NAME: "SKB-CRM",
      ENABLE_LOGS: false,
      DEFAULT_PAGE_SIZE: 10,
      // ✅ اضافه کن:
      TOKEN_KEY: "adminToken",
      USER_KEY: "user",
    },
  };

  const current = configs[ENV] || configs.development;

  // اگر hostname شناخته‌شده بود، اولویت با آن است (هم لوکال هم سرور)
  if (detectedApi) {
    current.API_BASE_URL = detectedApi;
  }

  return {
    ...current,
    ENV,
    // ✅ اینا رو هم اضافه کن (برای اطمینان):
    TOKEN_KEY: current.TOKEN_KEY || "adminToken",
    USER_KEY: current.USER_KEY || "user",

    getApiUrl(endpoint = "") {
      const clean = endpoint.startsWith("/") ? endpoint : "/" + endpoint;
      return `${this.API_BASE_URL}${clean}`;
    },
    isDevelopment() {
      return this.ENV === "development";
    },
    isProduction() {
      return this.ENV === "production";
    },
    isTest() {
      return this.ENV === "test";
    },
    log(...args) {
      if (this.ENABLE_LOGS) {
        console.log(...args);
      }
    },
  };
})();

// ✅ هر دو روش رو پشتیبانی کن
export default CONFIG;
export { CONFIG };

// قرار دادن در window
if (typeof window !== "undefined") {
  window.CONFIG = CONFIG;

  // ✅ آدرس پایهٔ فایل‌های استاتیک بک‌اند (تصاویر /uploads/...)
  // وقتی API هم‌مبدأ («/api») باشد مقدار خالی می‌شود تا تصاویر
  // از همان دامنهٔ سایت (پروکسی) لود شوند.
  window.API_URL = String(CONFIG.API_BASE_URL || "").replace(/\/api\/?$/, "");
}

console.log("✅ Config loaded");
console.log("🔑 TOKEN_KEY:", CONFIG.TOKEN_KEY); // ← برای دیباگ
console.log("👤 USER_KEY:", CONFIG.USER_KEY); // ← برای دیباگ
