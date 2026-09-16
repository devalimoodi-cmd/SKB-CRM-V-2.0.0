// ============================================================
// features/whats-new/whats-new.api.js
// API «تغییرات جدید / What's New»
//  • کاربر: مودال، تاریخچه و ثبت بازدید
//  • مدیریت: خواندن برای همهٔ ادمین‌ها، نوشتن فقط سوپر ادمین
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

const E = API_CONSTANTS.ENDPOINTS.RELEASES;

export const whatsNewApi = {
  // ===== کاربر =====
  // آخرین نسخهٔ منتشرشده‌ای که کاربر ندیده (یا null)
  getUnseen() {
    return apiService.get(E.UNSEEN);
  },

  // تاریخچهٔ نسخه‌های منتشرشده (برای «تغییرات قبلی» و بج)
  getHistory() {
    return apiService.get(E.HISTORY);
  },

  // ثبت دیدن (و در صورت نیاز «دیگر نشان نده»)
  markSeen(id, dontShowAgain = false) {
    return apiService.post(E.MARK_SEEN.replace(":id", id), {
      dont_show_again: Boolean(dontShowAgain),
    });
  },

  // ===== مدیریت =====
  // فهرست نسخه‌ها (خواندن — همهٔ ادمین‌ها)
  getList(params = {}) {
    return apiService.get(E.ADMIN_LIST, params);
  },

  getOne(id) {
    return apiService.get(E.DETAIL.replace(":id", id));
  },

  getStats(id) {
    return apiService.get(E.STATS.replace(":id", id));
  },

  // ساخت نسخه (فقط سوپر ادمین)
  create(payload) {
    return apiService.post(E.CREATE, payload);
  },

  // ویرایش نسخه (فقط سوپر ادمین) — اگر items بفرستی، جایگزین می‌شوند
  update(id, payload) {
    return apiService.patch(E.UPDATE.replace(":id", id), payload);
  },

  // انتشار (فوری/زمان‌بندی‌شده) — resend:true → همه دوباره می‌بینند
  publish(id, payload = {}) {
    return apiService.post(E.PUBLISH.replace(":id", id), payload);
  },

  archive(id) {
    return apiService.post(E.ARCHIVE.replace(":id", id), {});
  },

  remove(id) {
    return apiService.delete(E.DELETE.replace(":id", id));
  },
};
