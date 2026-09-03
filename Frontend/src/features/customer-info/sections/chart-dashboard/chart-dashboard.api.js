import { apiService } from "../../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../../core/constants/api.const.js";

export const chartDashboardApi = {
  // دریافت داده‌های نمودارها
  async getChartsData(customerId = null, flockId = null) {
    const params = {};
    if (customerId) params.customerId = customerId;
    if (flockId) params.flockId = flockId;

    return apiService.get(API_CONSTANTS.ENDPOINTS.DASHBOARD.CHARTS, params);
  },

  // دریافت داده‌های تحلیلی نمودارهای داینامیک
  async getAnalysis(customerId) {
    const params = {};
    if (customerId) params.customerId = customerId;
    return apiService.get(API_CONSTANTS.ENDPOINTS.DASHBOARD.ANALYSIS, params);
  },

  // دریافت اطلاعات گله‌ها
  async getFlocks(customerId) {
    const params = { customer_id: customerId, is_active: true };
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.LIST,
      params,
    );
  },

  // دریافت خلاصه آماری
  async getSummary(customerId) {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DASHBOARD.SUMMARY}?customer_id=${customerId}`,
    );
  },

  // دریافت اطلاعات کامل مشتری برای نمودارها
  async getCustomerFullDetails(customerId, flockId = null) {
    let endpoint = API_CONSTANTS.ENDPOINTS.DASHBOARD.CUSTOMER_DETAILS.replace(
      ":id",
      customerId,
    );
    if (flockId) endpoint += `?flock_id=${flockId}`;
    return apiService.get(endpoint);
  },
};
