// ============================================================
// features/messages/messages.api.js
// API «نظرات و پیشنهادات» — گفتگوی کاربر لاگین‌شده با ادمین‌ها
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

const E = API_CONSTANTS.ENDPOINTS.SUGGESTIONS;

export const messagesApi = {
  // ===== کاربر =====
  // ایجاد پیام/نظر جدید
  create({ subject, title, body, page_url }) {
    return apiService.post(E.CREATE, { subject, title, body, page_url });
  },

  // گفتگوهای من
  getMine(params = {}) {
    return apiService.get(E.MINE, params);
  },

  // تعداد پاسخ‌های خوانده‌نشده (بج پاکت هدر)
  getUnreadCount() {
    return apiService.get(E.UNREAD);
  },

  // مشاهدهٔ یک گفتگو
  getThread(id) {
    return apiService.get(E.THREAD.replace(":id", id));
  },

  // پاسخ کاربر
  reply(id, body) {
    return apiService.post(E.REPLY.replace(":id", id), { body });
  },

  // علامت خوانده‌شدن (بج صفر می‌شود)
  markRead(id) {
    return apiService.post(E.READ.replace(":id", id), {});
  },

  // ===== ادمین =====
  getAdminList(params = {}) {
    return apiService.get(E.ADMIN_LIST, params);
  },

  getAdminThread(id) {
    return apiService.get(E.ADMIN_THREAD.replace(":id", id));
  },

  adminReply(id, body) {
    return apiService.post(E.ADMIN_REPLY.replace(":id", id), { body });
  },

  updateStatus(id, payload) {
    return apiService.patch(E.UPDATE.replace(":id", id), payload);
  },

  remove(id) {
    return apiService.delete(E.DELETE.replace(":id", id));
  },

  // ✅ حذف یک پیام داخل گفتگو (ادمین)
  removeMessage(id, messageId) {
    return apiService.delete(
      E.DELETE_MESSAGE.replace(":id", id).replace(":messageId", messageId),
    );
  },
};
