import { apiService } from "../../core/services/api.service.js";
import { stateService } from "../../core/services/state.service.js";
import { notificationService } from "../../core/services/notification.service.js";
import { authService } from "../../core/services/auth.service.js";
import {
  convertToPersianDate,
  formatDate,
} from "../../core/utils/date.utils.js";
import { sectionHeaderService } from "./section-header/section-header.service.js";

class CustomerInfoService {
  constructor() {
    this.customerId = null;
    this.customerData = null;
    this.stats = null;
    this.currentSection = "Chart-Dashboard";
    this.initialized = false;

    // ===== Mapping منوها به wrapperها =====
    this.menuToWrapper = {
      "اطلاعات پایه": "Basic-Information",
      داشبورد: "Chart-Dashboard",
      "مدیریت سالن های مشتری": "customer-AddHals",
      "مدیریت جوجه ریزی": "Hatchery-Management",
      "مدیریت هفتگی": "weekly-card",
      "گزارش بازدید": "Visit-Report",
    };

    this.lockedSections = ["experiment", "order-management", "formulation"];

    this.allWrappers = [
      "Basic-Information",
      "Chart-Dashboard",
      "customer-AddHals",
      "Hatchery-Management",
      "weekly-card",
      "Visit-Report",
    ];
  }

  // ============================================
  // ✅ مقداردهی اولیه
  // ============================================
  async init() {
    if (this.initialized) return;

    // دریافت ID از URL
    this.customerId =
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    stateService.setCustomerId(this.customerId);
    window.CURRENT_CUSTOMER_ID = this.customerId;

    console.log("📌 شناسه مشتری:", this.customerId);

    // بارگذاری اطلاعات
    await this.loadCustomerData();
    await this.loadHeaderData();
    this.initSidebar();
    await this.initSections();

    // مقداردهی هدر (اطلاعات مشتری + آب و هوا)
    await sectionHeaderService.init();

    // مقداردهی تقویم شمسی برای تمام فیلدهای تاریخ
    this.setupDatepickers();

    this.initialized = true;
    console.log("✅ CustomerInfoService initialized");
  }

