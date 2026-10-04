import { routerService } from "./router.service.js";
import { authService } from "./auth.service.js";
import { stateService } from "./state.service.js";
import { notificationService } from "./notification.service.js";
import { permissionService } from "./permission.service.js";
import { chartThemeService } from "./chart-theme.service.js";
import { presenceService } from "./presence.service.js";
import { headerService } from "../../shared/layouts/Header/header.service.js";
import { footerService } from "../../shared/layouts/Footer/footer.service.js";
import { sidebarService } from "../../shared/layouts/Sidebar/sidebar.service.js";
import { accordionService } from "../../shared/components/Accordion/accordion.service.js";
import { dropdownService } from "../../shared/components/Dropdown/dropdown.service.js";
import { modalService } from "../../shared/components/Modal/modal.service.js";
import { formService } from "../../shared/components/Form/form.service.js";
import { tableService } from "../../shared/components/Table/table.service.js";

class AppService {
  constructor() {
    this.initialized = false;
    this.currentPage = null;
    // ✅ ناظر «گرفتن مجوز صفحه در حین کار» (یک‌بار نصب می‌شود)
    this._pageWatchInstalled = false;
    this.pageConfigs = {
      "admin-panel": {
        title: "پنل مدیریت",
        requiresAuth: true,
        requiresAdmin: true,
        requiresPermission: "admin.panel.access",
        feature: "admin-panel",
      },
      "customer-info": {
        title: "اطلاعات مشتری",
        requiresAuth: true,
        requiresAdmin: false,
        requiresPermission: "customer.basic.view",
        feature: "customer-info",
      },
      dashboard: {
        title: "داشبورد",
        requiresAuth: true,
        requiresAdmin: false,
        requiresPermission: "dashboard.view",
        feature: "dashboard",
      },
      "customer-list": {
        title: "مدیریت مشتریان",
        requiresAuth: true,
        requiresAdmin: false,
        requiresPermission: "customers.list.view",
        feature: "customer-list",
      },
      // ✅ صفحهٔ پروفایل کاربر (هر نقشِ لاگین‌شده)
      profile: {
        title: "پروفایل من",
        requiresAuth: true,
        requiresAdmin: false,
        feature: "profile",
      },
      // ✅ صفحهٔ تنظیمات حساب کاربری (هر نقشِ لاگین‌شده)
      settings: {
        title: "تنظیمات حساب",
        requiresAuth: true,
        requiresAdmin: false,
        feature: "settings",
      },
      sms: {
        title: "مدیریت پیامک‌ها",
        requiresAuth: true,
        requiresAdmin: false,
        // صفحهٔ مستقل SMS وجود ندارد (بخش پیامک داخل داشبورد/مشتری است)؛
        // کنترل دسترسی پیامک با کلیدهای sms.* در همان بخش‌ها اعمال می‌شود.
        feature: "sms",
      },
      login: {
        title: "ورود",
        requiresAuth: false,
        requiresAdmin: false,
      },
      "setup-admin": {
        title: "تنظیمات اولیه",
        requiresAuth: false,
        requiresAdmin: false,
      },
    };
  }

  async init() {
    if (this.initialized) return;

    // جلوگیری از اجرای همزمان در حالی که init هنوز در حال اجراست
    // (چون initialized فقط در پایان true می‌شود)
    this.initialized = true;

    try {
      console.log("🚀 Initializing App...");

      // 1. مقداردهی سرویس‌های Core
      await this.initCoreServices();

      // 1.5 ✅ سطوح دسترسی (مجوزهای کاربر جاری + گیت منو/دکمه‌ها)
      await this.initPermissions();

      // 1.6 ✅ تم نمودارها (Chart.js) — هماهنگ با تم روشن/تیره
      try {
        chartThemeService.init();
      } catch (chartThemeError) {
        console.warn("⚠️ chart theme init failed:", chartThemeError?.message || chartThemeError);
      }

      // 2. مقداردهی Layouts
      await this.initLayouts();

      // 3. مقداردهی Shared Components
      await this.initSharedComponents();

      // 4. تشخیص صفحه فعلی
      this.currentPage = this.detectPage();

      // 5. بررسی دسترسی
      await this.checkAccess();

      // 5.5 ✅ اگر در حین کار مجوز صفحه از کاربر گرفته شد (تغییر از پنل مدیریت)
      //     همان لحظه پیام می‌گیرد و به داشبورد برمی‌گردد.
      this.installPagePermissionWatch();

      // 6. بارگذاری Feature مربوطه
      await this.loadFeature();

      // 7. تنظیم رویدادها
      this.setupEvents();

      this.initialized = true;
      console.log("✅ App initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing app:", error);
      notificationService.error("خطا در راه‌اندازی برنامه");
      this.initialized = false;
    }
  }

