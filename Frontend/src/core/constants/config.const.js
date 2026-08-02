const CONFIG = (() => {
  const ENV = localStorage.getItem("app_env") || "development";

  const configs = {
    development: {
      API_BASE_URL: "http://localhost:5000/api",
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
