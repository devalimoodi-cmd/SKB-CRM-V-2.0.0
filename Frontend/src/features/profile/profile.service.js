// ============================================================
// features/profile/profile.service.js
// منطق صفحهٔ «پروفایل من»
// ============================================================
import { userAccountApi } from "../user-account/user-account.api.js";
import { profileRenderer } from "./profile.renderer.js";
import { authService } from "../../core/services/auth.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import {
  isValidEmail,
  digitsOnlyValue,
} from "../../core/utils/string.utils.js";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024; // ۳ مگابایت

class ProfileService {
  constructor() {
    this.initialized = false;
    this.user = null;
  }

  async init() {
    if (this.initialized) return;

    // ✅ فقط کاربران لاگین‌شده
    if (!authService.isLoggedIn()) {
      window.location.href = "/login";
      return;
    }

    this.setupEvents();

    // ابتدا از دادهٔ محلی رندر کن (سریع)، سپس از سرور تازه‌سازی کن
    this.user = authService.getUser();
    this.renderAll(this.user);

    await Promise.all([this.loadProfile(), this.loadPermissions()]);

    this.initialized = true;
    console.log("✅ ProfileService initialized");
  }

  renderAll(user) {
    profileRenderer.renderHero(user);
    profileRenderer.fillForm(user);
    profileRenderer.renderAccountInfo(user);
  }

  // ===== دریافت اطلاعات تازه از سرور =====
  async loadProfile() {
    try {
      const user = await userAccountApi.getProfile();
      if (!user) return;
      this.user = { ...(this.user || {}), ...user };
      authService.setUser(this.user);
      this.renderAll(this.user);
      if (typeof window !== "undefined" && window.headerService?.refresh) {
        window.headerService.refresh();
      }
    } catch (error) {
      console.warn("⚠️ دریافت پروفایل ناموفق بود:", error?.message || error);
    }
  }

  async loadPermissions() {
    try {
      const data = await userAccountApi.getPermissions();
      profileRenderer.renderPermissions(data);
    } catch (error) {
      console.warn("⚠️ دریافت دسترسی‌ها ناموفق بود:", error?.message || error);
      profileRenderer.renderPermissions(null);
    }
  }

  // ===== رویدادها =====
  setupEvents() {
    const form = document.getElementById("profileForm");
    if (form && form.dataset.bound !== "1") {
      form.dataset.bound = "1";
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveProfile();
      });
    }

    const resetBtn = document.getElementById("profileResetBtn");
    if (resetBtn && resetBtn.dataset.bound !== "1") {
      resetBtn.dataset.bound = "1";
      resetBtn.addEventListener("click", () => {
        profileRenderer.setMobileError("");
        profileRenderer.fillForm(this.user);
        notificationService.info("تغییرات فرم بازگردانی شد");
      });
    }

    // فقط عدد برای موبایل (ارقام فارسی خودکار تبدیل می‌شوند)
    const mobileInput = document.getElementById("pfMobile");
    if (mobileInput && mobileInput.dataset.bound !== "1") {
      mobileInput.dataset.bound = "1";
      mobileInput.addEventListener("input", () => {
        const clean = digitsOnlyValue(mobileInput.value, 11);
        if (mobileInput.value !== clean) mobileInput.value = clean;
      });
    }

    // آپلود عکس پروفایل
    const avatarEdit = document.getElementById("profileAvatarEdit");
    const fileInput = document.getElementById("profileImageInput");
    if (avatarEdit && fileInput && avatarEdit.dataset.bound !== "1") {
      avatarEdit.dataset.bound = "1";
      avatarEdit.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", () => this.handleAvatarPicked());
    }

    this.setupQuickLinks();
  }

  setupQuickLinks() {
    const msgBtn = document.getElementById("profileOpenMessages");
    if (msgBtn && msgBtn.dataset.bound !== "1") {
      msgBtn.dataset.bound = "1";
      msgBtn.addEventListener("click", () => {
        if (window.messagesService?.openModal) {
          window.messagesService.openModal("compose");
        }
      });
    }

    const wnBtn = document.getElementById("profileOpenWhatsNew");
    if (wnBtn && wnBtn.dataset.bound !== "1") {
      wnBtn.dataset.bound = "1";
      wnBtn.addEventListener("click", () => {
        if (window.whatsNewService?.open) window.whatsNewService.open();
      });
    }
  }

  // ===== ذخیرهٔ اطلاعات پروفایل =====
  async saveProfile() {
    const data = profileRenderer.readForm();

    // ===== اعتبارسنجی مطابق مدل کاربر =====
    if (!data.first_name || data.first_name.length < 2) {
      notificationService.error("نام باید حداقل ۲ کاراکتر باشد");
      return;
    }
    if (!data.last_name || data.last_name.length < 2) {
      notificationService.error("نام خانوادگی باید حداقل ۲ کاراکتر باشد");
      return;
    }
    if (!data.username || data.username.length < 3) {
      notificationService.error("نام کاربری باید حداقل ۳ کاراکتر باشد");
      return;
    }
    if (!data.mobile_number || !/^09[0-9]{9}$/.test(data.mobile_number)) {
      profileRenderer.setMobileError(
        "شمارهٔ موبایل باید با 09 شروع شده و ۱۱ رقم باشد",
      );
      notificationService.error("شمارهٔ موبایل معتبر نیست");
      return;
    }
    profileRenderer.setMobileError("");
    if (!data.email || !isValidEmail(data.email)) {
      notificationService.error("ایمیل معتبر نیست");
      return;
    }

    try {
      profileRenderer.setBusy(true);
      const updated = await userAccountApi.updateProfile(data);
      if (updated) {
        this.user = { ...(this.user || {}), ...updated };
        authService.setUser(this.user);
        this.renderAll(this.user);
        if (window.headerService?.refresh) window.headerService.refresh();
      }
      notificationService.success("اطلاعات پروفایل با موفقیت ذخیره شد");
    } catch (error) {
      notificationService.error(error?.message || "خطا در ذخیره اطلاعات");
    } finally {
      profileRenderer.setBusy(false);
    }
  }

  // ===== آپلود عکس پروفایل =====
  async handleAvatarPicked() {
    const input = document.getElementById("profileImageInput");
    const file = input?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notificationService.error("فقط فایل تصویری مجاز است");
      input.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      notificationService.error("حجم تصویر باید کمتر از ۳ مگابایت باشد");
      input.value = "";
      return;
    }

    try {
      profileRenderer.setBusy(true);
      const updated = await userAccountApi.updateProfile({}, file);
      if (updated) {
        this.user = { ...(this.user || {}), ...updated };
        authService.setUser(this.user);
        profileRenderer.renderHero(this.user);
        if (window.headerService?.refresh) window.headerService.refresh();
      }
      notificationService.success("عکس پروفایل بروزرسانی شد");
    } catch (error) {
      notificationService.error(error?.message || "خطا در آپلود عکس");
    } finally {
      profileRenderer.setBusy(false);
      input.value = "";
    }
  }
}

export const profileService = new ProfileService();

if (typeof window !== "undefined") {
  window.profileService = profileService;
  window.ProfileService = ProfileService;
}