  // ============================================
  // ✅ مقداردهی تقویم شمسی برای فیلدهای تاریخ
  // ============================================
  setupDatepickers() {
    // لیست تمام فیلدهای تاریخ در صفحه
    const dateFieldIds = [
      "startDate",
      "endDate",
      "chickStartDate",
      "chickEndDate",
      "skb-chick-date",
      "chickLastWashDate",
      "chickLastDisinfectDate",
      "visit-date",
      "skb-birthdate",
    ];

    dateFieldIds.forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      if (input.hasAttribute("data-datepicker-initialized")) return;

      try {
        if (typeof $.fn.persianDatepicker !== "undefined") {
          $(input).persianDatepicker({
            format: "YYYY/MM/DD",
            autoClose: true,
            initialValue: false,
            observer: true,
            calendar: {
              persian: {
                locale: "fa",
              },
            },
          });
          input.setAttribute("data-datepicker-initialized", "true");
        } else {
          input.placeholder = "۱۴۰۴/۰۱/۰۱";
          input.setAttribute("data-datepicker-initialized", "true");
        }
      } catch (error) {
        console.warn(`⚠️ Error initializing datepicker for #${id}:`, error);
        input.placeholder = "۱۴۰۴/۰۱/۰۱";
        input.setAttribute("data-datepicker-initialized", "true");
      }
    });
  }

  // ============================================
  // ✅ بارگذاری اطلاعات مشتری
  // ============================================
  async loadCustomerData() {
    try {
      const response = await apiService.get(`/customers/${this.customerId}`);
      if (response.success) {
        this.customerData = response.data;
        stateService.setCustomerData(this.customerData);
        return this.customerData;
      }
    } catch (error) {
      console.error("❌ Error loading customer:", error);
      notificationService.error("خطا در دریافت اطلاعات مشتری");
    }
    return null;
  }

  // ============================================
  // ✅ بارگذاری هدر اطلاعات مشتری
  // ============================================
  async loadHeaderData() {
    try {
      const response = await apiService.get(
        `/customer-header/${this.customerId}/header`,
      );

      if (response.success) {
        this.stats = response.data.stats;
        this.fillHeaderInfo(response.data);
      } else {
        console.warn("⚠️ خطا در دریافت هدر:", response.message);
      }
    } catch (error) {
      console.error("❌ Error loading header:", error);
    }
  }

  // ============================================
  // ✅ پر کردن هدر
  // ============================================
  fillHeaderInfo(data) {
    const { customer, stats } = data;

    const fullNameEl = document.getElementById("customerFullName");
    const codeEl = document.getElementById("customerCode");
    const farmNameEl = document.getElementById("customerFarmName");

    if (fullNameEl) fullNameEl.textContent = customer.full_name || "نامشخص";
    if (codeEl) codeEl.textContent = customer.id || "....";
    if (farmNameEl) farmNameEl.textContent = customer.farm_name || "نامشخص";

    const locationEl = document.getElementById("customerLocation");
    if (locationEl) {
      const location = [customer.province, customer.county]
        .filter(Boolean)
        .join("، ");
      locationEl.textContent = location || "نامشخص";
    }

    const statusEl = document.querySelector(".customer-status");
    if (statusEl) {
      statusEl.className = customer.active
        ? "customer-status active"
        : "customer-status inactive";
    }

    const totalHallsEl = document.getElementById("totalHalls");
    const activeFlocksEl = document.getElementById("activeFlocks");
    const activePeriodsEl = document.getElementById("activePeriods");
    const totalChicksEl = document.getElementById("totalChicks");

    if (totalHallsEl) totalHallsEl.textContent = stats.totalHalls || 0;
    if (activeFlocksEl) activeFlocksEl.textContent = stats.activeFlocks || 0;
    if (activePeriodsEl) activePeriodsEl.textContent = stats.activePeriods || 0;
    if (totalChicksEl) totalChicksEl.textContent = stats.totalChicks || 0;

    this.renderMetaInfo(customer);
  }

  // ============================================
  // ✅ رندر اطلاعات متا
  // ============================================
  renderMetaInfo(customer) {
    let metaInfoEl = document.querySelector(".customer-meta-info");

    if (!metaInfoEl) {
      const detailsEl = document.querySelector(".customer-details");
      if (detailsEl) {
        metaInfoEl = document.createElement("div");
        metaInfoEl.className = "customer-meta-info";
        metaInfoEl.style.cssText = `
          margin-top: 10px;
          padding-top: 10px;
          border-top: 2px solid #eef2f6;
          font-size: 12px;
          color: #64748b;
          display: flex;
          flex-wrap: wrap;
          gap: 12px 20px;
          direction: rtl;
        `;
        detailsEl.appendChild(metaInfoEl);
      }
    }

    if (!metaInfoEl) return;

    const creatorName =
      customer.creator?.full_name || customer.creator?.username || "نامشخص";
    const registeredDate = customer.registered_at_formatted || "نامشخص";
    const isUpdated = customer.is_updated === true;

    let updaterName = "نامشخص";
    let updatedDate = "نامشخص";

    if (isUpdated && customer.updater) {
      updaterName =
        customer.updater.full_name || customer.updater.username || "نامشخص";
      updatedDate = customer.updated_at_formatted || "نامشخص";
    }

    let metaHTML = `
      <div class="meta-item" style="display:flex; align-items:center; gap:4px;">
        <i class="fas fa-user-plus" style="color:#2c7a6e;"></i>
        <span>ثبت‌کننده: <strong>${creatorName}</strong></span>
      </div>
      <div class="meta-item" style="display:flex; align-items:center; gap:4px;">
        <i class="fas fa-calendar-plus" style="color:#2c7a6e;"></i>
        <span>تاریخ ثبت: <strong>${registeredDate}</strong></span>
      </div>
    `;

    if (isUpdated) {
      metaHTML += `
        <div class="meta-item" style="display:flex; align-items:center; gap:4px;">
          <i class="fas fa-user-edit" style="color:#f59e0b;"></i>
          <span>آخرین بروزرسانی: <strong>${updaterName}</strong></span>
        </div>
        <div class="meta-item" style="display:flex; align-items:center; gap:4px;">
          <i class="fas fa-calendar-edit" style="color:#f59e0b;"></i>
          <span>تاریخ بروزرسانی: <strong>${updatedDate}</strong></span>
        </div>
      `;
    } else {
      metaHTML += `
        <div class="meta-item" style="display:flex; align-items:center; gap:4px; color:#94a3b8;">
          <i class="fas fa-info-circle"></i>
          <span>هنوز بروزرسانی نشده است</span>
        </div>
      `;
    }

    metaInfoEl.innerHTML = metaHTML;
  }

  // ============================================
  initSidebar() {
    const menuItems = document.querySelectorAll(".sidebar-menu-item");

    menuItems.forEach((item) => {
      const title =
        item.querySelector(".menu-title")?.textContent?.trim() || "";
      const wrapperId = this.menuToWrapper[title];

      // ✅ اگر wrapperId پیدا نشد، از data-menu استفاده کن
      const finalWrapperId = wrapperId || item.dataset.menu;

      item.addEventListener("click", async (e) => {
        e.preventDefault();

        if (this.lockedSections.includes(finalWrapperId)) {
          notificationService.info("🔒 این بخش در حال توسعه است");
          return;
        }

        menuItems.forEach((i) => i.classList.remove("active"));
        item.classList.add("active");

        this.hideAllWrappers();
        if (finalWrapperId) {
          this.showWrapper(finalWrapperId);
          this.currentSection = finalWrapperId;
          await this.loadSectionData(finalWrapperId);
        }
      });
    });

    this.activateDefault(menuItems);
  }
  // ============================================
  // ✅ فعال کردن پیش‌فرض
  // ============================================
  activateDefault(menuItems) {
    const defaultMenu = Array.from(menuItems).find(
      (item) =>
        item.querySelector(".menu-title")?.textContent?.trim() === "داشبورد",
    );

    this.hideAllWrappers();

    if (defaultMenu) {
      defaultMenu.classList.add("active");
      this.showWrapper("Chart-Dashboard");
      this.currentSection = "Chart-Dashboard";
      setTimeout(() => this.loadSectionData("Chart-Dashboard"), 200);
    } else if (menuItems[0]) {
      const title = menuItems[0]
        .querySelector(".menu-title")
        ?.textContent?.trim();
      const wrapper = this.menuToWrapper[title];
      if (wrapper) {
        menuItems[0].classList.add("active");
        this.showWrapper(wrapper);
        this.currentSection = wrapper;
        setTimeout(() => this.loadSectionData(wrapper), 200);
      }
    }
  }

  // ============================================
  // ✅ مخفی/نمایش wrapperها
  // ============================================
  hideAllWrappers() {
    this.allWrappers.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
  }

  showWrapper(wrapperId) {
    const el = document.getElementById(wrapperId);
    if (el) {
      el.style.display = "block";
    } else {
      console.warn(`❌ wrapper "${wrapperId}" پیدا نشد`);
    }
  }

  // ============================================
  // ✅ مقداردهی اولیه بخش‌ها
  // ============================================
  async initSections() {
    // ✅ اگر customerId وجود نداشت، برمی‌گردیم
    if (!this.customerId) {
      console.warn("⚠️ No customerId, skipping sections init");
      return;
    }

    await Promise.all([
      this.loadSectionData("Chart-Dashboard"),
      this.loadSectionData("Basic-Information"),
      this.loadSectionData("customer-AddHals"),
      this.loadSectionData("Hatchery-Management"),
      this.loadSectionData("weekly-card"),
      this.loadSectionData("Visit-Report"),
    ]);
  }

  // ============================================
  // ✅ بارگذاری داده‌های هر بخش
  // ============================================
  async loadSectionData(sectionId) {
    console.log(`🔄 بروزرسانی بخش: ${sectionId}`);

    try {
      switch (sectionId) {
        case "Basic-Information":
          if (typeof window.loadCustomerDetails === "function") {
            await window.loadCustomerDetails();
          }
          break;

        case "Chart-Dashboard":
          if (typeof window.loadAccordionState === "function") {
            window.loadAccordionState();
          }
          break;

        case "customer-AddHals":
          // ✅ فقط اگر customerId وجود داشت
          if (this.customerId) {
            if (typeof window.hallsService?.init === "function") {
              await window.hallsService.init(this.customerId);
            } else {
              if (typeof window.loadAllHallsDropdowns === "function") {
                await window.loadAllHallsDropdowns();
              }
              if (typeof window.loadPeriodsDropdown === "function") {
                await window.loadPeriodsDropdown();
              }
              if (typeof window.renderHallsList === "function") {
                await window.renderHallsList();
              }
              if (typeof window.refreshAllHallsDropdowns === "function") {
                await window.refreshAllHallsDropdowns();
              }
              if (typeof window.checkHasActivePeriod === "function") {
                await window.checkHasActivePeriod(this.customerId);
              }
            }
          }
          break;

        case "Hatchery-Management":
          // ✅ فقط اگر customerId وجود داشت
          if (this.customerId) {
            if (typeof window.hatcheryService?.init === "function") {
              await window.hatcheryService.init(this.customerId);
            } else if (typeof window.refreshHatcheryManagement === "function") {
              await window.refreshHatcheryManagement();
            }
          }
          break;

        case "weekly-card":
          // ✅ فقط اگر customerId وجود داشت
          if (this.customerId) {
            if (typeof window.weeklyService?.init === "function") {
              await window.weeklyService.init(this.customerId);
            } else if (typeof window.refreshWeeksDisplay === "function") {
              if (typeof window.resetWeeksCache === "function") {
                window.resetWeeksCache();
              }
              await window.refreshWeeksDisplay();
            }
          }
          break;

        case "Visit-Report":
          // ✅ فقط اگر customerId وجود داشت
          if (this.customerId) {
            if (typeof window.loadVisitReports === "function") {
              await window.loadVisitReports();
            }
            if (typeof window.loadHallsForVisit === "function") {
              await window.loadHallsForVisit();
            }
            if (typeof window.loadExpertsForVisit === "function") {
              await window.loadExpertsForVisit();
            }
            if (typeof window.loadPeriodsForVisit === "function") {
              await window.loadPeriodsForVisit();
            }
          }
          break;

        default:
          console.log(`ℹ️ بدون بروزرسانی برای: ${sectionId}`);
      }
    } catch (error) {
      console.error(`❌ خطا در بروزرسانی ${sectionId}:`, error);
    }
  }
  // ============================================
  // ✅ رفرش
  // ============================================
  refresh() {
    this.loadCustomerData();
    this.loadHeaderData();
    this.loadSectionData(this.currentSection);
  }

  getCustomerId() {
    return this.customerId;
  }

  getCustomerData() {
    return this.customerData;
  }
}

// ============================================
// ✅ Export و قرار دادن در window
// ============================================

// ✅ اول export کن
export const customerInfoService = new CustomerInfoService();

// ✅ بعد قرار بده در window
if (typeof window !== "undefined") {
  window.customerInfoService = customerInfoService;
  window.CustomerInfoService = CustomerInfoService;
  window.CURRENT_CUSTOMER_ID = customerInfoService.customerId;
  window.refreshCustomerInfo = () => customerInfoService.refresh();
}

console.log("✅ CustomerInfoService loaded and exposed to window");
