import { apiService } from "../../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../../core/constants/api.const.js";

export const weeklyApi = {
  // ===== رکوردهای هفتگی =====

  // دریافت رکوردهای هفتگی یک گله
  async getWeeklyRecords(chickPlacementId) {
    const params = { chick_placement_id: chickPlacementId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.WEEKLY.LIST, params);
  },

  // دریافت یک رکورد هفتگی
  async getWeeklyRecord(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.WEEKLY.UPDATE.replace(":id", id);
    return apiService.get(endpoint);
  },

  // ایجاد رکورد هفتگی جدید
  async createWeeklyRecord(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.WEEKLY.CREATE, data);
  },

  // بروزرسانی رکورد هفتگی
  async updateWeeklyRecord(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.WEEKLY.UPDATE.replace(":id", id);
    return apiService.put(endpoint, data);
  },

  // حذف رکورد هفتگی
  async deleteWeeklyRecord(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.WEEKLY.DELETE.replace(":id", id);
    return apiService.delete(endpoint);
  },

  // ===== دیکشنری‌ها =====

  // دریافت بیماری‌ها
  async getDiseases() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/diseases`,
    );
  },

  // دریافت واکسن‌ها
  async getVaccines() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/vaccines`,
    );
  },

  // دریافت داروها
  async getMedicines() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/medicines`,
    );
  },

  // دریافت انواع خوراک
  async getFeedTypes() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/feed-types`,
    );
  },

  // دریافت انواع پیشنهادات
  async getSuggestions() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/suggestion-types`,
    );
  },

  // دریافت کارشناسان
  async getExperts() {
    return apiService.get(`${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/experts`);
  },

  // ===== داده‌های مرتبط =====

  // دریافت گله‌های فعال مشتری
  async getActiveFlocks(customerId, params = {}) {
    const queryParams = {
      customer_id: customerId,
      is_active: true,
      ...params,
    };
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.LIST,
      queryParams,
    );
  },

  // دریافت اطلاعات یک گله
  async getFlock(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },

  // دریافت اطلاعات یک سالن
  async getHall(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALLS.UPDATE.replace(":id", id);
    return apiService.get(endpoint);
  },

  // دریافت اطلاعات مشتری
  async getCustomer(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.DETAIL.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },

  // دریافت واحدهای مشتری
  async getUnits(customerId) {
    const params = { customer_id: customerId, limit: 100 };
    return apiService.get(API_CONSTANTS.ENDPOINTS.UNITS.LIST, params);
  },

  // دریافت سالن‌های مشتری
  async getHalls(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.HALLS.LIST, params);
  },

  // ===== گزارش‌ها =====

  // دریافت گزارش کامل هفتگی
  async getWeeklyReport(customerId, params = {}) {
    const queryParams = { customer_id: customerId, ...params };
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.WEEKLY.LIST}/report`,
      queryParams,
    );
  },
};
