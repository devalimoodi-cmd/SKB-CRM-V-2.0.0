// ============================================================
// hatchery.completion.period.js
// پایان دوره در سطح پریود + مشاهده/ویرایش اطلاعات پایان دوره (ue_*)
// ------------------------------------------------------------
// موج ۳.۱ — شکستن mixin خوشهٔ پایان دوره (پیش‌تر: hatchery.completion.service.js،
// ۳۹ متد / ۲۳۰۵ خط) به سه دامنهٔ مستقل؛ متن متدها کلمه‌به‌کلمه و
// بدون هیچ تغییر متنی (حتی ویرگول‌ها) منتقل شده است.
// جریان سطح پریود که همهٔ گله‌های دوره را می‌بندد یا ویرایش می‌کند.
// ترکیب: Object.assign(HatcheryService.prototype, hatcheryCompletionPeriodMethods) در hatchery.service.js
// حجم: 11 متد / 1114 خط
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

export const hatcheryCompletionPeriodMethods = {
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
