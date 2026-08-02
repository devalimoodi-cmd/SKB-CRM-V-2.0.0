import { apiService } from "../../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../../core/constants/api.const.js";

export const hatcheryApi = {
  // ===== دوره‌های پرورش =====

  // دریافت لیست دوره‌ها
  async getPeriods(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.PERIODS.LIST, params);
  },

  // دریافت یک دوره
  async getPeriod(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.PERIODS.UPDATE.replace(":id", id);
    return apiService.get(endpoint);
  },

  // ایجاد دوره جدید
  async createPeriod(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.PERIODS.CREATE, data);
  },

  // بروزرسانی دوره
  async updatePeriod(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.PERIODS.UPDATE.replace(":id", id);
    return apiService.put(endpoint, data);
  },

  // حذف دوره
  async deletePeriod(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.PERIODS.DELETE.replace(":id", id);
    return apiService.delete(endpoint);
  },

  // دریافت شماره دوره بعدی
  async getNextPeriodNumber(customerId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.PERIODS.NEXT_NUMBER.replace(
      ":customerId",
      customerId,
    );
    return apiService.get(endpoint);
  },

  // ===== گله‌ها (جوجه‌ریزی) =====

  // دریافت لیست گله‌ها
  async getFlocks(customerId, params = {}) {
    const queryParams = { customer_id: customerId, ...params };
    return apiService.get(
      API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.LIST,
      queryParams,
    );
  },

  // دریافت یک گله
  async getFlock(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.get(endpoint);
  },

  // ایجاد گله جدید
  async createFlock(data) {
    return apiService.post(
      API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.CREATE,
      data,
    );
  },

  // بروزرسانی گله
  async updateFlock(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.UPDATE.replace(
      ":id",
      id,
    );
    return apiService.put(endpoint, data);
  },

  // حذف گله
  async deleteFlock(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.DELETE.replace(
      ":id",
      id,
    );
    return apiService.delete(endpoint);
  },

  // تغییر وضعیت گله (فعال/غیرفعال)
  async toggleFlockStatus(id, data = {}) {
    const endpoint = API_CONSTANTS.ENDPOINTS.CHICK_PLACEMENTS.TOGGLE.replace(
      ":id",
      id,
    );
    return apiService.put(endpoint, data);
  },

  // ===== بهداشت و ضدعفونی =====

  // دریافت اطلاعات بهداشتی سالن
  async getHygieneInfo(hallId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALL_HYGIENE.GET.replace(
      ":hallId",
      hallId,
    );
    return apiService.get(endpoint);
  },

  // ذخیره اطلاعات بهداشتی
  async saveHygieneInfo(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.HALL_HYGIENE.CREATE, data);
  },

  // حذف رکورد بهداشتی
  async deleteHygieneRecord(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALL_HYGIENE.DELETE.replace(
      ":id",
      id,
    );
    return apiService.delete(endpoint);
  },

  // ===== دیکشنری‌ها =====

  // دریافت مبدا جوجه
  async getChickSources() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/chick-sources`,
    );
  },

  // دریافت نژادهای جوجه
  async getChickenBreeds() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/chicken-breeds`,
    );
  },

  // دریافت وضعیت‌های دوره
  async getPeriodStatuses() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/period-statuses`,
    );
  },

  // ===== سالن‌ها =====

  // دریافت لیست سالن‌های مشتری
  async getHalls(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.HALLS.LIST, params);
  },

  // دریافت اطلاعات فیزیکی سالن (برای مساحت)
  async getHallPhysicalInfo(hallId) {
    const endpoint = API_CONSTANTS.ENDPOINTS.HALL_PHYSICAL.GET.replace(
      ":hallId",
      hallId,
    );
    return apiService.get(endpoint);
  },
};
