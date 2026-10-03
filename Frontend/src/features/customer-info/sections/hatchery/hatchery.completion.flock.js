// ============================================================
// hatchery.completion.flock.js
// پایان/ویرایش پایان یک گله (مودال جامع pc_*)
// ------------------------------------------------------------
// موج ۳.۱ — شکستن mixin خوشهٔ پایان دوره (پیش‌تر: hatchery.completion.service.js،
// ۳۹ متد / ۲۳۰۵ خط) به سه دامنهٔ مستقل؛ متن متدها کلمه‌به‌کلمه و
// بدون هیچ تغییر متنی (حتی ویرگول‌ها) منتقل شده است.
// بزرگ‌ترین دامنه: فرم، محاسبهٔ شاخص‌ها و ذخیرهٔ اطلاعات کشتار.
// ترکیب: Object.assign(HatcheryService.prototype, hatcheryCompletionFlockMethods) در hatchery.service.js
// حجم: 23 متد / 1130 خط
// ============================================================
import { hatcheryApi } from "./hatchery.api.js";
import { notificationService } from "../../../../core/services/notification.service.js";
import {
  convertPersianToGregorian,
  convertToPersianDate,
} from "../../../../core/utils/date.utils.js";

export const hatcheryCompletionFlockMethods = {
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
      ? 'readonly style="background:var(--gray-100, #f1f5f9);color:var(--text-slate-strong, #334155);cursor:not-allowed;"'
      : `oninput="hatcheryRecalcCompletion()"${blurAttr}`;
    return `<div style="margin-bottom:7px;">
      <label class="pc-label" for="${id}">${label}${
        unit ? ` <small style="color:var(--text-light, #94a3b8);">(${unit})</small>` : ""
      }</label>
      <input type="${type}" id="${id}" class="pc-in" value="${
        value ?? ""
      }" ${min !== "" ? `min="${min}"` : ""} step="${step}" placeholder="${ph}" ${extraAttrs}>
    </div>`;
  },

  _pcRead(label, id, unit = "") {
    return `<div style="margin-bottom:7px;">
      <label class="pc-label">${label}${
        unit ? ` <small style="color:var(--text-light, #94a3b8);">(${unit})</small>` : ""
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
      <div style="font-weight:700;font-size:12px;color:var(--primary, #2c7a6e);margin-bottom:6px;display:flex;align-items:center;gap:6px;">
        <i class="fas fa-warehouse"></i> ${hall.hall_name || `سالن ${hall.hall_id}`}
        <span style="font-weight:500;font-size:10.5px;color:var(--text-gray, #64748b);">(اولیه: ${Number(
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
              <label class="pc-label">تاریخ شروع کشتار <small style="color:var(--warning-deep, #b45309);">* اعلامی مرغدار</small></label>
              <input type="text" id="pc_sdate" class="pc-in pc-date" value="${startDate}" onchange="hatcheryRecalcCompletion()" oninput="hatcheryRecalcCompletion()">
            </div>
            <div style="margin-bottom:7px;">
              <label class="pc-label">تاریخ پایان کشتار <small style="color:var(--text-light, #94a3b8);">(اختیاری — اگر کشتار چند روز طول بکشد)</small></label>
              <input type="text" id="pc_sdate_end" class="pc-in pc-date" value="${endDate}" onchange="hatcheryRecalcCompletion()" oninput="hatcheryRecalcCompletion()">
            </div>
          </div>
          <div class="pc-age-calc-note" id="pc_range_note"></div>
        </div>

        <!-- پنل روش ۲: ورود مستقیم سن -->
        <div class="pc-method-panel" id="pc_panel_direct" style="display:${method === "direct" ? "block" : "none"};">
          <div class="pc-grid">
            <div style="margin-bottom:7px;">
              <label class="pc-label">سن کشتار (روز) <small style="color:var(--warning-deep, #b45309);">*</small></label>
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
            <label class="pc-label">نام کشتارگاه <small style="color:var(--text-light, #94a3b8);">(اختیاری)</small></label>
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
        <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-slate, #475569);margin-top:8px;cursor:pointer;">
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
        .pc-wrap::-webkit-scrollbar{width:8px;} .pc-wrap::-webkit-scrollbar-thumb{background:var(--border-strong, #cbd5e1);border-radius:8px;}
        .pc-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px;margin-bottom:14px;}
        .pc-sum-item{display:flex;align-items:center;gap:10px;background:var(--bg-surface, #fff);border:1px solid var(--border-color, #e2e8f0);border-radius:14px;padding:10px 12px;box-shadow:0 2px 8px rgba(var(--ink-rgb),.05);}
        .pc-sum-item[data-c="1"]{background:linear-gradient(135deg,var(--c-f0fdfa, #f0fdfa),var(--bg-surface, #ffffff));border-color:var(--c-99f6e4, #99f6e4);}
        .pc-sum-item[data-c="2"]{background:linear-gradient(135deg,var(--info-soft, #eff6ff),var(--bg-surface, #ffffff));border-color:var(--c-bfdbfe, #bfdbfe);}
        .pc-sum-item[data-c="3"]{background:linear-gradient(135deg,var(--c-fff7ed, #fff7ed),var(--bg-surface, #ffffff));border-color:var(--c-fed7aa, #fed7aa);}
        .pc-sum-item[data-c="4"]{background:linear-gradient(135deg,var(--danger-soft, #fef2f2),var(--bg-surface, #ffffff));border-color:var(--danger-mist, #fecaca);}
        .pc-sum-item[data-c="5"]{background:linear-gradient(135deg,var(--c-f5f3ff, #f5f3ff),var(--bg-surface, #ffffff));border-color:var(--c-ddd, #ddd)6fe;}
        .pc-sum-ico{width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;background:var(--accent-teal, #0d9488);color:var(--c-fff, #fff);font-size:14px;flex-shrink:0;}
        .pc-sum-item[data-c="2"] .pc-sum-ico{background:var(--info-strong, #2563eb);}
        .pc-sum-item[data-c="3"] .pc-sum-ico{background:var(--c-ea580c, #ea580c);}
        .pc-sum-item[data-c="4"] .pc-sum-ico{background:var(--danger, #dc2626);}
        .pc-sum-item[data-c="5"] .pc-sum-ico{background:var(--violet-deep, #7c3aed);}
        .pc-sum-item > span:last-child{display:flex;flex-direction:column;line-height:1.5;min-width:0;}
        .pc-sum-lbl{font-size:10px;color:var(--text-gray, #64748b);}
        .pc-sum-item b{font-size:13.5px;color:var(--ink, #0f172a);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .pc-sec{background:var(--bg-surface-2, #f8fafc);border:1px solid var(--border-light, #eef2f6);border-radius:14px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 4px rgba(var(--ink-rgb),.03);}
        .pc-sec-title{font-size:14px;font-weight:800;color:var(--ink, #0f172a);margin:0 0 10px;display:flex;align-items:center;gap:8px;border-bottom:2px solid var(--c-d9f3ec, #d9f3ec);padding-bottom:8px;}
        .pc-sec-title i{color:var(--accent-teal, #0d9488);font-size:14px;}
        .pc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px 16px;}
        .pc-out{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px 14px;}
        .pc-dual{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-bottom:10px;}
        .pc-dual-col{background:var(--bg-surface, #fff);border:1px solid var(--border-color, #e2e8f0);border-radius:14px;padding:12px 14px;box-shadow:0 1px 4px rgba(var(--ink-rgb),.03);}
        .pc-dual-sys{border-top:4px solid var(--accent-teal, #0d9488);}
        .pc-dual-far{border-top:4px solid var(--info-strong, #2563eb);}
        .pc-dual-title{display:flex;align-items:center;gap:6px;font-size:13.5px;font-weight:800;color:var(--ink, #0f172a);margin-bottom:10px;}
        .pc-dual-sys .pc-dual-title i{color:var(--accent-teal, #0d9488);}
        .pc-dual-far .pc-dual-title i{color:var(--info-strong, #2563eb);}
        .pc-dual-sys .pc-read{background:var(--success-mist-2, #ecfdf5);border-color:var(--success-mist-4, #a7f3d0);color:var(--success-deep, #047857);}
        .pc-dual-far .pc-read{background:var(--info-soft, #eff6ff);border-color:var(--c-bfdbfe, #bfdbfe);color:var(--info-deep, #1d4ed8);}
        .pc-label{display:block;font-size:11.5px;font-weight:500;color:var(--text-slate-strong, #334155);margin-bottom:5px;}
        .pc-label small{color:var(--text-light, #94a3b8);}
        .pc-in{width:100%;padding:9px 12px;border:1.5px solid var(--border-strong, #cbd5e1);border-radius:10px;font-family:inherit;font-size:13px;box-sizing:border-box;background:var(--bg-surface, #fff);transition:all .15s ease;}
        .pc-in:hover{border-color:var(--text-light, #94a3b8);}
        .pc-in:focus{outline:none;border-color:var(--accent-teal, #0d9488);box-shadow:0 0 0 3px rgba(13,148,136,.12);}
        .pc-read{background:var(--bg-surface, #fff);border:1.5px solid var(--c-ccfbf1, #ccfbf1);border-radius:10px;padding:9px 10px;font-weight:800;color:var(--accent-teal, #0d9488);font-size:15px;box-shadow:inset 0 1px 0 rgba(var(--surface-rgb),.6);}
        .pc-hall{background:var(--bg-surface, #fff);border:1px solid var(--border-color, #e2e8f0);border-radius:12px;padding:10px 12px;box-shadow:0 1px 3px rgba(var(--ink-rgb),.03);}
        .pc-note{width:100%;border:1.5px solid var(--border-strong, #cbd5e1);border-radius:10px;padding:9px 12px;font-family:inherit;font-size:13px;box-sizing:border-box;}
        .pc-note:focus{outline:none;border-color:var(--accent-teal, #0d9488);box-shadow:0 0 0 3px rgba(13,148,136,.12);}
        #pc_out_age{background:var(--c-faf5ff, #faf5ff);border-color:var(--c-e9d5ff, #e9d5ff);color:var(--violet-deep, #7c3aed);}
        #pc_out_mortality,#pc_out_mortality_pct{background:var(--danger-soft, #fef2f2);border-color:var(--danger-mist, #fecaca);color:var(--danger-deep, #b91c1c);}
        #pc_out_avg{background:var(--info-soft, #eff6ff);border-color:var(--c-bfdbfe, #bfdbfe);color:var(--info-deep, #1d4ed8);}
        #pc_out_yield{background:var(--success-soft, #f0fdf4);border-color:var(--success-mist-3, #bbf7d0);color:var(--c-15803d, #15803d);}
        #pc_out_feed_used{background:var(--bg-surface-2, #f8fafc);border-color:var(--border-color, #e2e8f0);color:var(--text-slate, #475569);}
        #pc_out_income{background:var(--info-soft, #eff6ff);border-color:var(--c-bfdbfe, #bfdbfe);color:var(--info-deep, #1d4ed8);}
        #pc_out_total_cost{background:var(--c-fff7ed, #fff7ed);border-color:var(--c-fed7aa, #fed7aa);color:var(--c-c2410c, #c2410c);}
        #pc_out_profit{background:var(--success-soft, #f0fdf4);border-color:var(--success-mist-3, #bbf7d0);color:var(--c-15803d, #15803d);}
        #pc_out_profit_pct{background:var(--success-soft, #f0fdf4);border-color:var(--success-mist-3, #bbf7d0);color:var(--c-15803d, #15803d);}
        #pc_out_fcr{background:var(--warning-soft, #fffbeb);border-color:var(--c-fde68a, #fde68a);color:var(--warning-deep, #b45309);}
        #pc_out_epi{background:var(--c-f5f3ff, #f5f3ff);border-color:var(--c-ddd, #ddd)6fe;color:var(--c-6d28d9, #6d28d9);}
        #pc_out_adg{background:var(--c-ecfeff, #ecfeff);border-color:var(--c-a5f3fc, #a5f3fc);color:var(--c-0e7490, #0e7490);}
        #pc_out_gain,#pc_out_survival{background:var(--success-soft, #f0fdf4);border-color:var(--success-mist-3, #bbf7d0);color:var(--c-15803d, #15803d);}
        .pc-method-pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
        .pc-method-pill{border:1.5px solid var(--border-strong, #cbd5e1);background:var(--bg-surface, #fff);color:var(--text-slate, #475569);border-radius:999px;padding:7px 14px;font-family:inherit;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .15s ease;}
        .pc-method-pill:hover{border-color:var(--accent-teal, #0d9488);color:var(--accent-teal, #0d9488);}
        .pc-method-pill.pc-method-active{background:var(--accent-teal, #0d9488);border-color:var(--accent-teal, #0d9488);color:var(--c-fff, #fff);box-shadow:0 4px 12px rgba(13,148,136,.25);}
        .pc-method-panel{background:var(--bg-surface, #fff);border:1px dashed var(--c-d9f3ec, #d9f3ec);border-radius:12px;padding:10px 12px;margin-bottom:10px;}
        .pc-age-calc-note{background:var(--success-soft, #f0fdf4);border:1px solid var(--success-mist, #d1fae5);color:var(--success-deep, #047857);border-radius:8px;padding:6px 10px;font-size:11.5px;margin-top:8px;}
        .pc-add-ship{border:1.5px dashed var(--accent-teal, #0d9488);background:var(--success-mist-2, #ecfdf5);color:var(--accent-teal, #0d9488);border-radius:10px;padding:7px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
        .pc-add-ship:hover{background:var(--success-mist, #d1fae5);}
        .pc-ship-row{display:grid;grid-template-columns:1fr 1fr 1.2fr auto;gap:8px;align-items:center;margin-bottom:8px;}
        .pc-ship-date{text-align:center;font-size:12px;}
        .pc-ship-del{width:34px;height:34px;border:none;background:var(--danger-soft, #fef2f2);color:var(--danger, #dc2626);border-radius:9px;cursor:pointer;font-size:12px;}
        .pc-ship-del:hover{background:var(--danger-bg, #fee2e2);}
        .pc-edit-banner{background:var(--warning-soft, #fffbeb);border:1.5px solid var(--warning, #f59e0b);color:var(--warning-deep-3, #92400e);border-radius:12px;padding:10px 14px;font-size:12.5px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
        .pc-edit-banner i{color:var(--warning-deep-2, #d97706);}
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
};
