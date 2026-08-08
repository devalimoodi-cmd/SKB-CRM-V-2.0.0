import { hallsApi } from "./halls.api.js";
import { hallsRenderer } from "./halls.renderer.js";
import { hallsValidation } from "./halls.validation.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  convertPersianToGregorian,
  convertGregorianToPersian,
} from "../../../../core/utils/date.utils.js";

class HallsService {
  constructor() {
    this.customerId = null;
    this.halls = [];
    this.periods = [];
    this.dictionaries = {};
    this.currentPeriodId = null;
    this.activeTab = "basic";
    this.initialized = false;
    this.physicalPeriodId = null;
    this.systemsPeriodId = null;
    this.waterFeedPeriodId = null;
    this.editingHallId = null;
    this.editModeButtonsState = {};
  }

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
  }

  async loadData() {
    try {
      await this.loadDictionaries();
      await this.loadUnits();
      await this.loadHalls();
      this.autoPopulateHallNumber();
    } catch (error) {
      console.error("❌ Error loading hall data:", error);
      notificationService.error("خطا در دریافت اطلاعات سالن‌ها");
    }
  }

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
  }

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
  }

  async loadHalls() {
    try {
      const response = await hallsApi.getHalls(this.customerId);
      if (response.success) {
        this.halls = response.data || [];
        stateService.setHalls(this.halls);
        await this.renderHallsList();
        this.updateHallsDropdowns();
        this.autoPopulateHallNumber();
      }
    } catch (error) {
      console.error("❌ Error loading halls:", error);
    }
  }

  autoPopulateHallNumber() {
    if (this.editingHallId) return;
    const hallNumberSelect = document.getElementById("hallNumber");
    if (hallNumberSelect && this.halls) {
      const nextNumber = this.halls.length + 1;
      const existingValues = Array.from(hallNumberSelect.options).map(
        (o) => o.value,
      );
      if (!existingValues.includes(nextNumber.toString())) {
        const option = document.createElement("option");
        option.value = nextNumber;
        option.textContent = `شماره ${nextNumber}`;
        hallNumberSelect.appendChild(option);
      }
      hallNumberSelect.value = nextNumber.toString();
    }
  }

  async renderHallsList() {
    const hallsWithDetails = await Promise.all(
      this.halls.map(async (hall) => {
        const [periodInfo, physicalInfo, systemInfo, waterFeedInfo] =
          await Promise.all([
            this.getPeriodInfo(hall.period_id),
            hallsApi
              .getPhysicalInfo(hall.id)
              .catch(() => ({ success: false, data: null })),
            hallsApi
              .getSystemInfo(hall.id)
              .catch(() => ({ success: false, data: null })),
            hallsApi
              .getWaterFeedInfo(hall.id)
              .catch(() => ({ success: false, data: null })),
          ]);

        return {
          ...hall,
          periodInfo: periodInfo || null,
          physicalInfo: physicalInfo.success ? physicalInfo.data : null,
          systemInfo: systemInfo.success ? systemInfo.data : null,
          waterFeedInfo: waterFeedInfo.success ? waterFeedInfo.data : null,
        };
      }),
    );
    hallsRenderer.renderHallsList(hallsWithDetails, this.dictionaries);
  }

  async getPeriodInfo(periodId) {
    if (!periodId) return null;
    return this.periods.find((p) => p.id === periodId) || null;
  }

  updateHallsDropdowns() {
    const hallSelect = document.getElementById("hallNumber");
    if (hallSelect) {
      const currentValue = hallSelect.value;
      hallsRenderer.populateHallSelect(hallSelect, this.halls);
      if (
        currentValue &&
        Array.from(hallSelect.options).some((opt) => opt.value == currentValue)
      ) {
        hallSelect.value = currentValue;
      }
    }
    this.updateFilteredHallDropdown("physicalHallNumber", "physical");
    this.updateFilteredHallDropdown("systemsHallNumber", "system");
    this.updateFilteredHallDropdown("wfHallNumber", "waterFeed");
  }

  async updateFilteredHallDropdown(dropdownId, infoType) {
    const select = document.getElementById(dropdownId);
    if (!select) return;
    const currentValue = select.value;

    const hallStatuses = await Promise.all(
      this.halls.map(async (hall) => {
        let hasInfo = false;
        try {
          if (infoType === "physical") {
            const res = await hallsApi
              .getPhysicalInfo(hall.id)
              .catch(() => ({ success: false }));
            hasInfo = res.success && res.data;
          } else if (infoType === "system") {
            const res = await hallsApi
              .getSystemInfo(hall.id)
              .catch(() => ({ success: false }));
            hasInfo = res.success && res.data;
          } else if (infoType === "waterFeed") {
            const res = await hallsApi
              .getWaterFeedInfo(hall.id)
              .catch(() => ({ success: false }));
            hasInfo = res.success && res.data;
          }
        } catch (e) {
          hasInfo = false;
        }
        return { hall, hasInfo };
      }),
    );

    const filteredHalls = hallStatuses
      .filter((hs) => !hs.hasInfo)
      .map((hs) => hs.hall);
    const typeLabel =
      infoType === "physical"
        ? "فیزیکی"
        : infoType === "system"
          ? "سیستم"
          : "آبخوری";
    select.innerHTML = `<option value="">انتخاب سالن (بدون اطلاعات ${typeLabel})...</option>`;
    if (filteredHalls.length === 0) {
      select.innerHTML +=
        '<option value="" disabled>همه سالن‌ها اطلاعات دارند</option>';
    } else {
      filteredHalls.forEach((hall) => {
        const option = document.createElement("option");
        option.value = hall.id;
        option.textContent = `${hall.hall_name} (شماره ${hall.hall_number || hall.id})`;
        select.appendChild(option);
      });
    }
    if (
      currentValue &&
      Array.from(select.options).some((opt) => opt.value == currentValue)
    ) {
      select.value = currentValue;
    }
  }

  setupTabs() {
    const container = document.querySelector(
      ".customer-AddHals .tabs-container",
    );
    if (!container) return;

    container.addEventListener("click", (e) => {
      const tabBtn = e.target.closest(".tab-btn");
      if (!tabBtn) return;
      if (!container.contains(tabBtn)) return;
      const tabId = tabBtn.dataset.tab;
      if (tabId) this.activateTab(tabId);
    });

    this.checkActivePeriod();
  }

  async checkActivePeriod() {
    const hasActivePeriod = this.periods.length > 0;
    const container = document.querySelector(".customer-AddHals");
    if (!container) return;
    const unitTab = container.querySelector('[data-tab="unit"]');
    const unitTabContent = document.getElementById("unitTab");
    if (!hasActivePeriod) {
      if (unitTab) unitTab.style.display = "";
      if (unitTabContent) unitTabContent.style.display = "";
      this.activateTab("unit");
    } else {
      if (unitTab) unitTab.style.display = "none";
      if (unitTabContent) unitTabContent.style.display = "none";
      const visibleTab = container.querySelector(
        '.tab-btn:not([data-tab="unit"])',
      );
      if (visibleTab) this.activateTab(visibleTab.dataset.tab);
    }
  }

  activateTab(tabId) {
    const container = document.querySelector(".customer-AddHals");
    if (!container) return;
    container
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    container
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    const btn = container.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.classList.add("active");
    const tabMap = {
      unit: "unitTab",
      basic: "basicTab",
      physical: "physicalTab",
      systems: "systemsTab",
      "water-food": "waterFoodTab",
    };
    const contentId = tabMap[tabId];
    if (contentId) {
      const content = document.getElementById(contentId);
      if (content) {
        content.classList.add("active");
        this.loadTabData(contentId);
      }
    }
    this.activeTab = tabId;
  }

  loadTabData(contentId) {
    // در حالت ویرایش، اطلاعات از editHall بارگذاری شده؛ نیازی به بارگذاری مجدد نیست
    if (this.editingHallId) return;

    if (contentId === "physicalTab") {
      const hall = document.getElementById("physicalHallNumber");
      if (hall && hall.value) this.loadPhysicalInfo(hall.value);
    } else if (contentId === "systemsTab") {
      const hall = document.getElementById("systemsHallNumber");
      if (hall && hall.value) this.loadSystemInfo(hall.value);
    } else if (contentId === "waterFoodTab") {
      const hall = document.getElementById("wfHallNumber");
      if (hall && hall.value) this.loadWaterFeedInfo(hall.value);
    }
  }

  setupEvents() {
    const lengthInput = document.getElementById("length");
    const widthInput = document.getElementById("width");
    if (lengthInput && widthInput) {
      lengthInput.addEventListener("input", () => this.calculateArea());
      widthInput.addEventListener("input", () => this.calculateArea());
    }
    const provinceSelect = document.getElementById("skb-province");
    if (provinceSelect) {
      provinceSelect.addEventListener("change", (e) => {
        if (e.target.value) this.loadCities(e.target.value);
      });
    }
    this.setupSaveButtons();
  }

  // ============================================================
  // ✅ EDIT MODE - Full hall editing
  // ============================================================

  setEditModeBanner(show) {
    const container = document.querySelector(
      ".customer-AddHals .tabs-container",
    );
    if (!container) return;
    if (show) {
      container.style.boxShadow =
        "0 0 0 3px #f59e0b, 0 0 20px rgba(245, 158, 11, 0.3)";
      container.style.borderColor = "#f59e0b";
    } else {
      container.style.boxShadow = "";
      container.style.borderColor = "";
    }
  }

  // در حالت ویرایش، دکمه‌های همه تب‌ها را به "بروزرسانی" تغییر بده
  setupEditModeButtonsForAllTabs() {
    const tabConfig = {
      basicTab: "بروزرسانی اطلاعات پایه",
      physicalTab: "بروزرسانی اطلاعات فیزیکی",
      systemsTab: "بروزرسانی سیستم‌ها",
      waterFoodTab: "بروزرسانی آبخوری و دانخوری",
    };

    Object.entries(tabConfig).forEach(([tabId, text]) => {
      const btn = document.querySelector(`#${tabId} .btn-primary`);
      if (btn) {
        btn.innerHTML = `<i class="fas fa-save"></i> ${text}`;
        btn.style.background = "#f59e0b";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.title = "";
      }
    });
  }

  restoreTabButtonsToDefault() {
    const tabConfig = {
      basicTab: "ذخیره اطلاعات پایه",
      physicalTab: "ذخیره اطلاعات فیزیکی",
      systemsTab: "ذخیره اطلاعات سیستم‌ها",
      waterFoodTab: "ذخیره اطلاعات آبخوری و دانخوری",
    };

    Object.entries(tabConfig).forEach(([tabId, text]) => {
      const btn = document.querySelector(`#${tabId} .btn-primary`);
      if (btn) {
        btn.innerHTML = `<i class="fas fa-save"></i> ${text}`;
        btn.style.background = "";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.title = "";
      }
    });
  }

  populateHallNumberInAllDropdowns(hallNumber) {
    ["physicalHallNumber", "systemsHallNumber", "wfHallNumber"].forEach(
      (id) => {
        const select = document.getElementById(id);
        if (!select) return;
        const exists = Array.from(select.options).some(
          (o) => o.value === hallNumber.toString(),
        );
        if (!exists) {
          const opt = document.createElement("option");
          opt.value = hallNumber;
          opt.textContent = `شماره ${hallNumber} (ویرایش)`;
          select.appendChild(opt);
        }
        select.value = hallNumber.toString();
      },
    );
  }

  async editHall(hallId) {
    try {
      const hallRes = await hallsApi.getHall(hallId);
      if (!hallRes.success) {
        notificationService.error("خطا در دریافت اطلاعات سالن");
        return;
      }
      const hall = hallRes.data;
      this.editingHallId = hallId;

      // 1. Basic info fields
      document.getElementById("hallName").value = hall.hall_name || "";
      const hallNumSelect = document.getElementById("hallNumber");
      if (hallNumSelect && hall.hall_number) {
        const exists = Array.from(hallNumSelect.options).some(
          (o) => o.value === hall.hall_number.toString(),
        );
        if (!exists) {
          const opt = document.createElement("option");
          opt.value = hall.hall_number;
          opt.textContent = `شماره ${hall.hall_number}`;
          hallNumSelect.appendChild(opt);
        }
        hallNumSelect.value = hall.hall_number.toString();
      }
      const unitSelect = document.getElementById("UnitNumber");
      if (unitSelect && hall.unit_id) unitSelect.value = hall.unit_id;
      document.getElementById("capacity").value = hall.nominal_capacity || "";
      document.getElementById("altitude").value = hall.altitude_above_sea || "";
      document.getElementById("hallType").value = hall.hall_type_id || "";
      document.getElementById("buildYear").value = hall.construction_year || "";
      document.getElementById("expert").value = hall.service_expert_id || "";
      document.getElementById("operator").value = hall.operator_name || "";

      // 2. Physical info
      const physicalRes = await hallsApi
        .getPhysicalInfo(hallId)
        .catch(() => ({ success: false }));
      if (physicalRes.success && physicalRes.data) {
        const p = physicalRes.data;
        document.getElementById("length").value = p.length || "";
        document.getElementById("width").value = p.width || "";
        document.getElementById("height").value = p.height || "";
        document.getElementById("area").value = p.area || "";
        document.getElementById("floorMaterial").value = p.floor_type_id || "";
        document.getElementById("Hall-Physical-Description").value =
          p.notes || "";
      }

      // 3. System info
      const systemRes = await hallsApi
        .getSystemInfo(hallId)
        .catch(() => ({ success: false }));
      if (systemRes.success && systemRes.data) {
        const s = systemRes.data;
        document.getElementById("fanCount").value = s.fan_count || "";
        document.getElementById("fanSize").value = s.fan_size || "";
        document.getElementById("fanCapacity").value = s.fan_capacity || "";
        document.getElementById("heaterCount").value = s.heater_count || "";
        document.getElementById("heatingType").value =
          s.heating_system_id || "";
        document.getElementById("coolingType").value =
          s.cooling_system_id || "";
        document.getElementById("ventilationType").value =
          s.ventilation_system_id || "";
        document.getElementById("sanitarySystem").value =
          s.water_inlet_system_id || "";
        document.getElementById("lighthingSystem").value =
          s.lighting_system_id || "";
        document.getElementById("Hall-System-Description").value =
          s.notes || "";
      }

      // 4. Water/feed info
      const wfRes = await hallsApi
        .getWaterFeedInfo(hallId)
        .catch(() => ({ success: false }));
      if (wfRes.success && wfRes.data) {
        const w = wfRes.data;
        document.getElementById("waterType").value = w.waterer_type_id || "";
        document.getElementById("foodType").value = w.feeder_type_id || "";
        document.getElementById("waterLines").value = w.water_lines_count || "";
        document.getElementById("foodLines").value = w.feed_lines_count || "";
        const autoRadios = document.querySelectorAll('input[name="autoFood"]');
        autoRadios.forEach((r) => {
          if (r.value === "دارد" && w.auto_feed_system === true)
            r.checked = true;
          else if (r.value === "ندارد" && w.auto_feed_system === false)
            r.checked = true;
        });
        document.getElementById("Hall-water-feed-Description").value =
          w.notes || "";
      }

      // 5. (اختیاری) - در حالت ویرایش، tabهای دیگه از editingHallId استفاده می‌کنند
      // نیازی به populate dropdownهای فیلتر شده نیست

      // 6. Go to basic tab
      const basicTabBtn = document.querySelector('[data-tab="basic"]');
      if (basicTabBtn) basicTabBtn.click();

      // 7. Setup edit UI - همه تب‌ها دکمه بروزرسانی داشته باشند
      this.setupEditModeUI(hall.hall_name);
      this.setEditModeBanner(true);
      this.setupEditModeButtonsForAllTabs();

      notificationService.info(`✏️ در حال ویرایش سالن: ${hall.hall_name}`);
      document
        .getElementById("basicTab")
        .scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      console.error("❌ Error editing hall:", error);
      notificationService.error("خطا در دریافت اطلاعات سالن");
    }
  }

  setupEditModeUI(hallName) {
    const basicSaveBtn = document.querySelector("#basicTab .btn-primary");
    if (basicSaveBtn) {
      basicSaveBtn.innerHTML =
        '<i class="fas fa-save"></i> بروزرسانی اطلاعات سالن';
      basicSaveBtn.style.background = "#f59e0b";
      basicSaveBtn.dataset.mode = "edit";
    }
    if (!document.getElementById("cancelEditHall")) {
      const cancelBtn = document.createElement("button");
      cancelBtn.id = "cancelEditHall";
      cancelBtn.className = "btn";
      cancelBtn.innerHTML = '<i class="fas fa-times"></i> انصراف از ویرایش';
      cancelBtn.style.cssText =
        "background:#ef4444; color:white; padding:10px 24px; border:none; border-radius:8px; font-family:Vazir,sans-serif; font-size:14px; font-weight:500; cursor:pointer; display:inline-flex; align-items:center; gap:8px;";
      cancelBtn.addEventListener("click", () => this.cancelEditHall());
      const actionsDiv = document.querySelector("#basicTab .form-actions");
      if (actionsDiv) {
        const secondBtn = actionsDiv.querySelector(".btn-secondary");
        if (secondBtn) secondBtn.after(cancelBtn);
        else actionsDiv.appendChild(cancelBtn);
      }
    } else {
      document.getElementById("cancelEditHall").style.display = "inline-flex";
    }
  }

  cancelEditHall() {
    this.editingHallId = null;
    this.resetTab("basicTab");
    const cancelBtn = document.getElementById("cancelEditHall");
    if (cancelBtn) cancelBtn.style.display = "none";
    const saveBtn = document.querySelector("#basicTab .btn-primary");
    if (saveBtn) {
      saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره اطلاعات پایه';
      saveBtn.style.background = "";
      saveBtn.dataset.mode = "";
    }
    this.setEditModeBanner(false);
    this.restoreTabButtonsToDefault();
    notificationService.info("ویرایش سالن لغو شد");
  }

  setupSaveButtons() {
    const saveBasicBtn = document.querySelector("#basicTab .btn-primary");
    if (saveBasicBtn)
      saveBasicBtn.addEventListener("click", () => this.saveBasicInfo());
    const savePhysicalBtn = document.querySelector("#physicalTab .btn-primary");
    if (savePhysicalBtn)
      savePhysicalBtn.addEventListener("click", () => this.savePhysicalInfo());
    const saveSystemsBtn = document.querySelector("#systemsTab .btn-primary");
    if (saveSystemsBtn)
      saveSystemsBtn.addEventListener("click", () => this.saveSystemsInfo());
    const saveWaterFeedBtn = document.querySelector(
      "#waterFoodTab .btn-primary",
    );
    if (saveWaterFeedBtn)
      saveWaterFeedBtn.addEventListener("click", () =>
        this.saveWaterFeedInfo(),
      );
    const saveUnitBtn = document.querySelector("#unitTab .btn-primary");
    if (saveUnitBtn)
      saveUnitBtn.addEventListener("click", () => this.saveUnitInfo());
    document.querySelectorAll(".btn-secondary").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tab = e.target.closest(".tab-content");
        if (tab) this.resetTab(tab.id);
      });
    });
  }

  calculateArea() {
    const length = parseFloat(document.getElementById("length")?.value) || 0;
    const width = parseFloat(document.getElementById("width")?.value) || 0;
    const area = length * width;
    const areaField = document.getElementById("area");
    if (areaField) areaField.value = area > 0 ? area.toFixed(2) : "";
  }

  // ============================================================
  // ✅ SAVE FUNCTIONS
  // ============================================================

  async saveUnitInfo() {
    const data = {
      customer_personal_information_id: parseInt(this.customerId),
      unit_name: document.getElementById("unitName")?.value,
      address: document.getElementById("unitAddress")?.value || null,
      longitude: document.getElementById("unitLongitude")?.value || null,
      latitude: document.getElementById("unitLatitude")?.value || null,
      hall_count: document.getElementById("unitHallCount")?.value || null,
      manager_name: document.getElementById("unitManagerName")?.value || null,
      manager_phone: document.getElementById("unitManagerPhone")?.value || null,
    };
    const saveBtn = document.querySelector("#unitTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';
    const errors = hallsValidation.validateUnit(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }
    try {
      const response = await hallsApi.createUnit(data);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      if (response.success) {
        notificationService.success(
          `واحد ${response.data.unit_name} با موفقیت ثبت شد`,
        );
        await this.loadData();
        this.resetTab("unitTab");
      } else notificationService.error(response.message || "خطا در ثبت واحد");
    } catch (error) {
      console.error("❌ Error saving unit:", error);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      notificationService.error(error.message);
    }
  }

  async saveBasicInfo() {
    const saveBtn = document.querySelector("#basicTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';

    const hallId = this.editingHallId;

    // ===== جمع‌آوری داده‌های همه تب‌ها =====
    const basicData = {
      customer_id: parseInt(this.customerId),
      unit_id: parseInt(document.getElementById("UnitNumber")?.value),
      hall_name: document.getElementById("hallName")?.value,
      hall_number: document.getElementById("hallNumber")?.value || null,
      nominal_capacity: document.getElementById("capacity")?.value || null,
      altitude_above_sea: document.getElementById("altitude")?.value || null,
      hall_type_id: document.getElementById("hallType")?.value || null,
      construction_year: document.getElementById("buildYear")?.value || null,
      service_expert_id: document.getElementById("expert")?.value || null,
      operator_name: document.getElementById("operator")?.value || null,
    };

    const physicalData = {
      length: document.getElementById("length")?.value || null,
      width: document.getElementById("width")?.value || null,
      height: document.getElementById("height")?.value || null,
      area: document.getElementById("area")?.value || null,
      floor_type_id: document.getElementById("floorMaterial")?.value || null,
      notes:
        document.getElementById("Hall-Physical-Description")?.value || null,
    };

    const autoFood = document.querySelector('input[name="autoFood"]:checked');
    const systemsData = {
      fan_count: document.getElementById("fanCount")?.value || null,
      fan_size: document.getElementById("fanSize")?.value || null,
      fan_capacity: document.getElementById("fanCapacity")?.value || null,
      heater_count: document.getElementById("heaterCount")?.value || null,
      heating_system_id: document.getElementById("heatingType")?.value || null,
      cooling_system_id: document.getElementById("coolingType")?.value || null,
      ventilation_system_id:
        document.getElementById("ventilationType")?.value || null,
      water_inlet_system_id:
        document.getElementById("sanitarySystem")?.value || null,
      lighting_system_id:
        document.getElementById("lighthingSystem")?.value || null,
      notes: document.getElementById("Hall-System-Description")?.value || null,
    };

    const waterFeedData = {
      waterer_type_id: document.getElementById("waterType")?.value || null,
      feeder_type_id: document.getElementById("foodType")?.value || null,
      water_lines_count: document.getElementById("waterLines")?.value || null,
      feed_lines_count: document.getElementById("foodLines")?.value || null,
      auto_feed_system: autoFood ? autoFood.value === "دارد" : false,
      notes:
        document.getElementById("Hall-water-feed-Description")?.value || null,
    };

    // ===== اعتبارسنجی همه داده‌ها =====
    const allErrors = [...hallsValidation.validateHall(basicData)];

    // اگر در حالت ویرایش هستیم، اعتبارسنجی تب‌های دیگه فقط اگر فیلدی پر شده باشه
    if (hallId) {
      if (physicalData.length || physicalData.width || physicalData.height) {
        allErrors.push(
          ...hallsValidation.validatePhysicalInfo({
            hall_id: hallId,
            ...physicalData,
          }),
        );
      }
      if (systemsData.fan_count || systemsData.heating_system_id) {
        allErrors.push(
          ...hallsValidation.validateSystemInfo({
            hall_id: hallId,
            ...systemsData,
          }),
        );
      }
      if (waterFeedData.waterer_type_id || waterFeedData.feeder_type_id) {
        allErrors.push(
          ...hallsValidation.validateWaterFeedInfo({
            hall_id: hallId,
            ...waterFeedData,
          }),
        );
      }
    }

    if (allErrors.length > 0) {
      notificationService.showValidationErrors(allErrors);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }

    try {
      const selectedHall = this.halls.find((h) => h.id == hallId);
      const periodId = selectedHall?.period_id || null;

      if (hallId) {
        // ✅ حالت ویرایش - فقط اطلاعات پایه
        const response = await hallsApi.updateHall(hallId, basicData);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;

        if (response.success) {
          const summaryItems = [
            basicData.hall_name ? `نام سالن: ${basicData.hall_name}` : null,
            basicData.hall_number
              ? `شماره سالن: ${basicData.hall_number}`
              : null,
            basicData.nominal_capacity
              ? `ظرفیت: ${parseInt(basicData.nominal_capacity).toLocaleString()} قطعه`
              : null,
            basicData.altitude_above_sea
              ? `ارتفاع: ${basicData.altitude_above_sea} متر`
              : null,
          ].filter(Boolean);

          if (typeof Swal !== "undefined") {
            Swal.fire({
              icon: "success",
              title: "✅ اطلاعات پایه بروزرسانی شد",
              html: `<div style="text-align:right; font-family:Vazir; direction:rtl;"><ul style="list-style:none; padding:0; margin:0;">${summaryItems.map((item) => `<li style="padding:3px 8px; background:#f8fafc; margin:3px 0; border-radius:4px; font-size:12px;">✅ ${item}</li>`).join("")}</ul></div>`,
              confirmButtonText: "باشه",
              confirmButtonColor: "#2c7a6e",
            });
          } else {
            notificationService.success(
              "✅ اطلاعات پایه با موفقیت بروزرسانی شد",
            );
          }

          // بستن حالت ویرایش
          this.editingHallId = null;
          this.setEditModeBanner(false);
          this.restoreTabButtonsToDefault();
          const cancelBtnB = document.getElementById("cancelEditHall");
          if (cancelBtnB) cancelBtnB.style.display = "none";
          saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره اطلاعات پایه';
          saveBtn.style.background = "";
          saveBtn.dataset.mode = "";

          await this.loadData();
          this.resetTab("basicTab");
          this.refreshAllDropdowns();
        } else {
          notificationService.error(response.message || "خطا در بروزرسانی");
        }
      } else {
        // حالت ثبت سالن جدید
        const response = await hallsApi.createHall(basicData);
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;

        if (response.success) {
          notificationService.success(
            `سالن ${response.data.hall_name} با موفقیت ثبت شد`,
          );
          await this.loadData();
          this.resetTab("basicTab");
          this.refreshAllDropdowns();
        } else {
          notificationService.error(response.message || "خطا در ذخیره سالن");
        }
      }
    } catch (error) {
      console.error("❌ Error saving hall:", error);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      notificationService.error(error.message);
    }
  }

  async savePhysicalInfo() {
    const hallId = document.getElementById("physicalHallNumber")?.value;
    if (!hallId && !this.editingHallId) {
      notificationService.warning("لطفاً ابتدا یک سالن انتخاب کنید");
      return;
    }
    const saveBtn = document.querySelector("#physicalTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';
    const finalHallId = hallId || this.editingHallId;
    const data = {
      hall_id: parseInt(finalHallId),
      period_id: this.physicalPeriodId || null,
      length: document.getElementById("length")?.value || null,
      width: document.getElementById("width")?.value || null,
      height: document.getElementById("height")?.value || null,
      area: document.getElementById("area")?.value || null,
      floor_type_id: document.getElementById("floorMaterial")?.value || null,
      notes:
        document.getElementById("Hall-Physical-Description")?.value || null,
    };
    const errors = hallsValidation.validatePhysicalInfo(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }
    try {
      const response = await hallsApi.savePhysicalInfo(data);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      if (response.success) {
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: "✅ اطلاعات فیزیکی بروزرسانی شد",
            html: `<div style="text-align:right; font-family:Vazir; direction:rtl;"><ul style="list-style:none; padding:0; margin:0;">${[
              data.length ? `طول: ${data.length} متر` : null,
              data.width ? `عرض: ${data.width} متر` : null,
              data.height ? `ارتفاع: ${data.height} متر` : null,
              data.area ? `مساحت: ${data.area} متر مربع` : null,
            ]
              .filter(Boolean)
              .map(
                (item) =>
                  `<li style="padding:3px 8px; background:#f8fafc; margin:3px 0; border-radius:4px; font-size:12px;">✅ ${item}</li>`,
              )
              .join("")}</ul></div>`,
            confirmButtonText: "باشه",
            confirmButtonColor: "#2c7a6e",
          });
        } else {
          notificationService.success("اطلاعات فیزیکی با موفقیت ذخیره شد");
        }
        // بستن حالت ویرایش
        this.editingHallId = null;
        this.setEditModeBanner(false);
        this.restoreTabButtonsToDefault();
        const cancelBtnP = document.getElementById("cancelEditHall");
        if (cancelBtnP) cancelBtnP.style.display = "none";
        const basicSaveBtnP = document.querySelector("#basicTab .btn-primary");
        if (basicSaveBtnP) {
          basicSaveBtnP.innerHTML =
            '<i class="fas fa-save"></i> ذخیره اطلاعات پایه';
          basicSaveBtnP.style.background = "";
          basicSaveBtnP.dataset.mode = "";
        }
        await this.loadData();
        this.resetTab("physicalTab");
        this.refreshAllDropdowns();
      } else
        notificationService.error(response.message || "خطا در ذخیره اطلاعات");
    } catch (error) {
      console.error("❌ Error saving physical info:", error);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      notificationService.error(error.message);
    }
  }

  async saveSystemsInfo() {
    const hallId = document.getElementById("systemsHallNumber")?.value;
    if (!hallId && !this.editingHallId) {
      notificationService.warning("لطفاً ابتدا یک سالن انتخاب کنید");
      return;
    }
    const saveBtn = document.querySelector("#systemsTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';
    const finalHallId = hallId || this.editingHallId;
    const selectedHall = this.halls.find((h) => h.id == finalHallId);
    const periodId = selectedHall?.period_id || this.systemsPeriodId;
    if (!periodId) {
      notificationService.warning("لطفاً ابتدا یک سالن با دوره انتخاب کنید");
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }
    const data = {
      hall_id: parseInt(finalHallId),
      period_id: periodId,
      fan_count: document.getElementById("fanCount")?.value || null,
      fan_size: document.getElementById("fanSize")?.value || null,
      fan_capacity: document.getElementById("fanCapacity")?.value || null,
      heater_count: document.getElementById("heaterCount")?.value || null,
      heating_system_id: document.getElementById("heatingType")?.value || null,
      cooling_system_id: document.getElementById("coolingType")?.value || null,
      ventilation_system_id:
        document.getElementById("ventilationType")?.value || null,
      water_inlet_system_id:
        document.getElementById("sanitarySystem")?.value || null,
      lighting_system_id:
        document.getElementById("lighthingSystem")?.value || null,
      notes: document.getElementById("Hall-System-Description")?.value || null,
    };
    const errors = hallsValidation.validateSystemInfo(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }
    try {
      const response = await hallsApi.saveSystemInfo(data);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      if (response.success) {
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: "✅ سیستم‌ها بروزرسانی شدند",
            html: `<div style="text-align:right; font-family:Vazir; direction:rtl;"><ul style="list-style:none; padding:0; margin:0;">${[
              data.fan_count ? `تعداد فن‌ها: ${data.fan_count}` : null,
              data.heater_count ? `تعداد هیتر: ${data.heater_count}` : null,
            ]
              .filter(Boolean)
              .map(
                (i) =>
                  `<li style="padding:3px 8px; background:#f8fafc; margin:3px 0; border-radius:4px; font-size:12px;">✅ ${i}</li>`,
              )
              .join("")}</ul></div>`,
            confirmButtonText: "باشه",
            confirmButtonColor: "#2c7a6e",
          });
        } else {
          notificationService.success("اطلاعات سیستم‌ها با موفقیت ذخیره شد");
        }
        // فقط بستن حالت ویرایش (بدون ریست فیلدها)
        this.editingHallId = null;
        this.setEditModeBanner(false);
        this.restoreTabButtonsToDefault();
        const cancelBtn = document.getElementById("cancelEditHall");
        if (cancelBtn) cancelBtn.style.display = "none";
        const basicSaveBtn = document.querySelector("#basicTab .btn-primary");
        if (basicSaveBtn) {
          basicSaveBtn.innerHTML =
            '<i class="fas fa-save"></i> ذخیره اطلاعات پایه';
          basicSaveBtn.style.background = "";
          basicSaveBtn.dataset.mode = "";
        }
        await this.loadData();
        this.resetTab("systemsTab");
        this.refreshAllDropdowns();
      } else
        notificationService.error(response.message || "خطا در ذخیره اطلاعات");
    } catch (error) {
      console.error("❌ Error saving system info:", error);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      notificationService.error(error.message);
    }
  }

  async saveWaterFeedInfo() {
    const hallId = document.getElementById("wfHallNumber")?.value;
    if (!hallId && !this.editingHallId) {
      notificationService.warning("لطفاً ابتدا یک سالن انتخاب کنید");
      return;
    }
    const saveBtn = document.querySelector("#waterFoodTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';
    const finalHallId = hallId || this.editingHallId;
    const autoFood = document.querySelector('input[name="autoFood"]:checked');
    const data = {
      hall_id: parseInt(finalHallId),
      period_id: this.waterFeedPeriodId || null,
      waterer_type_id: document.getElementById("waterType")?.value || null,
      feeder_type_id: document.getElementById("foodType")?.value || null,
      water_lines_count: document.getElementById("waterLines")?.value || null,
      feed_lines_count: document.getElementById("foodLines")?.value || null,
      auto_feed_system: autoFood ? autoFood.value === "دارد" : false,
      notes:
        document.getElementById("Hall-water-feed-Description")?.value || null,
    };
    const errors = hallsValidation.validateWaterFeedInfo(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }
    try {
      const response = await hallsApi.saveWaterFeedInfo(data);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      if (response.success) {
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: "✅ آبخوری و دانخوری بروزرسانی شد",
            html: `<div style="text-align:right; font-family:Vazir; direction:rtl;"><ul style="list-style:none; padding:0; margin:0;">${[
              data.waterer_type_id ? `نوع آبخوری: بروزرسانی شد` : null,
              data.feeder_type_id ? `نوع دانخوری: بروزرسانی شد` : null,
            ]
              .filter(Boolean)
              .map(
                (i) =>
                  `<li style="padding:3px 8px; background:#f8fafc; margin:3px 0; border-radius:4px; font-size:12px;">✅ ${i}</li>`,
              )
              .join("")}</ul></div>`,
            confirmButtonText: "باشه",
            confirmButtonColor: "#2c7a6e",
          });
        } else {
          notificationService.success(
            "اطلاعات آبخوری و دانخوری با موفقیت ذخیره شد",
          );
        }
        // فقط بستن حالت ویرایش (بدون ریست فیلدها)
        this.editingHallId = null;
        this.setEditModeBanner(false);
        this.restoreTabButtonsToDefault();
        const cancelBtn2 = document.getElementById("cancelEditHall");
        if (cancelBtn2) cancelBtn2.style.display = "none";
        const basicSaveBtn2 = document.querySelector("#basicTab .btn-primary");
        if (basicSaveBtn2) {
          basicSaveBtn2.innerHTML =
            '<i class="fas fa-save"></i> ذخیره اطلاعات پایه';
          basicSaveBtn2.style.background = "";
          basicSaveBtn2.dataset.mode = "";
        }
        await this.loadData();
        this.resetTab("waterFoodTab");
        this.refreshAllDropdowns();
      } else
        notificationService.error(response.message || "خطا در ذخیره اطلاعات");
    } catch (error) {
      console.error("❌ Error saving water/feed info:", error);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      notificationService.error(error.message);
    }
  }

  // ===== Load for view =====

  async loadPhysicalInfo(hallId) {
    try {
      const response = await hallsApi.getPhysicalInfo(hallId);
      if (response.success && response.data) {
        const d = response.data;
        document.getElementById("length").value = d.length || "";
        document.getElementById("width").value = d.width || "";
        document.getElementById("height").value = d.height || "";
        document.getElementById("area").value = d.area || "";
        document.getElementById("floorMaterial").value = d.floor_type_id || "";
        document.getElementById("Hall-Physical-Description").value =
          d.notes || "";
      } else this.resetTab("physicalTab");
    } catch (error) {
      this.resetTab("physicalTab");
    }
  }

  async loadSystemInfo(hallId) {
    try {
      const response = await hallsApi.getSystemInfo(hallId);
      if (response.success && response.data) {
        const d = response.data;
        document.getElementById("fanCount").value = d.fan_count || "";
        document.getElementById("fanSize").value = d.fan_size || "";
        document.getElementById("fanCapacity").value = d.fan_capacity || "";
        document.getElementById("heaterCount").value = d.heater_count || "";
        document.getElementById("heatingType").value =
          d.heating_system_id || "";
        document.getElementById("coolingType").value =
          d.cooling_system_id || "";
        document.getElementById("ventilationType").value =
          d.ventilation_system_id || "";
        document.getElementById("sanitarySystem").value =
          d.water_inlet_system_id || "";
        document.getElementById("lighthingSystem").value =
          d.lighting_system_id || "";
        document.getElementById("Hall-System-Description").value =
          d.notes || "";
      } else this.resetTab("systemsTab");
    } catch (error) {
      this.resetTab("systemsTab");
    }
  }

  async loadWaterFeedInfo(hallId) {
    try {
      const response = await hallsApi.getWaterFeedInfo(hallId);
      if (response.success && response.data) {
        const d = response.data;
        document.getElementById("waterType").value = d.waterer_type_id || "";
        document.getElementById("foodType").value = d.feeder_type_id || "";
        document.getElementById("waterLines").value = d.water_lines_count || "";
        document.getElementById("foodLines").value = d.feed_lines_count || "";
        const autoFeedRadios = document.querySelectorAll(
          'input[name="autoFood"]',
        );
        autoFeedRadios.forEach((r) => {
          if (r.value === "دارد" && d.auto_feed_system === true)
            r.checked = true;
          else if (r.value === "ندارد" && d.auto_feed_system === false)
            r.checked = true;
        });
        document.getElementById("Hall-water-feed-Description").value =
          d.notes || "";
      } else this.resetTab("waterFoodTab");
    } catch (error) {
      this.resetTab("waterFoodTab");
    }
  }

  // ===== Reset =====

  resetTab(tabId) {
    const tabMap = {
      unitTab: [
        "unitName",
        "unitAddress",
        "unitLongitude",
        "unitLatitude",
        "unitHallCount",
        "unitManagerName",
        "unitManagerPhone",
      ],
      basicTab: [
        "hallNumber",
        "UnitNumber",
        "hallName",
        "capacity",
        "altitude",
        "hallType",
        "buildYear",
        "expert",
        "operator",
      ],
      physicalTab: [
        "length",
        "width",
        "height",
        "area",
        "floorMaterial",
        "Hall-Physical-Description",
      ],
      systemsTab: [
        "fanCount",
        "fanSize",
        "fanCapacity",
        "heaterCount",
        "heatingType",
        "coolingType",
        "ventilationType",
        "sanitarySystem",
        "lighthingSystem",
        "Hall-System-Description",
      ],
      waterFoodTab: [
        "waterType",
        "foodType",
        "waterLines",
        "foodLines",
        "Hall-water-feed-Description",
      ],
    };
    (tabMap[tabId] || []).forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.tagName === "SELECT") el.value = "";
        else if (el.type === "checkbox" || el.type === "radio")
          el.checked = false;
        else el.value = "";
      }
    });
    if (tabId === "waterFoodTab")
      document
        .querySelectorAll('input[name="autoFood"]')
        .forEach((r) => (r.checked = false));
    const saveBtn = document.querySelector(`#${tabId} .btn-primary`);
    if (saveBtn) {
      const texts = {
        unitTab: "ثبت واحد جدید",
        basicTab: "ذخیره اطلاعات پایه",
        physicalTab: "ذخیره اطلاعات فیزیکی",
        systemsTab: "ذخیره اطلاعات سیستم‌ها",
        waterFoodTab: "ذخیره اطلاعات آبخوری و دانخوری",
      };
      saveBtn.innerHTML = `<i class="fas fa-save"></i> ${texts[tabId] || "ذخیره"}`;
      saveBtn.style.background = "";
      saveBtn.disabled = false;
    }
  }

  toggleHallCard(header) {
    const card = header.closest(".hall-card");
    if (!card) return;
    const body = card.querySelector(".hall-card-body");
    const isExpanded = body.classList.contains("expanded");
    if (isExpanded) {
      body.classList.remove("expanded");
      body.style.display = "none";
      header.classList.add("collapsed");
    } else {
      body.classList.add("expanded");
      body.style.display = "block";
      header.classList.remove("collapsed");
    }
  }

  async toggleHallStatus(hallId, newStatus) {
    const actionText = newStatus ? "فعال" : "غیرفعال";
    const confirmed = await notificationService.confirm({
      title: `${actionText} سازی سالن`,
      text: `آیا از ${actionText} سازی این سالن اطمینان دارید؟`,
      confirmText: `بله، ${actionText} شود`,
      cancelText: "انصراف",
    });
    if (!confirmed) return;
    try {
      const response = await hallsApi.toggleHallStatus(hallId, {
        is_active: newStatus,
      });
      if (response.success) {
        notificationService.success("✅ وضعیت سالن با موفقیت تغییر کرد");
        await this.loadData();
      } else
        notificationService.error(response.message || "خطا در تغییر وضعیت");
    } catch (error) {
      console.error("❌ Error toggling hall status:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  async deleteHall(hallId) {
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف سالن",
      text: "آیا از حذف این سالن اطمینان دارید؟",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });
    if (!confirmed) return;
    try {
      const response = await hallsApi.deleteHall(hallId);
      if (response.success) {
        notificationService.success("سالن با موفقیت حذف شد");
        await this.loadData();
      } else notificationService.error(response.message || "خطا در حذف سالن");
    } catch (error) {
      console.error("❌ Error deleting hall:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  refresh() {
    this.loadData();
    this.updateHallsDropdowns();
  }

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
  }

  getHalls() {
    return this.halls;
  }
  getPeriods() {
    return this.periods;
  }
  getDictionaries() {
    return this.dictionaries;
  }
}