  // ===== Core Services =====

  async initCoreServices() {
    // مقداردهی state
    stateService.syncCustomerId();

    // راه‌اندازی router
    routerService.init();

    // بررسی وضعیت لاگین
    if (authService.isLoggedIn()) {
      console.log("👤 User logged in:", authService.getUserFullName());
    }

    // ✅ «حضور»: شروع heartbeat (فقط اگر کاربر وارد شده باشد) + نصب شنونده‌ها
    //    (visibilitychange ⇒ حضور تازه در بازگشت به تب، pagehide ⇒ اعلام آفلاین)
    try {
      presenceService.init();
    } catch (presenceError) {
      console.warn("⚠️ راه‌اندازی حضور ناموفق بود:", presenceError?.message || presenceError);
    }

    console.log("✅ Core services initialized");
  }

  // ===== سطوح دسترسی (نقش/کاربر) =====
  // مجوزهای کاربر جاری از /api/permissions/me خوانده می‌شود (کش ۵ دقیقه‌ای)
  // و المن‌هایی که data-permission دارند مخفی/غیرفعال می‌شوند.
  // ⚠️ این فقط تجربهٔ کاربری است؛ کنترل واقعی سمت سرور انجام می‌شود.
  async initPermissions() {
    try {
      await permissionService.load();
      permissionService.applyGuards(document);
      // ✅ تازه‌سازی خودکار روی برگشت به تب/فوکوس پنجره
      permissionService.installAutoRefresh();
    } catch (error) {
      console.warn("⚠️ بارگذاری سطوح دسترسی ناموفق بود:", error?.message || error);
    }
  }

  // ===== Layouts =====

