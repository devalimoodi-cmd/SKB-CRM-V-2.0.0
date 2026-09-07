import { adminPanelApi } from "./admin-panel.api.js";
import { adminPanelRenderer } from "./admin-panel.renderer.js";
import { adminPanelValidation } from "./admin-panel.validation.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import { stateService } from "../../core/services/state.service.js";
import { formatDate } from "../../core/utils/date.utils.js";

class AdminPanelService {
  constructor() {
    this.users = [];
    this.superAdmins = [];
    this.currentUser = null;
    this.editingUserId = null;
    this.editingUserRole = null;
    this.isEditing = false;
    this.selectedMenu = "super-admin-management";
    this.chatPollingInterval = null;
    this.lastMessageId = 0;
    this.initialized = false;
  }

  async init() {
    // بررسی دسترسی
    const hasAccess = await authService.checkAdminPageAccess();
    if (!hasAccess) return;

    await this.loadData();
    this.setupSidebar();
    this.setupEvents();
    this.setupChat();
    this.loadSystemSettings();
    this.initialized = true;
    console.log("✅ AdminPanelService initialized");
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

  async loadMenuData(menuId) {
    switch (menuId) {
      case "user-management":
        await this.loadUsers();
        break;
      case "super-admin-management":
        await this.loadSuperAdmins();
        break;
      case "dictionary-management":
        this.stopChatPolling();
        await this.initDictionaryManager();
        break;
      case "public-chat":
        // چت عمومی هنوز در سمت سرور پیاده‌سازی نشده - فقط یک پیام اطلاع‌رسانی نمایش بده
        this.stopChatPolling();
        notificationService.info("⏳ بخش چت عمومی به‌زودی فعال خواهد شد");
        break;
      default:
        console.log("📌 بخش:", menuId);
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

  // ===== چت عمومی =====

  setupChat() {
    const sendBtn = document.getElementById("sendChatBtn");
    const input = document.getElementById("chatMessageInput");

    if (sendBtn) {
      sendBtn.addEventListener("click", () => this.sendChatMessage());
    }

    if (input) {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.sendChatMessage();
        }
      });
    }
  }

  async loadChatMessages() {
    try {
      const response = await adminPanelApi.getChatMessages(50);
      if (response.success) {
        const messages = response.data || [];
        adminPanelRenderer.renderChatMessages(messages);
        if (messages.length > 0) {
          this.lastMessageId = messages[0].id;
        }
      }
    } catch (error) {
      // خطای 404 یعنی چت هنوز فعال نیست - ساکت باش و پیام اطلاع‌رسانی نمایش بده
      if (error.message?.includes("404")) {
        notificationService.info("⏳ بخش چت عمومی به‌زودی فعال خواهد شد");
      } else {
        console.error("❌ Error loading chat messages:", error);
      }
    }
  }

  async sendChatMessage() {
    const input = document.getElementById("chatMessageInput");
    const content = input?.value?.trim();

    if (!content) {
      notificationService.warning("لطفاً متن پیام را وارد کنید");
      return;
    }

    try {
      const response = await adminPanelApi.sendChatMessage(content);
      if (response.success) {
        input.value = "";
        await this.loadChatMessages();
      } else {
        notificationService.error(response.message || "خطا در ارسال پیام");
      }
    } catch (error) {
      console.error("❌ Error sending chat message:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  startChatPolling() {
    // polling غیرفعال شد چون چت عمومی هنوز در سرور پیاده‌سازی نشده
    return;
  }

  stopChatPolling() {
    if (this.chatPollingInterval) {
      clearInterval(this.chatPollingInterval);
      this.chatPollingInterval = null;
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
        this.registerUser(data, role);
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
    this.stopChatPolling();
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
}
