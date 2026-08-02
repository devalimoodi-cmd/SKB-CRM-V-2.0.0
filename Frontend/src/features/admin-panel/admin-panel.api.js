import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

export const adminPanelApi = {
  // ===== مدیریت کاربران =====

  // دریافت لیست کاربران
  async getUsers(params = {}) {
    return apiService.get(API_CONSTANTS.ENDPOINTS.USERS.LIST, params);
  },

  // دریافت کاربران بر اساس نقش
  async getUsersByRole(role) {
    const endpoint = API_CONSTANTS.ENDPOINTS.USERS.BY_ROLE.replace(
      ":role",
      role,
    );
    return apiService.get(endpoint);
  },

  // دریافت اطلاعات یک کاربر
  async getUser(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.USERS.UPDATE.replace(":id", id);
    return apiService.get(endpoint);
  },

  // ثبت نام کاربر جدید
  async registerUser(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.USERS.REGISTER, data);
  },

  // بروزرسانی کاربر
  async updateUser(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.USERS.UPDATE.replace(":id", id);
    return apiService.put(endpoint, data);
  },

  // تغییر وضعیت کاربر (PATCH - فقط فیلدهای ارسال‌شده)
  async toggleUserStatus(id, data) {
    const endpoint = API_CONSTANTS.ENDPOINTS.USERS.UPDATE.replace(":id", id);
    return apiService.patch(endpoint, data);
  },

  // حذف کاربر
  async deleteUser(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.USERS.DELETE.replace(":id", id);
    return apiService.delete(endpoint);
  },

  // بازنشانی توکن کاربر
  async resetUserToken(id) {
    const endpoint = API_CONSTANTS.ENDPOINTS.USERS.RESET_TOKEN.replace(
      ":id",
      id,
    );
    return apiService.post(endpoint);
  },

  // بروزرسانی وضعیت آنلاین
  async updateOnlineStatus(id, status) {
    const endpoint = API_CONSTANTS.ENDPOINTS.USERS.ONLINE_STATUS.replace(
      ":id",
      id,
    );
    return apiService.put(endpoint, { online_status: status });
  },

  // ===== مدیریت چت عمومی =====

  // دریافت پیام‌های چت
  async getChatMessages(limit = 50) {
    return apiService.get(API_CONSTANTS.ENDPOINTS.CHAT.MESSAGES, { limit });
  },

  // ارسال پیام در چت
  async sendChatMessage(content) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.CHAT.MESSAGES, { content });
  },

  // ===== بررسی ادمین =====

  // بررسی وجود ادمین
  async checkAdminExists() {
    return apiService.get(API_CONSTANTS.ENDPOINTS.AUTH.CHECK_ADMIN);
  },

  // ساخت ادمین اولیه
  async setupAdmin(data) {
    return apiService.post(API_CONSTANTS.ENDPOINTS.AUTH.SETUP_ADMIN, data);
  },
};
