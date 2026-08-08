import { hatcheryApi } from "./hatchery.api.js";
import { hatcheryRenderer } from "./hatchery.renderer.js";
import { hatcheryFormService } from "./hatchery.form.service.js";
import { hatcheryTabsService } from "./hatchery.tabs.service.js";
import { hatcheryValidation } from "./hatchery.validation.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { stateService } from "../../../../core/services/state.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
} from "../../../../core/utils/date.utils.js";

class HatcheryService {
  constructor() {
    this.customerId = null;
    this.periods = [];
    this.flocks = [];
    this.halls = [];
    this.dictionaries = {};
    this.currentPeriodId = null;
    this.currentFlockId = null;
    this.currentHygieneId = null;
    this.initialized = false;
    this.isEditingPeriod = false;
    this.isEditingFlock = false;
    this.isEditingHygiene = false;
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
      await this.loadPeriods();
      await this.loadHalls();
      await this.loadFlocks();
      await this.loadNextPeriodNumber();
      await this.loadNextFlockNumber();
    } catch (error) {
      console.error("❌ Error loading hatchery data:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  async loadDictionaries() {
    try {
      const [sources, breeds, statuses] = await Promise.all([
        hatcheryApi.getChickSources(),
        hatcheryApi.getChickenBreeds(),
        hatcheryApi.getUnitStatuses(),
      ]);

      this.dictionaries = {
        sources: sources.success ? sources.data : [],
        breeds: breeds.success ? breeds.data : [],
        statuses: statuses.success ? statuses.data : [],
      };

      hatcheryRenderer.renderSelects(this.dictionaries);
    } catch (error) {
      console.error("❌ Error loading dictionaries:", error);
    }
  }

  async loadPeriods() {
    try {
      const response = await hatcheryApi.getUnits(this.customerId);
      if (response.success) {
        this.periods = response.data.periods || [];
        // برای فیلد کشویی دوره - همه دوره‌های active یا pending
        hatcheryRenderer.renderPeriods(this.periods);
        // پیش‌انتخاب آخرین دوره فعال
        this.preselectActivePeriod();
        await this.loadAllPeriodsList();
      }
    } catch (error) {
      console.error("❌ Error loading periods:", error);
    }
  }

  preselectActivePeriod() {
    const select = document.getElementById("skb-period-select");
    if (!select) return;
    // آخرین دوره فعال را بیاب
    const activePeriods = this.periods
      .filter((p) => p.status === "active" || p.status === "pending")
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    if (activePeriods.length > 0 && !select.value) {
      select.value = activePeriods[0].id;
    }
  }

  async loadAllPeriodsList() {
    const tbody = document.getElementById("allPeriodsTableBody");
    if (!tbody) return;

    // فقط دوره‌های فعال (cancelled و deleted نمایش داده نشوند)
    const visiblePeriods = this.periods.filter(
      (p) => p.status !== "cancelled" && p.status !== "deleted",
    );

    if (!visiblePeriods || visiblePeriods.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="9" style="text-align: center;">هیچ دوره فعالی وجود ندارد</td></tr>';
      return;
    }

    const periodsWithData = await Promise.all(
      visiblePeriods.map(async (period) => {
        const halls = this.halls.filter((h) => h.period_id === period.id);
        const flocks = this.flocks.filter((f) => f.period_id === period.id);

        let totalChicks = 0;
        let totalArea = 0;

        for (const hall of halls) {
          const flock = flocks.find(
            (f) => f.hall_id === hall.id && f.is_active === true,
          );
          if (flock) {
            totalChicks += flock.total_chicks_count || 0;
          }

          try {
            const physical = await hatcheryApi.getHallPhysicalInfo(hall.id);
            if (physical.success && physical.data) {
              totalArea += parseFloat(physical.data.area) || 0;
            }
          } catch (e) {
            console.warn(`⚠️ No physical info for hall ${hall.id}`);
          }
        }

        const density =
          totalArea > 0 && totalChicks > 0
            ? (totalChicks / totalArea).toFixed(2)
            : "-";

        return {
          ...period,
          hallsCount: halls.length,
          flocksCount: flocks.length,
          totalChicks,
          totalArea,
          density,
        };
      }),
    );

    const html = hatcheryRenderer.renderPeriodsTable(periodsWithData);
    tbody.innerHTML = html;
  }

  async loadHalls() {
    try {
      const response = await hatcheryApi.getHalls(this.customerId);
      if (response.success) {
        this.halls = response.data || [];
        hatcheryRenderer.renderHallSelects(this.halls);
        hatcheryRenderer.renderHygieneHallSelects(this.halls);
      }
    } catch (error) {
      console.error("❌ Error loading halls:", error);
    }
  }

  async loadFlocks() {
    try {
      const response = await hatcheryApi.getFlocks(this.customerId);
      if (response.success) {
        this.flocks = response.data.placements || [];
        stateService.setFlocks(this.flocks);
        await this.renderFlocksList();
        await this.loadFlocksForFilter();
        // بروزرسانی سلکت سالن (بر اساس گله‌های فعال)
        hatcheryRenderer.renderHallSelects(this.halls, this.flocks);
      }
    } catch (error) {
      console.error("❌ Error loading flocks:", error);
    }
  }

  async renderFlocksList() {
    const tbody = document.getElementById("skbPeriodsTableBody");
    if (!tbody) return;

    if (!this.flocks || this.flocks.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align: center;">هیچ گله‌ای ثبت نشده است</td></tr>';
      return;
    }

    const flocksWithData = await Promise.all(
      this.flocks.map(async (flock) => {
        const hall = this.halls.find((h) => h.id === flock.hall_id);
        const period = this.periods.find((p) => p.id === flock.period_id);
        const breed = this.dictionaries.breeds.find(
          (b) => b.id === flock.breed_id,
        );

        return {
          ...flock,
          hall_name: hall?.hall_name || "-",
          period_number: period?.period_number || "-",
          breed_name: breed?.name || "-",
        };
      }),
    );

    const html = hatcheryRenderer.renderFlocksTable(flocksWithData);
    tbody.innerHTML = html;
  }

  async loadNextPeriodNumber() {
    if (!this.customerId) {
      console.warn("⚠️ No customerId, skipping loadNextPeriodNumber");
      return;
    }

    try {
      // شماره بعدی حذف شده - واحدها نیازی به شماره اتوماتیک ندارند
      return;
      if (response.success) {
        const periodIdField = document.getElementById("chickPeriodId");
        const periodNameField = document.getElementById("chickPeriodName");

        if (periodIdField) {
          periodIdField.value = response.data.periodId || "";
        }
        if (periodNameField && !periodNameField.value) {
          periodNameField.value = response.data.periodName || "";
        }
      }
    } catch (error) {
      console.error("❌ Error loading next period number:", error);
    }
  }

  async loadNextFlockNumber() {
    try {
      const maxFlockNumber = this.flocks.reduce((max, f) => {
        return f.flock_number > max ? f.flock_number : max;
      }, 0);

      const nextNumber = maxFlockNumber + 1;
      const flockNumberField = document.getElementById("skb-flock-number");
      if (flockNumberField) {
        flockNumberField.value = nextNumber;
      }
    } catch (error) {
      console.error("❌ Error loading next flock number:", error);
    }
  }

  // ===== EDIT MODE BANNER =====
  setEditModeBanner(show) {
    const container = document.querySelector(
      "#Hatchery-Management .tabs-container",
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

  // ===== مدیریت تب‌ها =====

  setupTabs() {
    hatcheryTabsService.init();

    // چک کردن وجود دوره فعال هنگام کلیک روی تب ثبت گله
    const chickRegisterTabBtn = document.querySelector(
      '.tab-btn[data-tab="chick-register"]',
    );
    if (chickRegisterTabBtn) {
      chickRegisterTabBtn.addEventListener("click", () => {
        this.checkActivePeriodForRegister();
      });
    }
  }

  checkActivePeriodForRegister() {
    // اگر در حالت ویرایش هستیم، نیازی به چک نیست
    if (this.isEditingFlock) return;

    const hasActivePeriod = this.periods.some(
      (p) => p.status === "active" || p.status === "pending",
    );
    if (!hasActivePeriod) {
      if (typeof Swal !== "undefined") {
        Swal.fire({
          icon: "warning",
          title: "❗ دوره فعالی وجود ندارد",
          text: "لطفاً ابتدا یک دوره پرورش تعریف کنید، سپس اقدام به ثبت گله نمایید.",
          confirmButtonText: "ثبت دوره جدید",
          cancelButtonText: "بعداً",
          showCancelButton: true,
          confirmButtonColor: "#2c7a6e",
          cancelButtonColor: "#94a3b8",
        }).then((result) => {
          if (result.isConfirmed) {
            hatcheryTabsService.activateTab("chick-period-info");
          }
        });
      } else {
        notificationService.info("لطفاً ابتدا یک دوره پرورش تعریف کنید");
        hatcheryTabsService.activateTab("chick-period-info");
      }
    }
  }

  // ===== رویدادها =====

  setupEvents() {
    const savePeriodBtn = document.querySelector(
      "#chickPeriodInfoTab .btn-primary",
    );
    if (savePeriodBtn) {
      savePeriodBtn.addEventListener("click", () => this.savePeriod());
    }

    const saveFlockBtn = document.querySelector(
      "#chickRegisterTab .btn-primary",
    );
    if (saveFlockBtn) {
      saveFlockBtn.addEventListener("click", () => this.saveFlock());
    }

    const saveHygieneBtn = document.querySelector(
      "#chickHygieneInfoTab .btn-primary",
    );
    if (saveHygieneBtn) {
      saveHygieneBtn.addEventListener("click", () => this.saveHygiene());
    }

    const hallSelect = document.getElementById("skb-hall-select");
    if (hallSelect) {
      hallSelect.addEventListener("change", (e) => {
        const hallId = e.target.value;
        if (hallId) {
          this.loadHallAreaForFlock(hallId);
        } else {
          document.getElementById("skb-current-density").value = "";
        }
      });
    }

    const chickCountInput = document.getElementById("skb-chick-count");
    if (chickCountInput) {
      chickCountInput.addEventListener("input", () => {
        this.calculateDensity();
      });
    }

    // رفرش لیست گله‌ها
    const refreshBtn = document.querySelector("#chickListTab .btn-refresh");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => this.refreshFlocks());
    }
    // رفرش لیست دوره‌ها
    const refreshPeriodsBtn = document.querySelector(
      "#chickPeriodsListTab .btn-refresh",
    );
    if (refreshPeriodsBtn) {
      refreshPeriodsBtn.addEventListener("click", () =>
        this.loadAllPeriodsList(),
      );
    }
  }

  // ===== ذخیره دوره =====

  async saveUnit() {
    const data = {
      customer_personal_information_id: parseInt(this.customerId),
      unit_name: document.getElementById("chickUnitName")?.value,
    };

    const saveBtn = document.querySelector("#chickUnitInfoTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';

    const errors = hatcheryValidation.validateUnit(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }

    try {
      let response;
      if (this.isEditingUnit && this.currentUnitId) {
        response = await hatcheryApi.updateUnit(this.currentUnitId, data);
      } else {
        response = await hatcheryApi.createUnit(data);
      }

      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;

      if (response.success) {
        notificationService.success(
          this.isEditingUnit
            ? "واحد با موفقیت بروزرسانی شد"
            : `واحد ${response.data.unit_name} با موفقیت ثبت شد`,
        );

        this.isEditingUnit = false;
        this.currentUnitId = null;
        this.setEditModeBanner(false);

        await this.loadData();
        hatcheryFormService.resetUnitForm();
        saveBtn.innerHTML = '<i class="fas fa-save"></i> ثبت واحد جدید';
      } else {
        notificationService.error(response.message || "خطا در ثبت واحد");
      }
    } catch (error) {
      console.error("❌ Error saving unit:", error);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      notificationService.error(error.message);
    }
  }

  // ===== ذخیره جوجه‌ریزی (گله) =====

  async saveFlock() {
    const hallId = document.getElementById("skb-hall-select")?.value;
    const periodId = document.getElementById("skb-period-select")?.value;
    const placementDate = document.getElementById("skb-chick-date")?.value;
    const chickSource = document.getElementById("skb-chick-source")?.value;
    const breedId = document.getElementById("skb-chick-breed")?.value;
    const chickAge = document.getElementById("skb-chick-age")?.value;
    const initialWeight = document.getElementById("skb-initial-weight")?.value;
    const totalLoad = document.getElementById("skb-total-load")?.value;
    const chickCount = document.getElementById("skb-chick-count")?.value;

    const flockData = {
      hall_id: hallId,
      period_id: periodId,
      placement_date: placementDate,
      chick_source_id: chickSource,
      breed_id: breedId,
      chick_age_on_arrival: chickAge,
      avg_initial_weight: initialWeight,
      total_load: totalLoad,
      total_chicks_count: chickCount,
    };

    const saveBtn = document.querySelector("#chickRegisterTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> در حال ثبت...';

    const errors = hatcheryValidation.validateFlock(flockData);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }

    const gregorianDate = convertPersianToGregorian(placementDate);
    if (!gregorianDate) {
      notificationService.error("تاریخ جوجه‌ریزی معتبر نیست");
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }

    let density = null;
    const area = document.getElementById("skb-current-density")?.dataset?.area;
    if (area && chickCount) {
      density = (parseFloat(chickCount) / parseFloat(area)).toFixed(2);
    }

    const payload = {
      customer_id: parseInt(this.customerId),
      period_id: parseInt(periodId),
      hall_id: parseInt(hallId),
      placement_date: gregorianDate,
      flock_number:
        parseInt(document.getElementById("skb-flock-number")?.value) || 0,
      chick_source_id: chickSource ? parseInt(chickSource) : null,
      breed_id: breedId ? parseInt(breedId) : null,
      chick_age_on_arrival: parseInt(chickAge) || 1,
      avg_initial_weight: initialWeight || null,
      total_chicks_count: parseInt(chickCount) || 0,
      placement_density: density,
    };

    try {
      let response;
      if (this.isEditingFlock && this.currentFlockId) {
        response = await hatcheryApi.updateFlock(this.currentFlockId, payload);
      } else {
        response = await hatcheryApi.createFlock(payload);
      }

      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;

      if (response.success) {
        const summaryItems = [
          payload.flock_number ? `شماره گله: ${payload.flock_number}` : null,
          payload.total_chicks_count
            ? `تعداد جوجه: ${payload.total_chicks_count.toLocaleString()} قطعه`
            : null,
          payload.chick_age_on_arrival
            ? `سن جوجه: ${payload.chick_age_on_arrival} روز`
            : null,
        ].filter(Boolean);

        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: this.isEditingFlock
              ? "✅ گله بروزرسانی شد"
              : "✅ جوجه‌ریزی ثبت شد",
            html: `<div style="text-align:right; font-family:Vazir; direction:rtl;">
              <ul style="list-style:none; padding:0; margin:0;">
                ${summaryItems.map((item) => `<li style="padding:3px 8px; background:#f8fafc; margin:3px 0; border-radius:4px; font-size:12px;">✅ ${item}</li>`).join("")}
              </ul>
            </div>`,
            confirmButtonText: "باشه",
            confirmButtonColor: "#2c7a6e",
          });
        } else {
          notificationService.success(
            this.isEditingFlock
              ? "گله با موفقیت بروزرسانی شد"
              : "جوجه‌ریزی با موفقیت ثبت شد",
          );
        }

        // بروزرسانی وضعیت دوره
        if (!this.isEditingFlock) {
          await hatcheryApi.updatePeriod(periodId, { status: "active" });
        }

        // بستن حالت ویرایش - قبل از loadData
        this.isEditingFlock = false;
        this.currentFlockId = null;
        this.setEditModeBanner(false);
        saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره جوجه ریزی';
        saveBtn.style.background = "";
        saveBtn.dataset.mode = "";

        await this.loadData();
        hatcheryFormService.resetFlockForm();

        if (typeof window.refreshWeeksDisplay === "function") {
          await window.refreshWeeksDisplay();
        }
      } else {
        notificationService.error(response.message || "خطا در ثبت جوجه‌ریزی");
      }
    } catch (error) {
      console.error("❌ Error saving flock:", error);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      notificationService.error(error.message);
    }
  }

  // ===== ذخیره بهداشت =====

  async saveHygiene() {
    const hallId = document.getElementById("chickHealthHallNumber")?.value;
    const lastWashDate = document.getElementById("chickLastWashDate")?.value;
    const lastDisinfectDate = document.getElementById(
      "chickLastDisinfectDate",
    )?.value;
    const disinfectantType = document.getElementById(
      "chickDisinfectMaterial",
    )?.value;
    const description = document.getElementById(
      "chickHygieneDescription",
    )?.value;

    const data = {
      hall_id: hallId,
      last_wash_date: lastWashDate,
      last_disinfect_date: lastDisinfectDate,
      disinfectant_type: disinfectantType,
      description: description,
    };

    const saveBtn = document.querySelector("#chickHygieneInfoTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';

    const errors = hatcheryValidation.validateHygiene(data);
    if (errors.length > 0) {
      notificationService.showValidationErrors(errors);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      return;
    }

    const payload = {
      hall_id: parseInt(hallId),
      customer_id: parseInt(this.customerId),
      last_wash_date: lastWashDate
        ? convertPersianToGregorian(lastWashDate)
        : null,
      last_disinfect_date: lastDisinfectDate
        ? convertPersianToGregorian(lastDisinfectDate)
        : null,
      disinfectant_type: disinfectantType || null,
      description: description || null,
    };

    try {
      let response;
      if (this.isEditingHygiene && this.currentHygieneId) {
        response = await hatcheryApi.saveHygieneInfo(payload);
      } else {
        response = await hatcheryApi.saveHygieneInfo(payload);
      }

      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;

      if (response.success) {
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: this.isEditingHygiene
              ? "✅ اطلاعات بهداشتی بروزرسانی شد"
              : "✅ اطلاعات بهداشتی ذخیره شد",
            confirmButtonText: "باشه",
            confirmButtonColor: "#2c7a6e",
          });
        } else {
          notificationService.success("اطلاعات بهداشتی با موفقیت ذخیره شد");
        }

        this.isEditingHygiene = false;
        this.currentHygieneId = null;
        this.setEditModeBanner(false);
        saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره اطلاعات بهداشتی';

        await this.loadHygieneHistory();
        hatcheryFormService.resetHygieneForm();
      } else {
        notificationService.error(response.message || "خطا در ذخیره اطلاعات");
      }
    } catch (error) {
      console.error("❌ Error saving hygiene:", error);
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalText;
      notificationService.error(error.message);
    }
  }

  // ===== بارگذاری مساحت سالن =====

  async loadHallAreaForFlock(hallId) {
    try {
      const response = await hatcheryApi.getHallPhysicalInfo(hallId);
      if (response.success && response.data) {
        const area = parseFloat(response.data.area) || 0;
        const densityField = document.getElementById("skb-current-density");
        if (densityField) {
          densityField.dataset.area = area;
          densityField.value = area > 0 ? "در حال محاسبه..." : "مساحت ثبت نشده";
        }
        this.calculateDensity();
      } else {
        document.getElementById("skb-current-density").value = "مساحت ثبت نشده";
      }
    } catch (error) {
      console.error("❌ Error loading hall area:", error);
      document.getElementById("skb-current-density").value =
        "خطا در دریافت اطلاعات";
    }
  }

  calculateDensity() {
    const densityField = document.getElementById("skb-current-density");
    const chickCount =
      parseInt(document.getElementById("skb-chick-count")?.value) || 0;
    const area = parseFloat(densityField?.dataset?.area) || 0;

    if (area > 0 && chickCount > 0) {
      const density = (chickCount / area).toFixed(2);
      densityField.value = `${density} قطعه/مترمربع`;
    } else if (area > 0) {
      densityField.value = "تعداد جوجه را وارد کنید";
    }
  }

  // ===== تاریخچه بهداشت =====

  async loadHygieneHistory() {
    const tbody = document.getElementById("hygieneHistoryTableBody");
    if (!tbody) return;

    const hygieneRecords = [];
    for (const hall of this.halls) {
      try {
        const response = await hatcheryApi
          .getHygieneInfo(hall.id)
          .catch(() => ({ success: false, data: null }));
        if (response.success && response.data) {
          const records = Array.isArray(response.data)
            ? response.data
            : [response.data];
          records.forEach((record) => {
            hygieneRecords.push({
              ...record,
              hall_name: hall.hall_name,
              hall_id: hall.id,
            });
          });
        }
      } catch (e) {}
    }

    if (hygieneRecords.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align: center;">هیچ رکورد بهداشتی ثبت نشده است</td></tr>';
      return;
    }

    const html = hatcheryRenderer.renderHygieneHistory(hygieneRecords);
    tbody.innerHTML = html;
  }

  viewHygiene(id, hallId) {
    // یافتن رکورد از لیست
    const hall = this.halls.find((h) => h.id == hallId);
    if (!hall) {
      notificationService.error("اطلاعات سالن یافت نشد");
      return;
    }

    hatcheryApi.getHygieneInfo(hallId).then((response) => {
      if (response.success && response.data) {
        const records = Array.isArray(response.data)
          ? response.data
          : [response.data];
        const record = records.find((r) => r.id == id) || records[0];
        if (record) {
          const html = `
            <div style="direction:rtl; text-align:right; font-family:Vazir; padding:15px;">
              <h3 style="color:#2c7a6e; margin-bottom:15px;">اطلاعات بهداشت و ضدعفونی</h3>
              <div class="hall-info-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div class="hall-info-item"><span class="label" style="color:#94a3b8;">سالن</span><span class="value" style="font-weight:600;">${hall.hall_name}</span></div>
                <div class="hall-info-item"><span class="label" style="color:#94a3b8;">آخرین شستشو</span><span class="value">${record.last_wash_date ? convertToPersianDate(record.last_wash_date) : "-"}</span></div>
                <div class="hall-info-item"><span class="label" style="color:#94a3b8;">آخرین ضدعفونی</span><span class="value">${record.last_disinfect_date ? convertToPersianDate(record.last_disinfect_date) : "-"}</span></div>
                <div class="hall-info-item"><span class="label" style="color:#94a3b8;">نوع مواد ضدعفونی</span><span class="value">${record.disinfectant_type || "-"}</span></div>
                ${record.description ? `<div class="hall-info-item full-width" style="grid-column:1/-1;"><span class="label" style="color:#94a3b8;">توضیحات</span><span class="value">${record.description}</span></div>` : ""}
              </div>
            </div>
          `;

          if (typeof Swal !== "undefined") {
            Swal.fire({
              html: html,
              confirmButtonText: "بستن",
              confirmButtonColor: "#2c7a6e",
              width: "600px",
            });
          }
        }
      }
    });
  }

  editHygiene(id, hallId) {
    const hall = this.halls.find((h) => h.id == hallId);
    if (!hall) {
      notificationService.error("اطلاعات سالن یافت نشد");
      return;
    }

    hatcheryApi.getHygieneInfo(hallId).then((response) => {
      if (response.success && response.data) {
        const records = Array.isArray(response.data)
          ? response.data
          : [response.data];
        const record = records.find((r) => r.id == id) || records[0];
        if (record) {
          this.isEditingHygiene = true;
          this.currentHygieneId = id;

          // رفتن به تب بهداشت
          hatcheryTabsService.activateTab("chick-hygiene-info");

          // پر کردن فیلدها
          document.getElementById("chickHealthHallNumber").value = hallId;
          document.getElementById("chickLastWashDate").value =
            record.last_wash_date
              ? convertToPersianDate(record.last_wash_date)
              : "";
          document.getElementById("chickLastDisinfectDate").value =
            record.last_disinfect_date
              ? convertToPersianDate(record.last_disinfect_date)
              : "";
          document.getElementById("chickDisinfectMaterial").value =
            record.disinfectant_type || "";
          document.getElementById("chickHygieneDescription").value =
            record.description || "";

          // تغییر دکمه
          const saveBtn = document.querySelector(
            "#chickHygieneInfoTab .btn-primary",
          );
          if (saveBtn) {
            saveBtn.innerHTML =
              '<i class="fas fa-save"></i> بروزرسانی اطلاعات بهداشتی';
            saveBtn.style.background = "#f59e0b";
          }

          this.setEditModeBanner(true);

          notificationService.info("✏️ در حال ویرایش اطلاعات بهداشتی");
        }
      }
    });
  }

  // ===== فیلتر گله‌ها برای مدیریت هفتگی =====

  async loadFlocksForFilter() {
    const select = document.getElementById("filter-flock");
    if (!select) return;

    const activeFlocks = this.flocks.filter((f) => f.is_active === true);
    select.innerHTML = '<option value="">همه گله‌ها</option>';

    activeFlocks.forEach((flock) => {
      const option = document.createElement("option");
      option.value = flock.id;
      const hall = this.halls.find((h) => h.id === flock.hall_id);
      option.textContent = `گله ${flock.flock_number} - ${hall?.hall_name || "سالن"}`;
      select.appendChild(option);
    });
  }

  // ===== ویرایش =====

  async editPeriod(id) {
    try {
      const response = await hatcheryApi.getPeriod(id);
      if (!response.success) {
        notificationService.error("خطا در دریافت اطلاعات دوره");
        return;
      }

      const period = response.data;
      this.isEditingPeriod = true;
      this.currentPeriodId = id;

      hatcheryTabsService.activateTab("chick-period-info");

      document.getElementById("chickPeriodId").value =
        period.period_number || period.id;
      document.getElementById("chickPeriodName").value = period.period_name;
      document.getElementById("chickStartDate").value = convertToPersianDate(
        period.start_date,
      );
      // فیلد وضعیت حذف شده

      const saveBtn = document.querySelector(
        "#chickPeriodInfoTab .btn-primary",
      );
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> بروزرسانی دوره';
        saveBtn.style.background = "#f59e0b";
      }

      this.setEditModeBanner(true);
      notificationService.info("✏️ در حال ویرایش دوره");
    } catch (error) {
      console.error("❌ Error editing period:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  async editFlock(id) {
    try {
      const response = await hatcheryApi.getFlock(id);
      if (!response.success) {
        notificationService.error("خطا در دریافت اطلاعات گله");
        return;
      }

      const flock = response.data;
      this.isEditingFlock = true;
      this.currentFlockId = id;

      hatcheryTabsService.activateTab("chick-register");

      // پر کردن همه فیلدها از جمله سالن
      document.getElementById("skb-hall-select").value = flock.hall_id;
      document.getElementById("skb-unit-select").value = flock.unit_id || "";
      document.getElementById("skb-flock-number").value = flock.flock_number;
      document.getElementById("skb-chick-source").value =
        flock.chick_source_id || "";
      document.getElementById("skb-chick-breed").value = flock.breed_id || "";
      document.getElementById("skb-chick-age").value =
        flock.chick_age_on_arrival || 1;
      document.getElementById("skb-initial-weight").value =
        flock.avg_initial_weight || "";
      document.getElementById("skb-chick-count").value =
        flock.total_chicks_count || "";
      document.getElementById("skb-chick-date").value = convertToPersianDate(
        flock.placement_date,
      );

      // اطمینان از پر بودن فیلد سالن - اگر مقدار دارد ولی نمایشی خالی است
      const hallSelect = document.getElementById("skb-hall-select");
      if (hallSelect && flock.hall_id) {
        const exists = Array.from(hallSelect.options).some(
          (o) => o.value == flock.hall_id,
        );
        if (!exists) {
          const hall = this.halls.find((h) => h.id === flock.hall_id);
          if (hall) {
            const opt = document.createElement("option");
            opt.value = hall.id;
            opt.textContent = `${hall.hall_name} (ویرایش)`;
            hallSelect.appendChild(opt);
          }
        }
        hallSelect.value = flock.hall_id;
      }

      if (flock.hall_id) {
        await this.loadHallAreaForFlock(flock.hall_id);
      }

      const saveBtn = document.querySelector("#chickRegisterTab .btn-primary");
      if (saveBtn) {
        saveBtn.innerHTML = '<i class="fas fa-save"></i> بروزرسانی گله';
        saveBtn.style.background = "#f59e0b";
      }

      this.setEditModeBanner(true);
      notificationService.info("✏️ در حال ویرایش گله");
    } catch (error) {
      console.error("❌ Error editing flock:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ===== حذف =====

  async deletePeriod(id) {
    // پیدا کردن گله‌های مرتبط با این دوره
    const relatedFlocks = this.flocks.filter((f) => f.period_id === id);
    const flockCount = relatedFlocks.length;

    let confirmText = "آیا از حذف این دوره اطمینان دارید؟";
    if (flockCount > 0) {
      confirmText += `\n\n⚠️ ${flockCount} گله مرتبط با این دوره نیز حذف خواهند شد.`;
    }
    confirmText += "\nاین عملیات قابل بازگشت نیست.";

    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف دوره",
      text: confirmText,
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await hatcheryApi.deletePeriod(id);
      if (response.success) {
        if (typeof Swal !== "undefined") {
          const msg =
            flockCount > 0
              ? `✅ دوره و ${flockCount} گله مرتبط با موفقیت حذف شدند`
              : "✅ دوره با موفقیت حذف شد";
          Swal.fire({
            icon: "success",
            title: msg,
            confirmButtonText: "باشه",
            confirmButtonColor: "#2c7a6e",
          });
        } else {
          notificationService.success("دوره با موفقیت حذف شد");
        }
        await this.loadData();
        if (typeof window.refreshWeeksDisplay === "function") {
          await window.refreshWeeksDisplay();
        }
      } else {
        notificationService.error(response.message || "خطا در حذف دوره");
      }
    } catch (error) {
      console.error("❌ Error deleting period:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ===== تغییر وضعیت دوره =====
  async updatePeriodStatus(periodId, newStatus) {
    try {
      const statusLabels = {
        pending: "در انتظار جوجه",
        active: "فعال",
        completed: "تکمیل شده",
        cancelled: "لغو شده",
      };
      const response = await hatcheryApi.updatePeriod(periodId, {
        status: newStatus,
      });
      if (response.success) {
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "success",
            title: `✅ وضعیت دوره به "${statusLabels[newStatus] || newStatus}" تغییر کرد`,
            confirmButtonText: "باشه",
            confirmButtonColor: "#2c7a6e",
          });
        } else {
          notificationService.success("وضعیت دوره با موفقیت تغییر کرد");
        }
        await this.loadData();
      } else {
        notificationService.error(response.message || "خطا در تغییر وضعیت");
      }
    } catch (error) {
      console.error("❌ Error updating period status:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  async deleteFlock(id) {
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف گله",
      text: "آیا از حذف این گله اطمینان دارید؟",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await hatcheryApi.deleteFlock(id);
      if (response.success) {
        notificationService.success("گله با موفقیت حذف شد");
        await this.loadData();
        if (typeof window.refreshWeeksDisplay === "function") {
          await window.refreshWeeksDisplay();
        }
      } else {
        notificationService.error(response.message || "خطا در حذف گله");
      }
    } catch (error) {
      console.error("❌ Error deleting flock:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  async toggleFlockStatus(id) {
    try {
      const flock = this.flocks.find((f) => f.id === id);
      if (!flock) {
        notificationService.error("گله یافت نشد");
        return;
      }

      const newStatus = !flock.is_active;
      const actionText = newStatus ? "فعال" : "غیرفعال";

      const confirmed = await notificationService.confirm({
        title: `${actionText} سازی گله`,
        text: `آیا از ${actionText} سازی این گله اطمینان دارید؟`,
        confirmText: `بله، ${actionText} شود`,
        cancelText: "انصراف",
      });

      if (!confirmed) return;

      const response = await hatcheryApi.toggleFlockStatus(id, {
        is_active: newStatus,
      });
      if (response.success) {
        notificationService.success(`✅ وضعیت گله با موفقیت تغییر کرد`);
        await this.loadData();
        if (typeof window.refreshWeeksDisplay === "function") {
          await window.refreshWeeksDisplay();
        }
      } else {
        notificationService.error(response.message || "خطا در تغییر وضعیت");
      }
    } catch (error) {
      console.error("❌ Error toggling flock status:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  async deleteHygiene(id) {
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف رکورد بهداشتی",
      text: "آیا از حذف این رکورد اطمینان دارید؟",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });

    if (!confirmed) return;

    try {
      const response = await hatcheryApi.deleteHygieneRecord(id);
      if (response.success) {
        notificationService.success("رکورد بهداشتی با موفقیت حذف شد");
        await this.loadHygieneHistory();
      } else {
        notificationService.error(response.message || "خطا در حذف");
      }
    } catch (error) {
      console.error("❌ Error deleting hygiene:", error);
      notificationService.error("خطا در ارتباط با سرور");
    }
  }

  // ===== مشاهده جزئیات گله =====

  async viewFlockDetails(flockId) {
    try {
      const response = await hatcheryApi.getFlock(flockId);
      if (!response.success) {
        notificationService.error("خطا در دریافت اطلاعات گله");
        return;
      }

      const flock = response.data;
      const hall = this.halls.find((h) => h.id === flock.hall_id);
      const period = this.periods.find((p) => p.id === flock.period_id);
      const breed = this.dictionaries.breeds?.find(
        (b) => b.id === flock.breed_id,
      );
      const source = this.dictionaries.sources?.find(
        (s) => s.id === flock.chick_source_id,
      );

      const html = `
        <div style="direction:rtl; text-align:right; font-family:Vazir; padding:10px;">
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
            <div style="background:#f8fafc; padding:10px; border-radius:8px;">
              <h4 style="color:#2c7a6e; font-size:13px; margin:0 0 8px; border-bottom:2px solid #e8f5f0; padding-bottom:5px;">📋 اطلاعات پایه</h4>
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <tr><td style="padding:4px 6px; color:#94a3b8; width:100px;">شماره گله</td><td style="padding:4px 6px; font-weight:600;">${flock.flock_number}</td></tr>
                <tr><td style="padding:4px 6px; color:#94a3b8;">سالن</td><td style="padding:4px 6px; font-weight:600;">${hall?.hall_name || "-"}</td></tr>
                <tr><td style="padding:4px 6px; color:#94a3b8;">دوره</td><td style="padding:4px 6px; font-weight:600;">${period?.period_name || "-"}</td></tr>
                <tr><td style="padding:4px 6px; color:#94a3b8;">وضعیت</td><td style="padding:4px 6px;"><span style="background:${flock.is_active ? "#dcfce7" : "#fee2e2"}; color:${flock.is_active ? "#16a34a" : "#dc2626"}; padding:2px 10px; border-radius:10px; font-size:11px;">${flock.is_active ? "فعال" : "غیرفعال"}</span></td></tr>
              </table>
            </div>
            <div style="background:#f8fafc; padding:10px; border-radius:8px;">
              <h4 style="color:#2c7a6e; font-size:13px; margin:0 0 8px; border-bottom:2px solid #e8f5f0; padding-bottom:5px;">🐣 اطلاعات جوجه‌ریزی</h4>
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <tr><td style="padding:4px 6px; color:#94a3b8;">تاریخ جوجه‌ریزی</td><td style="padding:4px 6px; font-weight:600;">${convertToPersianDate(flock.placement_date)}</td></tr>
                <tr><td style="padding:4px 6px; color:#94a3b8;">نژاد</td><td style="padding:4px 6px; font-weight:600;">${breed?.name || flock.breed_id || "-"}</td></tr>
                <tr><td style="padding:4px 6px; color:#94a3b8;">مبدا</td><td style="padding:4px 6px; font-weight:600;">${source?.name || "-"}</td></tr>
                <tr><td style="padding:4px 6px; color:#94a3b8;">سن در بدو ورود</td><td style="padding:4px 6px; font-weight:600;">${flock.chick_age_on_arrival || "-"} روز</td></tr>
              </table>
            </div>
          </div>
          <div style="background:#f8fafc; padding:10px; border-radius:8px; margin-top:10px;">
            <h4 style="color:#2c7a6e; font-size:13px; margin:0 0 8px; border-bottom:2px solid #e8f5f0; padding-bottom:5px;">📊 آمار</h4>
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <tr><td style="padding:4px 6px; color:#94a3b8;">تعداد جوجه</td><td style="padding:4px 6px; font-weight:600;">${(flock.total_chicks_count || 0).toLocaleString()} قطعه</td></tr>
              <tr><td style="padding:4px 6px; color:#94a3b8;">وزن اولیه</td><td style="padding:4px 6px; font-weight:600;">${flock.avg_initial_weight || "-"} گرم</td></tr>
              <tr><td style="padding:4px 6px; color:#94a3b8;">تراکم</td><td style="padding:4px 6px; font-weight:600;">${flock.placement_density || "-"} قطعه/مترمربع</td></tr>
            </table>
          </div>
        </div>
      `;

      if (typeof Swal !== "undefined") {
        Swal.fire({
          html: html,
          title: `🐔 جزئیات گله ${flock.flock_number}`,
          confirmButtonText: "بستن",
          confirmButtonColor: "#2c7a6e",
          width: "650px",
        });
      }
    } catch (error) {
      console.error("❌ Error viewing flock details:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  // ===== رفرش =====

  refreshFlocks() {
    this.loadFlocks();
  }

  async completePeriod(periodId) {
    try {
      // پیدا کردن دوره
      const period = this.periods.find((p) => p.id === periodId);
      if (!period) {
        notificationService.error("دوره یافت نشد");
        return;
      }

      // گله‌های فعال این دوره
      const periodFlocks = this.flocks.filter(
        (f) => f.period_id === periodId && f.is_active === true,
      );

      if (periodFlocks.length === 0) {
        notificationService.warning("این دوره گله فعالی ندارد");
        return;
      }

      const flockOptions = periodFlocks
        .map(
          (f) =>
            `<label style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:#f8fafc; border-radius:8px; cursor:pointer; font-size:12.5px;">
              <input type="checkbox" class="completion-flock-check" value="${f.id}" checked>
              گله ${f.flock_number} - ${f.total_chicks_count?.toLocaleString() || "-"} قطعه
            </label>`,
        )
        .join("");

      const periodInfo = `
        <div style="background:linear-gradient(135deg,#2c7a6e,#035552); color:#fff; border-radius:12px; padding:14px 16px; margin-bottom:16px; display:flex; align-items:center; gap:12px;">
          <div style="width:42px; height:42px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:20px;">
            <i class="fas fa-flag-checkered"></i>
          </div>
          <div>
            <div style="font-size:15px; font-weight:800;">اتمام دوره ${period.period_number || ""} - ${period.period_name || ""}</div>
            <div style="font-size:11px; opacity:0.85;">${periodFlocks.length} گله فعال | تعداد کل: ${periodFlocks.reduce((s, f) => s + (f.total_chicks_count || 0), 0).toLocaleString()} قطعه</div>
          </div>
        </div>
      `;

      const formHtml = `
        ${periodInfo}
        <div style="text-align:right; font-family:'Vazir';">
          <style>
            .cf-field { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-family:'Vazir'; font-size:12.5px; margin-top:4px; box-sizing:border-box; transition:all .3s; }
            .cf-field:focus { outline:none; border-color:#2c7a6e; box-shadow:0 0 0 3px rgba(44,122,110,.1); }
            .cf-label { display:block; font-size:12px; font-weight:600; color:#1e293b; }
            .cf-section { background:#f8fafc; border-radius:12px; padding:12px 14px; margin-bottom:12px; border:1px solid #eef2f6; }
            .cf-section-title { font-size:12.5px; font-weight:700; color:#2c7a6e; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
            .cf-2col { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            .cf-3col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
          </style>

          <!-- انتخاب گله‌ها -->
          <div class="cf-section">
            <div class="cf-section-title"><i class="fas fa-egg"></i> انتخاب گله‌ها</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; max-height:130px; overflow-y:auto;">
              ${flockOptions}
            </div>
          </div>

          <!-- اطلاعات کشتارگاه -->
          <div class="cf-section">
            <div class="cf-section-title"><i class="fas fa-industry"></i> اطلاعات کشتارگاه</div>
            <div class="cf-2col">
              <div>
                <label class="cf-label">تاریخ کشتار</label>
                <input type="text" id="cfSlaughterDate" class="cf-field" placeholder="۱۴۰۴/۰۱/۰۱">
              </div>
              <div>
                <label class="cf-label">نام کشتارگاه</label>
                <input type="text" id="cfSlaughterhouseName" class="cf-field" placeholder="نام کشتارگاه...">
              </div>
            </div>
            <div class="cf-3col" style="margin-top:8px;">
              <div>
                <label class="cf-label">تلفات حمل</label>
                <input type="number" id="cfTransportMortality" class="cf-field" placeholder="0" value="0" min="0">
              </div>
              <div>
                <label class="cf-label">تعداد ارسالی</label>
                <input type="number" id="cfTotalSent" class="cf-field" placeholder="تعداد...">
              </div>
              <div>
                <label class="cf-label">وزن کل زنده (کیلوگرم)</label>
                <input type="number" step="0.01" id="cfTotalLiveWeight" class="cf-field" placeholder="0">
              </div>
            </div>
          </div>

          <!-- اطلاعات اعلامی مرغدار -->
          <div class="cf-section">
            <div class="cf-section-title"><i class="fas fa-user-tie"></i> اطلاعات اعلامی مرغدار</div>
            <div class="cf-2col">
              <div>
                <label class="cf-label">FCR اعلامی مرغدار</label>
                <input type="number" step="0.01" id="cfFarmerFcr" class="cf-field" placeholder="مثال: 1.85">
              </div>
              <div>
                <label class="cf-label">کل گوشت (کیلوگرم)</label>
                <input type="number" step="0.01" id="cfFarmerTotalMeat" class="cf-field" placeholder="0">
              </div>
              <div>
                <label class="cf-label">کل خوراک (کیلوگرم)</label>
                <input type="number" step="0.01" id="cfFarmerTotalFeed" class="cf-field" placeholder="0">
              </div>
              <div>
                <label class="cf-label">وزن کل (کیلوگرم)</label>
                <input type="number" step="0.01" id="cfFarmerTotalWeight" class="cf-field" placeholder="0">
              </div>
            </div>
          </div>

          <!-- تنظیمات -->
          <div class="cf-section">
            <div class="cf-section-title"><i class="fas fa-cogs"></i> تنظیمات پایان دوره</div>
            <div class="cf-2col">
              <div>
                <label class="cf-label">نوع پایان</label>
                <select id="cfCompletionType" class="cf-field">
                  <option value="completed">تکمیل</option>
                  <option value="culled">حذف</option>
                  <option value="emergency">اضطراری</option>
                </select>
              </div>
              <div style="display:flex; align-items:center; gap:8px; margin-top:20px;">
                <input type="checkbox" id="cfConfirmedByCustomer" style="width:16px;height:16px;">
                <label for="cfConfirmedByCustomer" class="cf-label" style="margin:0;">تأیید صحت اطلاعات توسط مرغدار</label>
              </div>
            </div>
            <div style="margin-top:8px;">
              <label class="cf-label">توضیحات</label>
              <textarea id="cfNotes" class="cf-field" rows="2" placeholder="توضیحات تکمیلی..."></textarea>
            </div>
          </div>
        </div>
      `;

      const result = await Swal.fire({
        title: "",
        html: formHtml,
        showCancelButton: true,
        confirmButtonText: "🏁 ثبت و پایان دوره",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#2c7a6e",
        cancelButtonColor: "#64748b",
        width: 650,
        padding: "20px 24px",
        didOpen: () => {
          // تقویم شمسی برای تاریخ کشتار
          const dateInput = document.getElementById("cfSlaughterDate");
          if (dateInput && typeof $.fn.persianDatepicker !== "undefined") {
            try {
              $(dateInput).persianDatepicker({
                format: "YYYY/MM/DD",
                autoClose: true,
                initialValue: false,
                observer: true,
                calendar: { persian: { locale: "fa" } },
              });
            } catch (e) {
              console.warn("⚠️ datepicker init error:", e);
            }
          }
        },
        preConfirm: () => {
          const selectedFlocks = Array.from(
            document.querySelectorAll(".completion-flock-check:checked"),
          ).map((cb) => parseInt(cb.value));

          if (selectedFlocks.length === 0) {
            Swal.showValidationMessage("حداقل یک گله را انتخاب کنید");
            return false;
          }

          const dateVal =
            document.getElementById("cfSlaughterDate")?.value?.trim() || "";
          const slaughterDate = dateVal
            ? convertPersianToGregorian(dateVal)
            : null;

          return {
            period_ids: [periodId],
            flock_ids: selectedFlocks,
            shared_data: {
              completion_date: new Date().toISOString().slice(0, 10),
              slaughter_date: slaughterDate,
              slaughterhouse_name:
                document
                  .getElementById("cfSlaughterhouseName")
                  ?.value?.trim() || null,
              transport_mortality:
                parseInt(
                  document.getElementById("cfTransportMortality")?.value,
                ) || 0,
              total_sent:
                parseInt(document.getElementById("cfTotalSent")?.value) || null,
              total_live_weight:
                parseFloat(
                  document.getElementById("cfTotalLiveWeight")?.value,
                ) || null,
              farmer_fcr:
                parseFloat(document.getElementById("cfFarmerFcr")?.value) ||
                null,
              farmer_total_meat:
                parseFloat(
                  document.getElementById("cfFarmerTotalMeat")?.value,
                ) || null,
              farmer_total_feed:
                parseFloat(
                  document.getElementById("cfFarmerTotalFeed")?.value,
                ) || null,
              farmer_total_weight:
                parseFloat(
                  document.getElementById("cfFarmerTotalWeight")?.value,
                ) || null,
              completion_type:
                document.getElementById("cfCompletionType")?.value ||
                "completed",
              confirmed_by_customer: !!document.getElementById(
                "cfConfirmedByCustomer",
              )?.checked,
              notes: document.getElementById("cfNotes")?.value?.trim() || null,
            },
          };
        },
      });

      if (result.isConfirmed && result.value) {
        notificationService.showLoading("در حال ثبت پایان دوره...");
        try {
          const response = await hatcheryApi.completePeriods(result.value);
          notificationService.hideLoading();
          if (response.success) {
            notificationService.success(
              `✅ ${response.message || "دوره با موفقیت پایان یافت"}`,
            );
            await this.loadData();
          } else {
            notificationService.error(
              response.message || "خطا در ثبت پایان دوره",
            );
          }
        } catch (e) {
          notificationService.hideLoading();
          console.error("❌ Error completing period:", e);
          notificationService.error("خطا در ارتباط با سرور");
        }
      }
    } catch (error) {
      console.error("❌ Error in completePeriod modal:", error);
      notificationService.error("خطا در نمایش فرم");
    }
  }
  // ===== مشاهده اطلاعات پایان دوره =====

  async viewPeriodCompletion(periodId) {
    try {
      const response = await hatcheryApi.getPeriodCompletions(periodId);
      if (!response.success) {
        notificationService.error("خطا در دریافت اطلاعات پایان دوره");
        return;
      }

      const completions = response.data || [];
      if (completions.length === 0) {
        notificationService.info(
          "اطلاعات پایان دوره‌ای برای این دوره ثبت نشده است",
        );
        return;
      }

      const rows = completions
        .map((c, i) => {
          const flock = c.flock || {};
          const hallName = flock.hall_name || `سالن ${c.hall_id || "-"}`;
          // محاسبه پویا برای رکوردهای قدیمی
          const initialChicks = parseInt(c.initial_chicks_count) || 0;
          const totalMortality = parseInt(c.total_mortality) || 0;
          const transportMortality = parseInt(c.transport_mortality) || 0;
          const systemMortality = Math.max(
            0,
            totalMortality - transportMortality,
          );
          const finalChicks = Math.max(0, initialChicks - totalMortality);
          const mortalityRate =
            initialChicks > 0
              ? ((totalMortality / initialChicks) * 100).toFixed(2)
              : "-";
          return `
            <tr style="border-bottom:1px solid #eef2f6;">
              <td style="padding:8px; text-align:center;">${i + 1}</td>
              <td style="padding:8px; text-align:center;"><strong>گله ${flock.flock_number || "-"}</strong></td>
              <td style="padding:8px; text-align:center;">${hallName}</td>
              <td style="padding:8px; text-align:center;">${convertToPersianDate(c.completion_date)}</td>
              <td style="padding:8px; text-align:center;">${initialChicks.toLocaleString() || "-"}</td>
              <td style="padding:8px; text-align:center;"><strong>${finalChicks.toLocaleString()}</strong></td>
              <td style="padding:8px; text-align:center;">${systemMortality}</td>
              <td style="padding:8px; text-align:center;">${transportMortality}</td>
              <td style="padding:8px; text-align:center;"><strong style="color:#dc2626;">${totalMortality}</strong></td>
              <td style="padding:8px; text-align:center;">${mortalityRate}٪</td>
              <td style="padding:8px; text-align:center;">${c.system_total_feed ?? "-"}</td>
              <td style="padding:8px; text-align:center;">${c.system_last_weight ?? "-"}</td>
              <td style="padding:8px; text-align:center;"><strong style="color:#d97706;">${c.system_fcr ?? c.farmer_fcr ?? "-"}</strong></td>
              <td style="padding:8px; text-align:center;">${c.slaughter_age_days ? c.slaughter_age_days + " روز" : "-"}</td>
              <td style="padding:8px; text-align:center;">${c.total_live_weight ?? "-"}</td>
              <td style="padding:8px; text-align:center;">${c.avg_live_weight ?? "-"}</td>
              <td style="padding:8px; text-align:center;">${c.slaughterhouse_name || "-"}</td>
              <td style="padding:8px; text-align:center;">${c.slaughter_date ? convertToPersianDate(c.slaughter_date) : "-"}</td>
            </tr>
          `;
        })
        .join("");

      Swal.fire({
        title: "",
        html: `
          <div style="text-align:right; font-family:'Vazir'; direction:rtl;">
            <div style="background:linear-gradient(135deg,#2c7a6e,#035552); color:#fff; border-radius:12px; padding:14px 16px; margin-bottom:16px; display:flex; align-items:center; gap:12px;">
              <div style="width:42px; height:42px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:20px;">
                <i class="fas fa-file-alt"></i>
              </div>
              <div>
                <div style="font-size:15px; font-weight:800;">اطلاعات پایان دوره</div>
                <div style="font-size:11px; opacity:0.85;">${completions.length} گله تکمیل‌شده</div>
              </div>
            </div>
            <div style="overflow-x:auto; max-height:400px; overflow-y:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:12px;">
                <thead style="position:sticky; top:0; background:#f8fafc;">
                  <tr>
                    <th style="padding:8px;">#</th>
                    <th style="padding:8px;">گله</th>
                    <th style="padding:8px;">سالن</th>
                    <th style="padding:8px;">تاریخ</th>
                    <th style="padding:8px;">جوجه اولیه</th>
                    <th style="padding:8px;">جوجه نهایی</th>
                    <th style="padding:8px;">تلفات سیستم</th>
                    <th style="padding:8px;">تلفات حمل</th>
                    <th style="padding:8px;">تلفات کل</th>
                    <th style="padding:8px;">٪ تلفات</th>
                    <th style="padding:8px;">خوراک</th>
                    <th style="padding:8px;">وزن</th>
                    <th style="padding:8px;">FCR</th>
                    <th style="padding:8px;">سن کشتار</th>
                    <th style="padding:8px;">وزن کشتار</th>
                    <th style="padding:8px;">میانگین</th>
                    <th style="padding:8px;">کشتارگاه</th>
                    <th style="padding:8px;">تاریخ کشتار</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "✏️ ویرایش",
        cancelButtonText: "بستن",
        confirmButtonColor: "#2c7a6e",
        cancelButtonColor: "#64748b",
        width: 900,
        padding: "20px 24px",
      }).then((result) => {
        if (result.isConfirmed) {
          this.editPeriodCompletion(periodId);
        }
      });
    } catch (error) {
      console.error("❌ Error viewing period completion:", error);
      notificationService.error("خطا در دریافت اطلاعات");
    }
  }

  // ===== ویرایش اطلاعات پایان دوره =====

  async editPeriodCompletion(periodId) {
    try {
      const response = await hatcheryApi.getPeriodCompletions(periodId);
      if (!response.success || !response.data || response.data.length === 0) {
        notificationService.error("اطلاعات پایان دوره یافت نشد");
        return;
      }

      const completions = response.data; // ممکن است چند گله باشد — اولی را پیش‌فرض می‌گیریم

      // فیلدهای اولین گله را برای نمایش پیش‌فرض پر کن
      const c = completions[0];
      const flock = c.flock || {};

      // محاسبه پویا برای رکوردهای قدیمی (جوجه نهایی و تلفات)
      const editInitialChicks = parseInt(c.initial_chicks_count) || 0;
      const editTotalMortality = parseInt(c.total_mortality) || 0;
      const editTransportMortality = parseInt(c.transport_mortality) || 0;
      const editFinalChicks = Math.max(
        0,
        editInitialChicks - editTotalMortality,
      );
      const editMortalityRate =
        editInitialChicks > 0
          ? ((editTotalMortality / editInitialChicks) * 100).toFixed(2)
          : "";

      const formHtml = `
        <div style="text-align:right; font-family:'Vazir'; direction:rtl;">
          <style>
            .ue-field { width:100%; padding:8px 12px; border:1.5px solid #e2e8f0; border-radius:10px; font-family:'Vazir'; font-size:12.5px; margin-top:4px; box-sizing:border-box; }
            .ue-field:focus { outline:none; border-color:#2c7a6e; box-shadow:0 0 0 3px rgba(44,122,110,.1); }
            .ue-label { display:block; font-size:12px; font-weight:600; color:#1e293b; }
            .ue-section { background:#f8fafc; border-radius:12px; padding:12px 14px; margin-bottom:12px; border:1px solid #eef2f6; }
            .ue-section-title { font-size:12.5px; font-weight:700; color:#2c7a6e; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
            .ue-2col { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
            .ue-3col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
          </style>

          <div style="background:linear-gradient(135deg,#2c7a6e,#035552); color:#fff; border-radius:12px; padding:14px 16px; margin-bottom:16px; display:flex; align-items:center; gap:12px; position:relative;">
            <div style="width:42px; height:42px; border-radius:50%; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; font-size:20px;">
              <i class="fas fa-pen"></i>
            </div>
            <div>
              <div style="font-size:15px; font-weight:800;">ویرایش اطلاعات پایان دوره</div>
              <div style="font-size:11px; opacity:0.85;">گله ${flock.flock_number || "-"} | ${completions.length} گله</div>
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
            <button type="button" id="ueRecomputeBtn"
              style="padding:8px 18px; background:#d97706; color:#fff; border:none; border-radius:10px; font-family:'Vazir'; font-size:12.5px; font-weight:600; cursor:pointer; transition:all .3s; display:flex; align-items:center; gap:6px;">
              <i class="fas fa-sync-alt" id="ueRecomputeIcon"></i> محاسبه مجدد فیلدهای سیستمی
            </button>
          </div>

          <!-- فیلدهای سیستمی -->
          <div class="ue-section">
            <div class="ue-section-title"><i class="fas fa-calculator"></i> فیلدهای سیستمی (قابل ویرایش)</div>
            <div class="ue-3col">
              <div>
                <label class="ue-label">جوجه اولیه</label>
                <input type="number" id="ueInitialChicks" class="ue-field" value="${editInitialChicks || ""}">
              </div>
              <div>
                <label class="ue-label">جوجه نهایی</label>
                <input type="number" id="ueFinalChicks" class="ue-field" value="${editFinalChicks || ""}">
              </div>
              <div>
                <label class="ue-label">هفته آخر</label>
                <input type="number" id="ueFinalWeek" class="ue-field" value="${c.final_week_number ?? ""}">
              </div>
              <div>
                <label class="ue-label">کل خوراک</label>
                <input type="number" step="0.01" id="ueTotalFeed" class="ue-field" value="${c.system_total_feed ?? c.total_feed_intake ?? ""}">
              </div>
              <div>
                <label class="ue-label">آخرین وزن</label>
                <input type="number" step="0.01" id="ueLastWeight" class="ue-field" value="${c.system_last_weight ?? c.final_avg_weight ?? ""}">
              </div>
              <div>
                <label class="ue-label">FCR سیستمی</label>
                <input type="number" step="0.01" id="ueSystemFcr" class="ue-field" value="${c.system_fcr ?? ""}">
              </div>
              <div>
                <label class="ue-label">تلفات کل (سیستم + حمل)</label>
                <input type="number" id="ueTotalMortality" class="ue-field" value="${editTotalMortality || ""}">
              </div>
              <div>
                <label class="ue-label">درصد تلفات</label>
                <input type="number" step="0.01" id="ueMortalityRate" class="ue-field" value="${editMortalityRate}">
              </div>
              <div>
                <label class="ue-label">سن کشتار (روز)</label>
                <input type="number" id="ueSlaughterAge" class="ue-field" value="${c.slaughter_age_days ?? ""}">
              </div>
            </div>
          </div>

          <!-- اطلاعات کشتارگاه -->
          <div class="ue-section">
            <div class="ue-section-title"><i class="fas fa-industry"></i> اطلاعات کشتارگاه</div>
            <div class="ue-2col">
              <div>
                <label class="ue-label">تاریخ کشتار</label>
                <input type="text" id="ueSlaughterDate" class="ue-field" placeholder="۱۴۰۴/۰۱/۰۱" value="${c.slaughter_date ? convertToPersianDate(c.slaughter_date) : ""}">
              </div>
              <div>
                <label class="ue-label">نام کشتارگاه</label>
                <input type="text" id="ueSlaughterhouse" class="ue-field" value="${c.slaughterhouse_name ?? ""}">
              </div>
              <div>
                <label class="ue-label">تلفات حمل</label>
                <input type="number" id="ueTransportMortality" class="ue-field" value="${c.transport_mortality ?? 0}">
              </div>
              <div>
                <label class="ue-label">تعداد ارسالی</label>
                <input type="number" id="ueTotalSent" class="ue-field" value="${c.total_sent ?? ""}">
              </div>
              <div>
                <label class="ue-label">وزن کل زنده</label>
                <input type="number" step="0.01" id="ueTotalLiveWeight" class="ue-field" value="${c.total_live_weight ?? ""}">
              </div>
              <div>
                <label class="ue-label">میانگین وزن</label>
                <input type="number" step="0.01" id="ueAvgLiveWeight" class="ue-field" value="${c.avg_live_weight ?? ""}">
              </div>
            </div>
          </div>

          <!-- اطلاعات اعلامی مرغدار -->
          <div class="ue-section">
            <div class="ue-section-title"><i class="fas fa-user-tie"></i> اطلاعات اعلامی مرغدار</div>
            <div class="ue-2col">
              <div>
                <label class="ue-label">FCR مرغدار</label>
                <input type="number" step="0.01" id="ueFarmerFcr" class="ue-field" value="${c.farmer_fcr ?? ""}">
              </div>
              <div>
                <label class="ue-label">کل گوشت (کیلوگرم)</label>
                <input type="number" step="0.01" id="ueFarmerMeat" class="ue-field" value="${c.farmer_total_meat ?? ""}">
              </div>
              <div>
                <label class="ue-label">کل خوراک (کیلوگرم)</label>
                <input type="number" step="0.01" id="ueFarmerFeed" class="ue-field" value="${c.farmer_total_feed ?? ""}">
              </div>
              <div>
                <label class="ue-label">وزن کل (کیلوگرم)</label>
                <input type="number" step="0.01" id="ueFarmerWeight" class="ue-field" value="${c.farmer_total_weight ?? ""}">
              </div>
            </div>
          </div>

          <!-- تنظیمات -->
          <div class="ue-section">
            <div class="ue-section-title"><i class="fas fa-cogs"></i> تنظیمات</div>
            <div class="ue-2col">
              <div>
                <label class="ue-label">نوع پایان</label>
                <select id="ueCompletionType" class="ue-field">
                  <option value="completed" ${c.completion_type === "completed" ? "selected" : ""}>تکمیل</option>
                  <option value="culled" ${c.completion_type === "culled" ? "selected" : ""}>حذف</option>
                  <option value="emergency" ${c.completion_type === "emergency" ? "selected" : ""}>اضطراری</option>
                </select>
              </div>
              <div style="display:flex; align-items:center; gap:8px; margin-top:20px;">
                <input type="checkbox" id="ueConfirmed" style="width:16px;height:16px;" ${c.confirmed_by_customer ? "checked" : ""}>
                <label for="ueConfirmed" class="ue-label" style="margin:0;">تأیید مرغدار</label>
              </div>
            </div>
            <div style="margin-top:8px;">
              <label class="ue-label">توضیحات</label>
              <textarea id="ueNotes" class="ue-field" rows="2">${c.notes ?? ""}</textarea>
            </div>
          </div>

          <input type="hidden" id="ueCompletionId" value="${c.id}">
        </div>
      `;

      const result = await Swal.fire({
        title: "",
        html: formHtml,
        showCancelButton: true,
        confirmButtonText: "💾 ذخیره تغییرات",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#2c7a6e",
        cancelButtonColor: "#64748b",
        width: 720,
        padding: "20px 24px",
        didOpen: () => {
          // دکمه محاسبه مجدد
          const recomputeBtn = document.getElementById("ueRecomputeBtn");
          if (recomputeBtn) {
            recomputeBtn.addEventListener("click", () => {
              const icon = document.getElementById("ueRecomputeIcon");
              if (icon) icon.classList.add("fa-spin");

              const requestedFields = this.recomputeSystemFields(
                c.id,
                completions,
              );
              // Promise را مدیریت می‌کنیم
              requestedFields.then(() => {
                if (icon) icon.classList.remove("fa-spin");
              });
            });
          }

          // تقویم شمسی
          const dateInput = document.getElementById("ueSlaughterDate");
          if (dateInput && typeof $.fn.persianDatepicker !== "undefined") {
            try {
              $(dateInput).persianDatepicker({
                format: "YYYY/MM/DD",
                autoClose: true,
                initialValue: false,
                observer: true,
              });
            } catch (e) {
              console.warn("⚠️ datepicker init error:", e);
            }
          }
        },
        preConfirm: () => {
          const completionId = document.getElementById("ueCompletionId")?.value;
          if (!completionId) {
            Swal.showValidationMessage("شناسه پایان دوره یافت نشد");
            return false;
          }

          const dateVal =
            document.getElementById("ueSlaughterDate")?.value?.trim() || "";
          const slaughterDate = dateVal
            ? convertPersianToGregorian(dateVal)
            : null;

          return {
            id: parseInt(completionId),
            data: {
              recompute: true,
              initial_chicks_count:
                document.getElementById("ueInitialChicks")?.value || null,
              final_chicks_count:
                document.getElementById("ueFinalChicks")?.value || null,
              final_week_number:
                document.getElementById("ueFinalWeek")?.value || null,
              total_feed_intake:
                document.getElementById("ueTotalFeed")?.value || null,
              system_total_feed:
                document.getElementById("ueTotalFeed")?.value || null,
              system_last_weight:
                document.getElementById("ueLastWeight")?.value || null,
              final_avg_weight:
                document.getElementById("ueLastWeight")?.value || null,
              system_fcr: document.getElementById("ueSystemFcr")?.value || null,
              total_mortality:
                document.getElementById("ueTotalMortality")?.value || null,
              mortality_rate:
                document.getElementById("ueMortalityRate")?.value || null,
              slaughter_age_days:
                document.getElementById("ueSlaughterAge")?.value || null,
              slaughter_date: slaughterDate,
              slaughterhouse_name:
                document.getElementById("ueSlaughterhouse")?.value?.trim() ||
                null,
              transport_mortality:
                document.getElementById("ueTransportMortality")?.value || 0,
              total_sent: document.getElementById("ueTotalSent")?.value || null,
              total_live_weight:
                document.getElementById("ueTotalLiveWeight")?.value || null,
              avg_live_weight:
                document.getElementById("ueAvgLiveWeight")?.value || null,
              farmer_fcr: document.getElementById("ueFarmerFcr")?.value || null,
              farmer_total_meat:
                document.getElementById("ueFarmerMeat")?.value || null,
              farmer_total_feed:
                document.getElementById("ueFarmerFeed")?.value || null,
              farmer_total_weight:
                document.getElementById("ueFarmerWeight")?.value || null,
              completion_type:
                document.getElementById("ueCompletionType")?.value ||
                "completed",
              confirmed_by_customer:
                !!document.getElementById("ueConfirmed")?.checked,
              notes: document.getElementById("ueNotes")?.value?.trim() || null,
            },
          };
        },
      });

      if (result.isConfirmed && result.value) {
        notificationService.showLoading("در حال ذخیره تغییرات...");
        try {
          const { id, data } = result.value;
          const updateRes = await hatcheryApi.updateCompletion(id, data);
          notificationService.hideLoading();
          if (updateRes.success) {
            notificationService.success("✅ اطلاعات پایان دوره بروزرسانی شد");
            await this.loadData();
          } else {
            notificationService.error(updateRes.message || "خطا در بروزرسانی");
          }
        } catch (e) {
          notificationService.hideLoading();
          console.error("❌ Error updating completion:", e);
          notificationService.error("خطا در ارتباط با سرور");
        }
      }
    } catch (error) {
      console.error("❌ Error in editPeriodCompletion:", error);
      notificationService.error("خطا در نمایش فرم ویرایش");
    }
  }

  // ===== محاسبه مجدد فیلدهای سیستمی از داده‌های هفتگی =====

  async recomputeSystemFields(completionId, completions) {
    try {
      // دریافت اطلاعات کامل رکورد (شامل chick_placement_id)
      const comp =
        completions.find((x) => x.id === completionId) || completions[0];
      if (!comp || !comp.chick_placement_id) {
        notificationService.error("شناسه گله یافت نشد");
        return;
      }

      // درخواست محاسبه مجدد از سمت سرور با دریافت رکورد به‌روزشده
      const response = await hatcheryApi.getFlockCompletion(
        comp.chick_placement_id,
      );
      if (!response.success || !response.data) {
        notificationService.error("خطا در دریافت اطلاعات گله");
        return;
      }

      const data = response.data;
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== null && val !== undefined) el.value = val;
      };

      setVal("ueInitialChicks", data.initial_chicks_count);
      setVal("ueFinalChicks", data.final_chicks_count);
      setVal("ueFinalWeek", data.final_week_number);
      setVal("ueTotalFeed", data.system_total_feed ?? data.total_feed_intake);
      setVal("ueLastWeight", data.system_last_weight ?? data.final_avg_weight);
      setVal("ueSystemFcr", data.system_fcr);
      setVal("ueTotalMortality", data.total_mortality);
      setVal("ueMortalityRate", data.mortality_rate);
      setVal("ueSlaughterAge", data.slaughter_age_days);

      notificationService.success("✅ فیلدهای سیستمی محاسبه مجدد شدند");
    } catch (error) {
      console.error("❌ Error recomputing system fields:", error);
      notificationService.error("خطا در محاسبه مجدد");
    }
  }

  refresh() {
    this.loadData();
    this.setupTabs();
    this.setupEvents();
  }

  // ===== ابزارهای کمکی =====

  getPeriods() {
    return this.periods;
  }

  getFlocks() {
    return this.flocks;
  }

  getHalls() {
    return this.halls;
  }

  getDictionaries() {
    return this.dictionaries;
  }
}

export const hatcheryService = new HatcheryService();

if (typeof window !== "undefined") {
  window.hatcheryService = hatcheryService;
  window.HatcheryService = HatcheryService;
  window.refreshHatcheryManagement = () => hatcheryService.refresh();
  window.loadAllPeriodsList = () => hatcheryService.loadAllPeriodsList();
  window.refreshChickList = () => hatcheryService.loadFlocks();
  window.loadChickPeriodsList = () => hatcheryService.loadFlocks();
  window.loadAllHygieneHistory = () => hatcheryService.loadHygieneHistory();
  window.saveChickPeriodInfo = () => hatcheryService.savePeriod();
  window.saveChickRegister = () => hatcheryService.saveFlock();
  window.saveChickHygieneInfo = () => hatcheryService.saveHygiene();
  window.resetChickPeriodTab = () => hatcheryFormService.resetPeriodForm();
  window.resetChickRegisterTab = () => hatcheryFormService.resetFlockForm();
  window.resetChickHygieneTab = () => hatcheryFormService.resetHygieneForm();
  window.viewPeriod = (id) => hatcheryService.viewPeriod?.(id);
  window.editPeriod = (id) => hatcheryService.editPeriod(id);
  window.deletePeriod = (id) => hatcheryService.deletePeriod(id);
  window.completePeriod = (id) => hatcheryService.completePeriod(id);
  window.viewPeriodCompletion = (id) =>
    hatcheryService.viewPeriodCompletion(id);
  window.editPeriodCompletion = (id) =>
    hatcheryService.editPeriodCompletion(id);
  window.editFlock = (id) => hatcheryService.editFlock(id);
  window.deleteFlock = (id) => hatcheryService.deleteFlock(id);
  window.toggleFlockStatus = (id) => hatcheryService.toggleFlockStatus(id);
  window.loadHallAreaForChick = (id) =>
    hatcheryService.loadHallAreaForFlock(id);
  window.calculateDensity = () => hatcheryService.calculateDensity();
  window.generateChickReport = async () => {
    try {
      const { hatcheryReport } = await import("./hatchery.report.js");
      await hatcheryReport.generateAndPrint();
    } catch (error) {
      console.error("❌ Error generating chick report:", error);
      notificationService.error("خطا در تولید گزارش");
    }
  };
  window.viewFlockDetails = (id) => hatcheryService.viewFlockDetails(id);
  window.viewHygieneRecord = (id, hallId) =>
    hatcheryService.viewHygiene(id, hallId);
  window.editHygieneRecord = (id, hallId) =>
    hatcheryService.editHygiene(id, hallId);
  window.deleteHygieneRecord = (id) => hatcheryService.deleteHygiene(id);
}