export const hallsService = new HallsService();

if (typeof window !== "undefined") {
  window.hallsService = hallsService;
  window.HallsService = HallsService;
  window.loadAllHallsDropdowns = () => hallsService.updateHallsDropdowns();
  window.loadPeriodsDropdown = () => hallsService.loadPeriods();
  window.renderHallsList = () => hallsService.renderHallsList();
  window.refreshAllHallsDropdowns = () => hallsService.updateHallsDropdowns();
  window.checkHasActivePeriod = (id) => hallsService.checkActivePeriod();
  window.editHall = (id) => hallsService.editHall(id);
  window.toggleHallStatus = (id, s) => hallsService.toggleHallStatus(id, s);
  window.deleteHallRecord = (id) => hallsService.deleteHall(id);
  window.toggleHallCard = (h) => hallsService.toggleHallCard(h);
  window.saveBasicInfo = () => hallsService.saveBasicInfo();
  window.saveUnitInfo = () => hallsService.saveUnitInfo();
  window.resetUnitTab = () => hallsService.resetTab("unitTab");
  window.resetTab = (t) => hallsService.resetTab(t + "Tab");
  window.savePhysicalInfo = () => hallsService.savePhysicalInfo();
  window.saveSystemsInfo = () => hallsService.saveSystemsInfo();
  window.saveWaterFoodInfo = () => hallsService.saveWaterFeedInfo();
  window.generateHallsReport = async () => {
    try {
      const { hallsReport } = await import("./halls.report.js");
      await hallsReport.generateAndPrint();
    } catch (error) {
      console.error("❌ Error generating halls report:", error);
      notificationService.error("خطا در تولید گزارش");
    }
  };
  window.refreshAllHallsDropdownsInPage = () =>
    hallsService.refreshAllDropdowns();
}
