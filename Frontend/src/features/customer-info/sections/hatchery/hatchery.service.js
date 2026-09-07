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
    this.currentUnitId = null;
    this.activeFlock = null;
    this.activeFlocks = null;
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
      // بروزرسانی پنل وضعیت گله و سالن‌های قابل افزودن
      this.refreshFlockPanel();
      this.refreshExtraHalls();
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

    // گروه‌بندی بر اساس «گله/دوره» (چند سالن عضو = یک رکورد)
    const groupMap = new Map();
    this.flocks.forEach((flock) => {
      const hall = this.halls.find((h) => h.id === flock.hall_id);
      const period = this.periods.find((p) => p.id === flock.period_id);
      const breed = this.dictionaries.breeds.find(
        (b) => b.id === flock.breed_id,
      );

      const key = flock.flock_id ? `f${flock.flock_id}` : `p${flock.id}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          flockId: flock.flock_id || null,
          primaryId: flock.id,
          flock_number: flock.flock_number,
          period_number: period?.period_number || "—",
          placement_date: flock.placement_date || null,
          is_active: !!flock.is_active,
          total: 0,
          hallNames: [],
          breeds: new Set(),
          hallCount: 0,
        });
      }
      const g = groupMap.get(key);
      const hallName =
        hall?.hall_name || (flock.hall_id ? `سالن ${flock.hall_id}` : "");
      if (hallName && !g.hallNames.includes(hallName)) {
        g.hallNames.push(hallName);
      }
      if (breed?.name) g.breeds.add(breed.name);
      g.total += Number(flock.total_chicks_count) || 0;
      g.hallCount++;
      if (flock.is_active) g.is_active = true;
      if (
        flock.placement_date &&
        (!g.placement_date || flock.placement_date < g.placement_date)
      ) {
        g.placement_date = flock.placement_date;
      }
    });

    const groups = Array.from(groupMap.values()).map((g) => ({
      ...g,
      hallNames: g.hallNames.join("، "),
      breed_names: Array.from(g.breeds).join("، ") || "—",
      total_chicks_count: g.total,
    }));

    const html = hatcheryRenderer.renderFlockGroupsTable(groups);
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
    // در این نسخه هر گله ثبت‌شده خودش «دوره فعال» محسوب می‌شود،
    // بنابراین نیازی به تعریف دوره جداگانه نیست و این گیت حذف شده است
    // تا کاربر بتواند مستقیماً جوجه‌ریزی (گله) را ثبت کند.
    return;
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
    const placementDate = document.getElementById("skb-chick-date")?.value;
    const chickSource = document.getElementById("skb-chick-source")?.value;
    const breedId = document.getElementById("skb-chick-breed")?.value;
    const chickAge = document.getElementById("skb-chick-age")?.value;
    const initialWeight = document.getElementById("skb-initial-weight")?.value;
    const totalLoad = document.getElementById("skb-total-load")?.value;
    const chickCount = document.getElementById("skb-chick-count")?.value;

    const flockData = {
      hall_id: hallId,
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

    // استخراج unit_id از سالن انتخاب‌شده — هر سالن به یک واحد تعلق دارد
    const selectedHall = this.halls.find((h) => h.id == hallId);
    const unitId = selectedHall?.unit_id || null;

    // شماره گله: اگر فیلد خالی بود، ارسال نمی‌شود تا سرور خودش (بر اساس گله/واحد) درج کند
    const flockNumberValue =
      document.getElementById("skb-flock-number")?.value;
    const parsedFlockNumber = flockNumberValue
      ? parseInt(flockNumberValue)
      : 0;

    // انتخاب گله: پیوستن به گله مشخص / شروع گله جدید / خودکار
    const flockJoinValue =
      document.getElementById("skb-flock-join")?.value || "";
    const attachFlockId =
      flockJoinValue && flockJoinValue !== "new"
        ? parseInt(flockJoinValue)
        : null;
    const startNewFlock = flockJoinValue === "new";

    const payload = {
      customer_id: parseInt(this.customerId),
      unit_id: unitId ? parseInt(unitId) : null,
      hall_id: parseInt(hallId),
      placement_date: gregorianDate,
      flock_id: attachFlockId || undefined,
      start_new_flock: startNewFlock || undefined,
      // undefined → هنگام JSON.stringify حذف می‌شود؛ سرور خودکار شماره می‌دهد
      flock_number:
        parsedFlockNumber > 0 ? parsedFlockNumber : undefined,
      chick_source_id: chickSource ? parseInt(chickSource) : null,
      breed_id: breedId ? parseInt(breedId) : null,
      chick_age_on_arrival: parseInt(chickAge) || 1,
      avg_initial_weight: initialWeight || null,
      total_chicks_count: parseInt(chickCount) || 0,
      placement_density: density,
    };

    // جمع‌آوری سالن‌های اضافه همان گله (فقط در حالت ثبت جدید)
    const extraJobs =
      this.isEditingFlock && this.currentFlockId
        ? []
        : this.collectExtraHalls(parseInt(payload.total_chicks_count) || 0);

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
        // ثبت سالن‌های اضافه زیر همان گله (پس از موفقیت سالن اصلی)
        let extraCreated = 0;
        if (!this.isEditingFlock && extraJobs.length > 0) {
          for (const job of extraJobs) {
            if (!job.total_chicks_count || job.total_chicks_count < 1) {
              throw new Error(
                `برای سالن «${job.hall_name}» تعداد جوجه وارد نشده است`,
              );
            }
            // ثبت سالن‌های اضافه زیر همان گله‌ای که سالن اصلی به آن پیوست
            // (هم‌نوبت اصلی یا گله جدید ساخته‌شده)
            const extraDate = job.date_raw
              ? convertPersianToGregorian(job.date_raw) ||
                payload.placement_date
              : payload.placement_date;
            const extraRes = await hatcheryApi.createFlock({
              customer_id: payload.customer_id,
              unit_id: payload.unit_id,
              hall_id: job.hall_id,
              placement_date: extraDate,
              flock_id: response.data?.flock_id || undefined,
              chick_source_id: payload.chick_source_id,
              breed_id: payload.breed_id,
              chick_age_on_arrival: payload.chick_age_on_arrival,
              avg_initial_weight: payload.avg_initial_weight,
              total_chicks_count: job.total_chicks_count,
              placement_density: null,
            });
            if (!extraRes.success) {
              throw new Error(
                `ثبت جوجه‌ریزی سالن «${job.hall_name}» ناموفق بود: ${extraRes.message || ""}`,
              );
            }
            extraCreated++;
          }
        }

        const summaryItems = [
          response.data?.flock_number
            ? `شماره گله: ${response.data.flock_number}`
            : payload.flock_number
              ? `شماره گله: ${payload.flock_number}`
              : null,
          payload.total_chicks_count
            ? `تعداد جوجه سالن اصلی: ${payload.total_chicks_count.toLocaleString()} قطعه`
            : null,
          extraCreated > 0
            ? `افزودن به ${extraCreated} سالن دیگر زیر همین گله`
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

        // بستن حالت ویرایش - قبل از loadData
        this.isEditingFlock = false;
        this.currentFlockId = null;
        this.setEditModeBanner(false);
        saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره جوجه ریزی';
        saveBtn.style.background = "";
        saveBtn.dataset.mode = "";

        await this.loadData();
        hatcheryFormService.resetFlockForm();
        this.refreshFlockPanel();
        this.refreshExtraHalls();

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
      // همگام‌سازی مجدد برای نمایش وضعیت واقعی
      this.refreshFlockPanel();
      this.refreshExtraHalls();
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
    // بروزرسانی پنل گله و سالن‌های قابل افزودن بر اساس سالن انتخاب‌شده
    this.refreshFlockPanel();
    this.refreshExtraHalls();
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

  // ===== پنل وضعیت گله (دوره پرورش واحد) =====

  async refreshFlockPanel() {
    const panel = document.getElementById("flockStatusPanel");
    if (!panel) return;
    const flockNumberField = document.getElementById("skb-flock-number");
    try {
      const hallSelect = document.getElementById("skb-hall-select");
      let hallId = hallSelect ? parseInt(hallSelect.value) : null;
      let hall = hallId
        ? this.halls.find((h) => parseInt(h.id) === hallId)
        : null;
      if (!hall && this.halls.length > 0) hall = this.halls[0];

      if (!hall) {
        this.activeFlock = null;
        panel.innerHTML =
          '<div class="flock-panel flock-empty"><div class="flock-empty-text"><i class="fas fa-info-circle"></i> ابتدا سالنی برای این مشتری تعریف کنید تا وضعیت گله نمایش داده شود.</div></div>';
        return;
      }

      const unitId = hall.unit_id;
      if (!unitId) {
        this.activeFlock = null;
        panel.innerHTML =
          '<div class="flock-panel flock-empty"><div class="flock-empty-text"><i class="fas fa-info-circle"></i> سالن انتخاب‌شده به واحدی متصل نیست.</div></div>';
        return;
      }
      this.currentUnitId = unitId;

      const unit = this.periods.find(
        (p) => parseInt(p.id) === parseInt(unitId),
      );
      const unitName = unit?.unit_name || hall.unit_name || `واحد ${unitId}`;

      const response = await hatcheryApi.getFlocksByUnit(unitId, {
        status: "active",
      });
      const flocks =
        response.success && Array.isArray(response.data?.flocks)
          ? response.data.flocks
          : [];
      this.activeFlocks = flocks;

      // پیش‌فرض عملیات بدون id = اولین گله دارای سالن فعال
      const defaultFlock =
        flocks.find((f) => (f.placements || []).some((p) => p.is_active)) ||
        flocks[0] ||
        null;
      this.activeFlock = defaultFlock;

      // نمایش چند گله فعال (هر گله یک کارت با عملیات مستقل)
      panel.innerHTML = flocks.length
        ? flocks
            .map((f) =>
              hatcheryRenderer.renderFlockPanel(unitName, f, f.placements || []),
            )
            .join('<div class="flock-panel-gap"></div>')
        : hatcheryRenderer.renderFlockPanel(unitName, null, []);

      // نمایش شماره گله در فرم ثبت (پیش‌نمایش پیوستن)
      if (flockNumberField) {
        flockNumberField.value = defaultFlock ? defaultFlock.flock_number : "";
        flockNumberField.placeholder = defaultFlock
          ? ""
          : "خودکار (پس از ثبت)";
      }

      this.refreshFlockJoinSelect(flocks);
    } catch (error) {
      console.error("❌ Error loading flock panel:", error);
      panel.innerHTML =
        '<div class="flock-panel flock-empty"><div class="flock-empty-text">خطا در دریافت وضعیت گله</div></div>';
    }
  }

  // ابزار یافتن گله در لیست گله‌های فعال واحد
  findActiveFlockById(flockId) {
    return (
      (this.activeFlocks || []).find(
        (f) => parseInt(f.id) === parseInt(flockId),
      ) || null
    );
  }

  findActiveFlockByHall(hallId) {
    return (
      (this.activeFlocks || []).find((f) =>
        (f.placements || []).some(
          (p) => parseInt(p.id) === parseInt(hallId),
        ),
      ) || null
    );
  }

  // سلکت «گله / دوره پرورش» در فرم ثبت
  refreshFlockJoinSelect(flocks) {
    const group = document.getElementById("flockJoinGroup");
    const select = document.getElementById("skb-flock-join");
    if (!group || !select) return;
    const list = flocks || this.activeFlocks || [];
    const attachable = list.filter((f) =>
      (f.placements || []).some((p) => p.is_active),
    );
    if (attachable.length === 0) {
      group.style.display = "none";
      select.innerHTML = "";
      return;
    }
    group.style.display = "block";
    const options = attachable.map(
      (f) =>
        `<option value="${f.id}">پیوستن به گله ${f.flock_number} — ${f.placement_date ? convertToPersianDate(f.placement_date) : ""}</option>`,
    );
    options.push(
      '<option value="new">➕ شروع گله جدید (نوبت جدید در همین واحد)</option>',
    );
    select.innerHTML = options.join("");
  }

  // ===== سالن‌های قابل افزودن به همین گله (یک نوبت) =====

  refreshExtraHalls() {
    const section = document.getElementById("extraHallsSection");
    const listEl = document.getElementById("extraHallsList");
    if (!section || !listEl) return;
    try {
      const hallSelect = document.getElementById("skb-hall-select");
      const primaryHallId = hallSelect ? parseInt(hallSelect.value) : null;
      const primaryHall = this.halls.find(
        (h) => parseInt(h.id) === primaryHallId,
      );
      if (!primaryHall || !primaryHall.unit_id) {
        section.style.display = "none";
        listEl.innerHTML = "";
        return;
      }
      const unitId = primaryHall.unit_id;

      // سالن‌هایی که در حال حاضر جوجه‌ریزی فعال دارند
      const busyHalls = new Set(
        this.flocks
          .filter((f) => f.is_active === true)
          .map((f) => parseInt(f.hall_id)),
      );

      const freeHalls = this.halls.filter(
        (h) =>
          parseInt(h.unit_id) === parseInt(unitId) &&
          h.is_active !== false &&
          parseInt(h.id) !== primaryHallId &&
          !busyHalls.has(parseInt(h.id)),
      );

      if (freeHalls.length === 0) {
        section.style.display = "none";
        listEl.innerHTML = "";
        return;
      }

      const mainCount =
        parseInt(document.getElementById("skb-chick-count")?.value) || 0;

      listEl.innerHTML = hatcheryRenderer.renderExtraHallsList(
        freeHalls,
        primaryHallId,
        mainCount || "",
        document.getElementById("skb-chick-date")?.value || "",
      );
      section.style.display = "block";
      this.initExtraHallDatepickers();
      this.syncExtraHallDates();
    } catch (error) {
      console.error("❌ Error building extra halls:", error);
      section.style.display = "none";
    }
  }

  // تقویم شمسی برای فیلدهای تاریخ سالن‌های اضافه
  initExtraHallDatepickers() {
    try {
      const mainVal = document.getElementById("skb-chick-date")?.value || "";
      document
        .querySelectorAll("#extraHallsList .extra-hall-date")
        .forEach((input) => {
          if (typeof $.fn.persianDatepicker !== "undefined") {
            try {
              if (!input.dataset.dpInited) {
                $(input).persianDatepicker({
                  format: "YYYY/MM/DD",
                  autoClose: true,
                  initialValue: false,
                  observer: true,
                });
                input.dataset.dpInited = "1";
              }
            } catch (e) {
              /* ignore */
            }
          }
          input.dataset.prevMain = mainVal;
        });
    } catch (err) {
      console.warn("⚠️ خطا در ساخت تقویم سالن‌های اضافه:", err);
    }
  }

  // همگام‌سازی تاریخ سالن‌های اضافه با تاریخ سالن اول
  syncExtraHallDates() {
    const main = document.getElementById("skb-chick-date");
    if (!main) return;
    const val = (main.value || "").trim();
    document
      .querySelectorAll("#extraHallsList .extra-hall-date")
      .forEach((el) => {
        const cur = (el.value || "").trim();
        const prev = el.dataset.prevMain || "";
        if (!cur || cur === prev) el.value = val;
        el.dataset.prevMain = val;
      });
  }

  // جمع‌آوری سالن‌های اضافه انتخاب‌شده
  collectExtraHalls(mainCount) {
    const jobs = [];
    const checks = document.querySelectorAll(
      "#extraHallsList .extra-hall-chk:checked",
    );
    checks.forEach((chk) => {
      const hallId = parseInt(chk.dataset.hall);
      const hall = this.halls.find((h) => parseInt(h.id) === hallId);
      const countInput = document.querySelector(
        `.extra-hall-count[data-hall="${hallId}"]`,
      );
      const count = parseInt(countInput?.value) || mainCount || 0;
      const dateInput = document.querySelector(
        `.extra-hall-date[data-hall="${hallId}"]`,
      );
      jobs.push({
        hall_id: hallId,
        hall_name: hall?.hall_name || `سالن ${hallId}`,
        total_chicks_count: count,
        date_raw: dateInput?.value?.trim() || "",
      });
    });
    return jobs;
  }

  // ===== بوکمارک گله/دوره (با سالن اختیاری) =====

  async addFlockBookmark(flockId = null) {
    const flock =
      this.findActiveFlockById(flockId) || this.activeFlock || null;
    if (!flock) {
      notificationService.warning("گله فعالی برای بوکمارک وجود ندارد");
      return;
    }
    const placements = flock.placements || [];
    const hallOptions =
      '<option value="">— کل گله —</option>' +
      placements
        .map((p) => {
          const hallName =
            p.hall?.hall_name ||
            this.halls.find((h) => parseInt(h.id) === parseInt(p.hall_id))
              ?.hall_name ||
            `سالن ${p.hall_id}`;
          return `<option value="${p.id}">${hallName}${p.is_active ? "" : " (پایان یافته)"}</option>`;
        })
        .join("");

    let chosen;
    if (typeof Swal !== "undefined") {
      const res = await Swal.fire({
        title: `بوکمارک گله ${flock.flock_number}`,
        html: `<div style="text-align:right;font-family:Vazir;direction:rtl;">
          <label style="display:block;margin-bottom:6px;font-size:13px;">عنوان بوکمارک</label>
          <input id="bmTitleInput" class="swal2-input" placeholder="مثال: پیگیری هفته جاری" style="direction:rtl;text-align:right;">
          <label style="display:block;margin:10px 0 6px;font-size:13px;">سالن (اختیاری)</label>
          <select id="bmHallSelect" class="swal2-select" style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:8px;">${hallOptions}</select>
        </div>`,
        showCancelButton: true,
        confirmButtonText: "ذخیره بوکمارک",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#0d9488",
        reverseButtons: true,
        focusConfirm: false,
        preConfirm: () => {
          const title = document.getElementById("bmTitleInput")?.value?.trim();
          if (!title) {
            Swal.showValidationMessage("عنوان الزامی است");
            return false;
          }
          return {
            title,
            hall: document.getElementById("bmHallSelect")?.value || null,
          };
        },
      });
      if (!res.isConfirmed) return;
      chosen = res.value;
    } else {
      const title = window.prompt("عنوان بوکمارک گله:");
      if (!title) return;
      const hall = window.prompt(
        "شناسه سالن (اختیاری؛ خالی = کل گله):",
      );
      chosen = { title, hall: hall || null };
    }

    try {
      const response = await hatcheryApi.createFlockBookmark({
        title: chosen.title,
        type: "bookmark",
        customer_id: parseInt(this.customerId),
        unit_id: this.currentUnitId
          ? parseInt(this.currentUnitId)
          : flock.unit_id || null,
        flock_period_id: flock.id,
        hall_id: chosen.hall ? parseInt(chosen.hall) : null,
        priority: "medium",
      });
      if (response.success) {
        notificationService.success(
          `بوکمارک «${chosen.title}» برای گله ${flock.flock_number} ذخیره شد`,
        );
        if (typeof window.refreshBookmarks === "function") {
          window.refreshBookmarks();
        }
      } else {
        notificationService.error(
          response.message || "خطا در ذخیره بوکمارک",
        );
      }
    } catch (error) {
      console.error("❌ Error creating flock bookmark:", error);
      notificationService.error(error.message || "خطا در ذخیره بوکمارک");
    }
  }

  // ===== پیامک گله/سالن (مودال مشترک با قالب‌ها + انتخاب گیرنده) =====

  async sendFlockSms(hallId = null, flockId = null) {
    const flock = flockId
      ? this.findActiveFlockById(flockId)
      : hallId
        ? this.findActiveFlockByHall(hallId)
        : this.activeFlock || null;
    if (!flock) {
      notificationService.warning("گله فعالی وجود ندارد");
      return;
    }

    try {
      // دریافت واحد (مدیر + کارشناسان) و مشتری (شماره مرغدار)
      let unit = null;
      if (flock.unit_id) {
        const unitRes = await hatcheryApi.getUnit(flock.unit_id).catch(() => null);
        if (unitRes?.success) unit = unitRes.data || null;
      }
      const custRes = await hatcheryApi
        .getCustomer(this.customerId)
        .catch(() => null);
      const customer = custRes?.success ? custRes.data || {} : {};

      // زنجیره گیرنده: کارشناس فارم ← مدیر فارم ← مرغدار
      const recipients = [];
      const experts = (unit && Array.isArray(unit.experts)) ? unit.experts : [];
      const primaryExpert =
        experts.find((e) => e.expert_phone) || experts[0] || null;
      if (primaryExpert?.expert_phone) {
        recipients.push({
          role: "کارشناس فارم",
          name: primaryExpert.expert_name || "کارشناس",
          mobile: primaryExpert.expert_phone,
        });
      }
      if (unit?.manager_phone) {
        recipients.push({
          role: "مدیر فارم",
          name: unit.manager_name || "مدیر",
          mobile: unit.manager_phone,
        });
      }
      if (customer?.mobile_number) {
        recipients.push({
          role: "مرغدار",
          name: customer.full_name || "مرغدار",
          mobile: customer.mobile_number,
        });
      }
      if (recipients.length === 0) {
        notificationService.error(
          "هیچ شماره موبایلی برای گیرنده (کارشناس/مدیر/مرغدار) ثبت نشده است",
        );
        return;
      }

      const { openSmsModal } = await import(
        "../../../sms/sms.modal.service.js"
      );
      const cleanHallName = (name) =>
        String(name || "").trim().replace(/^سالن\s*/i, "");
      let hallName = null;
      if (hallId) {
        const hallRow = (flock.placements || []).find(
          (x) =>
            parseInt(x.id) === parseInt(hallId) ||
            parseInt(x.chick_placement_id) === parseInt(hallId),
        );
        hallName = cleanHallName(
          hallRow?.hall?.hall_name ||
            hallRow?.hall_name ||
            (this.halls.find(
              (h) => parseInt(h.id) === parseInt(hallRow?.hall_id),
            ) || {})
              .hall_name ||
            null,
        );
      }

      const result = await openSmsModal({
        title: hallId
          ? `پیامک سالن — گله ${flock.flock_number}`
          : `پیامک گله ${flock.flock_number}`,
        recipients,
        flockNumber: flock.flock_number,
        hallName,
        scope: hallId ? "hall" : "flock",
        subtitle: hallId
          ? `پیام برای گله ${flock.flock_number}${hallName ? ` — سالن ${hallName}` : ""} ساخته می‌شود`
          : `پیام برای گله ${flock.flock_number} (کل گله) ساخته می‌شود`,
      });
      if (!result) return;

      const items =
        Array.isArray(result.messages) && result.messages.length
          ? result.messages
          : [{ recipient: result.recipient, message: result.message }];
      let okCount = 0;
      let failCount = 0;
      for (const item of items) {
        try {
          const response = await hatcheryApi.sendToRecipient(
            item.recipient?.mobile,
            item.message,
            {
              customerId: this.customerId,
              flockPeriodId: flock.id || null,
              hallId: hallId || null,
              scope: hallId ? "hall" : "flock",
              flockNumber: flock.flock_number,
              hallName: hallName || null,
              weekNumber: null,
              recipientRole: item.recipient?.role || null,
              recipientName: item.recipient?.name || null,
            },
          );
          if (response && response.success) okCount++;
          else failCount++;
        } catch (e) {
          failCount++;
        }
      }
      if (okCount > 0) {
        notificationService.success(
          failCount === 0
            ? `پیامک به ${okCount} گیرنده ارسال شد`
            : `پیامک به ${okCount} گیرنده ارسال شد (${failCount} ناموفق)`,
        );
      } else {
        notificationService.error(
          failCount > 0 ? "ارسال پیامک ناموفق بود" : "گیرنده‌ای برای ارسال انتخاب نشد",
        );
      }
    } catch (error) {
      console.error("❌ Error sending flock sms:", error);
      notificationService.error(error.message || "خطا در ارسال پیامک");
    }
  }

  // ===== پایان گله فعال =====

  async endActiveFlock(flockId = null) {
    const flock =
      this.findActiveFlockById(flockId) || this.activeFlock || null;
    if (!flock) {
      notificationService.error("گله فعالی برای پایان وجود ندارد");
      return;
    }
    if (typeof Swal !== "undefined") {
      const result = await Swal.fire({
        icon: "question",
        title: "پایان گله",
        html: `آیا از پایان گله شماره <b>${flock.flock_number}</b> اطمینان دارید؟<br>سالن‌های این گله بسته شده و برای شروع گله جدید آزاد می‌شوند.`,
        showCancelButton: true,
        confirmButtonText: "بله، پایان گله",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#dc2626",
        reverseButtons: true,
      });
      if (!result.isConfirmed) return;
    } else if (
      !window.confirm(`پایان گله شماره ${flock.flock_number}؟`)
    ) {
      return;
    }

    try {
      const hasPlacements = (flock.placements?.length || 0) > 0;
      let response;
      if (hasPlacements) {
        // پایان دوره کامل گله: محاسبه از ثبت هفتگی هر سالن + رکورد تفکیکی per سالن
        response = await hatcheryApi.completeFlock(flock.id, {
          completion_type: "completed",
        });
      } else {
        // گله بدون سالن — فقط بستن وضعیت
        response = await hatcheryApi.endFlock(flock.id, {
          status: "completed",
        });
      }
      if (!response.success) {
        notificationService.error(
          response.message || "خطا در ثبت پایان دوره گله",
        );
        return;
      }
      notificationService.success(
        hasPlacements
          ? `پایان دوره گله شماره ${flock.flock_number} ثبت شد (تفکیکی per سالن)`
          : `گله شماره ${flock.flock_number} با موفقیت پایان یافت`,
      );
      this.activeFlock = null;
      await this.loadData();
      this.refreshFlockPanel();
      this.refreshExtraHalls();
      hatcheryFormService.resetFlockForm();
    } catch (error) {
      console.error("❌ Error ending flock:", error);
      notificationService.error(error.message || "خطا در پایان گله");
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

  async deleteFlockGroup(flockId, fallbackId = null) {
    if (!flockId) {
      if (fallbackId) return this.deleteFlock(fallbackId);
      notificationService.warning("شناسه گله مشخص نیست");
      return;
    }
    const confirmed = await notificationService.confirm({
      title: "🗑️ حذف گله (کل دوره)",
      text: "آیا از حذف کامل این گله به‌همراه همه جوجه‌ریزی‌های سالن‌های عضو اطمینان دارید؟ این عمل قابل بازگشت نیست.",
      confirmText: "بله، حذف شود",
      cancelText: "انصراف",
    });
    if (!confirmed) return;

    try {
      const response = await hatcheryApi.deleteFlockGroup(flockId);
      if (response.success) {
        notificationService.success("گله و سالن‌های عضو با موفقیت حذف شد");
        await this.loadData();
        if (typeof window.refreshWeeksDisplay === "function") {
          await window.refreshWeeksDisplay();
        }
      } else {
        notificationService.error(response.message || "خطا در حذف گله");
      }
    } catch (error) {
      console.error("❌ Error deleting flock group:", error);
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

  // ===== عملیات «کل گله» (ردیف‌های تب لیست گله‌ها) =====

  async _refreshFlockViews() {
    await this.loadData();
    if (typeof this.refreshFlockPanel === "function") this.refreshFlockPanel();
    if (typeof this.refreshExtraHalls === "function") this.refreshExtraHalls();
    if (typeof window.refreshWeeksDisplay === "function") {
      await window.refreshWeeksDisplay();
    }
  }

  _flockHallName(p) {
    if (!p) return "-";
    return (
      p.hall?.hall_name ||
      p.Hall?.hall_name ||
      (p.hall_id ? `سالن ${p.hall_id}` : "-")
    );
  }

  _flockSourceName(sourceId) {
    const s = (this.dictionaries.sources || []).find(
      (x) => Number(x.id) === Number(sourceId),
    );
    return s ? s.name || s.title || "-" : "-";
  }

  _flockCompletionDetailsHtml(c) {
    const fmt = (v, d = 0) =>
      v === null || v === undefined || v === ""
        ? "-"
        : Number(v).toLocaleString("fa-IR", { maximumFractionDigits: d });
    const toman = (v) =>
      v === null || v === undefined || v === "" ? "-" : `${fmt(v)} تومان`;
    if (!c) {
      return `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px 14px;margin-top:14px;font-size:12px;color:#92400e;">
          <i class="fas fa-info-circle"></i> برای این گله هنوز اطلاعات پایان دوره/کشتار ثبت نشده است.
        </div>`;
    }
    const profit = Number(c.net_profit || 0);
    const profitColor = profit >= 0 ? "#16a34a" : "#dc2626";
    return `
      <div style="margin-top:16px;">
        <h4 style="color:#0d9488;font-size:14px;margin:0 0 8px;border-bottom:2px solid #ccfbf1;padding-bottom:5px;"><i class="fas fa-flag-checkered"></i> اطلاعات پایان دوره و کشتار</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:10px;">
          <div style="background:#f8fafc;border-radius:10px;padding:7px 10px;font-size:11px;color:#64748b;">تاریخ کشتار<br><b style="color:#0f172a;">${c.slaughter_date ? convertToPersianDate(c.slaughter_date) : "-"}</b></div>
          <div style="background:#f8fafc;border-radius:10px;padding:7px 10px;font-size:11px;color:#64748b;">کشتارگاه<br><b style="color:#0f172a;">${c.slaughterhouse_name || "-"}</b></div>
          <div style="background:#f8fafc;border-radius:10px;padding:7px 10px;font-size:11px;color:#64748b;">ارسالی به کشتارگاه<br><b style="color:#0f172a;">${fmt(c.total_sent)} قطعه</b></div>
          <div style="background:#f8fafc;border-radius:10px;padding:7px 10px;font-size:11px;color:#64748b;">وزن کل زنده<br><b style="color:#0f172a;">${fmt(c.total_live_weight)} کیلوگرم</b></div>
          <div style="background:#f8fafc;border-radius:10px;padding:7px 10px;font-size:11px;color:#64748b;">میانگین وزن<br><b style="color:#0f172a;">${fmt(c.avg_live_weight, 3)} کیلوگرم</b></div>
          <div style="background:#f8fafc;border-radius:10px;padding:7px 10px;font-size:11px;color:#64748b;">سن کشتار<br><b style="color:#0f172a;">${c.slaughter_age_days ? `${c.slaughter_age_days} روز` : "-"}</b></div>
        </div>
        <div style="background:#f8fafc;border:1px solid #eef2f6;border-radius:12px;padding:10px 14px;margin-bottom:10px;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:6px;">شاخصها (سیستمی / اعلامی مرغدار)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;font-size:11.5px;">
            <div><b>FCR:</b> ${fmt(c.system_fcr, 3)} / ${fmt(c.farmer_fcr, 3)}</div>
            <div><b>EPI:</b> ${fmt(c.system_epi)} / ${fmt(c.farmer_epi)}</div>
            <div><b>ADG (گرم/روز):</b> ${fmt(c.system_adg_grams)} / ${fmt(c.farmer_adg_grams)}</div>
            <div><b>زنده‌مانی:</b> ${fmt(c.system_survival_percent)}٪ / ${fmt(c.farmer_survival_percent)}٪</div>
          </div>
        </div>
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 14px;">
          <div style="font-size:12px;font-weight:800;color:#0f172a;margin-bottom:6px;">گزارش اقتصادی (تومان)</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px;font-size:11.5px;">
            <div>درآمد کل:<br><b style="color:#1d4ed8;">${toman(c.income_total)}</b></div>
            <div>جمع هزینه‌ها:<br><b style="color:#c2410c;">${toman(c.total_cost)}</b></div>
            <div>سود خالص:<br><b style="color:${profitColor};">${toman(c.net_profit)}</b></div>
            <div>درصد سود:<br><b>${c.profit_percent != null ? `${c.profit_percent}٪` : "-"}</b></div>
            <div>راندمان لاشه:<br><b>${fmt(c.carcass_yield_percent)}٪</b></div>
          </div>
        </div>
      </div>`;
  }

  async viewFlockGroup(flockId) {
    try {
      const response = await hatcheryApi.getFlockDetails(flockId);
      if (!response.success) {
        notificationService.error(response.message || "خطا در دریافت جزئیات گله");
        return;
      }
      const flock = response.data || {};
      const placements = Array.isArray(flock.placements) ? flock.placements : [];
      const unit = flock.unit || {};
      const summary = flock.summary || {};
      let completion = null;
      try {
        const cRes = await hatcheryApi.getFlockCompletionByFlock(flockId);
        if (cRes.success && cRes.data) completion = cRes.data;
      } catch (e) {
        completion = null;
      }
      const statusFa =
        flock.status === "active"
          ? "فعال"
          : flock.status === "inactive"
            ? "غیرفعال"
            : "تکمیل‌شده";

      const hallRows = placements
        .map(
          (p) =>
            `<tr>
              <td style="padding:6px 8px;border-bottom:1px solid #eef2f6;">${this._flockHallName(p)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eef2f6;">${p.placement_date ? convertToPersianDate(p.placement_date) : "-"}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eef2f6;">${this._flockSourceName(p.chick_source_id)}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eef2f6;">${p.breed?.name || "-"}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eef2f6;">${p.chick_age_on_arrival ?? "-"}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eef2f6;">${p.avg_initial_weight ?? "-"}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eef2f6;">${Number(p.total_chicks_count || 0).toLocaleString("fa-IR")}</td>
              <td style="padding:6px 8px;border-bottom:1px solid #eef2f6;"><span style="background:${p.is_active ? "#dcfce7" : "#fee2e2"};color:${p.is_active ? "#16a34a" : "#dc2626"};padding:2px 10px;border-radius:10px;font-size:11px;">${p.is_active ? "فعال" : "غیرفعال"}</span></td>
            </tr>`,
        )
        .join("");

      const html = `
        <div style="text-align:right;direction:rtl;font-family:Vazir,sans-serif;">
          <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">
            <div style="background:#f0fdfa;border-radius:8px;padding:6px 10px;flex:1;min-width:140px;"><div style="font-size:11px;color:#64748b;">شماره گله</div><div style="font-weight:700;">${flock.flock_number ?? "-"}</div></div>
            <div style="background:#f8fafc;border-radius:8px;padding:6px 10px;flex:1;min-width:140px;"><div style="font-size:11px;color:#64748b;">واحد</div><div style="font-weight:600;">${unit.unit_name || "-"}</div></div>
            <div style="background:#f8fafc;border-radius:8px;padding:6px 10px;flex:1;min-width:140px;"><div style="font-size:11px;color:#64748b;">تاریخ شروع</div><div style="font-weight:600;">${flock.placement_date ? convertToPersianDate(flock.placement_date) : "-"}</div></div>
            <div style="background:${flock.status === "active" ? "#dcfce7" : "#fee2e2"};border-radius:8px;padding:6px 10px;flex:1;min-width:140px;"><div style="font-size:11px;color:#64748b;">وضعیت گله</div><div style="font-weight:700;color:${flock.status === "active" ? "#16a34a" : "#dc2626"};">${statusFa}</div></div>
          </div>
          <div style="background:#f8fafc;border:1px solid #eef2f6;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;">
            <b>مجموع جوجه‌ها:</b> ${Number(summary.totalChicks || 0).toLocaleString("fa-IR")} قطعه
            &nbsp;•&nbsp; <b>سالن‌های عضو:</b> ${summary.totalHalls ?? placements.length}
            &nbsp;•&nbsp; <b>سالن‌های فعال:</b> ${summary.activeHalls ?? 0}
          </div>
          ${flock.notes ? `<div style="background:#fffbeb;border:1px solid #fef3c7;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#92400e;"><b>یادداشت:</b> ${flock.notes}</div>` : ""}
          <h4 style="color:#2c7a6e;font-size:13px;margin:0 0 8px;border-bottom:2px solid #e8f5f0;padding-bottom:5px;">جزئیات سالن‌های عضو گله</h4>
          <div style="max-height:300px;overflow:auto;border:1px solid #eef2f6;border-radius:10px;">
            ${placements.length ? `<table style="width:100%;border-collapse:collapse;font-size:11px;min-width:820px;">
              <thead><tr style="background:#f8fafc;color:#475569;"><th style="padding:8px;text-align:right;">سالن</th><th style="padding:8px;text-align:right;">تاریخ جوجه‌ریزی</th><th style="padding:8px;text-align:right;">مبدا</th><th style="padding:8px;text-align:right;">نژاد</th><th style="padding:8px;text-align:right;">سن (روز)</th><th style="padding:8px;text-align:right;">وزن اولیه (گرم)</th><th style="padding:8px;text-align:right;">تعداد جوجه</th><th style="padding:8px;text-align:right;">وضعیت</th></tr></thead>
              <tbody>${hallRows}</tbody>
            </table>` : `<div style="padding:16px;text-align:center;color:#94a3b8;">سالنی برای این گله ثبت نشده است</div>`}
          </div>
        </div>`;

      if (typeof Swal !== "undefined") {
        Swal.fire({
          title: `جزئیات کامل گله ${flock.flock_number ?? ""}`,
          html: html + this._flockCompletionDetailsHtml(completion),
          width: "960px",
          showConfirmButton: true,
          confirmButtonText: "بستن",
          confirmButtonColor: "#2c7a6e",
          showCloseButton: true,
        });
      }
    } catch (error) {
      console.error("Error viewing flock group:", error);
      notificationService.error("خطا در دریافت جزئیات گله");
    }
  }

  async toggleFlockGroupStatus(flockId) {
    try {
      const response = await hatcheryApi.getFlockDetails(flockId);
      if (!response.success) {
        notificationService.error(response.message || "خطا در دریافت وضعیت گله");
        return;
      }
      const flock = response.data || {};
      const isActive = flock.status === "active";
      const target = isActive ? "inactive" : "active";
      const label = isActive ? "غیرفعال کردن" : "فعال کردن";
      const hallCount = Array.isArray(flock.placements)
        ? flock.placements.length
        : 0;

      const confirmed = await notificationService.confirm({
        title: `${label} گله ${flock.flock_number ?? ""}`,
        text: isActive
          ? `گله شماره ${flock.flock_number ?? ""} همراه ${hallCount} سالن غیرفعال می‌شود و از فهرست گله‌های فعال این مشتری حذف می‌گردد.`
          : `گله شماره ${flock.flock_number ?? ""} فعال می‌شود و در فهرست گله‌های فعال این مشتری (و سالن‌های قابل انتخاب) قرار می‌گیرد.`,
        confirmText: `بله، ${isActive ? "غیرفعال" : "فعال"} کن`,
        cancelText: "انصراف",
      });
      if (!confirmed) return;

      const res = await hatcheryApi.setFlockStatus(flockId, {
        status: target,
      });
      if (res.success) {
        notificationService.success(
          res.message || `گله با موفقیت ${isActive ? "غیرفعال" : "فعال"} شد`,
        );
        await this._refreshFlockViews();
      } else {
        notificationService.error(res.message || "خطا در تغییر وضعیت گله");
      }
    } catch (error) {
      console.error("Error toggling flock group status:", error);
      notificationService.error("خطا در تغییر وضعیت گله");
    }
  }

  _flockSourceOptions(selected) {
    const items = this.dictionaries.sources || [];
    return [
      '<option value="">انتخاب مبدا...</option>',
      ...items.map(
        (s) =>
          `<option value="${s.id}" ${Number(s.id) === Number(selected) ? "selected" : ""}>${s.name || s.title || s.id}</option>`,
      ),
    ].join("");
  }

  _flockBreedOptions(selected) {
    const items = this.dictionaries.breeds || [];
    return [
      '<option value="">انتخاب نژاد...</option>',
      ...items.map(
        (b) =>
          `<option value="${b.id}" ${Number(b.id) === Number(selected) ? "selected" : ""}>${b.name || b.title || b.id}</option>`,
      ),
    ].join("");
  }

  _flockEditHallRows(placements) {
    const inputStyle =
      "width:100%;padding:5px 8px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;font-family:inherit;";
    return placements
      .map(
        (p) => `
          <fieldset style="border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;margin:8px 0;">
            <legend style="font-size:12px;font-weight:700;color:#2c7a6e;">${this._flockHallName(p)}</legend>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;">
              <label style="font-size:11px;color:#475569;">تاریخ جوجه‌ریزی سالن<input type="text" id="ge_date_${p.id}" class="hatch-edit-date" value="${p.placement_date ? convertToPersianDate(p.placement_date) : ""}" style="${inputStyle}"></label>
              <label style="font-size:11px;color:#475569;">مبدا جوجه<select id="ge_source_${p.id}" style="${inputStyle}">${this._flockSourceOptions(p.chick_source_id)}</select></label>
              <label style="font-size:11px;color:#475569;">نژاد جوجه<select id="ge_breed_${p.id}" style="${inputStyle}">${this._flockBreedOptions(p.breed_id)}</select></label>
              <label style="font-size:11px;color:#475569;">سن در بدو ورود (روز)<input type="number" min="0" id="ge_age_${p.id}" value="${p.chick_age_on_arrival ?? ""}" style="${inputStyle}"></label>
              <label style="font-size:11px;color:#475569;">وزن اولیه (گرم)<input type="number" step="0.01" min="0" id="ge_weight_${p.id}" value="${p.avg_initial_weight ?? ""}" style="${inputStyle}"></label>
              <label style="font-size:11px;color:#475569;">تعداد جوجه (قطعه) *<input type="number" min="1" id="ge_count_${p.id}" value="${p.total_chicks_count ?? ""}" style="${inputStyle}"></label>
            </div>
          </fieldset>`,
      )
      .join("");
  }

  async editFlockGroup(flockId) {
    try {
      const response = await hatcheryApi.getFlockDetails(flockId);
      if (!response.success) {
        notificationService.error(response.message || "خطا در دریافت اطلاعات گله");
        return;
      }
      const flock = response.data || {};
      const placements = Array.isArray(flock.placements)
        ? flock.placements
        : [];
      if (!placements.length) {
        notificationService.warning("این گله سالنی برای ویرایش ندارد");
        return;
      }

      const flockDate = flock.placement_date
        ? convertToPersianDate(flock.placement_date)
        : "";
      const sharedStyle =
        "width:100%;padding:6px 8px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;";

      const html = `
        <div style="text-align:right;direction:rtl;font-family:Vazir,sans-serif;max-height:62vh;overflow-y:auto;padding:4px;">
          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
            <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px;"><i class="fas fa-layer-group"></i> اطلاعات مشترک گله</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;">
              <label style="font-size:11px;color:#475569;">شماره گله *<input type="number" min="1" id="ge_fnum" value="${flock.flock_number ?? ""}" style="${sharedStyle}"></label>
              <label style="font-size:11px;color:#475569;">تاریخ شروع گله<input type="text" id="ge_flock_date" class="hatch-edit-date" value="${flockDate}" style="${sharedStyle}"></label>
            </div>
            <label style="font-size:11px;color:#475569;display:block;margin-top:8px;">یادداشت گله<textarea id="ge_notes" rows="2" style="${sharedStyle}">${flock.notes || ""}</textarea></label>
          </div>
          <div style="font-size:12px;font-weight:700;color:#0f172a;margin:6px 0;"><i class="fas fa-warehouse"></i> سالن‌های عضو (ویرایش هر سالن به تفکیک)</div>
          ${this._flockEditHallRows(placements)}
          <p style="font-size:11px;color:#94a3b8;margin-top:6px;">تغییر شماره گله روی همه سالن‌ها اعمال می‌شود؛ سایر فیلدها به‌صورت جداگانه برای هر سالن ذخیره می‌شوند.</p>
        </div>`;

      const result = await Swal.fire({
        title: `ویرایش گله ${flock.flock_number ?? ""}`,
        html,
        width: "880px",
        showCancelButton: true,
        confirmButtonText: "💾 ذخیره تغییرات گله",
        cancelButtonText: "انصراف",
        confirmButtonColor: "#2c7a6e",
        reverseButtons: true,
        showCloseButton: true,
        didOpen: () => {
          try {
            if (
              typeof window.$ !== "undefined" &&
              window.$.fn &&
              window.$.fn.persianDatepicker
            ) {
              document.querySelectorAll(".hatch-edit-date").forEach((el) => {
                if (el.dataset.dp) return;
                window.$(el).persianDatepicker({
                  format: "YYYY/MM/DD",
                  autoClose: true,
                  initialValue: false,
                });
                el.dataset.dp = "1";
              });
            }
          } catch (e) {
            /* ignore */
          }
        },
        preConfirm: async () => {
          const ok = await this._saveFlockGroupEdit(
            flockId,
            flock,
            placements,
          );
          if (!ok) return false;
          return true;
        },
      });

      if (result.isConfirmed) {
        notificationService.success("تغییرات گله با موفقیت ذخیره شد");
        await this._refreshFlockViews();
      }
    } catch (error) {
      console.error("Error editing flock group:", error);
      notificationService.error("خطا در باز کردن پنجره ویرایش گله");
    }
  }

  async _saveFlockGroupEdit(flockId, flock, placements) {
    const fnum = parseInt(document.getElementById("ge_fnum")?.value);
    if (isNaN(fnum) || fnum < 1) {
      Swal.showValidationMessage("شماره گله باید عددی مثبت باشد");
      return false;
    }
    const dateVal = String(
      document.getElementById("ge_flock_date")?.value || "",
    ).trim();
    const flockDate = dateVal
      ? convertPersianToGregorian(dateVal) || null
      : null;
    const notes = String(
      document.getElementById("ge_notes")?.value || "",
    ).trim();

    const flockRes = await hatcheryApi.updateFlockInfo(flockId, {
      flock_number: fnum,
      ...(flockDate ? { placement_date: flockDate } : {}),
      notes: notes || null,
    });
    if (!flockRes.success) {
      Swal.showValidationMessage(
        flockRes.message || "خطا در ذخیره اطلاعات مشترک گله",
      );
      return false;
    }

    for (const p of placements) {
      const count = parseInt(
        document.getElementById(`ge_count_${p.id}`)?.value,
      );
      if (isNaN(count) || count < 1) {
        Swal.showValidationMessage(
          `تعداد جوجه سالن «${this._flockHallName(p)}» معتبر نیست`,
        );
        return false;
      }
      const hallDateRaw = String(
        document.getElementById(`ge_date_${p.id}`)?.value || "",
      ).trim();
      const hallDate = hallDateRaw
        ? convertPersianToGregorian(hallDateRaw) || null
        : flockDate;
      const sourceId =
        parseInt(document.getElementById(`ge_source_${p.id}`)?.value) || null;
      const breedId =
        parseInt(document.getElementById(`ge_breed_${p.id}`)?.value) || null;
      const ageRaw = parseInt(
        document.getElementById(`ge_age_${p.id}`)?.value,
      );
      const weightRaw = parseFloat(
        document.getElementById(`ge_weight_${p.id}`)?.value,
      );
      const age = isNaN(ageRaw) ? null : ageRaw;
      const weight = isNaN(weightRaw) ? null : weightRaw;

      const hallPayload = {
        ...(hallDate ? { placement_date: hallDate } : {}),
        ...(sourceId ? { chick_source_id: sourceId } : {}),
        ...(breedId ? { breed_id: breedId } : {}),
        ...(age !== null ? { chick_age_on_arrival: age } : {}),
        ...(weight !== null ? { avg_initial_weight: weight } : {}),
        total_chicks_count: count,
      };

      const hallRes = await hatcheryApi.updateFlock(p.id, hallPayload);
      if (!hallRes.success) {
        Swal.showValidationMessage(
          `خطا در ذخیره سالن «${this._flockHallName(p)}»: ${
            hallRes.message || ""
          }`,
        );
        return false;
      }
    }

    return true;
  }

  // ===== مودال جامع «پایان گله» =====

  _toNum(value) {
    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    )
      return null;
    let s = String(value).trim();
    const faDigits = "۰۱۲۳۴۵۶۷۸۹";
    const arDigits = "٠١٢٣٤٥٦٧٨٩";
    for (let i = 0; i < 10; i++) {
      s = s
        .split(faDigits[i])
        .join(String(i))
        .split(arDigits[i])
        .join(String(i));
    }
    s = s.replace(/[٬,،\s]/g, "");
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  }

  _pcSlaughterAge() {
    const sdateRaw = String(
      document.getElementById("pc_sdate")?.value || "",
    ).trim();
    const flockIso = String(
      document.getElementById("pc_flock_iso")?.value || "",
    ).trim();
    if (!sdateRaw || !flockIso) return 0;
    const greg = convertPersianToGregorian(sdateRaw);
    if (!greg) return 0;
    const isoSlaughter = String(greg).replace(/\//g, "-").slice(0, 10);
    const isoFlock = String(flockIso).replace(/\//g, "-").slice(0, 10);
    const d1 = new Date(isoSlaughter);
    const d0 = new Date(isoFlock);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d0.getTime())) return 0;
    return Math.max(0, Math.round((d1 - d0) / 86400000));
  }

  formatTomanInput(el) {
    if (!el) return;
    const n = this._toNum(el.value);
    if (el.type === "number") {
      el.value = n === null ? "" : String(n);
      return;
    }
    el.value =
      n === null
        ? ""
        : n.toLocaleString("fa-IR", { maximumFractionDigits: 0 });
  }

  _pcNormKg(value) {
    const n = parseFloat(value);
    if (Number.isNaN(n) || n <= 0) return 0.04;
    // اگر مقدار برحسب گرم ذخیره شده (مثلاً 42.5) به کیلوگرم تبدیل می‌شود
    return n < 1 ? n : n / 1000;
  }

  async completeFlockOf(flockId) {
    try {
      const res = await hatcheryApi.getFlockCompletionPreview(flockId);
      if (!res.success) {
        notificationService.error(res.message || "خطا در دریافت پیش‌نمایش گله");
        return;
      }
      const data = res.data || {};
      const halls = Array.isArray(data.halls) ? data.halls : [];
      const flock = data.flock || {};

      if (flock.status && flock.status !== "active") {
        notificationService.warning(
          `گله شماره ${flock.flock_number} در وضعیت «${flock.status}» است و قابل پایان‌دادن مجدد نیست.`,
        );
        return;
      }

      if (!halls.length) {
        // گله بدون سالن: فقط بستن وضعیت
        const confirmed = await notificationService.confirm({
          title: "پایان گله بدون سالن",
          text: `گله شماره ${flock.flock_number} سالن فعالی ندارد. فقط وضعیت آن به «پایان‌یافته» تغییر کند؟`,
          confirmText: "بله، پایان گله",
          cancelText: "انصراف",
        });
        if (!confirmed) return;
        const endRes = await hatcheryApi.endFlock(flockId, {
          status: "completed",
        });
        if (endRes.success) {
          notificationService.success("گله با موفقیت پایان یافت");
          await this._refreshFlockViews();
        } else {
          notificationService.error(endRes.message || "خطا در پایان گله");
        }
        return;
      }

      await this._openFlockCompletionModal(data);
    } catch (error) {
      console.error("Error opening completion modal:", error);
      notificationService.error("خطا در باز کردن مودال پایان گله");
    }
  }

  _pcRow(label, id, value, opts = {}) {
    const type = opts.type || "number";
    const readOnly = !!opts.readOnly;
    const unit = opts.unit || "";
    const step = opts.step !== undefined ? opts.step : "any";
    const min = opts.min !== undefined ? opts.min : "";
    const ph = opts.placeholder || "";
    const blurAttr = opts.onblur ? ` onblur="${opts.onblur}"` : "";
    const extraAttrs = readOnly
      ? 'readonly style="background:#f1f5f9;color:#334155;cursor:not-allowed;"'
      : `oninput="hatcheryRecalcCompletion()"${blurAttr}`;
    return `<div style="margin-bottom:7px;">
      <label class="pc-label" for="${id}">${label}${
        unit ? ` <small style="color:#94a3b8;">(${unit})</small>` : ""
      }</label>
      <input type="${type}" id="${id}" class="pc-in" value="${
        value ?? ""
      }" ${min !== "" ? `min="${min}"` : ""} step="${step}" placeholder="${ph}" ${extraAttrs}>
    </div>`;
  }

  _pcRead(label, id, unit = "") {
    return `<div style="margin-bottom:7px;">
      <label class="pc-label">${label}${
        unit ? ` <small style="color:#94a3b8;">(${unit})</small>` : ""
      }</label>
      <div id="${id}" class="pc-read">۰</div>
    </div>`;
  }

  _pcHallBlock(hall) {
    const hid = hall.chick_placement_id;
    return `<div class="pc-hall">
      <div style="font-weight:700;font-size:12px;color:#2c7a6e;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
        <i class="fas fa-warehouse"></i> ${hall.hall_name || `سالن ${hall.hall_id}`}
        <span style="font-weight:500;font-size:10.5px;color:#64748b;">(اولیه: ${Number(
          hall.initial_chicks_count || 0,
        ).toLocaleString("fa-IR")} قطعه)</span>
      </div>
      <div class="pc-grid">
        ${this._pcRow("تعداد ارسالی به کشتارگاه (اختیاری)", `pc_hsent_${hid}`, "", {
          placeholder: "مثلاً ۹۵۰۰",
        })}
        ${this._pcRow("وزن زنده سالن (کیلوگرم)", `pc_hlive_${hid}`, "", {
          placeholder: "مثلاً ۲۳۵۰۰",
        })}
        ${this._pcRow("خوراک اعلامی سالن (کیلوگرم)", `pc_hfeed_${hid}`, "", {
          placeholder: "اختیاری",
        })}
      </div>
    </div>`;
  }

  _pcFormTop(data) {
    const flock = data.flock || {};
    const halls = Array.isArray(data.halls) ? data.halls : [];
    const s = data.summary || {};
    const today = new Date().toISOString().slice(0, 10);
    return `
      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-id-card"></i> ۱) اطلاعات هویتی گله</div>
        <div class="pc-grid">
          ${this._pcRow("شماره گله", "pc_fnum", flock.flock_number ?? "", { type: "text", readOnly: true })}
          ${this._pcRow("نام مرغدار", "pc_customer", flock.customer_name ?? "", { type: "text", readOnly: true })}
          ${this._pcRow("واحد مرغداری", "pc_unit", flock.unit_name ?? "", { type: "text", readOnly: true })}
          ${this._pcRow("تعداد سالن‌ها", "pc_halls", halls.length, { type: "number", readOnly: true })}
          ${this._pcRow("تاریخ جوجه‌ریزی", "pc_pdate", flock.placement_date ? convertToPersianDate(flock.placement_date) : "", { type: "text", readOnly: true })}
          <div style="margin-bottom:7px;">
            <label class="pc-label">تاریخ کشتار <small style="color:#b45309;">* اعلامی مرغدار</small></label>
            <input type="text" id="pc_sdate" class="pc-in pc-date" value="${convertToPersianDate(today)}" onchange="hatcheryRecalcCompletion()" oninput="hatcheryRecalcCompletion()">
          </div>
          ${this._pcRead("سن کشتار (روز)", "pc_out_age")}
          ${this._pcRow("نام کشتارگاه", "pc_slaughterhouse", "", { type: "text", placeholder: "اختیاری" })}
          <input type="hidden" id="pc_flock_iso" value="${flock.placement_date ?? ""}">
        </div>
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-users"></i> ۲) اطلاعات جمعیتی (تعداد)</div>
        <div class="pc-grid">
          ${this._pcRow("تعداد اولیه جوجه‌ها", "pc_initial", s.initial_chicks_count ?? 0, { readOnly: true })}
          ${this._pcRow("تعداد ارسالی به کشتارگاه", "pc_sent", "", { min: 1, placeholder: "مثلاً ۹۵۰۰" })}
          ${this._pcRead("تلفات کل (خودکار)", "pc_out_mortality", "قطعه")}
          ${this._pcRead("درصد تلفات (خودکار)", "pc_out_mortality_pct", "٪")}
        </div>
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-weight-scale"></i> ۳) اطلاعات وزنی</div>
        <div class="pc-grid">
          ${this._pcRow("وزن کل زنده گله", "pc_live", "", { min: 1, placeholder: "مثلاً ۲۴۰۰۰", unit: "کیلوگرم" })}
          ${this._pcRow("وزن لاشه (اختیاری)", "pc_carcass", "", { min: 0, unit: "کیلوگرم" })}
          ${this._pcRead("میانگین وزن هر قطعه", "pc_out_avg", "کیلوگرم")}
          ${this._pcRead("درصد راندمان لاشه", "pc_out_yield", "٪")}
        </div>
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-wheat-awn"></i> ۴) اطلاعات خوراک</div>
        <div class="pc-grid">
          ${this._pcRow("کل خوراک سیستم", "pc_feed_sys", s.system_total_feed ?? 0, { readOnly: true, unit: "کیلوگرم" })}
          ${this._pcRow("خوراک اعلامی مرغدار", "pc_feed_decl", "", { min: 0, unit: "کیلوگرم", placeholder: "اختیاری" })}
          <div style="margin-bottom:7px;">
            <label class="pc-label">مبنای محاسبه FCR</label>
            <select id="pc_feed_basis" class="pc-in" onchange="hatcheryRecalcCompletion()">
              <option value="system">سیستم</option>
              <option value="declared">اعلامی مرغدار</option>
            </select>
          </div>
          ${this._pcRead("خوراک مبنای محاسبه", "pc_out_feed_used", "کیلوگرم")}
        </div>
      </div>`;
  }

  _pcFormBottom(data) {
    const s = data.summary || {};
    const halls = Array.isArray(data.halls) ? data.halls : [];
    const initWeight = this._pcNormKg(s.initial_avg_weight);
    const hallBlocks = halls
      .map((h) => this._pcHallBlock(h))
      .join('<div style="height:6px;"></div>');
    return `
      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-coins"></i> ۵) اطلاعات اقتصادی</div>
        <div class="pc-grid">
          ${this._pcRow("قیمت هر کیلو گوشت مرغ زنده (تومان)", "pc_price", "", { type: "text", placeholder: "مثلاً ۸۵,۰۰۰", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRead("درآمد کل", "pc_out_income", "تومان")}
          ${this._pcRow("هزینه جوجه (تومان)", "pc_cost_chick", "", { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("هزینه خوراک (تومان)", "pc_cost_feed", "", { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("هزینه دارو و واکسن (تومان)", "pc_cost_med", "", { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("هزینه سوخت (تومان)", "pc_cost_fuel", "", { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("هزینه نیروی انسانی (تومان)", "pc_cost_labor", "", { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("سایر هزینه‌ها (تومان)", "pc_cost_other", "", { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRead("جمع کل هزینه‌ها", "pc_out_total_cost", "تومان")}
          ${this._pcRead("سود خالص", "pc_out_profit", "تومان")}
          ${this._pcRead("درصد سود", "pc_out_profit_pct", "٪")}
        </div>
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-chart-line"></i> ۶) شاخص‌های عملکردی (محاسبه خودکار)</div>
        <div class="pc-dual">
          <div class="pc-dual-col pc-dual-sys">
            <div class="pc-dual-title"><i class="fas fa-database"></i> سیستمی (از داده‌های هفتگی)</div>
            <div class="pc-out">
              ${this._pcRead("FCR", "pc_out_sys_fcr")}
              ${this._pcRead("EPI", "pc_out_sys_epi")}
              ${this._pcRead("ADG", "pc_out_sys_adg", "گرم/روز")}
              ${this._pcRead("افزایش وزن کل", "pc_out_sys_gain", "کیلوگرم")}
              ${this._pcRead("زنده‌مانی", "pc_out_sys_survival", "٪")}
            </div>
          </div>
          <div class="pc-dual-col pc-dual-far">
            <div class="pc-dual-title"><i class="fas fa-user"></i> اعلامی مرغدار</div>
            <div class="pc-out">
              ${this._pcRead("FCR", "pc_out_far_fcr")}
              ${this._pcRead("EPI", "pc_out_far_epi")}
              ${this._pcRead("ADG", "pc_out_far_adg", "گرم/روز")}
              ${this._pcRead("افزایش وزن کل", "pc_out_far_gain", "کیلوگرم")}
              ${this._pcRead("زنده‌مانی", "pc_out_far_survival", "٪")}
            </div>
          </div>
        </div>
        <input type="hidden" id="pc_sys_weight" value="${s.final_avg_weight ?? s.system_last_weight ?? ""}">
        <input type="hidden" id="pc_sys_sent" value="${s.final_chicks_count ?? ""}">
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-warehouse"></i> اطلاعات تفکیکی سالن‌ها (اختیاری)</div>
        ${hallBlocks}
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-sticky-note"></i> توضیحات و تأیید</div>
        <textarea id="pc_notes" class="pc-note" rows="2" placeholder="توضیحات تکمیلی (اختیاری)..."></textarea>
        <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#475569;margin-top:8px;cursor:pointer;">
          <input type="checkbox" id="pc_confirmed"> اطلاعات پایان دوره توسط مرغدار تأیید شده است
        </label>
        <input type="hidden" id="pc_init_weight" value="${initWeight.toFixed(4)}">
      </div>`;
  }

  _pcSummary(data) {
    const flock = data.flock || {};
    const halls = Array.isArray(data.halls) ? data.halls : [];
    const s = data.summary || {};
    const initial = Number(s.initial_chicks_count || 0);
    return `
      <div class="pc-summary">
        <div class="pc-sum-item" data-c="1">
          <span class="pc-sum-ico"><i class="fas fa-hashtag"></i></span>
          <span><span class="pc-sum-lbl">شماره گله</span><b>${flock.flock_number ?? "-"}</b></span>
        </div>
        <div class="pc-sum-item" data-c="2">
          <span class="pc-sum-ico"><i class="fas fa-user"></i></span>
          <span><span class="pc-sum-lbl">نام مرغدار</span><b>${flock.customer_name || "-"}</b></span>
        </div>
        <div class="pc-sum-item" data-c="3">
          <span class="pc-sum-ico"><i class="fas fa-warehouse"></i></span>
          <span><span class="pc-sum-lbl">تعداد سالن‌ها</span><b>${halls.length}</b></span>
        </div>
        <div class="pc-sum-item" data-c="4">
          <span class="pc-sum-ico"><i class="fas fa-egg"></i></span>
          <span><span class="pc-sum-lbl">جوجه اولیه</span><b>${initial.toLocaleString("fa-IR")} قطعه</b></span>
        </div>
        <div class="pc-sum-item" data-c="5">
          <span class="pc-sum-ico"><i class="fas fa-flag-checkered"></i></span>
          <span><span class="pc-sum-lbl">وضعیت</span><b>در حال پایان</b></span>
        </div>
      </div>`;
  }

  _pcForm(data) {
    return `
      <style>
        .pc-wrap{direction:rtl;text-align:right;font-family:Vazir,sans-serif;max-height:76vh;overflow-y:auto;padding:8px 14px 16px;}
        .pc-wrap::-webkit-scrollbar{width:8px;} .pc-wrap::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px;}
        .pc-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px;margin-bottom:14px;}
        .pc-sum-item{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;box-shadow:0 2px 8px rgba(15,23,42,.05);}
        .pc-sum-item[data-c="1"]{background:linear-gradient(135deg,#f0fdfa,#ffffff);border-color:#99f6e4;}
        .pc-sum-item[data-c="2"]{background:linear-gradient(135deg,#eff6ff,#ffffff);border-color:#bfdbfe;}
        .pc-sum-item[data-c="3"]{background:linear-gradient(135deg,#fff7ed,#ffffff);border-color:#fed7aa;}
        .pc-sum-item[data-c="4"]{background:linear-gradient(135deg,#fef2f2,#ffffff);border-color:#fecaca;}
        .pc-sum-item[data-c="5"]{background:linear-gradient(135deg,#f5f3ff,#ffffff);border-color:#ddd6fe;}
        .pc-sum-ico{width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:#0d9488;color:#fff;font-size:14px;flex-shrink:0;}
        .pc-sum-item[data-c="2"] .pc-sum-ico{background:#2563eb;}
        .pc-sum-item[data-c="3"] .pc-sum-ico{background:#ea580c;}
        .pc-sum-item[data-c="4"] .pc-sum-ico{background:#dc2626;}
        .pc-sum-item[data-c="5"] .pc-sum-ico{background:#7c3aed;}
        .pc-sum-item > span:last-child{display:flex;flex-direction:column;line-height:1.5;min-width:0;}
        .pc-sum-lbl{font-size:10px;color:#64748b;}
        .pc-sum-item b{font-size:13.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .pc-sec{background:#f8fafc;border:1px solid #eef2f6;border-radius:14px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(15,23,42,.03);}
        .pc-sec-title{font-size:14px;font-weight:800;color:#0f172a;margin:0 0 10px;display:flex;align-items:center;gap:8px;border-bottom:2px solid #d9f3ec;padding-bottom:8px;}
        .pc-sec-title i{color:#0d9488;font-size:14px;}
        .pc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 16px;}
        .pc-out{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 14px;}
        .pc-dual{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-bottom:10px;}
        .pc-dual-col{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;box-shadow:0 1px 4px rgba(15,23,42,.03);}
        .pc-dual-sys{border-top:4px solid #0d9488;}
        .pc-dual-far{border-top:4px solid #2563eb;}
        .pc-dual-title{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:800;color:#0f172a;margin-bottom:10px;}
        .pc-dual-sys .pc-dual-title i{color:#0d9488;}
        .pc-dual-far .pc-dual-title i{color:#2563eb;}
        .pc-dual-sys .pc-read{background:#ecfdf5;border-color:#a7f3d0;color:#047857;}
        .pc-dual-far .pc-read{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;}
        .pc-label{display:block;font-size:11.5px;font-weight:500;color:#334155;margin-bottom:5px;}
        .pc-label small{color:#94a3b8;}
        .pc-in{width:100%;padding:9px 12px;border:1.5px solid #cbd5e1;border-radius:10px;font-family:inherit;font-size:13px;box-sizing:border-box;background:#fff;transition:all .15s ease;}
        .pc-in:hover{border-color:#94a3b8;}
        .pc-in:focus{outline:none;border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.12);}
        .pc-read{background:#fff;border:1.5px solid #ccfbf1;border-radius:10px;padding:9px 10px;font-weight:800;color:#0d9488;font-size:15px;box-shadow:inset 0 1px 0 rgba(255,255,255,.6);}
        .pc-hall{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;box-shadow:0 1px 3px rgba(15,23,42,.03);}
        .pc-note{width:100%;border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 12px;font-family:inherit;font-size:13px;box-sizing:border-box;}
        .pc-note:focus{outline:none;border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.12);}
        #pc_out_age{background:#faf5ff;border-color:#e9d5ff;color:#7c3aed;}
        #pc_out_mortality,#pc_out_mortality_pct{background:#fef2f2;border-color:#fecaca;color:#b91c1c;}
        #pc_out_avg{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;}
        #pc_out_yield{background:#f0fdf4;border-color:#bbf7d0;color:#15803d;}
        #pc_out_feed_used{background:#f8fafc;border-color:#e2e8f0;color:#475569;}
        #pc_out_income{background:#eff6ff;border-color:#bfdbfe;color:#1d4ed8;}
        #pc_out_total_cost{background:#fff7ed;border-color:#fed7aa;color:#c2410c;}
        #pc_out_profit{background:#f0fdf4;border-color:#bbf7d0;color:#15803d;}
        #pc_out_profit_pct{background:#f0fdf4;border-color:#bbf7d0;color:#15803d;}
        #pc_out_fcr{background:#fffbeb;border-color:#fde68a;color:#b45309;}
        #pc_out_epi{background:#f5f3ff;border-color:#ddd6fe;color:#6d28d9;}
        #pc_out_adg{background:#ecfeff;border-color:#a5f3fc;color:#0e7490;}
        #pc_out_gain,#pc_out_survival{background:#f0fdf4;border-color:#bbf7d0;color:#15803d;}
      </style>
      <div class="pc-wrap">
        ${this._pcSummary(data)}
        ${this._pcFormTop(data)}
        ${this._pcFormBottom(data)}
      </div>`;
  }

  recalcCompletionInputs() {
    const val = (id) => this._toNum(document.getElementById(id)?.value);
    const setOut = (id, value, suffix = "") => {
      const el = document.getElementById(id);
      if (!el) return;
      const num = value === null || value === undefined ? 0 : Number(value);
      const txt = num.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
      el.textContent = `${txt}${suffix}`.trim();
    };
    const initial = val("pc_initial") || 0;
    const sent = val("pc_sent") || 0;
    const live = val("pc_live") || 0;
    const carcass = val("pc_carcass") || 0;
    const price = val("pc_price") || 0;
    const feedSys = val("pc_feed_sys") || 0;
    const feedDecl = val("pc_feed_decl");
    const feed = feedSys;
    const sysSent = val("pc_sys_sent") || 0;
    const sysAvg = val("pc_sys_weight") || 0;
    const initWeight =
      val("pc_init_weight") || 0.04;
    const age = this._pcSlaughterAge();

    const mortality = initial > 0 ? Math.max(0, initial - sent) : 0;
    const mortalityPct = initial > 0 ? (mortality / initial) * 100 : 0;
    const survival = initial > 0 ? (sent / initial) * 100 : 0;
    const avgWeight = sent > 0 ? live / sent : 0;
    const carcassPct = carcass > 0 && live > 0 ? (carcass / live) * 100 : 0;
    const income = live * price;
    const costs = [
      "pc_cost_chick",
      "pc_cost_feed",
      "pc_cost_med",
      "pc_cost_fuel",
      "pc_cost_labor",
      "pc_cost_other",
    ].reduce((s, id) => s + (val(id) || 0), 0);
    const profit = income - costs;
    const profitPct = income > 0 ? (profit / income) * 100 : 0;
    const gainKg = sent > 0 && avgWeight > 0 ? (avgWeight - initWeight) * sent : 0;
    const adg = age > 0 && avgWeight > 0 ? ((avgWeight - initWeight) * 1000) / age : 0;
    const fcr = gainKg > 0 && feed > 0 ? feed / gainKg : 0;
    const epi = age > 0 && fcr > 0 && survival > 0 ? (avgWeight * survival * 100) / (age * fcr) : 0;

    // ===== شاخص‌های سیستم (از داده‌های هفتگی) =====
    const sysGainKg =
      sysSent > 0 && sysAvg > 0 ? (sysAvg - initWeight) * sysSent : 0;
    const sysSurvivalPct =
      initial > 0 ? (sysSent / initial) * 100 : 0;
    const sysFcr = sysGainKg > 0 && feed > 0 ? feed / sysGainKg : 0;
    const sysAdg =
      age > 0 && sysAvg > 0
        ? ((sysAvg - initWeight) * 1000) / age
        : 0;
    const sysEpi =
      age > 0 && sysFcr > 0 && sysSurvivalPct > 0
        ? (sysAvg * sysSurvivalPct * 100) / (age * sysFcr)
        : 0;

    // ===== شاخص‌های اعلامی مرغدار =====
    const hasFarmerFeed = feedDecl !== null && feedDecl !== undefined;
    const farFeed = feedDecl || 0;
    const farFcr =
      gainKg > 0 && farFeed > 0 ? farFeed / gainKg : 0;
    const farEpi =
      age > 0 && farFcr > 0 && survival > 0
        ? (avgWeight * survival * 100) / (age * farFcr)
        : 0;

    setOut("pc_out_sys_fcr", sysFcr);
    setOut("pc_out_sys_epi", sysEpi);
    setOut("pc_out_sys_adg", sysAdg);
    setOut("pc_out_sys_gain", sysGainKg);
    setOut("pc_out_sys_survival", sysSurvivalPct, "٪");
    setOut("pc_out_far_fcr", hasFarmerFeed ? farFcr : 0);
    setOut("pc_out_far_epi", hasFarmerFeed ? farEpi : 0);
    setOut("pc_out_far_adg", adg);
    setOut("pc_out_far_gain", gainKg);
    setOut("pc_out_far_survival", survival, "٪");

    setOut("pc_out_age", age);
    setOut("pc_out_mortality", mortality);
    setOut("pc_out_mortality_pct", mortalityPct, "٪");
    setOut("pc_out_avg", avgWeight);
    setOut("pc_out_yield", carcassPct, "٪");
    setOut("pc_out_feed_used", feed);
    setOut("pc_out_income", income);
    setOut("pc_out_total_cost", costs);
    setOut("pc_out_profit", profit);
    const profitEl = document.getElementById("pc_out_profit");
    if (profitEl) {
      profitEl.style.background =
        profit > 0 ? "#f0fdf4" : profit < 0 ? "#fef2f2" : "#f8fafc";
      profitEl.style.color =
        profit > 0 ? "#15803d" : profit < 0 ? "#b91c1c" : "#64748b";
      profitEl.style.borderColor =
        profit > 0 ? "#bbf7d0" : profit < 0 ? "#fecaca" : "#e2e8f0";
    }
    setOut("pc_out_profit_pct", profitPct, "٪");
    setOut("pc_out_fcr", fcr);
    setOut("pc_out_epi", epi);
    setOut("pc_out_adg", adg, "گرم/روز");
    setOut("pc_out_gain", gainKg);
    setOut("pc_out_survival", survival, "٪");
  }

  async _collectCompletionSave(flockId, halls) {
    const val = (id) => this._toNum(document.getElementById(id)?.value);
    const txt = (id) =>
      String(document.getElementById(id)?.value || "").trim();
    const round = (n) =>
      n === null || n === undefined || !Number.isFinite(Number(n))
        ? null
        : Math.round(Number(n) * 100) / 100;

    const initial = val("pc_initial") || 0;
    const sent = val("pc_sent") || 0;
    const live = val("pc_live") || 0;
    const carcass = val("pc_carcass") || 0;
    const price = val("pc_price") || 0;
    const feedSys = val("pc_feed_sys") || 0;
    const feedDecl = val("pc_feed_decl");
    const feed = feedSys;
    const sysSent = val("pc_sys_sent") || 0;
    const sysAvg = val("pc_sys_weight") || 0;
    const initWeight = val("pc_init_weight") || 0.04;
    const age = this._pcSlaughterAge();

    const sdateRaw = txt("pc_sdate");
    const sdate = sdateRaw
      ? convertPersianToGregorian(sdateRaw) || null
      : null;

    if (!sent || sent <= 0) {
      Swal.showValidationMessage(
        "تعداد ارسالی به کشتارگاه را وارد کنید (عدد مثبت)",
      );
      return false;
    }
    if (sent > initial) {
      Swal.showValidationMessage(
        "تعداد ارسالی به کشتارگاه نمی‌تواند از تعداد اولیه بیشتر باشد",
      );
      return false;
    }
    if (!live || live <= 0) {
      Swal.showValidationMessage("وزن کل زنده گله را وارد کنید");
      return false;
    }
    if (!sdate) {
      Swal.showValidationMessage("تاریخ کشتار معتبر نیست");
      return false;
    }

    const mortality = initial > 0 ? Math.max(0, initial - sent) : 0;
    const mortalityPct = initial > 0 ? (mortality / initial) * 100 : 0;
    const survival = initial > 0 ? (sent / initial) * 100 : 0;
    const avgWeight = sent > 0 ? live / sent : 0;
    const carcassPct =
      carcass > 0 && live > 0 ? (carcass / live) * 100 : 0;
    const income = live * price;
    const costs = [
      "pc_cost_chick",
      "pc_cost_feed",
      "pc_cost_med",
      "pc_cost_fuel",
      "pc_cost_labor",
      "pc_cost_other",
    ].reduce((s, id) => s + (val(id) || 0), 0);
    const profit = income - costs;
    const profitPct = income > 0 ? (profit / income) * 100 : 0;
    const gainKg =
      sent > 0 && avgWeight > 0 ? (avgWeight - initWeight) * sent : 0;
    const adg =
      age > 0 && avgWeight > 0
        ? ((avgWeight - initWeight) * 1000) / age
        : 0;
    const fcr = gainKg > 0 && feed > 0 ? feed / gainKg : 0;
    const epi =
      age > 0 && fcr > 0 && survival > 0
        ? (avgWeight * survival * 100) / (age * fcr)
        : 0;

    // ===== شاخص‌های سیستم =====
    const sysGainKg =
      sysSent > 0 && sysAvg > 0 ? (sysAvg - initWeight) * sysSent : 0;
    const sysSurvivalPct =
      initial > 0 ? (sysSent / initial) * 100 : 0;
    const sysFcr = sysGainKg > 0 && feed > 0 ? feed / sysGainKg : 0;
    const sysAdg =
      age > 0 && sysAvg > 0
        ? ((sysAvg - initWeight) * 1000) / age
        : 0;
    const sysEpi =
      age > 0 && sysFcr > 0 && sysSurvivalPct > 0
        ? (sysAvg * sysSurvivalPct * 100) / (age * sysFcr)
        : 0;

    // ===== شاخص‌های اعلامی مرغدار =====
    const hasFarmerFeed = feedDecl !== null && feedDecl !== undefined;
    const farFeed = feedDecl || 0;
    const farFcr =
      gainKg > 0 && farFeed > 0 ? farFeed / gainKg : 0;
    const farEpi =
      age > 0 && farFcr > 0 && survival > 0
        ? (avgWeight * survival * 100) / (age * farFcr)
        : 0;

    const sharedData = {
      completion_type: "completed",
      completion_date: new Date().toISOString().slice(0, 10),
      slaughter_age_days: age > 0 ? age : null,
      slaughter_date: sdate,
      slaughterhouse_name: txt("pc_slaughterhouse") || null,
      total_sent: sent,
      total_live_weight: round(live),
      avg_live_weight: round(avgWeight),
      total_mortality: mortality,
      mortality_rate: round(mortalityPct),
      farmer_total_feed: round(feedDecl),
      farmer_total_weight: round(live),
      carcass_weight_kg: round(carcass),
      carcass_yield_percent: round(carcassPct),
      price_per_kg: round(price),
      income_total: round(income),
      chick_cost: round(val("pc_cost_chick")),
      feed_cost: round(val("pc_cost_feed")),
      medication_cost: round(val("pc_cost_med")),
      fuel_cost: round(val("pc_cost_fuel")),
      labor_cost: round(val("pc_cost_labor")),
      other_cost: round(val("pc_cost_other")),
      total_cost: round(costs),
      net_profit: round(profit),
      profit_percent: round(profitPct),
      feed_basis: "system",
      final_fcr: round(fcr),
      epi: round(epi),
      adg_grams: round(adg),
      total_weight_gain_kg: round(gainKg),
      survival_percent: round(survival),
      system_epi: round(sysEpi),
      system_adg_grams: round(sysAdg),
      system_weight_gain_kg: round(sysGainKg),
      system_survival_percent: round(sysSurvivalPct),
      farmer_epi: round(hasFarmerFeed ? farEpi : null),
      farmer_adg_grams: round(adg),
      farmer_weight_gain_kg: round(gainKg),
      farmer_survival_percent: round(survival),
      farmer_fcr: round(hasFarmerFeed ? farFcr : null),
      confirmed_by_customer:
        !!document.getElementById("pc_confirmed")?.checked,
      notes: txt("pc_notes") || null,
    };

    const hallData = {};
    (Array.isArray(halls) ? halls : []).forEach((h) => {
      const pid = String(h.chick_placement_id);
      const sCount = val(`pc_hsent_${pid}`);
      const lw = val(`pc_hlive_${pid}`);
      const df = val(`pc_hfeed_${pid}`);
      if (sCount !== null || lw !== null || df !== null) {
        hallData[pid] = {
          sent_count: sCount,
          live_weight_kg: lw,
          declared_feed: df,
        };
      }
    });

    const response = await hatcheryApi.completeFlock(
      flockId,
      sharedData,
      hallData,
    );
    if (!response.success) {
      Swal.showValidationMessage(
        response.message || "خطا در ثبت پایان گله",
      );
      return false;
    }
    return true;
  }

  async _openFlockCompletionModal(data) {
    const flockId = data.flock?.id;
    const halls = Array.isArray(data.halls) ? data.halls : [];
    if (!flockId) return;

    const result = await Swal.fire({
      title: `ثبت پایان گله ${data.flock?.flock_number ?? ""} و اطلاعات کشتار`,
      html: this._pcForm(data),
      width: "1080px",
      showCancelButton: true,
      confirmButtonText: "🏁 ثبت و پایان گله",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#0d9488",
      reverseButtons: true,
      showCloseButton: true,
      didOpen: () => {
        try {
          if (
            typeof window.$ !== "undefined" &&
            window.$.fn &&
            window.$.fn.persianDatepicker
          ) {
            document.querySelectorAll(".pc-date").forEach((el) => {
              if (el.dataset.dp) return;
              window.$(el).persianDatepicker({
                format: "YYYY/MM/DD",
                autoClose: true,
                initialValue: false,
              });
              el.dataset.dp = "1";
            });
          }
        } catch (e) {
          /* ignore */
        }
        // سلکت قدیمی «مبنای محاسبه» حذف شد؛ شاخص‌ها حالا دوگانه محاسبه می‌شوند
        ["pc_feed_basis", "pc_out_feed_used"].forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const box = el.closest("div");
          if (box) box.style.display = "none";
        });
        this.recalcCompletionInputs();
      },
      preConfirm: async () => {
        const ok = await this._collectCompletionSave(flockId, halls);
        if (!ok) return false;
        return true;
      },
    });

    if (result.isConfirmed) {
      notificationService.success(
        "پایان دوره گله با موفقیت ثبت شد و گله بسته شد",
      );
      await this._refreshFlockViews();
    }
  }

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
                <label class="cf-label">تعداد ارسالی به کشتارگاه</label>
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
          const fmtNum = (v) =>
            v === null || v === undefined || v === ""
              ? "-"
              : Number(v).toLocaleString("fa-IR", {
                  maximumFractionDigits: 2,
                });
          const incomeValue =
            c.income_total ??
            (c.price_per_kg != null && c.total_live_weight != null
              ? Number(c.price_per_kg) * Number(c.total_live_weight)
              : null);
          const profitValue =
            c.net_profit ??
            (incomeValue !== null && c.total_cost != null
              ? Number(incomeValue) - Number(c.total_cost)
              : null);
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
              <td style="padding:8px; text-align:center;"><strong style="color:#d97706;">${c.final_fcr ?? c.system_fcr ?? "-"} / ${c.farmer_fcr ?? "-"}</strong></td>
              <td style="padding:8px; text-align:center;">${c.system_epi ?? c.epi ?? "-"} / ${c.farmer_epi ?? "-"}</td>
              <td style="padding:8px; text-align:center;">${c.system_adg_grams ?? c.adg_grams ?? "-"} / ${c.farmer_adg_grams ?? "-"}</td>
              <td style="padding:8px; text-align:center;">${fmtNum(incomeValue)}</td>
              <td style="padding:8px; text-align:center;">${fmtNum(c.total_cost)}</td>
              <td style="padding:8px; text-align:center;"><strong style="color:${profitValue !== null && Number(profitValue) >= 0 ? "#16a34a" : "#dc2626"};">${fmtNum(profitValue)}</strong></td>
              <td style="padding:8px; text-align:center;">${c.profit_percent != null ? `${c.profit_percent}٪` : "-"}</td>
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
                    <th style="padding:8px;">FCR (سیست/اعلام)</th>
                    <th style="padding:8px;">EPI (سیست/اعلام)</th>
                    <th style="padding:8px;">ADG (سیست/اعلام، گرم/روز)</th>
                    <th style="padding:8px;">درآمد کل</th>
                    <th style="padding:8px;">جمع هزینه‌ها</th>
                    <th style="padding:8px;">سود خالص</th>
                    <th style="padding:8px;">٪ سود</th>
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
                <label class="ue-label">تعداد ارسالی به کشتارگاه</label>
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
  window.resetChickRegisterTab = () => {
    hatcheryFormService.resetFlockForm();
    hatcheryService.refreshFlockPanel?.();
    hatcheryService.refreshExtraHalls?.();
  };
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
  window.editFlockGroup = (flockId) =>
    hatcheryService.editFlockGroup(flockId);
  window.deleteFlock = (id) => hatcheryService.deleteFlock(id);
  window.deleteFlockGroup = (flockId, fallbackId = null) =>
    hatcheryService.deleteFlockGroup(flockId, fallbackId);
  window.syncExtraHallDates = () => hatcheryService.syncExtraHallDates?.();
  window.toggleFlockStatus = (id) => hatcheryService.toggleFlockStatus(id);
  window.toggleFlockGroupStatus = (flockId) =>
    hatcheryService.toggleFlockGroupStatus(flockId);
  window.loadHallAreaForChick = (id) =>
    hatcheryService.loadHallAreaForFlock(id);
  window.calculateDensity = () => hatcheryService.calculateDensity();
  window.endActiveFlock = (flockId) => hatcheryService.endActiveFlock(flockId);
  window.endActiveFlockOf = (flockId) =>
    hatcheryService.completeFlockOf(flockId);
  window.completeFlockOf = (flockId) =>
    hatcheryService.completeFlockOf(flockId);
  window.hatcheryFormatToman = (el) =>
    hatcheryService.formatTomanInput(el);
  window.hatcheryRecalcCompletion = () =>
    hatcheryService.recalcCompletionInputs();
  window.addFlockBookmark = (flockId) => hatcheryService.addFlockBookmark(flockId);
  window.addFlockBookmarkOf = (flockId) =>
    hatcheryService.addFlockBookmark(flockId);
  window.sendFlockSms = (flockId) => hatcheryService.sendFlockSms(null, flockId);
  window.sendFlockSmsFlock = (flockId) =>
    hatcheryService.sendFlockSms(null, flockId);
  window.sendFlockSmsHall = (hallId) => hatcheryService.sendFlockSms(hallId, null);
  window.refreshFlockPanel = () => hatcheryService.refreshFlockPanel();
  window.printFlockCompletionReport = async (flockId) => {
    try {
      const { hatcheryReport } = await import("./hatchery.report.js");
      await hatcheryReport.generateFlockReport(flockId);
    } catch (error) {
      console.error("Error printing flock completion report:", error);
      notificationService.error("خطا در تولید گزارش پایان دوره گله");
    }
  };
  window.generateChickReport = async () => {
    try {
      const { hatcheryReport } = await import("./hatchery.report.js");
      await hatcheryReport.generateAndPrint("active");
    } catch (error) {
      console.error("❌ Error generating chick report:", error);
      notificationService.error("خطا در تولید گزارش");
    }
  };
  window.generateChickHistoryReport = async () => {
    try {
      const { hatcheryReport } = await import("./hatchery.report.js");
      await hatcheryReport.generateHistoryAndPrint();
    } catch (error) {
      console.error("❌ Error generating chick history report:", error);
      notificationService.error("خطا در تولید گزارش تاریخچه");
    }
  };
  window.viewFlockDetails = (id) => hatcheryService.viewFlockDetails(id);
  window.viewFlockGroup = (flockId) =>
    hatcheryService.viewFlockGroup(flockId);
  window.viewHygieneRecord = (id, hallId) =>
    hatcheryService.viewHygiene(id, hallId);
  window.editHygieneRecord = (id, hallId) =>
    hatcheryService.editHygiene(id, hallId);
  window.deleteHygieneRecord = (id) => hatcheryService.deleteHygiene(id);
}
