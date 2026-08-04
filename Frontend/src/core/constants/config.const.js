const CONFIG = (() => {
  const ENV = localStorage.getItem("app_env") || "development";

  // ================================================================
  // ✅ تشخیص خودکار آدرس API بر اساس hostname مرورگر
  // بدون نیاز به تغییر دستی بین لوکال و سرور
  // ================================================================
  const detectApiBaseUrl = () => {
    if (typeof window === "undefined") {
      return "http://localhost:5000/api";
    }
    const hostname = window.location.hostname;

    // لوکال / توسعه روی لپ‌تاپ → بک‌اند لوکال
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:5000/api";
    }

    // سرور اختصاصی → بک‌اند همان سرور
    if (hostname === "192.168.168.72") {
      return "http://192.168.168.72:5000/api";
    }

    // هر آدرس/دامنه دیگر → fallback به production
    return null;
  };

  const detectedApi = detectApiBaseUrl();

  const configs = {
    development: {
      API_BASE_URL: detectedApi || "http://192.168.168.72:5000/api",
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
}

console.log("✅ Config loaded");
console.log("🔑 TOKEN_KEY:", CONFIG.TOKEN_KEY); // ← برای دیباگ
console.log("👤 USER_KEY:", CONFIG.USER_KEY); // ← برای دیباگ
