// اصلاحات خطای شبکه سرویس پیامک — smsService.js + smsController.js + sms.service.js
const fs = require("fs");

const files = {
  "c:/Users/RayanPartov/Desktop/SKB-CRM-V 2.0.0/Backend/services/smsService.js": [
    // 1) افزودن تایماوت و تابع خطای فارسی
    {
      from: `const axios = require("axios");`,
      to: `const axios = require("axios");\r\n\r\n// ================================================\r\n// تنظیمات تایماوت و پیام‌های خطای فارسی\r\n// ================================================\r\nconst AXIOS_TIMEOUT = 15000;\r\n\r\n// تبدیل خطاهای شبکه به پیام فارسی قابل فهم\r\nfunction getFriendlyError(error) {\r\n  if (!error) return "خطا در ارتباط با سرویس پیامک";\r\n  const code = error.code || "";\r\n  const networkCodes = [\r\n    "ETIMEDOUT",\r\n    "ECONNABORTED",\r\n    "ECONNREFUSED",\r\n    "ENOTFOUND",\r\n    "ENETUNREACH",\r\n    "EHOSTUNREACH",\r\n    "EADDRNOTAVAIL",\r\n    "EAI_AGAIN",\r\n    "ECONNRESET",\r\n  ];\r\n  if (networkCodes.includes(code)) {\r\n    return "خطا در اتصال به سرویس پیامک؛ اتصال اینترنت سرور را بررسی کنید";\r\n  }\r\n  if (error.response?.data?.message) return error.response.data.message;\r\n  if (error.message) return error.message;\r\n  return "خطا در ارتباط با سرویس پیامک";\r\n}`,
    global: false,
  },
    // 2) افزودن timeout به همه درخواست‌های axios
    {
      from: `headers: this.getHeaders(),`,
      to: `headers: this.getHeaders(), timeout: AXIOS_TIMEOUT,`,
      global: true,
    },
    // 3) حذف متغیر errorMsg و استفاده از error مستقیم در sendBulk
    {
      from: `      const errorMsg = error.response?.data || error.message;\r\n      console.error("❌ خطا در ارسال گروهی:", errorMsg);`,
      to: `      console.error("❌ خطا در ارسال گروهی:", error.response?.data || error.message);`,
      global: false,
    },
    // 4) حذف متغیر errorMsg و استفاده از error مستقیم در sendVerify
    {
      from: `      const errorMsg = error.response?.data || error.message;\r\n      console.error("❌ خطا در ارسال Verify:", errorMsg);`,
      to: `      console.error("❌ خطا در ارسال Verify:", error.response?.data || error.message);`,
      global: false,
    },
    // 5) پیام خطای فارسی در sendBulk و sendVerify
    {
      from: `        error: errorMsg.message || errorMsg,`,
      to: `        error: getFriendlyError(error),`,
      global: true,
    },
    {
      from: `        code: errorMsg.status || null,`,
      to: `        code: error.response?.status || null,`,
      global: true,
    },
  ],

  "c:/Users/RayanPartov/Desktop/SKB-CRM-V 2.0.0/Backend/controllers/smsController.js": [
    // تغییر وضعیت خطای ارسال از 400 به 502
    {
      from: `      errorResponse(res, result.error || "خطا در ارسال پیامک", 400);`,
      to: `      errorResponse(res, result.error || "خطا در ارسال پیامک", 502);`,
      global: false,
    },
  ],

  "c:/Users/RayanPartov/Desktop/SKB-CRM-V 2.0.0/Frontend/src/features/sms/sms.service.js": [
    // نمایش پیام خطای واقعی در صفحه پیامک
    {
      from: `      console.error("❌ Error sending SMS:", error);\r\n      notificationService.error("خطا در ارتباط با سرور");`,
      to: `      console.error("❌ Error sending SMS:", error);\r\n      notificationService.error(\r\n        error?.message && !error.message.includes("Failed to fetch")\r\n          ? error.message\r\n          : "خطا در ارتباط با سرور",\r\n      );`,
      global: false,
    },
  ],
};

for (const [file, edits] of Object.entries(files)) {
  let src = fs.readFileSync(file, "utf8");
  for (const edit of edits) {
    if (edit.global) {
      const count = src.split(edit.from).length - 1;
      if (count > 0) {
        src = src.split(edit.from).join(edit.to);
        console.log(`  ✓ ${file.split("/").pop()}: '${edit.from.slice(0, 40)}...' x${count}`);
      } else {
        console.log(`  ✗ ${file.split("/").pop()}: NOT FOUND -> ${edit.from.slice(0, 60)}`);
      }
    } else {
      if (src.includes(edit.from)) {
        src = src.split(edit.from).join(edit.to);
        console.log(`  ✓ ${file.split("/").pop()}: single replace`);
      } else {
        console.log(`  ✗ ${file.split("/").pop()}: NOT FOUND -> ${edit.from.slice(0, 60)}`);
      }
    }
  }
  fs.writeFileSync(file, src, "utf8");
}
console.log("DONE");
