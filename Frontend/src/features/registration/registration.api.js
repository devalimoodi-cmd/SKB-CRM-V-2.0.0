// ============================================================
// features/registration/registration.api.js
// لایهٔ ارتباط «ثبت‌نام عمومی» با سرور — فاز ۱۳.۶
// ------------------------------------------------------------
// چرا fetch خام و نه apiService؟
//   ۱) این دو اندپوینت **عمومی**اند (بدون توکن) و apiService در ۴۰۱ کاربر
//      را به /login می‌فرستد — برای یک مهمانِ در حال ثبت‌نام مطلوب نیست.
//   ۲) پاسخ خطای اعتبارسنجی سرور فیلدبه‌فیلد است (`errors: {field: msg}`)
//      و apiService فقط `message` را نگه می‌دارد.
//   ۳) همان الگوی صفحهٔ ورود (login.html) برای گرفتن کپچا.
// 🔒 هیچ داده‌ای اینجا ذخیره نمی‌شود؛ فقط درخواست/پاسخ.
// ============================================================
import { API_CONSTANTS } from "../../core/constants/api.const.js";

const endpoints = API_CONSTANTS.ENDPOINTS.REGISTRATIONS;

// آدرس پایه به‌صورت پویا (هم‌قاعده با api.service.js)
const baseURL = () =>
  window.CONFIG?.API_BASE_URL ||
  API_CONSTANTS.BASE_URL ||
  "http://localhost:5000/api";

// درخواست JSON با پاسخ امن (هرگز throw نمی‌کند)
const requestJson = async (endpoint, options = {}) => {
  try {
    const response = await fetch(`${baseURL()}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      ...options,
    });

    const json = await response.json().catch(() => null);

    return {
      ok: response.ok && json?.success === true,
      status: response.status,
      data: json?.data ?? null,
      message: json?.message || "",
      errors: json?.errors ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      message:
        "ارتباط با سرور برقرار نشد. اتصال اینترنت و دسترسی به سرور را بررسی کنید.",
      errors: null,
      networkError: error,
    };
  }
};

export const registrationApi = {
  // آیا ثبت‌نام باز است؟ (منبع حقیقت = سرور)
  async getConfig() {
    return requestJson(endpoints.CONFIG);
  },

  // ثبت درخواست (بدنه فقط فیلدهای فرم؛ هیچ role/status/customer_id)
  async create(payload) {
    return requestJson(endpoints.CREATE, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  // چالش کپچا (عمومی — همان مسیر صفحهٔ ورود)
  async getCaptcha() {
    return requestJson(API_CONSTANTS.ENDPOINTS.AUTH.CAPTCHA);
  },
};
