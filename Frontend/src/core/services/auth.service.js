import { apiService } from "./api.service.js";
import { API_CONSTANTS } from "./../constants/api.const.js";
import { CONFIG } from "./../constants/config.const.js";
class AuthService {
  constructor() {
    this.token = localStorage.getItem(CONFIG.TOKEN_KEY);
    this.user = JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || "null");
    this.allowedAdminRoles = ["super_admin", "admin", "sub_admin"];
    this.allowedExpertRoles = ["expert", "super_admin", "admin", "sub_admin"];
    this.allowedCustomerRoles = [
      "customer",
      "super_admin",
      "admin",
      "sub_admin",
    ];
  }

  // ===== مدیریت توکن =====
  getToken() {
    return this.token || localStorage.getItem(CONFIG.TOKEN_KEY);
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem(CONFIG.TOKEN_KEY, token);
    } else {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
    }
  }

  // ===== مدیریت کاربر =====
  getUser() {
    return (
      this.user || JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || "null")
    );
  }

  setUser(user) {
    this.user = user;
    if (user) {
      localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CONFIG.USER_KEY);
    }
  }

  isLoggedIn() {
    return !!(this.getToken() && this.getUser());
  }

  // ===== بررسی نقش‌ها =====
  hasRole(allowedRoles) {
    const user = this.getUser();
    if (!user) return false;
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return roles.includes(user.role);
  }

  isAdmin() {
    return this.hasRole(this.allowedAdminRoles);
  }

  isExpert() {
    return this.hasRole(this.allowedExpertRoles);
  }

  isCustomer() {
    return this.hasRole(this.allowedCustomerRoles);
  }

  getUserRole() {
    return this.getUser()?.role || null;
  }

  getUserFullName() {
    const user = this.getUser();
    if (!user) return "کاربر ناشناس";
    if (user.fullName) return user.fullName;
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.username || "کاربر ناشناس";
  }

  getUserId() {
    return this.getUser()?.id || null;
  }

  getRoleText(role) {
    const roles = {
      super_admin: "مدیر اصلی",
      admin: "مدیر",
      sub_admin: "مدیر میانی",
      expert: "کارشناس",
      customer: "مشتری",
    };
    return roles[role] || "کاربر";
  }

  // ===== لاگین و خروج =====
  // core/services/auth.service.js

  async login(username, password) {
    try {
      const response = await apiService.post(
        API_CONSTANTS.ENDPOINTS.AUTH.LOGIN,
        { username, password },
      );

      console.log("📤 پاسخ کامل از سرور:", response); // ✅ اضافه کن

      if (response.success) {
        console.log("📤 توکن دریافتی:", response.data.token); // ✅ اضافه کن

        this.setToken(response.data.token);
        this.setUser(response.data.user);

        console.log(
          "✅ توکن ذخیره شده در localStorage:",
          localStorage.getItem(CONFIG.TOKEN_KEY),
        ); // ✅ اضافه کن

        await this.updateOnlineStatus(response.data.user.id, true);
        return response.data;
      }
      throw new Error(response.message || "خطا در ورود");
    } catch (error) {
      console.error("❌ Login error:", error);
      throw error;
    }
  }
  logout(redirectUrl = "/login") {
    const user = this.getUser();
    if (user?.id) {
      this.updateOnlineStatus(user.id, false).catch(() => {});
    }

    this.setToken(null);
    this.setUser(null);
    sessionStorage.clear();

    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  }

  // ===== وضعیت آنلاین =====
  async updateOnlineStatus(userId, status) {
    try {
      const endpoint = API_CONSTANTS.ENDPOINTS.USERS.ONLINE_STATUS.replace(
        ":id",
        userId,
      );
      await apiService.put(endpoint, { online_status: status });
    } catch (error) {
      console.error("❌ Error updating online status:", error);
    }
  }

  // ===== بررسی ادمین =====
  async checkAdminExists() {
    try {
      const response = await apiService.get(
        API_CONSTANTS.ENDPOINTS.AUTH.CHECK_ADMIN,
      );
      return response.success && response.data?.hasAdmin === true;
    } catch (error) {
      console.error("❌ Error checking admin:", error);
      return false;
    }
  }

  // ===== ساخت ادمین اولیه =====
  async setupAdmin(data) {
    try {
      const response = await apiService.post(
        API_CONSTANTS.ENDPOINTS.AUTH.SETUP_ADMIN,
        data,
      );
      if (response.success) {
        this.setToken(response.data.token);
        this.setUser(response.data.user);
        return response.data;
      }
      throw new Error(response.message || "خطا در ساخت ادمین");
    } catch (error) {
      console.error("❌ Setup admin error:", error);
      throw error;
    }
  }

  // ===== تغییر رمز =====
  async changePassword(currentPassword, newPassword) {
    const userId = this.getUserId();
    if (!userId) throw new Error("کاربر لاگین نیست");

    const endpoint = API_CONSTANTS.ENDPOINTS.AUTH.CHANGE_PASSWORD.replace(
      ":id",
      userId,
    );
    try {
      const response = await apiService.put(endpoint, {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      console.error("❌ Change password error:", error);
      throw error;
    }
  }

  // ===== بررسی دسترسی صفحات =====
  async checkAdminPageAccess() {
    const hasAdmin = await this.checkAdminExists();
    if (!hasAdmin) {
      if (
        window.location.pathname.includes("admin") ||
        window.location.pathname.includes("AdminPanel")
      ) {
        window.location.href = "/setup-admin";
      }
      return false;
    }

    if (!this.isLoggedIn()) {
      window.location.href = "/login";
      return false;
    }

    if (!this.isAdmin()) {
      const user = this.getUser();
      if (user?.role === "expert") {
        window.location.href = "/dashboard";
      } else if (user?.role === "customer") {
        window.location.href = "/customer-info";
      } else {
        window.location.href = "/login";
      }
      return false;
    }

    return true;
  }

  async checkExpertPageAccess() {
    const hasAdmin = await this.checkAdminExists();
    if (!hasAdmin) {
      if (
        window.location.pathname.includes("dashboard") ||
        window.location.pathname.includes("expert")
      ) {
        window.location.href = "/setup-admin";
      }
      return false;
    }

    if (!this.isLoggedIn()) {
      window.location.href = "/login";
      return false;
    }

    if (!this.isExpert() && !this.isAdmin()) {
      const user = this.getUser();
      if (user?.role === "customer") {
        window.location.href = "/customer-info";
      } else {
        window.location.href = "/login";
      }
      return false;
    }

    return true;
  }

  async checkCustomerPageAccess() {
    const hasAdmin = await this.checkAdminExists();
    if (!hasAdmin) {
      if (window.location.pathname.includes("customer")) {
        window.location.href = "/setup-admin";
      }
      return false;
    }

    if (!this.isLoggedIn()) {
      window.location.href = "/login";
      return false;
    }

    return true;
  }

  // ===== دیباگ =====
  debug() {
    console.group("🔍 AuthService Debug");
    console.log("📌 Token exists:", !!this.getToken());
    console.log("📌 User:", this.getUser());
    console.log("📌 Is Logged In:", this.isLoggedIn());
    console.log("📌 User Role:", this.getUserRole());
    console.log("📌 Is Admin:", this.isAdmin());
    console.log("📌 Is Expert:", this.isExpert());
    console.log("📌 Is Customer:", this.isCustomer());
    console.groupEnd();
  }
}

export const authService = new AuthService();
// ===== ✅ این خط رو اضافه کن =====
if (typeof window !== "undefined") {
  window.authService = authService;
  window.AuthService = AuthService;
}
