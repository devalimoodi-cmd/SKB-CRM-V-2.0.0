// ============================================================
// halls.systems.js
// ادیتور اقلام سیستم‌ها (loadSystemInfo/sysCatMeta/sysOptionsHtml/createSysRowHtml/renderSystemItemsEditor/جمع‌ها و ردیف‌ها)
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲c) — این دامنه از halls.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان halls-service-surface-test.mjs سطح اجرا را می‌سنجند).
// ترکیب: Object.assign(HallsService.prototype, hallsSystemMethods) در halls.service.js
// حجم: ۸ متد / ۱۶۷ خط
// ============================================================
import { hallsApi } from "./halls.api.js";

export const hallsSystemMethods = {
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
  },
  // ===== جزئیات انواع سیستم‌ها (گرمایش/سرمایش/فن) — جدول hall_system_items =====

  sysCatMeta() {
    return {
      heating: { title: "🔥 سیستم‌های گرمایش", dict: "heatingSystems", typePlaceholder: "انتخاب نوع گرمایش..." },
      cooling: { title: "❄️ سیستم‌های سرمایش", dict: "coolingSystems", typePlaceholder: "انتخاب نوع سرمایش..." },
      ventilation: { title: "🌀 سیستم‌های تهویه", dict: "ventilationTypes", typePlaceholder: "انتخاب نوع تهویه..." },
      sanitary: { title: "💧 سیستم‌های ورودی بهداشتی", dict: "waterInletTypes", typePlaceholder: "انتخاب نوع ورودی بهداشتی..." },
      lighting: { title: "💡 سیستم‌های روشنایی", dict: "lightingSystems", typePlaceholder: "انتخاب نوع روشنایی..." },
      fan: { title: "🌀 فن‌ها (اندازه + ظرفیت + تعداد)", dict: null, typePlaceholder: "" },
    };
  },
  sysOptionsHtml(dictKey, selected) {
    const list = (this.dictionaries || {})[dictKey] || [];
    let html = `<option value="">انتخاب کنید...</option>`;
    list.forEach((d) => {
      html += `<option value="${d.id}" ${String(d.id) === String(selected || "") ? "selected" : ""}>${d.name}</option>`;
    });
    return html;
  },
  createSysRowHtml(cat, item = {}) {
    const qty = parseInt(item.quantity) || 1;
    const _spec = item.spec || "";
    if (cat === "fan") {
      const size = item.size || item.spec || "";
      const capacity = item.capacity || "";
      return `
        <div class="sys-item-row" data-cat="fan" style="display:flex; align-items:center; gap:6px; margin:4px 0; flex-wrap:wrap;">
          <input type="text" class="sys-item-size" value="${size}" placeholder="اندازه/قطر فن (اینچ)" style="width:130px; padding:5px 8px; border:1px solid var(--border-color, #e2e8f0); border-radius:6px; font-size:12px;">
          <input type="text" class="sys-item-capacity" value="${capacity}" placeholder="ظرفیت (مترمکعب/ساعت)" style="width:140px; padding:5px 8px; border:1px solid var(--border-color, #e2e8f0); border-radius:6px; font-size:12px;">
          <input type="number" min="1" class="sys-item-qty" value="${qty}" placeholder="تعداد" style="width:80px; padding:5px 8px; border:1px solid var(--border-color, #e2e8f0); border-radius:6px; font-size:12px;">
          <button type="button" class="sys-item-del" onclick="removeSystemItemRow(this)" title="حذف"
            style="background:var(--danger-bg, #fee2e2); color:var(--danger-deep, #b91c1c); border:none; border-radius:6px; width:26px; height:26px; cursor:pointer;"><i class="fas fa-times"></i></button>
        </div>`;
    }
    const meta = this.sysCatMeta()[cat];
    const dictKey = meta?.dict;
    return `
      <div class="sys-item-row" data-cat="${cat}" style="display:flex; align-items:center; gap:6px; margin:4px 0; flex-wrap:wrap;">
        <select class="sys-item-type" style="min-width:190px; padding:5px 8px; border:1px solid var(--border-color, #e2e8f0); border-radius:6px; font-size:12px;">
          ${this.sysOptionsHtml(dictKey, item.type_id)}
        </select>
        <input type="number" min="1" class="sys-item-qty" value="${qty}" placeholder="تعداد" style="width:80px; padding:5px 8px; border:1px solid var(--border-color, #e2e8f0); border-radius:6px; font-size:12px;">
        <button type="button" class="sys-item-del" onclick="removeSystemItemRow(this)" title="حذف"
          style="background:var(--danger-bg, #fee2e2); color:var(--danger-deep, #b91c1c); border:none; border-radius:6px; width:26px; height:26px; cursor:pointer;"><i class="fas fa-times"></i></button>
      </div>`;
  },
  renderSystemItemsEditor(items = [], legacy = {}) {
    const container = document.getElementById("systemItemsEditor");
    if (!container) return;
    this.hideLegacySystemFields();

    const list = Array.isArray(items) ? items : [];

    // نگاشت فیلدهای قدیمی بالای فرم به ردیف‌های افزودنی (تا فیلدهای بالا و پایین یکی شوند)
    const legacyMap = {
      heating: { id: legacy.heating_system_id, qty: legacy.heater_count },
      cooling: { id: legacy.cooling_system_id, qty: 1 },
      ventilation: { id: legacy.ventilation_system_id, qty: 1 },
      sanitary: { id: legacy.water_inlet_system_id, qty: 1 },
      lighting: { id: legacy.lighting_system_id, qty: 1 },
    };

    const categoryOrder = [
      "heating",
      "cooling",
      "ventilation",
      "sanitary",
      "lighting",
      "fan",
    ];

    const group = (cat) => {
      const meta = this.sysCatMeta()[cat];
      let rows = list.filter((i) => i.category === cat);
      if (cat === "fan") {
        if (rows.length === 0 && (legacy.fan_count || legacy.fan_size || legacy.fan_capacity)) {
          rows.push({
            category: "fan",
            type_id: null,
            quantity: legacy.fan_count || 1,
            spec: legacy.fan_size || "",
            size: legacy.fan_size || "",
            capacity: legacy.fan_capacity || "",
          });
        }
      } else {
        const lm = legacyMap[cat];
        if (rows.length === 0 && lm && lm.id) {
          rows.push({
            category: cat,
            type_id: lm.id,
            quantity: lm.qty || 1,
            spec: null,
          });
        }
      }
      return `
        <div style="margin:8px 0 4px; padding:8px 10px; border:1px solid #e8edf3; border-radius:8px; background:#fbfdff;">
          <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
            <div style="font-weight:700; font-size:12px; color:var(--text-slate-strong, #334155);">${meta.title}</div>
            <span class="sys-cat-total" style="font-size:10.5px; color:var(--primary, #2c7a6e); background:var(--success-mist-2, #ecfdf5); border:1px solid var(--success-mist-4, #a7f3d0); padding:1px 10px; border-radius:999px; font-weight:600;">مجموع: ۰</span>
          </div>
          <div class="sys-rows" id="sysRows-${cat}">${rows
            .map((r) => this.createSysRowHtml(cat, r))
            .join("")}</div>
          <button type="button" class="btn btn-secondary" style="margin-top:4px; font-size:11px; padding:3px 10px;"
            onclick="addSystemItemRow('${cat}')"><i class="fas fa-plus"></i> افزودن</button>
        </div>`;
    };

    container.innerHTML = categoryOrder.map((c) => group(c)).join("");
    if (!container.dataset.totalBound) {
      container.addEventListener("input", () => this.updateCategoryTotals());
      container.dataset.totalBound = "1";
    }
    this.updateCategoryTotals();
  },
  // محاسبه و نمایش خودکار «مجموع تعداد» هر دسته
  updateCategoryTotals() {
    const container = document.getElementById("systemItemsEditor");
    if (!container) return;
    container.querySelectorAll(".sys-rows").forEach((rowsEl) => {
      const _cat = rowsEl.id.replace("sysRows-", "");
      const total = Array.from(rowsEl.querySelectorAll(".sys-item-qty")).reduce(
        (s, inp) => s + (parseInt(inp.value) || 0),
        0,
      );
      const badge = rowsEl.parentElement?.querySelector(".sys-cat-total");
      if (badge) badge.textContent = `مجموع: ${total}`;
    });
  },
  addSystemItemRow(cat) {
    const rowsEl = document.getElementById(`sysRows-${cat}`);
    if (!rowsEl) return;
    rowsEl.insertAdjacentHTML("beforeend", this.createSysRowHtml(cat, {}));
    this.updateCategoryTotals();
  },
  removeSystemItemRow(btn) {
    const row = btn?.closest(".sys-item-row");
    if (row) row.remove();
    this.updateCategoryTotals();
  },

};
