// ============================================================
// features/user-account/user-account.api.js
// ------------------------------------------------------------
// لایهٔ API مشترک «حساب کاربری» برای صفحات پروفایل و تنظیمات.
// همهٔ درخواست‌ها روی «خودِ کاربرِ لاگین‌شده» انجام می‌شوند
// (سرور با authorizeSelfOr اجازه می‌دهد).
// ============================================================
import { apiService } from "../../core/services/api.service.js";
import { authService } from "../../core/services/auth.service.js";
import { API_CONSTANTS } from "../../core/constants/api.const.js";

const E = API_CONSTANTS.ENDPOINTS;

// جایگزینی :id در الگوی مسیر
const withId = (template, id) => String(template).replace(":id", id);

class UserAccountApi {
  getUserId() {
    return authService.getUserId();
  }

  // ===== پروفایل =====
  async getProfile() {
    const id = this.getUserId();
    const res = await apiService.get(withId(E.USERS.UPDATE, id));
    return res?.data ?? null;
  }

  /**
   * بروزرسانی پروفایل کاربر
   * @param {Object} data فیلدهای متنی
   * @param {File|null} file عکس پروفایل (اختیاری)
   */
  async updateProfile(data = {}, file = null) {
    const id = this.getUserId();
    const endpoint = withId(E.USERS.UPDATE, id);

    if (file) {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formData.append(key, value);
        }
      });
      formData.append("profile_image", file);
      const res = await apiService.putFormData(endpoint, formData);
      return res?.data ?? null;
    }

    const res = await apiService.put(endpoint, data);
    return res?.data ?? null;
  }

  // ===== رمز عبور =====
  async changePassword(currentPassword, newPassword) {
    const id = this.getUserId();
    const endpoint = withId(E.AUTH.CHANGE_PASSWORD, id);
    const res = await apiService.put(endpoint, { currentPassword, newPassword });
    return res?.data ?? null;
  }

  // ===== باطل‌کردن همهٔ نشست‌ها =====
  async resetToken() {
    const id = this.getUserId();
    const endpoint = withId(E.USERS.RESET_TOKEN, id);
    const res = await apiService.post(endpoint, {});
    return res?.data ?? null;
  }

  // ===== تنظیمات کاربر (preferences) =====
  async getPreferences() {
    const id = this.getUserId();
    const endpoint = withId(E.USERS.PREFERENCES, id);
    const res = await apiService.get(endpoint);
    return res?.data ?? {};
  }

  async updatePreferences(patch = {}) {
    const id = this.getUserId();
    const endpoint = withId(E.USERS.PREFERENCES, id);
    const res = await apiService.put(endpoint, patch);
    return res?.data ?? {};
  }

  // ===== مجوزهای کاربر جاری =====
  async getPermissions() {
    const res = await apiService.get(E.PERMISSIONS.ME);
    return res?.data ?? null;
  }
}

export const userAccountApi = new UserAccountApi();

if (typeof window !== "undefined") {
  window.userAccountApi = userAccountApi;
  window.UserAccountApi = UserAccountApi;
}
