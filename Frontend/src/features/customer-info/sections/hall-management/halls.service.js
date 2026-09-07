import { hallsApi } from "./halls.api.js";
import { hallsRenderer } from "./halls.renderer.js";
import { hallsValidation } from "./halls.validation.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import { authService } from "../../../../core/services/auth.service.js";
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
      this.autoGenerateHallName();
      this.lockBasicHallNumberField();
      this.applyDefaultExpertSelection();
      this.refreshUnitCapacityBadge();
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
        this.lockBasicHallNumberField();
      }
    } catch (error) {
      console.error("❌ Error loading halls:", error);
    }
  }

  autoGenerateHallName() {
    if (this.editingHallId) return;
    const unitId = document.getElementById("UnitNumber")?.value;
    if (!unitId) return;
    const unitHalls = this.halls.filter((h) => h.unit_id == unitId);
    const nextLetter = String.fromCharCode(65 + unitHalls.length); // A, B, C...
    const hallNameInput = document.getElementById("hallName");
    if (hallNameInput) {
      const unit = this.periods.find((u) => u.id == unitId);
      hallNameInput.value = `سالن ${nextLetter}${unit ? ` - ${unit.unit_name}` : ""}`;
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
      this.lockBasicHallNumberField();
    }
  }

  // قفل فیلد «شماره سالن» فقط در تب اطلاعات پایه سالن
  lockBasicHallNumberField() {
    const sel = document.getElementById("hallNumber");
    if (!sel) return;
    const hasValue = Boolean(String(sel.value || "").trim());
    sel.disabled = hasValue;
    sel.style.opacity = hasValue ? "0.85" : "";
    sel.style.background = hasValue ? "#f1f5f9" : "";
    sel.title = hasValue
      ? "شماره سالن فقط در همین تب قفل است؛ برای تغییر، «ریست فرم» را بزنید"
      : "";
  }

  // کارشناس خدمات: اگر کاربرِ لاگین‌شده «کارشناس» است، به‌صورت پیش‌فرض انتخاب شود
  applyDefaultExpertSelection() {
    try {
      if (!authService) return;
      const role =
        typeof authService.getUserRole === "function"
          ? authService.getUserRole()
          : "";
      if (role !== "expert") return;
      const uid =
        typeof authService.getUserId === "function"
          ? authService.getUserId()
          : null;
      const sel = document.getElementById("expert");
      if (sel && uid && !String(sel.value || "")) {
        if (
          Array.from(sel.options).some(
            (o) => String(o.value) === String(uid),
          )
        ) {
          sel.value = uid;
        }
      }
    } catch (e) {
      // ignore
    }
  }

  fmtCap(n) {
    try {
      return Number(n || 0).toLocaleString("fa-IR");
    } catch {
      return String(Number(n || 0).toLocaleString());
    }
  }

  // به‌روزرسانی بج «ظرفیت مانده واحد» زیر فیلد ظرفیت اسمی
  async refreshUnitCapacityBadge() {
    const badge = document.getElementById("unitCapacityBadge");
    if (!badge) return;
    const unitId = document.getElementById("UnitNumber")?.value;
    if (!unitId) {
      badge.style.display = "none";
      return;
    }
    try {
      if (
        !this.capacitySummary ||
        Date.now() - (this.capacitySummary.ts || 0) > 45000
      ) {
        const res = await hallsApi.getUnitCapacitySummary(this.customerId);
        const list = res?.success ? res.data || [] : [];
        this.capacitySummary = { list, ts: Date.now() };
      }
      const row = (this.capacitySummary.list || []).find(
        (u) => String(u.unitId) === String(unitId),
      );
      if (!row) {
        badge.style.display = "none";
        return;
      }
      badge.textContent = `ظرفیت مانده واحد: ${this.fmtCap(row.remainingCapacity)} از ${this.fmtCap(row.totalCapacity)} قطعه${
        row.activePlacementCount
          ? ` | ${row.occupiedHallCount} سالن در جوجه‌ریزی`
          : ""
      }`;
      badge.style.display = "block";
    } catch (err) {
      console.warn("⚠️ خطا در دریافت ظرفیت واحد:", err);
      badge.style.display = "none";
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

    // بارگذاری جزئیات کامل واحدها (شامل کارشناسان) برای پنل جزئیات
    const unitsWithDetails = await Promise.all(
      this.periods.map(async (unit) => {
        try {
          const res = await hallsApi.getUnit(unit.id);
          if (res.success) return res.data;
        } catch (e) {
          console.error("❌ Error loading unit details:", e);
        }
        return unit;
      }),
    );

    hallsRenderer.renderUnitsAccordion(
      unitsWithDetails,
      hallsWithDetails,
      this.dictionaries,
    );
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
    this.lockBasicHallNumberField();
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
    // تب "تعریف واحد" همیشه نمایش داده شود — مخفی نمی‌شود
    const container = document.querySelector(".customer-AddHals");
    if (!container) return;
    const unitTab = container.querySelector('[data-tab="unit"]');
    const unitTabContent = document.getElementById("unitTab");
    if (unitTab) unitTab.style.display = "";
    if (unitTabContent) unitTabContent.style.display = "";
    // پیش‌فرض تب basic فعال باشد (اگر قبلاً انتخاب نشده)
    const activeBtn = container.querySelector(".tab-btn.active");
    if (!activeBtn) this.activateTab("basic");
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
    } else if (contentId === "basicTab") {
      this.lockBasicHallNumberField();
      this.refreshUnitCapacityBadge();
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
    const unitNumSelect = document.getElementById("UnitNumber");
    if (unitNumSelect) {
      unitNumSelect.addEventListener("change", () => {
        this.autoGenerateHallName();
        this.refreshUnitCapacityBadge();
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
        this.lockBasicHallNumberField();
      }
      const unitSelect = document.getElementById("UnitNumber");
      if (unitSelect && hall.unit_id) unitSelect.value = hall.unit_id;
      document.getElementById("capacity").value = hall.nominal_capacity || "";
      document.getElementById("altitude").value = hall.altitude_above_sea || "";
      document.getElementById("hallType").value = hall.hall_type_id || "";
      document.getElementById("buildYear").value = hall.construction_year || "";
      document.getElementById("expert").value = hall.service_expert_id || "";
      if (!document.getElementById("expert")?.value) {
        this.applyDefaultExpertSelection();
      }
      document.getElementById("operator").value = hall.operator_name || "";
      this.refreshUnitCapacityBadge();

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
        this.renderSystemItemsEditor(
          s.HallSystemItems || s.items || [],
          s,
        );
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

  // ===== جمع‌آوری کارشناسان از فرم =====
  collectUnitExperts() {
    const rows = document.querySelectorAll(
      "#unitExpertsContainer .unit-expert-row",
    );
    const experts = [];
    rows.forEach((row) => {
      const name = row.querySelector(".unit-expert-name")?.value?.trim();
      const phone = row.querySelector(".unit-expert-phone")?.value?.trim();
      const role = row.querySelector(".unit-expert-role")?.value?.trim();
      // ردیف کاملاً خالی → نادیده گرفته می‌شود (افزودن کارشناس اختیاری است)
      if (!name && !phone && !role) return;
      // اگر ردیف ناقص باشد، با مقادیر فعلی ارسال می‌شود تا اعتبارسنجی خطای مناسب بدهد
      experts.push({
        expert_name: name,
        expert_phone: phone || null,
        expert_role: role || null,
      });
    });
    return experts;
  }

  // ===== افزودن ردیف کارشناس =====
  addUnitExpertRow() {
    const container = document.getElementById("unitExpertsContainer");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "unit-expert-row";
    row.innerHTML = `
      <div class="form-group"><label>نام کارشناس</label><input type="text" maxlength="50"
          class="unit-expert-name" placeholder="نام کارشناس"></div>
      <div class="form-group"><label>شماره تماس</label><input type="text" maxlength="11" inputmode="numeric"
          class="unit-expert-phone" placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
          oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,11)"></div>
      <div class="form-group"><label>نقش / تخصص</label><input type="text" maxlength="50"
          class="unit-expert-role" placeholder="مثال: کارشناس تغذیه"></div>
      <button type="button" class="btn-remove-expert" onclick="window.removeUnitExpertRow(this)" title="حذف کارشناس">
        <i class="fas fa-times"></i>
      </button>
    `;
    container.appendChild(row);
  }

  // ===== حذف ردیف کارشناس =====
  removeUnitExpertRow(btn) {
    const row = btn?.closest(".unit-expert-row");
    if (!row) return;
    const container = document.getElementById("unitExpertsContainer");
    if (container.querySelectorAll(".unit-expert-row").length <= 1) {
      row.querySelector(".unit-expert-name").value = "";
      row.querySelector(".unit-expert-phone").value = "";
      row.querySelector(".unit-expert-role").value = "";
      return;
    }
    row.remove();
  }

  // ===== ریست ردیف‌های کارشناس واحد (بازگشت به یک ردیف خالی) =====
  resetUnitExpertRows() {
    const container = document.getElementById("unitExpertsContainer");
    if (!container) return;
    container.innerHTML = "";
    const row = document.createElement("div");
    row.className = "unit-expert-row";
    row.innerHTML = `
      <div class="form-group"><label>نام کارشناس</label><input type="text" maxlength="50"
          class="unit-expert-name" placeholder="نام کارشناس"></div>
      <div class="form-group"><label>شماره تماس</label><input type="text" maxlength="11" inputmode="numeric"
          class="unit-expert-phone" placeholder="مثال: ۰۹۱۲۳۴۵۶۷۸۹"
          oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,11)"></div>
      <div class="form-group"><label>نقش / تخصص</label><input type="text" maxlength="50"
          class="unit-expert-role" placeholder="مثال: کارشناس تغذیه"></div>
    `;
    container.appendChild(row);
  }

  async saveUnitInfo() {
    const data = {
      customer_personal_information_id: parseInt(this.customerId),
      unit_name: document.getElementById("unitName")?.value,
      address: document.getElementById("unitAddress")?.value || null,
      longitude: document.getElementById("unitLongitude")?.value || null,
      latitude: document.getElementById("unitLatitude")?.value || null,
      hall_count: document.getElementById("unitHallCount")?.value || null,
      capacity: document.getElementById("unitCapacity")?.value || null,
      manager_name: document.getElementById("unitManagerName")?.value || null,
      manager_phone: document.getElementById("unitManagerPhone")?.value || null,
      experts: this.collectUnitExperts(),
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
    const selectedPhysHall = this.halls.find((h) => h.id == finalHallId);
    const data = {
      hall_id: parseInt(finalHallId),
      unit_id: selectedPhysHall?.unit_id || null,
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
    const unitId = selectedHall?.unit_id || null;
    const data = {
      hall_id: parseInt(finalHallId),
      unit_id: unitId,
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
      items: this.collectSystemItems(),
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
    const selectedWFHall = this.halls.find((h) => h.id == finalHallId);
    const autoFood = document.querySelector('input[name="autoFood"]:checked');
    const data = {
      hall_id: parseInt(finalHallId),
      unit_id: selectedWFHall?.unit_id || null,
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
        this.renderSystemItemsEditor(d.HallSystemItems || d.items || [], d);
      } else this.resetTab("systemsTab");
    } catch (error) {
      this.resetTab("systemsTab");
    }
  }

  // ===== جزئیات انواع سیستم‌ها (گرمایش/سرمایش/فن) — جدول hall_system_items =====

  sysCatMeta() {
    return {
      heating: { title: "🔥 سیستم‌های گرمایش", dict: "heatingSystems", typePlaceholder: "انتخاب نوع گرمایش..." },
      cooling: { title: "❄️ سیستم‌های سرمایش", dict: "coolingSystems", typePlaceholder: "انتخاب نوع سرمایش..." },
      fan: { title: "🌀 فن‌ها (سایز هر فن)", dict: null, typePlaceholder: "" },
    };
  }

  sysOptionsHtml(dictKey, selected) {
    const list = (this.dictionaries || {})[dictKey] || [];
    let html = `<option value="">انتخاب کنید...</option>`;
    list.forEach((d) => {
      html += `<option value="${d.id}" ${String(d.id) === String(selected || "") ? "selected" : ""}>${d.name}</option>`;
    });
    return html;
  }

  createSysRowHtml(cat, item = {}) {
    const qty = parseInt(item.quantity) || 1;
    const spec = item.spec || "";
    if (cat === "fan") {
      return `
        <div class="sys-item-row" data-cat="fan" style="display:flex; align-items:center; gap:6px; margin:4px 0; flex-wrap:wrap;">
          <input type="text" class="sys-item-spec" value="${spec}" placeholder="سایز فن (مثلاً ۳۶ اینچ)" style="width:160px; padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px;">
          <input type="number" min="1" class="sys-item-qty" value="${qty}" placeholder="تعداد" style="width:80px; padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px;">
          <button type="button" class="sys-item-del" onclick="removeSystemItemRow(this)" title="حذف"
            style="background:#fee2e2; color:#b91c1c; border:none; border-radius:6px; width:26px; height:26px; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>`;
    }
    const meta = this.sysCatMeta()[cat];
    const dictKey = meta?.dict;
    return `
      <div class="sys-item-row" data-cat="${cat}" style="display:flex; align-items:center; gap:6px; margin:4px 0; flex-wrap:wrap;">
        <select class="sys-item-type" style="min-width:190px; padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px;">
          ${this.sysOptionsHtml(dictKey, item.type_id)}
        </select>
        <input type="number" min="1" class="sys-item-qty" value="${qty}" placeholder="تعداد" style="width:80px; padding:5px 8px; border:1px solid #e2e8f0; border-radius:6px; font-size:12px;">
        <button type="button" class="sys-item-del" onclick="removeSystemItemRow(this)" title="حذف"
          style="background:#fee2e2; color:#b91c1c; border:none; border-radius:6px; width:26px; height:26px; cursor:pointer;"><i class="fas fa-times"></i></button>
      </div>`;
  }

  renderSystemItemsEditor(items = [], legacy = {}) {
    const container = document.getElementById("systemItemsEditor");
    if (!container) return;

    const list = Array.isArray(items) ? items : [];
    const heating = list.filter((i) => i.category === "heating");
    const cooling = list.filter((i) => i.category === "cooling");
    const fans = list.filter((i) => i.category === "fan");

    if (heating.length === 0 && legacy.heating_system_id) {
      heating.push({ category: "heating", type_id: legacy.heating_system_id, quantity: legacy.heater_count || 1, spec: null });
    }
    if (cooling.length === 0 && legacy.cooling_system_id) {
      cooling.push({ category: "cooling", type_id: legacy.cooling_system_id, quantity: 1, spec: null });
    }
    if (fans.length === 0 && (legacy.fan_count || legacy.fan_size)) {
      fans.push({ category: "fan", type_id: null, quantity: legacy.fan_count || 1, spec: legacy.fan_size || "" });
    }

    const group = (cat, rows) => {
      const meta = this.sysCatMeta()[cat];
      return `
        <div style="margin:8px 0 4px; padding:8px 10px; border:1px solid #e8edf3; border-radius:8px; background:#fbfdff;">
          <div style="font-weight:700; font-size:12px; color:#334155; margin-bottom:4px;">${meta.title}</div>
          <div class="sys-rows" id="sysRows-${cat}">${rows.map((r) => this.createSysRowHtml(cat, r)).join("")}</div>
          <button type="button" class="btn btn-secondary" style="margin-top:4px; font-size:11px; padding:3px 10px;"
            onclick="addSystemItemRow('${cat}')"><i class="fas fa-plus"></i> افزودن</button>
        </div>`;
    };

    container.innerHTML =
      group("heating", heating) +
      group("cooling", cooling) +
      group("fan", fans);
  }

  addSystemItemRow(cat) {
    const rowsEl = document.getElementById(`sysRows-${cat}`);
    if (!rowsEl) return;
    rowsEl.insertAdjacentHTML("beforeend", this.createSysRowHtml(cat, {}));
  }

  removeSystemItemRow(btn) {
    const row = btn?.closest(".sys-item-row");
    if (row) row.remove();
  }

  collectSystemItems() {
    const items = [];
    document.querySelectorAll("#systemItemsEditor .sys-item-row").forEach((row) => {
      const cat = row.dataset.cat;
      const typeSel = row.querySelector(".sys-item-type");
      const qtyVal = parseInt(row.querySelector(".sys-item-qty")?.value) || 1;
      const specVal = (row.querySelector(".sys-item-spec")?.value || "").trim();
      if (cat === "fan") {
        const spec = specVal || row.querySelector(".sys-item-qty")?.value ? specVal : "";
        if (spec || qtyVal) items.push({ category: "fan", type_id: null, quantity: qtyVal, spec: spec || null });
      } else {
        const tid = typeSel?.value;
        if (tid) items.push({ category: cat, type_id: tid, quantity: qtyVal, spec: specVal || null });
      }
    });
    return items;
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
        "unitCapacity",
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
    if (tabId === "basicTab") {
      const sel = document.getElementById("hallNumber");
      if (sel) {
        sel.disabled = false;
        sel.style.opacity = "";
        sel.style.background = "";
        sel.title = "";
      }
      this.applyDefaultExpertSelection();
      this.refreshUnitCapacityBadge();
    }
    if (tabId === "systemsTab") this.renderSystemItemsEditor([], {});
    if (tabId === "waterFoodTab")
      document
        .querySelectorAll('input[name="autoFood"]')
        .forEach((r) => (r.checked = false));
    // ریست ردیف‌های کارشناس واحد
    if (tabId === "unitTab") this.resetUnitExpertRows();
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

  toggleUnitCard(header) {
    const card = header.closest(".unit-card");
    if (!card) return;
    const body = card.querySelector(".unit-card-body");
    const isExpanded = body.style.display === "block";
    if (isExpanded) {
      body.style.display = "none";
      header.classList.add("collapsed");
    } else {
      body.style.display = "block";
      header.classList.remove("collapsed");
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

  async toggleUnitStatus(unitId, newStatus) {
    const actionText = newStatus ? "فعال" : "غیرفعال";
    const confirmed = await notificationService.confirm({
      title: `${actionText} سازی واحد`,
      text: `آیا از ${actionText} سازی این واحد اطمینان دارید؟`,
      confirmText: `بله، ${actionText} شود`,
      cancelText: "انصراف",
    });
    if (!confirmed) return;
    try {
      const response = await hallsApi.updateUnit(unitId, {
        is_active: newStatus,
      });
      if (response.success) {
        notificationService.success("✅ وضعیت واحد با موفقیت تغییر کرد");
        await this.loadData();
      } else
        notificationService.error(response.message || "خطا در تغییر وضعیت");
    } catch (error) {
      console.error("❌ Error toggling unit status:", error);
      notificationService.error("خطا در ارتباط با سرور");
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

  async deleteUnit(unitId) {
    const unit = this.periods.find((u) => u.id == unitId);
    const unitName = unit?.unit_name || "این واحد";
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف واحد",
      text: `آیا از حذف "${unitName}" اطمینان دارید؟\n⚠️ همه سالن‌ها و گله‌های مرتبط با این واحد نیز حذف خواهند شد!`,
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });
    if (!confirmed) return;
    try {
      const response = await hallsApi.deleteUnit(unitId);
      if (response.success) {
        notificationService.success(
          "واحد و تمام سالن‌ها و گله‌های مرتبط با موفقیت حذف شد",
        );
        await this.loadData();
      } else notificationService.error(response.message || "خطا در حذف واحد");
    } catch (error) {
      console.error("❌ Error deleting unit:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ============================================================
  // ✅ UNIT DETAILS PANEL (پنل جزئیات واحد در اکوردیون)
  // ============================================================

  // بارگذاری اطلاعات کامل واحد و ساخت پنل جزئیات
  async loadUnitDetails(unitId) {
    try {
      const response = await hallsApi.getUnit(unitId);
      if (!response.success) {
        notificationService.error("خطا در دریافت اطلاعات واحد");
        return null;
      }
      return response.data;
    } catch (error) {
      console.error("❌ Error loading unit details:", error);
      notificationService.error("خطا در ارتباط با سرور");
      return null;
    }
  }

  // فعال‌سازی حالت ویرایش واحد
  openUnitEdit(unitId) {
    const card = document.querySelector(`.unit-card[data-unit-id="${unitId}"]`);
    if (!card) return;
    const panel = card.querySelector(".unit-details-panel");
    if (!panel) return;
    // نمایش فرم ویرایش
    const viewEl = panel.querySelector(".unit-details-view");
    const editEl = panel.querySelector(".unit-details-edit");
    if (viewEl) viewEl.style.display = "none";
    if (editEl) editEl.style.display = "block";
  }

  // ذخیره اطلاعات ویرایش‌شده واحد
  async updateUnitInfo(unitId) {
    const card = document.querySelector(`.unit-card[data-unit-id="${unitId}"]`);
    if (!card) return;
    const panel = card.querySelector(".unit-details-panel");
    if (!panel) return;

    const data = {
      unit_name: panel.querySelector("#editUnitName")?.value,
      address: panel.querySelector("#editUnitAddress")?.value || null,
      longitude: panel.querySelector("#editUnitLongitude")?.value || null,
      latitude: panel.querySelector("#editUnitLatitude")?.value || null,
      hall_count: panel.querySelector("#editUnitHallCount")?.value || null,
      capacity: panel.querySelector("#editUnitCapacity")?.value || null,
      manager_name: panel.querySelector("#editUnitManagerName")?.value || null,
      manager_phone:
        panel.querySelector("#editUnitManagerPhone")?.value || null,
    };

    // اعتبارسنجی
    const errors = hallsValidation.validateUnit(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      return;
    }

    const saveBtn = panel.querySelector(".btn-save-unit-edit");
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';
    }
    try {
      const response = await hallsApi.updateUnit(unitId, data);
      if (response.success) {
        // ===== ذخیره کارشناسان: ویرایش موجودها + افزودن جدیدها =====
        const existingExperts = [];
        const newExperts = [];
        panel.querySelectorAll(".unit-edit-expert-row").forEach((row) => {
          const expertId = row.getAttribute("data-expert-id");
          const name = row
            .querySelector(".unit-edit-expert-name")
            ?.value?.trim();
          const phone = row
            .querySelector(".unit-edit-expert-phone")
            ?.value?.trim();
          const role = row
            .querySelector(".unit-edit-expert-role")
            ?.value?.trim();
          // ردیف کاملاً خالی → نادیده (افزودن کارشناس اختیاری است)
          if (!name && !phone && !role) return;
          const expertData = {
            expert_name: name,
            expert_phone: phone || null,
            expert_role: role || null,
          };
          if (expertId) existingExperts.push({ expertId, ...expertData });
          else newExperts.push(expertData);
        });

        // بروزرسانی کارشناسان موجود
        for (const expert of existingExperts) {
          const res = await hallsApi
            .updateUnitExpert(unitId, expert.expertId, expert)
            .catch(() => ({
              success: false,
              message: "خطا در بروزرسانی کارشناس",
            }));
          if (!res.success) {
            notificationService.error(res.message);
            return;
          }
        }
        // افزودن کارشناسان جدید
        for (const expert of newExperts) {
          const res = await hallsApi
            .addUnitExpert(unitId, expert)
            .catch(() => ({
              success: false,
              message: "خطا در افزودن کارشناس",
            }));
          if (!res.success) {
            notificationService.error(res.message);
            return;
          }
        }

        notificationService.success("✅ اطلاعات واحد با موفقیت بروزرسانی شد");
        await this.loadData();
      } else {
        notificationService.error(response.message || "خطا در بروزرسانی واحد");
      }
    } catch (error) {
      console.error("❌ Error updating unit:", error);
      notificationService.error("خطا در ارتباط با سرور");
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره تغییرات';
      }
    }
  }

  // افزودن ردیف کارشناس در پنل ویرایش واحد
  addUnitEditExpertRow(unitId) {
    const card = document.querySelector(`.unit-card[data-unit-id="${unitId}"]`);
    if (!card) return;
    const container = card.querySelector(".unit-edit-experts-container");
    if (!container) return;
    const row = document.createElement("div");
    row.className = "unit-edit-expert-row";
    row.innerHTML = `
      <input type="text" maxlength="50" class="unit-edit-expert-name" placeholder="نام کارشناس">
      <input type="text" maxlength="11" inputmode="numeric" class="unit-edit-expert-phone" placeholder="شماره تماس"
        oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,11)">
      <input type="text" maxlength="50" class="unit-edit-expert-role" placeholder="نقش / تخصص">
      <button type="button" class="btn-remove-expert" onclick="window.removeUnitEditExpertRow(this)" title="حذف">
        <i class="fas fa-times"></i>
      </button>
    `;
    container.appendChild(row);
  }

  // حذف ردیف کارشناس از پنل ویرایش
  async removeUnitEditExpertRow(btn) {
    const row = btn?.closest(".unit-edit-expert-row");
    if (!row) return;
    const expertId = row.getAttribute("data-expert-id");
    // اگر کارشناس موجود است، حذف از دیتابیس با تأیید کاربر
    if (expertId) {
      const confirmed = await notificationService.confirm({
        title: "🗑️ حذف کارشناس",
        text: "آیا از حذف این کارشناس اطمینان دارید؟",
        confirmText: "بله، حذف شود",
        cancelText: "انصراف",
      });
      if (!confirmed) return;
      try {
        const unitCard = row.closest(".unit-card");
        const unitId = unitCard?.getAttribute("data-unit-id");
        if (!unitId) return;
        const res = await hallsApi
          .deleteUnitExpert(unitId, expertId)
          .catch(() => ({
            success: false,
            message: "خطا در ارتباط با سرور",
          }));
        if (!res.success) {
          notificationService.error(res.message);
          return;
        }
        notificationService.success("کارشناس با موفقیت حذف شد");
      } catch (error) {
        console.error("❌ Error deleting unit expert:", error);
        notificationService.error("خطا در حذف کارشناس");
        return;
      }
    }
    row.remove();
  }

  // رندر پنل جزئیات واحد (برای renderer)
  renderUnitDetailsPanel(unit) {
    if (!unit) return "";
    const experts = unit.experts || [];
    const expertListHtml = experts.length
      ? experts
          .map(
            (e) => `
            <div class="unit-expert-chip">
              <i class="fas fa-user-tie"></i>
              <strong>${e.expert_name || "-"}</strong>
              ${e.expert_phone ? `<span class="chip-phone">${e.expert_phone}</span>` : ""}
              ${e.expert_role ? `<span class="chip-role">${e.expert_role}</span>` : ""}
            </div>`,
          )
          .join("")
      : '<span class="unit-no-experts">کارشناسی ثبت نشده است</span>';

    return `
      <div class="unit-details-panel">
        <div class="unit-details-view">
          <div class="unit-details-grid">
            <div class="unit-detail-item">
              <div class="detail-icon"><i class="fas fa-map-marker-alt"></i></div>
              <div class="detail-content">
                <span class="label">آدرس</span>
                <span class="value">${unit.address || "—"}</span>
              </div>
            </div>
            <div class="unit-detail-item">
              <div class="detail-icon"><i class="fas fa-hashtag"></i></div>
              <div class="detail-content">
                <span class="label">تعداد سالن‌ها</span>
                <span class="value">${unit.hall_count || "-"}</span>
              </div>
            </div>
            <div class="unit-detail-item">
              <div class="detail-icon"><i class="fas fa-globe-asia"></i></div>
              <div class="detail-content">
                <span class="label">طول جغرافیایی</span>
                <span class="value">${unit.longitude || "—"}</span>
              </div>
            </div>
            <div class="unit-detail-item">
              <div class="detail-icon"><i class="fas fa-globe"></i></div>
              <div class="detail-content">
                <span class="label">عرض جغرافیایی</span>
                <span class="value">${unit.latitude || "—"}</span>
              </div>
            </div>
            <div class="unit-detail-item">
              <div class="detail-icon"><i class="fas fa-weight-hanging"></i></div>
              <div class="detail-content">
                <span class="label">ظرفیت واحد</span>
                <span class="value">${(unit.capacity ?? 0).toLocaleString()} قطعه</span>
              </div>
            </div>
            <div class="unit-detail-item">
              <div class="detail-icon"><i class="fas fa-user"></i></div>
              <div class="detail-content">
                <span class="label">مدیر واحد</span>
                <span class="value">${unit.manager_name || "—"}</span>
              </div>
            </div>
            <div class="unit-detail-item">
              <div class="detail-icon"><i class="fas fa-phone"></i></div>
              <div class="detail-content">
                <span class="label">تماس مدیر</span>
                <span class="value" dir="ltr">${unit.manager_phone || "—"}</span>
              </div>
            </div>
          </div>
          <div class="unit-experts-section">
            <div class="unit-experts-title"><i class="fas fa-user-tie"></i> کارشناسان واحد</div>
            <div class="unit-experts-list">${expertListHtml}</div>
          </div>
          <div class="unit-details-actions">
            <button class="btn-edit-unit" onclick="event.stopPropagation(); window.openUnitEdit(${unit.id})">
              <i class="fas fa-edit"></i> بروزرسانی اطلاعات واحد
            </button>
          </div>
        </div>
        <div class="unit-details-edit" style="display:none;">
          <div class="unit-edit-form">
            <div class="form-grid">
              <div class="form-group"><label>نام واحد <span class="required">*</span></label><input type="text" id="editUnitName" value="${unit.unit_name || ""}"></div>
              <div class="form-group"><label>آدرس واحد</label><input type="text" id="editUnitAddress" value="${unit.address || ""}"></div>
              <div class="form-group"><label>طول جغرافیایی</label><input type="text" id="editUnitLongitude" value="${unit.longitude || ""}"></div>
              <div class="form-group"><label>عرض جغرافیایی</label><input type="text" id="editUnitLatitude" value="${unit.latitude || ""}"></div>
              <div class="form-group"><label>تعداد سالن‌ها <span class="required">*</span></label><input type="number" id="editUnitHallCount" value="${unit.hall_count || ""}"></div>
              <div class="form-group"><label>ظرفیت واحد (قطعه) <span class="required">*</span></label><input type="number" id="editUnitCapacity" min="0" max="1000000" value="${unit.capacity ?? ""}"></div>
              <div class="form-group"><label>نام مدیر واحد <span class="required">*</span></label><input type="text" id="editUnitManagerName" value="${unit.manager_name || ""}"></div>
              <div class="form-group"><label>شماره تماس مدیر <span class="required">*</span></label><input type="text" id="editUnitManagerPhone" value="${unit.manager_phone || ""}"></div>
            </div>
            <div class="unit-edit-experts-section">
              <div class="unit-experts-title"><i class="fas fa-user-tie"></i> ویرایش کارشناسان</div>
              <div class="unit-edit-experts-container">
                ${(unit.experts || [])
                  .map(
                    (e) => `
                <div class="unit-edit-expert-row" data-expert-id="${e.id}">
                  <input type="text" maxlength="50" class="unit-edit-expert-name" value="${e.expert_name || ""}" placeholder="نام کارشناس">
                  <input type="text" maxlength="11" inputmode="numeric" class="unit-edit-expert-phone" value="${e.expert_phone || ""}" placeholder="شماره تماس"
                    oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,11)">
                  <input type="text" maxlength="50" class="unit-edit-expert-role" value="${e.expert_role || ""}" placeholder="نقش / تخصص">
                  <button type="button" class="btn-remove-expert" data-expert-id="${e.id}" onclick="event.stopPropagation(); window.removeUnitEditExpertRow(this)" title="حذف کارشناس">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>`,
                  )
                  .join("")}
                <div class="unit-edit-expert-row" data-is-new="true">
                  <input type="text" maxlength="50" class="unit-edit-expert-name" placeholder="نام کارشناس">
                  <input type="text" maxlength="11" inputmode="numeric" class="unit-edit-expert-phone" placeholder="شماره تماس"
                    oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,11)">
                  <input type="text" maxlength="50" class="unit-edit-expert-role" placeholder="نقش / تخصص">
                  <button type="button" class="btn-remove-expert" onclick="window.removeUnitEditExpertRow(this)" title="حذف">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              </div>
              <button type="button" class="btn-add-expert" onclick="event.stopPropagation(); window.addUnitEditExpertRow(${unit.id})">
                <i class="fas fa-plus"></i> افزودن کارشناس
              </button>
            </div>
            <div class="unit-edit-actions">
              <button class="btn-save-unit-edit" onclick="window.updateUnitInfo(${unit.id})">
                <i class="fas fa-save"></i> ذخیره تغییرات
              </button>
              <button class="btn-cancel-unit-edit" onclick="event.stopPropagation(); window.closeUnitEdit(${unit.id})">
                <i class="fas fa-times"></i> انصراف
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // بستن حالت ویرایش واحد
  closeUnitEdit(unitId) {
    const card = document.querySelector(`.unit-card[data-unit-id="${unitId}"]`);
    if (!card) return;
    const panel = card.querySelector(".unit-details-panel");
    if (!panel) return;
    const viewEl = panel.querySelector(".unit-details-view");
    const editEl = panel.querySelector(".unit-details-edit");
    if (viewEl) viewEl.style.display = "block";
    if (editEl) editEl.style.display = "none";
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
  window.deleteUnitRecord = (id) => hallsService.deleteUnit(id);
  window.toggleHallCard = (h) => hallsService.toggleHallCard(h);
  window.toggleUnitCard = (h) => hallsService.toggleUnitCard(h);
  window.toggleUnitStatus = (id, s) => hallsService.toggleUnitStatus(id, s);
  window.saveBasicInfo = () => hallsService.saveBasicInfo();
  window.saveUnitInfo = () => hallsService.saveUnitInfo();
  window.addUnitExpertRow = () => hallsService.addUnitExpertRow();
  window.removeUnitExpertRow = (btn) => hallsService.removeUnitExpertRow(btn);
  window.loadUnitDetails = (id) => hallsService.loadUnitDetails(id);
  window.openUnitEdit = (id) => hallsService.openUnitEdit(id);
  window.updateUnitInfo = (id) => hallsService.updateUnitInfo(id);
  window.closeUnitEdit = (id) => hallsService.closeUnitEdit(id);
  window.addUnitEditExpertRow = (id) => hallsService.addUnitEditExpertRow(id);
  window.removeUnitEditExpertRow = (btn) =>
    hallsService.removeUnitEditExpertRow(btn);
  window.resetUnitTab = () => hallsService.resetTab("unitTab");
  window.resetTab = (t) => hallsService.resetTab(t + "Tab");
  window.savePhysicalInfo = () => hallsService.savePhysicalInfo();
  window.saveSystemsInfo = () => hallsService.saveSystemsInfo();
  window.addSystemItemRow = (cat) => hallsService.addSystemItemRow(cat);
  window.removeSystemItemRow = (btn) => hallsService.removeSystemItemRow(btn);
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
