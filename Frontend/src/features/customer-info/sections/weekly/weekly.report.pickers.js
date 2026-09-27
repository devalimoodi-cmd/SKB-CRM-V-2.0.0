// ============================================================
// weekly.report.pickers.js
// انتخابگرهای گزارش: گروه‌های ذخیره‌شده/قواعد هفته‌ها و مودال انتخاب هفته
// ------------------------------------------------------------
// موج ۳.۲ (زیرموج ۳.۲b) — این دامنه از weekly.service.js خارج شد
// متن متدها کلمه‌به‌کلمه منتقل شده است؛ تنها تفاوت با مبدأ «ویرگول پایان متد» است
// که برای اعتبار نحو object literal لازم است (گیت بایت‌به‌بایت در اسکریپت برش و
// نگهبان weekly-service-surface-test.mjs سطح زمان اجرا را می‌سنجند).
// ترکیب: Object.assign(WeeklyService.prototype, weeklyReportPickerMethods) در weekly.service.js
// حجم: ۶ متد / ۴۴۹ خط
// ============================================================
import {
  REPORT_GROUPS,
  REPORT_GROUP_STORAGE_KEY,
  ALL_GROUP_KEYS,
  normalizeGroups,
} from "./weekly.report.groups.js";
import {
  WEEK_PRESET,
  WEEK_PRESET_LABELS,
  WEEK_SELECTION_STORAGE_KEY,
  WEEK_STATUS_LABELS,
  effectiveWeeksFor,
  normalizeWeekSelection,
  resolvePresetWeeks,
  summarizeWeekSelection,
} from "./weekly.report.weeks.js";
import { convertToPersianDate } from "../../../../core/utils/date.utils.js";