  async initLayouts() {
    // Header
    try {
      await headerService.init();
      console.log("✅ Header initialized");
    } catch (error) {
      console.warn("⚠️ Header initialization failed:", error);
    }

    // Footer
    try {
      footerService.init();
      console.log("✅ Footer initialized");
    } catch (error) {
      console.warn("⚠️ Footer initialization failed:", error);
    }

    // Sidebar (اگر وجود داشته باشد)
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
      try {
        sidebarService.init();
        console.log("✅ Sidebar initialized");
      } catch (error) {
        console.warn("⚠️ Sidebar initialization failed:", error);
      }
    }

  }

  // ===== Shared Components =====

  async initSharedComponents() {
    // Accordion
    const accordionContainers = document.querySelectorAll(
      ".accordion-container",
    );
    if (accordionContainers.length > 0) {
      try {
        accordionService.init();
        console.log("✅ Accordion service initialized");
      } catch (error) {
        console.warn("⚠️ Accordion initialization failed:", error);
      }
    }

    // Dropdown
    const dropdowns = document.querySelectorAll(".dropdown");
    if (dropdowns.length > 0) {
      try {
        dropdownService.init();
        console.log("✅ Dropdown service initialized");
      } catch (error) {
        console.warn("⚠️ Dropdown initialization failed:", error);
      }
    }

    // Modal
    try {
      modalService.init();
      console.log("✅ Modal service initialized");
    } catch (error) {
      console.warn("⚠️ Modal initialization failed:", error);
    }

    // Form
    const forms = document.querySelectorAll(".form");
    if (forms.length > 0) {
      try {
        formService.init();
        console.log("✅ Form service initialized");
      } catch (error) {
        console.warn("⚠️ Form initialization failed:", error);
      }
    }

    // Table
    const tables = document.querySelectorAll(".table-container");
    if (tables.length > 0) {
      try {
        tableService.init();
        console.log("✅ Table service initialized");
      } catch (error) {
        console.warn("⚠️ Table initialization failed:", error);
      }
    }
  }

  // ===== تشخیص صفحه =====

  detectPage() {
    const path = window.location.pathname;
    const pageMap = {
      "/admin": "admin-panel",
      "/admin-panel.html": "admin-panel",
      "/customer-info": "customer-info",
      "/customer-info.html": "customer-info",
      "/customers": "customer-list",
      "/customer-list.html": "customer-list",
      "/profile": "profile",
      "/profile.html": "profile",
      "/settings": "settings",
      "/settings.html": "settings",
      "/sms": "sms",
      "/sms.html": "sms",
      "/login": "login",
      "/login.html": "login",
      "/setup-admin": "setup-admin",
      "/setup-admin.html": "setup-admin",
      "/index.html": "dashboard",
      "/": "dashboard",
    };

    // پیدا کردن صفحه
    let page = pageMap[path];
    if (!page) {
      // بررسی path با regex
      // از "/" صرف‌نظر می‌کنیم چون همیشه داخل هر مسیری وجود دارد
      for (const [key, value] of Object.entries(pageMap)) {
        if (key === "/") continue;
        if (path.includes(key.replace(/\.html$/, ""))) {
          page = value;
          break;
        }
      }
    }

    return page || "404";
  }

  // ===== بررسی دسترسی =====

  async checkAccess() {
    const config = this.pageConfigs[this.currentPage];
    if (!config) {
      // صفحه 404
      this.show404();
      return;
    }

    // بررسی احراز هویت
    if (config.requiresAuth && !authService.isLoggedIn()) {
      window.location.href = "/login.html";
      return;
    }

    // ✅ گیت مجوزمحور صفحه: اگر کلید این صفحه برای نقش کاربر بسته باشد
    //    (مثلاً مدیر اصلی ‏admin.panel.access را از «مدیر» گرفته باشد)
    //    پیام قابل‌فهم می‌گیرد و به داشبورد برمی‌گردد.
    //    ⚠️ استثناها (ضدحلقه/ضدقفل‌شدن کاربر):
    //      ۱) نقش «مشتری» از این گیت مستثناست (پورتال خودش)
    //      ۲) صفحهٔ مقصد (داشبورد) کسی را بیرون نمی‌اندازد
    //      ۳) اگر مجوزها در دسترس نباشند (خطای شبکه) هیچ‌کس مسدود نمی‌شود
    const requiredPageKeys = [].concat(config.requiresPermission || []);
    if (
      requiredPageKeys.length &&
      permissionService.role !== "customer" &&
      permissionService.hasData() &&
      !permissionService.canAny(requiredPageKeys)
    ) {
      if (await this.handlePagePermissionLoss(requiredPageKeys[0])) {
        window.location.href = "/index.html";
        return;
      }
    }

    // بررسی دسترسی پنل مدیریت:
    //   • نقش مدیر/سوپرادمین (مثل قبل)  ← یا ←
    //   • داشتن مجوز admin.panel.access (قابل دادن به هر نقش از پنل)
    if (
      config.requiresAdmin &&
      !authService.hasRole(["super_admin", "admin"]) &&
      !permissionService.can("admin.panel.access")
    ) {
      await this.denyPageAccess("admin.panel.access");
      window.location.href = "/index.html";
      return;
    }

    // اگر صفحه لاگین است و کاربر لاگین کرده، هدایت به داشبورد
    if (this.currentPage === "login" && authService.isLoggedIn()) {
      const user = authService.getUser();
      if (user.role === "super_admin" || user.role === "admin") {
        window.location.href = "/admin-panel.html";
      } else if (user.role === "sub_admin" || user.role === "expert") {
        window.location.href = "/index.html";
      } else {
        window.location.href = "/customer-info.html";
      }
      return;
    }

    // اگر صفحه setup-admin است و ادمین وجود دارد
    if (this.currentPage === "setup-admin") {
      const hasAdmin = await authService.checkAdminExists();
      if (hasAdmin) {
        window.location.href = "/login.html";
        return;
      }
    }

    console.log(`✅ Page access granted: ${this.currentPage}`);
  }

  // ============================================================
  // ✅ پیام «عدم دسترسی به صفحه»
  // ------------------------------------------------------------
  // سیاست کم‌مزاحمتی:
  //  • بار اول در هر نشست ⇒ مودال تک‌دکمه‌ای («بازگرد به داشبورد»)
  //    تا کاربر بفهمد چرا بیرون انداخته شده است
  //  • بارهای بعد در همان نشست ⇒ فقط یک توست ضدنکرار
  // ============================================================
  deniedText(reasonKey) {
    const permTitle = permissionService.titleOf(reasonKey) || reasonKey;
    const roleTitle =
      permissionService.roleTitle || authService.getUser()?.role || "";

    return `این بخش برای نقش شما${
      roleTitle ? ` («${roleTitle}»)` : ""
    } غیرفعال شده است: «${permTitle}». برای فعال‌سازی با مدیر اصلی تماس بگیرید.`;
  }

  // صفحهٔ مقصد (داشبورد) — از آن کسی را بیرون نمی‌اندازیم (ضدحلقهٔ ریدایرکت)
  isLandingPage() {
    return this.currentPage === "dashboard";
  }

  // ✅ نتیجهٔ «گرفتن مجوز صفحه»:
  //    • در صفحهٔ مقصد ⇒ فقط اطلاع (بدون ریدایرکت)
  //    • بقیهٔ صفحات ⇒ مودال یک‌بار در نشست + بازگشت به داشبورد
  //    مقدار بازگشتی: true ⇒ باید به داشبورد برگردد
  async handlePagePermissionLoss(reasonKey) {
    if (this.isLandingPage()) {
      notificationService.notifyOnce({
        key: `perm-page:${reasonKey}`,
        message: `⛔ ${this.deniedText(reasonKey)}`,
        type: "error",
        cooldownMs: 30000,
      });
      return false;
    }

    await this.denyPageAccess(reasonKey);
    return true;
  }

  async denyPageAccess(reasonKey) {
    const text = this.deniedText(reasonKey);

    const sessionKey = `skb_perm_denied_page:${this.currentPage}:${reasonKey}`;
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(sessionKey) === "1";
    } catch {
      alreadyShown = false;
    }

    if (alreadyShown) {
      notificationService.notifyOnce({
        key: `perm-page:${reasonKey}`,
        message: `⛔ ${text}`,
        type: "error",
        cooldownMs: 30000,
      });
      return;
    }

    try {
      sessionStorage.setItem(sessionKey, "1");
    } catch {
      /* بی‌صدا */
    }

    await notificationService.modalMessage({
      title: "⛔ دسترسی به این صفحه بسته است",
      text,
      confirmText: "بازگشت به داشبورد",
      icon: "warning",
    });
  }

  // ============================================================
  // ✅ ناظر مجوز صفحه: اگر در حین کار مجوز این صفحه از کاربر
  //    گرفته شد (تغییر در پنل مدیریت) ⇒ همان لحظه پیام + خروج
  // ============================================================
  installPagePermissionWatch() {
    if (this._pageWatchInstalled || typeof document === "undefined") return;
    this._pageWatchInstalled = true;

    document.addEventListener("permissions:applied", async () => {
      const config = this.pageConfigs[this.currentPage];
      const keys = [].concat(config?.requiresPermission || []);
      if (!keys.length || !permissionService.hasData()) return;
      // مشتری پورتال خودش است و داشبورد صفحهٔ مقصد ⇒ هیچ‌کدام بیرون انداخته نمی‌شوند
      if (permissionService.role === "customer") return;
      if (permissionService.canAny(keys)) return;

      if (await this.handlePagePermissionLoss(keys[0])) {
        window.location.href = "/index.html";
      }
    });
  }

  // ===== بارگذاری Feature =====

  async loadFeature() {
    const config = this.pageConfigs[this.currentPage];
    if (!config || !config.feature) return;

    try {
      const featureName = config.feature;

      // ✅ ساخت نام‌های مختلف برای سرویس
      const camelCaseName = featureName
        .split("-")
        .map((part, index) =>
          index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join("");

      const possibleNames = [
        `${camelCaseName}Service`,
        `${featureName.replace(/-/g, "")}Service`,
        `${featureName.replace(/-/g, "")}service`,
        featureName + "InfoService",
        "customerInfoService",
        "sectionHeaderService",
        "basicInfoService",
        "chartDashboardService",
        "hallsService",
        "hatcheryService",
        "weeklyService",
        "visitReportService",
        "dashboardService",
        "adminPanelService",
        "bookmarkService",
        "smsService",
      ];

      let service = null;
      let foundName = null;

      // ✅ اول چک کن سرویس از قبل مقداردهی شده (مثلاً توسط HTML page)
      for (const name of possibleNames) {
        if (window[name] && typeof window[name].init === "function") {
          service = window[name];
          foundName = name;
          break;
        }
      }

      if (!service) {
        // ✅ تلاش برای پیدا کردن سرویس با تکرار
        for (let attempt = 0; attempt < 10; attempt++) {
          for (const name of possibleNames) {
            if (window[name] && typeof window[name].init === "function") {
              service = window[name];
              foundName = name;
              break;
            }
          }
          if (service) break;
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }

      if (!service) {
        console.warn(`⚠️ Service for "${featureName}" not found after retries`);
        return;
      }

      console.log(`✅ Found service: ${foundName}`);

      if (typeof service.init === "function") {
        await service.init();
        console.log(`✅ Feature "${featureName}" loaded successfully`);

        // ✅ مجدداً گیت‌ها را اعمال کن (بخش ممکن است المن‌های جدید ساخته باشد)
        try {
          permissionService.applyGuards(document);
        } catch (guardError) {
          console.warn("⚠️ اعمال گیت دسترسی ناموفق بود:", guardError?.message);
        }
      } else {
        console.warn(`⚠️ Service "${foundName}" has no init method`);
      }
    } catch (error) {
      console.error(`❌ Error loading feature "${config.feature}":`, error);
      notificationService.error("خطا در بارگذاری بخش مورد نظر");
    }
  }

  // ===== رویدادها =====

  setupEvents() {
    // رویدادهای عمومی
    document.addEventListener("click", this.handleGlobalClick.bind(this));
    document.addEventListener("keydown", this.handleGlobalKeydown.bind(this));

    // رویدادهای Custom
    document.addEventListener("modal:open", (e) => {
      console.log("📌 Modal opened:", e.detail.modalId);
    });

    document.addEventListener("modal:close", (e) => {
      console.log("📌 Modal closed:", e.detail.modalId);
    });

    document.addEventListener("sidebar:activate", (e) => {
      console.log("📌 Sidebar activated:", e.detail.id);
    });

    document.addEventListener("dropdown:open", (e) => {
      console.log("📌 Dropdown opened");
    });

    document.addEventListener("dropdown:close", (e) => {
      console.log("📌 Dropdown closed");
    });

    // رویدادهای auth
    document.addEventListener("auth:login", () => {
      this.refresh();
    });

    document.addEventListener("auth:logout", () => {
      this.refresh();
    });

    console.log("✅ Events setup completed");
  }

  handleGlobalClick(e) {
    // بستن دراپ‌داون‌ها با کلیک بیرون
    if (
      !e.target.closest(".dropdown") &&
      !e.target.closest(".header-account")
    ) {
      dropdownService.closeAll();
    }

    // بستن مودال با کلیک روی backdrop
    if (e.target.classList.contains("modal-overlay")) {
      modalService.close(e.target.dataset.modalId);
    }
  }

  handleGlobalKeydown(e) {
    // بستن مودال با Escape
    if (e.key === "Escape") {
      const openModals = document.querySelectorAll(".modal-overlay.active");
      openModals.forEach((modal) => {
        modalService.close(modal.dataset.modalId);
      });
    }

    // Ctrl+R برای رفرش
    if (e.ctrlKey && e.key === "r") {
      e.preventDefault();
      this.refresh();
    }
  }

  // ===== 404 =====

  show404() {
    const container = document.getElementById("main-content");
    if (container) {
      container.innerHTML = `
                <div style="text-align: center; padding: 80px 20px;">
                    <div style="font-size: 80px; font-weight: bold; color: var(--indigo, #667eea);">۴۰۴</div>
                    <h2 style="color: var(--text-dark, #333); margin: 20px 0;">⛔ صفحه یافت نشد</h2>
                    <p style="color: var(--text-gray, #666); margin-bottom: 30px;">متأسفیم، صفحه‌ای که به دنبال آن هستید وجود ندارد.</p>
                    <a href="/" class="btn btn-primary" style="display: inline-block;">بازگشت به صفحه اصلی</a>
                </div>
            `;
    }
  }

  // ===== رفرش =====

  async refresh() {
    console.log("🔄 Refreshing app...");

    // رفرش هدر
    try {
      headerService.refresh();
    } catch (error) {
      console.warn("⚠️ Header refresh failed:", error);
    }

    // رفرش Feature فعلی
    await this.loadFeature();

    console.log("✅ App refreshed");
  }

  // ===== دیستروی =====

  destroy() {
    // پاکسازی رویدادها
    document.removeEventListener("click", this.handleGlobalClick);
    document.removeEventListener("keydown", this.handleGlobalKeydown);

    // دیستروی سرویس‌ها
    accordionService.destroy();
    dropdownService.destroy();
    modalService.destroy();
    formService.destroy();
    tableService.destroy();
    sidebarService.destroy();

    this.initialized = false;
    console.log("✅ App destroyed");
  }
}

// ===== Export =====
export const appService = new AppService();

// ===== Global =====
if (typeof window !== "undefined") {
  window.AppService = appService;
  window.appService = appService;
  window.app = appService;
}

// ===== Auto Initialize =====
document.addEventListener("DOMContentLoaded", () => {
  appService.init();
});
