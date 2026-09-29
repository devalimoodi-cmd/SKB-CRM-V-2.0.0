// ============================================================
// halls.basic.js
// تب «اطلاعات پایه» (نام/شمارهٔ خودکار سالن، قفل فیلد، کارشناس پیش‌فرض، فیلدهای قدیمی، ظرفیت، ذخیره)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲c) — این دامنه از halls.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان halls-service-surface-test.mjs سطح اجرا را می‌سنجند).
// ترکیب: Object.assign(HallsService.prototype, hallsBasicMethods) در halls.service.js
// حجم: ۹ متد / ۳۹۳ خط
// ============================================================
import { hallsApi } from "./halls.api.js";
import { hallsValidation } from "./halls.validation.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import { authService } from "../../../../core/services/auth.service.js";

export const hallsBasicMethods = {
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
  },
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
  },
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
  },
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
  },
  // پنهان‌سازی فیلدهای تکراری بالای فرم سیستم‌ها (فقط ویرایشگر افزودنی مرجع است)
  hideLegacySystemFields() {
    const legacyIds = [
      "fanCount",
      "fanSize",
      "fanCapacity",
      "heaterCount",
      "heatingType",
      "coolingType",
      "ventilationType",
      "sanitarySystem",
      "lighthingSystem",
    ];
    legacyIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const wrap = el.closest(".form-group");
      if (wrap) wrap.style.display = "none";
      else el.style.display = "none";
      el.removeAttribute("required");
    });
  },
  fmtCap(n) {
    try {
      return Number(n || 0).toLocaleString("fa-IR");
    } catch {
      return String(Number(n || 0).toLocaleString());
    }
  },
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
      // محاسبه زنده: کل ظرفیت واحد، مجموع ظرفیت سالن‌های همان واحد و مانده
      const capInput = document.getElementById("capacity");
      const typed =
        capInput && capInput.value !== ""
          ? parseInt(capInput.value) || 0
          : 0;
      const unitCap = Number(row.unitCapacity) || 0;
      const savedHallsTotal = Number(row.totalCapacity) || 0;
      const occNote = row.activePlacementCount
        ? ` | ${row.occupiedHallCount} سالن در جوجه‌ریزی`
        : "";

      badge.style.background = "";
      badge.style.borderColor = "";
      badge.style.color = "";

      if (unitCap <= 0) {
        // واحد هنوز «ظرفیت کل» ندارد؛ فقط اطلاعات سالن‌ها را نشان بده
        badge.textContent = `ظرفیت کل واحد تعریف نشده — مجموع ظرفیت سالن‌های فعال: ${this.fmtCap(
          savedHallsTotal,
        )} قطعه`;
        this._capOverflowNotified = false;
        if (this._capOverflowDebounce) {
          clearTimeout(this._capOverflowDebounce);
          this._capOverflowDebounce = null;
        }
        badge.style.display = "block";
        return;
      }

      // مجموع ظرفیت سالن‌های ذخیره‌شدهٔ همین واحد
      let savedOthers = savedHallsTotal;
      if (this.editingHallId) {
        const eh = this.halls.find((h) => h.id == this.editingHallId);
        savedOthers = Math.max(
          0,
          savedOthers - (Number(eh?.nominal_capacity) || 0),
        );
      }

      const occupied = savedOthers + typed;
      const remaining = unitCap - occupied;

      if (remaining < 0) {
        badge.style.background = "#fef2f2";
        badge.style.borderColor = "#fecaca";
        badge.style.color = "#b91c1c";
        badge.textContent = `⚠️ مجموع ظرفیت سالن‌ها (${this.fmtCap(
          occupied,
        )}) از ظرفیت کل واحد (${this.fmtCap(unitCap)}) بیشتر است — مازاد: ${this.fmtCap(
          Math.abs(remaining),
        )} قطعه`;

        // الارم فقط یک‌بار برای هر رویداد تجاوز (با دیباس برای تایپ پیوسته)
        if (typed > 0) {
          if (this._capOverflowDebounce) clearTimeout(this._capOverflowDebounce);
          this._capOverflowDebounce = setTimeout(() => {
            this._capOverflowDebounce = null;
            if (this._capOverflowNotified) return;
            this._capOverflowNotified = true;
            try {
              notificationService.warning(
                `⚠️ مجموع ظرفیت سالن‌ها (${this.fmtCap(occupied)}) از ظرفیت کل واحد (${this.fmtCap(
                  unitCap,
                )}) بیشتر شد — مازاد ${this.fmtCap(Math.abs(remaining))} قطعه`,
              );
            } catch (e) {
              // ignore
            }
          }, 500);
        }
      } else {
        if (remaining <= unitCap * 0.1) {
          // نزدیک به ظرفیت: هشدار ملایم
          badge.style.background = "#fffbeb";
          badge.style.borderColor = "#fde68a";
          badge.style.color = "#b45309";
        }
        badge.textContent = `ظرفیت کل واحد: ${this.fmtCap(unitCap)} قطعه | مجموع سالن‌ها: ${this.fmtCap(
          occupied,
        )} قطعه | مانده: ${this.fmtCap(remaining)} قطعه${occNote}`;
        this._capOverflowNotified = false;
        if (this._capOverflowDebounce) {
          clearTimeout(this._capOverflowDebounce);
          this._capOverflowDebounce = null;
        }
      }

      badge.style.display = "block";
    } catch (err) {
      console.warn("⚠️ خطا در دریافت ظرفیت واحد:", err);
      badge.style.display = "none";
    }
  },
  async saveBasicInfo() {
    const saveBtn = document.querySelector("#basicTab .btn-primary");
    if (!saveBtn || saveBtn.disabled) return;
    const originalText = markBasicSaveBusy(saveBtn);

    const hallId = this.editingHallId;

    // ===== جمع‌آوری داده‌های همه تب‌ها =====
    const { basicData, physicalData, systemsData, waterFeedData } =
      readBasicInfoFormPayload(this.customerId);

    // ===== اعتبارسنجی همه داده‌ها =====
    const allErrors = collectBasicInfoErrors({
      hallId,
      basicData,
      physicalData,
      systemsData,
      waterFeedData,
    });
    if (allErrors.length > 0) {
      notificationService.showValidationErrors(allErrors);
      restoreBasicSaveButton(saveBtn, originalText);
      return;
    }

    try {
      const selectedHall = this.halls.find((h) => h.id == hallId);
      const _periodId = selectedHall?.period_id || null;

      if (hallId) {
        // ✅ حالت ویرایش - فقط اطلاعات پایه
        const response = await hallsApi.updateHall(hallId, basicData);
        restoreBasicSaveButton(saveBtn, originalText);

        if (response.success) {
          const summaryItems = buildBasicUpdateSummaryItems(basicData);

          showBasicUpdateSuccess(summaryItems);

          // بستن حالت ویرایش
          await exitBasicEditMode(this, saveBtn);
        } else {
          notificationService.error(response.message || "خطا در بروزرسانی");
        }
      } else {
        // حالت ثبت سالن جدید
        const response = await hallsApi.createHall(basicData);
        restoreBasicSaveButton(saveBtn, originalText);

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
      restoreBasicSaveButton(saveBtn, originalText);
      notificationService.error(error.message);
    }
  },
  getDictionaries() {
    return this.dictionaries;
  },

};

