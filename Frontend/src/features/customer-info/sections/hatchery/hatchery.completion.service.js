// ============================================================
// hatchery.completion.service.js
// خوشهٔ «پایان دوره/ویرایش پایان گله» بخش جوجه‌ریزی — به‌صورت mixin
// ------------------------------------------------------------
// چرا جدا شد؟ این خوشه ۳۹ متد و ~۲۳۰۰ خط از hatchery.service.js را
// می‌گرفت (≈۴۸٪ فایل) و بزرگ‌ترین «کلاس غول» پروژه را می‌ساخت (موج ۲).
// روش: شیء متدها روی prototype کلاس ترکیب می‌شود:
//   Object.assign(HatcheryService.prototype, hatcheryCompletionMethods)
// ✅ رفتار تغییر نکرده: متن متدها کلمه‌به‌کلمه منتقل شده و همهٔ `this.*`
//    و هندلرهای inline (window.*) دست‌نخورده کار می‌کنند، چون متدها
//    همچنان روی همان نمونهٔ کلاس اجرا می‌شوند.
// ⚠️ وابستگی‌ها فقط ۵ نماد است (hatcheryApi، notificationService،
//    تبدیل/قالب‌بندی تاریخ و دامنهٔ کشتار)؛ به ماژول‌های رندر/فرم/تب وابسته نیست.
// ============================================================
import { hatcheryApi } from "./hatchery.api.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
} from "../../../../core/utils/date.utils.js";
import {
  formatSlaughterRange,
  formatAgeRange,
} from "./hatchery.slaughter.utils.js";

