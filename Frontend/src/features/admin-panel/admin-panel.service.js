import { adminPanelApi } from "./admin-panel.api.js";
import { adminPanelRenderer } from "./admin-panel.renderer.js";
import { adminPanelValidation } from "./admin-panel.validation.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { permissionService } from "../../core/services/permission.service.js";
import {
  messagesService,
  statusBadge,
  subjectLabel,
} from "../messages/messages.service.js";
import { escapeHtml, digitsOnlyValue } from "../../core/utils/string.utils.js";
import { loaderService } from "../../shared/components/Loader/loader.service.js";
import {
  HISTORY_HANDOFF_KEY,
  readHistoryHandoff,
} from "../activity-log/activity-log.view.js";
import "../../core/services/state.service.js";
import "../../core/utils/date.utils.js";

// ============================================================
// ✅ موج ۱۳.۷ — قاعده‌های «پروندهٔ مشتری تازه» در سمت کلاینت
// ------------------------------------------------------------
// ⚠️ منبع حقیقت سرور است (Backend/services/registrationRules.js)؛
//    این اعداد فقط برای «پیش‌اعتبارسنجی» و پیام فوری به مدیر است
//    تا خطای ۴۰۰ سرور برای داده‌ای که خودِ فرم می‌توانست بگیرد، رخ ندهد.
// ============================================================
const NEW_CUSTOMER_MIN_NAME_LENGTH = 2;
const NEW_CUSTOMER_MAX_NAME_LENGTH = 200;
const NEW_CUSTOMER_NATIONAL_CODE_LENGTH = 10;

class AdminPanelService {
  constructor() {
    this.users = [];
    this.superAdmins = [];
    this.currentUser = null;
    this.editingUserId = null;
    this.editingUserRole = null;
    this.isEditing = false;
    // ✅ فاز ۱۳.۰: فهرست مشتریان برای انتخاب «پروندهٔ مشتری» در فرم کاربر
    this.customers = [];
    this.customerSearchTimer = null;
    this.selectedMenu = "super-admin-management";
    // ✅ «نظرات و پیشنهادات» (جای چت عمومی قبلی که بک‌اند نداشت)
    this.suggestions = [];
    this.suggestionCounts = {};
    this.activeSuggestionId = null;
    this.suggestionsPolling = null;
    // ✅ فاز ۱۳.۶ — صف «درخواست‌های ثبت‌نام» (فهرست + درخواست در حال بررسی)
    this.registrations = [];
    this.reviewingRegistration = null;
    this.reviewMode = null;
    // ✅ موج ۱۳.۷ — حالت پروندهٔ مشتری در مودال تأیید: existing | new
    this.registrationCustomerMode = "existing";
    // ✅ موج ۱۳.۷.۲ — پیش‌پرکردن فرم «پروندهٔ تازه» از اطلاعات خود درخواست
    this.newCustomerPrefill = null;
    // ✅ موج ۱۳.۷.۳ — سوییچ «تأیید خودکار ثبت‌نام» (مقدار + اجازهٔ تغییر)
    this.autoApproveRegistration = false;
    this.autoApproveCanToggle = false;
    this.initialized = false;
    // ✅ لودر سیستمی (تنظیمات سیستم)
    this.loaderStyle = "classic";
    this.loaderPreviewsReady = false;
  }

  async init() {
    // بررسی دسترسی
    const hasAccess = await authService.checkAdminPageAccess();
    if (!hasAccess) return;

    // ✅ موج ۱۲.۴.۱ — اگر از «پروندهٔ مشتری» با درخواست تاریخچه
    //    آمده‌ایم، پیش از رسم سایدبار منوی هدف را انتخاب می‌کنیم
    //    (بدون setTimeout؛ صف مدیر نیز پیش از init پر می‌شود).
    const pendingHistory = this.takePendingHistory();

    await this.loadData();
    if (pendingHistory) this.selectedMenu = "activity-log";
    this.setupSidebar();

    // ✅ هم‌راستا کردن سایدبار با سطوح دسترسی (data-permission)
    this.syncMenuVisibility();
    document.addEventListener("permissions:applied", () =>
      this.syncMenuVisibility(),
    );

    this.setupEvents();
    this.setupSuggestions();
    // ✅ فاز ۱۳.۶ — رویدادهای صف ثبت‌نام + بج «در انتظار تأیید»
    this.setupRegistrationQueue();
    this.loadSystemSettings();
    this.loadSuggestionCounts();
    this.initialized = true;
    console.log("✅ AdminPanelService initialized");

    // ✅ لودر سیستمی این صفحه تا آماده شدن پنل نمایش داده می‌شود
    if (typeof window.hidePageLoader === "function") window.hidePageLoader();

    // ✅ موج ۱۲.۴.۱ — اعمال درخواست تاریخچهٔ آمده از صفحهٔ پروندهٔ مشتری
    await this.applyPendingHistory(pendingHistory);
  }

  async loadData() {
    try {
      // بررسی وجود ادمین
      const hasAdmin = await this.checkAdminExists();
      if (!hasAdmin) {
        this.showSetupForm();
        return;
      }

      this.showAdminPanel();

      // بارگذاری مدیران اصلی
      await this.loadSuperAdmins();

      // بارگذاری کاربران عادی
      await this.loadUsers();
    } catch (error) {
      console.error("❌ Error loading admin data:", error);
      notificationService.showError("خطا در دریافت اطلاعات");
    }
  }

  async checkAdminExists() {
    try {
      const response = await adminPanelApi.checkAdminExists();
      return response.success && response.data?.hasAdmin === true;
    } catch (error) {
      console.error("❌ Error checking admin:", error);
      return false;
    }
  }

  showSetupForm() {
    const setupForm = document.getElementById("setupAdminForm");
    const adminContent = document.getElementById("adminContent");
    if (setupForm) setupForm.style.display = "block";
    if (adminContent) adminContent.style.display = "none";
  }

  showAdminPanel() {
    const setupForm = document.getElementById("setupAdminForm");
    const adminContent = document.getElementById("adminContent");
    if (setupForm) setupForm.style.display = "none";
    if (adminContent) adminContent.style.display = "block";
  }

  // ===== تنظیمات سیستم =====

  async loadSystemSettings() {
    const toggle = document.getElementById("autoWelcomeSmsToggle");
    const stateEl = document.getElementById("autoWelcomeSmsState");
    try {
      const res = await adminPanelApi.getSettings();
      const enabled = res?.success
        ? res.data?.auto_welcome_sms === true
        : true;
      if (toggle) {
        toggle.checked = enabled;
        // فقط یک‌بار لیسنر بسته شود
        if (!toggle.dataset.bound) {
          toggle.addEventListener("change", () =>
            this.saveAutoWelcomeSms(toggle),
          );
          toggle.dataset.bound = "1";
        }
      }
      if (stateEl) stateEl.textContent = enabled ? "فعال" : "غیرفعال";
    } catch (error) {
      console.warn("⚠️ خطا در دریافت تنظیمات سیستم:", error.message);
      if (stateEl) stateEl.textContent = "نامشخص";
    }

    // ✅ لودر سیستمی (کلاسیک / لوگوی ستاره کیان)
    await this.loadLoaderStyle();

    // ✅ فاز ۱۳.۶ — پرچم «ثبت‌نام عمومی» (صفحهٔ /register)
    await this.loadPublicRegisterSetting();
  }

  // ===== ✅ فاز ۱۳.۶ — ثبت‌نام عمومی: خواندن + بایند یک‌بارهٔ سوییچ =====
  async loadPublicRegisterSetting() {
    const toggle = document.getElementById("publicRegisterToggle");
    const stateEl = document.getElementById("publicRegisterState");
    if (!toggle) return;

    try {
      const res = await adminPanelApi.getSettings();
      const enabled = res?.success ? res.data?.registration_enabled === true : false;
      toggle.checked = enabled;
      if (stateEl) stateEl.textContent = enabled ? "فعال" : "غیرفعال";

      if (!toggle.dataset.bound) {
        toggle.addEventListener("change", () => this.savePublicRegister(toggle));
        toggle.dataset.bound = "1";
      }
    } catch (error) {
      console.warn("⚠️ خطا در دریافت تنظیم ثبت‌نام عمومی:", error.message);
      if (stateEl) stateEl.textContent = "نامشخص";
    }
  }

  // ذخیرهٔ فوری پرچم ثبت‌نام عمومی (هم‌الگوی auto_welcome_sms)
  async savePublicRegister(toggle) {
    const stateEl = document.getElementById("publicRegisterState");
    const newValue = toggle.checked;
    const previous = !newValue;
    toggle.disabled = true;
    try {
      const res = await adminPanelApi.updateSetting("registration_enabled", newValue);
      if (res?.success) {
        if (stateEl) stateEl.textContent = newValue ? "فعال" : "غیرفعال";
        notificationService.success(
          newValue
            ? "✅ ثبت‌نام عمومی فعال شد؛ لینک «ثبت‌نام مشتری» در صفحهٔ ورود نمایش داده می‌شود"
            : "ثبت‌نام عمومی غیرفعال شد؛ صفحهٔ /register پیام «بسته است» نشان می‌دهد",
        );
      } else {
        toggle.checked = previous;
        notificationService.error(res?.message || "خطا در ذخیره تنظیم ثبت‌نام عمومی");
      }
    } catch (error) {
      console.error("❌ Error saving registration_enabled:", error);
      toggle.checked = previous;
      notificationService.error(error.message || "خطا در ذخیره تنظیم ثبت‌نام عمومی");
    } finally {
      toggle.disabled = false;
    }
  }

  // ===== لودر سیستمی: خواندن تنظیم + ساخت پیش‌نمایش‌ها =====
  async loadLoaderStyle() {
    const stateEl = document.getElementById("loaderStyleState");
    await this.renderLoaderPreviews();
    try {
      const res = await adminPanelApi.getSettings();
      const style = res?.success ? res.data?.loader_style : "classic";
      this.applyLoaderSelection(style === "logo" ? "logo" : "classic");
    } catch (error) {
      console.warn("⚠️ خطا در دریافت تنظیم لودر سیستمی:", error.message);
      if (stateEl) stateEl.textContent = "نامشخص";
    }
  }

  // ساخت پیش‌نمایش هر دو لودر از منبع واحد
  // (همان تابعی که لودرهای داخل صفحه را می‌سازد — shared/components/Loader)
  async renderLoaderPreviews() {
    const classicBox = document.getElementById("loaderPreviewClassic");
    const logoBox = document.getElementById("loaderPreviewLogo");
    if (!classicBox || !logoBox || this.loaderPreviewsReady) return;

    const [classicHtml, logoHtml] = await Promise.all([
      loaderService.inline({ style: "classic", size: "preview" }),
      loaderService.inline({ style: "logo", size: "preview" }),
    ]);

    // اگر مارک‌آپ در دسترس نبود، بعداً دوباره تلاش می‌شود
    if (!classicHtml || !logoHtml) return;

    classicBox.innerHTML = classicHtml;
    logoBox.innerHTML = logoHtml;
    this.loaderPreviewsReady = true;
  }

