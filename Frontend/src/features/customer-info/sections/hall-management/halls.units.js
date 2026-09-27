// ============================================================
// halls.units.js
// واحدها (کارشناسان، جزئیات/ویرایش واحد، اطلاعات فیزیکی، حذف رکورد و ذخیرهٔ اطلاعات واحد)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲c) — این دامنه از halls.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان halls-service-surface-test.mjs سطح اجرا را می‌سنجند).
// ترکیب: Object.assign(HallsService.prototype, hallsUnitMethods) در halls.service.js
// حجم: ۱۶ متد / ۵۳۴ خط
// ============================================================
import { hallsApi } from "./halls.api.js";
import { hallsValidation } from "./halls.validation.js";
import { notificationService } from "../../../../core/services/notification.service.js";

export const hallsUnitMethods = {
  calculateArea() {
    const length = parseFloat(document.getElementById("length")?.value) || 0;
    const width = parseFloat(document.getElementById("width")?.value) || 0;
    const area = length * width;
    const areaField = document.getElementById("area");
    if (areaField) areaField.value = area > 0 ? area.toFixed(2) : "";
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
  },
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
        // لیست رفرش شد؛ کارت همان واحد باز بماند تا نام‌های جدید سالن‌ها دیده شود
        this.expandUnitCard(unitId);
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
  },
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
  },
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
  },
  // رندر پنل جزئیات واحد (برای renderer)
  renderUnitDetailsPanel(unit) {
    if (!unit) return "";

    // محاسبه زنده بر اساس رکوردهای واقعی سالن‌های همین واحد
    const { realHallCount, freeHtml } = computeUnitCapacityView(
      this.halls,
      unit,
    );

    const expertListHtml = buildUnitExpertChips(unit);

    return `
      <div class="unit-details-panel">
        ${buildUnitDetailsViewHtml({
          unit,
          realHallCount,
          freeHtml,
          expertListHtml,
        })}
        ${buildUnitEditFormHtml({ unit, realHallCount })}
      </div>
    `;
  },
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
  },
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
  },
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
  },
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
  },
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
  },

};

// ============================================================
//  توابع کمکی ماژول‌محلی renderUnitDetailsPanel (موج ۳.۲d — برش بدنه)
//  کد پیش‌تر داخل بدنهٔ متد بود؛ اینجا فقط «۸ فاصلهٔ خط اول» هر بلوک HTML
//  برداشته شده چون متد همان فاصله را در خط اسلات تأمین می‌کند؛ بنابراین
//  رشتهٔ HTML خروجی بایت‌به‌بایت ثابت است (گارد: npm run test:halls:body).
// ============================================================

function computeUnitCapacityView(halls, unit) {
  const unitHalls = (halls || []).filter((h) => h.unit_id == unit.id);
  const activeHalls = unitHalls.filter((h) => h.is_active !== false);
  const realHallCount = unitHalls.length;
  const unitCapacity = Number(unit.capacity) || 0;
  const usedCapacity = activeHalls.reduce(
    (sum, h) => sum + (Number(h.nominal_capacity) || 0),
    0,
  );
  const freeCapacity = unitCapacity - usedCapacity;

  const freeHtml =
    unitCapacity > 0
      ? freeCapacity >= 0
        ? `<span class="value">${freeCapacity.toLocaleString()} قطعه</span>`
        : `<span class="value" style="color:#dc2626;font-weight:700;">مازاد ${Math.abs(
              freeCapacity,
            ).toLocaleString()} قطعه</span>`
      : `<span class="value">—</span>`;
  return { realHallCount, freeHtml };
}

function buildUnitExpertChips(unit) {
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
  return expertListHtml;
}

function buildUnitDetailsViewHtml({
  unit,
  realHallCount,
  freeHtml,
  expertListHtml,
}) {
  return `<div class="unit-details-view">
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
                <span class="value">${realHallCount}</span>
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
              <div class="detail-icon"><i class="fas fa-chart-pie"></i></div>
              <div class="detail-content">
                <span class="label">ظرفیت خالی واحد</span>
                ${freeHtml}
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
        </div>`;
}

function buildUnitEditFormHtml({ unit, realHallCount }) {
  return `<div class="unit-details-edit" style="display:none;">
          <div class="unit-edit-form">
            <div class="form-grid">
              <div class="form-group"><label>نام واحد <span class="required">*</span></label><input type="text" id="editUnitName" value="${unit.unit_name || ""}"></div>
              <div class="form-group"><label>آدرس واحد</label><input type="text" id="editUnitAddress" value="${unit.address || ""}"></div>
              <div class="form-group"><label>طول جغرافیایی</label><input type="text" id="editUnitLongitude" value="${unit.longitude || ""}"></div>
              <div class="form-group"><label>عرض جغرافیایی</label><input type="text" id="editUnitLatitude" value="${unit.latitude || ""}"></div>
              <div class="form-group"><label>تعداد سالن‌ها <span class="required">*</span></label><input type="number" id="editUnitHallCount" min="1" max="99" value="${realHallCount || unit.hall_count || ""}"></div>
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
        </div>`;
}
