import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

export const customerListApi = {
  // ===== مدیریت مشتریان =====

  // دریافت لیست مشتریان
  async getCustomers(params = {}) {
    return apiService.get(API_CONSTANTS.ENDPOINTS.CUSTOMERS.LIST, params);
  },

  // دریافت اطلاعات یک مشتری
  async getCustomer(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.DETAIL.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },

  // ثبت مشتری جدید
  async registerCustomer(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.CUSTOMERS.REGISTER, data);
  },

  // بروزرسانی مشتری
  async updateCustomer(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.put(endpoint, data);
  },

  // حذف مشتری
  async deleteCustomer(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.DELETE.replace(
      ":id",
      id,
    );
    return apiService.delete(endpoint);
  },

  // تغییر وضعیت مشتری (فعال/غیرفعال)
  async toggleCustomerStatus(id, action) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.TOGGLE.replace(
      ":id",
      id,
    ).replace(":action", action);
    return apiService.put(endpoint);
  },

  // ===== دیکشنری‌ها =====

  // دریافت استان‌ها
  async getProvinces() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.CITIES.PROVINCES);
  },

  // دریافت شهرستان‌ها بر اساس استان
  async getCitiesByProvince(stateName) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CITIES.CITIES_BY_PROVINCE.replace(
      ":state",
      encodeURIComponent(stateName),
    );
    return apiService.get(endpoint);
  },

  // دریافت سطح تحصیلات
  async getEducationLevels() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.CITIES.EDUCATION_LEVELS);
  },

  // دریافت دپارتمان‌ها
  async getDepartments() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.CITIES.DEPARTMENTS);
  },

  // ===== هدر مشتری =====

  // دریافت اطلاعات هدر مشتری
  async getCustomerHeader(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.HEADER.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },
};
