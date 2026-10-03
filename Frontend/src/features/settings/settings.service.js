// ============================================================
// features/settings/settings.service.js
// منطق صفحهٔ «تنظیمات حساب کاربری»
// ------------------------------------------------------------
// • فاز ۱: تنظیمات در localStorage
// • فاز ۲: ذخیرهٔ سمت سرور (users.preferences) با فالبک خودکار
// • فاز ۳: تم روشن/تیره (اسکوپ صفحات حساب)
// ============================================================
import { userAccountApi } from "../user-account/user-account.api.js";
import { settingsRenderer } from "./settings.renderer.js";
import { authService } from "../../core/services/auth.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import { themeService } from "../../core/services/theme.service.js";

// کلیدهای localStorage (هم‌خوان با سرویس‌های موجود پروژه)
const LS = {
  toast: "skb_user_toasts",
  notify: "skb_notify_messages",
  dashboard: "skb_dashboard_chart_layout",
  analysis: "skb-analysis-layout",
  theme: "skb_theme",
};

const DEFAULT_PREFS = {
  toastEnabled: true,
  notifyMessages: true,
  dashboardChartLayout: "full",
  analysisLayout: "stacked",
  theme: "system",
};

class SettingsService {
  constructor() {
    this.initialized = false;
    this.prefs = { ...DEFAULT_PREFS };
    this.serverBacked = false;
  }

  async init() {
    if (this.initialized) return;

    if (!authService.isLoggedIn()) {
      window.location.href = "/login";
      return;
    }

    // ۱) مقادیر محلی (سریع، بدون انتظار شبکه)
    this.prefs = this.readLocalPrefs();
    this.applyTheme(this.prefs.theme);
    this.render();

    this.setupEvents();

    // ۲) تازه‌سازی از سرور (فاز ۲)
    await this.loadServerPrefs();

    this.initialized = true;
    console.log("✅ SettingsService initialized");
  }

