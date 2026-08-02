import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

export const smsApi = {
  // ===== ارسال پیامک =====

  // ارسال پیامک به یک مشتری
  async sendToCustomer(customerId, message) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.SMS.SEND, {
      customerId,
      message,
    });
  },

  // ارسال پیامک گروهی
  async sendBulkToCustomers(customerIds, message) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.SMS.BULK, {
      customerIds,
      message,
    });
  },

  // ارسال پیامک با قالب
  async sendWithTemplate(customerId, templateId, variables = {}) {
    return apiService.post(`${API_CONSTANTS.ENDPOINTS.SMS.SEND}/template`, {
      customerId,
      templateId,
      variables,
    });
  },

  // ===== مدیریت پیامک‌ها =====

  // دریافت تاریخچه پیامک‌ها
  async getSmsHistory(customerId = null, params = {}) {
    let endpoint = API_CONSTANTS.ENDPOINTS.SMS.LOG;
    if (customerId) {
      endpoint += `/${customerId}`;
    }
    return apiService.get(endpoint, params);
  },

  // دریافت تاریخچه پیامک‌های یک گله
  async getSmsHistoryByFlock(flockId) {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.SMS.LOG}/flock/${flockId}`,
    );
  },

  // دریافت یک پیامک
  async getSms(id) {
    return apiService.get(`${API_CONSTANTS.ENDPOINTS.SMS.LOG}/${id}`);
  },

  // ===== وضعیت پیامک =====

  // بررسی وضعیت پیامک
  async checkStatus(messageId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.SMS.CHECK_STATUS.replace(
      ":id",
      messageId,
    );
    return apiService.get(endpoint);
  },

  // بروزرسانی وضعیت پیامک‌های یک گله
  async updateFlockStatus(customerId, flockId) {
    return apiService.put(
      `${API_CONSTANTS.ENDPOINTS.SMS.LOG}/update-status/flock/${customerId}/${flockId}`,
    );
  },

  // ===== اعتبار =====

  // دریافت اعتبار پیامک
  async getCredit() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.SMS.CREDIT);
  },

  // ===== قالب‌ها =====

  // دریافت لیست قالب‌ها
  async getTemplates() {
    return apiService.get(`${API_CONSTANTS.ENDPOINTS.SMS.LOG}/templates`);
  },

  // دریافت یک قالب
  async getTemplate(id) {
    return apiService.get(`${API_CONSTANTS.ENDPOINTS.SMS.LOG}/templates/${id}`);
  },

  // ===== گزارش‌ها =====

  // دریافت گزارش ارسال
  async getReport(params = {}) {
    return apiService.get(`${API_CONSTANTS.ENDPOINTS.SMS.LOG}/report`, params);
  },

  // دریافت آمار پیامک‌ها
  async getStats() {
    return apiService.get(`${API_CONSTANTS.ENDPOINTS.SMS.LOG}/stats`);
  },
};
