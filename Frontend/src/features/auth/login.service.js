import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

export const bookmarksApi = {
  // ===== بوکمارک‌ها =====

  // دریافت لیست بوکمارک‌ها
  async getBookmarks(params = {}) {
    return apiService.get(API_CONSTANTS.ENDPOINTS.BOOKMARKS.LIST, params);
  },

  // دریافت یک بوکمارک
  async getBookmark(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.BOOKMARKS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },

  // ایجاد بوکمارک جدید
  async createBookmark(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.BOOKMARKS.CREATE, data);
  },

  // بروزرسانی بوکمارک
  async updateBookmark(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.BOOKMARKS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.put(endpoint, data);
  },

  // تغییر وضعیت بوکمارک
  async changeBookmarkStatus(id, status) {
    const endpoint = API_CONSTANTS.ENDPOINTS.BOOKMARKS.STATUS.replace(
      ":id",
      id,
    );
    return apiService.patch(endpoint, { status });
  },

  // حذف بوکمارک
  async deleteBookmark(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.BOOKMARKS.DELETE.replace(
      ":id",
      id,
    );
    return apiService.delete(endpoint);
  },

  // دریافت آمار بوکمارک‌ها
  async getBookmarkStats() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.BOOKMARKS.STATS);
  },

  // ===== داده‌های مرتبط =====

  // دریافت لیست مشتریان
  async getCustomers(params = {}) {
    return apiService.get(API_CONSTANTS.ENDPOINTS.CUSTOMERS.LIST, params);
  },

  // دریافت دوره‌های یک مشتری
  async getCustomerPeriods(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.PERIODS.LIST, params);
  },

  // دریافت گله‌های یک مشتری
  async getCustomerFlocks(customerId) {
    const params = { customer_id: customerId, is_active: true };
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.LIST,
      params,
    );
  },

  // دریافت اطلاعات یک مشتری
  async getCustomer(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.DETAIL.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },
};