  readLocalPrefs() {
    const read = (key, fallback) => {
      try {
        return localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    };
    return {
      toastEnabled: read(LS.toast) !== "off",
      notifyMessages: read(LS.notify) !== "off",
      dashboardChartLayout: read(LS.dashboard, DEFAULT_PREFS.dashboardChartLayout),
      analysisLayout: read(LS.analysis, DEFAULT_PREFS.analysisLayout),
      theme: read(LS.theme, DEFAULT_PREFS.theme),
    };
  }

  render() {
    settingsRenderer.renderToggles(this.prefs);
    settingsRenderer.renderTheme(this.prefs.theme);
    settingsRenderer.renderSelect(
      "selDashboardLayout",
      this.prefs.dashboardChartLayout,
    );
    settingsRenderer.renderSelect(
      "selAnalysisLayout",
      this.prefs.analysisLayout,
    );
  }

  // ===== بارگذاری تنظیمات از سرور =====
  async loadServerPrefs() {
    try {
      const prefs = await userAccountApi.getPreferences();
      this.serverBacked = true;
      this.prefs = { ...DEFAULT_PREFS, ...(prefs || {}) };
      this.applyTheme(this.prefs.theme);
      this.render();
      settingsRenderer.setStorageStatus(
        "ذخیره در حساب کاربری (قابل استفاده در همهٔ دستگاه‌ها)",
      );
    } catch (error) {
      this.serverBacked = false;
      settingsRenderer.setStorageStatus("ذخیره فقط در این مرورگر");
      console.warn(
        "⚠️ تنظیمات سروری در دسترس نیست؛ حالت محلی فعال شد:",
        error?.message || error,
      );
    }
  }

  // ===== ذخیره (سرور + آینهٔ localStorage) =====
  async persist(patch) {
    this.prefs = { ...this.prefs, ...patch };

    if (Object.prototype.hasOwnProperty.call(patch, "theme")) {
      this.applyTheme(this.prefs.theme);
    }
    this.mirrorToLocal(patch);

    if (this.serverBacked) {
      try {
        await userAccountApi.updatePreferences(patch);
      } catch (error) {
        this.serverBacked = false;
        settingsRenderer.setStorageStatus("ذخیره فقط در این مرورگر");
        console.warn("⚠️ ذخیرهٔ تنظیمات سروری ناموفق:", error?.message || error);
      }
    }
  }

  mirrorToLocal(patch) {
    try {
      if ("toastEnabled" in patch) {
        if (patch.toastEnabled === false) localStorage.setItem(LS.toast, "off");
        else localStorage.removeItem(LS.toast);
      }
      if ("notifyMessages" in patch) {
        localStorage.setItem(
          LS.notify,
          patch.notifyMessages === false ? "off" : "on",
        );
      }
      if ("dashboardChartLayout" in patch) {
        localStorage.setItem(LS.dashboard, patch.dashboardChartLayout);
      }
      if ("analysisLayout" in patch) {
        localStorage.setItem(LS.analysis, patch.analysisLayout);
      }
      if ("theme" in patch) {
        localStorage.setItem(LS.theme, patch.theme);
      }
    } catch {
      /* بی‌صدا */
    }
  }

  // ===== اعمال تم (واگذاری به themeService — تک‌منبع حقیقت) =====
  applyTheme(theme) {
    return themeService.apply(theme);
  }

  // ===== رویدادها =====
  setupEvents() {
    this.bindCheckbox("prefToastEnabled", (checked) =>
      this.applyToggle("toastEnabled", checked, "نمایش توست‌ها"),
    );
    this.bindCheckbox("prefNotifyMessages", (checked) =>
      this.applyToggle("notifyMessages", checked, "اعلان پیام‌ها"),
    );

    this.bindSelect("selDashboardLayout", (value) =>
      this.applySelect("dashboardChartLayout", value, "چیدمان نمودار داشبورد"),
    );
    this.bindSelect("selAnalysisLayout", (value) =>
      this.applySelect("analysisLayout", value, "چیدمان کارت‌های تحلیل"),
    );

    this.setupThemeSeg();
    this.setupPasswordForm();
    this.setupResetSessions();
    this.setupQuickLinks();
  }

  bindCheckbox(id, handler) {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.addEventListener("change", () => handler(el.checked));
  }

  bindSelect(id, handler) {
    const el = document.getElementById(id);
    if (!el || el.dataset.bound === "1") return;
    el.dataset.bound = "1";
    el.addEventListener("change", () => handler(el.value));
  }

  async applyToggle(key, checked, label) {
    const patch = { [key]: checked };
    await this.persist(patch);
    this.notifySaved(`${label} ${checked ? "فعال" : "غیرفعال"} شد`);
  }

  async applySelect(key, value, label) {
    if (!value) return;
    const patch = { [key]: value };
    await this.persist(patch);
    this.notifySaved(`${label} ذخیره شد`);
  }

  setupThemeSeg() {
    const seg = document.getElementById("settingsThemeSeg");
    if (!seg || seg.dataset.bound === "1") return;
    seg.dataset.bound = "1";
    seg.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const theme = btn.dataset.themeValue;
        if (!theme) return;
        settingsRenderer.renderTheme(theme);
        await this.persist({ theme });
        this.notifySaved("حالت نمایش ذخیره شد");
      });
    });
  }

  notifySaved(message) {
    notificationService.notifyOnce({
      key: "settings-saved",
      message,
      type: "success",
      cooldownMs: 5000,
      maxPerMinute: 6,
    });
  }

  // ===== تغییر رمز عبور =====
  setupPasswordForm() {
    const form = document.getElementById("settingsPasswordForm");
    if (!form || form.dataset.bound === "1") return;
    form.dataset.bound = "1";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.changePassword();
    });

    const confirm = document.getElementById("spConfirm");
    if (confirm) {
      confirm.addEventListener("input", () => {
        const val = document.getElementById("spNew")?.value || "";
        settingsRenderer.setConfirmError("");
        if (confirm.value && confirm.value !== val) {
          settingsRenderer.setConfirmError("تکرار رمز جدید مطابقت ندارد");
        }
      });
    }
  }

  async changePassword() {
    const current = document.getElementById("spCurrent")?.value || "";
    const next = document.getElementById("spNew")?.value || "";
    const confirm = document.getElementById("spConfirm")?.value || "";

    if (!current) {
      notificationService.error("رمز عبور فعلی را وارد کنید");
      return;
    }
    if (next.length < 6) {
      notificationService.error("رمز عبور جدید باید حداقل ۶ کاراکتر باشد");
      return;
    }
    if (next !== confirm) {
      settingsRenderer.setConfirmError("تکرار رمز جدید مطابقت ندارد");
      notificationService.error("تکرار رمز جدید مطابقت ندارد");
      return;
    }

    try {
      settingsRenderer.setPasswordBusy(true);
      const result = await userAccountApi.changePassword(current, next);

      // ✅ توکن جدید ممکن است صادر شده باشد (باطل‌شدن نشست‌های قبلی)
      if (result && result.token) {
        authService.setToken(result.token);
      }

      settingsRenderer.clearPasswordForm();
      notificationService.success("رمز عبور با موفقیت تغییر کرد");
    } catch (error) {
      notificationService.error(error?.message || "خطا در تغییر رمز عبور");
    } finally {
      settingsRenderer.setPasswordBusy(false);
    }
  }

  // ===== خروج از همهٔ دستگاه‌ها =====
  setupResetSessions() {
    const btn = document.getElementById("settingsResetSessionsBtn");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => this.resetSessions());
  }

  async resetSessions() {
    const confirmed = await notificationService.confirm({
      title: "خروج از همهٔ دستگاه‌ها",
      text: "همهٔ نشست‌های فعال شما بسته می‌شود. ادامه می‌دهید؟",
      confirmText: "بله، خارج شو",
      icon: "warning",
      danger: true,
    });
    if (!confirmed) return;

    try {
      const result = await userAccountApi.resetToken();
      if (result && result.token) authService.setToken(result.token);
      notificationService.success("همهٔ دستگاه‌ها خارج شدند");
    } catch (error) {
      notificationService.error(error?.message || "خطا در خروج از دستگاه‌ها");
    }
  }

  // ===== دسترسی سریع =====
  setupQuickLinks() {
    const msgBtn = document.getElementById("settingsOpenMessages");
    if (msgBtn && msgBtn.dataset.bound !== "1") {
      msgBtn.dataset.bound = "1";
      msgBtn.addEventListener("click", () => {
        if (window.messagesService?.openModal) window.messagesService.openModal("compose");
      });
    }

    const wnBtn = document.getElementById("settingsOpenWhatsNew");
    if (wnBtn && wnBtn.dataset.bound !== "1") {
      wnBtn.dataset.bound = "1";
      wnBtn.addEventListener("click", () => {
        if (window.whatsNewService?.open) window.whatsNewService.open();
      });
    }
  }
}

export const settingsService = new SettingsService();

if (typeof window !== "undefined") {
  window.settingsService = settingsService;
  window.SettingsService = SettingsService;
}
