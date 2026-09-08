// ================================================================
// dictionary.manager.js - کامپوننت مدیریت جداول دیکشنری
// یک UI دینامیک که بر اساس schema هر جدول، فرم و جدول می‌سازد.
// ================================================================

import { dictionaryApi } from "./dictionary.api.js";
import { apiService } from "../../core/services/api.service.js";
import {
  getAllDictionarySchemas,
  getDictionarySchema,
} from "./dictionary.schemas.js";

// ایمن‌سازی خروجی HTML در برابر کاراکترهای ویژه (جلوگیری از شکستن مودال/XSS)
const escapeHtml = (value) => {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// تبدیل خطای خام دیتابیس هنگام حذف (مانند محدودیت کلید خارجی) به پیام فارسی
const friendlyDeleteError = (msg) => {
  if (!msg) return null;
  if (/foreign key|violates|constraint/i.test(msg)) {
    return "این رکورد در حال استفاده است و قابل حذف نیست؛ ابتدا ارجاع‌های آن را حذف کنید یا رکورد را غیرفعال کنید.";
  }
  return msg;
};

// نرمال‌سازی مسیر apiBase: پیشوند /api خودکار توسط apiService اضافه می‌شود،
// پس اگر اشتباهاً /api/... نوشته شده باشد حذفش می‌کنیم تا آدرس دوبار /api نشود
const normalizeApiPath = (path) => {
  if (!path) return path;
  const cleaned = path.replace(/^\/api(?=\/|$)/, "");
  return cleaned || path;
};

// ===== آیکون‌های فیلدها (فونت‌آوسام — بدون ایموجی) =====
const FIELD_ICONS = {
  name: "fa-tag",
  code: "fa-hashtag",
  description: "fa-align-left",
  treatment: "fa-notes-medical",
  category: "fa-folder-open",
  sort_order: "fa-sort-amount-down",
  color: "fa-palette",
  active: "fa-toggle-on",
  is_active: "fa-toggle-on",
  is_default: "fa-star",
  breed_id: "fa-dna",
  week_number: "fa-calendar-week",
  age_days: "fa-calendar-day",
  target_weight: "fa-weight-hanging",
  min_weight: "fa-arrow-down",
  max_weight: "fa-arrow-up",
  standard_fcr: "fa-calculator",
  standard_feed_intake: "fa-seedling",
  source_type: "fa-code-branch",
  source_description: "fa-file-alt",
  protein_percentage: "fa-percent",
  feed_stage: "fa-drumstick-bite",
  booster_needed: "fa-syringe",
  booster_days: "fa-hourglass-half",
  immunity_duration: "fa-shield-alt",
  storage_temp: "fa-thermometer-half",
  dilution_ratio: "fa-arrows-alt-h",
  precautions: "fa-shield-alt",
  notes: "fa-sticky-note",
  disease_ids: "fa-virus",
  vaccine_ids: "fa-syringe",
  medicine_ids: "fa-pills",
  feed_type_ids: "fa-seedling",
  suggestion_ids: "fa-lightbulb",
  ventilation_method: "fa-wind",
  fan_type: "fa-fan",
  air_flow_direction: "fa-compass",
  automatic_control: "fa-robot",
  automatic: "fa-robot",
  waterer_category: "fa-tags",
  material: "fa-cube",
  capacity: "fa-tachometer-alt",
  bird_count: "fa-egg",
};

const FIELD_TYPE_ICONS = {
  text: "fa-pen",
  textarea: "fa-align-left",
  number: "fa-hashtag",
  select: "fa-list-alt",
  boolean: "fa-toggle-on",
  color: "fa-palette",
};

class DictionaryManager {
  constructor() {
    this.initialized = false;
    this.currentKey = null;
    this.schema = null;
    this.data = [];
    this.container = null;
    this.selectOptions = {};
  }

  // کلید ستون وضعیت (پیش‌فرض active؛ برخی جداول مثل استاندارد وزنی is_active دارند)
  get activeKey() {
    return (this.schema && this.schema.activeKey) || "active";
  }

  // ===== گزینه‌های یک فیلد select =====
  getSelectOptions(field) {
    return (
      this.selectOptions[`${this.currentKey}:${field.key}`] || []
    );
  }

  // ===== بارگذاری گزینه‌های فیلدهای select (استاتیک یا از دیکشنری دیگر) =====
  async loadSelectOptions() {
    if (!this.schema) return;
    const tasks = this.schema.fields
      .filter(
        (f) =>
          f.type === "select" &&
          !this.selectOptions[`${this.currentKey}:${f.key}`],
      )
      .map(async (field) => {
        let options = [];
        if (Array.isArray(field.options)) {
          options = field.options.map((o) =>
            typeof o === "object" && o !== null
              ? { value: o.value, label: o.label }
              : { value: o, label: String(o) },
          );
        } else if (field.optionsSource) {
          try {
            const res = await dictionaryApi.getData(
              field.optionsSource.endpoint,
              { active: "all" },
            );
            const rows = Array.isArray(res.data) ? res.data : [];
            const {
              valueKey = "id",
              labelKey = "name",
              codeKey = null,
            } = field.optionsSource;
            options = rows.map((r) => ({
              value: r[valueKey],
              label:
                codeKey && r[codeKey]
                  ? `${r[labelKey]} (${r[codeKey]})`
                  : r[labelKey],
            }));
          } catch (err) {
            console.error("❌ خطا در بارگذاری گزینه‌ها:", err);
          }
        }
        this.selectOptions[`${this.currentKey}:${field.key}`] = options;
      });
    await Promise.all(tasks);
  }

  // برچسب خوانا برای مقدار یک فیلد select (در جدول و پیام حذف)
  getSelectLabel(field, rawValue) {
    if (rawValue === null || rawValue === undefined) return "";
    if (field.type !== "select") return String(rawValue);
    const opt = this.getSelectOptions(field).find(
      (o) => String(o.value) === String(rawValue),
    );
    return opt ? opt.label : String(rawValue);
  }

  // آیکون فونت‌آوسام مناسب هر فیلد (اول آیکون صریح، بعد کلید، بعد نوع فیلد)
  getFieldIcon(field) {
    if (!field) return "fa-i-cursor";
    if (field.icon) return field.icon;
    if (FIELD_ICONS[field.key]) return FIELD_ICONS[field.key];
    return FIELD_TYPE_ICONS[field.type] || "fa-i-cursor";
  }

  // ===== لایه درخواست‌ها: جداول مستقل با schema.apiBase مستقیم صدا زده می‌شوند =====
  apiGet() {
    const base = normalizeApiPath(this.schema?.apiBase);
    if (base) {
      return apiService.get(base, { active: "all" });
    }
    return dictionaryApi.getData(this.currentKey, { active: "all" });
  }

  apiCreate(payload) {
    const base = normalizeApiPath(this.schema?.apiBase);
    if (base) {
      return apiService.post(base, payload);
    }
    return dictionaryApi.create(this.currentKey, payload);
  }

  apiUpdate(id, payload) {
    const base = normalizeApiPath(this.schema?.apiBase);
    if (base) {
      return apiService.put(`${base}/${id}`, payload);
    }
    return dictionaryApi.update(this.currentKey, id, payload);
  }

  apiDelete(id) {
    const base = normalizeApiPath(this.schema?.apiBase);
    if (base) {
      return apiService.delete(`${base}/${id}`);
    }
    return dictionaryApi.delete(this.currentKey, id);
  }

  // ===== مقداردهی =====
  init(containerSelector = "#dictionary-management") {
    this.container = document.querySelector(containerSelector);
    if (!this.container) return;

    this.initialized = true;
    this.renderShell();

    // انتخاب اولین جدول به‌صورت پیش‌فرض
    const firstKey = Object.keys(getAllDictionarySchemas())[0];
    this.selectTable(firstKey);
  }

  // ===== ساختار اصلی کامپوننت =====
  renderShell() {
    const schemas = getAllDictionarySchemas();
    const keys = Object.keys(schemas);

    const tableMenu = keys
      .map(
        (key) => `
        <div class="dict-table-item" data-dict-key="${key}" onclick="window.dictManager.selectTable('${key}')">
          <i class="fas ${schemas[key].icon} dict-table-icon"></i>
          <span class="dict-table-name">${schemas[key].title}</span>
        </div>
      `,
      )
      .join("");

    this.container.innerHTML = `
      <div class="dict-manager">
        <!-- ===== ستون راست: لیست جداول ===== -->
        <div class="dict-sidebar">
          <div class="dict-sidebar-header">
            <i class="fas fa-book"></i>
            <span>جداول دیکشنری</span>
          </div>
          <div class="dict-table-list">
            ${tableMenu}
          </div>
        </div>

        <!-- ===== ستون چپ: محتوای جدول انتخاب‌شده ===== -->
        <div class="dict-content">
          <div class="dict-content-header" id="dictContentHeader">
            <div>
              <h3 id="dictTitle"><i class="fas fa-book"></i><span>انتخاب جدول</span></h3>
              <p id="dictSubtitle">از لیست سمت راست یک جدول را انتخاب کنید</p>
            </div>
            <button class="dict-add-btn" id="dictAddBtn" onclick="window.dictManager.openCreateModal()">
              <i class="fas fa-plus"></i> ایجاد جدید
            </button>
          </div>

          <div id="dictTableWrapper" class="dict-table-wrapper">
            <div class="dict-empty-state">
              <i class="fas fa-inbox"></i>
              <p>جدولی انتخاب نشده است</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ===== انتخاب جدول =====
  async selectTable(key) {
    this.currentKey = key;
    this.schema = getDictionarySchema(key);
    if (!this.schema) return;

    // فعال‌سازی آیتم منو
    this.container
      .querySelectorAll(".dict-table-item")
      .forEach((el) => el.classList.remove("active"));
    this.container
      .querySelector(`.dict-table-item[data-dict-key="${key}"]`)
      ?.classList.add("active");

    // آپدیت هدر
    const titleEl = this.container.querySelector("#dictTitle");
    if (titleEl) {
      titleEl.innerHTML = `<i class="fas ${this.schema.icon}"></i><span>${this.schema.title}</span>`;
    }
    const subtitleEl = this.container.querySelector("#dictSubtitle");
    if (subtitleEl) {
      subtitleEl.textContent = `مدیریت رکوردهای جدول «${this.schema.title}»`;
    }

    await this.loadData();
  }

  // ===== بارگذاری داده‌ها =====
  async loadData() {
    if (!this.schema) return;

    const wrapper = this.container.querySelector("#dictTableWrapper");
    if (!wrapper) return;

    wrapper.innerHTML = `
      <div class="dict-loading">
        <i class="fas fa-spinner fa-spin"></i>
        <span>در حال بارگذاری...</span>
      </div>
    `;

    try {
      // ابتدا گزینه‌های فیلدهای select (مثلاً لیست نژادها) بارگذاری می‌شوند
      await this.loadSelectOptions();
      const res = await this.apiGet();
      this.data = Array.isArray(res.data) ? res.data : [];
      this.renderTable();
    } catch (error) {
      console.error("❌ خطا در بارگذاری جدول دیکشنری:", error);
      wrapper.innerHTML = `
        <div class="dict-error-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>خطا در دریافت داده‌ها</p>
          <button onclick="window.dictManager.loadData()">تلاش مجدد</button>
        </div>
      `;
    }
  }

  // ===== رندر جدول بر اساس schema =====
  renderTable() {
    const wrapper = this.container.querySelector("#dictTableWrapper");
    if (!wrapper || !this.schema) return;

    const fields = this.schema.fields;
    const canToggle = this.schema.canToggle !== false;
    // فیلد active برای جدول‌های toggle‌دار در ستون مستقل «وضعیت» نمایش داده می‌شود،
    // بنابراین از ستون‌های عادی حذف می‌شود تا تکراری نباشد.
    const displayFields = canToggle
      ? fields.filter(
          (f) => f.key !== "active" && f.key !== this.activeKey,
        )
      : fields;
    // تعداد کل ستون‌ها: شناسه + فیلدها + (وضعیت) + عملیات
    const totalCols = 1 + displayFields.length + (canToggle ? 1 : 0) + 1;

    // سرستون‌ها — برچسب فارسی هر فیلد
    const theadCols = displayFields
      .map((f) => `<th>${f.label}</th>`)
      .join("");
    // ستون وضعیت فقط برای جداولی که active دارند
    const statusCol = canToggle ? `<th>وضعیت</th>` : "";
    const actionCol = `<th>عملیات</th>`;

    let rows = "";
    if (this.data.length === 0) {
      rows = `
        <tr>
          <td colspan="${totalCols}" style="text-align:center; color:#94a3b8; padding:40px;">
            <i class="fas fa-inbox" style="font-size:28px; display:block; margin-bottom:10px;"></i>
            هیچ رکوردی یافت نشد
          </td>
        </tr>
      `;
    } else {
      const allActive = (item) => item[this.activeKey] !== false;

      rows = this.data
        .map((item) => {
          const cells = displayFields
            .map((f) => {
              const raw = item[f.key];
              if (raw === null || raw === undefined) return `<td>-</td>`;

              if (f.type === "boolean") {
                return `<td>${raw ? "✅ بله" : "❌ خیر"}</td>`;
              }

              if (f.type === "color") {
                const hex = escapeHtml(raw);
                return `<td><span class="dict-color-chip"><span style="background:${hex}"></span>${hex}</span></td>`;
              }

              let text =
                f.type === "select"
                  ? escapeHtml(this.getSelectLabel(f, raw) || String(raw))
                  : escapeHtml(String(raw));
              if (text.length > 60) text = text.substring(0, 60) + "...";
              return `<td>${text}</td>`;
            })
            .join("");

          const active = allActive(item);
          const statusBadge = canToggle
            ? `<td>${active ? '<span class="dict-status-badge active">فعال</span>' : '<span class="dict-status-badge inactive">غیرفعال</span>'}</td>`
            : "";

          const toggleBtn = canToggle
            ? `<button class="dict-action-btn toggle" title="فعال/غیرفعال" onclick="window.dictManager.toggleActive(${item.id})">
                <i class="fas ${active ? "fa-eye-slash" : "fa-eye"}"></i>
              </button>`
            : "";

          return `
            <tr>
              <td>${item.id}</td>
              ${cells}
              ${statusBadge}
              <td>
                <div class="dict-actions">
                  <button class="dict-action-btn edit" title="ویرایش" onclick="window.dictManager.openEditModal(${item.id})">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="dict-action-btn delete" title="حذف" onclick="window.dictManager.deleteItem(${item.id})">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                  ${toggleBtn}
                </div>
              </td>
            </tr>
          `;
        })
        .join("");
    }

    wrapper.innerHTML = `
      <div class="dict-table-container">
        <table class="dict-table">
          <thead>
            <tr>
              <th>شناسه</th>
              ${theadCols}
              ${statusCol}
              ${actionCol}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="dict-table-footer">
        <span>${this.data.length} رکورد</span>
      </div>
    `;
  }

  // ===== ساخت فرم HTML بر اساس schema =====
  buildFormHtml(data = {}) {
    const fields = this.schema.fields;
    return fields
      .map((f) => {
        const value =
          data[f.key] !== undefined && data[f.key] !== null ? data[f.key] : "";
        const fieldIcon = this.getFieldIcon(f);
        const isWide = f.type === "textarea" || f.wide === true;
        const typeClass = `dict-ft-${f.type}`;
        let input = "";

        switch (f.type) {
          case "textarea":
            input = `<textarea id="dict-field-${f.key}" rows="3" placeholder=" ">${escapeHtml(value)}</textarea>`;
            break;
          case "number":
            input = `<input type="number" id="dict-field-${f.key}" value="${escapeHtml(value)}" step="any"${f.min !== undefined ? ` min="${f.min}"` : ""}${f.max !== undefined ? ` max="${f.max}"` : ""}>`;
            break;
          case "boolean":
            input = `
              <div class="dict-checkbox-wrapper">
                <label class="dict-switch">
                  <input type="checkbox" id="dict-field-${f.key}" ${value ? "checked" : ""}>
                  <span class="dict-switch-slider"></span>
                </label>
                <span class="dict-checkbox-label">${value ? "بله" : "خیر"}</span>
              </div>
            `;
            break;
          case "select": {
            const options = this.getSelectOptions(f);
            const hasValue =
              value !== "" && value !== null && value !== undefined;
            const optionsHtml = options
              .map(
                (o) =>
                  `<option value="${escapeHtml(o.value)}" ${
                    hasValue && String(o.value) === String(value)
                      ? "selected"
                      : ""
                  }>${escapeHtml(o.label)}</option>`,
              )
              .join("");
            // اگر هنوز گزینه‌ای بارگذاری نشده اما مقداری وجود دارد، همان مقدار نمایش داده شود
            const fallbackHtml =
              !hasValue && options.length === 0
                ? '<option value="" disabled selected>— گزینه‌ای یافت نشد —</option>'
                : "";
            const placeholderHtml =
              hasValue || options.length === 0
                ? ""
                : '<option value="" disabled selected>— انتخاب کنید —</option>';
            input = `<select id="dict-field-${f.key}" ${f.required ? "required" : ""}>
              ${placeholderHtml}
              ${fallbackHtml}
              ${optionsHtml}
            </select>`;
            break;
          }
          case "color":
            input = `<input type="color" id="dict-field-${f.key}" value="${escapeHtml(value || "#000000")}">`;
            break;
          default:
            input = `<input type="text" id="dict-field-${f.key}" value="${escapeHtml(value)}" placeholder=" ">`;
        }

        return `
          <div class="dict-form-field ${f.required ? "required" : ""} ${typeClass} ${isWide ? "wide" : ""}">
            <label for="dict-field-${f.key}">
              <span class="dict-field-icon"><i class="fas ${fieldIcon}"></i></span>
              <span class="dict-field-label-text">${f.label}</span>
              ${f.required ? '<span class="dict-required-star">*</span>' : ""}
            </label>
            ${input}
          </div>
        `;
      })
      .join("");
  }

  // ===== جمع‌آوری مقادیر فرم =====
  collectFormData() {
    const data = {};
    this.schema.fields.forEach((f) => {
      const el = document.getElementById(`dict-field-${f.key}`);
      if (!el) return;
      const rawValue = el.value;

      if (f.type === "number") {
        data[f.key] = rawValue !== "" ? Number(rawValue) : null;
      } else if (f.type === "boolean") {
        data[f.key] = el.checked;
      } else if (f.type === "color") {
        data[f.key] = rawValue || null;
      } else if (f.type === "select") {
        if (rawValue === "") {
          data[f.key] = null;
        } else {
          const opt = this.getSelectOptions(f).find(
            (o) => String(o.value) === String(rawValue),
          );
          data[f.key] = opt ? opt.value : rawValue;
        }
      } else {
        data[f.key] = rawValue !== "" ? rawValue : null;
      }
    });
    return data;
  }

  // ===== اعتبارسنجی =====
  validateForm(data) {
    for (const f of this.schema.fields) {
      if (f.required) {
        const val = data[f.key];
        if (val === null || val === undefined || val === "") {
          return `فیلد «${f.label}» الزامی است`;
        }
      }
    }
    return null;
  }

  // ===== مودال ایجاد =====
  openCreateModal() {
    if (!this.schema) return;
    if (typeof Swal === "undefined") {
      alert("SweetAlert در دسترس نیست");
      return;
    }

    const formHtml = this.buildFormHtml();
    Swal.fire({
      title: `<div class="dict-modal-title"><span class="dict-modal-title-icon"><i class="fas ${this.schema.icon}"></i></span><span class="dict-modal-title-text">ایجاد رکورد جدید در «${this.schema.title}»</span></div>`,
      html: `<div class="dict-form-grid">${formHtml}</div>`,
      width: "780px",
      confirmButtonText: "ایجاد",
      cancelButtonText: "انصراف",
      showCancelButton: true,
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      customClass: { popup: "dict-swal-popup" },
      preConfirm: async () => {
        const data = this.collectFormData();
        const error = this.validateForm(data);
        if (error) {
          Swal.showValidationMessage(error);
          return false;
        }
        try {
          const res = await this.apiCreate(data);
          if (res.success) return data;
          Swal.showValidationMessage(res.message || "خطا در ایجاد رکورد");
          return false;
        } catch (e) {
          Swal.showValidationMessage(e.message || "خطا در ارتباط با سرور");
          return false;
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: "success",
          title: '<i class="fas fa-check-circle" style="color:#16a34a"></i> ایجاد شد',
          text: "رکورد جدید با موفقیت ایجاد شد",
          timer: 1500,
          showConfirmButton: false,
        });
        this.loadData();
      }
    });
  }

  // ===== مودال ویرایش =====
  async openEditModal(id) {
    if (!this.schema) return;
    if (typeof Swal === "undefined") {
      alert("SweetAlert در دسترس نیست");
      return;
    }

    const item = this.data.find((d) => d.id == id);
    if (!item) return;

    const formHtml = this.buildFormHtml(item);
    Swal.fire({
      title: `<div class="dict-modal-title"><span class="dict-modal-title-icon"><i class="fas ${this.schema.icon}"></i></span><span class="dict-modal-title-text">ویرایش رکورد #${id}</span></div>`,
      html: `<div class="dict-form-grid">${formHtml}</div>`,
      width: "780px",
      confirmButtonText: "ذخیره",
      cancelButtonText: "انصراف",
      showCancelButton: true,
      confirmButtonColor: "#2c7a6e",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
      customClass: { popup: "dict-swal-popup" },
      preConfirm: async () => {
        const data = this.collectFormData();
        const error = this.validateForm(data);
        if (error) {
          Swal.showValidationMessage(error);
          return false;
        }
        try {
          const res = await this.apiUpdate(id, data);
          if (res.success) return data;
          Swal.showValidationMessage(res.message || "خطا در ذخیره");
          return false;
        } catch (e) {
          Swal.showValidationMessage(e.message || "خطا در ارتباط با سرور");
          return false;
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: "success",
          title: '<i class="fas fa-check-circle" style="color:#16a34a"></i> ذخیره شد',
          timer: 1500,
          showConfirmButton: false,
        });
        this.loadData();
      }
    });
  }

  // ===== حذف رکورد =====
  async deleteItem(id) {
    if (!this.schema) return;

    const item = this.data.find((d) => d.id == id);
    // استفاده از اولین فیلد schema برای نمایش نام رکورد (هماهنگ با هر جدول)
    const firstField = this.schema.fields[0];
    const rawValue = item?.[firstField.key];
    const displayValue =
      firstField.type === "select"
        ? this.getSelectLabel(firstField, rawValue)
        : rawValue;
    const name = escapeHtml(displayValue || `#${id}`);

    const confirmResult = await Swal.fire({
      title: '<i class="fas fa-trash-alt" style="color:#dc2626"></i> تأیید حذف',
      html: `آیا از حذف <strong>«${name}»</strong> اطمینان دارید؟`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "بله، حذف شود",
      cancelButtonText: "انصراف",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      reverseButtons: true,
    });

    if (!confirmResult.isConfirmed) return;

    try {
      const res = await this.apiDelete(id);
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: '<i class="fas fa-check-circle" style="color:#16a34a"></i> حذف شد',
          text: "رکورد با موفقیت حذف شد",
          timer: 1500,
          showConfirmButton: false,
        });
        this.loadData();
      } else {
        Swal.fire({
          icon: "error",
          title: '<i class="fas fa-times-circle" style="color:#dc2626"></i> خطا',
          text: friendlyDeleteError(res.message) || "حذف انجام نشد",
        });
      }
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: '<i class="fas fa-times-circle" style="color:#dc2626"></i> خطا',
        text: error.message || "خطا در ارتباط با سرور",
      });
    }
  }

  // ===== فعال/غیرفعال کردن =====
  async toggleActive(id) {
    if (!this.schema) return;

    const item = this.data.find((d) => d.id == id);
    if (!item) return;

    const newActive = item[this.activeKey] === false;

    try {
      const res = await this.apiUpdate(id, {
        [this.activeKey]: newActive,
      });
      if (res.success) {
        Swal.fire({
          icon: "success",
          title: newActive
            ? '<i class="fas fa-check-circle" style="color:#16a34a"></i> فعال شد'
            : '<i class="fas fa-pause-circle" style="color:#d97706"></i> غیرفعال شد',
          timer: 1000,
          showConfirmButton: false,
        });
        this.loadData();
      }
    } catch (error) {
      console.error("❌ خطا در تغییر وضعیت:", error);
    }
  }
}

// ===== Export instance =====
export const dictionaryManager = new DictionaryManager();

// ===== قرار دادن در window =====
if (typeof window !== "undefined") {
  window.DictionaryManager = DictionaryManager;
  window.dictManager = dictionaryManager;
}
