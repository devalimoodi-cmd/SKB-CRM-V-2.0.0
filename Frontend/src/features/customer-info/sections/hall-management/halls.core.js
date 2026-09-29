// ============================================================
// halls.core.js
// بارگذاری و چرخهٔ حیات (init/data/dictionaries/units/halls + refresh + getterها)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲c) — این دامنه از halls.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان halls-service-surface-test.mjs سطح اجرا را می‌سنجند).
// ترکیب: Object.assign(HallsService.prototype, hallsCoreMethods) در halls.service.js
// حجم: ۹ متد / ۱۵۰ خط
// ============================================================
import { hallsApi } from "./halls.api.js";
import { hallsRenderer } from "./halls.renderer.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
// ⚠️ بلوک ایمپورت خالی زیر عیناً از halls.service.js حفظ شده است (موج ۳.۲c):
// هیچ نامی از این ماژول در کل کلاس استفاده نمی‌شد و حذفش خارج از دامنهٔ این موج بود.
import {
} from "../../../../core/utils/date.utils.js";

export const hallsCoreMethods = {
  async init(customerId) {
    this.customerId =
      customerId ||
      stateService.getCustomerId() ||
      new URLSearchParams(window.location.search).get("id");

    if (!this.customerId) {
      notificationService.error("شناسه مشتری یافت نشد");
      return;
    }

    await this.loadData();
    this.setupTabs();
    this.setupEvents();
    this.initialized = true;
  },
  async loadData() {
    try {
      // پس از هر بار ذخیره/تغییر سالن، خلاصه ظرفیت از سرور دوباره گرفته شود
      this.capacitySummary = null;
      await this.loadDictionaries();
      await this.loadUnits();
      await this.loadHalls();
      this.autoPopulateHallNumber();
      this.autoGenerateHallName();
      this.lockBasicHallNumberField();
      this.applyDefaultExpertSelection();
      this.refreshUnitCapacityBadge();
      this.hideLegacySystemFields();
    } catch (error) {
      console.error("❌ Error loading hall data:", error);
      notificationService.error("خطا در دریافت اطلاعات سالن‌ها");
    }
  },
  async loadDictionaries() {
    try {
      const [
        hallTypes,
        floorTypes,
        heatingSystems,
        coolingSystems,
        ventilationTypes,
        waterInletTypes,
        lightingSystems,
        watererTypes,
        feederTypes,
        experts,
      ] = await Promise.all([
        hallsApi.getHallTypes(),
        hallsApi.getFloorTypes(),
        hallsApi.getHeatingSystems(),
        hallsApi.getCoolingSystems(),
        hallsApi.getVentilationTypes(),
        hallsApi.getWaterInletTypes(),
        hallsApi.getLightingSystems(),
        hallsApi.getWatererTypes(),
        hallsApi.getFeederTypes(),
        hallsApi.getExperts(),
      ]);

      this.dictionaries = {
        hallTypes: hallTypes.success ? hallTypes.data : [],
        floorTypes: floorTypes.success ? floorTypes.data : [],
        heatingSystems: heatingSystems.success ? heatingSystems.data : [],
        coolingSystems: coolingSystems.success ? coolingSystems.data : [],
        ventilationTypes: ventilationTypes.success ? ventilationTypes.data : [],
        waterInletTypes: waterInletTypes.success ? waterInletTypes.data : [],
        lightingSystems: lightingSystems.success ? lightingSystems.data : [],
        watererTypes: watererTypes.success ? watererTypes.data : [],
        feederTypes: feederTypes.success ? feederTypes.data : [],
        experts: experts.success ? experts.data : [],
      };

      hallsRenderer.renderSelects(this.dictionaries);
    } catch (error) {
      console.error("❌ Error loading dictionaries:", error);
    }
  },
  async loadUnits() {
    try {
      const response = await hallsApi.getUnits(this.customerId);
      if (response.success) {
        this.periods = response.data.units || [];
        hallsRenderer.renderUnitsDropdown(this.periods);
      }
    } catch (error) {
      console.error("❌ Error loading periods:", error);
    }
  },
  async loadHalls() {
    try {
      const response = await hallsApi.getHalls(this.customerId);
      if (response.success) {
        this.halls = response.data || [];
        stateService.setHalls(this.halls);
        await this.renderHallsList();
        this.updateHallsDropdowns();
        this.autoPopulateHallNumber();
        this.lockBasicHallNumberField();
      }
    } catch (error) {
      console.error("❌ Error loading halls:", error);
    }
  },
  refresh() {
    this.loadData();
    this.updateHallsDropdowns();
  },
  refreshAllDropdowns() {
    this.updateHallsDropdowns();
    if (typeof window.refreshAllHallsDropdowns === "function")
      window.refreshAllHallsDropdowns();
    ["skb-hall-select", "chickHealthHallNumber", "visit-halls"].forEach(
      (id) => {
        const select = document.getElementById(id);
        if (!select || !this.halls) return;
        const currentVal =
          id === "visit-halls"
            ? Array.from(select.selectedOptions).map((o) => o.value)
            : select.value;
        select.innerHTML =
          id === "visit-halls"
            ? ""
            : '<option value="">انتخاب سالن...</option>';
        this.halls.forEach((hall) => {
          const option = document.createElement("option");
          option.value = hall.id;
          option.textContent = `${hall.hall_name} (شماره ${hall.hall_number || hall.id})`;
          select.appendChild(option);
        });
        if (id === "visit-halls") {
          for (let i = 0; i < select.options.length; i++) {
            if (currentVal.includes(select.options[i].value))
              select.options[i].selected = true;
          }
        } else if (
          currentVal &&
          Array.from(select.options).some((o) => o.value == currentVal)
        ) {
          select.value = currentVal;
        }
      },
    );
  },
  getHalls() {
    return this.halls;
  },
  getPeriods() {
    return this.periods;
  },

};