// ============================================================
//  توابع کمکی ماژول‌محلی saveBasicInfo (موج ۳.۲d — برش بدنه)
//  این کدها پیش‌تر داخل بدنهٔ متد بودند؛ بیرون کشیده شدند بدون هیچ
//  تغییر رفتاری یا ترتیبی. توابعی که سرویس را لازم دارند آن را پارامتر
//  می‌گیرند (`service`) تا ماژول‌محلی بمانند (بدون this).
// ============================================================

function markBasicSaveBusy(saveBtn) {
  const originalText = saveBtn.innerHTML;
  saveBtn.disabled = true;
  saveBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> در حال ذخیره...';
  return originalText;
}

function restoreBasicSaveButton(saveBtn, originalText) {
  saveBtn.disabled = false;
  saveBtn.innerHTML = originalText;
}

function readBasicInfoFormPayload(customerId) {
  const basicData = {
    customer_id: parseInt(customerId),
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
  return { basicData, physicalData, systemsData, waterFeedData };
}

function collectBasicInfoErrors({
  hallId,
  basicData,
  physicalData,
  systemsData,
  waterFeedData,
}) {
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

  return allErrors;
}

function buildBasicUpdateSummaryItems(basicData) {
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
  return summaryItems;
}

function showBasicUpdateSuccess(summaryItems) {
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
}

async function exitBasicEditMode(service, saveBtn) {
  service.editingHallId = null;
  service.setEditModeBanner(false);
  service.restoreTabButtonsToDefault();
  const cancelBtnB = document.getElementById("cancelEditHall");
  if (cancelBtnB) cancelBtnB.style.display = "none";
  saveBtn.innerHTML = '<i class="fas fa-save"></i> ذخیره اطلاعات پایه';
  saveBtn.style.background = "";
  saveBtn.dataset.mode = "";

  await service.loadData();
  service.resetTab("basicTab");
  service.refreshAllDropdowns();
}
