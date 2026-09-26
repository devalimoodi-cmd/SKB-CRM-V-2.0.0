// ============================================================
// features/admin-panel/permission.api.js
// لایهٔ ارتباط با API «سطوح دسترسی»
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

const P = API_CONSTANTS.ENDPOINTS.PERMISSIONS;

const withId = (template, value) => template.replace(":id", value);
const withRole = (template, value) => template.replace(":role", value);

export const permissionApi = {
  // کاتالوگ + ماتریس نقش‌ها (یک درخواست)
  getCatalog: () => apiService.get(P.CATALOG),

  // فقط ماتریس (برای تازه‌سازی سریع)
  getRoles: () => apiService.get(P.ROLES),

  // ذخیرهٔ تغییرات یک نقش: updates = [{ key, allowed }]
  updateRole: (role, updates, note) =>
    apiService.put(withRole(P.ROLE_UPDATE, role), { updates, note }),

  // بازگردانی نقش به پیش‌فرض کاتالوگ
  resetRole: (role) => apiService.post(withRole(P.ROLE_RESET, role), {}),

  // سطح دسترسی یک کاربر
  getUser: (id) => apiService.get(withId(P.USER, id)),
  updateUser: (id, updates, note) =>
    apiService.put(withId(P.USER_UPDATE, id), { updates, note }),
  resetUser: (id) => apiService.delete(withId(P.USER_RESET, id)),

  // گزارش تغییرات
  getAudit: (params = {}) => apiService.get(P.AUDIT, params),
};