export const hatcheryCompletionMethods = {
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
  },

  _pcSlaughterAgeAt(inputId) {
    const sdateRaw = String(
      document.getElementById(inputId)?.value || "",
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
  },

  _pcSlaughterAge() {
    return this._pcSlaughterAgeAt("pc_sdate");
  },

  _pcSlaughterEndAge() {
    return this._pcSlaughterAgeAt("pc_sdate_end");
  },

  // ============================================================
  // ابزارهای «روش ثبت سن کشتار» — بازهٔ تاریخی | ورود مستقیم | چندمرحله‌ای
  // ============================================================
  _pcDateIso(rawFa) {
    const s = String(rawFa || "").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const g = convertPersianToGregorian(s);
    if (!g) return null;
    return String(g).replace(/\//g, "-").slice(0, 10);
  },

  _pcFlockIso() {
    return (
      this._pcDateIso(document.getElementById("pc_flock_iso")?.value) || null
    );
  },

  _pcAgeOfIso(isoSlaughter, flockIsoArg) {
    const f = flockIsoArg || this._pcFlockIso();
    if (!f || !isoSlaughter) return null;
    const d1 = new Date(`${isoSlaughter}T00:00:00`);
    const d0 = new Date(`${f}T00:00:00`);
    if (Number.isNaN(d1.getTime()) || Number.isNaN(d0.getTime())) return null;
    const diff = Math.floor((d1 - d0) / 86400000) + 1;
    return diff > 0 ? diff : null;
  },

  _pcIsoFromAge(age, flockIsoArg) {
    const f = flockIsoArg || this._pcFlockIso();
    const n = Math.round(Number(age) || 0);
    if (!f || n < 1) return null;
    const d = new Date(`${f}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + n - 1);
    const p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  },

  _pcSlaughterMethodData() {
    const methodEl = document.getElementById("pc_age_method");
    const method = methodEl?.value || "range";
    const out = {
      method,
      age: 0,
      slaughterDate: null,
      slaughterEndDate: null,
      shipments: [],
    };

    if (method === "range") {
      out.slaughterDate = this._pcDateIso(
        document.getElementById("pc_sdate")?.value,
      );
      const endRaw = String(
        document.getElementById("pc_sdate_end")?.value || "",
      ).trim();
      out.slaughterEndDate = endRaw ? this._pcDateIso(endRaw) : null;
      if (out.slaughterEndDate === out.slaughterDate)
        out.slaughterEndDate = null;
      const a1 = this._pcAgeOfIso(out.slaughterDate);
      const a2 = out.slaughterEndDate
        ? this._pcAgeOfIso(out.slaughterEndDate)
        : a1;
      if (a1 && a2) out.age = Math.round((a1 + a2) / 2);
      else if (a1) out.age = a1;
      return out;
    }

    if (method === "direct") {
      const entered = Math.round(
        this._toNum(document.getElementById("pc_age_direct")?.value) || 0,
      );
      out.age = entered;
      out.slaughterDate = this._pcIsoFromAge(entered);
      return out;
    }

    // weighted — خواندن ردیف‌های ارسال از DOM
    document
      .querySelectorAll("#pc_ship_rows .pc-ship-row")
      .forEach((row) => {
        const a = Math.round(
          this._toNum(row.querySelector(".pc-ship-age")?.value) || 0,
        );
        const q = Math.round(
          this._toNum(row.querySelector(".pc-ship-qty")?.value) || 0,
        );
        if (a > 0 && q > 0) {
          out.shipments.push({
            age_days: a,
            quantity: q,
            date: this._pcIsoFromAge(a),
          });
        }
      });
    if (out.shipments.length) {
      const totalQty = out.shipments.reduce((s, r) => s + r.quantity, 0);
      out.age = Math.round(
        out.shipments.reduce((s, r) => s + r.age_days * r.quantity, 0) /
          totalQty,
      );
      const dates = out.shipments
        .map((r) => r.date)
        .filter(Boolean)
        .sort();
      out.slaughterDate = dates.length ? dates[0] : null;
      out.slaughterEndDate =
        dates.length > 1 ? dates[dates.length - 1] : null;
    }
    return out;
  },

  _renderPcMethodUi(d) {
    const setText = (id, t) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t;
    };
    const faInt = (n) =>
      (Number(n) || 0).toLocaleString("fa-IR", {
        maximumFractionDigits: 0,
      });

    if (d.method === "range") {
      const a1 = this._pcAgeOfIso(d.slaughterDate);
      const a2 = d.slaughterEndDate
        ? this._pcAgeOfIso(d.slaughterEndDate)
        : a1;
      if (d.slaughterDate && a2 && a2 !== a1) {
        setText(
          "pc_range_note",
          `سن شروع کشتار ${faInt(a1)} روز — سن پایان ${faInt(a2)} روز → میانگین سن کشتار ${faInt(
            d.age,
          )} روز`,
        );
      } else if (d.slaughterDate) {
        setText(
          "pc_range_note",
          `کشتار یک‌روزه — سن کشتار ${faInt(d.age)} روز`,
        );
      } else {
        setText("pc_range_note", "تاریخ شروع کشتار را وارد کنید");
      }
    } else if (d.method === "direct") {
      setText(
        "pc_direct_date",
        d.slaughterDate ? convertToPersianDate(d.slaughterDate) : "—",
      );
    } else {
      const totalQty = d.shipments.reduce((s, r) => s + r.quantity, 0);
      setText(
        "pc_weighted_note",
        d.shipments.length
          ? `${d.shipments.length} ارسال (مجموع ${faInt(
              totalQty,
            )} قطعه) → میانگین وزنی سن کشتار ${faInt(d.age)} روز`
          : "ردیفی اضافه کنید و برای هر ارسال سن و تعداد را وارد کنید",
      );
      // تاریخ هر ردیف به‌صورت خودکار به‌روز می‌شود
      document
        .querySelectorAll("#pc_ship_rows .pc-ship-row")
        .forEach((row) => {
          const dateEl = row.querySelector(".pc-ship-date");
          if (dateEl) {
            const dateIso = this._pcIsoFromAge(
              this._toNum(row.querySelector(".pc-ship-age")?.value),
            );
            dateEl.textContent = dateIso
              ? convertToPersianDate(dateIso)
              : "—";
          }
        });
    }

    const ageOut = document.getElementById("pc_out_age");
    if (ageOut) ageOut.textContent = faInt(d.age);
  },

  setPcSlaughterMethod(method) {
    if (!["range", "direct", "weighted"].includes(method)) method = "range";
    document.querySelectorAll(".pc-method-pill").forEach((btn) => {
      btn.classList.toggle("pc-method-active", btn.dataset.method === method);
    });
    const hiddenEl = document.getElementById("pc_age_method");
    if (hiddenEl) hiddenEl.value = method;
    ["range", "direct", "weighted"].forEach((m) => {
      const panel = document.getElementById(`pc_panel_${m}`);
      if (panel) panel.style.display = m === method ? "block" : "none";
    });
    if (
      method === "weighted" &&
      !document.querySelector("#pc_ship_rows .pc-ship-row")
    ) {
      this.addPcShipRow();
    }
    this.recalcCompletionInputs();
  },

  addPcShipRow(age = "", qty = "") {
    const container = document.getElementById("pc_ship_rows");
    if (!container) return;
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="pc-ship-row">
        <input type="number" min="1" class="pc-in pc-ship-age" placeholder="سن (روز)" value="${age}" oninput="hatcheryRecalcCompletion()">
        <input type="number" min="1" class="pc-in pc-ship-qty" placeholder="تعداد (قطعه)" value="${qty}" oninput="hatcheryRecalcCompletion()">
        <div class="pc-read pc-ship-date" title="تاریخ خودکار از سن و جوجه‌ریزی">—</div>
        <button type="button" class="pc-ship-del" title="حذف این ردیف" onclick="hatcheryRemovePcShip(this)"><i class="fas fa-times"></i></button>
      </div>`,
    );
  },

  removePcShip(btn) {
    const row = btn?.closest(".pc-ship-row");
    if (row) row.remove();
    this.recalcCompletionInputs();
  },

  // ============================================================
  // روش‌های سن کشتار در مودال ویرایش پایان دوره (UE)
  // ============================================================
  _ueFlockIso() {
    const raw = document.getElementById("ueFlockIso")?.value || "";
    return this._pcDateIso(raw) || null;
  },

  _ueMethodSlaughterData() {
    const methodEl = document.getElementById("ue_age_method");
    const method = methodEl?.value || "range";
    const base = this._ueFlockIso();
    const out = {
      method,
      age: 0,
      slaughterDate: null,
      slaughterEndDate: null,
      shipments: [],
    };

    if (method === "range") {
      out.slaughterDate = this._pcDateIso(
        document.getElementById("ueSlaughterDate")?.value,
      );
      const endRaw = String(
        document.getElementById("ueSlaughterEndDate")?.value || "",
      ).trim();
      out.slaughterEndDate = endRaw ? this._pcDateIso(endRaw) : null;
      if (out.slaughterEndDate === out.slaughterDate)
        out.slaughterEndDate = null;
      const a1 = this._pcAgeOfIso(out.slaughterDate, base);
      const a2 = out.slaughterEndDate
        ? this._pcAgeOfIso(out.slaughterEndDate, base)
        : a1;
      if (a1 && a2) out.age = Math.round((a1 + a2) / 2);
      else if (a1) out.age = a1;
      return out;
    }

    if (method === "direct") {
      const entered = Math.round(
        this._toNum(document.getElementById("ueAgeDirect")?.value) || 0,
      );
      out.age = entered;
      out.slaughterDate = this._pcIsoFromAge(entered, base);
      return out;
    }

    // weighted
    document
      .querySelectorAll("#ue_ship_rows .ue-ship-row")
      .forEach((row) => {
        const a = Math.round(
          this._toNum(row.querySelector(".ue-ship-age")?.value) || 0,
        );
        const q = Math.round(
          this._toNum(row.querySelector(".ue-ship-qty")?.value) || 0,
        );
        if (a > 0 && q > 0) {
          out.shipments.push({
            age_days: a,
            quantity: q,
            date: this._pcIsoFromAge(a, base),
          });
        }
      });
    if (out.shipments.length) {
      const totalQty = out.shipments.reduce((s, r) => s + r.quantity, 0);
      out.age = Math.round(
        out.shipments.reduce((s, r) => s + r.age_days * r.quantity, 0) /
          totalQty,
      );
      const dates = out.shipments
        .map((r) => r.date)
        .filter(Boolean)
        .sort();
      out.slaughterDate = dates.length ? dates[0] : null;
      out.slaughterEndDate =
        dates.length > 1 ? dates[dates.length - 1] : null;
    }
    return out;
  },

  ueRecalcSlaughterMethod() {
    const d = this._ueMethodSlaughterData();
    const setText = (id, t) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t;
    };
    const faInt = (n) =>
      (Number(n) || 0).toLocaleString("fa-IR", {
        maximumFractionDigits: 0,
      });

    if (d.method === "range") {
      const base = this._ueFlockIso();
      const a1 = this._pcAgeOfIso(d.slaughterDate, base);
      const a2 = d.slaughterEndDate
        ? this._pcAgeOfIso(d.slaughterEndDate, base)
        : a1;
      if (d.slaughterDate && a2 && a2 !== a1) {
        setText(
          "ue_range_note",
          `سن شروع ${faInt(a1)} روز — سن پایان ${faInt(a2)} روز → میانگین ${faInt(
            d.age,
          )} روز`,
        );
      } else if (d.slaughterDate) {
        setText("ue_range_note", `کشتار یک‌روزه — سن ${faInt(d.age)} روز`);
      } else {
        setText("ue_range_note", "تاریخ شروع کشتار را وارد کنید");
      }
    } else if (d.method === "direct") {
      setText(
        "ue_direct_date",
        d.slaughterDate ? convertToPersianDate(d.slaughterDate) : "—",
      );
    } else {
      const totalQty = d.shipments.reduce((s, r) => s + r.quantity, 0);
      setText(
        "ue_weighted_note",
        d.shipments.length
          ? `${d.shipments.length} ارسال (مجموع ${faInt(
              totalQty,
            )} قطعه) → میانگین وزنی سن ${faInt(d.age)} روز`
          : "ردیفی اضافه کنید و برای هر ارسال سن و تعداد را وارد کنید",
      );
      document
        .querySelectorAll("#ue_ship_rows .ue-ship-row")
        .forEach((row) => {
          const dateEl = row.querySelector(".ue-ship-date");
          if (dateEl) {
            const dateIso = this._pcIsoFromAge(
              this._toNum(row.querySelector(".ue-ship-age")?.value),
              this._ueFlockIso(),
            );
            dateEl.textContent = dateIso
              ? convertToPersianDate(dateIso)
              : "—";
          }
        });
    }

    const ageOut = document.getElementById("ue_out_age");
    if (ageOut) ageOut.textContent = faInt(d.age);
    return d;
  },

  setUeSlaughterMethod(method) {
    if (!["range", "direct", "weighted"].includes(method)) method = "range";
    document.querySelectorAll(".ue-method-pill").forEach((btn) => {
      btn.classList.toggle("ue-method-active", btn.dataset.method === method);
    });
    const hiddenEl = document.getElementById("ue_age_method");
    if (hiddenEl) hiddenEl.value = method;
    ["range", "direct", "weighted"].forEach((m) => {
      const panel = document.getElementById(`ueMethodPanel_${m}`);
      if (panel) panel.style.display = m === method ? "block" : "none";
    });
    if (
      method === "weighted" &&
      !document.querySelector("#ue_ship_rows .ue-ship-row")
    ) {
      this.addUeShipRow();
    }
    this.ueRecalcSlaughterMethod();
  },

  addUeShipRow(age = "", qty = "", dateIso = "") {
    const container = document.getElementById("ue_ship_rows");
    if (!container) return;
    const dateText = dateIso ? convertToPersianDate(dateIso) : "";
    container.insertAdjacentHTML(
      "beforeend",
      `<div class="ue-ship-row">
        <input type="number" min="1" class="ue-field ue-ship-age" placeholder="سن (روز)" value="${age}" oninput="hatcheryUeRecalc()">
        <input type="number" min="1" class="ue-field ue-ship-qty" placeholder="تعداد (قطعه)" value="${qty}" oninput="hatcheryUeRecalc()">
        <div class="ue-field ue-ship-date" title="تاریخ خودکار">${dateText || "—"}</div>
        <button type="button" class="ue-ship-del" title="حذف ردیف" onclick="hatcheryRemoveUeShip(this)"><i class="fas fa-times"></i></button>
      </div>`,
    );
  },

  removeUeShip(btn) {
    const row = btn?.closest(".ue-ship-row");
    if (row) row.remove();
    this.ueRecalcSlaughterMethod();
  },

  _ueSlaughterSectionHtml(c, flock) {
    const method = c.slaughter_age_method || (
      c.slaughter_end_date || c.slaughter_age_end_days ? "range" : "direct"
    );
    const flockIso =
      flock?.placement_date || c.flock?.placement_date || "";
    const startFa = c.slaughter_date
      ? convertToPersianDate(c.slaughter_date)
      : "";
    const endFa = c.slaughter_end_date
      ? convertToPersianDate(c.slaughter_end_date)
      : "";
    const shipments = Array.isArray(c.slaughter_shipments)
      ? c.slaughter_shipments
      : [];

    const shipRowsHtml = shipments.length
      ? shipments
          .map(
            (s) =>
              `<div class="ue-ship-row">
                <input type="number" min="1" class="ue-field ue-ship-age" placeholder="سن (روز)" value="${s.age_days ?? ""}" oninput="hatcheryUeRecalc()">
                <input type="number" min="1" class="ue-field ue-ship-qty" placeholder="تعداد (قطعه)" value="${s.quantity ?? ""}" oninput="hatcheryUeRecalc()">
                <div class="ue-field ue-ship-date" title="تاریخ خودکار">${s.date ? convertToPersianDate(s.date) : "—"}</div>
                <button type="button" class="ue-ship-del" title="حذف ردیف" onclick="hatcheryRemoveUeShip(this)"><i class="fas fa-times"></i></button>
              </div>`,
          )
          .join("")
      : "";

    return `
      <div class="ue-section">
        <div class="ue-section-title"><i class="fas fa-calendar-check"></i> سن کشتار — روش ثبت</div>
        <input type="hidden" id="ueFlockIso" value="${flockIso}">
        <input type="hidden" id="ue_age_method" value="${method}">
        <div class="ue-method-pills">
          <button type="button" class="ue-method-pill ${method === "range" ? "ue-method-active" : ""}" data-method="range" onclick="hatcherySetUeMethod('range')"><i class="fas fa-calendar-week"></i> بازهٔ تاریخی</button>
          <button type="button" class="ue-method-pill ${method === "direct" ? "ue-method-active" : ""}" data-method="direct" onclick="hatcherySetUeMethod('direct')"><i class="fas fa-arrow-left"></i> ورود مستقیم سن</button>
          <button type="button" class="ue-method-pill ${method === "weighted" ? "ue-method-active" : ""}" data-method="weighted" onclick="hatcherySetUeMethod('weighted')"><i class="fas fa-truck-fast"></i> ارسال چندمرحله‌ای</button>
        </div>

        <div class="ue-method-panel" id="ueMethodPanel_range" style="${method === "range" ? "" : "display:none;"}">
          <div class="ue-2col">
            <div>
              <label class="ue-label">تاریخ شروع کشتار</label>
              <input type="text" id="ueSlaughterDate" class="ue-field" placeholder="۱۴۰۴/۰۱/۰۱" value="${startFa}" onchange="hatcheryUeRecalc()">
            </div>
            <div>
              <label class="ue-label">تاریخ پایان کشتار</label>
              <input type="text" id="ueSlaughterEndDate" class="ue-field" placeholder="۱۴۰۴/۰۱/۰۱" value="${endFa}" onchange="hatcheryUeRecalc()">
            </div>
          </div>
          <div class="ue-age-calc-note" id="ue_range_note"></div>
        </div>

        <div class="ue-method-panel" id="ueMethodPanel_direct" style="${method === "direct" ? "" : "display:none;"}">
          <div class="ue-2col">
            <div>
              <label class="ue-label">سن کشتار (روز) *</label>
              <input type="number" min="1" id="ueAgeDirect" class="ue-field" placeholder="مثلاً ۴۲" value="${method === "direct" ? (c.slaughter_age_days ?? "") : ""}" oninput="hatcheryUeRecalc()">
            </div>
            <div>
              <label class="ue-label">تاریخ کشتار (محاسبه‌شده)</label>
              <div class="ue-field" id="ue_direct_date" style="background:#f1f5f9;padding-top:10px;">—</div>
            </div>
          </div>
          <div class="ue-age-calc-note">تاریخ بر اساس سن و تاریخ جوجه‌ریزی به‌صورت خودکار محاسبه می‌شود.</div>
        </div>

        <div class="ue-method-panel" id="ueMethodPanel_weighted" style="${method === "weighted" ? "" : "display:none;"}">
          <div style="margin-bottom:8px;">
            <button type="button" class="ue-add-ship" onclick="hatcheryAddUeShip()"><i class="fas fa-plus"></i> افزودن ارسال</button>
          </div>
          <div id="ue_ship_rows">${shipRowsHtml}</div>
          <div class="ue-age-calc-note">میانگین وزنی: <b id="ue_weighted_note">—</b></div>
        </div>

        <div style="margin-top:10px; display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px;">
          <div>
            <label class="ue-label">سن کشتار نهایی (روز)</label>
            <div class="ue-field" id="ue_out_age" style="background:#faf5ff;border-color:#e9d5ff;color:#7c3aed;font-weight:800;font-size:15px;padding-top:10px;">${c.slaughter_age_days != null ? Number(c.slaughter_age_days).toLocaleString("fa-IR") : "۰"}</div>
          </div>
        </div>
      </div>`;
  },

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
  },

  _pcNormKg(value) {
    const n = parseFloat(value);
    if (Number.isNaN(n) || n <= 0) return 0.04;
    // اگر مقدار برحسب گرم ذخیره شده (مثلاً 42.5) به کیلوگرم تبدیل می‌شود
    return n < 1 ? n : n / 1000;
  },

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
  },

  // ===== ویرایش / اصلاح اطلاعات پایان دوره یک گلهٔ تکمیل‌شده =====
  async editFlockCompletion(flockId) {
    try {
      notificationService.showLoading("در حال دریافت اطلاعات پایان دوره...");
      let compRes;
      let prevRes;
      try {
        [compRes, prevRes] = await Promise.all([
          hatcheryApi.getFlockCompletionByFlock(flockId),
          hatcheryApi.getFlockCompletionPreview(flockId),
        ]);
      } finally {
        notificationService.hideLoading();
      }

      if (!compRes?.success || !compRes.data) {
        notificationService.warning(
          "برای این گله اطلاعات پایان دوره‌ای ثبت نشده است",
        );
        return;
      }
      if (!prevRes?.success || !prevRes.data) {
        notificationService.error(
          prevRes?.message || "خطا در دریافت داده‌های گله",
        );
        return;
      }

      const comp = compRes.data;
      const preview = prevRes.data;

      // نقشه ریز سالن‌ها با کلید chick_placement_id
      const hallsMap = {};
      (comp.hallDetails || []).forEach((d) => {
        if (!d || !d.chick_placement_id) return;
        hallsMap[String(d.chick_placement_id)] = {
          sent_to_slaughter_count: d.sent_to_slaughter_count,
          live_weight_kg: d.live_weight_kg,
          declared_feed_intake: d.declared_feed_intake,
        };
      });

      const existing = {
        completionId: comp.id,
        completion_date: comp.completion_date,
        completion_type: comp.completion_type,
        confirmed_by_customer: comp.confirmed_by_customer,
        slaughter_age_method: comp.slaughter_age_method,
        slaughter_age_days: comp.slaughter_age_days,
        slaughter_age_end_days: comp.slaughter_age_end_days,
        slaughter_date: comp.slaughter_date,
        slaughter_end_date: comp.slaughter_end_date,
        slaughter_shipments: comp.slaughter_shipments,
        slaughterhouse_name: comp.slaughterhouse_name,
        total_sent: comp.total_sent,
        total_live_weight: comp.total_live_weight,
        avg_live_weight: comp.avg_live_weight,
        total_mortality: comp.total_mortality,
        mortality_rate: comp.mortality_rate,
        farmer_total_feed: comp.farmer_total_feed,
        farmer_fcr: comp.farmer_fcr,
        price_per_kg: comp.price_per_kg,
        income_total: comp.income_total,
        chick_cost: comp.chick_cost,
        feed_cost: comp.feed_cost,
        medication_cost: comp.medication_cost,
        fuel_cost: comp.fuel_cost,
        labor_cost: comp.labor_cost,
        other_cost: comp.other_cost,
        carcass_weight_kg: comp.carcass_weight_kg,
        carcass_yield_percent: comp.carcass_yield_percent,
        feed_basis: comp.feed_basis,
        notes: comp.notes,
        halls: hallsMap,
      };

      await this._openFlockCompletionModal(preview, existing);
    } catch (error) {
      console.error("❌ Error editing flock completion:", error);
      notificationService.error("خطا در باز کردن ویرایش پایان دوره");
    }
  },

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
  },

  _pcRead(label, id, unit = "") {
    return `<div style="margin-bottom:7px;">
      <label class="pc-label">${label}${
        unit ? ` <small style="color:#94a3b8;">(${unit})</small>` : ""
      }</label>
      <div id="${id}" class="pc-read">۰</div>
    </div>`;
  },

  _pcHallBlock(hall, ex = null) {
    const hid = hall.chick_placement_id;
    const hx = (ex && ex.halls && ex.halls[String(hid)]) || {};
    const hSent = hx.sent_to_slaughter_count ?? "";
    const hLive = hx.live_weight_kg ?? "";
    const hFeed = hx.declared_feed_intake ?? "";
    return `<div class="pc-hall">
      <div style="font-weight:700;font-size:12px;color:#2c7a6e;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
        <i class="fas fa-warehouse"></i> ${hall.hall_name || `سالن ${hall.hall_id}`}
        <span style="font-weight:500;font-size:10.5px;color:#64748b;">(اولیه: ${Number(
          hall.initial_chicks_count || 0,
        ).toLocaleString("fa-IR")} قطعه)</span>
      </div>
      <div class="pc-grid">
        ${this._pcRow("تعداد ارسالی به کشتارگاه (اختیاری)", `pc_hsent_${hid}`, hSent, {
          placeholder: "مثلاً ۹۵۰۰",
        })}
        ${this._pcRow("وزن زنده سالن (کیلوگرم)", `pc_hlive_${hid}`, hLive, {
          placeholder: "مثلاً ۲۳۵۰۰",
        })}
        ${this._pcRow("خوراک اعلامی سالن (کیلوگرم)", `pc_hfeed_${hid}`, hFeed, {
          placeholder: "اختیاری",
        })}
      </div>
    </div>`;
  },

  _pcFormTop(data, ex = null) {
    const flock = data.flock || {};
    const halls = Array.isArray(data.halls) ? data.halls : [];
    const s = data.summary || {};
    const today = new Date().toISOString().slice(0, 10);
    const method =
      ex && ["range", "direct", "weighted"].includes(ex.slaughter_age_method)
        ? ex.slaughter_age_method
        : "range";
    const startDate = ex?.slaughter_date
      ? convertToPersianDate(ex.slaughter_date)
      : convertToPersianDate(today);
    const endDate = ex?.slaughter_end_date
      ? convertToPersianDate(ex.slaughter_end_date)
      : "";
    const exVal = (v) => (v === null || v === undefined ? "" : v);
    return `
      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-id-card"></i> ۱) اطلاعات هویتی گله</div>
        <div class="pc-grid">
          ${this._pcRow("شماره گله", "pc_fnum", flock.flock_number ?? "", { type: "text", readOnly: true })}
          ${this._pcRow("نام مرغدار", "pc_customer", flock.customer_name ?? "", { type: "text", readOnly: true })}
          ${this._pcRow("واحد مرغداری", "pc_unit", flock.unit_name ?? "", { type: "text", readOnly: true })}
          ${this._pcRow("تعداد سالن‌ها", "pc_halls", halls.length, { type: "number", readOnly: true })}
          ${this._pcRow("تاریخ جوجه‌ریزی", "pc_pdate", flock.placement_date ? convertToPersianDate(flock.placement_date) : "", { type: "text", readOnly: true })}
          <input type="hidden" id="pc_flock_iso" value="${flock.placement_date ?? ""}">
        </div>
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-calendar-check"></i> ۲) سن کشتار — انتخاب روش ثبت</div>

        <div class="pc-method-pills">
          <button type="button" class="pc-method-pill ${method === "range" ? "pc-method-active" : ""}" data-method="range" onclick="hatcherySetPcMethod('range')"><i class="fas fa-calendar-week"></i> بازهٔ تاریخی</button>
          <button type="button" class="pc-method-pill ${method === "direct" ? "pc-method-active" : ""}" data-method="direct" onclick="hatcherySetPcMethod('direct')"><i class="fas fa-arrow-left"></i> ورود مستقیم سن</button>
          <button type="button" class="pc-method-pill ${method === "weighted" ? "pc-method-active" : ""}" data-method="weighted" onclick="hatcherySetPcMethod('weighted')"><i class="fas fa-truck-fast"></i> ارسال چندمرحله‌ای</button>
        </div>
        <input type="hidden" id="pc_age_method" value="${method}">

        <!-- پنل روش ۱: بازهٔ تاریخی -->
        <div class="pc-method-panel" id="pc_panel_range" style="display:${method === "range" ? "block" : "none"};">
          <div class="pc-grid">
            <div style="margin-bottom:7px;">
              <label class="pc-label">تاریخ شروع کشتار <small style="color:#b45309;">* اعلامی مرغدار</small></label>
              <input type="text" id="pc_sdate" class="pc-in pc-date" value="${startDate}" onchange="hatcheryRecalcCompletion()" oninput="hatcheryRecalcCompletion()">
            </div>
            <div style="margin-bottom:7px;">
              <label class="pc-label">تاریخ پایان کشتار <small style="color:#94a3b8;">(اختیاری — اگر کشتار چند روز طول بکشد)</small></label>
              <input type="text" id="pc_sdate_end" class="pc-in pc-date" value="${endDate}" onchange="hatcheryRecalcCompletion()" oninput="hatcheryRecalcCompletion()">
            </div>
          </div>
          <div class="pc-age-calc-note" id="pc_range_note"></div>
        </div>

        <!-- پنل روش ۲: ورود مستقیم سن -->
        <div class="pc-method-panel" id="pc_panel_direct" style="display:${method === "direct" ? "block" : "none"};">
          <div class="pc-grid">
            <div style="margin-bottom:7px;">
              <label class="pc-label">سن کشتار (روز) <small style="color:#b45309;">*</small></label>
              <input type="number" min="1" id="pc_age_direct" class="pc-in" value="${exVal(ex?.slaughter_age_days)}" placeholder="مثلاً ۴۲" oninput="hatcheryRecalcCompletion()">
            </div>
            <div style="margin-bottom:7px;">
              <label class="pc-label">تاریخ کشتار (محاسبه‌شده)</label>
              <div class="pc-read" id="pc_direct_date">—</div>
            </div>
          </div>
          <div class="pc-age-calc-note">تاریخ ارسال بر اساس سن واردشده و تاریخ جوجه‌ریزی به‌صورت خودکار محاسبه می‌شود.</div>
        </div>

        <!-- پنل روش ۳: چند ارسال با میانگین وزنی -->
        <div class="pc-method-panel" id="pc_panel_weighted" style="display:${method === "weighted" ? "block" : "none"};">
          <div style="margin-bottom:8px;">
            <button type="button" class="pc-add-ship" onclick="hatcheryAddPcShip()"><i class="fas fa-plus"></i> افزودن ارسال</button>
          </div>
          <div id="pc_ship_rows"></div>
          <div class="pc-age-calc-note">میانگین وزنی: <b id="pc_weighted_note">—</b></div>
        </div>

        <div style="margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:10px 16px;">
          <div style="margin-bottom:7px;">
            <label class="pc-label">سن کشتار نهایی (روز)</label>
            ${this._pcRead("", "pc_out_age")}
          </div>
          <div style="margin-bottom:7px;">
            <label class="pc-label">نام کشتارگاه <small style="color:#94a3b8;">(اختیاری)</small></label>
            <input type="text" id="pc_slaughterhouse" class="pc-in" value="${ex?.slaughterhouse_name || ""}" placeholder="اختیاری">
          </div>
        </div>
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-users"></i> ۳) اطلاعات جمعیتی (تعداد)</div>
        <div class="pc-grid">
          ${this._pcRow("تعداد اولیه جوجه‌ها", "pc_initial", s.initial_chicks_count ?? 0, { readOnly: true })}
          ${this._pcRow("تعداد ارسالی به کشتارگاه", "pc_sent", exVal(ex?.total_sent), { min: 1, placeholder: "مثلاً ۹۵۰۰" })}
          ${this._pcRead("تلفات کل (خودکار)", "pc_out_mortality", "قطعه")}
          ${this._pcRead("درصد تلفات (خودکار)", "pc_out_mortality_pct", "٪")}
        </div>
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-weight-scale"></i> ۴) اطلاعات وزنی</div>
        <div class="pc-grid">
          ${this._pcRow("وزن کل زنده گله", "pc_live", exVal(ex?.total_live_weight), { min: 1, placeholder: "مثلاً ۲۴۰۰۰", unit: "کیلوگرم" })}
          ${this._pcRow("وزن لاشه (اختیاری)", "pc_carcass", exVal(ex?.carcass_weight_kg), { min: 0, unit: "کیلوگرم" })}
          ${this._pcRead("میانگین وزن هر قطعه", "pc_out_avg", "کیلوگرم")}
          ${this._pcRead("درصد راندمان لاشه", "pc_out_yield", "٪")}
        </div>
      </div>

      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-wheat-awn"></i> ۵) اطلاعات خوراک</div>
        <div class="pc-grid">
          ${this._pcRow("کل خوراک سیستم", "pc_feed_sys", s.system_total_feed ?? 0, { readOnly: true, unit: "کیلوگرم" })}
          ${this._pcRow("خوراک اعلامی مرغدار", "pc_feed_decl", exVal(ex?.farmer_total_feed), { min: 0, unit: "کیلوگرم", placeholder: "اختیاری" })}
          <div style="margin-bottom:7px;">
            <label class="pc-label">مبنای محاسبه FCR</label>
            <select id="pc_feed_basis" class="pc-in" onchange="hatcheryRecalcCompletion()">
              <option value="system" ${ex?.feed_basis !== "declared" ? "selected" : ""}>سیستم</option>
              <option value="declared" ${ex?.feed_basis === "declared" ? "selected" : ""}>اعلامی مرغدار</option>
            </select>
          </div>
          ${this._pcRead("خوراک مبنای محاسبه", "pc_out_feed_used", "کیلوگرم")}
        </div>
      </div>`;
  },

  _pcFormBottom(data, ex = null) {
    const s = data.summary || {};
    const halls = Array.isArray(data.halls) ? data.halls : [];
    const initWeight = this._pcNormKg(s.initial_avg_weight);
    const exVal = (v) => (v === null || v === undefined ? "" : v);
    const hallBlocks = halls
      .map((h) => this._pcHallBlock(h, ex))
      .join('<div style="height:6px;"></div>');
    return `
      <div class="pc-sec">
        <div class="pc-sec-title"><i class="fas fa-coins"></i> ۶) اطلاعات اقتصادی</div>
        <div class="pc-grid">
          ${this._pcRow("قیمت هر کیلو گوشت مرغ زنده (تومان)", "pc_price", exVal(ex?.price_per_kg), { type: "text", placeholder: "مثلاً ۸۵,۰۰۰", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRead("درآمد کل", "pc_out_income", "تومان")}
          ${this._pcRow("هزینه جوجه (تومان)", "pc_cost_chick", exVal(ex?.chick_cost), { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("هزینه خوراک (تومان)", "pc_cost_feed", exVal(ex?.feed_cost), { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("هزینه دارو و واکسن (تومان)", "pc_cost_med", exVal(ex?.medication_cost), { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("هزینه سوخت (تومان)", "pc_cost_fuel", exVal(ex?.fuel_cost), { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("هزینه نیروی انسانی (تومان)", "pc_cost_labor", exVal(ex?.labor_cost), { type: "text", onblur: "hatcheryFormatToman(this)" })}
          ${this._pcRow("سایر هزینه‌ها (تومان)", "pc_cost_other", exVal(ex?.other_cost), { type: "text", onblur: "hatcheryFormatToman(this)" })}
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
        <textarea id="pc_notes" class="pc-note" rows="2" placeholder="توضیحات تکمیلی (اختیاری)...">${ex?.notes || ""}</textarea>
        <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:#475569;margin-top:8px;cursor:pointer;">
          <input type="checkbox" id="pc_confirmed" ${ex?.confirmed_by_customer ? "checked" : ""}> اطلاعات پایان دوره توسط مرغدار تأیید شده است
        </label>
        <input type="hidden" id="pc_init_weight" value="${initWeight.toFixed(4)}">
      </div>`;
  },

  _pcSummary(data, ex = null) {
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
          <span><span class="pc-sum-lbl">وضعیت</span><b>${ex ? "در حال ویرایش" : "در حال پایان"}</b></span>
        </div>
      </div>`;
  },

  _pcForm(data, ex = null) {
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
        .pc-method-pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
        .pc-method-pill{border:1.5px solid #cbd5e1;background:#fff;color:#475569;border-radius:999px;padding:7px 14px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s ease;}
        .pc-method-pill:hover{border-color:#0d9488;color:#0d9488;}
        .pc-method-pill.pc-method-active{background:#0d9488;border-color:#0d9488;color:#fff;box-shadow:0 4px 12px rgba(13,148,136,.25);}
        .pc-method-panel{background:#fff;border:1px dashed #d9f3ec;border-radius:12px;padding:10px 12px;margin-bottom:10px;}
        .pc-age-calc-note{background:#f0fdf4;border:1px solid #d1fae5;color:#047857;border-radius:8px;padding:6px 10px;font-size:11.5px;margin-top:8px;}
        .pc-add-ship{border:1.5px dashed #0d9488;background:#ecfdf5;color:#0d9488;border-radius:10px;padding:7px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
        .pc-add-ship:hover{background:#d1fae5;}
        .pc-ship-row{display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:8px;align-items:center;margin-bottom:8px;}
        .pc-ship-date{text-align:center;font-size:12px;}
        .pc-ship-del{width:34px;height:34px;border:none;background:#fef2f2;color:#dc2626;border-radius:9px;cursor:pointer;font-size:12px;}
        .pc-ship-del:hover{background:#fee2e2;}
        .pc-edit-banner{background:#fffbeb;border:1.5px solid #f59e0b;color:#92400e;border-radius:12px;padding:10px 14px;font-size:12.5px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
        .pc-edit-banner i{color:#d97706;}
      </style>
      <div class="pc-wrap">
        ${
          ex
            ? `<div class="pc-edit-banner"><i class="fas fa-pen-to-square"></i> حالت ویرایش اطلاعات پایان دوره فعال است — تغییرات جایگزین اطلاعات قبلی می‌شود.</div>`
            : ""
        }
        ${this._pcSummary(data, ex)}
        ${this._pcFormTop(data, ex)}
        ${this._pcFormBottom(data, ex)}
      </div>`;
  },

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

    // محاسبه سن کشتار بر اساس روش انتخابی (بازهٔ تاریخی / مستقیم / میانگین وزنی)
    const slaughterData = this._pcSlaughterMethodData();
    this._renderPcMethodUi(slaughterData);
    const age = slaughterData.age || 0;

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

    // (سن نهایی و راهنمای روش در _renderPcMethodUi پر می‌شود)
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
  },

  async _collectCompletionSave(flockId, halls, existing = null) {
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
    const slaughter = this._pcSlaughterMethodData();
    const age = slaughter.age;
    const sdate = slaughter.slaughterDate;
    const sdateEnd = slaughter.slaughterEndDate;
    if (sdate && sdateEnd && String(sdateEnd) < String(sdate)) {
      Swal.showValidationMessage(
        "تاریخ پایان کشتار نمی‌تواند قبل از تاریخ شروع باشد",
      );
      return false;
    }
    if (slaughter.method === "range" && !sdate) {
      Swal.showValidationMessage("تاریخ شروع کشتار را وارد کنید");
      return false;
    }
    if (slaughter.method === "direct" && (!age || age < 1)) {
      Swal.showValidationMessage("سن کشتار را وارد کنید (عدد مثبت)");
      return false;
    }
    if (slaughter.method === "weighted" && slaughter.shipments.length === 0) {
      Swal.showValidationMessage(
        "در روش چندمرحله‌ای حداقل یک ارسال با سن و تعداد معتبر اضافه کنید",
      );
      return false;
    }

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
      completion_type: existing?.completion_type || "completed",
      completion_date:
        existing?.completion_date || new Date().toISOString().slice(0, 10),
      slaughter_age_method: slaughter.method,
      slaughter_age_days: age > 0 ? age : null,
      slaughter_age_end_days: null,
      slaughter_date: sdate,
      slaughter_end_date: sdateEnd,
      slaughter_shipments:
        slaughter.method === "weighted" && slaughter.shipments.length
          ? slaughter.shipments.map((r) => ({
              age_days: r.age_days,
              quantity: r.quantity,
              date: r.date,
            }))
          : null,
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
      !!existing,
    );
    if (!response.success) {
      Swal.showValidationMessage(
        response.message || "خطا در ثبت پایان گله",
      );
      return false;
    }
    return true;
  },

  async _openFlockCompletionModal(data, existing = null) {
    const flockId = data.flock?.id;
    const halls = Array.isArray(data.halls) ? data.halls : [];
    if (!flockId) return;
    const isEdit = !!existing;

    const result = await Swal.fire({
      title: isEdit
        ? `ویرایش اطلاعات پایان دوره گله ${data.flock?.flock_number ?? ""}`
        : `ثبت پایان گله ${data.flock?.flock_number ?? ""} و اطلاعات کشتار`,
      html: this._pcForm(data, existing),
      width: "1080px",
      showCancelButton: true,
      confirmButtonText: isEdit ? "💾 ذخیره تغییرات" : "🏁 ثبت و پایان گله",
      cancelButtonText: "انصراف",
      confirmButtonColor: isEdit ? "#d97706" : "#0d9488",
      customClass: isEdit ? { popup: "pc-popup-edit" } : undefined,
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
        // در حالت ویرایش: بازگردانی روش سن کشتار و ارسال‌های چندمرحله‌ای
        if (isEdit) {
          try {
            const method =
              existing.slaughter_age_method === "direct"
                ? "direct"
                : existing.slaughter_age_method === "weighted"
                  ? "weighted"
                  : "range";
            const ships = Array.isArray(existing.slaughter_shipments)
              ? existing.slaughter_shipments
              : [];
            if (method === "weighted" && ships.length) {
              ships.forEach((s) =>
                this.addPcShipRow(s.age_days ?? "", s.quantity ?? ""),
              );
            }
            this.setPcSlaughterMethod(method);
          } catch (e) {
            /* ignore */
          }
        }
        this.recalcCompletionInputs();
      },
      preConfirm: async () => {
        const ok = await this._collectCompletionSave(flockId, halls, existing);
        if (!ok) return false;
        return true;
      },
    });

    if (result.isConfirmed) {
      notificationService.success(
        isEdit
          ? "✅ اطلاعات پایان دوره ویرایش شد"
          : "پایان دوره گله با موفقیت ثبت شد و گله بسته شد",
      );
      await this._refreshFlockViews();
    }
  },

  refreshFlocks() {
    this.loadFlocks();
  },

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
            <div class="cf-3col">
              <div>
                <label class="cf-label">تاریخ شروع کشتار</label>
                <input type="text" id="cfSlaughterDate" class="cf-field" placeholder="۱۴۰۴/۰۱/۰۱">
              </div>
              <div>
                <label class="cf-label">تاریخ پایان کشتار</label>
                <input type="text" id="cfSlaughterEndDate" class="cf-field" placeholder="۱۴۰۴/۰۱/۰۱">
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
          // تقویم شمسی برای بازه کشتار (شروع و پایان)
          if (typeof $.fn.persianDatepicker !== "undefined") {
            ["cfSlaughterDate", "cfSlaughterEndDate"].forEach((inputId) => {
              const dateInput = document.getElementById(inputId);
              if (!dateInput) return;
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
            });
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
          const endDateVal =
            document.getElementById("cfSlaughterEndDate")?.value?.trim() || "";
          const slaughterEndDate = endDateVal
            ? convertPersianToGregorian(endDateVal)
            : null;
          if (
            slaughterDate &&
            slaughterEndDate &&
            String(slaughterEndDate) < String(slaughterDate)
          ) {
            Swal.showValidationMessage(
              "تاریخ پایان کشتار نمی‌تواند قبل از تاریخ شروع باشد",
            );
            return false;
          }

          return {
            period_ids: [periodId],
            flock_ids: selectedFlocks,
            shared_data: {
              completion_date: new Date().toISOString().slice(0, 10),
              slaughter_date: slaughterDate,
              slaughter_end_date: slaughterEndDate,
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
  },
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
              <td style="padding:8px; text-align:center;">${formatAgeRange(c)}</td>
              <td style="padding:8px; text-align:center;">${c.total_live_weight ?? "-"}</td>
              <td style="padding:8px; text-align:center;">${c.avg_live_weight ?? "-"}</td>
              <td style="padding:8px; text-align:center;">${c.slaughterhouse_name || "-"}</td>
              <td style="padding:8px; text-align:center;">${formatSlaughterRange(c)}</td>
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
  },

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
      const _editTransportMortality = parseInt(c.transport_mortality) || 0;
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
            .ue-method-pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;}
            .ue-method-pill{border:1.5px solid #cbd5e1;background:#fff;color:#475569;border-radius:999px;padding:6px 12px;font-family:'Vazir';font-size:11.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
            .ue-method-pill:hover{border-color:#2c7a6e;color:#2c7a6e;}
            .ue-method-pill.ue-method-active{background:#2c7a6e;border-color:#2c7a6e;color:#fff;}
            .ue-method-panel{background:#fff;border:1px dashed #d1fae5;border-radius:10px;padding:10px;margin-bottom:10px;}
            .ue-age-calc-note{background:#f0fdf4;border:1px solid #d1fae5;color:#047857;border-radius:8px;padding:6px 10px;font-size:11px;margin-top:8px;font-family:'Vazir';}
            .ue-add-ship{border:1.5px dashed #2c7a6e;background:#ecfdf5;color:#2c7a6e;border-radius:9px;padding:6px 12px;font-family:'Vazir';font-size:11.5px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
            .ue-ship-row{display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:6px;align-items:center;margin-bottom:6px;}
            .ue-ship-date{text-align:center;background:#f1f5f9;font-family:'Vazir';}
            .ue-ship-del{width:32px;height:34px;border:none;background:#fef2f2;color:#dc2626;border-radius:8px;cursor:pointer;font-size:12px;}
            .ue-ship-del:hover{background:#fee2e2;}
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
            </div>
          </div>

          ${this._ueSlaughterSectionHtml(c, flock)}

          <!-- اطلاعات کشتارگاه -->
          <div class="ue-section">
            <div class="ue-section-title"><i class="fas fa-industry"></i> اطلاعات کشتارگاه</div>
            <div class="ue-2col">
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

          // پیش‌نمایش لحظه‌ای سن کشتار بر اساس روش انتخابی
          this.ueRecalcSlaughterMethod();

          // تقویم شمسی برای بازه کشتار (شروع و پایان)
          if (typeof $.fn.persianDatepicker !== "undefined") {
            ["ueSlaughterDate", "ueSlaughterEndDate"].forEach((inputId) => {
              const dateInput = document.getElementById(inputId);
              if (!dateInput) return;
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
            });
          }
        },
        preConfirm: () => {
          const completionId = document.getElementById("ueCompletionId")?.value;
          if (!completionId) {
            Swal.showValidationMessage("شناسه پایان دوره یافت نشد");
            return false;
          }

          const slaughterData = this.ueRecalcSlaughterMethod();
          const slaughterDate = slaughterData.slaughterDate;
          const slaughterEndDate = slaughterData.slaughterEndDate;
          if (
            slaughterDate &&
            slaughterEndDate &&
            String(slaughterEndDate) < String(slaughterDate)
          ) {
            Swal.showValidationMessage(
              "تاریخ پایان کشتار نمی‌تواند قبل از تاریخ شروع باشد",
            );
            return false;
          }
          if (slaughterData.method === "range" && !slaughterDate) {
            Swal.showValidationMessage("تاریخ شروع کشتار را وارد کنید");
            return false;
          }
          if (
            slaughterData.method === "direct" &&
            (!slaughterData.age || slaughterData.age < 1)
          ) {
            Swal.showValidationMessage("سن کشتار را وارد کنید (عدد مثبت)");
            return false;
          }
          if (
            slaughterData.method === "weighted" &&
            slaughterData.shipments.length === 0
          ) {
            Swal.showValidationMessage(
              "در روش چندمرحله‌ای حداقل یک ارسال با سن و تعداد معتبر اضافه کنید",
            );
            return false;
          }

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
              slaughter_age_method: slaughterData.method,
              slaughter_age_days:
                slaughterData.age > 0 ? slaughterData.age : null,
              slaughter_age_end_days: null,
              slaughter_date: slaughterDate,
              slaughter_end_date: slaughterEndDate,
              slaughter_shipments:
                slaughterData.method === "weighted" &&
                slaughterData.shipments.length
                  ? slaughterData.shipments.map((r) => ({
                      age_days: r.age_days,
                      quantity: r.quantity,
                      date: r.date,
                    }))
                  : null,
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
  },

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
      const ueAgeBox = document.getElementById("ue_out_age");
      if (ueAgeBox && data.slaughter_age_days != null) {
        ueAgeBox.textContent = Number(data.slaughter_age_days).toLocaleString(
          "fa-IR",
        );
      }

      notificationService.success("✅ فیلدهای سیستمی محاسبه مجدد شدند");
    } catch (error) {
      console.error("❌ Error recomputing system fields:", error);
      notificationService.error("خطا در محاسبه مجدد");
    }
  },
};
