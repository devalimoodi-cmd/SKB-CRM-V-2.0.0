// ============================================================
// halls.forms.js
// ذخیره/بارگذاری فرم تب‌ها (فیزیکی، سیستم‌ها، آب و خوراک + setupSaveButtons)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲c) — این دامنه از halls.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان halls-service-surface-test.mjs سطح اجرا را می‌سنجند).
// ترکیب: Object.assign(HallsService.prototype, hallsFormMethods) در halls.service.js
// حجم: ۶ متد / ۳۵۳ خط
// ============================================================
import { hallsApi } from "./halls.api.js";
import { hallsValidation } from "./halls.validation.js";
import { notificationService } from "../../../../core/services/notification.service.js";

export const hallsFormMethods = {
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
  },
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
  },
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

    // ویرایشگر افزودنی (نوع + تعداد) تنها مرجع ثبت سیستم‌هاست
    const items = this.collectSystemItems();
    const catTotal = (c) =>
      items
        .filter((i) => i.category === c)
        .reduce((s, i) => s + (Number(i.quantity) || 1), 0);
    const catFirst = (c) => {
      const it = items.find((i) => i.category === c);
      return it?.type_id ? String(it.type_id) : null;
    };
    const fanRows = items.filter((i) => i.category === "fan");
    const firstFan = fanRows[0] || null;

    const data = {
      hall_id: parseInt(finalHallId),
      unit_id: unitId,
      fan_count: catTotal("fan") || null,
      fan_size: (firstFan?.size || firstFan?.spec || null),
      fan_capacity:
        (firstFan?.capacity || null) ||
        document.getElementById("fanCapacity")?.value ||
        null,
      heater_count: catTotal("heating") || null,
      heating_system_id: catFirst("heating"),
      cooling_system_id: catFirst("cooling"),
      ventilation_system_id: catFirst("ventilation"),
      water_inlet_system_id: catFirst("sanitary"),
      lighting_system_id: catFirst("lighting"),
      notes:
        document.getElementById("Hall-System-Description")?.value || null,
      items,
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
  },
  collectSystemItems() {
    const items = [];
    document.querySelectorAll("#systemItemsEditor .sys-item-row").forEach((row) => {
      const cat = row.dataset.cat;
      const typeSel = row.querySelector(".sys-item-type");
      const qtyVal = parseInt(row.querySelector(".sys-item-qty")?.value) || 1;
      const specVal = (row.querySelector(".sys-item-spec")?.value || "").trim();
      if (cat === "fan") {
        const size = (row.querySelector(".sys-item-size")?.value || specVal || "").trim();
        const capacity = (row.querySelector(".sys-item-capacity")?.value || "").trim();
        if (size || capacity || qtyVal > 1) {
          items.push({
            category: "fan",
            type_id: null,
            quantity: qtyVal,
            spec: size || specVal || null,
            size: size || null,
            capacity: capacity || null,
          });
        }
      } else {
        const tid = typeSel?.value;
        if (tid) items.push({ category: cat, type_id: tid, quantity: qtyVal, spec: specVal || null });
      }
    });
    return items;
  },
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
  },
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
  },

};
