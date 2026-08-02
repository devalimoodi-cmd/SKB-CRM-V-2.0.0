import { apiService } from "../../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../../core/constants/api.const.js";

export const basicInfoApi = {
  // دریافت اطلاعات مشتری
  async getCustomer(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.DETAIL.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },

  // بروزرسانی اطلاعات مشتری
  async updateCustomer(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CUSTOMERS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.put(endpoint, data);
  },

  // دریافت دیکشنری‌ها
  async getDictionary(endpoint) {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/${endpoint}`,
    );
  },

  // دریافت استان‌ها
  async getProvinces() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.CITIES.PROVINCES);
  },

  // دریافت شهرستان‌ها
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
};
