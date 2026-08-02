import { routerService } from "./router.service.js";
import { authService } from "./auth.service.js";
import { stateService } from "./state.service.js";
import { notificationService } from "./notification.service.js";
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
    this.pageConfigs = {
      "admin-panel": {
        title: "پنل مدیریت",
        requiresAuth: true,
        requiresAdmin: true,
        feature: "admin-panel",
      },
      "customer-info": {
        title: "اطلاعات مشتری",
        requiresAuth: true,
        requiresAdmin: false,
        feature: "customer-info",
      },
      dashboard: {
        title: "داشبورد",
        requiresAuth: true,
        requiresAdmin: false,
        feature: "dashboard",
      },
      "customer-list": {
        title: "مدیریت مشتریان",
        requiresAuth: true,
        requiresAdmin: false,
        feature: "customer-list",
      },
      bookmarks: {
        title: "بوکمارک‌ها",
        requiresAuth: true,
        requiresAdmin: false,
        feature: "bookmarks",
      },
      sms: {
        title: "مدیریت پیامک‌ها",
        requiresAuth: true,
        requiresAdmin: false,
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

      // 2. مقداردهی Layouts
      await this.initLayouts();

      // 3. مقداردهی Shared Components
      await this.initSharedComponents();

      // 4. تشخیص صفحه فعلی
      this.currentPage = this.detectPage();

      // 5. بررسی دسترسی
      await this.checkAccess();

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

    console.log("✅ Core services initialized");
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

    // Dashboard Layout (اگر وجود داشته باشد)
    const dashboardLayout = document.querySelector(".dashboard-layout");
    if (dashboardLayout) {
      try {
        const { dashboardLayoutService } =
          await import("../../shared/layouts/Dashboard/dashboard.service.js");
        dashboardLayoutService.init();
        console.log("✅ Dashboard Layout initialized");
      } catch (error) {
        console.warn("⚠️ Dashboard Layout initialization failed:", error);
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
      "/bookmarks": "bookmarks",
      "/bookmarks.html": "bookmarks",
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

    // بررسی دسترسی ادمین
    if (config.requiresAdmin && !authService.isAdmin()) {
      notificationService.error("⛔ شما دسترسی به این صفحه ندارید");
      window.location.href = "/index.html";
      return;
    }

    // اگر صفحه لاگین است و کاربر لاگین کرده، هدایت به داشبورد
    if (this.currentPage === "login" && authService.isLoggedIn()) {
      const user = authService.getUser();
      if (
        user.role === "super_admin" ||
        user.role === "admin" ||
        user.role === "sub_admin"
      ) {
        window.location.href = "/admin-panel.html";
      } else if (user.role === "expert") {
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
                    <div style="font-size: 80px; font-weight: bold; color: #667eea;">۴۰۴</div>
                    <h2 style="color: #333; margin: 20px 0;">⛔ صفحه یافت نشد</h2>
                    <p style="color: #666; margin-bottom: 30px;">متأسفیم، صفحه‌ای که به دنبال آن هستید وجود ندارد.</p>
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