export const weeklyReportPickerMethods = {
  // ===== انتخاب گروه‌های شاخص گزارش (مودال) =====

  /** گروه‌های ذخیره‌شدهٔ کاربر (پیش‌فرض = همهٔ شاخص‌ها) */
  loadSavedReportGroups() {
    try {
      const raw = localStorage.getItem(REPORT_GROUP_STORAGE_KEY);
      if (!raw) return [...ALL_GROUP_KEYS];
      return normalizeGroups(JSON.parse(raw));
    } catch {
      return [...ALL_GROUP_KEYS];
    }
  },

  saveReportGroups(selected) {
    try {
      localStorage.setItem(
        REPORT_GROUP_STORAGE_KEY,
        JSON.stringify(normalizeGroups(selected)),
      );
    } catch {
      // اگر localStorage در دسترس نبود، انتخاب فقط برای همین گزارش اعمال می‌شود
    }
  },

  /**
   * مودال انتخاب گروه‌های شاخص پیش از تولید گزارش
   * @param {{title?:string, subtitle?:string}} options
   * @returns {Promise<string[]|null>} آرایهٔ کلید گروه‌ها یا null در صورت انصراف
   */
  async pickReportGroups({ title = "انتخاب شاخص‌های گزارش", subtitle = "" } = {}) {
    // اگر SweetAlert2 در دسترس نبود → مثل قبل همهٔ شاخص‌ها (سازگاری عقب‌رو)
    if (typeof Swal === "undefined") return [...ALL_GROUP_KEYS];

    const saved = this.loadSavedReportGroups();

    const rowsHtml = REPORT_GROUPS.map(
      (group) => `
          <label class="wh-item" data-key="${group.key}">
            <input type="checkbox" class="wh-item-check rg-group-check" value="${group.key}" ${saved.includes(group.key) ? "checked" : ""}>
            <span class="wh-item-main">
              <span class="wh-item-title">${group.title}</span>
              <span class="wh-item-meta">
                <span><i class="fas fa-circle-info"></i> ${group.hint}</span>
              </span>
            </span>
          </label>`,
    ).join("");

    const html = `
      <div class="wh-picker" dir="rtl">
        <div class="wh-stats">
          <div class="wh-stat">
            <span class="wh-stat-val" id="rgStatSelected">0</span>
            <span class="wh-stat-lbl">گروه انتخاب‌شده</span>
          </div>
          <div class="wh-stat">
            <span class="wh-stat-val" id="rgStatTotal">${REPORT_GROUPS.length}</span>
            <span class="wh-stat-lbl">گروه شاخص موجود</span>
          </div>
        </div>

        <div class="wh-toolbar">
          <button type="button" class="wh-tool-btn" id="rgSelectAll">
            <i class="fas fa-check-double"></i> انتخاب همه
          </button>
          <button type="button" class="wh-tool-btn ghost" id="rgClearAll">
            <i class="fas fa-eraser"></i> پاک‌کردن
          </button>
          <button type="button" class="wh-tool-btn ghost" id="rgResetDefault">
            <i class="fas fa-rotate-left"></i> پیش‌فرض (همه)
          </button>
        </div>

        <div class="wh-list" id="rgGroupList">${rowsHtml}</div>

        <p class="wh-hint">
          <i class="fas fa-circle-info"></i>
          ${subtitle || "فقط گروه‌های تیک‌خورده در جدول‌های گزارش نمایش داده می‌شوند و هفته‌های ثبت‌نشده یا ناقص با هشدار مشخص می‌شوند. انتخاب شما برای گزارش‌های بعدی به‌خاطر سپرده می‌شود."}
        </p>
      </div>
    `;
    const checkboxes = () =>
      Array.from(document.querySelectorAll("#rgGroupList .rg-group-check"));

    const updateStats = () => {
      const count = checkboxes().filter((cb) => cb.checked).length;
      const el = document.getElementById("rgStatSelected");
      if (el) el.textContent = count.toLocaleString("fa-IR");
    };

    const setChecked = (keys) => {
      checkboxes().forEach((cb) => {
        cb.checked = keys.includes(cb.value);
      });
      updateStats();
    };

    const result = await Swal.fire({
      title,
      html,
      width: 640,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-export"></i> تولید گزارش',
      cancelButtonText: "انصراف",
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#94a3b8",
      didOpen: () => {
        updateStats();
        document
          .getElementById("rgSelectAll")
          ?.addEventListener("click", () => setChecked([...ALL_GROUP_KEYS]));
        document
          .getElementById("rgClearAll")
          ?.addEventListener("click", () => setChecked([]));
        document
          .getElementById("rgResetDefault")
          ?.addEventListener("click", () => setChecked([...ALL_GROUP_KEYS]));
        checkboxes().forEach((cb) =>
          cb.addEventListener("change", updateStats),
        );
      },
      preConfirm: () => {
        const selected = checkboxes()
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);
        if (selected.length === 0) {
          Swal.showValidationMessage("حداقل یک گروه شاخص را انتخاب کنید");
          return false;
        }
        return selected;
      },
    });

    if (!result.isConfirmed) return null;

    // ✅ انتخاب کاربر ذخیره می‌شود تا در گزارش‌های بعدی هم اعمال شود
    const selected = normalizeGroups(result.value);
    this.saveReportGroups(selected);
    return selected;
  },

  // ===== انتخاب هفته‌های گزارش (مودال ترکیبی) =====

  /** قاعدهٔ ذخیره‌شدهٔ انتخاب مشترک (پریست/بازه) */
  loadSavedWeekRule() {
    try {
      const raw = localStorage.getItem(WEEK_SELECTION_STORAGE_KEY);
      if (!raw) return { preset: WEEK_PRESET.ALL, from: null, to: null };
      const parsed = JSON.parse(raw);
      const normalized = normalizeWeekSelection({ shared: parsed }).shared;
      return normalized && !Array.isArray(normalized)
        ? normalized
        : { preset: WEEK_PRESET.ALL, from: null, to: null };
    } catch {
      return { preset: WEEK_PRESET.ALL, from: null, to: null };
    }
  },

  saveWeekRule(rule) {
    try {
      localStorage.setItem(WEEK_SELECTION_STORAGE_KEY, JSON.stringify(rule));
    } catch {
      // در نبود localStorage، انتخاب فقط برای همین گزارش اعمال می‌شود
    }
  },

  /**
   * مودال «انتخاب هفته‌ها» — ترکیبی:
   *  ۱) یک انتخاب مشترک برای همهٔ گله‌ها (پریست/بازه)
   *  ۲) امکان تنظیم جداگانهٔ هر گله (اختیاری، جمع‌شده)
   * @param {{title?:string, subtitle?:string, panels:Array<{key,label,subtitle,timeline}>}} options
   * @returns {Promise<object|null>} مدل انتخاب هفته‌ها یا null (همهٔ هفته‌ها)
   */
  async pickReportWeeksPerFlock({
    title = "🎯 انتخاب هفته‌های گزارش",
    subtitle = "",
    panels = [],
  } = {}) {
    // بدون SweetAlert2 یا بدون گله → بدون مودال (رفتار قبلی: همهٔ هفته‌ها)
    if (typeof Swal === "undefined" || panels.length === 0) return null;

    const timelines = {};
    panels.forEach((panel) => {
      timelines[panel.key] = panel.timeline || [];
    });

    const state = { shared: { ...this.loadSavedWeekRule() }, overrides: {} };

    const weekStatusChip = (week) => {
      const cls = week.status;
      const label = WEEK_STATUS_LABELS[cls] || "";
      const icon = cls === "complete" ? "✅" : cls === "partial" ? "🟡" : "❌";
      return `<span class="wk-week-status ${cls}">${icon} ${label}</span>`;
    };

    const panelHtml = (panel) => {
      const weeks = (panel.timeline || [])
        .map(
          (week) => `
            <label class="wk-week-item ${week.status}">
              <input type="checkbox" class="wk-week-check" data-key="${panel.key}" value="${week.weekNumber}">
              <span class="wk-week-name">هفته ${week.weekNumber}</span>
              <span class="wk-week-date">${
                week.startDate ? convertToPersianDate(week.startDate) : "-"
              }</span>
              ${weekStatusChip(week)}
            </label>`,
        )
        .join("");

      return `
        <div class="wk-flock" data-key="${panel.key}">
          <div class="wk-flock-head">
            <span class="wk-flock-title">${panel.label}</span>
            <span class="wk-flock-meta">${panel.subtitle || ""}</span>
            <span class="wk-flock-status" id="wkStatus-${panel.key}"></span>
            <button type="button" class="wh-tool-btn wk-edit-btn" data-edit="${panel.key}">
              <i class="fas fa-pen"></i> تنظیم این گله
            </button>
          </div>
          <div class="wk-flock-weeks" id="wkWeeks-${panel.key}" hidden>
            <div class="wk-presets">
              <button type="button" class="wk-chip" data-preset="${WEEK_PRESET.ALL}" data-key="${panel.key}">همه</button>
              <button type="button" class="wk-chip" data-preset="${WEEK_PRESET.RECORDED}" data-key="${panel.key}">ثبت‌شده</button>
              <button type="button" class="wk-chip" data-preset="${WEEK_PRESET.ISSUES}" data-key="${panel.key}">مشکل‌دار</button>
              <button type="button" class="wk-chip" data-preset="${WEEK_PRESET.MANUAL}" data-key="${panel.key}">انتخاب دستی</button>
              <button type="button" class="wh-tool-btn ghost wk-reset-btn" data-reset="${panel.key}">
                <i class="fas fa-rotate-left"></i> بازگشت به انتخاب مشترک
              </button>
            </div>
            <div class="wk-week-list">${weeks || '<p class="wh-hint">هفته‌ای برای این گله وجود ندارد</p>'}</div>
          </div>
        </div>`;
    };
    const html = `
      <div class="wh-picker wk-picker" dir="rtl">
        <div class="wh-stats">
          <div class="wh-stat"><span class="wh-stat-val" id="wkStatWeeks">0</span><span class="wh-stat-lbl">هفتهٔ انتخابی</span></div>
          <div class="wh-stat"><span class="wh-stat-val" id="wkStatFlocks">0</span><span class="wh-stat-lbl">گله/سالن در گزارش</span></div>
          <div class="wh-stat"><span class="wh-stat-val" id="wkStatIssues">0</span><span class="wh-stat-lbl">مورد مشکل‌دار در انتخاب</span></div>
        </div>

        <div class="wk-section">
          <div class="wk-section-title">۱) انتخاب مشترک برای همهٔ گله‌ها</div>
          <div class="wk-presets" id="wkSharedPresets">
            ${Object.entries(WEEK_PRESET_LABELS)
              .filter(([key]) => key !== WEEK_PRESET.MANUAL)
              .map(
                ([key, label]) =>
                  `<button type="button" class="wk-chip" data-shared-preset="${key}">${label}</button>`,
              )
              .join("")}
          </div>
          <div class="wk-range" id="wkSharedRange" hidden>
            <label>از هفته <input type="number" min="1" class="wk-input" id="wkFrom"></label>
            <label>تا هفته <input type="number" min="1" class="wk-input" id="wkTo"></label>
          </div>
        </div>

        <div class="wk-section">
          <button type="button" class="wh-tool-btn ghost wk-toggle" id="wkTogglePerFlock">
            <i class="fas fa-sliders-h"></i> ⚙️ تنظیم جداگانهٔ هر گله (اختیاری — ${panels.length.toLocaleString("fa-IR")} گله)
          </button>
          <div class="wk-per-flock" id="wkPerFlock" hidden>
            <div class="wh-toolbar">
              <button type="button" class="wh-tool-btn ghost" id="wkResetAllOverrides">
                <i class="fas fa-rotate-left"></i> همه مطابق انتخاب مشترک
              </button>
            </div>
            ${panels.map((panel) => panelHtml(panel)).join("")}
          </div>
        </div>

        <p class="wh-hint">
          <i class="fas fa-circle-info"></i>
          ${subtitle || "فقط هفته‌های انتخاب‌شدهٔ هر گله در جدول‌های گزارش می‌آید و هشدارهای ثبت هفتگی هم روی همین هفته‌ها محاسبه می‌شود. مجموع‌ها/FCR همچنان روی همهٔ هفته‌های ثبت‌شده محاسبه می‌شوند."}
        </p>
      </div>
    `;
    const setStat = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (parseInt(value, 10) || 0).toLocaleString("fa-IR");
    };

    const weekChecksOf = (key) =>
      Array.from(document.querySelectorAll(`.wk-week-check[data-key="${key}"]`));

    const effectiveOf = (key) => effectiveWeeksFor(state, key, timelines[key]);

    const syncWeekCheckboxes = (key) => {
      const effective = new Set(effectiveOf(key));
      weekChecksOf(key).forEach((cb) => {
        cb.checked = effective.has(parseInt(cb.value, 10));
      });
    };

    const updatePanelStatus = (key) => {
      const el = document.getElementById(`wkStatus-${key}`);
      if (!el) return;
      const effective = effectiveOf(key);
      const overridden = Object.prototype.hasOwnProperty.call(
        state.overrides,
        key,
      );
      if (effective.length === 0) {
        el.textContent = "⛔ بدون هفته → در گزارش نمی‌آید";
        el.className = "wk-flock-status is-excluded";
        return;
      }
      const label = `${effective.length.toLocaleString("fa-IR")} هفته`;
      el.textContent = overridden
        ? `🎯 سفارشی — ${label}`
        : `✅ مطابق انتخاب مشترک — ${label}`;
      el.className = `wk-flock-status ${overridden ? "is-custom" : "is-shared"}`;
    };

    const refresh = () => {
      panels.forEach((panel) => {
        if (!Object.prototype.hasOwnProperty.call(state.overrides, panel.key)) {
          syncWeekCheckboxes(panel.key);
        }
        updatePanelStatus(panel.key);
      });

      const summary = summarizeWeekSelection(state, timelines);
      setStat("wkStatWeeks", summary.weeks);
      setStat("wkStatFlocks", summary.flocks);
      setStat("wkStatIssues", summary.missing + summary.partial);

      document.querySelectorAll("[data-shared-preset]").forEach((btn) => {
        btn.classList.toggle(
          "is-active",
          btn.dataset.sharedPreset === state.shared.preset,
        );
      });
      const rangeBox = document.getElementById("wkSharedRange");
      if (rangeBox) rangeBox.hidden = state.shared.preset !== WEEK_PRESET.RANGE;
      const fromInput = document.getElementById("wkFrom");
      const toInput = document.getElementById("wkTo");
      if (fromInput && state.shared.from) fromInput.value = state.shared.from;
      if (toInput && state.shared.to) toInput.value = state.shared.to;
    };

    const result = await Swal.fire({
      title,
      html,
      width: 760,
      showCancelButton: true,
      confirmButtonText: '<i class="fas fa-file-export"></i> تولید گزارش',
      cancelButtonText: "انصراف",
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#94a3b8",
      didOpen: () => {
        refresh();

        // ── پریست مشترک
        document.querySelectorAll("[data-shared-preset]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const preset = btn.dataset.sharedPreset;
            state.shared = {
              preset,
              from: preset === WEEK_PRESET.RANGE ? state.shared.from : null,
              to: preset === WEEK_PRESET.RANGE ? state.shared.to : null,
            };
            refresh();
          });
        });

        // ── بازهٔ مشترک
        ["wkFrom", "wkTo"].forEach((id) => {
          document.getElementById(id)?.addEventListener("input", (event) => {
            state.shared.preset = WEEK_PRESET.RANGE;
            state.shared[id === "wkFrom" ? "from" : "to"] =
              parseInt(event.target.value, 10) || null;
            refresh();
          });
        });

        // ── باز/بست ناحیهٔ تنظیم جداگانه
        document
          .getElementById("wkTogglePerFlock")
          ?.addEventListener("click", () => {
            const box = document.getElementById("wkPerFlock");
            if (box) box.hidden = !box.hidden;
          });
        // ── پریست هر گله
        document.querySelectorAll("[data-preset][data-key]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = btn.dataset.key;
            const preset = btn.dataset.preset;
            state.overrides[key] =
              preset === WEEK_PRESET.MANUAL
                ? [...effectiveOf(key)]
                : resolvePresetWeeks(preset, timelines[key]);
            syncWeekCheckboxes(key);
            updatePanelStatus(key);
            refresh();
          });
        });

        // ── تغییر دستی تیک هفته‌ها
        document
          .getElementById("wkPerFlock")
          ?.addEventListener("change", (event) => {
            const cb = event.target.closest?.(".wk-week-check");
            if (!cb) return;
            const key = cb.dataset.key;
            if (!Object.prototype.hasOwnProperty.call(state.overrides, key)) {
              // اولین ویرایش: از وضعیت فعلیِ برگرفته از انتخاب مشترک شروع می‌کنیم
              state.overrides[key] = [...effectiveOf(key)];
            }
            const value = parseInt(cb.value, 10);
            const list = new Set(state.overrides[key]);
            if (cb.checked) list.add(value);
            else list.delete(value);
            state.overrides[key] = [...list].sort((a, b) => a - b);
            updatePanelStatus(key);
            refresh();
          });

        // ── بازگشت یک گله به انتخاب مشترک
        document.querySelectorAll("[data-reset]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = btn.dataset.reset;
            delete state.overrides[key];
            syncWeekCheckboxes(key);
            updatePanelStatus(key);
            refresh();
          });
        });

        // ── همه مطابق انتخاب مشترک
        document
          .getElementById("wkResetAllOverrides")
          ?.addEventListener("click", () => {
            state.overrides = {};
            refresh();
          });

        // ── بازکردن فهرست هفته‌های یک گله
        document.querySelectorAll("[data-edit]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const box = document.getElementById(`wkWeeks-${btn.dataset.edit}`);
            if (box) box.hidden = !box.hidden;
          });
        });
      },
      preConfirm: () => {
        const summary = summarizeWeekSelection(state, timelines);
        if (summary.weeks === 0) {
          Swal.showValidationMessage("حداقل یک هفته در گزارش انتخاب کنید");
          return false;
        }
        return { shared: state.shared, overrides: state.overrides };
      },
    });

    if (!result.isConfirmed) return null;

    // ✅ قاعدهٔ مشترک برای گزارش‌های بعدی به‌خاطر سپرده می‌شود
    this.saveWeekRule(state.shared);

    // پیش‌فرض «همهٔ هفته‌ها» بدون تنظیم سفارشی → همان رفتار قبلی گزارش‌ها
    const hasOverrides = Object.keys(state.overrides).length > 0;
    if (!hasOverrides && state.shared.preset === WEEK_PRESET.ALL) return null;

    return normalizeWeekSelection({
      mode: hasOverrides ? "mixed" : "shared",
      shared: state.shared,
      overrides: state.overrides,
    });
  },

};
