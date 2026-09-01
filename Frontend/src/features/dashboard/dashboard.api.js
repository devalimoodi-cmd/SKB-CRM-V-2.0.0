import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

export const dashboardApi = {
  // ===== گله‌ها =====

  // دریافت لیست گله‌ها با فیلتر
  async getFlocks(params = {}) {
    return apiService.get(API_CONSTANTS.ENDPOINTS.DASHBOARD.FLOCKS, params);
  },

  // دریافت اطلاعات یک گله
  async getFlock(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },

  // ===== خلاصه آماری =====

  // دریافت خلاصه آماری داشبورد
  async getSummary() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.DASHBOARD.SUMMARY);
  },

  // ===== داده‌های نمودارها =====

  // دریافت داده‌های نمودارها
  async getChartsData(customerId = null, flockId = null) {
    const params = {};
    if (customerId) params.customerId = customerId;
    if (flockId) params.flockId = flockId;
    return apiService.get(API_CONSTANTS.ENDPOINTS.DASHBOARD.CHARTS, params);
  },

  // ===== اطلاعات کامل مشتری =====

  // دریافت اطلاعات کامل مشتری برای مودال
  async getCustomerFullDetails(customerId, flockId = null) {
    let endpoint = API_CONSTANTS.ENDPOINTS.DASHBOARD.CUSTOMER_DETAILS.replace(
      ":id",
      customerId,
    );
    const params = {};
    if (flockId) params.flock_id = flockId;
    return apiService.get(endpoint, params);
  },

  // ===== بوکمارک‌ها =====

  // دریافت بوکمارک‌ها
  async getBookmarks(params = {}) {
    return apiService.get(API_CONSTANTS.ENDPOINTS.BOOKMARKS.LIST, params);
  },

  // ===== SMS =====

  // ارسال پیامک به مشتری (با فلوك و هفته اختیاری)
  async sendSms(customerId, message, extra = {}) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.SMS.SEND, {
      customerId,
      message,
      ...(extra.flockId ? { flockId: extra.flockId } : {}),
      ...(extra.weekNumber ? { weekNumber: extra.weekNumber } : {}),
    });
  },

  // دریافت اعتبار پیامک
  async getSmsCredit() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.SMS.CREDIT);
  },

  // دریافت تاریخچه پیامک‌های مشتری (GET /sms/log/:customerId)
  async getSmsHistory(customerId, flockId = null) {
    try {
      const endpoint = `${API_CONSTANTS.ENDPOINTS.SMS.LOG}/${customerId}`;
      const params = {};
      if (flockId) params.flock_id = flockId;

      const json = await apiService.get(endpoint, params);
      // بک‌اند آرایه مستقیم برمی‌گرداند: successResponse(res, logs, ...)
      // که shape آن { success: true, data: [...], message: "..." } است
      if (json.success && Array.isArray(json.data)) {
        return { success: true, data: json.data };
      }
      return { success: true, data: json.data || [] };
    } catch (e) {
      // اگر 404 باشد یعنی هیچ پیامکی وجود ندارد - خالی برگردان
      return { success: false, data: [] };
    }
  },

  // بررسی وضعیت پیامک
  async checkSmsStatus(messageId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.SMS.CHECK_STATUS.replace(
      ":id",
      messageId,
    );
    return apiService.get(endpoint);
  },

  // ❌ بروزرسانی وضعیت پیامک‌های ارسال‌شده یک گله (چک سرویس و ذخیره در دیتابیس)
  // ✅ مسیر درست: /sms/update-status/flock/:customerId/:flockId
  async updateSmsStatusForFlock(customerId, flockId) {
    return apiService.get(`/sms/update-status/flock/${customerId}/${flockId}`);
  },

  // ===== مشتریان =====

  // دریافت اطلاعات یک مشتری
  async getCustomer(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.DETAIL.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },
};
