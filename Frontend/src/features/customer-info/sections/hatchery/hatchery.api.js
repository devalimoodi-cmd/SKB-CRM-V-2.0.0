import { apiService } from "../../../../core/services/api.service.js";
import { API_CONSTANTS } from "../../../../core/constants/api.const.js";

export const hatcheryApi = {
  // ===== واحدهای مرغداری =====

  // دریافت لیست واحدها
  async getUnits(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.UNITS.LIST, params);
  },

  // دریافت یک واحد
  async getUnit(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.UNITS.UPDATE.replace(":id", id);
    return apiService.get(endpoint);
  },

  // ایجاد واحد جدید
  async createUnit(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.UNITS.CREATE, data);
  },

  // بروزرسانی واحد
  async updateUnit(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.UNITS.UPDATE.replace(":id", id);
    return apiService.put(endpoint, data);
  },

  // حذف واحد
  async deleteUnit(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.UNITS.DELETE.replace(":id", id);
    return apiService.delete(endpoint);
  },

  // ===== اطلاعات پایان دوره (Flock Completion) =====

  // ثبت اطلاعات پایان دوره برای یک یا چند واحد/گله
  async completePeriods(data) {
    return apiService.post("/flock-completions/complete-periods", data);
  },

  // دریافت اطلاعات پایان دوره‌های یک واحد
  async getCompletionsByUnit(unitId) {
    return apiService.get(`/flock-completions/unit/${unitId}`);
  },

  // دریافت یک پایان دوره
  async getFlockCompletionById(id) {
    return apiService.get(`/flock-completions/${id}`);
  },

  // حذف (بازگردانی) یک پایان دوره
  async deleteFlockCompletion(id) {
    return apiService.delete(`/flock-completions/${id}`);
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

  // ===== دوره‌ها (Period) =====
  // در این نسخه مفهوم «دوره» به گله (جوجه‌ریزی) نگاشت می‌شود؛
  // این متدها برای سازگاری با کدهای موجود اضافه شده‌اند.

  // دریافت لیست دوره‌ها — در واقع همان واحدهای مشتری است
  async getPeriods(customerId) {
    const params = { customer_id: customerId };
    return apiService.get(API_CONSTANTS.ENDPOINTS.UNITS.LIST, params);
  },

  // دریافت یک دوره — در واقع همان واحد است
  async getPeriod(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.UNITS.UPDATE.replace(":id", id);
    return apiService.get(endpoint);
  },

  // بروزرسانی یک دوره — در واقع همان واحد است
  async updatePeriod(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.UNITS.UPDATE.replace(":id", id);
    return apiService.put(endpoint, data);
  },

  // حذف یک دوره — در واقع همان واحد است
  async deletePeriod(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.UNITS.DELETE.replace(":id", id);
    return apiService.delete(endpoint);
  },

  // دریافت اطلاعات پایان دوره‌های یک گله (از طریق واحد)
  async getPeriodCompletions(periodId) {
    return this.getCompletionsByUnit(periodId);
  },

  // بروزرسانی اطلاعات پایان دوره
  async updateCompletion(id, data) {
    return apiService.put(`/flock-completions/${id}`, data);
  },

  // دریافت اطلاعات پایان دوره یک گله
  async getFlockCompletion(chickPlacementId) {
    return apiService.get(`/flock-completions/unit/${chickPlacementId}`);
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

  // دریافت وضعیت‌های واحد
  async getUnitStatuses() {
    return apiService.get(
      `${API_CONSTANTS.ENDPOINTS.DICTIONARY.BASE}/unit-statuses`,
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
