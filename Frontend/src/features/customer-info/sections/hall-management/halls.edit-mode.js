// ============================================================
// halls.edit-mode.js
// حالت ویرایش سالن (بنر، دکمه‌های تب‌ها، پرکردن دراپ‌داون‌ها، editHall/cancelEditHall)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲c) — این دامنه از halls.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان halls-service-surface-test.mjs سطح اجرا را می‌سنجند).
// ترکیب: Object.assign(HallsService.prototype, hallsEditModeMethods) در halls.service.js
// حجم: ۷ متد / ۲۳۵ خط
// ============================================================
import { hallsApi } from "./halls.api.js";
import { notificationService } from "../../../../core/services/notification.service.js";

export const hallsEditModeMethods = {
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },

};
