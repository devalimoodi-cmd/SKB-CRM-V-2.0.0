import { apiService } from "../../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../../core/constants/api.const.js";

export const hallsApi = {
  // ===== سالن‌ها =====

  // دریافت لیست سالن‌ها
  async getHalls(customerId, periodId = null) {
    const params = { customer_id: customerId };
    if (periodId) params.period_id = periodId;
    return apiService.get(API_CONSTANTS.ENDPOINTS.HALLS.LIST, params);
  },

  // دریافت اطلاعات یک سالن
  async getHall(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALLS.UPDATE.replace(":id", id);
    return apiService.get(endpoint);
  },

  // ایجاد سالن جدید
  async createHall(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.HALLS.CREATE, data);
  },

  // بروزرسانی سالن
  async updateHall(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALLS.UPDATE.replace(":id", id);
    return apiService.put(endpoint, data);
  },

  // حذف سالن
  async deleteHall(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALLS.DELETE.replace(":id", id);
    return apiService.delete(endpoint);
  },

  // فعال/غیرفعال کردن سالن
  async toggleHallStatus(id, data) {
    return apiService.put(`/halls/toggle-status/${id}`, data);
  },

  // ===== اطلاعات فیزیکی سالن =====

  // دریافت اطلاعات فیزیکی
  async getPhysicalInfo(hallId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALL_PHYSICAL.GET.replace(
      ":hallId",
      hallId,
    );
    return apiService.get(endpoint);
  },

  // ایجاد/بروزرسانی اطلاعات فیزیکی
  async savePhysicalInfo(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.HALL_PHYSICAL.CREATE, data);
  },

  // ===== اطلاعات سیستم‌ها =====

  // دریافت اطلاعات سیستم‌ها
  async getSystemInfo(hallId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALL_SYSTEMS.GET.replace(
      ":hallId",
      hallId,
    );
    return apiService.get(endpoint);
  },

  // ایجاد/بروزرسانی اطلاعات سیستم‌ها
  async saveSystemInfo(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.HALL_SYSTEMS.CREATE, data);
  },

  // ===== اطلاعات آبخوری و دانخوری =====

  // دریافت اطلاعات آبخوری و دانخوری
  async getWaterFeedInfo(hallId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALL_WATER_FEED.GET.replace(
      ":hallId",
      hallId,
    );
    return apiService.get(endpoint);
  },

  // ایجاد/بروزرسانی اطلاعات آبخوری و دانخوری
  async saveWaterFeedInfo(data) {
    return apiService.post(
      API_CONSTANTS.ENDPOINTS.HALL_WATER_FEED.CREATE,
      data,
    );
  },

  // ===== دیکشنری‌ها =====

  // دریافت انواع سالن
  async getHallTypes() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/hall-types`,
    );
  },

  // دریافت انواع کفپوش
  async getFloorTypes() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/floor-types`,
    );
  },

  // دریافت سیستم‌های گرمایش
  async getHeatingSystems() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/heating-systems`,
    );
  },

  // دریافت سیستم‌های سرمایش
  async getCoolingSystems() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/cooling-systems`,
    );
  },

  // دریافت سیستم‌های تهویه
  async getVentilationTypes() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/ventilation-types`,
    );
  },

  // دریافت سیستم‌های ورودی بهداشتی
  async getWaterInletTypes() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/water-inlet-types`,
    );
  },

  // دریافت سیستم‌های روشنایی
  async getLightingSystems() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/lighting-systems`,
    );
  },

  // دریافت انواع آبخوری
  async getWatererTypes() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/waterer-types`,
    );
  },

  // دریافت انواع دانخوری
  async getFeederTypes() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/feeder-types`,
    );
  },

  // دریافت لیست کارشناسان
  async getExperts() {
    return apiService.get(`${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/experts`);
  },

  // دریافت لیست نژادهای جوجه
  async getChickenBreeds() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/chicken-breeds`,
    );
  },

  // دریافت لیست مبداهای جوجه
  async getChickSources() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/chick-sources`,
    );
  },

  // ===== دوره‌ها =====

  // دریافت دوره‌های مشتری
  async getPeriods(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.PERIODS.LIST, params);
  },

  // دریافت شماره دوره بعدی
  async getNextPeriodNumber(customerId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.PERIODS.NEXT_NUMBER.replace(
      ":customerId",
      customerId,
    );
    return apiService.get(endpoint);
  },

  // ایجاد دوره جدید
  async createPeriod(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.PERIODS.CREATE, data);
  },
};
