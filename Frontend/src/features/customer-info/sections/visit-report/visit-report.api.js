import { apiService } from "../../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../../core/constants/api.const.js";

export const visitReportApi = {
  // ===== واحدهای مشتری =====

  async getUnits(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.UNITS.LIST, params);
  },

  // ===== گزارش‌های بازدید =====

  // دریافت لیست گزارش‌ها
  async getReports(customerId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.VISIT_REPORTS.LIST.replace(
      ":customerId",
      customerId,
    );
    return apiService.get(endpoint);
  },

  // دریافت یک گزارش
  async getReport(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.VISIT_REPORTS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },

  // ایجاد گزارش جدید
  async createReport(formData, onProgress = null) {
    return apiService.postFormData(
      API_CONSTANTS.ENDPOINTS.VISIT_REPORTS.CREATE,
      formData,
      onProgress,
    );
  },

  // بروزرسانی گزارش
  async updateReport(id, formData, onProgress = null) {
    const endpoint = API_CONSTANTS.ENDPOINTS.VISIT_REPORTS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.putFormData(endpoint, formData, onProgress);
  },

  // حذف گزارش
  async deleteReport(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.VISIT_REPORTS.DELETE.replace(
      ":id",
      id,
    );
    return apiService.delete(endpoint);
  },

  // تغییر وضعیت گزارش
  async updateReportStatus(id, status) {
    const endpoint = API_CONSTANTS.ENDPOINTS.VISIT_REPORTS.STATUS.replace(
      ":id",
      id,
    );
    return apiService.put(endpoint, { status });
  },

  // دانلود پیوست
  async downloadAttachment(attachmentId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.VISIT_REPORTS.DOWNLOAD.replace(
      ":id",
      attachmentId,
    );
    const response = await fetch(`${apiService.baseURL}${endpoint}`, {
      headers: apiService.getFormDataHeaders(),
    });
    return response;
  },

  // ===== داده‌های مرتبط =====

  // دریافت سالن‌های مشتری
  async getHalls(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.HALLS.LIST, params);
  },

  // دریافت دوره‌های مشتری
  // دریافت کارشناسان
  async getExperts() {
    return apiService.get(`${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/experts`);
  },

  // دریافت واحدهای ارجاع
  async getForwardUnits() {
    return [
      { id: "nutrition", name: "واحد تغذیه" },
      { id: "health", name: "واحد بهداشت" },
      { id: "production", name: "واحد تولید" },
      { id: "sales", name: "واحد فروش" },
      { id: "quality", name: "واحد کنترل کیفیت" },
      { id: "management", name: "مدیریت" },
    ];
  },
};