  // پیش‌نمایش تمام‌صفحهٔ یک حالت (۳ ثانیه — تنظیم ذخیره نمی‌شود)
  async previewFullscreen(style) {
    const html = await loaderService.inline({ style, size: "md" });
    if (!html) {
      notificationService.warning("پیش‌نمایش لودر در دسترس نیست");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "skb-page-loader";
    overlay.title = "برای بستن کلیک کنید";
    overlay.style.cursor = "pointer";
    overlay.innerHTML = html;
    overlay.addEventListener("click", () => overlay.remove());
    document.body.appendChild(overlay);

    setTimeout(() => overlay.remove(), 3000);
  }

  // مشخص کردن گزینهٔ فعال + بایند یک‌بارهٔ کلیک/کیبورد (کارت‌ها div هستند)
  applyLoaderSelection(style) {
    this.loaderStyle = style === "logo" ? "logo" : "classic";

    document.querySelectorAll("[data-loader-style]").forEach((card) => {
      const isSelected = card.dataset.loaderStyle === this.loaderStyle;
      card.classList.toggle("selected", isSelected);
      card.setAttribute("aria-pressed", isSelected ? "true" : "false");

      if (!card.dataset.bound) {
        card.addEventListener("click", (event) => {
          // کلیک روی دکمهٔ پیش‌نمایش، نباید حالت را تغییر دهد
          if (event.target.closest("[data-loader-preview]")) return;
          this.saveLoaderStyle(card.dataset.loaderStyle);
        });
        card.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            this.saveLoaderStyle(card.dataset.loaderStyle);
          }
        });
        card.dataset.bound = "1";
      }
    });

    document.querySelectorAll("[data-loader-preview]").forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        this.previewFullscreen(btn.dataset.loaderPreview);
      });
      btn.dataset.bound = "1";
    });

    const stateEl = document.getElementById("loaderStyleState");
    if (stateEl) {
      stateEl.textContent =
        this.loaderStyle === "logo" ? "لوگوی ستاره کیان" : "کلاسیک";
    }
  }

  // ذخیرهٔ لودر انتخاب‌شده (مثل سایر تنظیمات سیستم: ذخیرهٔ فوری)
  async saveLoaderStyle(style) {
    const target = style === "logo" ? "logo" : "classic";
    if (target === this.loaderStyle) return;

    try {
      const res = await adminPanelApi.updateSetting("loader_style", target);
      if (!res?.success) {
        notificationService.error(res?.message || "خطا در ذخیره لودر سیستمی");
        return;
      }

      this.applyLoaderSelection(target);
      notificationService.success(
        target === "logo"
          ? "✅ لودر لوگوی ستاره کیان فعال شد (حداکثر تا ۱ دقیقه در همهٔ صفحه‌ها)"
          : "✅ لودر کلاسیک فعال شد (حداکثر تا ۱ دقیقه در همهٔ صفحه‌ها)",
      );
    } catch (error) {
      console.error("❌ saveLoaderStyle:", error);
      notificationService.error(error.message || "خطا در ذخیره لودر سیستمی");
    }
  }

  async saveAutoWelcomeSms(toggle) {
    const stateEl = document.getElementById("autoWelcomeSmsState");
    const newValue = toggle.checked;
    const previous = !newValue;
    toggle.disabled = true;
    try {
      const res = await adminPanelApi.updateSetting(
        "auto_welcome_sms",
        newValue,
      );
      if (res?.success) {
        if (stateEl) stateEl.textContent = newValue ? "فعال" : "غیرفعال";
        notificationService.success(
          newValue
            ? "✅ ارسال خودکار پیامک خوش‌آمدگویی فعال شد"
            : "ارسال خودکار پیامک خوش‌آمدگویی غیرفعال شد",
        );
      } else {
        toggle.checked = previous;
        notificationService.error(
          res?.message || "خطا در ذخیره تنظیمات سیستم",
        );
      }
    } catch (error) {
      console.error("❌ Error saving system settings:", error);
      toggle.checked = previous;
      notificationService.error(error.message || "خطا در ذخیره تنظیمات سیستم");
    } finally {
      toggle.disabled = false;
    }
  }

  // ===== بارگذاری کاربران =====

  async loadSuperAdmins() {
    try {
      const response = await adminPanelApi.getUsersByRole("super_admin");
      if (response.success) {
        this.superAdmins = response.data || [];
        adminPanelRenderer.renderSuperAdminsTable(this.superAdmins);
      }
    } catch (error) {
      console.error("❌ Error loading super admins:", error);
      notificationService.showError(
        error.message || "خطا در دریافت مدیران اصلی",
      );
    }
  }

  async loadUsers() {
    try {
      const params = { exclude_role: "super_admin" };
      const response = await adminPanelApi.getUsers(params);
      if (response.success) {
        this.users = response.data || [];
        adminPanelRenderer.renderUsersTable(this.users);
      }
    } catch (error) {
      console.error("❌ Error loading users:", error);
      notificationService.showError(error.message || "خطا در دریافت کاربران");
    }
  }

  // ===== ساخت ادمین اولیه =====

  async setupAdmin(data) {
    // اعتبارسنجی
    const errors = adminPanelValidation.validateSetupAdmin(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    const btn = document.getElementById("setupAdminBtn");
    const originalText = btn?.innerHTML;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';
    }

    try {
      const response = await adminPanelApi.setupAdmin(data);
      if (response.success) {
        notificationService.success("✅ مدیر اصلی با موفقیت ایجاد شد");
        authService.setToken(response.data.token);
        authService.setUser(response.data.user);
        await this.loadData();
        this.resetSetupForm();
      } else {
        notificationService.error(response.message || "خطا در ساخت ادمین");
      }
    } catch (error) {
      console.error("❌ Error setting up admin:", error);
      notificationService.error("خطا در ارتباط با سرور");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  resetSetupForm() {
    [
      "setupFirstName",
      "setupLastName",
      "setupUsername",
      "setupEmail",
      "setupPassword",
      "setupMobile",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  // ===== ثبت کاربر جدید =====

  async registerUser(data, role = null) {
    // اعتبارسنجی
    const errors = adminPanelValidation.validateUser(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    // اگر نقش مشخص شده، استفاده کن
    if (role) {
      data.role = role;
    }

    // ✅ فاز ۱۳.۰: نقش «مشتری» بدون پروندهٔ مشتری، حساب بی‌مصرف می‌سازد
    if (data.role === "customer" && !data.customer_id) {
      notificationService.error(
        "برای نقش «مشتری» انتخاب «پروندهٔ مشتری» الزامی است",
      );
      return;
    }

    const saveBtn = document.getElementById("saveUserBtn");
    const originalText = saveBtn?.innerHTML;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';
    }

    try {
      const response = await adminPanelApi.registerUser(data);
      if (response.success) {
        notificationService.success(`✅ کاربر با موفقیت ثبت شد`);

        // اگر توکن تولید شده، نمایش بده
        if (response.data.token) {
          adminPanelRenderer.showTokenModal(
            response.data.token,
            response.data.user,
          );
        }

        await this.loadUsers();
        this.closeUserModal();
      } else {
        notificationService.showError(response.message || "خطا در ثبت نام");
      }
    } catch (error) {
      console.error("❌ Error registering user:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    }
  }

  // ===== ویرایش کاربر (✅ فاز ۱۳.۰: پیوند پروندهٔ مشتری هم ذخیره می‌شود) =====

  async updateUser(id, data, role = null) {
    const payload = { ...data };
    if (role) payload.role = role;

    // رمز خالی در حالت ویرایش ⇒ «بدون تغییر»
    if (!payload.password) delete payload.password;

    const errors = adminPanelValidation.validateUserUpdate(payload);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    if (payload.role === "customer" && !payload.customer_id) {
      notificationService.error(
        "برای نقش «مشتری» انتخاب «پروندهٔ مشتری» الزامی است",
      );
      return;
    }

    const saveBtn = document.getElementById("saveUserBtn");
    const originalText = saveBtn?.innerHTML;

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';
    }

    try {
      const response = await adminPanelApi.updateUser(id, payload);
      if (response.success) {
        notificationService.success("✅ اطلاعات کاربر بروزرسانی شد");
        await this.loadUsers();
        this.closeUserModal();
      } else {
        notificationService.showError(
          response.message || "خطا در بروزرسانی کاربر",
        );
      }
    } catch (error) {
      console.error("❌ Error updating user:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
      }
    }
  }

  // ===== ثبت مدیر اصلی جدید =====

  async registerSuperAdmin(data) {
    data.role = "super_admin";

    // اعتبارسنجی
    const errors = adminPanelValidation.validateUser(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    const btn = document.getElementById("addSuperAdminBtn");
    const originalText = btn?.innerHTML;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';
    }

    try {
      const response = await adminPanelApi.registerUser(data);
      if (response.success) {
        notificationService.success("✅ مدیر اصلی با موفقیت ثبت شد");

        if (response.data.token) {
          adminPanelRenderer.showTokenModal(
            response.data.token,
            response.data.user,
          );
        }

        // پاکسازی فرم
        [
          "superFirstName",
          "superLastName",
          "superUsername",
          "superEmail",
          "superPassword",
          "superMobile",
        ].forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.value = "";
        });

        await this.loadSuperAdmins();
      } else {
        notificationService.showError(
          response.message || "خطا در ثبت مدیر اصلی",
        );
      }
    } catch (error) {
      console.error("❌ Error registering super admin:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  // ===== حذف کاربر =====

  async deleteUser(id) {
    // بررسی اینکه کاربر خودش را حذف نمی‌کند
    const currentUser = authService.getUser();
    const isDeletingSelf = currentUser && currentUser.id === id;

    const confirmed = await notificationService.confirm({
      title: isDeletingSelf ? "⚠️ حذف حساب کاربری خود" : "🗑️ حذف کاربر",
      text: isDeletingSelf
        ? "آیا از حذف حساب کاربری خود اطمینان دارید؟\nپس از حذف، از سیستم خارج خواهید شد."
        : "آیا از حذف این کاربر اطمینان دارید؟",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await adminPanelApi.deleteUser(id);
      if (response.success) {
        notificationService.success("✅ کاربر با موفقیت حذف شد");

        if (isDeletingSelf) {
          authService.logout("/login");
        } else {
          await this.loadUsers();
          await this.loadSuperAdmins();
        }
      } else {
        notificationService.showError(response.message || "خطا در حذف کاربر");
      }
    } catch (error) {
      console.error("❌ Error deleting user:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    }
  }

  // ===== بازنشانی توکن =====

  async resetUserToken(id) {
    const confirmed = await notificationService.confirm({
      title: "🔄 بازنشانی توکن",
      text: "آیا از بازنشانی توکن این کاربر اطمینان دارید؟",
      confirmText: "بله، بازنشانی شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await adminPanelApi.resetUserToken(id);
      if (response.success) {
        notificationService.success("✅ توکن با موفقیت بازنشانی شد");
        adminPanelRenderer.showTokenModal(response.data.token, null);
      } else {
        notificationService.showError(
          response.message || "خطا در بازنشانی توکن",
        );
      }
    } catch (error) {
      console.error("❌ Error resetting token:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    }
  }

  // ===== سایدبار =====

  setupSidebar() {
    const menuItems = document.querySelectorAll(".sidebar-menu-item");
    const sections = document.querySelectorAll(".content-section");

    menuItems.forEach((item) => {
      item.addEventListener("click", async () => {
        // حذف کلاس active از همه
        menuItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");

        // مخفی کردن همه بخش‌ها
        sections.forEach((section) => section.classList.remove("active"));

        // نمایش بخش انتخاب شده
        const menuId = item.dataset.menu;
        const activeSection = document.getElementById(menuId);
        if (activeSection) {
          activeSection.classList.add("active");
          this.selectedMenu = menuId;
          await this.loadMenuData(menuId);
        }
      });
    });

    // فعال کردن منوی پیش‌فرض
    const defaultMenu = document.querySelector(
      `.sidebar-menu-item[data-menu="${this.selectedMenu}"]`,
    );
    if (defaultMenu) {
      defaultMenu.classList.add("active");
      const defaultSection = document.getElementById(this.selectedMenu);
      if (defaultSection) defaultSection.classList.add("active");
    }
  }

  // ===== هم‌راستایی سایدبار با سطوح دسترسی =====
  // پس از اعمال گیت‌های data-permission:
  //   • اگر منوی فعال مخفی شده باشد ⇒ اولین منوی قابل‌مشاهده فعال می‌شود
  //     (تا محتوای پنل خالی و گیج‌کننده نماند)
  //   • اگر هیچ منویی قابل‌مشاهده نباشد ⇒ پیام راهنما نمایش داده می‌شود
  // ============================================================
  syncMenuVisibility() {
    const items = Array.from(
      document.querySelectorAll(".sidebar-menu-item[data-menu]"),
    );
    if (!items.length) return;

    const isVisible = (el) => el.style.display !== "none";
    const visible = items.filter(isVisible);
    const active = items.find((el) => el.classList.contains("active"));
    const contentArea = document.querySelector(".content-area");

    // ۱) هیچ بخشی برای این نقش فعال نیست
    if (!visible.length) {
      document
        .querySelectorAll(".content-section")
        .forEach((section) => section.classList.remove("active"));

      if (contentArea && !contentArea.querySelector(".perm-no-section")) {
        const box = document.createElement("div");
        box.className = "perm-no-section";
        box.innerHTML = `
          <i class="fas fa-lock"></i>
          <p>هیچ بخشی از پنل مدیریت برای نقش شما فعال نشده است.</p>
          <p class="perm-denied-hint">برای فعال‌سازی، مدیر اصلی باید از «مدیریت نقش‌ها و سطوح دسترسی» منوهای موردنیاز را روشن کند.</p>
          <a href="/" class="perm-btn primary">بازگشت به داشبورد</a>`;
        contentArea.appendChild(box);
      }
      return;
    }

    contentArea?.querySelector(".perm-no-section")?.remove();

    // ۲) منوی فعال قابل‌مشاهده است ⇒ کاری لازم نیست
    if (active && isVisible(active)) return;

    // ۳) اولین منوی قابل‌مشاهده را فعال کن
    visible[0].click();
  }

  // ===== کلید مجوز منوهای سایدبار =====
  //   (برای پیام «این بخش برای نقش شما بسته است» وقتی منو مخفی است)
  get menuPermissions() {
    return {
      "super-admin-management": "admin.menu.superAdmins",
      "user-management": "admin.menu.users",
      "dictionary-management": "admin.menu.dictionary",
      "role-management": "admin.menu.roles",
      "system-settings": "admin.menu.settings",
      suggestions: "admin.menu.suggestions",
      "release-notes": "admin.menu.releases",
      // فاز ۱۲.۳ — «فعالیت کاربران» (کلید منو جدا از کلید محتوایی
      // users.activity.view است که سرور روی /api/activity اعمال می‌کند)
      "activity-log": "admin.menu.activity",
      // فاز ۱۳.۶ — «درخواست‌های ثبت‌نام» (کلید محتوایی: users.registrations.view)
      "registration-requests": "admin.menu.registrations",
    };
  }

  async loadMenuData(menuId) {
    // ✅ اگر این بخش برای نقش کاربر بسته است (لینک مستقیم/کش قدیمی)،
    //    پیام قابل‌فهم در همان بخش نمایش داده می‌شود (نه خطا/بی‌صدا)
    const menuKey = this.menuPermissions[menuId];
    const menuSection = document.getElementById(menuId);

    // ⚠️ اگر مجوزها در دسترس نباشند، محتوا بی‌دلیل مسدود نمی‌شود (fail-open)
    if (menuKey && permissionService.hasData() && !permissionService.can(menuKey)) {
      if (menuSection) permissionService.renderDeniedNotice(menuSection, menuKey);
      return;
    }
    if (menuSection && menuKey && permissionService.hasData()) {
      permissionService.clearDeniedNotice(menuSection);
    }

    switch (menuId) {
      case "user-management":
        await this.loadUsers();
        break;
      case "super-admin-management":
        await this.loadSuperAdmins();
        break;
      case "dictionary-management":
        this.stopSuggestionsPolling();
        await this.initDictionaryManager();
        break;
      case "role-management":
        // ✅ «مدیریت نقش‌ها و سطوح دسترسی» (ماتریس نقش‌ها + دسترسی کاربران)
        this.stopSuggestionsPolling();
        await this.initPermissionManager();
        break;
      case "suggestions":
        // ✅ «نظرات و پیشنهادات» کاربران
        await this.loadSuggestions();
        this.startSuggestionsPolling();
        break;
      case "release-notes":
        // ✅ «تغییرات جدید / What's New» — اطلاع‌رسانی نسخه‌ها
        this.stopSuggestionsPolling();
        await this.initReleaseNotesManager();
        break;
      case "activity-log":
        // ✅ «فعالیت کاربران» (ردّ فعالیت) — فاز ۱۲.۳
        //    ⚠️ هیچ pollingای نداریم؛ مدیر با دکمهٔ «به‌روزرسانی» تازه می‌کند
        this.stopSuggestionsPolling();
        await this.initActivityLogManager();
        break;
      case "registration-requests":
        // ✅ «درخواست‌های ثبت‌نام» (فاز ۱۳.۶) — صف تأیید مشتریان
        this.stopSuggestionsPolling();
        await this.loadRegistrationRequests();
        // ✅ موج ۱۳.۷.۳ — مقدار سوییچ «تأیید خودکار» هم از سرور تازه می‌شود
        await this.loadRegistrationReviewSettings();
        break;
      default:
        console.log("📌 بخش:", menuId);
    }
  }

  // ===== مدیریت «نقش‌ها و سطوح دسترسی» =====

  async initPermissionManager() {
    try {
      // اگر ماژول مجوزها هنوز لود نشده، به‌صورت داینامیک لود کن
      if (!window.permissionManager) {
        await import("./permission.manager.js");
      }

      if (window.permissionManager) {
        await window.permissionManager.init("#permissionManagerContainer");
      } else {
        console.warn("⚠️ PermissionManager در دسترس نیست");
        notificationService.error("ماژول مدیریت سطوح دسترسی یافت نشد");
      }
    } catch (error) {
      console.error("❌ Error initializing permission manager:", error);
      notificationService.error("خطا در راه‌اندازی مدیریت سطوح دسترسی");
    }
  }

  // ===== مدیریت دیکشنری‌ها =====

  async initDictionaryManager() {
    try {
      // اگر ماژول دیکشنری هنوز لود نشده، به‌صورت داینامیک لود کن
      if (!window.dictManager) {
        await import("./dictionary.manager.js");
      }
      if (window.dictManager) {
        window.dictManager.init("#dictionary-management");
      } else {
        console.warn("⚠️ DictionaryManager در دسترس نیست");
        notificationService.error("ماژول مدیریت دیکشنری‌ها یافت نشد");
      }
    } catch (error) {
      console.error("❌ Error initializing dictionary manager:", error);
      notificationService.error("خطا در راه‌اندازی مدیریت دیکشنری‌ها");
    }
  }

  // ===== مدیریت «تغییرات جدید / What's New» =====

  async initReleaseNotesManager() {
    try {
      // اگر ماژول تغییرات هنوز لود نشده، به‌صورت داینامیک لود کن
      if (!window.whatsNewManager) {
        await import("../whats-new/whats-new.manager.js");
      }

      if (window.whatsNewManager) {
        await window.whatsNewManager.init("#releaseNotesContainer");
      } else {
        console.warn("⚠️ WhatsNewManager در دسترس نیست");
        notificationService.error("ماژول مدیریت تغییرات یافت نشد");
      }
    } catch (error) {
      console.error("❌ Error initializing whats-new manager:", error);
      notificationService.error("خطا در راه‌اندازی بخش تغییرات");
    }
  }

  // ===== «فعالیت کاربران» (ردّ فعالیت) — فاز ۱۲.۳ =====

  async initActivityLogManager() {
    try {
      // اگر ماژول ردّ فعالیت هنوز لود نشده، به‌صورت داینامیک لود کن
      if (!window.activityLogManager) {
        await import("../activity-log/activity-log.manager.js");
      }

      if (window.activityLogManager) {
        await window.activityLogManager.init("#activityLogContainer");
      } else {
        console.warn("⚠️ ActivityLogManager در دسترس نیست");
        notificationService.error("ماژول فعالیت کاربران یافت نشد");
      }
    } catch (error) {
      console.error("❌ Error initializing activity-log manager:", error);
      notificationService.error("خطا در راه‌اندازی بخش فعالیت کاربران");
    }
  }
  // ===== موج ۱۲.۴.۱ — پل «پروندهٔ مشتری → تاریخچهٔ همان رکورد» =====
  //   ⚠️ کلید sessionStorage یک‌بارمصرف است: همان‌جا خوانده و پاک
  //      می‌شود تا رفرش بعدی ناخواسته همان فیلتر را تحمیل نکند.

  takePendingHistory() {
    try {
      const raw = window.sessionStorage?.getItem(HISTORY_HANDOFF_KEY);
      if (!raw) return null;

      window.sessionStorage.removeItem(HISTORY_HANDOFF_KEY);
      return readHistoryHandoff(raw);
    } catch {
      return null;
    }
  }

  async applyPendingHistory(context) {
    if (!context) return;

    const menuItem = document.querySelector(
      '.sidebar-menu-item[data-menu="activity-log"]',
    );
    const menuKey = this.menuPermissions["activity-log"];
    const hidden = Boolean(menuItem) && menuItem.style.display === "none";
    const denied =
      menuKey && permissionService.hasData() && !permissionService.can(menuKey);

    // ⚠️ بدون منو/مجوز، رفتن به آن بخش بی‌فایده است ⇒ پیام روشن
    if (!menuItem || hidden || denied) {
      notificationService.warning(
        "بخش «فعالیت کاربران» برای نقش شما فعال نیست",
      );
      return;
    }

    const manager = await this.ensureActivityLogManager();
    if (!manager) return;

    manager.queueHistory(context);

    // بخش از قبل باز و آماده است ⇒ همان‌جا فیلتر را اعمال کن
    if (manager.initialized) {
      await manager.applyPendingHistory();
      return;
    }

    // بخش هنوز init نشده ⇒ init خودش صف را اعمال می‌کند
    menuItem.click();
  }

  async ensureActivityLogManager() {
    if (!window.activityLogManager) {
      try {
        await import("../activity-log/activity-log.manager.js");
      } catch (error) {
        console.error("❌ خطا در لود مدیر فعالیت کاربران:", error);
        return null;
      }
    }

    return window.activityLogManager || null;
  }

  // ===== موج ۱۲.۴.۱ — دیالوگ «تاریخچهٔ این کاربر» =====
  //   ⭐ نقطهٔ ورود جدول کاربران/مدیران اصلی: همان اطلاعاتی که در
  //      ردیف دیده می‌شود به عنوان عنوان دیالوگ می‌رود.

  async showUserHistory(id) {
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) return;

    const user = [...this.users, ...this.superAdmins].find(
      (item) => Number(item?.id) === userId,
    );
    const fullName = [user?.first_name, user?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    try {
      if (!window.activityHistoryDialog) {
        await import("../activity-log/activity-log.history.js");
      }

      if (!window.activityHistoryDialog) {
        notificationService.error("ماژول تاریخچهٔ فعالیت یافت نشد");
        return;
      }

      await window.activityHistoryDialog.open({
        entity: "users",
        entityId: String(userId),
        userId,
        title: fullName || user?.username || `کاربر #${userId}`,
      });
    } catch (error) {
      console.error("❌ خطا در نمایش تاریخچهٔ کاربر:", error);
      notificationService.error("نمایش تاریخچهٔ این کاربر ناموفق بود");
    }
  }



  // ===== مشاهده کاربر =====

  async viewUser(id) {
    try {
      const response = await adminPanelApi.getUser(id);
      if (response.success) {
        const user = response.data;
        const isSuperAdmin = user.role === "super_admin";

        if (isSuperAdmin) {
          this.editSuperAdmin(user.id);
        } else {
          this.editUser(user.id);
        }
      } else {
        notificationService.showError(
          response.message || "خطا در دریافت اطلاعات کاربر",
        );
      }
    } catch (error) {
      console.error("❌ Error viewing user:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    }
  }

  // ===== ویرایش کاربر =====

  editUser(id) {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      notificationService.error("کاربر یافت نشد");
      return;
    }
    this.openUserModal(null, user);
    this.editingUserRole = user.role || "expert";
  }

  editSuperAdmin(id) {
    const user = this.superAdmins.find((u) => u.id === id);
    if (!user) {
      notificationService.error("مدیر اصلی یافت نشد");
      return;
    }
    this.openUserModal("super_admin", user);
  }

  // ===== حذف مدیر اصلی =====

  async deleteSuperAdmin(id) {
    const currentUser = authService.getUser();
    const isDeletingSelf = currentUser && currentUser.id === id;

    const confirmed = await notificationService.confirm({
      title: isDeletingSelf ? "⚠️ حذف حساب کاربری خود" : "🗑️ حذف مدیر اصلی",
      text: isDeletingSelf
        ? "آیا از حذف حساب کاربری خود اطمینان دارید؟\nپس از حذف، از سیستم خارج خواهید شد."
        : "آیا از حذف این مدیر اصلی اطمینان دارید؟",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await adminPanelApi.deleteUser(id);
      if (response.success) {
        notificationService.success("✅ مدیر اصلی با موفقیت حذف شد");

        if (isDeletingSelf) {
          authService.logout("/login");
        } else {
          await this.loadSuperAdmins();
        }
      } else {
        notificationService.showError(
          response.message || "خطا در حذف مدیر اصلی",
        );
      }
    } catch (error) {
      console.error("❌ Error deleting super admin:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    }
  }

  // ===== تغییر وضعیت مدیر اصلی =====

  async toggleSuperAdminStatus(id, isActive) {
    const newStatus = !isActive;
    const actionText = newStatus ? "فعال" : "غیرفعال";

    // تأیید با SweetAlert
    const confirmed = await notificationService.confirm({
      title: `⏸️ ${actionText}سازی مدیر اصلی`,
      text: `آیا از ${actionText}سازی این مدیر اصلی اطمینان دارید؟`,
      confirmText: `بله، ${actionText} شود`,
      cancelText: "انصراف",
      icon: "question",
    });

    if (!confirmed) return;

    try {
      const response = await adminPanelApi.toggleUserStatus(id, {
        active: newStatus,
      });
      if (response.success) {
        notificationService.success(
          newStatus ? "✅ مدیر اصلی فعال شد" : "⏸️ مدیر اصلی غیرفعال شد",
        );
        await this.loadSuperAdmins();
      } else {
        notificationService.showError(response.message || "خطا در تغییر وضعیت");
      }
    } catch (error) {
      console.error("❌ Error toggling super admin status:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    }
  }

  // ===== مشاهده توکن کاربر =====

  async viewUserToken(id) {
    try {
      // ابتدا اطلاعات کاربر را بگیر تا نام و نقش را نمایش دهد
      const response = await adminPanelApi.getUser(id);
      if (response.success) {
        const user = response.data;
        // از پاسخ توکن اگر موجود بود استفاده کن
        adminPanelRenderer.showTokenModal(
          user.token || "توکنی موجود نیست",
          user,
        );
      } else {
        notificationService.showError(
          response.message || "خطا در دریافت اطلاعات کاربر",
        );
      }
    } catch (error) {
      console.error("❌ Error viewing user token:", error);
      notificationService.showError(error.message || "خطا در ارتباط با سرور");
    }
  }

  // ===== مودال کاربر =====

  openUserModal(role = null, user = null) {
    const modal = document.getElementById("userModal");
    const title = document.getElementById("modalTitle");

    if (!modal || !title) return;

    if (user) {
      // حالت ویرایش
      this.isEditing = true;
      this.editingUserId = user.id;
      this.editingUserRole = user.role;
      title.textContent = "✏️ ویرایش کاربر";
      adminPanelRenderer.fillUserForm(user);
    } else {
      // حالت جدید
      this.isEditing = false;
      this.editingUserId = null;
      this.editingUserRole = role;
      title.textContent =
        role === "sub_admin" ? "ثبت نام مدیر میانی" : "ثبت نام کاربر جدید";
      adminPanelRenderer.resetUserForm(role);
    }

    // غیرفعال کردن انتخاب نقش برای مدیر میانی
    const roleSelect = document.getElementById("role");
    if (roleSelect) {
      roleSelect.disabled = role === "sub_admin";
      if (role) roleSelect.value = role;
    }

    // ✅ فاز ۱۳.۰: بلوک «پروندهٔ مشتری» با نقش هم‌گام می‌شود
    //    (در حالت ویرایش، نقشِ خودِ کاربر خوانده می‌شود)
    this.syncCustomerLink(roleSelect?.value || user?.role || "expert");

    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  closeUserModal() {
    const modal = document.getElementById("userModal");
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
    this.isEditing = false;
    this.editingUserId = null;
    this.editingUserRole = null;
  }

  // ===== ✅ «پروندهٔ مشتری» (فاز ۱۳.۰) =====

  // بارگذاری گزینه‌های مشتری برای انتخاب در فرم کاربر (جستجوی زنده)
  async loadCustomerOptions(search = "") {
    try {
      const response = await adminPanelApi.getCustomers({
        limit: 50,
        search: search || undefined,
      });

      if (!response?.success) {
        notificationService.error(
          response?.message || "دریافت فهرست مشتریان ناموفق بود",
        );
        return;
      }

      // پاسخ: { customers: [...], pagination: {...} }
      const data = response.data;
      const customers = Array.isArray(data) ? data : data?.customers || [];
      this.customers = customers;
      adminPanelRenderer.renderCustomerOptions(customers);
    } catch (error) {
      console.error("❌ Error loading customers for user link:", error);
      notificationService.error(error.message || "خطا در دریافت فهرست مشتریان");
    }
  }

  // نمایش/پنهان‌کردن بلوک «پروندهٔ مشتری» + بارگذاری تنبل فهرست
  syncCustomerLink(role) {
    const isCustomer = role === "customer";
    adminPanelRenderer.setCustomerLinkVisibility(isCustomer);

    if (isCustomer && this.customers.length === 0) {
      this.loadCustomerOptions();
    }
  }

  // ===== نظرات و پیشنهادات (جای چت عمومی قبلی) =====

  setupSuggestions() {
    document
      .getElementById("suggestionsRefreshBtn")
      ?.addEventListener("click", () => this.loadSuggestions());

    document
      .getElementById("suggestionStatusFilter")
      ?.addEventListener("change", () => this.loadSuggestions());

    document
      .getElementById("suggestionUnreadOnly")
      ?.addEventListener("change", () => this.loadSuggestions());

    let searchTimer = null;
    document.getElementById("suggestionSearch")?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.loadSuggestions(), 400);
    });

    document
      .getElementById("suggestionSendBtn")
      ?.addEventListener("click", () => this.sendSuggestionReply());

    document
      .getElementById("suggestionStatusBtn")
      ?.addEventListener("click", () => this.changeSuggestionStatus());

    // ✅ دکمهٔ حذف کل گفتگو (در فوتر گفتگو)
    document
      .getElementById("suggestionDeleteBtn")
      ?.addEventListener("click", () => this.deleteSuggestion());
  }

  // فهرست «نظرات و پیشنهادات» + شمارنده‌ها + بج
  async loadSuggestions() {
    const list = document.getElementById("suggestionsList");
    const params = { limit: 50 };
    const status = document.getElementById("suggestionStatusFilter")?.value;
    if (status) params.status = status;
    if (document.getElementById("suggestionUnreadOnly")?.checked) {
      params.unread = "true";
    }
    const search = document.getElementById("suggestionSearch")?.value?.trim();
    if (search) params.search = search;

    if (list) {
      // ✅ لودر سیستمی (پیرو انتخاب ادمین)
      list.innerHTML = await loaderService.inline({
        text: "در حال بارگذاری…",
        size: "sm",
      });
    }

    try {
      const response = await adminPanelApi.getSuggestions(params);
      if (!response?.success) {
        if (list) {
          list.innerHTML = `<div class="msg-list-empty">${escapeHtml(
            response?.message || "خطا در دریافت نظرات",
          )}</div>`;
        }
        return;
      }

      this.suggestions = response.data?.items || [];
      this.suggestionCounts = response.data?.counts || {};
      this.renderSuggestionBadges();

      if (list) {
        list.innerHTML = messagesService.renderThreadList(this.suggestions, {
          emptyText: "نظری ثبت نشده است",
          onDelete: true,
        });
        list.querySelectorAll(".msg-list-item").forEach((el) => {
          el.addEventListener("click", (event) => {
            // ✅ کلیک روی دکمهٔ حذف، گفتگو را باز نکند
            const delBtn = event.target.closest("[data-delete-suggestion-id]");
            if (delBtn) {
              event.stopPropagation();
              this.deleteSuggestion(delBtn.dataset.deleteSuggestionId);
              return;
            }
            this.openSuggestion(el.dataset.suggestionId);
          });
        });
      }
    } catch (error) {
      if (list) {
        list.innerHTML = `<div class="msg-list-empty">خطا در دریافت نظرات</div>`;
      }
      console.error("❌ loadSuggestions:", error);
    }
  }

  // فقط شمارندهٔ نخوانده‌ها (برای بج منو/کارت + polling)
  async loadSuggestionCounts() {
    try {
      const response = await adminPanelApi.getSuggestions({ limit: 1 });
      if (response?.success) {
        this.suggestionCounts = response.data?.counts || {};
        this.renderSuggestionBadges();
      }
    } catch {
      /* بی‌صدا */
    }
  }

  renderSuggestionBadges() {
    const count = Number(this.suggestionCounts?.admin_unread || 0);
    ["suggestionsMenuBadge", "suggestionsBadge"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = String(count);
      el.style.display = count > 0 ? "" : "none";
    });
  }

  // مشاهدهٔ یک گفتگو (با این کار برای ادمین «خوانده‌شده» ثبت می‌شود)
  async openSuggestion(id) {
    if (!id) return;
    try {
      const response = await adminPanelApi.getSuggestionThread(id);
      if (!response?.success) {
        notificationService.error(response?.message || "گفتگو دریافت نشد");
        return;
      }

      const { suggestion, messages } = response.data;
      this.activeSuggestionId = suggestion?.id || id;

      const meta = document.getElementById("suggestionMeta");
      if (meta) {
        const user = suggestion?.user || {};
        meta.innerHTML = `
          ${statusBadge(suggestion?.status)}
          <span><i class="fas fa-user"></i> ${escapeHtml(user.full_name || "کاربر")}</span>
          ${user.mobile_number ? `<span dir="ltr">${escapeHtml(user.mobile_number)}</span>` : ""}
          <span><i class="fas fa-tag"></i> ${escapeHtml(subjectLabel(suggestion?.subject))}</span>
          <span><i class="fas fa-clock"></i> ${escapeHtml(
            new Date(suggestion?.last_message_at || suggestion?.created_at || Date.now()).toLocaleString("fa-IR"),
          )}</span>`;
      }

      const thread = document.getElementById("suggestionThread");
      if (thread) {
        thread.innerHTML = messagesService.renderBubbles(messages, {
          viewer: "admin",
          canDelete: true,
        });
        thread.scrollTop = thread.scrollHeight;

        // ✅ حذف تکی پیام — با delegation (فقط یک بار بایند میشود)
        if (thread.dataset.deleteBound !== "1") {
          thread.dataset.deleteBound = "1";
          thread.addEventListener("click", (event) => {
            const delBtn = event.target.closest(".msg-del-btn[data-message-id]");
            if (!delBtn) return;
            event.stopPropagation();
            this.deleteSuggestionMessage(delBtn.dataset.messageId);
          });
        }
      }

      const reply = document.getElementById("adminSuggestionReply");
      if (reply) reply.value = "";

      // وضعیت را در فهرست هم تازه کن (admin_unread از سمت سرور صفر شد)
      await this.loadSuggestions();
    } catch (error) {
      notificationService.error("خطا در دریافت گفتگو");
      console.error("❌ openSuggestion:", error);
    }
  }

  // ارسال پاسخ ادمین (به کاربر در «پیام‌های» او نمایش داده می‌شود)
  async sendSuggestionReply() {
    const input = document.getElementById("adminSuggestionReply");
    const body = input?.value?.trim();

    if (!this.activeSuggestionId) {
      notificationService.error("ابتدا یک گفتگو را از فهرست انتخاب کنید");
      return;
    }
    if (!body || body.length < 5) {
      notificationService.error("متن پاسخ را وارد کنید (حداقل ۵ حرف)");
      return;
    }

    const btn = document.getElementById("suggestionSendBtn");
    if (btn) btn.disabled = true;
    try {
      const response = await adminPanelApi.replySuggestion(
        this.activeSuggestionId,
        body,
      );
      if (!response?.success) {
        notificationService.error(response?.message || "ارسال پاسخ ناموفق بود");
        return;
      }
      if (input) input.value = "";
      notificationService.success("پاسخ ثبت و برای کاربر ارسال شد");
      await this.openSuggestion(this.activeSuggestionId);
    } catch (error) {
      console.error("❌ sendSuggestionReply:", error);
      notificationService.error("خطا در ارسال پاسخ");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // تغییر وضعیت گفتگو (چرخشی: جدید → در حال بررسی → پاسخ داده شده → بسته)
  async changeSuggestionStatus() {
    if (!this.activeSuggestionId) {
      notificationService.error("ابتدا یک گفتگو را انتخاب کنید");
      return;
    }

    const current =
      this.suggestions.find((item) => String(item.id) === String(this.activeSuggestionId))
        ?.status || "new";
    const order = ["new", "in_progress", "answered", "closed"];
    const next = order[(order.indexOf(current) + 1) % order.length];

    try {
      const response = await adminPanelApi.updateSuggestionStatus(
        this.activeSuggestionId,
        { status: next },
      );
      if (!response?.success) {
        notificationService.error(response?.message || "تغییر وضعیت ناموفق بود");
        return;
      }
      notificationService.success(
        `وضعیت گفتگو: ${statusBadge(next).replace(/<[^>]+>/g, "")}`,
      );
      await this.loadSuggestions();
    } catch (error) {
      console.error("❌ changeSuggestionStatus:", error);
      notificationService.error("خطا در تغییر وضعیت");
    }
  }

  async deleteSuggestion(id = this.activeSuggestionId) {
    if (!id) {
      notificationService.error("ابتدا یک گفتگو را از فهرست انتخاب کنید");
      return;
    }

    // ✅ تأیید با SweetAlert2 (هم‌سبک با بقیهٔ حذف‌های پنل — بدون دیالوگ بومی مرورگر)
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف گفتگو",
      text: "این گفتگو و همهٔ پیام‌های آن حذف شود؟",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });
    if (!confirmed) return;

    try {
      const response = await adminPanelApi.deleteSuggestion(id);
      if (!response?.success) {
        notificationService.error(response?.message || "حذف ناموفق بود");
        return;
      }
      notificationService.success("گفتگو حذف شد");
      this.activeSuggestionId = null;
      const thread = document.getElementById("suggestionThread");
      if (thread) {
        thread.innerHTML = `<div class="msg-list-empty">برای مشاهدهٔ گفتگو، یک مورد را از فهرست انتخاب کنید</div>`;
      }
      await this.loadSuggestions();
    } catch (error) {
      console.error("❌ deleteSuggestion:", error);
      notificationService.error("خطا در حذف گفتگو");
    }
  }

  // ✅ حذف یک پیام از گفتگو (پیام اول قابل حذف نیست → پیام خطای سرور)
  async deleteSuggestionMessage(messageId) {
    if (!this.activeSuggestionId || !messageId) return;

    // ✅ تأیید با SweetAlert2 (بدون دیالوگ بومی مرورگر)
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف پیام",
      text: "آیا از حذف این پیام اطمینان دارید؟ این پیام برای همیشه پاک می‌شود.",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });
    if (!confirmed) return;

    try {
      const response = await adminPanelApi.deleteSuggestionMessage(
        this.activeSuggestionId,
        messageId,
      );
      if (!response?.success) {
        notificationService.error(response?.message || "حذف پیام ناموفق بود");
        return;
      }

      notificationService.success(response.message || "پیام حذف شد");

      // اگر آخرین پیام حذف شد، کل گفتگو پاک شده است
      if (response.data?.thread_deleted) {
        this.activeSuggestionId = null;
        const emptyThread = document.getElementById("suggestionThread");
        if (emptyThread) {
          emptyThread.innerHTML = `<div class="msg-list-empty">برای مشاهدهٔ گفتگو، یک مورد را از فهرست انتخاب کنید</div>`;
        }
        await this.loadSuggestions();
        return;
      }

      const thread = document.getElementById("suggestionThread");
      if (thread && response.data?.messages) {
        thread.innerHTML = messagesService.renderBubbles(
          response.data.messages,
          { viewer: "admin", canDelete: true },
        );
        thread.scrollTop = thread.scrollHeight;
      }
      await this.loadSuggestions();
    } catch (error) {
      console.error("❌ deleteSuggestionMessage:", error);
      notificationService.error("خطا در حذف پیام");
    }
  }

  // بررسی دوره‌ای نظرات تازه (برای بج)
  startSuggestionsPolling() {
    this.stopSuggestionsPolling();
    this.suggestionsPolling = setInterval(() => {
      this.loadSuggestionCounts();
    }, 45 * 1000);
  }

  stopSuggestionsPolling() {
    if (this.suggestionsPolling) {
      clearInterval(this.suggestionsPolling);
      this.suggestionsPolling = null;
    }
  }

  // ============================================================
  // ✅ موج ۱۳.۶ — «درخواست‌های ثبت‌نام» (صف تأیید)
  // ------------------------------------------------------------
  // • فهرست/شمارش: users.registrations.view  (سرور هم همین را می‌سنجد)
  // • تأیید/رد: users.registrations.review + (تأیید) users.customer.link
  // • تأیید بدون پروندهٔ مشتری ارسال **نمی‌شود** (دکمه غیرفعال/پیام روشن)
  // ============================================================

  setupRegistrationQueue() {
    document
      .getElementById("regRefreshBtn")
      ?.addEventListener("click", () => this.loadRegistrationRequests());

    document
      .getElementById("regStatusFilter")
      ?.addEventListener("change", () => this.loadRegistrationRequests());

    // مودال بررسی (تأیید/رد)
    document
      .getElementById("regReviewCloseBtn")
      ?.addEventListener("click", () => this.closeRegistrationReview());
    document
      .getElementById("regApproveCancelBtn")
      ?.addEventListener("click", () => this.closeRegistrationReview());
    document
      .getElementById("regRejectCancelBtn")
      ?.addEventListener("click", () => this.closeRegistrationReview());
    document
      .getElementById("regApproveBtn")
      ?.addEventListener("click", () => this.confirmRegistrationApprove());
    document
      .getElementById("regRejectBtn")
      ?.addEventListener("click", () => this.confirmRegistrationReject());

    // جستجوی زندهٔ پروندهٔ مشتری در مودال تأیید
    let searchTimer = null;
    document.getElementById("regCustomerSearch")?.addEventListener("input", (event) => {
      const value = event.target.value.trim();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => this.loadRegistrationCustomerOptions(value), 400);
    });

    // ✅ موج ۱۳.۷ — سوییچ حالت پروندهٔ مشتری: «موجود» یا «تازه»
    document
      .getElementById("regModeExistingBtn")
      ?.addEventListener("click", () => this.setRegistrationCustomerMode("existing"));
    document
      .getElementById("regModeNewBtn")
      ?.addEventListener("click", () => this.setRegistrationCustomerMode("new"));

    // ✅ موج ۱۳.۷.۱ — انتخاب استان ⇒ بارگذاری شهرستان‌های همان استان (استان ⇒ شهرستان)
    document
      .getElementById("regNewCustomerProvince")
      ?.addEventListener("change", (event) =>
        this.loadRegistrationCounties(event.target.value),
      );

    // بج تعداد در انتظار تأیید (بی‌صدا اگر مجوز نباشد)
    this.refreshRegistrationsBadge();

    // ✅ موج ۱۳.۷.۳ — سوییچ «تأیید خودکار» (bind + بارگذاری مقدار)
    this.setupAutoApproveRegistration();
    this.loadRegistrationReviewSettings();
  }

  // ============================================================
  // ✅ موج ۱۳.۷.۳ — سوییچ «تأیید خودکار ثبت‌نام»
  // ------------------------------------------------------------
  // • خواندن:  GET /api/registrations/settings   (users.registrations.view)
  // • نوشتن:   PUT /api/registrations/settings   (users.registrations.review
  //            و برای «روشن‌کردن» additionally customers.register)
  // ⚠️ اگر کاربر مجوز لازم را نداشته باشد سوییچ غیرفعال می‌شود و دلیلش در
  //    tooltip دیده می‌شود؛ مقدار نمایش‌داده‌شده همیشه از سرور می‌آید
  //    (سرور منبع حقیقت است، نه حافظهٔ مرورگر).
  // ============================================================

  setupAutoApproveRegistration() {
    document
      .getElementById("autoApproveRegistrationToggle")
      ?.addEventListener("change", (event) =>
        this.saveAutoApproveRegistration(event.target),
      );
  }

  // رندر وضعیت سوییچ بر اساس دادهٔ سرور
  renderAutoApproveRegistration() {
    const toggle = document.getElementById("autoApproveRegistrationToggle");
    const stateLabel = document.getElementById("autoApproveRegistrationState");
    const bar = document.getElementById("regAutoApproveBar");
    const on = this.autoApproveRegistration === true;
    const canToggle = this.autoApproveCanToggle === true;

    if (toggle) {
      toggle.checked = on;
      toggle.disabled = !canToggle;
      toggle.title = canToggle
        ? "با روشن‌کردن، هر ثبت‌نام تازه بی‌درنگ تأیید و حساب مشتری ساخته می‌شود"
        : "برای تغییر این سوییچ به مجوز «بازبینی درخواست‌های ثبت‌نام» و «ثبت مشتری جدید» نیاز دارید";
    }
    if (bar) {
      bar.classList.toggle("is-on", on);
      bar.classList.toggle("is-disabled", !canToggle);
    }
    if (stateLabel) {
      stateLabel.textContent = !canToggle ? "بدون مجوز" : on ? "روشن" : "خاموش";
    }
  }

  async loadRegistrationReviewSettings() {
    try {
      const response = await adminPanelApi.getRegistrationSettings();
      if (!response?.success) {
        throw new Error(response?.message || "دریافت تنظیمات صف ناموفق بود");
      }

      const data = response.data || {};
      this.autoApproveRegistration = data.auto_approve === true;
      this.autoApproveCanToggle = data.can_toggle === true;
      this.renderAutoApproveRegistration();
      return this.autoApproveRegistration;
    } catch (error) {
      console.warn(
        "⚠️ دریافت تنظیمات صف ثبت‌نام ناموفق بود:",
        error?.message || error,
      );
      this.autoApproveCanToggle = false;
      this.renderAutoApproveRegistration();
      const stateLabel = document.getElementById("autoApproveRegistrationState");
      if (stateLabel) stateLabel.textContent = "نامشخص";
      return null;
    }
  }

  async saveAutoApproveRegistration(toggle) {
    const desired = toggle?.checked === true;
    const stateLabel = document.getElementById("autoApproveRegistrationState");

    if (toggle) toggle.disabled = true;
    if (stateLabel) stateLabel.textContent = "در حال ذخیره…";

    try {
      const response = await adminPanelApi.updateRegistrationSettings({
        auto_approve: desired,
      });
      if (!response?.success) {
        throw new Error(response?.message || "ذخیرهٔ تنظیم ناموفق بود");
      }

      this.autoApproveRegistration = response.data?.auto_approve === true;
      this.renderAutoApproveRegistration();

      if (this.autoApproveRegistration) {
        notificationService.warning(
          "تأیید خودکار روشن شد: ثبت‌نام‌های تازه بی‌درنگ تأیید می‌شوند — تا زمانی که کپچا و محدودیت نرخ فعال باشند این حالت امن است",
        );
      } else {
        notificationService.success(
          "تأیید خودکار خاموش شد؛ درخواست‌های تازه در صف بازبینی می‌مانند",
        );
      }

      // صف دوباره خوانده شود (درخواست‌های «تأیید خودکار» در فیلتر approved دیده می‌شوند)
      await this.loadRegistrationRequests();
    } catch (error) {
      console.error("❌ Error saving registration auto-approve:", error);
      notificationService.error(
        error?.message || "ذخیرهٔ تنظیم «تأیید خودکار» ناموفق بود",
      );
      // برگشت به مقدار سرور (نه مقدار آرزویی کاربر)
      this.renderAutoApproveRegistration();
      await this.loadRegistrationReviewSettings();
    } finally {
      if (toggle) toggle.disabled = this.autoApproveCanToggle !== true;
    }
  }

  // بج «در انتظار تأیید» روی منوی سایدبار
  async refreshRegistrationsBadge() {
    const badge = document.getElementById("registrationsMenuBadge");
    if (!badge) return;

    if (permissionService.hasData() && !permissionService.can("users.registrations.view")) {
      badge.style.display = "none";
      return;
    }

    try {
      const response = await adminPanelApi.getRegistrationPendingCount();
      const count = Number(response?.data?.count || 0);
      badge.textContent = String(count);
      badge.style.display = count > 0 ? "" : "none";
    } catch (error) {
      // بی‌صدا: نبود بج نباید تجربهٔ پنل را خراب کند
      console.warn("⚠️ شمارش درخواست‌های ثبت‌نام ناموفق بود:", error?.message || error);
    }
  }

  // فهرست صف بر اساس فیلتر وضعیت
  async loadRegistrationRequests() {
    const container = document.getElementById("registrationQueueContainer");
    const filter = document.getElementById("regStatusFilter")?.value || "pending";
    const params = { limit: 50 };
    if (filter && filter !== "all") params.status = filter;

    if (container) {
      container.innerHTML = `
        <div class="regq-empty">
          <i class="fas fa-spinner fa-spin" style="font-size:24px;"></i>
          <p style="margin:8px 0 0;font-size:13px;">در حال بارگذاری درخواست‌ها…</p>
        </div>`;
    }

    try {
      const response = await adminPanelApi.getRegistrations(params);
      if (!response?.success) {
        notificationService.error(response?.message || "دریافت درخواست‌های ثبت‌نام ناموفق بود");
        return;
      }

      // پاسخ: { items: [...], total, page, limit, status }
      const data = response.data || {};
      this.registrations = Array.isArray(data.items) ? data.items : [];
      adminPanelRenderer.renderRegistrationRequests(this.registrations);
      this.refreshRegistrationsBadge();
    } catch (error) {
      console.error("❌ Error loading registration requests:", error);
      if (container) {
        container.innerHTML = `
          <div class="regq-empty">
            <i class="fas fa-triangle-exclamation" style="font-size:24px;"></i>
            <p style="margin:8px 0 0;font-size:13px;">${escapeHtml(
              error.message || "خطا در دریافت درخواست‌ها",
            )}</p>
          </div>`;
      }
    }
  }

  // بازکردن مودال بررسی در یکی از دو حالت approve / reject
  openRegistrationReview(id, mode = "approve") {
    const item = (this.registrations || []).find((row) => Number(row.id) === Number(id));
    if (!item) {
      notificationService.error("درخواست انتخاب‌شده یافت نشد؛ فهرست را تازه کنید");
      return;
    }

    this.reviewingRegistration = item;
    this.reviewMode = mode === "reject" ? "reject" : "approve";

    const modal = document.getElementById("regReviewModal");
    const approveBlock = document.getElementById("regApproveBlock");
    const rejectBlock = document.getElementById("regRejectBlock");
    const title = document.getElementById("regReviewTitle");
    const summary = document.getElementById("regReviewSummary");

    const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim();
    if (summary) {
      summary.innerHTML = `
        <div class="regq-summary-name">${escapeHtml(fullName || item.username || "بدون نام")}</div>
        <div class="regq-summary-meta">
          <span><i class="fas fa-user"></i> ${escapeHtml(item.username || "-")}</span>
          <span><i class="fas fa-mobile-screen"></i> ${escapeHtml(item.mobile_number || "-")}</span>
          <span><i class="fas fa-envelope"></i> ${escapeHtml(item.email || "-")}</span>
        </div>
        ${
          item.requested_customer_code
            ? `<div class="regq-summary-meta"><span><i class="fas fa-id-card"></i> پروندهٔ ادعاشده: ${escapeHtml(
                item.requested_customer_code,
              )}</span></div>`
            : ""
        }
        ${
          // ✅ موج ۱۳.۷.۲ — اطلاعات پرونده‌ای که متقاضی خودش در فرم وارد کرده است
          item.farm_name || item.province || item.national_code
            ? `<div class="regq-summary-meta">
                ${item.farm_name ? `<span><i class="fas fa-warehouse"></i> ${escapeHtml(item.farm_name)}</span>` : ""}
                ${
                  item.province
                    ? `<span><i class="fas fa-location-dot"></i> ${escapeHtml(item.province)}${
                        item.county ? ` / ${escapeHtml(item.county)}` : ""
                      }</span>`
                    : ""
                }
                ${item.national_code ? `<span><i class="fas fa-id-card"></i> کد ملی: ${escapeHtml(item.national_code)}</span>` : ""}
              </div>`
            : ""
        }`;
    }

    if (title) {
      title.textContent =
        this.reviewMode === "approve" ? "تأیید درخواست ثبت‌نام" : "رد درخواست ثبت‌نام";
    }
    if (approveBlock) approveBlock.hidden = this.reviewMode !== "approve";
    if (rejectBlock) rejectBlock.hidden = this.reviewMode !== "reject";

    // پاک‌کردن حالت قبلی
    const reason = document.getElementById("regRejectReason");
    if (reason) reason.value = "";
    const search = document.getElementById("regCustomerSearch");
    if (search) search.value = "";
    const select = document.getElementById("regCustomerSelect");
    if (select) select.value = "";

    // ✅ موج ۱۳.۷ — بازنشانی «پروندهٔ تازه» (نام از خود درخواست پیش‌پر می‌شود)
    this.resetRegistrationNewCustomerForm(item);

    if (modal) {
      modal.classList.add("active");
      document.body.style.overflow = "hidden";
    }

    // فهرست پرونده‌های مشتریان فقط برای حالت تأیید (تنبل)
    if (this.reviewMode === "approve") this.loadRegistrationCustomerOptions("");
  }

  closeRegistrationReview() {
    const modal = document.getElementById("regReviewModal");
    if (modal) modal.classList.remove("active");
    document.body.style.overflow = "";
    this.reviewingRegistration = null;
    this.reviewMode = null;
    // ✅ موج ۱۳.۷ — بستن مودال، حالت «پروندهٔ تازه» را هم صفر می‌کند
    this.registrationCustomerMode = "existing";
    this.clearRegistrationNewCustomerError();
  }

  // گزینه‌های پروندهٔ مشتری با جستجوی زنده (هم‌منبع فرم کاربر)
  async loadRegistrationCustomerOptions(search = "") {
    try {
      const response = await adminPanelApi.getCustomers({
        limit: 50,
        search: search || undefined,
      });
      if (!response?.success) return;

      const data = response.data;
      const customers = Array.isArray(data) ? data : data?.customers || [];
      adminPanelRenderer.renderRegistrationCustomerOptions(customers);
    } catch (error) {
      console.warn("⚠️ دریافت فهرست مشتریان برای تأیید ناموفق بود:", error?.message || error);
    }
  }


  // ============================================================
  // ✅ موج ۱۳.۷ — حالت «پروندهٔ مشتری» در مودال تأیید
  // ------------------------------------------------------------
  // دو مسیر:
  //   existing → اتصال به پروندهٔ موجود (customer_id) — رفتار فاز ۱۳.۶
  //   new      → ساخت پروندهٔ تازه از دادهٔ فرم (customer_mode: "new")
  // ⚠️ ساخت پروندهٔ تازه در سرور «customers.register» می‌خواهد؛ کاربرِ بدون
  //    این مجوز دکمهٔ حالت «تازه» را نمی‌بیند (fail-open هم‌الگوی پنل).
  // ============================================================

  // آیا کاربر مجاز به ساخت پروندهٔ مشتری است؟ (هم‌مجوز با فرم ثبت مشتری)
  canRegisterCustomers() {
    if (permissionService.hasData() && !permissionService.can("customers.register")) {
      return false;
    }
    return true;
  }

  // آیا کاربر می‌تواند انواع مشتری را بخواند؟ (دیکشنری customer-types)
  canReadCustomerTypes() {
    if (
      permissionService.hasData() &&
      !permissionService.can("dictionary.customer-types.view")
    ) {
      return false;
    }
    return true;
  }

  // خطای فرم «پروندهٔ تازه» — همان‌جا زیر فرم نمایش داده می‌شود
  showRegistrationNewCustomerError(message = "") {
    const box = document.getElementById("regNewCustomerError");
    if (!box) return;
    box.textContent = message || "";
    box.hidden = !message;
  }

  clearRegistrationNewCustomerError() {
    this.showRegistrationNewCustomerError("");
  }

  // انتخاب حالت + نمایش/پنهان‌کردن بلوک‌ها
  // ✅ ۱۳.۷.۲ — async شد تا پیش‌پرکردن بعد از بارگذاری دیکشنری‌ها اعمال شود
  async setRegistrationCustomerMode(mode = "existing") {
    const next = mode === "new" && this.canRegisterCustomers() ? "new" : "existing";
    this.registrationCustomerMode = next;

    const existingBtn = document.getElementById("regModeExistingBtn");
    const newBtn = document.getElementById("regModeNewBtn");
    existingBtn?.classList.toggle("active", next === "existing");
    newBtn?.classList.toggle("active", next === "new");
    existingBtn?.setAttribute("aria-selected", next === "existing" ? "true" : "false");
    newBtn?.setAttribute("aria-selected", next === "new" ? "true" : "false");

    const existingBlock = document.getElementById("regExistingCustomerBlock");
    const newBlock = document.getElementById("regNewCustomerBlock");
    if (existingBlock) existingBlock.hidden = next !== "existing";
    if (newBlock) newBlock.hidden = next !== "new";

    this.clearRegistrationNewCustomerError();
    if (next === "new") {
      // دیکشنری‌ها موازی؛ بعد از بارگذاری، مقادیر «درخواست» دوباره نشانده می‌شوند
      await Promise.all([this.loadRegistrationCustomerTypes(), this.loadRegistrationProvinces()]);
      await this.applyRegistrationNewCustomerPrefill();
    }
  }

  // ✅ ۱۳.۷.۲ — نشاندن دادهٔ درخواست روی فرم «پروندهٔ تازه»
  //  ⚠️ بعد از بارگذاری دیکشنری‌ها صدا زده می‌شود (گزینه‌ها باید موجود باشند)
  async applyRegistrationNewCustomerPrefill() {
    const prefill = this.newCustomerPrefill || {};
    const selectValue = (id, value) => {
      const select = document.getElementById(id);
      if (!select || !value) return;
      const exists = Array.from(select.options).some(
        (option) => option.value === String(value),
      );
      if (exists) select.value = String(value);
    };

    selectValue("regNewCustomerType", prefill.customer_type_id);
    selectValue("regNewCustomerProvince", prefill.province);

    // شهرستان وابسته به استان است ⇒ پس از استان بارگذاری می‌شود
    if (prefill.province) {
      await this.loadRegistrationCounties(prefill.province, prefill.county || "");
    } else {
      this.resetRegistrationCounties();
    }
  }

  // بازنشانی فرم «پروندهٔ تازه» + پیش‌پر کردن از خود درخواست
  // ✅ ۱۳.۷.۲ — نوع مشتری/کد ملی/نام واحد/استان/شهرستان هم از درخواست می‌آید
  resetRegistrationNewCustomerForm(item = {}) {
    const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim();
    const setValue = (id, value = "") => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };

    this.newCustomerPrefill = {
      customer_type_id: item.customer_type_id ? String(item.customer_type_id) : "",
      national_code: String(item.national_code || ""),
      farm_name: String(item.farm_name || ""),
      province: String(item.province || ""),
      county: String(item.county || ""),
    };

    setValue("regNewCustomerType", "");
    setValue("regNewCustomerFullName", fullName);
    setValue("regNewCustomerNationalCode", this.newCustomerPrefill.national_code);
    setValue("regNewCustomerFarmName", this.newCustomerPrefill.farm_name);
    setValue("regNewCustomerProvince", "");
    // ✅ ۱۳.۷.۱ — شهرستان‌ها هم صفر و غیرفعال می‌شوند (وابسته به استان)
    this.resetRegistrationCounties();

    // بدون مجوز «ثبت مشتری جدید»، حالت «تازه» حتی نمایش داده نمی‌شود
    const newBtn = document.getElementById("regModeNewBtn");
    if (newBtn) newBtn.hidden = !this.canRegisterCustomers();

    // پیش‌فرض: درخواست‌های تازه خودشان اطلاعات پرونده را دارند ⇒ «پروندهٔ تازه»
    // درخواست‌های قدیمی (بدون customer_type_id) همان «پروندهٔ موجود» می‌مانند.
    const preferNew = Boolean(this.newCustomerPrefill.customer_type_id);
    this.setRegistrationCustomerMode(preferNew ? "new" : "existing")?.catch?.((error) => {
      console.warn("⚠️ آماده‌سازی فرم «پروندهٔ تازه» ناموفق بود:", error?.message || error);
    });
  }

  // انواع مشتری (تنبل — یک‌بار از سرور، بعد از آن از حافظه)
  async loadRegistrationCustomerTypes() {
    const select = document.getElementById("regNewCustomerType");
    if (!select || select.dataset.loaded === "true") return;

    if (!this.canReadCustomerTypes()) {
      this.showRegistrationNewCustomerError(
        "برای انتخاب «نوع مشتری»، مجوز «مشاهدهٔ انواع مشتری» لازم است",
      );
      return;
    }

    try {
      const response = await adminPanelApi.getCustomerTypes();
      if (!response?.success) return;

      const list = Array.isArray(response.data) ? response.data : [];
      select.innerHTML = '<option value="">— انتخاب نوع مشتری —</option>';
      list.forEach((type) => {
        const id = Number(type?.id);
        if (!Number.isInteger(id) || id <= 0 || type.active === false) return;
        const option = document.createElement("option");
        option.value = String(id);
        option.textContent = type.name || `نوع ${id}`;
        select.add(option);
      });
      select.dataset.loaded = "true";
    } catch (error) {
      console.warn("⚠️ دریافت انواع مشتری برای تأیید ناموفق بود:", error?.message || error);
      this.showRegistrationNewCustomerError(
        "دریافت «انواع مشتری» ناموفق بود؛ دوباره تلاش کنید یا پروندهٔ موجود را انتخاب کنید",
      );
    }
  }

  // ✅ موج ۱۳.۷.۱ — استان‌ها از دیکشنری (تنبل — یک‌بار از سرور، بعد از آن از حافظه)
  async loadRegistrationProvinces() {
    const select = document.getElementById("regNewCustomerProvince");
    if (!select || select.dataset.loaded === "true") return;

    try {
      const response = await adminPanelApi.getProvinces();
      if (!response?.success) return;

      const list = Array.isArray(response.data) ? response.data : [];
      select.innerHTML = '<option value="">— انتخاب استان (اختیاری) —</option>';
      list.forEach((province) => {
        const name = String(province?.state_name || "").trim();
        if (!name) return;
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.add(option);
      });
      select.dataset.loaded = "true";
    } catch (error) {
      console.warn("⚠️ دریافت استان‌ها برای پروندهٔ تازه ناموفق بود:", error?.message || error);
      if (!select.options.length) {
        select.innerHTML = '<option value="">خطا در دریافت استان‌ها</option>';
      }
    }
  }

  // شهرستان‌ها را به حالت «ابتدا استان را انتخاب کنید» برمی‌گرداند + غیرفعال می‌کند
  resetRegistrationCounties(message = "— ابتدا استان را انتخاب کنید —") {
    const select = document.getElementById("regNewCustomerCounty");
    if (!select) return;

    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    select.add(option);
    select.value = "";
    select.disabled = true;
  }

  // ✅ موج ۱۳.۷.۱ — شهرستان‌های استان انتخاب‌شده (وابسته: استان ⇒ شهرستان)
  async loadRegistrationCounties(province = "", selected = "") {
    const select = document.getElementById("regNewCustomerCounty");
    if (!select) return;

    const provinceName = String(province || "").trim();
    if (!provinceName) {
      this.resetRegistrationCounties();
      return;
    }

    select.disabled = true;
    select.innerHTML = '<option value="">در حال بارگذاری...</option>';

    try {
      const response = await adminPanelApi.getCitiesByProvince(provinceName);
      if (!response?.success) {
        this.resetRegistrationCounties("— شهرستانی یافت نشد —");
        return;
      }

      const list = Array.isArray(response.data) ? response.data : [];
      select.innerHTML = '<option value="">— انتخاب شهرستان (اختیاری) —</option>';
      list.forEach((city) => {
        const name = String(city?.city_name || "").trim();
        if (!name) return;
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        select.add(option);
      });

      if (list.length === 0) {
        this.resetRegistrationCounties("— شهرستانی یافت نشد —");
        return;
      }

      select.disabled = false;
      if (selected && Array.from(select.options).some((opt) => opt.value === selected)) {
        select.value = selected;
      }
    } catch (error) {
      console.warn("⚠️ دریافت شهرستان‌ها برای پروندهٔ تازه ناموفق بود:", error?.message || error);
      this.resetRegistrationCounties("— خطا در دریافت شهرستان‌ها —");
    }
  }

  // بدنهٔ «پروندهٔ تازه» از فرم — پیش‌اعتبارسنجی هم‌قاعده با سرور
  buildRegistrationNewCustomer() {
    const read = (id) => document.getElementById(id)?.value ?? "";

    const typeId = Number(String(read("regNewCustomerType")).trim() || 0);
    if (!Number.isInteger(typeId) || typeId <= 0) {
      return { error: "نوع مشتری را از فهرست انتخاب کنید" };
    }

    const fullName = String(read("regNewCustomerFullName")).trim();
    if (fullName.length < NEW_CUSTOMER_MIN_NAME_LENGTH) {
      return { error: "نام و نام خانوادگی مشتری الزامی است" };
    }
    if (fullName.length > NEW_CUSTOMER_MAX_NAME_LENGTH) {
      return { error: `نام مشتری حداکثر ${NEW_CUSTOMER_MAX_NAME_LENGTH} کاراکتر است` };
    }

    const nationalCode = digitsOnlyValue(
      read("regNewCustomerNationalCode"),
      NEW_CUSTOMER_NATIONAL_CODE_LENGTH,
    );
    if (nationalCode !== "" && nationalCode.length !== NEW_CUSTOMER_NATIONAL_CODE_LENGTH) {
      return { error: "کد ملی باید ۱۰ رقم باشد" };
    }

    // ✅ ۱۳.۷.۱ — استان/شهرستان از دیکشنری می‌آیند؛ شهرستان بدون استان معنا ندارد
    // ✅ ۱۳.۷.۲ — مقادیر خالی به‌صورت رشتهٔ خالی فرستاده می‌شوند تا «پاک‌کردن»
    //    ممکن باشد (سرور فقط null/undefined را «نبود مقدار» می‌شناسد و از
    //    درخواست پر می‌کند)
    const province = String(read("regNewCustomerProvince")).trim();
    const county = province ? String(read("regNewCustomerCounty")).trim() : "";

    return {
      values: {
        customer_type_id: typeId,
        full_name: fullName,
        national_code: nationalCode,
        farm_name: String(read("regNewCustomerFarmName")).trim(),
        province,
        county,
      },
    };
  }

  // تأیید: پروندهٔ موجود ⇒ customer_id | پروندهٔ تازه ⇒ customer_mode="new" + customer
  async confirmRegistrationApprove() {
    const item = this.reviewingRegistration;
    if (!item) return;

    const payload = { customer_mode: this.registrationCustomerMode };

    if (this.registrationCustomerMode === "new") {
      const built = this.buildRegistrationNewCustomer();
      if (built.error) {
        this.showRegistrationNewCustomerError(built.error);
        notificationService.error(built.error);
        return;
      }
      this.clearRegistrationNewCustomerError();
      payload.customer = built.values;
    } else {
      const customerId = Number(document.getElementById("regCustomerSelect")?.value || 0);
      if (!Number.isInteger(customerId) || customerId <= 0) {
        notificationService.error("برای تأیید، انتخاب پروندهٔ مشتری الزامی است");
        return;
      }
      payload.customer_id = customerId;
    }

    const button = document.getElementById("regApproveBtn");
    if (button) button.disabled = true;

    try {
      const response = await adminPanelApi.approveRegistration(item.id, payload);
      if (response?.success) {
        notificationService.success(
          response.message || "درخواست تأیید شد و حساب مشتری ساخته شد",
        );
        this.closeRegistrationReview();
        await this.loadRegistrationRequests();
        await this.loadUsers();
      } else {
        notificationService.error(response?.message || "تأیید درخواست ناموفق بود");
      }
    } catch (error) {
      console.error("❌ Error approving registration:", error);
      // پیام دقیق سرور (۴۰۹ موبایل تکراری / ۴۰۰ نوع مشتری / ۴۰۳ مجوز) همان‌جای فرم
      if (this.registrationCustomerMode === "new") {
        this.showRegistrationNewCustomerError(error?.message || "");
      }
      notificationService.error(error.message || "خطا در تأیید درخواست");
    } finally {
      if (button) button.disabled = false;
    }
  }

  // رد: دلیل اجباری است
  async confirmRegistrationReject() {
    const item = this.reviewingRegistration;
    if (!item) return;

    const reason = String(document.getElementById("regRejectReason")?.value || "").trim();
    if (reason.length < 3) {
      notificationService.error("دلیل رد را وارد کنید (حداقل ۳ کاراکتر)");
      return;
    }

    const button = document.getElementById("regRejectBtn");
    if (button) button.disabled = true;

    try {
      const response = await adminPanelApi.rejectRegistration(item.id, reason);
      if (response?.success) {
        notificationService.success(response.message || "درخواست ثبت‌نام رد شد");
        this.closeRegistrationReview();
        await this.loadRegistrationRequests();
      } else {
        notificationService.error(response?.message || "رد درخواست ناموفق بود");
      }
    } catch (error) {
      console.error("❌ Error rejecting registration:", error);
      notificationService.error(error.message || "خطا در رد درخواست");
    } finally {
      if (button) button.disabled = false;
    }
  }

  // ===== رویدادها =====

  setupEvents() {
    // دکمه ساخت ادمین اولیه
    const setupBtn = document.getElementById("setupAdminBtn");
    if (setupBtn) {
      setupBtn.addEventListener("click", () => {
        const data = {
          first_name: document.getElementById("setupFirstName")?.value,
          last_name: document.getElementById("setupLastName")?.value,
          username: document.getElementById("setupUsername")?.value,
          email: document.getElementById("setupEmail")?.value,
          password: document.getElementById("setupPassword")?.value,
          mobile_number: document.getElementById("setupMobile")?.value,
        };
        this.setupAdmin(data);
      });
    }

    // دکمه ثبت مدیر اصلی جدید
    const addSuperAdminBtn = document.getElementById("addSuperAdminBtn");
    if (addSuperAdminBtn) {
      addSuperAdminBtn.addEventListener("click", () => {
        const data = {
          first_name: document.getElementById("superFirstName")?.value,
          last_name: document.getElementById("superLastName")?.value,
          username: document.getElementById("superUsername")?.value,
          email: document.getElementById("superEmail")?.value,
          password: document.getElementById("superPassword")?.value,
          mobile_number: document.getElementById("superMobile")?.value,
        };
        this.registerSuperAdmin(data);
      });
    }

    // دکمه اضافه کردن مدیر میانی
    const addSubAdminBtn = document.getElementById("addSubAdminBtn");
    if (addSubAdminBtn) {
      addSubAdminBtn.addEventListener("click", () => {
        this.openUserModal("sub_admin");
      });
    }

    // دکمه اضافه کردن کاربر عادی
    const addUserBtn = document.getElementById("addUserBtn");
    if (addUserBtn) {
      addUserBtn.addEventListener("click", () => {
        this.openUserModal("expert");
      });
    }

    // دکمه ذخیره در مودال
    const saveBtn = document.getElementById("saveUserBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        const data = adminPanelRenderer.getUserFormData();
        const role = document.getElementById("role")?.value;

        // ✅ فاز ۱۳.۰: در حالت ویرایش، به‌جای «ثبت کاربر جدید» واقعاً
        //    همان کاربر بروزرسانی می‌شود (قبلاً یک کاربر تکراری ساخته می‌شد)
        if (this.isEditing && this.editingUserId) {
          this.updateUser(this.editingUserId, data, role);
        } else {
          this.registerUser(data, role);
        }
      });
    }

    // ✅ فاز ۱۳.۰: تغییر نقش ⇒ نمایش/پنهان‌کردن بلوک «پروندهٔ مشتری»
    const roleSelect = document.getElementById("role");
    if (roleSelect) {
      roleSelect.addEventListener("change", () =>
        this.syncCustomerLink(roleSelect.value),
      );
    }

    // ✅ فاز ۱۳.۰: جستجوی زندهٔ مشتری برای انتخاب پرونده (۳۰۰ms)
    const customerSearch = document.getElementById("customerSearch");
    if (customerSearch) {
      customerSearch.addEventListener("input", () => {
        clearTimeout(this.customerSearchTimer);
        const term = customerSearch.value.trim();
        this.customerSearchTimer = setTimeout(() => {
          this.loadCustomerOptions(term);
        }, 300);
      });
    }

    // دکمه بستن مودال
    const closeBtn = document.getElementById("closeModalBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeUserModal());
    }

    const cancelBtn = document.getElementById("cancelModalBtn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => this.closeUserModal());
    }

    // بستن مودال با کلیک روی backdrop
    const modal = document.getElementById("userModal");
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          this.closeUserModal();
        }
      });
    }

    // دکمه کپی توکن
    const copyBtn = document.getElementById("copyTokenBtn");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const tokenEl = document.getElementById("tokenValue");
        if (tokenEl) {
          navigator.clipboard.writeText(tokenEl.textContent);
          notificationService.success("✅ توکن در کلیپ‌بورد کپی شد");
        }
      });
    }

    // بستن مودال توکن
    const closeTokenBtn = document.querySelector(
      "#tokenDisplayModal .modal-close",
    );
    if (closeTokenBtn) {
      closeTokenBtn.addEventListener("click", () => this.closeTokenModal());
    }
  }

  closeTokenModal() {
    const modal = document.getElementById("tokenDisplayModal");
    if (modal) {
      modal.classList.remove("active");
      document.body.style.overflow = "";
    }
  }

  // ===== رفرش =====

  refresh() {
    this.loadData();
  }

  // ===== دیستروی =====

  destroy() {
    this.stopSuggestionsPolling();
  }
}

export const adminPanelService = new AdminPanelService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.adminPanelService = adminPanelService;
  window.AdminPanelService = AdminPanelService;

  // توابع اکشن برای renderer (onclick در HTML)
  window.viewUser = (id) => adminPanelService.viewUser(id);
  window.editUser = (id) => adminPanelService.editUser(id);
  window.editSuperAdmin = (id) => adminPanelService.editSuperAdmin(id);
  window.deleteUser = (id) => adminPanelService.deleteUser(id);
  window.deleteSuperAdmin = (id) => adminPanelService.deleteSuperAdmin(id);
  window.toggleSuperAdminStatus = (id, active) =>
    adminPanelService.toggleSuperAdminStatus(id, active);
  window.resetUserToken = (id) => adminPanelService.resetUserToken(id);
  window.viewUserToken = (id) => adminPanelService.viewUserToken(id);
  window.closeTokenModal = () => adminPanelService.closeTokenModal();
  // ✅ موج ۱۲.۴.۱ — «تاریخچهٔ تغییرات این کاربر» (دکمهٔ هر ردیف)
  window.showUserHistory = (id) => adminPanelService.showUserHistory(id);
}
