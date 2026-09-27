// ============================================================
// weekly.loading.js
// بارگذاری و چرخهٔ حیات (init/data/dictionaries/units/halls/flocks + refresh/resetCache)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲b) — این دامنه از weekly.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان weekly-service-surface-test.mjs سطح زمان اجرا را می‌سنجند).
// ترکیب: Object.assign(WeeklyService.prototype, weeklyLoadingMethods) در weekly.service.js
// حجم: ۸ متد / ۱۲۳ خط
// ============================================================
import { weeklyApi } from "./weekly.api.js";
import { weeklyRenderer } from "./weekly.renderer.js";
import {
  notificationService,
} from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";

export const weeklyLoadingMethods = {
  async init(customerId) {
    // ✅ اگر customerId ارسال نشد، از state بگیر
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    console.log("📌 WeeklyService customerId:", this.customerId);

    await this.loadData();

    // ✅ رویدادها فقط یک‌بار ثبت می‌شوند (جلوگیری از انباشت listener)
    if (!this.initialized) {
      this.setupFilters();
      this.setupEvents();
      this.initialized = true;
    }
    console.log("✅ WeeklyService initialized");
  },

  async loadData() {
    try {
      // بارگذاری دیکشنری‌ها
      await this.loadDictionaries();

      // بارگذاری واحدها
      await this.loadUnits();

      // بارگذاری سالن‌ها
      await this.loadHalls();

      // بارگذاری گله‌ها
      await this.loadFlocks();
    } catch (error) {
      console.error("❌ Error loading weekly data:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  },

  async loadDictionaries() {
    try {
      const [diseases, vaccines, medicines, feedTypes, suggestions, experts] =
        await Promise.all([
          weeklyApi.getDiseases(),
          weeklyApi.getVaccines(),
          weeklyApi.getMedicines(),
          weeklyApi.getFeedTypes(),
          weeklyApi.getSuggestions(),
          weeklyApi.getExperts(),
        ]);

      this.dictionaries = {
        diseases: diseases.success ? diseases.data : [],
        vaccines: vaccines.success ? vaccines.data : [],
        medicines: medicines.success ? medicines.data : [],
        feedTypes: feedTypes.success ? feedTypes.data : [],
        suggestions: suggestions.success ? suggestions.data : [],
        experts: experts.success ? experts.data : [],
      };

      // رندر سلکت‌ها
      weeklyRenderer.renderSelects(this.dictionaries);
    } catch (error) {
      console.error("❌ Error loading dictionaries:", error);
    }
  },

  async loadUnits() {
    try {
      const response = await weeklyApi.getUnits(this.customerId);
      if (response.success) {
        this.units = response.data.units || [];
        weeklyRenderer.renderUnitsFilter(this.units);
      }
    } catch (error) {
      console.error("❌ Error loading units:", error);
    }
  },

  async loadHalls() {
    try {
      const response = await weeklyApi.getHalls(this.customerId);
      if (response.success) {
        this.halls = response.data || [];
        weeklyRenderer.renderHallsFilter(this.halls);
      }
    } catch (error) {
      console.error("❌ Error loading halls:", error);
    }
  },

  async loadFlocks() {
    try {
      // دریافت گله‌های فعال با فیلترهای انتخاب شده
      const unitId = document.getElementById("filter-unit")?.value;
      const hallId = document.getElementById("filter-hall")?.value;
      const flockId = document.getElementById("filter-flock")?.value;

      const params = { limit: 200 };
      if (unitId) params.unit_id = unitId;
      if (hallId) params.hall_id = hallId;
      if (flockId) params.id = flockId;

      const response = await weeklyApi.getActiveFlocks(this.customerId, params);
      if (response.success) {
        this.flocks = response.data.placements || [];
        stateService.setFlocks(this.flocks);
        await this.renderFlocks();
        await this.loadFlocksFilter();
      }
    } catch (error) {
      console.error("❌ Error loading flocks:", error);
    }
  },

  refresh() {
    this.loadData();
  },

  resetCache() {
    this.cache = {};
    this.flockWeeks = {};
    this.weeksShown = {};
    this._weekItemBuilders = {};
  },

};
